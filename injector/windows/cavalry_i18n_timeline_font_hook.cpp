/**
 * [INPUT]: ExtensionLayer/Core/skia 2.7.2 鐨勫凡楠岃瘉 timeline 鍚堝悓銆丼kia IAT銆乫ont fallback 閫夋嫨鍣ㄤ笌 immutable callback snapshot
 * [OUTPUT]: 鎻愪緵浠呴拡瀵?measureText/drawSimpleText 涓や釜璋冪敤鑰呯殑鐙珛 font hook銆丆AS 鐢熷懡鍛ㄦ湡銆佽瘖鏂笌 forward-only tombstone
 * [POS]: injector/windows 鐨?SkTimeEditorView 瀛椾綋閫傞厤鍣紱涓嶈繘鍏ユ棦鏈夌炕璇?aggregate锛屼笉淇敼 UTF-8 鐢ㄦ埛鏂囨湰
 * [PROTOCOL]: 鍙樻洿鏃舵洿鏂版澶撮儴锛岀劧鍚庢鏌?CLAUDE.md
 */
#include "cavalry_i18n_timeline_font_hook.h"
#include "cavalry_i18n_callback_snapshot.h"
#include "cavalry_i18n_iat_patch.h"
#include "cavalry_i18n_skia_runtime_abi.h"
#include "cavalry_i18n_timeline_font_contract.h"
#include "cavalry_i18n_timeline_font_fallback.h"
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
#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <utility>
#pragma intrinsic(_ReturnAddress)
using TimelineMeasureTextFunction = float (__fastcall *)(
    const void *, const void *, std::size_t, int, void *, const void *);
using TimelineDrawSimpleTextFunction = void (__fastcall *)(
    void *, const void *, std::size_t, int, float, float, const void *, const void *);
