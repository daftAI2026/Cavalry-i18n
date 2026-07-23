/**
 * [INPUT]: 依赖 ExtensionLayer/CavalryUI/Qt6Core PE 导入事实、CavalryEmbeddedTranslator 与 Windows 页面保护 API
 * [OUTPUT]: 对外实现两个可逆 IAT 替换：空状态 helper 与经 setPlaceholder 调用链验证的 placeholder 赋值；未知 source 原样透传
 * [POS]: injector/windows 的 Windows-only 空状态适配器；不扫描字符串段、不写厂商 .text、不修改厂商 DLL、不注入其他进程
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_hook.h"

#include "cavalry_i18n_pe_iat.h"
#include "cavalry_i18n_extension_layer_sources.h"
#include "cavalry_i18n_translator.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <psapi.h>

#include <intrin.h>

#include <QtCore/QByteArray>
#include <QtGui/QColor>
#include <QtGui/QPixmap>
#include <QtWidgets/QWidget>

#include <array>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <cwchar>

#pragma intrinsic(_ReturnAddress)

namespace {

constexpr wchar_t kExtensionLayerModuleName[] = L"ExtensionLayer.dll";
constexpr wchar_t kCavalryUiModuleName[] = L"CavalryUI.dll";
constexpr wchar_t kQt6CoreModuleName[] = L"Qt6Core.dll";
constexpr char kCavalryUiImportName[] = "CavalryUI.dll";
constexpr char kTextAtWidgetCentreSymbol[] =
    "?textAtWidgetCentre@ui@@YAXPEAVQWidget@@AEBVQString@@AEBVQColor@@PEBVQPixmap@@@Z";
constexpr char kSetPlaceholderSymbol[] =
    "?setPlaceholder@CustomListWidget@cavalry@@QEAAXAEBVQString@@@Z";
constexpr char kQStringAssignmentSymbol[] =
    "??4QString@@QEAAAEAV0@AEBV0@@Z";
constexpr std::size_t kSetPlaceholderThunkRva = 0x00015A87;
constexpr std::size_t kSetPlaceholderSetterRva = 0x002759F0;
constexpr std::uintptr_t kQStringAssignmentNameRva = 0x01B7CBD2;
constexpr std::array<std::uint8_t, 15> kSetPlaceholderSetterPrologue {{
    0xB8, 0xA8, 0x00, 0x00, 0x00,
    0x48, 0x03, 0x81, 0x90, 0x01, 0x00, 0x00,
    0x48, 0x89, 0xC1,
}};

using TextAtWidgetCentreFunction =
    void (*)(QWidget *, const QString &, const QColor &, const QPixmap *);
using QStringAssignmentFunction =
    QString &(*)(QString *, const QString &);

std::atomic<CavalryExtensionLayerHook *> gActiveHook { nullptr };
std::atomic<TextAtWidgetCentreFunction> gOriginalTextAtWidgetCentre { nullptr };
std::atomic<QStringAssignmentFunction> gOriginalPlaceholderAssignment { nullptr };

QString withLastError(const QString &prefix)
{
    return QStringLiteral("%1 (Win32 error %2).").arg(prefix).arg(GetLastError());
}

bool hasExpectedModuleName(HMODULE module, const wchar_t *expectedName)
{
    if (expectedName == nullptr) {
        return false;
    }

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
    return _wcsicmp(fileName, expectedName) == 0;
}

bool moduleContainsRange(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    const std::uint8_t *address,
    std::size_t size)
{
    if (moduleBase == nullptr || address == nullptr || size > moduleSize) {
        return false;
    }

    const std::uintptr_t base = reinterpret_cast<std::uintptr_t>(moduleBase);
    const std::uintptr_t pointer = reinterpret_cast<std::uintptr_t>(address);
    if (pointer < base) {
        return false;
    }
    const std::size_t offset = static_cast<std::size_t>(pointer - base);
    return offset <= moduleSize && size <= moduleSize - offset;
}

bool readNearJumpTarget(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    const std::uint8_t *instruction,
    const std::uint8_t **target)
{
    if (target == nullptr
        || !moduleContainsRange(moduleBase, moduleSize, instruction, 5)
        || instruction[0] != 0xE9) {
        return false;
    }

    std::int32_t displacement = 0;
    std::memcpy(&displacement, instruction + 1, sizeof(displacement));
    const std::intptr_t resolved =
        static_cast<std::intptr_t>(reinterpret_cast<std::uintptr_t>(instruction + 5))
        + displacement;
    const auto *resolvedPointer =
        reinterpret_cast<const std::uint8_t *>(resolved);
    if (!moduleContainsRange(moduleBase, moduleSize, resolvedPointer, 1)) {
        return false;
    }

    *target = resolvedPointer;
    return true;
}

bool isUnresolvedPlaceholderAssignmentSlot(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    void *candidate)
{
    const std::uintptr_t candidateValue =
        reinterpret_cast<std::uintptr_t>(candidate);
    const std::uintptr_t moduleBaseValue =
        reinterpret_cast<std::uintptr_t>(moduleBase);
    return candidateValue == kQStringAssignmentNameRva
        || candidateValue == moduleBaseValue + kQStringAssignmentNameRva
        || moduleContainsRange(
            moduleBase,
            moduleSize,
            static_cast<const std::uint8_t *>(candidate),
            1);
}

template <std::size_t Count>
bool isExactStaticSource(
    const QString &source,
    const std::array<const char *, Count> &allowedSources)
{
    for (const char *allowedSource : allowedSources) {
        if (source == QString::fromLatin1(allowedSource)) {
            return true;
        }
    }
    return false;
}

bool validateSetPlaceholderAssignmentPath(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    HMODULE extensionLayer,
    void ***assignmentIatSlot,
    const std::uint8_t **setPlaceholderThunk,
    QString *failureDetail)
{
    if (moduleBase == nullptr || extensionLayer == nullptr
        || assignmentIatSlot == nullptr || setPlaceholderThunk == nullptr) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral("setPlaceholder path validation received a null pointer.");
        }
        return false;
    }
    if (kSetPlaceholderThunkRva >= moduleSize
        || kSetPlaceholderSetterRva >= moduleSize) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral("ExtensionLayer.dll is smaller than the canonical setPlaceholder RVAs.");
        }
        return false;
    }

    const auto *expectedThunk = moduleBase + kSetPlaceholderThunkRva;
    const FARPROC exportedThunk =
        GetProcAddress(extensionLayer, kSetPlaceholderSymbol);
    if (exportedThunk == nullptr
        || reinterpret_cast<const std::uint8_t *>(exportedThunk) != expectedThunk) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "ExtensionLayer.dll does not export the canonical CustomListWidget::setPlaceholder thunk.");
        }
        return false;
    }

    const std::uint8_t *setter = nullptr;
    if (!readNearJumpTarget(moduleBase, moduleSize, expectedThunk, &setter)
        || setter != moduleBase + kSetPlaceholderSetterRva) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "CustomListWidget::setPlaceholder no longer jumps to the canonical setter.");
        }
        return false;
    }
    if (!moduleContainsRange(
            moduleBase,
            moduleSize,
            setter,
            kSetPlaceholderSetterPrologue.size() + 7)
        || std::memcmp(
               setter,
               kSetPlaceholderSetterPrologue.data(),
               kSetPlaceholderSetterPrologue.size())
            != 0) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "CustomListWidget::setPlaceholder setter prologue does not match the Cavalry 2.7.2 ABI contract.");
        }
        return false;
    }

    const auto *tailJump = setter + kSetPlaceholderSetterPrologue.size();
    if (tailJump[0] != 0x48 || tailJump[1] != 0xFF || tailJump[2] != 0x25) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "CustomListWidget::setPlaceholder setter no longer tail-jumps through its QString assignment IAT slot.");
        }
        return false;
    }

    std::int32_t displacement = 0;
    std::memcpy(&displacement, tailJump + 3, sizeof(displacement));
    const std::intptr_t resolved =
        static_cast<std::intptr_t>(reinterpret_cast<std::uintptr_t>(tailJump + 7))
        + displacement;
    auto **resolvedSlot = reinterpret_cast<void **>(resolved);
    if (!moduleContainsRange(
            moduleBase,
            moduleSize,
            reinterpret_cast<const std::uint8_t *>(resolvedSlot),
            sizeof(*resolvedSlot))) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "CustomListWidget::setPlaceholder tail jump does not resolve to an IAT slot inside ExtensionLayer.dll.");
        }
        return false;
    }

    *assignmentIatSlot = resolvedSlot;
    *setPlaceholderThunk = expectedThunk;
    return true;
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

void cavalryExtensionLayerTextAtWidgetCentreReplacement(
    QWidget *widget,
    const QString &source,
    const QColor &color,
    const QPixmap *icon)
{
    const TextAtWidgetCentreFunction original =
        gOriginalTextAtWidgetCentre.load(std::memory_order_acquire);
    if (original == nullptr) {
        return;
    }

    CavalryExtensionLayerHook *hook =
        gActiveHook.load(std::memory_order_acquire);
    if (hook == nullptr) {
        original(widget, source, color, icon);
        return;
    }

    hook->forwardTextAtWidgetCentre(widget, source, color, icon);
}

QString &cavalryExtensionLayerQStringAssignmentReplacement(
    QString *destination,
    const QString &source)
{
    const QStringAssignmentFunction original =
        gOriginalPlaceholderAssignment.load(std::memory_order_acquire);
    if (original == nullptr) {
        return *destination;
    }

    CavalryExtensionLayerHook *hook =
        gActiveHook.load(std::memory_order_acquire);
    if (hook == nullptr) {
        return original(destination, source);
    }

    return hook->forwardPlaceholderAssignment(
        destination,
        source,
        _ReturnAddress());
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
    if (textAtWidgetCentreInstalled_ && placeholderAssignmentInstalled_) {
        return true;
    }
    if (terminalFailure_) {
        return false;
    }

    HMODULE extensionLayer = GetModuleHandleW(kExtensionLayerModuleName);
    if (extensionLayer == nullptr) {
        status_ = QStringLiteral("waiting-for-extension-layer");
        detail_ = QStringLiteral("ExtensionLayer.dll is not loaded yet.");
        return false;
    }
    if (!hasExpectedModuleName(extensionLayer, kExtensionLayerModuleName)) {
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
    if (!textAtWidgetCentreInstalled_) {
        const CavalryExtensionLayerHook *owner =
            gActiveHook.load(std::memory_order_acquire);
        if (owner != nullptr && owner != this) {
            status_ = QStringLiteral("unsupported");
            detail_ = QStringLiteral("The ExtensionLayer IAT hook is already owned.");
            terminalFailure_ = true;
            return false;
        }

        const CavalryPeIatLookupResult helperLookup = findCavalryPe64IatSlot(
            image,
            moduleInfo.SizeOfImage,
            kCavalryUiImportName,
            kTextAtWidgetCentreSymbol);
        if (helperLookup.status != CavalryPeIatLookupStatus::Found) {
            status_ = QStringLiteral("unsupported");
            detail_ = QStringLiteral(
                "ExtensionLayer.dll helper PE/IAT contract rejected: %1.")
                .arg(QString::fromLatin1(cavalryPeIatLookupStatusName(helperLookup.status)));
            terminalFailure_ = true;
            return false;
        }

        HMODULE cavalryUi = GetModuleHandleW(kCavalryUiModuleName);
        if (cavalryUi == nullptr
            || !hasExpectedModuleName(cavalryUi, kCavalryUiModuleName)) {
            status_ = QStringLiteral("unsupported");
            detail_ = QStringLiteral(
                "CavalryUI.dll is unavailable or does not match the expected module basename.");
            terminalFailure_ = true;
            return false;
        }

        const FARPROC textAtWidgetCentre =
            GetProcAddress(cavalryUi, kTextAtWidgetCentreSymbol);
        if (textAtWidgetCentre == nullptr) {
            status_ = QStringLiteral("unsupported");
            detail_ = QStringLiteral(
                "CavalryUI.dll does not export the expected ui::textAtWidgetCentre ABI.");
            terminalFailure_ = true;
            return false;
        }

        auto **helperSlot = reinterpret_cast<void **>(
            const_cast<std::uint8_t *>(image) + helperLookup.iatSlotOffset);
        void *const originalHelper = *helperSlot;
        if (originalHelper != reinterpret_cast<void *>(textAtWidgetCentre)) {
            status_ = QStringLiteral("unsupported");
            detail_ = QStringLiteral(
                "ExtensionLayer.dll ui::textAtWidgetCentre IAT target does not match CavalryUI.dll.");
            terminalFailure_ = true;
            return false;
        }

        gOriginalTextAtWidgetCentre.store(
            reinterpret_cast<TextAtWidgetCentreFunction>(originalHelper),
            std::memory_order_release);
        QString replacementFailure;
        if (!replaceIatPointer(
                helperSlot,
                originalHelper,
                reinterpret_cast<void *>(
                    cavalryExtensionLayerTextAtWidgetCentreReplacement),
                &replacementFailure)) {
            gOriginalTextAtWidgetCentre.store(nullptr, std::memory_order_release);
            status_ = QStringLiteral("unsupported");
            detail_ = replacementFailure;
            terminalFailure_ = true;
            return false;
        }

        textAtWidgetCentreIatSlot_ = helperSlot;
        originalTextAtWidgetCentre_ = originalHelper;
        gActiveHook.store(this, std::memory_order_release);
        textAtWidgetCentreInstalled_ = true;
    }

    if (!placeholderAssignmentInstalled_) {
        void **assignmentSlot = nullptr;
        QString pathFailure;
        const std::uint8_t *setPlaceholderThunk = nullptr;
        if (!validateSetPlaceholderAssignmentPath(
                image,
                moduleInfo.SizeOfImage,
                extensionLayer,
                &assignmentSlot,
                &setPlaceholderThunk,
                &pathFailure)) {
            status_ = QStringLiteral("unsupported");
            detail_ = pathFailure;
            terminalFailure_ = true;
            return false;
        }

        HMODULE qt6Core = GetModuleHandleW(kQt6CoreModuleName);
        if (qt6Core == nullptr || !hasExpectedModuleName(qt6Core, kQt6CoreModuleName)) {
            status_ = QStringLiteral("waiting-for-placeholder-assignment");
            detail_ = QStringLiteral(
                "Qt6Core.dll is not available for CustomListWidget::setPlaceholder yet.");
            return false;
        }

        const FARPROC qStringAssignment =
            GetProcAddress(qt6Core, kQStringAssignmentSymbol);
        if (qStringAssignment == nullptr) {
            status_ = QStringLiteral("unsupported");
            detail_ = QStringLiteral(
                "Qt6Core.dll does not export the expected QString::operator=(QString const&) ABI.");
            terminalFailure_ = true;
            return false;
        }

        void *const originalAssignment = *assignmentSlot;
        if (originalAssignment != reinterpret_cast<void *>(qStringAssignment)) {
            if (isUnresolvedPlaceholderAssignmentSlot(
                    image,
                    moduleInfo.SizeOfImage,
                    originalAssignment)) {
                status_ = QStringLiteral("waiting-for-placeholder-assignment");
                detail_ = QStringLiteral(
                    "CustomListWidget::setPlaceholder QString assignment IAT has not resolved to Qt6Core.dll yet.");
                return false;
            }
            status_ = QStringLiteral("unsupported");
            detail_ = QStringLiteral(
                "ExtensionLayer.dll QString assignment IAT target does not match Qt6Core.dll.");
            terminalFailure_ = true;
            return false;
        }

        gOriginalPlaceholderAssignment.store(
            reinterpret_cast<QStringAssignmentFunction>(originalAssignment),
            std::memory_order_release);
        QString replacementFailure;
        if (!replaceIatPointer(
                assignmentSlot,
                originalAssignment,
                reinterpret_cast<void *>(
                    cavalryExtensionLayerQStringAssignmentReplacement),
                &replacementFailure)) {
            gOriginalPlaceholderAssignment.store(nullptr, std::memory_order_release);
            status_ = QStringLiteral("unsupported");
            detail_ = replacementFailure;
            terminalFailure_ = true;
            return false;
        }

        placeholderAssignmentIatSlot_ = assignmentSlot;
        originalPlaceholderAssignment_ = originalAssignment;
        setPlaceholderThunk_ = setPlaceholderThunk;
        extensionLayerImage_ = image;
        extensionLayerImageSize_ = moduleInfo.SizeOfImage;
        placeholderAssignmentInstalled_ = true;
    }

    status_ = QStringLiteral("installed");
    detail_ = QStringLiteral(
        "Patched ExtensionLayer.dll ui::textAtWidgetCentre and verified CustomListWidget::setPlaceholder IAT paths.");
    return true;
}

bool CavalryExtensionLayerHook::isWaitingForModule() const
{
    return status_ == QStringLiteral("waiting-for-extension-layer")
        || status_ == QStringLiteral("waiting-for-placeholder-assignment");
}

QString CavalryExtensionLayerHook::status() const
{
    return status_;
}

QString CavalryExtensionLayerHook::detail() const
{
    return detail_;
}

void CavalryExtensionLayerHook::forwardTextAtWidgetCentre(
    QWidget *widget,
    const QString &source,
    const QColor &color,
    const QPixmap *icon)
{
    const TextAtWidgetCentreFunction original =
        gOriginalTextAtWidgetCentre.load(std::memory_order_acquire);
    if (original == nullptr) {
        return;
    }

    const QString translated = translationForWhitelistedSource(translator_, source);
    original(
        widget,
        translated.isEmpty() || translated == source ? source : translated,
        color,
        icon);
}

QString &CavalryExtensionLayerHook::forwardPlaceholderAssignment(
    QString *destination,
    const QString &source,
    const void *returnAddress)
{
    const QStringAssignmentFunction original =
        gOriginalPlaceholderAssignment.load(std::memory_order_acquire);
    if (original == nullptr) {
        return *destination;
    }
    if (!isDirectSetPlaceholderCaller(returnAddress)) {
        return original(destination, source);
    }

    const QString translated = translationForPlaceholderSource(translator_, source);
    return original(
        destination,
        translated.isEmpty() || translated == source ? source : translated);
}

QString CavalryExtensionLayerHook::translationForWhitelistedSource(
    const CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    if (!isExactStaticSource(
            source,
            cavalry_i18n::extension_layer_contract::kStaticHelperSources)) {
        return QString();
    }

    const QByteArray utf8 = source.toUtf8();
    return translator.translate(nullptr, utf8.constData());
}

QString CavalryExtensionLayerHook::translationForPlaceholderSource(
    const CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    if (!isExactStaticSource(
            source,
            cavalry_i18n::extension_layer_contract::kStaticPlaceholderSources)) {
        return QString();
    }

    const QByteArray utf8 = source.toUtf8();
    return translator.translate(nullptr, utf8.constData());
}

bool CavalryExtensionLayerHook::isDirectSetPlaceholderCaller(
    const void *returnAddress) const
{
    if (returnAddress == nullptr || setPlaceholderThunk_ == nullptr
        || extensionLayerImage_ == nullptr || extensionLayerImageSize_ < 5) {
        return false;
    }

    const auto *returnPointer =
        static_cast<const std::uint8_t *>(returnAddress);
    if (!moduleContainsRange(
            static_cast<const std::uint8_t *>(extensionLayerImage_),
            extensionLayerImageSize_,
            returnPointer,
            1)) {
        return false;
    }

    const std::uintptr_t returnValue =
        reinterpret_cast<std::uintptr_t>(returnPointer);
    const std::uintptr_t moduleBase =
        reinterpret_cast<std::uintptr_t>(extensionLayerImage_);
    if (returnValue < moduleBase + 5) {
        return false;
    }
    const auto *call =
        reinterpret_cast<const std::uint8_t *>(returnValue - 5);
    if (!moduleContainsRange(
            static_cast<const std::uint8_t *>(extensionLayerImage_),
            extensionLayerImageSize_,
            call,
            5)
        || call[0] != 0xE8) {
        return false;
    }

    std::int32_t displacement = 0;
    std::memcpy(&displacement, call + 1, sizeof(displacement));
    const std::intptr_t target =
        static_cast<std::intptr_t>(reinterpret_cast<std::uintptr_t>(call + 5))
        + displacement;
    return reinterpret_cast<const void *>(target) == setPlaceholderThunk_;
}

void CavalryExtensionLayerHook::uninstall()
{
    CavalryExtensionLayerHook *expected = this;
    gActiveHook.compare_exchange_strong(
        expected,
        nullptr,
        std::memory_order_acq_rel);

    QString ignoredFailure;
    if (placeholderAssignmentInstalled_
        && placeholderAssignmentIatSlot_ != nullptr
        && originalPlaceholderAssignment_ != nullptr) {
        replaceIatPointer(
            placeholderAssignmentIatSlot_,
            reinterpret_cast<void *>(
                cavalryExtensionLayerQStringAssignmentReplacement),
            originalPlaceholderAssignment_,
            &ignoredFailure);
    }
    if (textAtWidgetCentreInstalled_
        && textAtWidgetCentreIatSlot_ != nullptr
        && originalTextAtWidgetCentre_ != nullptr) {
        replaceIatPointer(
            textAtWidgetCentreIatSlot_,
            reinterpret_cast<void *>(
                cavalryExtensionLayerTextAtWidgetCentreReplacement),
            originalTextAtWidgetCentre_,
            &ignoredFailure);
    }

    placeholderAssignmentIatSlot_ = nullptr;
    originalPlaceholderAssignment_ = nullptr;
    setPlaceholderThunk_ = nullptr;
    extensionLayerImage_ = nullptr;
    extensionLayerImageSize_ = 0;
    textAtWidgetCentreIatSlot_ = nullptr;
    originalTextAtWidgetCentre_ = nullptr;
    placeholderAssignmentInstalled_ = false;
    textAtWidgetCentreInstalled_ = false;
}
