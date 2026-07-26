/**
 * [INPUT]: 依赖 ExtensionLayer 唯一 Core::MakePathFromText IAT 槽、canonical caller、十五项 source、运行时 ABI 防火墙与嵌入 translator
 * [OUTPUT]: 对外实现 exact slot/caller/source 三重门、CJK Path 或英语回退、process-lifetime 发布槽、forward-only 墓碑及无 IO 原子诊断
 * [POS]: injector/windows 的 text-path 局部适配器；私有 ABI 未验证或 renderer 创建失败时终态拒装，卸载不让 SkTypeface 留到 loader-lock
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_text_path_hook.h"

#include "cavalry_i18n_callback_snapshot.h"
#include "cavalry_i18n_extension_layer_sources.h"
#include "cavalry_i18n_iat_patch.h"
#include "cavalry_i18n_pe_iat.h"
#include "cavalry_i18n_skia_runtime_abi.h"
#include "cavalry_i18n_skia_text_path_renderer.h"
#include "cavalry_i18n_translator.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <intrin.h>

#include <QtCore/QByteArray>

#include <array>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#pragma intrinsic(_ReturnAddress)

using MakePathFromTextFunction =
    void *(__fastcall *)(void *, const std::string &, double);
using CavalryTextPathTranslations =
    cavalry_i18n::ExactTranslationSnapshot<
        std::string,
        cavalry_i18n::extension_layer_contract::
            kStaticTextPathSources.size()>;

class CavalryTextPathDiagnosticState final
{
public:
    std::atomic<std::uint64_t> revision { 0 };
    std::atomic<std::uint64_t> canonicalCalls { 0 };
    std::atomic<std::uint64_t> whitelistCalls { 0 };
    std::atomic<std::uint64_t> cjkPathSuccess { 0 };
    std::atomic<std::uint64_t> originalFallback { 0 };
    std::atomic<std::uint64_t> noTranslation { 0 };
    std::atomic<std::uint64_t> rendererFailure { 0 };
    std::atomic<std::uint16_t> translatedSourceMask { 0 };
    std::atomic<std::uint16_t> fallbackSourceMask { 0 };

    CavalryTextPathHookDiagnostics snapshot() const
    {
        CavalryTextPathHookDiagnostics value;
        value.revision = revision.load(std::memory_order_acquire);
        value.canonicalCalls =
            canonicalCalls.load(std::memory_order_relaxed);
        value.whitelistCalls =
            whitelistCalls.load(std::memory_order_relaxed);
        value.cjkPathSuccess =
            cjkPathSuccess.load(std::memory_order_relaxed);
        value.originalFallback =
            originalFallback.load(std::memory_order_relaxed);
        value.noTranslation =
            noTranslation.load(std::memory_order_relaxed);
        value.rendererFailure =
            rendererFailure.load(std::memory_order_relaxed);
        value.translatedSourceMask =
            translatedSourceMask.load(std::memory_order_relaxed);
        value.fallbackSourceMask =
            fallbackSourceMask.load(std::memory_order_relaxed);
        return value;
    }
};

class CavalryTextPathCallbackState final
{
public:
    MakePathFromTextFunction original = nullptr;
    std::shared_ptr<const CavalryTextPathTranslations> translations;
    std::shared_ptr<const CavalrySkiaTextPathRenderer> cjkRenderer;
    std::shared_ptr<CavalryTextPathDiagnosticState> diagnostics;
    std::shared_ptr<std::atomic<bool>> translationGate;
    const std::uint8_t *extensionLayerImage = nullptr;
    std::size_t extensionLayerImageSize = 0;
    void **iatSlot = nullptr;

    bool isForwardOnly() const
    {
        return original != nullptr && translations == nullptr
            && cjkRenderer == nullptr
            && translationGate == nullptr
            && extensionLayerImage == nullptr && iatSlot == nullptr;
    }
};

namespace {

constexpr wchar_t kCoreModuleName[] = L"Core.dll";
constexpr wchar_t kSkiaModuleName[] = L"skia.dll";
constexpr char kCoreImportName[] = "Core.dll";
constexpr char kMakePathFromTextSymbol[] =
    "?MakePathFromText@cavalry@@YA?AVPath@1@AEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@N@Z";
constexpr std::size_t kExpectedIatSlotRva = 0x01B28F98;
constexpr std::size_t kCanonicalAbiPreambleRva = 0x002D9170;
constexpr std::size_t kCanonicalCallRva = 0x002D917A;
constexpr std::size_t kCanonicalReturnRva = 0x002D9180;
constexpr std::array<std::uint8_t, 10> kCanonicalAbiPreamble {{
    0x4C, 0x89, 0xF1,
    0x48, 0x89, 0xF2,
    0x66, 0x0F, 0x28, 0xD6,
}};
constexpr std::size_t kSourceCount =
    cavalry_i18n::extension_layer_contract::
        kStaticTextPathSources.size();

static_assert(
    sizeof(std::string) == 0x20,
    "Cavalry 2.7.2 Core::MakePathFromText requires the MSVC x64 release std::string ABI.");
static_assert(kSourceCount == 15);
static_assert(kSourceCount <= 16);

std::shared_ptr<const CavalryTextPathCallbackState> &callbackSlot()
{
    return cavalry_i18n::processLifetimeCallbackSlot<
        CavalryTextPathCallbackState>();
}

std::atomic<const void *> gLifecycleOwner { nullptr };
bool containsRange(
    const std::uint8_t *image,
    std::size_t imageSize,
    const std::uint8_t *address,
    std::size_t size)
{
    if (image == nullptr || address == nullptr || size > imageSize) {
        return false;
    }
    const std::uintptr_t base =
        reinterpret_cast<std::uintptr_t>(image);
    const std::uintptr_t value =
        reinterpret_cast<std::uintptr_t>(address);
    if (value < base) {
        return false;
    }
    const std::size_t offset =
        static_cast<std::size_t>(value - base);
    return offset <= imageSize && size <= imageSize - offset;
}
bool indirectCallTargetsSlot(
    const std::uint8_t *image,
    std::size_t imageSize,
    const std::uint8_t *call,
    const void *slot)
{
    if (!containsRange(image, imageSize, call, 6)
        || call[0] != 0xFF || call[1] != 0x15) {
        return false;
    }
    std::int32_t displacement = 0;
    std::memcpy(&displacement, call + 2, sizeof(displacement));
    const std::intptr_t target =
        static_cast<std::intptr_t>(
            reinterpret_cast<std::uintptr_t>(call + 6))
        + displacement;
    return reinterpret_cast<const void *>(target) == slot;
}
bool isCanonicalCaller(
    const CavalryTextPathCallbackState &state,
    const void *returnAddress)
{
    const auto *expectedReturn =
        state.extensionLayerImage + kCanonicalReturnRva;
    return returnAddress == expectedReturn
        && indirectCallTargetsSlot(
            state.extensionLayerImage,
            state.extensionLayerImageSize,
            expectedReturn - 6,
            state.iatSlot);
}
std::size_t textPathSourceIndex(const std::string &source)
{
    for (std::size_t index = 0; index < kSourceCount; ++index) {
        if (source
            == cavalry_i18n::extension_layer_contract::
                kStaticTextPathSources[index]) {
            return index;
        }
    }
    return kSourceCount;
}
void bump(
    const std::shared_ptr<CavalryTextPathDiagnosticState> &state,
    std::atomic<std::uint64_t> CavalryTextPathDiagnosticState::*counter)
{
    if (state == nullptr) {
        return;
    }
    (state.get()->*counter).fetch_add(1, std::memory_order_relaxed);
    state->revision.fetch_add(1, std::memory_order_release);
}
void setSourceMask(
    const std::shared_ptr<CavalryTextPathDiagnosticState> &state,
    std::atomic<std::uint16_t>
        CavalryTextPathDiagnosticState::*mask,
    std::size_t sourceIndex)
{
    if (state == nullptr || sourceIndex >= kSourceCount) {
        return;
    }
    const auto bit =
        static_cast<std::uint16_t>(1U << sourceIndex);
    (state.get()->*mask).fetch_or(bit, std::memory_order_relaxed);
    state->revision.fetch_add(1, std::memory_order_release);
}
std::shared_ptr<const CavalryTextPathCallbackState> makeTombstone(
    MakePathFromTextFunction original)
{
    if (original == nullptr) {
        return {};
    }
    auto state = std::make_shared<CavalryTextPathCallbackState>();
    state->original = original;
    return state;
}
void publishTombstone(
    const std::shared_ptr<const CavalryTextPathCallbackState> &tombstone)
{
    if (tombstone == nullptr || !tombstone->isForwardOnly()) {
        return;
    }
    std::shared_ptr<const CavalryTextPathCallbackState> previous =
        std::atomic_exchange_explicit(
            &callbackSlot(),
            tombstone,
            std::memory_order_acq_rel);
    // 这里是普通生命周期线程；旧 snapshot 的最后一个普通引用会在此释放。
    previous.reset();
}
std::shared_ptr<const CavalryTextPathCallbackState> makeActiveState(
    const CavalryEmbeddedTranslator &translator,
    MakePathFromTextFunction original,
    const std::uint8_t *image,
    std::size_t imageSize,
    void **slot,
    std::shared_ptr<const CavalrySkiaRuntimeAbi> runtimeAbi,
    std::shared_ptr<CavalryTextPathDiagnosticState> diagnostics,
    std::shared_ptr<std::atomic<bool>> translationGate,
    QString *failureDetail,
    QString *rendererDetail)
{
    try {
        std::array<CavalryTextPathTranslations::Entry, kSourceCount>
            entries {};
        std::vector<std::string> requiredTranslations;
        requiredTranslations.reserve(entries.size());
        for (std::size_t index = 0; index < entries.size(); ++index) {
            const std::string source(
                cavalry_i18n::extension_layer_contract::
                    kStaticTextPathSources[index]);
            const QByteArray translated =
                translator.translate(nullptr, source.c_str()).toUtf8();
            const std::string translation(
                translated.constData(),
                translated.size());
            if (translation.empty() || translation == source) {
                if (failureDetail != nullptr) {
                    *failureDetail = QStringLiteral(
                        "Embedded text-path translation is missing for '%1'.")
                        .arg(QString::fromUtf8(source));
                }
                return {};
            }
            entries[index] = { source, translation };
            requiredTranslations.push_back(translation);
        }

        const auto renderer = CavalrySkiaTextPathRenderer::create(
            translator.language(),
            requiredTranslations,
            std::move(runtimeAbi),
            rendererDetail);
        if (renderer == nullptr) {
            if (failureDetail != nullptr) {
                *failureDetail = QStringLiteral(
                    "CJK text-path renderer creation failed terminally: %1")
                    .arg(
                        rendererDetail == nullptr
                            ? QStringLiteral("no detail")
                            : *rendererDetail);
            }
            return {};
        }

        auto state = std::make_shared<CavalryTextPathCallbackState>();
        state->original = original;
        state->translations =
            std::make_shared<const CavalryTextPathTranslations>(
                std::move(entries));
        state->cjkRenderer = renderer;
        state->diagnostics = std::move(diagnostics);
        state->translationGate = std::move(translationGate);
        state->extensionLayerImage = image;
        state->extensionLayerImageSize = imageSize;
        state->iatSlot = slot;
        return state;
    } catch (...) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "Could not allocate the immutable Core text-path callback snapshot.");
        }
        return {};
    }
}
void *cavalryMakePathFromTextReplacement(
    void *pathStorage,
    const std::string &source,
    double pointSize)
{
    const auto state = std::atomic_load_explicit(
        &callbackSlot(),
        std::memory_order_acquire);
    if (state == nullptr || state->original == nullptr) {
        return pathStorage;
    }

    const MakePathFromTextFunction original = state->original;
    if (state->translationGate == nullptr
        || !state->translationGate->load(std::memory_order_acquire)
        || !isCanonicalCaller(*state, _ReturnAddress())) {
        return original(pathStorage, source, pointSize);
    }

    bump(state->diagnostics,
        &CavalryTextPathDiagnosticState::canonicalCalls);
    const std::size_t sourceIndex = textPathSourceIndex(source);
    const std::string *translated =
        state->translations == nullptr
        ? nullptr
        : state->translations->find(source);
    if (translated == nullptr || sourceIndex >= kSourceCount) {
        bump(state->diagnostics,
            &CavalryTextPathDiagnosticState::noTranslation);
        bump(state->diagnostics,
            &CavalryTextPathDiagnosticState::originalFallback);
        return original(pathStorage, source, pointSize);
    }

    bump(state->diagnostics,
        &CavalryTextPathDiagnosticState::whitelistCalls);
    if (state->cjkRenderer != nullptr
        && state->cjkRenderer->makePath(
            pathStorage,
            *translated,
            pointSize)) {
        bump(state->diagnostics,
            &CavalryTextPathDiagnosticState::cjkPathSuccess);
        setSourceMask(
            state->diagnostics,
            &CavalryTextPathDiagnosticState::translatedSourceMask,
            sourceIndex);
        return pathStorage;
    }

    bump(state->diagnostics,
        &CavalryTextPathDiagnosticState::rendererFailure);
    bump(state->diagnostics,
        &CavalryTextPathDiagnosticState::originalFallback);
    setSourceMask(
        state->diagnostics,
        &CavalryTextPathDiagnosticState::fallbackSourceMask,
        sourceIndex);
    return original(pathStorage, source, pointSize);
}
QString diagnosticsText(const CavalryTextPathHookDiagnostics &value)
{
    return QStringLiteral(
        "text-path diagnostics revision=%1 canonical=%2 whitelist=%3 cjk-success=%4 fallback=%5 no-translation=%6 renderer-failure=%7 translated-mask=0x%8 fallback-mask=0x%9.")
        .arg(QString::number(value.revision))
        .arg(QString::number(value.canonicalCalls))
        .arg(QString::number(value.whitelistCalls))
        .arg(QString::number(value.cjkPathSuccess))
        .arg(QString::number(value.originalFallback))
        .arg(QString::number(value.noTranslation))
        .arg(QString::number(value.rendererFailure))
        .arg(value.translatedSourceMask, 4, 16, QLatin1Char('0'))
        .arg(value.fallbackSourceMask, 4, 16, QLatin1Char('0'));
}

} // namespace

CavalryExtensionLayerTextPathHook::CavalryExtensionLayerTextPathHook(
    CavalryEmbeddedTranslator &translator)
    : translator_(translator)
{
}

CavalryExtensionLayerTextPathHook::~CavalryExtensionLayerTextPathHook()
{
    QString ignoredFailure;
    uninstall(&ignoredFailure);
}

bool CavalryExtensionLayerTextPathHook::ensureInstalled(
    const void *extensionLayerImage,
    std::size_t imageSize)
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    if (installed_) {
        return true;
    }
    if (terminalFailure_) {
        return false;
    }

    const auto *image =
        static_cast<const std::uint8_t *>(extensionLayerImage);
    if (image == nullptr || kCanonicalReturnRva > imageSize
        || imageSize < sizeof(void *)
        || kExpectedIatSlotRva > imageSize - sizeof(void *)) {
        return failTerminalLocked(QStringLiteral(
            "ExtensionLayer.dll is smaller than the canonical Core text-path RVAs."));
    }

    const CavalryPeIatLookupResult lookup = findCavalryPe64IatSlot(
        image,
        imageSize,
        kCoreImportName,
        kMakePathFromTextSymbol);
    if (lookup.status != CavalryPeIatLookupStatus::Found
        || lookup.iatSlotOffset != kExpectedIatSlotRva) {
        return failTerminalLocked(
            QStringLiteral(
                "ExtensionLayer.dll Core::MakePathFromText IAT contract rejected: %1 at RVA 0x%2.")
                .arg(QString::fromLatin1(
                    cavalryPeIatLookupStatusName(lookup.status)))
                .arg(lookup.iatSlotOffset, 0, 16));
    }
    auto **slot = reinterpret_cast<void **>(
        const_cast<std::uint8_t *>(image) + lookup.iatSlotOffset);
    if (kCanonicalAbiPreambleRva + kCanonicalAbiPreamble.size()
            != kCanonicalCallRva
        || !containsRange(
            image,
            imageSize,
            image + kCanonicalAbiPreambleRva,
            kCanonicalAbiPreamble.size())
        || std::memcmp(
            image + kCanonicalAbiPreambleRva,
            kCanonicalAbiPreamble.data(),
            kCanonicalAbiPreamble.size())
            != 0
        || kCanonicalCallRva + 6 != kCanonicalReturnRva
        || !indirectCallTargetsSlot(
            image,
            imageSize,
            image + kCanonicalCallRva,
            slot)) {
        return failTerminalLocked(QStringLiteral(
            "ExtensionLayer.dll canonical MakePathFromText caller/ABI envelope changed."));
    }

    if (GetModuleHandleW(kCoreModuleName) == nullptr
        || GetModuleHandleW(kSkiaModuleName) == nullptr) {
        status_ = QStringLiteral("waiting-for-core-text-path");
        detail_ = QStringLiteral(
            "Core.dll/skia.dll is not loaded yet.");
        return false;
    }

    QString abiDetail;
    const auto runtimeAbi =
        CavalrySkiaRuntimeAbi::verifyAndPin(&abiDetail);
    if (runtimeAbi == nullptr) {
        return failTerminalLocked(QStringLiteral(
            "Core/skia runtime ABI rejected before any private call: %1")
            .arg(abiDetail));
    }
    QString pinFailure;
    if (!pinCavalryI18nModuleForProcessLifetime(
            reinterpret_cast<const void *>(
                cavalryMakePathFromTextReplacement),
            &pinFailure)) {
        return failTerminalLocked(pinFailure);
    }
    void *const original = *slot;
    if (original == nullptr
        || original != runtimeAbi->api().makePathFromText) {
        return failTerminalLocked(QStringLiteral(
            "ExtensionLayer.dll Core::MakePathFromText IAT target does not match the verified Core.dll export RVA."));
    }
    const auto originalFunction =
        reinterpret_cast<MakePathFromTextFunction>(original);

    auto diagnostics =
        std::make_shared<CavalryTextPathDiagnosticState>();
    auto translationGate =
        std::make_shared<std::atomic<bool>>(false);
    QString snapshotFailure;
    QString rendererDetail;
    const auto callbackState = makeActiveState(
        translator_,
        originalFunction,
        image,
        imageSize,
        slot,
        runtimeAbi,
        diagnostics,
        translationGate,
        &snapshotFailure,
        &rendererDetail);
    if (callbackState == nullptr) {
        return failTerminalLocked(snapshotFailure);
    }
    const auto tombstone = makeTombstone(originalFunction);
    if (tombstone == nullptr) {
        return failTerminalLocked(QStringLiteral(
            "Could not allocate the forward-only Core text-path tombstone."));
    }

    const void *expectedOwner = nullptr;
    if (!gLifecycleOwner.compare_exchange_strong(
            expectedOwner,
            this,
            std::memory_order_acq_rel)) {
        return failTerminalLocked(QStringLiteral(
            "The Core text-path IAT hook is already owned."));
    }
    ownsGlobalHook_ = true;

    std::atomic_store_explicit(
        &callbackSlot(),
        callbackState,
        std::memory_order_release);
    QString replacementFailure;
    if (!replaceCavalryIatPointer(
            slot,
            original,
            reinterpret_cast<void *>(
                cavalryMakePathFromTextReplacement),
            &replacementFailure)) {
        publishTombstone(tombstone);
        const void *expected = this;
        gLifecycleOwner.compare_exchange_strong(
            expected,
            nullptr,
            std::memory_order_acq_rel);
        ownsGlobalHook_ = false;
        return failTerminalLocked(replacementFailure);
    }

    diagnostics_ = std::move(diagnostics);
    forwardOnlyTombstone_ = tombstone;
    translationGate_ = std::move(translationGate);
    iatSlot_ = slot;
    original_ = original;
    installed_ = true;
    status_ = QStringLiteral("installed");
    detail_ = QStringLiteral(
        "Patched canonical Core::MakePathFromText after mapped ABI validation and process-lifetime PIN. %1 %2")
        .arg(abiDetail, rendererDetail);
    translationGate_->store(true, std::memory_order_release);
    return true;
}

bool CavalryExtensionLayerTextPathHook::uninstall(
    QString *failureDetail)
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return uninstallLocked(failureDetail);
}

bool CavalryExtensionLayerTextPathHook::isInstalled() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return installed_;
}

bool CavalryExtensionLayerTextPathHook::isWaitingForCore() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return status_ == QStringLiteral("waiting-for-core-text-path");
}

bool CavalryExtensionLayerTextPathHook::isTerminalFailure() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return terminalFailure_;
}

QString CavalryExtensionLayerTextPathHook::status() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return status_;
}

QString CavalryExtensionLayerTextPathHook::detail() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return detail_ + QStringLiteral(" ")
        + diagnosticsText(
            diagnostics_ == nullptr
                ? CavalryTextPathHookDiagnostics {}
                : diagnostics_->snapshot());
}

CavalryTextPathHookDiagnostics
CavalryExtensionLayerTextPathHook::diagnostics() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return diagnostics_ == nullptr
        ? CavalryTextPathHookDiagnostics {}
        : diagnostics_->snapshot();
}

bool CavalryExtensionLayerTextPathHook::isWhitelistedSource(
    const std::string &source)
{
    return textPathSourceIndex(source) < kSourceCount;
}

std::string
CavalryExtensionLayerTextPathHook::translationForWhitelistedSource(
    const CavalryEmbeddedTranslator &translator,
    const std::string &source)
{
    if (!isWhitelistedSource(source)) {
        return {};
    }
    const QByteArray translated =
        translator.translate(nullptr, source.c_str()).toUtf8();
    return std::string(translated.constData(), translated.size());
}

bool CavalryExtensionLayerTextPathHook::uninstallLocked(
    QString *failureDetail)
{
    if (failureDetail != nullptr) {
        failureDetail->clear();
    }
    if (!ownsGlobalHook_) {
        if (!installed_) {
            return true;
        }
        const QString failure = QStringLiteral(
            "Core text-path restore refused because this instance is not the lifecycle owner.");
        status_ = QStringLiteral("restore-failed");
        detail_ = failure;
        if (failureDetail != nullptr) {
            *failureDetail = failure;
        }
        return false;
    }
    if (gLifecycleOwner.load(std::memory_order_acquire) != this) {
        const QString failure = QStringLiteral(
            "Core text-path restore refused because global ownership changed.");
        status_ = QStringLiteral("restore-failed");
        detail_ = failure;
        if (failureDetail != nullptr) {
            *failureDetail = failure;
        }
        return false;
    }

    // 先停翻译并发布不持 renderer 的墓碑；失败 restore 也保持原函数转发。
    if (translationGate_ != nullptr) {
        translationGate_->store(false, std::memory_order_release);
    }
    publishTombstone(forwardOnlyTombstone_);
    bool restoreSucceeded = true;
    QString restoreFailure;
    if (installed_) {
        restoreSucceeded =
            iatSlot_ != nullptr && original_ != nullptr
            && replaceCavalryIatPointer(
                iatSlot_,
                reinterpret_cast<void *>(
                    cavalryMakePathFromTextReplacement),
                original_,
                &restoreFailure);
        if (restoreSucceeded) {
            installed_ = false;
            iatSlot_ = nullptr;
            original_ = nullptr;
        }
    }

    const void *expectedOwner = this;
    const bool releasedOwner = gLifecycleOwner.compare_exchange_strong(
        expectedOwner,
        nullptr,
        std::memory_order_acq_rel);
    ownsGlobalHook_ = false;
    if (!restoreSucceeded || !releasedOwner) {
        const QString failure = !restoreSucceeded
            ? (restoreFailure.isEmpty()
                ? QStringLiteral(
                    "Core text-path IAT restore failed; forward-only tombstone retains original forwarding.")
                : restoreFailure
                    + QStringLiteral(
                        " Forward-only tombstone retains original forwarding."))
            : QStringLiteral(
                "Core text-path IAT restored, but lifecycle ownership could not be released.");
        status_ = QStringLiteral("restore-failed");
        detail_ = failure;
        if (failureDetail != nullptr) {
            *failureDetail = failure;
        }
        return false;
    }

    status_ = QStringLiteral("uninstalled");
    detail_ = QStringLiteral(
        "Restored Core text-path IAT and published a renderer-free forward-only tombstone.");
    return true;
}

bool CavalryExtensionLayerTextPathHook::failTerminalLocked(
    const QString &detail)
{
    terminalFailure_ = true;
    status_ = QStringLiteral("unsupported");
    detail_ = detail;
    if (ownsGlobalHook_ && !installed_) {
        const void *expectedOwner = this;
        gLifecycleOwner.compare_exchange_strong(
            expectedOwner,
            nullptr,
            std::memory_order_acq_rel);
        ownsGlobalHook_ = false;
    }
    return false;
}

#ifdef CAVALRY_I18N_TESTING
bool
CavalryExtensionLayerTextPathHook::verifyForwardOnlyTombstoneForTesting(
    void *original)
{
    auto retiredGate = std::make_shared<std::atomic<bool>>(true);
    auto retiredState = std::make_shared<CavalryTextPathCallbackState>();
    retiredState->original = reinterpret_cast<MakePathFromTextFunction>(
        original);
    retiredState->translationGate = retiredGate;
    std::atomic_store_explicit(
        &callbackSlot(),
        std::shared_ptr<const CavalryTextPathCallbackState>(retiredState),
        std::memory_order_release);
    retiredGate->store(false, std::memory_order_release);
    const auto tombstone = makeTombstone(
        reinterpret_cast<MakePathFromTextFunction>(original));
    publishTombstone(tombstone);
    auto nextGenerationGate = std::make_shared<std::atomic<bool>>(true);
    const auto current = std::atomic_load_explicit(
        &callbackSlot(),
        std::memory_order_acquire);
    return current != nullptr && current->isForwardOnly()
        && reinterpret_cast<void *>(current->original) == original
        && current->translationGate == nullptr
        && !retiredState->translationGate->load(std::memory_order_acquire)
        && nextGenerationGate->load(std::memory_order_acquire)
        && retiredState->translationGate != nextGenerationGate;
}

CavalryTextPathHookDiagnostics
CavalryExtensionLayerTextPathHook::
exerciseDiagnosticCountersForTesting()
{
    auto state = std::make_shared<CavalryTextPathDiagnosticState>();
    bump(state, &CavalryTextPathDiagnosticState::canonicalCalls);
    bump(state, &CavalryTextPathDiagnosticState::noTranslation);
    bump(state, &CavalryTextPathDiagnosticState::originalFallback);
    bump(state, &CavalryTextPathDiagnosticState::canonicalCalls);
    bump(state, &CavalryTextPathDiagnosticState::whitelistCalls);
    bump(state, &CavalryTextPathDiagnosticState::cjkPathSuccess);
    setSourceMask(
        state,
        &CavalryTextPathDiagnosticState::translatedSourceMask,
        0);
    bump(state, &CavalryTextPathDiagnosticState::canonicalCalls);
    bump(state, &CavalryTextPathDiagnosticState::whitelistCalls);
    bump(state, &CavalryTextPathDiagnosticState::rendererFailure);
    bump(state, &CavalryTextPathDiagnosticState::originalFallback);
    setSourceMask(
        state,
        &CavalryTextPathDiagnosticState::fallbackSourceMask,
        14);
    return state->snapshot();
}
#endif
