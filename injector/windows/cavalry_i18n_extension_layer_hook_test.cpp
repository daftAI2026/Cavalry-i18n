/**
 * [INPUT]: 依赖 aggregate 生产源码顺序、四条文本合同、process-lifetime snapshot、运行时 PE 身份值门、逐槽决策与本进程 Windows 指针页
 * [OUTPUT]: 对外验证插件 PIN、三语投影、身份门、forward-only 墓碑、原子位图、mixed restore、MessageBar 生命周期与真实 IAT CAS
 * [POS]: injector/windows 的 hook 行为/生命周期合同测试；源码门锚定真实 ensureInstalled 路径，不加载厂商 DLL，关键机器码由独立 vendor fixture 另行锁定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_callback_snapshot.h"
#include "cavalry_i18n_extension_layer_hook.h"
#include "cavalry_i18n_extension_layer_qt_hooks.h"
#include "cavalry_i18n_extension_layer_sources.h"
#include "cavalry_i18n_extension_layer_text_path_hook.h"
#include "cavalry_i18n_iat_lifecycle.h"
#include "cavalry_i18n_iat_patch.h"
#include "cavalry_i18n_skia_runtime_abi.h"
#include "cavalry_i18n_translator.h"
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <QtCore/QByteArray>
#include <QtCore/QCoreApplication>
#include <QtCore/QDebug>
#include <QtCore/QString>
#include <array>
#include <atomic>
#include <memory>
#include <string>
#include <utility>

class QColor;
class QPixmap;
class QWidget;

bool verifyAggregatePluginPinContract();
bool verifyCavalryMessageBarAggregateLifecycle();

namespace {
void dummyHelper(
    QWidget *,
    const QString &,
    const QColor &,
    const QPixmap *)
{
}
void dummyThirdPartyHelper(
    QWidget *,
    const QString &,
    const QColor &,
    const QPixmap *)
{
}
QString &dummyPlaceholderAssignment(
    QString *destination,
    const QString &source)
{
    return *destination = source;
}
QString &dummyThirdPartyPlaceholderAssignment(
    QString *destination,
    const QString &source)
{
    return *destination = source;
}
void *__fastcall dummyTextPath(
    void *pathStorage,
    const std::string &,
    double)
{
    return pathStorage;
}
using TextPathTranslationExpectations = std::array<
    const char *,
    cavalry_i18n::extension_layer_contract::kStaticTextPathSources.size()>;

constexpr TextPathTranslationExpectations kZhHansTextPathTranslations {{
    "视口质量：高",
    "视口质量：低",
    "视口质量：最低",
    "视口质量：平衡",
    "禁用吸附",
    "启用贝塞尔角度吸附",
    "拆分路径（角点）",
    "拆分路径（贝塞尔）",
    "切换变换工具",
    "删除贝塞尔控制柄",
    "启用抓取",
    "平移",
    "播放/停止",
    "直接选择图层",
    "插入关键帧",
    "清除路径",
    "新建形状",
    "创建为遮罩",
    "新建形状",
    "新建轮廓",
    "从中心创建",
    "锁定纵横比",
    "S + 单击路径",
    "按住 S",
    "Space + 单击 + 拖动",
    "S + 双击",
    "S + 单击",
    "X + 单击",
}};

constexpr TextPathTranslationExpectations kZhHantTextPathTranslations {{
    "檢視區品質：高",
    "檢視區品質：低",
    "檢視區品質：最低",
    "檢視區品質：平衡",
    "停用吸附",
    "啟用貝茲角度吸附",
    "分割路徑（角點）",
    "分割路徑（貝茲）",
    "切換變換工具",
    "刪除貝茲控制柄",
    "啓用抓取",
    "移動檢視",
    "播放/停止",
    "項目圖層選取",
    "插入關鍵幀",
    "清除路徑",
    "新增形狀",
    "建立為遮罩",
    "新增形狀",
    "新增輪廓",
    "從中心建立",
    "鎖定長寬比",
    "S + 按一下路徑",
    "按住 S",
    "Space + 按一下 + 拖曳",
    "S + 連按兩下",
    "S + 按一下",
    "X + 按一下",
}};

constexpr TextPathTranslationExpectations kJaTextPathTranslations {{
    "ビューポート品質：高",
    "ビューポート品質：低",
    "ビューポート品質：最低",
    "ビューポート品質：バランス",
    "スナップを無効にする",
    "ベジェ角度スナップを有効にする",
    "パスを分割（コーナー）",
    "パスを分割（ベジェ）",
    "トランスフォームツールを切り替え",
    "ベジェハンドルを削除",
    "スナップを有効にする",
    "パン",
    "再生/停止",
    "レイヤーを直接選択",
    "キーフレームを挿入",
    "パスをクリア",
    "新規シェイプ",
    "マスクとして作成",
    "新規シェイプを開始",
    "新しい輪郭を開始",
    "センターから作成",
    "縦横比を固定",
    "S + パスをクリック",
    "S キーを押したままにする",
    "Space + クリック + ドラッグ",
    "S + ダブルクリック",
    "S + クリック",
    "X + クリック",
}};

bool expectEqual(
    const QString &scenario,
    const QString &actual,
    const QString &expected)
{
    if (actual == expected) {
        return true;
    }
    qCritical().noquote()
        << QStringLiteral("%1: expected '%2', got '%3'.")
               .arg(scenario, expected, actual);
    return false;
}
bool expectEmpty(
    const QString &scenario,
    const CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    return expectEqual(
        scenario,
        CavalryExtensionLayerHook::translationForWhitelistedSource(
            translator,
            source),
        QString());
}
bool expectPlaceholderEmpty(
    const QString &scenario,
    const CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    return expectEqual(
        scenario,
        CavalryExtensionLayerHook::translationForPlaceholderSource(
            translator,
            source),
        QString());
}
bool expectTextPathEmpty(
    const QString &scenario,
    const CavalryEmbeddedTranslator &translator,
    const std::string &source)
{
    const std::string actual =
        CavalryExtensionLayerTextPathHook::translationForWhitelistedSource(
            translator,
            source);
    if (actual.empty()) {
        return true;
    }
    qCritical().noquote()
        << QStringLiteral("%1: expected an empty text-path translation, got '%2'.")
               .arg(scenario, QString::fromUtf8(actual));
    return false;
}
bool verifyLanguage(
    const QString &language,
    const TextPathTranslationExpectations &expectedTextPathTranslations)
{
    CavalryEmbeddedTranslator translator(language);
    for (const char *sourceText
         : cavalry_i18n::extension_layer_contract::kStaticHelperSources) {
        const QString source = QString::fromLatin1(sourceText);
        const QByteArray sourceUtf8 = source.toUtf8();
        const QString expected = translator.translate(nullptr, sourceUtf8.constData());
        if (expected.isEmpty() || expected == source) {
            qCritical().noquote()
                << QStringLiteral("%1 lacks an embedded translation for '%2'.")
                       .arg(language, source);
            return false;
        }
        if (!expectEqual(
                language + QStringLiteral(": ") + source,
                CavalryExtensionLayerHook::translationForWhitelistedSource(
                    translator,
                    source),
                expected)) {
            return false;
        }
    }
    if (!expectEmpty(
            language + QStringLiteral(": Snippet remains outside helper coverage"),
            translator,
            QStringLiteral("Drag some JavaScript here to make a Snippet."))
        || !expectEmpty(
            language + QStringLiteral(": unknown dynamic HelperHints is rejected"),
            translator,
            QStringLiteral("A runtime HelperHints value"))) {
        return false;
    }
    for (const char *sourceText
         : cavalry_i18n::extension_layer_contract::kStaticPlaceholderSources) {
        const QString source = QString::fromLatin1(sourceText);
        const QByteArray sourceUtf8 = source.toUtf8();
        const QString expected = translator.translate(nullptr, sourceUtf8.constData());
        if (expected.isEmpty() || expected == source) {
            qCritical().noquote()
                << QStringLiteral("%1 lacks an embedded placeholder translation for '%2'.")
                       .arg(language, source);
            return false;
        }
        if (!expectEqual(
                language + QStringLiteral(": placeholder: ") + source,
                CavalryExtensionLayerHook::translationForPlaceholderSource(
                    translator,
                    source),
                expected)) {
            return false;
        }
    }
    const QString generatedButUnapprovedSource =
        QStringLiteral("Drag layers here to see their settings.");
    const QByteArray generatedButUnapprovedUtf8 =
        generatedButUnapprovedSource.toUtf8();
    if (translator.translate(nullptr, generatedButUnapprovedUtf8.constData()).isEmpty()) {
        qCritical().noquote()
            << QStringLiteral("%1 fixture lacks a generated non-placeholder source.")
                   .arg(language);
        return false;
    }
    if (!expectPlaceholderEmpty(
            language + QStringLiteral(": generated non-placeholder source is rejected"),
            translator,
            generatedButUnapprovedSource)
        || !expectPlaceholderEmpty(
            language + QStringLiteral(": unknown placeholder source is rejected"),
            translator,
            QStringLiteral("A runtime placeholder value"))) {
        return false;
    }
    for (std::size_t index = 0;
         index
         < cavalry_i18n::extension_layer_contract::kStaticTextPathSources.size();
         ++index) {
        const char *sourceText =
            cavalry_i18n::extension_layer_contract::kStaticTextPathSources[index];
        const std::string source(sourceText);
        const std::string expected(expectedTextPathTranslations[index]);
        const QString embedded =
            translator.translate(nullptr, source.c_str());
        const std::string actual =
            CavalryExtensionLayerTextPathHook::translationForWhitelistedSource(
                translator,
                source);
        if (embedded != QString::fromUtf8(expected)
            || actual != expected) {
            qCritical().noquote()
                << QStringLiteral(
                       "%1 has the wrong exact text-path translation for '%2': '%3'.")
                       .arg(
                           language,
                           QString::fromUtf8(source),
                           QString::fromUtf8(actual));
            return false;
        }
    }
    const auto verifyShortcutPrefixes =
        [&language, &translator](const auto &pairs, const QString &tool) {
        for (const auto &pair : pairs) {
            const std::string prefix(pair.prefix);
            if (CavalryExtensionLayerTextPathHook::isWhitelistedSource(prefix)
                || !expectTextPathEmpty(
                    language + QStringLiteral(": ") + tool
                        + QStringLiteral(" shortcut prefix remains English"),
                    translator,
                    prefix)) {
                return false;
            }
        }
        return true;
    };
    using namespace cavalry_i18n::extension_layer_contract;
    constexpr std::array<const char *, 3> kEditShapePureShortcutPrefixes {{
        "Control",
        "Shift",
        "H",
    }};
    for (const char *prefix : kEditShapePureShortcutPrefixes) {
        if (CavalryExtensionLayerTextPathHook::isWhitelistedSource(prefix)
            || !expectTextPathEmpty(
                language
                    + QStringLiteral(
                        ": EditShapeTool pure shortcut prefix remains English"),
                translator,
                prefix)) {
            return false;
        }
    }
    constexpr std::array<const char *, 2> kTransformPureShortcutPrefixes {{
        "Shift",
        "Space",
    }};
    for (const char *prefix : kTransformPureShortcutPrefixes) {
        if (CavalryExtensionLayerTextPathHook::isWhitelistedSource(prefix)
            || !expectTextPathEmpty(
                language
                    + QStringLiteral(
                        ": TransformTool pure shortcut prefix remains English"),
                translator,
                prefix)) {
            return false;
        }
    }
    if (!verifyShortcutPrefixes(
            kPencilToolHelpPairs,
            QStringLiteral("PencilTool"))
        || !verifyShortcutPrefixes(
            kPenToolHelpPairs,
            QStringLiteral("PenTool"))
        || !verifyShortcutPrefixes(
            kCentreToolHelpPairs,
            QStringLiteral("CentreTool"))) {
        return false;
    }
    if (!expectTextPathEmpty(
            language + QStringLiteral(": dynamic text path is rejected"),
            translator,
            "A runtime canvas label")
        || !expectTextPathEmpty(
            language + QStringLiteral(": near-match text path is rejected"),
            translator,
            "Viewport Quality: High.")) {
        return false;
    }
    CavalryExtensionLayerHook hook(translator);
    if (hook.ensureInstalled() || !hook.isWaitingForModule()) {
        qCritical().noquote()
            << QStringLiteral("%1: hook did not defer missing ExtensionLayer.dll.")
                   .arg(language);
        return false;
    }
    return true;
}
DWORD pageProtection(const void *address)
{
    MEMORY_BASIC_INFORMATION information {};
    if (VirtualQuery(
            address,
            &information,
            sizeof(information))
        != sizeof(information)) {
        return 0;
    }
    return information.Protect;
}
bool verifySnapshotRetention()
{
    using Snapshot =
        cavalry_i18n::ExactTranslationSnapshot<QString, 1>;
    std::array<Snapshot::Entry, 1> entries {{
        { QStringLiteral("source"), QStringLiteral("translation") },
    }};
    std::shared_ptr<const Snapshot> publication =
        std::make_shared<const Snapshot>(std::move(entries));
    const std::shared_ptr<const Snapshot> retained =
        std::atomic_load_explicit(
            &publication,
            std::memory_order_acquire);
    std::atomic_store_explicit(
        &publication,
        std::shared_ptr<const Snapshot> {},
        std::memory_order_release);
    const QString *translated =
        retained == nullptr
        ? nullptr
        : retained->find(QStringLiteral("source"));
    if (publication != nullptr || translated == nullptr
        || *translated != QStringLiteral("translation")) {
        qCritical()
            << "Immutable callback snapshot did not outlive publication reset.";
        return false;
    }
    return true;
}
bool verifySkiaRuntimeIdentityAndTextPathDiagnostics()
{
    if (!matchesCavalrySkiaRuntimeIdentityForTesting(
            true,
            IMAGE_FILE_MACHINE_AMD64,
            IMAGE_NT_OPTIONAL_HDR64_MAGIC,
            0x6A0300B4,
            0x01A13000)
        || !matchesCavalrySkiaRuntimeIdentityForTesting(
            false,
            IMAGE_FILE_MACHINE_AMD64,
            IMAGE_NT_OPTIONAL_HDR64_MAGIC,
            0x69495BF5,
            0x00852000)
        || matchesCavalrySkiaRuntimeIdentityForTesting(
            true,
            IMAGE_FILE_MACHINE_I386,
            IMAGE_NT_OPTIONAL_HDR64_MAGIC,
            0x6A0300B4,
            0x01A13000)
        || matchesCavalrySkiaRuntimeIdentityForTesting(
            true,
            IMAGE_FILE_MACHINE_AMD64,
            IMAGE_NT_OPTIONAL_HDR32_MAGIC,
            0x6A0300B4,
            0x01A13000)
        || matchesCavalrySkiaRuntimeIdentityForTesting(
            true,
            IMAGE_FILE_MACHINE_AMD64,
            IMAGE_NT_OPTIONAL_HDR64_MAGIC,
            0x6A0300B5,
            0x01A13000)
        || matchesCavalrySkiaRuntimeIdentityForTesting(
            true,
            IMAGE_FILE_MACHINE_AMD64,
            IMAGE_NT_OPTIONAL_HDR64_MAGIC,
            0x6A0300B4,
            0x01A12000)) {
        qCritical()
            << "Runtime Core/skia PE identity positive/negative gate failed.";
        return false;
    }
    if (!CavalryExtensionLayerTextPathHook::
            verifyForwardOnlyTombstoneForTesting(
                reinterpret_cast<void *>(dummyTextPath))) {
        qCritical()
            << "Text-path process-lifetime slot did not retain a renderer-free forward-only tombstone.";
        return false;
    }
    const CavalryTextPathHookDiagnostics diagnostics =
        CavalryExtensionLayerTextPathHook::
            exerciseDiagnosticCountersForTesting();
    if (diagnostics.revision != 12
        || diagnostics.canonicalCalls != 3
        || diagnostics.whitelistCalls != 2
        || diagnostics.cjkPathSuccess != 1
        || diagnostics.originalFallback != 2
        || diagnostics.noTranslation != 1
        || diagnostics.rendererFailure != 1
        || diagnostics.translatedSourceMask != 0x0001
        || diagnostics.fallbackSourceMask != 0x10000000) {
        qCritical()
            << "Text-path callback diagnostics/mask contract failed.";
        return false;
    }
    return true;
}
bool verifyIatPairLifecycleMatrix()
{
    constexpr std::array<bool, 2> values {{ false, true }};
    for (const bool owner : values) {
        for (const bool firstInstalled : values) {
            for (const bool secondInstalled : values) {
                for (const bool firstRestoreSucceeded : values) {
                    for (const bool secondRestoreSucceeded : values) {
                        const auto decision =
                            cavalry_i18n::decideIatPairUninstall(
                                owner,
                                firstInstalled,
                                secondInstalled,
                                firstRestoreSucceeded,
                                secondRestoreSucceeded);
                        const bool expectedFirstRestore =
                            owner && firstInstalled;
                        const bool expectedSecondRestore =
                            owner && secondInstalled;
                        const bool expectedFirstClear =
                            expectedFirstRestore
                            && firstRestoreSucceeded;
                        const bool expectedSecondClear =
                            expectedSecondRestore
                            && secondRestoreSucceeded;
                        if (decision.restoreFirst
                                != expectedFirstRestore
                            || decision.restoreSecond
                                != expectedSecondRestore
                            || decision.clearFirstOriginal
                                != expectedFirstClear
                            || decision.clearSecondOriginal
                                != expectedSecondClear) {
                            qCritical()
                                << "Two-slot owner/partial/mixed restore matrix mismatch."
                                << owner
                                << firstInstalled
                                << secondInstalled
                                << firstRestoreSucceeded
                                << secondRestoreSucceeded;
                            return false;
                        }
                    }
                }
            }
        }
    }
    return true;
}
bool verifyRealIatCas()
{
    SYSTEM_INFO systemInfo {};
    GetSystemInfo(&systemInfo);
    const std::size_t pageSize = systemInfo.dwPageSize;
    void *const page = VirtualAlloc(
        nullptr,
        pageSize,
        MEM_RESERVE | MEM_COMMIT,
        PAGE_READWRITE);
    if (page == nullptr) {
        qCritical() << "VirtualAlloc failed for the real IAT CAS test.";
        return false;
    }
    auto **slot = static_cast<void **>(page);
    void *const original =
        reinterpret_cast<void *>(dummyHelper);
    void *const replacement =
        reinterpret_cast<void *>(dummyThirdPartyHelper);
    void *const wrongExpected =
        reinterpret_cast<void *>(dummyPlaceholderAssignment);
    *slot = original;
    DWORD previousProtection = 0;
    bool ok = VirtualProtect(
        page,
        pageSize,
        PAGE_READONLY,
        &previousProtection)
        != FALSE;
    QString failure;
    if (ok
        && replaceCavalryIatPointer(
            slot,
            wrongExpected,
            replacement,
            &failure)) {
        qCritical() << "IAT CAS accepted an expected mismatch.";
        ok = false;
    }
    if (ok && (*slot != original
        || pageProtection(page) != PAGE_READONLY
        || !failure.contains(QStringLiteral("changed")))) {
        qCritical().noquote()
            << QStringLiteral(
                   "IAT expected-mismatch did not preserve slot/protection: %1")
                   .arg(failure);
        ok = false;
    }
    failure.clear();
    if (ok
        && !replaceCavalryIatPointer(
            slot,
            original,
            replacement,
            &failure)) {
        qCritical().noquote()
            << QStringLiteral("IAT CAS install failed: %1").arg(failure);
        ok = false;
    }
    if (ok && (*slot != replacement
        || pageProtection(page) != PAGE_READONLY)) {
        qCritical() << "IAT CAS install changed slot/protection incorrectly.";
        ok = false;
    }
    failure.clear();
    if (ok
        && !replaceCavalryIatPointer(
            slot,
            replacement,
            original,
            &failure)) {
        qCritical().noquote()
            << QStringLiteral("IAT CAS restore failed: %1").arg(failure);
        ok = false;
    }
    if (ok && (*slot != original
        || pageProtection(page) != PAGE_READONLY)) {
        qCritical() << "IAT CAS restore changed slot/protection incorrectly.";
        ok = false;
    }
    VirtualFree(page, 0, MEM_RELEASE);
    return ok;
}
bool verifyAggregateRollbackCase(
    const QString &scenario,
    bool helperInstalled,
    bool placeholderInstalled,
    bool corruptHelper,
    bool corruptPlaceholder)
{
    clearCavalryHelperOriginal();
    clearCavalryPlaceholderOriginal();
    SYSTEM_INFO systemInfo {};
    GetSystemInfo(&systemInfo);
    const std::size_t pageSize = systemInfo.dwPageSize;
    void *const page = VirtualAlloc(
        nullptr,
        pageSize,
        MEM_RESERVE | MEM_COMMIT,
        PAGE_READWRITE);
    if (page == nullptr) {
        qCritical().noquote()
            << scenario + QStringLiteral(": VirtualAlloc failed.");
        return false;
    }
    auto **slots = static_cast<void **>(page);
    void **const helperSlot = &slots[0];
    void **const placeholderSlot = &slots[1];
    void *const helperOriginal =
        reinterpret_cast<void *>(dummyHelper);
    void *const placeholderOriginal =
        reinterpret_cast<void *>(dummyPlaceholderAssignment);
    void *const helperThirdParty =
        reinterpret_cast<void *>(dummyThirdPartyHelper);
    void *const placeholderThirdParty =
        reinterpret_cast<void *>(dummyThirdPartyPlaceholderAssignment);
    *helperSlot = helperInstalled
        ? cavalryHelperReplacementAddress()
        : helperOriginal;
    *placeholderSlot = placeholderInstalled
        ? cavalryPlaceholderReplacementAddress()
        : placeholderOriginal;
    if (corruptHelper) {
        *helperSlot = helperThirdParty;
    }
    if (corruptPlaceholder) {
        *placeholderSlot = placeholderThirdParty;
    }
    CavalryEmbeddedTranslator translator(QStringLiteral("zh-Hans"));
    QString publishFailure;
    bool ok =
        (!helperInstalled
            || publishCavalryHelperCallbackSnapshot(
                translator,
                helperOriginal,
                &publishFailure))
        && (!placeholderInstalled
            || publishCavalryPlaceholderCallbackSnapshot(
                translator,
                placeholderOriginal,
                static_cast<const std::uint8_t *>(page),
                pageSize,
                static_cast<const std::uint8_t *>(page),
                &publishFailure));
    if (!ok) {
        qCritical().noquote()
            << QStringLiteral("%1: snapshot publication failed: %2")
                   .arg(scenario, publishFailure);
    }
    DWORD previousProtection = 0;
    if (ok && !VirtualProtect(
            page,
            pageSize,
            PAGE_READONLY,
            &previousProtection)) {
        qCritical().noquote()
            << scenario + QStringLiteral(": VirtualProtect failed.");
        ok = false;
    }
    {
        CavalryExtensionLayerHook hook(translator);
        if (ok && !hook.configurePartialInstallForTesting(
                helperSlot,
                helperOriginal,
                helperInstalled,
                placeholderSlot,
                placeholderOriginal,
                placeholderInstalled)) {
            qCritical().noquote()
                << scenario
                    + QStringLiteral(": could not claim aggregate ownership.");
            ok = false;
        }
        if (ok && hook.triggerTerminalFailureForTesting(
                scenario + QStringLiteral(" terminal"))) {
            qCritical().noquote()
                << scenario
                    + QStringLiteral(": terminal path returned success.");
            ok = false;
        }
        const bool restoreFailed =
            (helperInstalled && corruptHelper)
            || (placeholderInstalled && corruptPlaceholder);
        const QString expectedStatus = restoreFailed
            ? QStringLiteral("restore-failed")
            : QStringLiteral("unsupported");
        if (ok && (hook.status() != expectedStatus
            || !hook.detail().contains(
                scenario + QStringLiteral(" terminal")))) {
            qCritical().noquote()
                << QStringLiteral("%1: wrong terminal status/detail: %2 / %3")
                       .arg(scenario, hook.status(), hook.detail());
            ok = false;
        }
        const void *expectedHelper =
            helperInstalled && corruptHelper
            ? helperThirdParty
            : helperOriginal;
        const void *expectedPlaceholder =
            placeholderInstalled && corruptPlaceholder
            ? placeholderThirdParty
            : placeholderOriginal;
        if (ok && (*helperSlot != expectedHelper
            || *placeholderSlot != expectedPlaceholder
            || pageProtection(page) != PAGE_READONLY)) {
            qCritical().noquote()
                << scenario
                    + QStringLiteral(
                        ": terminal rollback corrupted slot/protection.");
            ok = false;
        }
        const bool expectedHelperOriginal =
            helperInstalled && corruptHelper;
        const bool expectedPlaceholderOriginal =
            placeholderInstalled && corruptPlaceholder;
        if (ok && (isCavalryHelperOriginalPublished()
                != expectedHelperOriginal
            || isCavalryPlaceholderOriginalPublished()
                != expectedPlaceholderOriginal)) {
            qCritical().noquote()
                << scenario
                    + QStringLiteral(
                        ": per-slot global original cleanup was not independent.");
            ok = false;
        }
    }
    clearCavalryHelperOriginal();
    clearCavalryPlaceholderOriginal();
    VirtualFree(page, 0, MEM_RELEASE);
    return ok;
}
bool verifyAggregateTerminalRollback()
{
    if (!verifyAggregateRollbackCase(
            QStringLiteral("both restore"),
            true,
            true,
            false,
            false)
        || !verifyAggregateRollbackCase(
            QStringLiteral("helper restore fails"),
            true,
            true,
            true,
            false)
        || !verifyAggregateRollbackCase(
            QStringLiteral("placeholder restore fails"),
            true,
            true,
            false,
            true)
        || !verifyAggregateRollbackCase(
            QStringLiteral("helper partial install"),
            true,
            false,
            false,
            false)
        || !verifyAggregateRollbackCase(
            QStringLiteral("placeholder partial install"),
            false,
            true,
            false,
            false)) {
        return false;
    }
    CavalryEmbeddedTranslator translator(QStringLiteral("zh-Hans"));
    CavalryExtensionLayerHook owner(translator);
    CavalryExtensionLayerHook nonOwner(translator);
    if (!owner.configurePartialInstallForTesting(
            nullptr,
            nullptr,
            false,
            nullptr,
            nullptr,
            false)
        || nonOwner.configurePartialInstallForTesting(
            nullptr,
            nullptr,
            false,
            nullptr,
            nullptr,
            false)) {
        qCritical()
            << "Aggregate owner/non-owner serialization contract failed.";
        return false;
    }
    owner.triggerTerminalFailureForTesting(
        QStringLiteral("release test owner"));
    return true;
}
} // namespace

int main(int argc, char *argv[])
{
    QCoreApplication application(argc, argv);
    return verifyAggregatePluginPinContract()
            && verifyCavalryMessageBarAggregateLifecycle()
            && verifySnapshotRetention()
            && verifySkiaRuntimeIdentityAndTextPathDiagnostics()
            && verifyIatPairLifecycleMatrix()
            && verifyRealIatCas()
            && verifyAggregateTerminalRollback()
            && verifyLanguage(
                QStringLiteral("zh-Hans"),
                kZhHansTextPathTranslations)
            && verifyLanguage(
                QStringLiteral("zh-Hant"),
                kZhHantTextPathTranslations)
            && verifyLanguage(
                QStringLiteral("ja_JP"),
                kJaTextPathTranslations)
        ? 0
        : 1;
}