class CavalryTimelineFontDiagnosticState final
{
public:
    std::atomic<std::uint64_t> revision { 0 };
    std::atomic<std::uint64_t> measureCalls { 0 };
    std::atomic<std::uint64_t> drawCalls { 0 };
    std::atomic<std::uint64_t> measureFallback { 0 };
    std::atomic<std::uint64_t> drawFallback { 0 };
    std::atomic<std::uint64_t> originalForward { 0 };
    std::atomic<std::uint64_t> rejectedCaller { 0 };
    std::atomic<std::uint64_t> rejectedEncoding { 0 };
    std::atomic<std::uint64_t> rejectedAbi { 0 };
    std::atomic<std::uint64_t> retainedOriginal { 0 };
    CavalryTimelineFontHookDiagnostics snapshot() const
    {
        CavalryTimelineFontHookDiagnostics value;
        value.revision = revision.load(std::memory_order_acquire);
        value.measureCalls = measureCalls.load(std::memory_order_relaxed);
        value.drawCalls = drawCalls.load(std::memory_order_relaxed);
        value.measureFallback = measureFallback.load(std::memory_order_relaxed);
        value.drawFallback = drawFallback.load(std::memory_order_relaxed);
        value.originalForward = originalForward.load(std::memory_order_relaxed);
        value.rejectedCaller = rejectedCaller.load(std::memory_order_relaxed);
        value.rejectedEncoding = rejectedEncoding.load(std::memory_order_relaxed);
        value.rejectedAbi = rejectedAbi.load(std::memory_order_relaxed);
        value.retainedOriginal = retainedOriginal.load(std::memory_order_relaxed);
        return value;
    }
};
class CavalryTimelineFontCallbackState final
{
public:
    TimelineMeasureTextFunction originalMeasure = nullptr;
    TimelineDrawSimpleTextFunction originalDraw = nullptr;
    std::shared_ptr<const CavalrySkiaTimelineFontFallback> fallback;
    std::shared_ptr<CavalryTimelineFontDiagnosticState> diagnostics;
    std::shared_ptr<std::atomic<bool>> translationGate;
    const std::uint8_t *extensionLayerImage = nullptr;
    std::size_t extensionLayerImageSize = 0;
    const std::uint8_t *measureCaller = nullptr;
    const std::uint8_t *drawCaller = nullptr;
    bool isForwardOnly() const
    {
        return originalMeasure != nullptr && originalDraw != nullptr
            && fallback == nullptr && translationGate == nullptr
            && extensionLayerImage == nullptr;
    }
};
namespace {
using TimelineCallbackStatePtr =
    std::shared_ptr<const CavalryTimelineFontCallbackState>;
using FontBytes = std::array<std::byte, 0x18>;
constexpr wchar_t kExtensionLayerModuleName[] = L"ExtensionLayer.dll";
constexpr wchar_t kCoreModuleName[] = L"Core.dll";
constexpr wchar_t kSkiaModuleName[] = L"skia.dll";
constexpr char kMeasureTextSymbol[] =
    "?measureText@SkFont@@QEBAMPEBX_KW4SkTextEncoding@@PEAUSkRect@@PEBVSkPaint@@@Z";
constexpr char kDrawSimpleTextSymbol[] =
    "?drawSimpleText@SkCanvas@@QEAAXPEBX_KW4SkTextEncoding@@MMAEBVSkFont@@AEBVSkPaint@@@Z";
constexpr std::size_t kMaxTimelineTextBytes = 4096U;
TimelineCallbackStatePtr &callbackSlot()
{
    return cavalry_i18n::processLifetimeCallbackSlot<
        CavalryTimelineFontCallbackState>();
}
std::atomic<const void *> gLifecycleOwner { nullptr };
void bump(
    const std::shared_ptr<CavalryTimelineFontDiagnosticState> &state,
    std::atomic<std::uint64_t> CavalryTimelineFontDiagnosticState::*counter)
{
    if (state == nullptr) {
        return;
    }
    (state.get()->*counter).fetch_add(1, std::memory_order_relaxed);
    state->revision.fetch_add(1, std::memory_order_release);
}
void publishTombstone(const TimelineCallbackStatePtr &state)
{
    // Atomic shared ownership keeps an in-flight callback alive. The previous
    // snapshot is released here after the gate closes; no unbounded retirement
    // list leaks every fallback generation for the process lifetime.
    std::atomic_exchange_explicit(
        &callbackSlot(), state, std::memory_order_acq_rel);
}
TimelineCallbackStatePtr makeTombstone(
    TimelineMeasureTextFunction measure,
    TimelineDrawSimpleTextFunction draw)
{
    if (measure == nullptr || draw == nullptr) {
        return {};
    }
    auto state = std::make_shared<CavalryTimelineFontCallbackState>();
    state->originalMeasure = measure;
    state->originalDraw = draw;
    return state;
}
struct ModuleImage final {
    HMODULE module = nullptr;
    const std::uint8_t *base = nullptr;
    std::size_t size = 0;
};

struct ModuleReference final {
    ModuleReference() = default;
    HMODULE module = nullptr;
    ~ModuleReference()
    {
        if (module != nullptr) {
            FreeLibrary(module);
        }
    }
    ModuleReference(const ModuleReference &) = delete;
    ModuleReference &operator=(const ModuleReference &) = delete;
};

bool acquireModule(const wchar_t *name, ModuleReference *reference)
{
    return name != nullptr && reference != nullptr
        && GetModuleHandleExW(0, name, &reference->module)
        && reference->module != nullptr;
}
bool inspectModule(HMODULE module, ModuleImage *image)
{
    if (module == nullptr || image == nullptr) {
        return false;
    }
    MODULEINFO info {};
    if (!GetModuleInformation(
            GetCurrentProcess(), module, &info, sizeof(info))
        || info.lpBaseOfDll == nullptr || info.SizeOfImage == 0) {
        return false;
    }
    image->module = module;
    image->base = static_cast<const std::uint8_t *>(info.lpBaseOfDll);
    image->size = info.SizeOfImage;
    return true;
}
bool pinModule(HMODULE module, QString *failure)
{
    HMODULE pinned = nullptr;
    if (module == nullptr
        || !GetModuleHandleExW(
               GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS
                   | GET_MODULE_HANDLE_EX_FLAG_PIN,
               reinterpret_cast<LPCWSTR>(module),
               &pinned)
        || pinned == nullptr) {
        if (failure != nullptr) {
            *failure = QStringLiteral(
                "Could not PIN the verified ExtensionLayer.dll image (Win32 error %1).")
                .arg(GetLastError());
        }
        return false;
    }
    return true;
}
QString contractFailure(const std::string &failure)
{
    return failure.empty()
        ? QStringLiteral("Timeline font vendor contract rejected the loaded images.")
        : QString::fromStdString(failure);
}
bool approvedCaller(
    const CavalryTimelineFontCallbackState &state,
    const void *returnAddress,
    const std::uint8_t *expected)
{
    return returnAddress != nullptr && expected != nullptr
        && returnAddress == expected
        && state.extensionLayerImage != nullptr
        && expected >= state.extensionLayerImage
        && static_cast<std::size_t>(expected - state.extensionLayerImage)
            < state.extensionLayerImageSize;
}
bool validUtf8Invocation(
    const std::shared_ptr<CavalryTimelineFontDiagnosticState> &diagnostics,
    const void *font,
    const void *text,
    std::size_t length,
    int encoding)
{
    if (encoding != 0) {
        bump(diagnostics, &CavalryTimelineFontDiagnosticState::rejectedEncoding);
        return false;
    }
    if (font == nullptr || (length != 0 && text == nullptr)
        || length > kMaxTimelineTextBytes) {
        bump(diagnostics, &CavalryTimelineFontDiagnosticState::rejectedAbi);
        return false;
    }
    return true;
}
std::string_view textView(const void *text, std::size_t length)
{
    return length == 0
        ? std::string_view()
        : std::string_view(static_cast<const char *>(text), length);
}
float __fastcall timelineMeasureTextReplacement(
    const void *font,
    const void *text,
    std::size_t length,
    int encoding,
    void *bounds,
    const void *paint)
{
    const TimelineCallbackStatePtr state = std::atomic_load_explicit(
        &callbackSlot(), std::memory_order_acquire);
    if (state == nullptr || state->originalMeasure == nullptr) {
        return 0.0F;
    }
    const TimelineMeasureTextFunction original = state->originalMeasure;
    if (state->translationGate == nullptr
        || !state->translationGate->load(std::memory_order_acquire)) {
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::originalForward);
        return original(font, text, length, encoding, bounds, paint);
    }
    if (!approvedCaller(*state, _ReturnAddress(), state->measureCaller)) {
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::rejectedCaller);
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::originalForward);
        return original(font, text, length, encoding, bounds, paint);
    }
    bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::measureCalls);
    if (!validUtf8Invocation(state->diagnostics, font, text, length, encoding)) {
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::originalForward);
        return original(font, text, length, encoding, bounds, paint);
    }
    alignas(void *) FontBytes borrowed {};
    const auto selection = state->fallback == nullptr
        ? CavalrySkiaTimelineFontFallback::Selection { font, false }
        : state->fallback->selectFont(font, textView(text, length), &borrowed);
    const void *selectedFont = selection.font == nullptr ? font : selection.font;
    if (selection.usedFallback) {
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::measureFallback);
    } else {
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::retainedOriginal);
    }
    return original(selectedFont, text, length, encoding, bounds, paint);
}
void __fastcall timelineDrawSimpleTextReplacement(
    void *canvas,
    const void *text,
    std::size_t length,
    int encoding,
    float x,
    float y,
    const void *font,
    const void *paint)
{
    const TimelineCallbackStatePtr state = std::atomic_load_explicit(
        &callbackSlot(), std::memory_order_acquire);
    if (state == nullptr || state->originalDraw == nullptr) {
        return;
    }
    const TimelineDrawSimpleTextFunction original = state->originalDraw;
    if (state->translationGate == nullptr
        || !state->translationGate->load(std::memory_order_acquire)) {
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::originalForward);
        original(canvas, text, length, encoding, x, y, font, paint);
        return;
    }
    if (!approvedCaller(*state, _ReturnAddress(), state->drawCaller)) {
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::rejectedCaller);
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::originalForward);
        original(canvas, text, length, encoding, x, y, font, paint);
        return;
    }
    bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::drawCalls);
    if (canvas == nullptr
        || !validUtf8Invocation(state->diagnostics, font, text, length, encoding)) {
        if (canvas == nullptr) {
            bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::rejectedAbi);
        }
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::originalForward);
        original(canvas, text, length, encoding, x, y, font, paint);
        return;
    }
    alignas(void *) FontBytes borrowed {};
    const auto selection = state->fallback == nullptr
        ? CavalrySkiaTimelineFontFallback::Selection { font, false }
        : state->fallback->selectFont(font, textView(text, length), &borrowed);
    const void *selectedFont = selection.font == nullptr ? font : selection.font;
    if (selection.usedFallback) {
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::drawFallback);
    } else {
        bump(state->diagnostics, &CavalryTimelineFontDiagnosticState::retainedOriginal);
    }
    original(canvas, text, length, encoding, x, y, selectedFont, paint);
}
struct SlotInstallResult final {
    bool success = false;
    bool measurePatched = false;
    bool drawPatched = false;
    QString failure;
};
SlotInstallResult installTwoSlots(
    void **measureSlot,
    void *measureOriginal,
    void **drawSlot,
    void *drawOriginal)
{
    SlotInstallResult result;
    if (!replaceCavalryIatPointer(
            measureSlot,
            measureOriginal,
            reinterpret_cast<void *>(timelineMeasureTextReplacement),
            &result.failure)) {
        return result;
    }
    result.measurePatched = true;
    if (!replaceCavalryIatPointer(
            drawSlot,
            drawOriginal,
            reinterpret_cast<void *>(timelineDrawSimpleTextReplacement),
            &result.failure)) {
        QString rollbackFailure;
        if (!replaceCavalryIatPointer(
                measureSlot,
                reinterpret_cast<void *>(timelineMeasureTextReplacement),
                measureOriginal,
                &rollbackFailure)) {
            result.failure += QStringLiteral(" First-slot rollback failed: ")
                + rollbackFailure;
        } else {
            result.measurePatched = false;
        }
        return result;
    }
    result.drawPatched = true;
    result.success = true;
    return result;
}
bool releaseLifecycleOwner(const void *owner)
{
    const void *expected = owner;
    return gLifecycleOwner.compare_exchange_strong(
        expected, nullptr, std::memory_order_acq_rel);
}
} // namespace
CavalryTimelineFontHook::CavalryTimelineFontHook(
    CavalryEmbeddedTranslator &translator)
    : translator_(translator)
{
}
CavalryTimelineFontHook::~CavalryTimelineFontHook()
{
    QString ignoredFailure;
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    uninstallLocked(&ignoredFailure);
}
bool CavalryTimelineFontHook::ensureInstalled()
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    if (measureInstalled_ && drawInstalled_) {
        return true;
    }
    if (terminalFailure_) {
        return false;
    }
    ModuleReference extensionReference;
    ModuleReference coreReference;
    ModuleReference skiaReference;
    if (!acquireModule(kExtensionLayerModuleName, &extensionReference)
        || !acquireModule(kCoreModuleName, &coreReference)
        || !acquireModule(kSkiaModuleName, &skiaReference)) {
        status_ = QStringLiteral("waiting-for-extension-layer");
        detail_ = QStringLiteral(
            "ExtensionLayer.dll/Core.dll/skia.dll is not loaded yet; timeline font hook will retry.");
        return false;
    }
    ModuleImage extensionImage;
    ModuleImage coreImage;
    ModuleImage skiaImage;
    if (!inspectModule(extensionReference.module, &extensionImage)
        || !inspectModule(coreReference.module, &coreImage)
        || !inspectModule(skiaReference.module, &skiaImage)) {
        status_ = QStringLiteral("waiting-for-extension-layer");
        detail_ = QStringLiteral(
            "ExtensionLayer.dll/Core.dll/skia.dll image information is not available yet.");
        return false;
    }
    CavalryTimelineFontContractEvidence evidence;
    std::string contractError;
    if (!verifyCavalryTimelineFontContract(
            extensionImage.base,
            extensionImage.size,
            coreImage.base,
            coreImage.size,
            skiaImage.base,
            skiaImage.size,
            &evidence,
            &contractError)) {
        return failTerminalLocked(contractFailure(contractError));
    }
    QString extensionPinFailure;
    if (!pinModule(extensionReference.module, &extensionPinFailure)) {
        return failTerminalLocked(extensionPinFailure);
    }
    QString runtimeDetail;
    const auto runtimeAbi = CavalrySkiaRuntimeAbi::verifyAndPin(&runtimeDetail);
    if (runtimeAbi == nullptr) {
        return failTerminalLocked(QStringLiteral(
            "Core/skia runtime ABI rejected before timeline IAT writes: %1")
            .arg(runtimeDetail));
    }
    auto **measureSlot = reinterpret_cast<void **>(
        const_cast<std::uint8_t *>(extensionImage.base)
            + evidence.measureTextIatRva);
    auto **drawSlot = reinterpret_cast<void **>(
        const_cast<std::uint8_t *>(extensionImage.base)
            + evidence.drawSimpleTextIatRva);
    const void *expectedMeasure = reinterpret_cast<const void *>(
        GetProcAddress(skiaReference.module, kMeasureTextSymbol));
    const void *expectedDraw = reinterpret_cast<const void *>(
        GetProcAddress(skiaReference.module, kDrawSimpleTextSymbol));
    std::string resolvedTargetError;
    if (!verifyCavalryTimelineFontResolvedSkiaTargets(
            evidence,
            expectedMeasure,
            expectedDraw,
            &resolvedTargetError)) {
        return failTerminalLocked(contractFailure(resolvedTargetError));
    }
    const void *measureOriginal = *measureSlot;
    const void *drawOriginal = *drawSlot;
    if (expectedMeasure == nullptr || expectedDraw == nullptr
        || measureOriginal != expectedMeasure || drawOriginal != expectedDraw) {
        return failTerminalLocked(QStringLiteral(
            "Verified timeline IAT slots no longer point to the exact skia.dll exports."));
    }
    QString fallbackDetail;
    auto fallbackUnique = CavalrySkiaTimelineFontFallback::create(
        translator_.language(), &fallbackDetail);
    if (fallbackUnique == nullptr) {
        return failTerminalLocked(QStringLiteral(
            "Timeline font fallback creation failed; existing translations remain enabled: %1")
            .arg(fallbackDetail));
    }
    std::shared_ptr<const CavalrySkiaTimelineFontFallback> fallback;
    std::shared_ptr<CavalryTimelineFontDiagnosticState> diagnostics;
    std::shared_ptr<std::atomic<bool>> gate;
    TimelineCallbackStatePtr active;
    TimelineCallbackStatePtr tombstone;
    try {
        fallback = std::shared_ptr<const CavalrySkiaTimelineFontFallback>(
            std::move(fallbackUnique));
        diagnostics = std::make_shared<CavalryTimelineFontDiagnosticState>();
        gate = std::make_shared<std::atomic<bool>>(false);
        auto mutableActive = std::make_shared<CavalryTimelineFontCallbackState>();
        mutableActive->originalMeasure = reinterpret_cast<TimelineMeasureTextFunction>(
            const_cast<void *>(measureOriginal));
        mutableActive->originalDraw = reinterpret_cast<TimelineDrawSimpleTextFunction>(
            const_cast<void *>(drawOriginal));
        mutableActive->fallback = fallback;
        mutableActive->diagnostics = diagnostics;
        mutableActive->translationGate = gate;
        mutableActive->extensionLayerImage = extensionImage.base;
        mutableActive->extensionLayerImageSize = extensionImage.size;
        mutableActive->measureCaller = extensionImage.base + evidence.measureTextReturnRva;
        mutableActive->drawCaller = extensionImage.base + evidence.drawSimpleTextReturnRva;
        active = mutableActive;
        tombstone = makeTombstone(mutableActive->originalMeasure, mutableActive->originalDraw);
    } catch (...) {
        return failTerminalLocked(QStringLiteral(
            "Could not allocate the immutable timeline font callback snapshot."));
    }
    if (tombstone == nullptr) {
        return failTerminalLocked(QStringLiteral(
            "Could not allocate the forward-only timeline font tombstone."));
    }
    const void *expectedOwner = nullptr;
    if (!gLifecycleOwner.compare_exchange_strong(
            expectedOwner, this, std::memory_order_acq_rel)) {
        return failTerminalLocked(QStringLiteral(
            "The timeline font IAT hooks are already owned."));
    }
    ownsLifecycle_ = true;
    QString pluginPinFailure;
    if (!pinCavalryI18nModuleForProcessLifetime(
            reinterpret_cast<const void *>(timelineMeasureTextReplacement),
            &pluginPinFailure)) {
        releaseLifecycleOwner(this);
        ownsLifecycle_ = false;
        return failTerminalLocked(QStringLiteral(
            "Could not PIN cavalryi18n.dll before timeline IAT writes: %1")
            .arg(pluginPinFailure));
    }
    diagnostics_ = diagnostics;
    translationGate_ = gate;
    forwardOnlyTombstone_ = tombstone;
    measureIatSlot_ = measureSlot;
    drawIatSlot_ = drawSlot;
    originalMeasure_ = const_cast<void *>(measureOriginal);
    originalDraw_ = const_cast<void *>(drawOriginal);
    std::atomic_store_explicit(&callbackSlot(), active, std::memory_order_release);
    const SlotInstallResult installed = installTwoSlots(
        measureSlot,
        const_cast<void *>(measureOriginal),
        drawSlot,
        const_cast<void *>(drawOriginal));
    measureInstalled_ = installed.measurePatched;
    drawInstalled_ = installed.drawPatched;
    if (!installed.success) {
        if (!measureInstalled_ && !drawInstalled_) {
            publishTombstone(tombstone);
        }
        return failTerminalLocked(installed.failure);
    }
    if (!measureInstalled_ || !drawInstalled_) {
        return failTerminalLocked(QStringLiteral(
            "Timeline font hook did not complete both approved IAT writes."));
    }
    status_ = QStringLiteral("installed");
    detail_ = QStringLiteral(
        "Patched only the approved SkTimeEditorView measureText/drawSimpleText callers in ExtensionLayer.dll. %1")
        .arg(runtimeDetail);
    translationGate_->store(true, std::memory_order_release);
    return true;
}
bool CavalryTimelineFontHook::isWaitingForModule() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return status_.startsWith(QStringLiteral("waiting"));
}
QString CavalryTimelineFontHook::status() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return status_;
}
QString CavalryTimelineFontHook::detail() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return detail_;
}
CavalryTimelineFontHookDiagnostics CavalryTimelineFontHook::diagnostics() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return diagnostics_ == nullptr
        ? CavalryTimelineFontHookDiagnostics {}
        : diagnostics_->snapshot();
}
bool CavalryTimelineFontHook::uninstallLocked(QString *failureDetail)
{
    if (failureDetail != nullptr) {
        failureDetail->clear();
    }
    if (!ownsLifecycle_) {
        if (!measureInstalled_ && !drawInstalled_) {
            return true;
        }
        const QString failure = QStringLiteral(
            "Timeline font restore refused because this instance is not the lifecycle owner.");
        status_ = QStringLiteral("restore-failed");
        detail_ = failure;
        if (failureDetail != nullptr) {
            *failureDetail = failure;
        }
        return false;
    }
    if (translationGate_ != nullptr) {
        translationGate_->store(false, std::memory_order_release);
    }
    publishTombstone(forwardOnlyTombstone_);
    bool measureRestored = !measureInstalled_;
    bool drawRestored = !drawInstalled_;
    QString measureFailure;
    QString drawFailure;
    if (measureInstalled_ && measureIatSlot_ != nullptr && originalMeasure_ != nullptr) {
        measureRestored = replaceCavalryIatPointer(
            measureIatSlot_,
            reinterpret_cast<void *>(timelineMeasureTextReplacement),
            originalMeasure_,
            &measureFailure);
        if (measureRestored) {
            measureInstalled_ = false;
            measureIatSlot_ = nullptr;
        } else if (*measureIatSlot_ != reinterpret_cast<void *>(timelineMeasureTextReplacement)) {
            measureInstalled_ = false;
            measureIatSlot_ = nullptr;
        }
    }
    if (drawInstalled_ && drawIatSlot_ != nullptr && originalDraw_ != nullptr) {
        drawRestored = replaceCavalryIatPointer(
            drawIatSlot_,
            reinterpret_cast<void *>(timelineDrawSimpleTextReplacement),
            originalDraw_,
            &drawFailure);
        if (drawRestored) {
            drawInstalled_ = false;
            drawIatSlot_ = nullptr;
        } else if (*drawIatSlot_ != reinterpret_cast<void *>(timelineDrawSimpleTextReplacement)) {
            drawInstalled_ = false;
            drawIatSlot_ = nullptr;
        }
    }
    const bool unresolvedOwnedSlot =
        (measureInstalled_ && measureIatSlot_ != nullptr
            && *measureIatSlot_ == reinterpret_cast<void *>(timelineMeasureTextReplacement))
        || (drawInstalled_ && drawIatSlot_ != nullptr
            && *drawIatSlot_ == reinterpret_cast<void *>(timelineDrawSimpleTextReplacement));
    if (!measureRestored || !drawRestored || unresolvedOwnedSlot) {
        if (!unresolvedOwnedSlot) {
            ownsLifecycle_ = !releaseLifecycleOwner(this);
        }
        QString failure = QStringLiteral(
            "Timeline font IAT restore failed; the forward-only tombstone remains published.");
        if (!measureFailure.isEmpty()) {
            failure += QStringLiteral(" measure: ") + measureFailure;
        }
        if (!drawFailure.isEmpty()) {
            failure += QStringLiteral(" draw: ") + drawFailure;
        }
        status_ = QStringLiteral("restore-failed");
        detail_ = failure;
        if (failureDetail != nullptr) {
            *failureDetail = failure;
        }
        return false;
    }
    const bool releasedOwner = releaseLifecycleOwner(this);
    if (!releasedOwner) {
        status_ = QStringLiteral("restore-failed");
        detail_ = QStringLiteral(
            "Timeline font IAT slots were restored but lifecycle ownership could not be released.");
        if (failureDetail != nullptr) {
            *failureDetail = detail_;
        }
        return false;
    }
    ownsLifecycle_ = false;
    originalMeasure_ = nullptr;
    originalDraw_ = nullptr;
    status_ = QStringLiteral("uninstalled");
    detail_ = QStringLiteral(
        "Restored timeline font IAT slots and published a forward-only tombstone.");
    return true;
}
bool CavalryTimelineFontHook::failTerminalLocked(const QString &failure)
{
    terminalFailure_ = true;
    if (ownsLifecycle_ && (measureInstalled_ || drawInstalled_)) {
        QString restoreFailure;
        if (!uninstallLocked(&restoreFailure)) {
            status_ = QStringLiteral("restore-failed");
            detail_ = failure + QStringLiteral(" ") + restoreFailure;
            return false;
        }
    } else if (ownsLifecycle_) {
        ownsLifecycle_ = !releaseLifecycleOwner(this);
    }
    status_ = QStringLiteral("unsupported");
    detail_ = failure;
    return false;
}
#ifdef CAVALRY_I18N_TESTING
bool CavalryTimelineFontHook::configureSlotsForTesting(
    void **measureSlot,
    void *measureOriginal,
    void **drawSlot,
    void *drawOriginal)
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    if (terminalFailure_ || ownsLifecycle_
        || measureSlot == nullptr || measureOriginal == nullptr
        || drawSlot == nullptr || drawOriginal == nullptr) {
        return false;
    }
    auto diagnostics = std::make_shared<CavalryTimelineFontDiagnosticState>();
    auto gate = std::make_shared<std::atomic<bool>>(false);
    TimelineCallbackStatePtr active;
    TimelineCallbackStatePtr tombstone;
    try {
        auto mutableActive = std::make_shared<CavalryTimelineFontCallbackState>();
        mutableActive->originalMeasure = reinterpret_cast<TimelineMeasureTextFunction>(measureOriginal);
        mutableActive->originalDraw = reinterpret_cast<TimelineDrawSimpleTextFunction>(drawOriginal);
        mutableActive->diagnostics = diagnostics;
        mutableActive->translationGate = gate;
        active = mutableActive;
        tombstone = makeTombstone(mutableActive->originalMeasure, mutableActive->originalDraw);
    } catch (...) {
        return false;
    }
    if (tombstone == nullptr) {
        return false;
    }
    const void *expectedOwner = nullptr;
    if (!gLifecycleOwner.compare_exchange_strong(
            expectedOwner, this, std::memory_order_acq_rel)) {
        return false;
    }
    ownsLifecycle_ = true;
    diagnostics_ = diagnostics;
    translationGate_ = gate;
    forwardOnlyTombstone_ = tombstone;
    measureIatSlot_ = measureSlot;
    drawIatSlot_ = drawSlot;
    originalMeasure_ = measureOriginal;
    originalDraw_ = drawOriginal;
    std::atomic_store_explicit(&callbackSlot(), active, std::memory_order_release);
    const SlotInstallResult installed = installTwoSlots(
        measureSlot, measureOriginal, drawSlot, drawOriginal);
    measureInstalled_ = installed.measurePatched;
    drawInstalled_ = installed.drawPatched;
    if (!installed.success) {
        if (!measureInstalled_ && !drawInstalled_) {
            publishTombstone(tombstone);
        }
        return failTerminalLocked(installed.failure);
    }
    gate->store(true, std::memory_order_release);
    status_ = QStringLiteral("installed");
    detail_ = QStringLiteral("Timeline font fake-slot test state installed.");
    return true;
}
bool CavalryTimelineFontHook::triggerTerminalFailureForTesting(
    const QString &failure)
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return failTerminalLocked(failure);
}
void *CavalryTimelineFontHook::measureReplacementAddressForTesting()
{
    return reinterpret_cast<void *>(timelineMeasureTextReplacement);
}
void *CavalryTimelineFontHook::drawReplacementAddressForTesting()
{
    return reinterpret_cast<void *>(timelineDrawSimpleTextReplacement);
}
bool CavalryTimelineFontHook::verifyForwardOnlyTombstoneForTesting(
    void *measureOriginal,
    void *drawOriginal)
{
    const auto measure = reinterpret_cast<TimelineMeasureTextFunction>(measureOriginal);
    const auto draw = reinterpret_cast<TimelineDrawSimpleTextFunction>(drawOriginal);
    auto gate = std::make_shared<std::atomic<bool>>(true);
    auto active = std::make_shared<CavalryTimelineFontCallbackState>();
    active->originalMeasure = measure;
    active->originalDraw = draw;
    active->translationGate = gate;
    std::atomic_store_explicit(
        &callbackSlot(), TimelineCallbackStatePtr(active), std::memory_order_release);
    gate->store(false, std::memory_order_release);
    publishTombstone(makeTombstone(measure, draw));
    const auto current = std::atomic_load_explicit(
        &callbackSlot(), std::memory_order_acquire);
    return current != nullptr && current->isForwardOnly()
        && current->originalMeasure == measure
        && current->originalDraw == draw
        && !gate->load(std::memory_order_acquire);
}
#endif
