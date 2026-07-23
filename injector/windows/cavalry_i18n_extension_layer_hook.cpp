/**
 * [INPUT]: 依赖精确 ExtensionLayer/Qt6Gui PE 导入事实、CavalryEmbeddedTranslator 与 Windows 页面保护 API
 * [OUTPUT]: 对外实现单 IAT 槽替换、四条精确自绘提示、未知文本原绘制回退、CJK 字体 fallback、水平中心补偿及卸载恢复
 * [POS]: injector/windows 的 Windows-only 自绘文字适配器；不扫描字符串段、不改厂商 DLL、不注入其他进程且不触碰非白名单 source
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_hook.h"

#include "cavalry_i18n_pe_iat.h"
#include "cavalry_i18n_translator.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <psapi.h>

#include <QtCore/QByteArray>
#include <QtCore/QPointF>
#include <QtGui/QFont>
#include <QtGui/QFontMetrics>
#include <QtGui/QPainter>

#include <array>
#include <atomic>
#include <cwchar>

namespace {

constexpr wchar_t kTargetModuleName[] = L"ExtensionLayer.dll";
constexpr wchar_t kQt6GuiModuleName[] = L"Qt6Gui.dll";
constexpr char kQPainterDrawPointTextSymbol[] =
    "?drawText@QPainter@@QEAAXAEBVQPointF@@AEBVQString@@@Z";

using QPainterDrawPointTextFunction =
    void (*)(QPainter *, const QPointF &, const QString &);

std::atomic<CavalryExtensionLayerHook *> gActiveHook { nullptr };
std::atomic<QPainterDrawPointTextFunction> gOriginalDrawText { nullptr };

QString withLastError(const QString &prefix)
{
    return QStringLiteral("%1 (Win32 error %2).").arg(prefix).arg(GetLastError());
}

bool hasExpectedModuleName(HMODULE module)
{
    std::array<wchar_t, 32768> modulePath {};
    const DWORD length = GetModuleFileNameW(
        module,
        modulePath.data(),
        static_cast<DWORD>(modulePath.size()));
    if (length == 0 || length >= modulePath.size() - 1) {
        return false;
    }

    const wchar_t *fileName = std::wcsrchr(modulePath.data(), L'\\');
    fileName = fileName == nullptr ? modulePath.data() : fileName + 1;
    return _wcsicmp(fileName, kTargetModuleName) == 0;
}

bool replaceIatPointer(
    void **slot,
    void *expectedCurrent,
    void *replacement,
    QString *failureDetail)
{
    if (slot == nullptr || expectedCurrent == nullptr || replacement == nullptr) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral("IAT replacement received a null pointer.");
        }
        return false;
    }

    DWORD oldProtection = 0;
    if (!VirtualProtect(
            slot,
            sizeof(*slot),
            PAGE_READWRITE,
            &oldProtection)) {
        if (failureDetail != nullptr) {
            *failureDetail = withLastError(
                QStringLiteral("VirtualProtect could not unlock the IAT slot"));
        }
        return false;
    }

    if (*slot != expectedCurrent) {
        DWORD ignoredProtection = 0;
        VirtualProtect(slot, sizeof(*slot), oldProtection, &ignoredProtection);
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "The verified IAT slot changed before replacement.");
        }
        return false;
    }

    *slot = replacement;
    FlushInstructionCache(GetCurrentProcess(), slot, sizeof(*slot));

    DWORD ignoredProtection = 0;
    if (VirtualProtect(slot, sizeof(*slot), oldProtection, &ignoredProtection)) {
        return true;
    }

    const DWORD restoreError = GetLastError();
    *slot = expectedCurrent;
    FlushInstructionCache(GetCurrentProcess(), slot, sizeof(*slot));
    VirtualProtect(slot, sizeof(*slot), oldProtection, &ignoredProtection);
    if (failureDetail != nullptr) {
        *failureDetail = QStringLiteral(
            "IAT page protection could not be restored (Win32 error %1); original pointer was restored.")
            .arg(restoreError);
    }
    return false;
}

void cavalryExtensionLayerDrawPointTextReplacement(
    QPainter *painter,
    const QPointF &point,
    const QString &source)
{
    const QPainterDrawPointTextFunction original =
        gOriginalDrawText.load(std::memory_order_acquire);
    if (original == nullptr) {
        return;
    }

    CavalryExtensionLayerHook *hook =
        gActiveHook.load(std::memory_order_acquire);
    if (hook == nullptr) {
        original(painter, point, source);
        return;
    }

    hook->drawWhitelistedText(painter, point, source);
}

} // namespace

CavalryExtensionLayerHook::CavalryExtensionLayerHook(
    CavalryEmbeddedTranslator &translator)
    : translator_(translator)
{
}

CavalryExtensionLayerHook::~CavalryExtensionLayerHook()
{
    uninstall();
}

bool CavalryExtensionLayerHook::ensureInstalled()
{
    if (installed_) {
        return true;
    }
    if (terminalFailure_) {
        return false;
    }

    HMODULE extensionLayer = GetModuleHandleW(kTargetModuleName);
    if (extensionLayer == nullptr) {
        status_ = QStringLiteral("waiting-for-extension-layer");
        detail_ = QStringLiteral("ExtensionLayer.dll is not loaded yet.");
        return false;
    }
    if (!hasExpectedModuleName(extensionLayer)) {
        status_ = QStringLiteral("unsupported");
        detail_ = QStringLiteral(
            "GetModuleHandleW returned a module whose basename is not ExtensionLayer.dll.");
        terminalFailure_ = true;
        return false;
    }

    MODULEINFO moduleInfo {};
    if (!GetModuleInformation(
            GetCurrentProcess(),
            extensionLayer,
            &moduleInfo,
            sizeof(moduleInfo))
        || moduleInfo.lpBaseOfDll == nullptr || moduleInfo.SizeOfImage == 0) {
        status_ = QStringLiteral("unsupported");
        detail_ = withLastError(
            QStringLiteral("GetModuleInformation could not inspect ExtensionLayer.dll"));
        terminalFailure_ = true;
        return false;
    }

    const auto *image =
        static_cast<const std::uint8_t *>(moduleInfo.lpBaseOfDll);
    const CavalryPeIatLookupResult lookup = findCavalryPe64IatSlot(
        image,
        moduleInfo.SizeOfImage,
        "Qt6Gui.dll",
        kQPainterDrawPointTextSymbol);
    if (lookup.status != CavalryPeIatLookupStatus::Found) {
        status_ = QStringLiteral("unsupported");
        detail_ = QStringLiteral(
            "ExtensionLayer.dll PE/IAT contract rejected: %1.")
            .arg(QString::fromLatin1(cavalryPeIatLookupStatusName(lookup.status)));
        terminalFailure_ = true;
        return false;
    }

    HMODULE qt6Gui = GetModuleHandleW(kQt6GuiModuleName);
    const FARPROC qtDrawText = qt6Gui == nullptr
        ? nullptr
        : GetProcAddress(qt6Gui, kQPainterDrawPointTextSymbol);
    if (qtDrawText == nullptr) {
        status_ = QStringLiteral("unsupported");
        detail_ = QStringLiteral(
            "Qt6Gui.dll does not export the expected QPainter::drawText(PointF, QString) ABI.");
        terminalFailure_ = true;
        return false;
    }

    auto **slot = reinterpret_cast<void **>(
        const_cast<std::uint8_t *>(image) + lookup.iatSlotOffset);
    void *const original = *slot;
    void *const expectedQtTarget = reinterpret_cast<void *>(qtDrawText);
    if (original != expectedQtTarget) {
        status_ = QStringLiteral("unsupported");
        detail_ = QStringLiteral(
            "ExtensionLayer.dll QPainter::drawText IAT target does not match Qt6Gui.dll.");
        terminalFailure_ = true;
        return false;
    }
    if (gActiveHook.load(std::memory_order_acquire) != nullptr) {
        status_ = QStringLiteral("unsupported");
        detail_ = QStringLiteral("The ExtensionLayer IAT hook is already owned.");
        terminalFailure_ = true;
        return false;
    }

    gOriginalDrawText.store(
        reinterpret_cast<QPainterDrawPointTextFunction>(original),
        std::memory_order_release);
    QString replacementFailure;
    if (!replaceIatPointer(
            slot,
            original,
            reinterpret_cast<void *>(
                cavalryExtensionLayerDrawPointTextReplacement),
            &replacementFailure)) {
        gOriginalDrawText.store(nullptr, std::memory_order_release);
        status_ = QStringLiteral("unsupported");
        detail_ = replacementFailure;
        terminalFailure_ = true;
        return false;
    }

    iatSlot_ = slot;
    originalDrawText_ = original;
    gActiveHook.store(this, std::memory_order_release);
    installed_ = true;
    status_ = QStringLiteral("installed");
    detail_ = QStringLiteral(
        "Patched ExtensionLayer.dll's single Qt6Gui QPainter::drawText(PointF, QString) IAT slot.");
    return true;
}

bool CavalryExtensionLayerHook::isWaitingForModule() const
{
    return status_ == QStringLiteral("waiting-for-extension-layer");
}

QString CavalryExtensionLayerHook::status() const
{
    return status_;
}

QString CavalryExtensionLayerHook::detail() const
{
    return detail_;
}

void CavalryExtensionLayerHook::drawWhitelistedText(
    QPainter *painter,
    const QPointF &point,
    const QString &source)
{
    const QPainterDrawPointTextFunction original =
        gOriginalDrawText.load(std::memory_order_acquire);
    if (original == nullptr) {
        return;
    }

    if (painter == nullptr) {
        return;
    }

    const QString translated = translationForWhitelistedSource(translator_, source);
    if (translated.isEmpty() || translated == source) {
        original(painter, point, source);
        return;
    }

    const QFont sourceFont = painter->font();
    const int sourceWidth = QFontMetrics(sourceFont).boundingRect(source).width();

    QFont displayFont = sourceFont;
    // ExtensionLayer 可能启用 NoFontMerging；恢复默认策略才能让 Windows 为 CJK 选取字体 fallback。
    displayFont.setStyleStrategy(QFont::PreferDefault);
    painter->setFont(displayFont);
    const int translatedWidth =
        QFontMetrics(displayFont).boundingRect(translated).width();

    // 厂商 helper 已以英文宽度算出中心。只补偿 x，保持图标、面板几何和 y 基线不变。
    const QPointF centeredPoint(
        point.x() + static_cast<qreal>(sourceWidth - translatedWidth) / 2.0,
        point.y());
    original(painter, centeredPoint, translated);
    painter->setFont(sourceFont);
}

QString CavalryExtensionLayerHook::translationForWhitelistedSource(
    const CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    if (source != QStringLiteral("Double click here to import Assets.")
        && source != QStringLiteral("Drag layers here to see their settings.")
        && source
            != QStringLiteral(
                "Drag some JavaScript here to make a Snippet.")
        && source
            != QStringLiteral(
                "Use the Create menu to add a layer to your Composition.")) {
        return QString();
    }

    const QByteArray utf8 = source.toUtf8();
    return translator.translate(nullptr, utf8.constData());
}

void CavalryExtensionLayerHook::uninstall()
{
    CavalryExtensionLayerHook *expected = this;
    gActiveHook.compare_exchange_strong(
        expected,
        nullptr,
        std::memory_order_acq_rel);

    if (!installed_ || iatSlot_ == nullptr || originalDrawText_ == nullptr) {
        return;
    }

    QString ignoredFailure;
    replaceIatPointer(
        iatSlot_,
        reinterpret_cast<void *>(cavalryExtensionLayerDrawPointTextReplacement),
        originalDrawText_,
        &ignoredFailure);
    iatSlot_ = nullptr;
    originalDrawText_ = nullptr;
    installed_ = false;
}
