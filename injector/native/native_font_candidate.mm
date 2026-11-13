/**
 * [INPUT]: 依赖arm64或x86字体ABI合同、独立locale门及分架构owner校验；显式2.8.1 arm64另依赖NodeView合同。
 * [OUTPUT]: 提供唯一gLocale、字体准入门与精确caller文字投影；目标宏启用时加NodeView Measure/Draw路由和fmt v11导入符号。
 * [POS]: 默认2.8.0实现保持原样；NodeView与fmt v11只在CAVALRY_NATIVE_TARGET_281 arm64目标编译。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include <CoreText/CoreText.h>
#include <array>
#include <atomic>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <limits.h>
#include <mach/mach.h>
#include <mach/mach_vm.h>
#include <mach-o/dyld.h>
#include <mutex>
#include <new>
#include <optional>
#include <utility>
#include "timeline_owner_observer_abi.h"
#include "../cavalry_i18n_macos_abi.h"
#include "../cavalry_i18n_macos_timeline_font_policy.h"
#include "getpath_font_abi_contract.h"
#include "native_locale_abi_contract.h"
#if defined(__x86_64__)
#include "native_candidate_architecture.h"
#include "native_locale_x86_64_abi_contract.h"
#include "native_font_x86_64_abi_contract.h"
#include "timeline_owner_observer_x86_64_contract.h"
namespace native_locale_x86 = native_locale_interpose::x86_64_contract;
namespace native_candidate_arch = native_candidate_architecture;
#endif
#include "timeline_owner_observer_contract.h"
#include "timeline_system_fallback_contract.h"
#include "timeline_system_fallback_policy.h"
#include "timeline_system_fallback_mixed_span_coretext.h"
#include "viewport_owner_snapshot.h"
#include <pthread.h>
#include <string>
#include <string_view>
#include "verified_text_selection.h"
#include "viewport_blob_abi.h"
#if defined(__x86_64__)
#include "viewport_blob_x86_64_owner_snapshot.h"
#endif
#include "native_locale_snapshot.h"
#include "getpath_font_abi.h"
#include "getpath_owner_adapter.h"
#include "getpath_font_texts.inc"
#include "getpath_graph_editor_empty_texts.inc"
#include "native_image_paths.h"
#include "title_format_abi_contract.h"
#include "help_description_abi_contract.h"
#include "demo_reader_abi_contract.h"
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
#include "dependency_node_font_abi_contract.h"
#include "dependency_node_font_policy.h"
#endif

using DemoTextFromFileResult = native_demo_reader::contract::TextFromFileResult;
namespace native_demo_reader { extern std::atomic<bool> gContractReady; }

struct Api;
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wreturn-type-c-linkage"
extern "C" std::string nativeActiveLocaleInterpose(Api *api);
extern "C" std::string activeLocaleTarget(Api *api)
    __asm__("__ZN7cavalry12activeLocaleEP3Api");
extern "C" DemoTextFromFileResult nativeDemoTextFromFileInterpose(
    const std::string &path);
extern "C" DemoTextFromFileResult demoTextFromFileTarget(const std::string &path)
    __asm__("__ZN7cavalry12textFromFileERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE");
extern "C" std::string nativeTitleVformatInterpose(
    native_title_format_abi::FormatStringView format,
    native_title_format_abi::FormatArguments arguments);
extern "C" std::string titleFormatVformatTarget(
    native_title_format_abi::FormatStringView format,
    native_title_format_abi::FormatArguments arguments)
#if defined(CAVALRY_NATIVE_TARGET_281)
    __asm__("__ZN3fmt3v117vformatENS0_17basic_string_viewIcEENS0_17basic_format_argsINS0_7contextEEE");
#else
    __asm__("__ZN3fmt3v107vformatENS0_17basic_string_viewIcEENS0_17basic_format_argsINS0_20basic_format_contextINS0_8appenderEcEEEE");
#endif
#pragma clang diagnostic pop
extern "C" void nativeHelpDocumentationInterpose(
    void *owner, const std::string &key,
    const native_help_description::contract::ScriptDocumentationAbiMirror &documentation);
extern "C" void helpDocumentationEntryTarget(
    void *owner, const std::string &key,
    const native_help_description::contract::ScriptDocumentationAbiMirror &documentation)
    __asm__("__ZN8TextEdit27addScriptDocumentationEntryERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEERKN7cavalry19ScriptDocumentationE");
extern "C" {
__attribute__((visibility("hidden"))) std::atomic<std::uintptr_t>
    nativeWelcomeLogItExpectedReturnPc{0};
void nativeWelcomeLogItVeneer(void *logger, const void *message,
                              bool logEnabled, bool tracebackEnabled);
void nativeWelcomeLogItDispatcher(void *logger, const void *message,
                                  bool logEnabled, bool tracebackEnabled,
                                  std::uintptr_t callerPc);
void welcomeLogItTarget(void *logger, const void *message,
                        bool logEnabled, bool tracebackEnabled)
    __asm__("__ZN6spdlog6logger7log_it_ERKNS_7details7log_msgEbb");
}
namespace {
namespace e4_contract = native_getpath_abi::contract;
namespace observer_contract = timeline_owner_observer::contract;
namespace policy = timeline_system_fallback::policy;
namespace contract = timeline_system_fallback::contract;
namespace native_locale_contract = native_locale_interpose::contract;
namespace native_locale = cavalry_native_font;
using cavalry_i18n::macos_abi::LoadedImage;
using cavalry_i18n::macos_abi::SkFontAbi;
using cavalry_i18n::macos_abi::SkSpTypefaceAbi;
using cavalry_i18n::macos_abi::findMachOSymbol;
using cavalry_i18n::macos_abi::imageAddress;
using cavalry_i18n::macos_abi::imageUuidEquals;
using cavalry_i18n::macos_abi::matchesCode;
using timeline_owner_observer::DrawOriginal;
using timeline_owner_observer::MeasureOriginal;
using policy::Caller;
using policy::FontKey;
using policy::FontTraits;
using policy::Locale;
using policy::TextDisposition;
using policy::GlyphLookup;
using NativeLocaleGetter = std::string (*)(Api *);
using DemoTextFromFileOriginal = native_demo_reader::contract::TextFromFileFunction;
using NativeTitleVformat = std::string (*)(
    native_title_format_abi::FormatStringView,
    native_title_format_abi::FormatArguments);
static_assert(sizeof(SkFontAbi) == 0x18);
static_assert(sizeof(std::uintptr_t) == sizeof(std::size_t));
static_assert(sizeof(std::uintptr_t) == 8);
static_assert(contract::kMaxFontSlots > 0 && contract::kMaxFontSlots <= 32);
static_assert(contract::kMaxPostScriptNameBytes == policy::kPostScriptNameBytes);
static_assert(std::atomic<native_locale::Locale>::is_always_lock_free);
using MakeTypeface = SkSpTypefaceAbi (*)(CTFontRef);
using GetCTFont = CTFontRef (*)(const void *);
using MakeFont = SkFontAbi (*)(SkSpTypefaceAbi, float);
#include "native_font_factory_bindings.inc"
using SetSize = void (*)(void *, float);
enum class DecisionReason : unsigned {
    OwnerUnproven,
    FontReadUnavailable,
    InvalidText,
    AsciiOriginal,
    OriginalCovers,
    LocaleUnavailable,
    SystemFontUnavailable,
    CacheFull,
    FactoryFailed,
    StyleMismatch,
    SizeRejected,
    CoverageRejected,
    FallbackApplied,
    Count
};
struct OwnerSpan {
    const unsigned char *data = nullptr;
    std::size_t size = 0;
};
struct TextSnapshot {
    std::array<unsigned char, cavalry_i18n::mac_timeline::kMaxTextBytes> bytes{};
    std::size_t size = 0;
};
struct FontSnapshot {
    SkFontAbi font{};
    const void *typeface = nullptr;
    float size = 0.0F;
};
struct FontSlot {
    bool ready = false;
    FontKey key{};
    SkFontAbi *font = nullptr;
    const void *typeface = nullptr;
    DecisionReason failure = DecisionReason::FactoryFailed;
};
std::atomic<viewport_blob::BlobOriginal> gOriginalBlob{nullptr};
std::atomic<MeasureOriginal> gOriginalMeasure{nullptr};
std::atomic<DrawOriginal> gOriginalDraw{nullptr};
std::atomic<native_getpath_font::Original> gOriginalGetPath{nullptr};
std::atomic<NativeLocaleGetter> gOriginalNativeLocale{nullptr};
std::atomic<NativeTitleVformat> gOriginalTitleVformat{nullptr};
std::atomic<bool> gAdmitted{false};
std::atomic<bool> gNativeLocaleContractReady{false};
#if defined(__x86_64__)
std::atomic<bool> gFontContractReady{false};
[[maybe_unused]] std::atomic<bool> gX86FontAbiContractReady{false};
#endif
std::atomic<bool> gTitleFormatContractReady{false};
native_locale::LocaleSnapshot gLocale{};
std::array<FontSlot, contract::kMaxFontSlots> gSlots{};
std::size_t gSlotCount = 0;
std::mutex gSlotsMutex;
LoadedImage gCoreImage{};
LoadedImage gExtensionImage{};
LoadedImage gSkiaImage{};
LoadedImage gApiImage{};
LoadedImage gTitleExtensionImage{};
LoadedImage gFmtImage{};
GlyphLookup gGlyph = nullptr;
SetSize gSetSize = nullptr;
#include "skia_original_bindings.inc"
#include "native_image_runtime_helpers.inc"
#include "native_locale_adapter.inc"
#if defined(__x86_64__)
#include "native_font_x86_64_runtime.inc"
#endif
bool verifyTitleFormatContract() noexcept;
bool verifyHelpDescriptionContract() noexcept;
bool verifyGuideBodyContract() noexcept;
bool verifyEasingMenuContract() noexcept;
bool verifySaveSceneCaptionContract() noexcept;
bool verifyWelcomeLogItContract() noexcept;
bool verifyDemoReaderContract() noexcept;
thread_local bool gInsideRuntime = false;
class RuntimeScope {
public:
    RuntimeScope() noexcept : previous_(gInsideRuntime) { gInsideRuntime = true; }
    ~RuntimeScope() { gInsideRuntime = previous_; }
    RuntimeScope(const RuntimeScope &) = delete;
    RuntimeScope &operator=(const RuntimeScope &) = delete;
private:
    bool previous_;
};
class SlotLock {
public:
    bool acquire() noexcept
    {
        try {
            gSlotsMutex.lock();
            locked_ = true;
            return true;
        } catch (...) {
            return false;
        }
    }
    void unlock() noexcept
    {
        if (!locked_) return;
        gSlotsMutex.unlock();
        locked_ = false;
    }
    ~SlotLock() { unlock(); }
    SlotLock() = default;
    SlotLock(const SlotLock &) = delete;
    SlotLock &operator=(const SlotLock &) = delete;
private:
    bool locked_ = false;
};
class CTFontOwner {
public:
    explicit CTFontOwner(CTFontRef value) noexcept : value_(value) {}
    ~CTFontOwner() { if (value_ != nullptr) CFRelease(value_); }
    CTFontOwner(const CTFontOwner &) = delete;
    CTFontOwner &operator=(const CTFontOwner &) = delete;
    CTFontRef get() const noexcept { return value_; }
private:
    CTFontRef value_;
};
class CFStringOwner {
public:
    explicit CFStringOwner(CFStringRef value) noexcept : value_(value) {}
    ~CFStringOwner() { if (value_ != nullptr) CFRelease(value_); }
    CFStringOwner(const CFStringOwner &) = delete;
    CFStringOwner &operator=(const CFStringOwner &) = delete;
    CFStringRef get() const noexcept { return value_; }
private:
    CFStringRef value_;
};
class CFDictionaryOwner {
public:
    explicit CFDictionaryOwner(CFDictionaryRef value) noexcept : value_(value) {}
    ~CFDictionaryOwner() { if (value_ != nullptr) CFRelease(value_); }
    CFDictionaryOwner(const CFDictionaryOwner &) = delete;
    CFDictionaryOwner &operator=(const CFDictionaryOwner &) = delete;
    CFDictionaryRef get() const noexcept { return value_; }
private:
    CFDictionaryRef value_;
};
bool imagePathMatches(const char *path, const char *expected) noexcept
{
    return native_image_paths::pathMatchesCanonical(path, expected);
}
#if !defined(__x86_64__)
bool appFrameworkPath(const char *leaf, char *output, std::size_t capacity) noexcept
{
    char executable[PATH_MAX]{};
    std::uint32_t size = sizeof(executable);
    if (_NSGetExecutablePath(executable, &size) != 0) return false;
    return native_image_paths::frameworksPathForExecutable(
        executable, leaf, output, capacity);
}
bool symbolAt(const LoadedImage &image, const char *symbol,
              std::uintptr_t offset) noexcept
{
    return findMachOSymbol(image, symbol) == imageAddress(image, offset);
}
#endif
#if defined(__x86_64__)
[[maybe_unused]] bool verifyViewportProbe(const LoadedImage &) noexcept;
#else
bool verifyViewportProbe(const LoadedImage &) noexcept;
#endif

bool verifyContract() noexcept
{
#if defined(__x86_64__)
    const bool localeReady = gNativeLocaleContractReady.load(
        std::memory_order_acquire);
    const bool fontAbiReady = verifyX86FontAbiContract();
    gX86FontAbiContractReady.store(fontAbiReady, std::memory_order_release);
    return native_font_x86_64_abi::contract::fontLaneContractsReady(
        localeReady, fontAbiReady);
#else
    LoadedImage core{};
    LoadedImage extension{};
    LoadedImage skia{};
    LoadedImage api{};
    std::array<char, PATH_MAX> corePath{};
    std::array<char, PATH_MAX> extensionPath{};
    std::array<char, PATH_MAX> skiaPath{};
    std::array<char, PATH_MAX> apiPath{};
    if (!appFrameworkPath("libCore.dylib", corePath.data(), corePath.size()) ||
        !appFrameworkPath("libExtensionLayer.dylib", extensionPath.data(), extensionPath.size()) ||
        !appFrameworkPath("libskia.dylib", skiaPath.data(), skiaPath.size()) ||
        !appFrameworkPath("libApi.dylib", apiPath.data(), apiPath.size()) ||
        !findLoadedImageExactPath(corePath.data(), &core) ||
        !findLoadedImageExactPath(extensionPath.data(), &extension) ||
        !findLoadedImageExactPath(skiaPath.data(), &skia) ||
        !findLoadedImageExactPath(apiPath.data(), &api) ||
        !imageUuidEquals(core, e4_contract::kCoreUuid) ||
        !imageUuidEquals(extension, e4_contract::kExtensionUuid) ||
        !imageUuidEquals(skia, e4_contract::kSkiaUuid) ||
        !imageUuidEquals(api, native_locale_contract::kApiUuid) ||
        !matchesCode(api, native_locale_contract::kActiveLocaleEntryOffset,
                     native_locale_contract::kActiveLocaleEntryBytes) ||
        !matchesCode(extension, native_locale_contract::kActiveLocaleCallOffset,
                     native_locale_contract::kActiveLocaleCallBytes) ||
        !matchesCode(extension, native_locale_contract::kActiveLocaleStubOffset,
                     native_locale_contract::kActiveLocaleStubBytes) ||
        !matchesCode(core, e4_contract::kCoreGetPathCallOffset,
                     e4_contract::kCoreGetPathCallBytes) ||
        !matchesCode(extension, e4_contract::kExtensionGetPathCallOffset,
                     e4_contract::kExtensionGetPathCallBytes) ||
        !matchesCode(extension, e4_contract::kSetupGetPathCallOffset,
                     e4_contract::kSetupGetPathCallBytes) ||
        !matchesCode(extension, e4_contract::kViewportGetPathCallOffset,
                     e4_contract::kViewportGetPathCallBytes) ||
        !matchesCode(extension, e4_contract::kViewportFpsGetPathCallOffset,
                     e4_contract::kViewportFpsGetPathCallBytes) ||
        findMachOSymbol(api, native_locale_contract::kActiveLocaleSymbol) !=
            imageAddress(api, native_locale_contract::kActiveLocaleEntryOffset) ||
        !matchesCode(extension, observer_contract::kMeasureWindowOffset,
                     observer_contract::kMeasureWindow) ||
        !matchesCode(extension, observer_contract::kDrawWindowOffset,
                     observer_contract::kDrawWindow) ||
        !matchesCode(extension, observer_contract::kClosureEntryOffset,
                     observer_contract::kClosureEntry) ||
        !matchesCode(extension, observer_contract::kMeasureOwnerLoadOffset,
                     observer_contract::kMeasureOwnerLoad) ||
        !matchesCode(core, e4_contract::kMakeScalableFontOffset,
                     e4_contract::kMakeScalableFontBytes) ||
        !matchesCode(skia, e4_contract::kTypefaceOffset, e4_contract::kTypefaceBytes) ||
        !matchesCode(skia, e4_contract::kGetCTFontOffset, e4_contract::kGetCTFontBytes) ||
        !matchesCode(skia, e4_contract::kGlyphOffset, e4_contract::kGlyphBytes) ||
        !matchesCode(skia, e4_contract::kGetPathOffset, e4_contract::kGetPathBytes) ||
        !matchesCode(skia, contract::kSetSizeOffset, contract::kSetSizeBytes) ||
        findMachOSymbol(extension, observer_contract::kPaintNodeTextSymbol) !=
            imageAddress(extension, observer_contract::kPaintNodeTextOffset) ||
        findMachOSymbol(extension, observer_contract::kTimelineClosureSymbol) !=
            imageAddress(extension, observer_contract::kTimelineClosureOffset) ||
        !symbolAt(core, e4_contract::kMakeScalableFontSymbol,
                  e4_contract::kMakeScalableFontOffset) ||
        !symbolAt(skia, e4_contract::kMakeTypefaceSymbol, e4_contract::kTypefaceOffset) ||
        !symbolAt(skia, e4_contract::kGetCTFontSymbol, e4_contract::kGetCTFontOffset) ||
        !symbolAt(skia, e4_contract::kGlyphSymbol, e4_contract::kGlyphOffset) ||
        !symbolAt(skia, e4_contract::kGetPathSymbol, e4_contract::kGetPathOffset) ||
        !symbolAt(skia, contract::kSetSizeSymbol, contract::kSetSizeOffset)) {
        return false;
    }
    if (findMachOSymbol(skia, observer_contract::kMeasureSymbol) !=
            imageAddress(skia, observer_contract::kMeasureSymbolOffset) ||
        findMachOSymbol(skia, observer_contract::kDrawSymbol) !=
            imageAddress(skia, observer_contract::kDrawSymbolOffset)) return false;
    gCoreImage = core;
    gExtensionImage = extension;
    gSkiaImage = skia;
    gApiImage = api;
    gGlyph = reinterpret_cast<GlyphLookup>(imageAddress(skia, e4_contract::kGlyphOffset));
    gSetSize = reinterpret_cast<SetSize>(imageAddress(skia, contract::kSetSizeOffset));
    if (gGlyph == nullptr || gSetSize == nullptr || !verifyViewportProbe(extension) ||
        !exactSkiaOriginalBindings()) return false;
    return exactNativeLocaleRuntimeBinding(api, extension);
#endif
}
bool readSelf(const void *source, std::size_t size, void *destination) noexcept
{
    if (source == nullptr || destination == nullptr || size == 0 ||
        size > cavalry_i18n::mac_timeline::kMaxTextBytes) return false;
    const auto sourceAddress = reinterpret_cast<std::uintptr_t>(source);
    if (sourceAddress > std::numeric_limits<std::uintptr_t>::max() - size) return false;
    mach_vm_size_t copied = 0;
    const auto result = mach_vm_read_overwrite(
        mach_task_self(),
        static_cast<mach_vm_address_t>(sourceAddress),
        static_cast<mach_vm_size_t>(size),
        static_cast<mach_vm_address_t>(reinterpret_cast<std::uintptr_t>(destination)),
        &copied);
    return result == KERN_SUCCESS && copied == size;
}

bool addOffset(const void *base, std::uintptr_t offset, const void **output) noexcept
{
    const auto address = reinterpret_cast<std::uintptr_t>(base);
    if (base == nullptr || output == nullptr ||
        address > std::numeric_limits<std::uintptr_t>::max() - offset) return false;
    *output = reinterpret_cast<const void *>(address + offset);
    return true;
}

#include "native_font_owner_snapshot.inc"

const char *localeIdentifier(Locale locale) noexcept
{
    switch (locale) {
        case Locale::Hans: return "zh-Hans";
        case Locale::Hant: return "zh-Hant";
        case Locale::Japanese: return "ja";
        case Locale::Unset: break;
    }
    return nullptr;
}

bool readFontSnapshot(const void *font, FontSnapshot *output) noexcept
{
    if (font == nullptr || output == nullptr ||
        !readSelf(font, sizeof(output->font), output->font.storage.data())) return false;
    std::memcpy(&output->typeface, output->font.storage.data(), sizeof(output->typeface));
    std::memcpy(&output->size,
                output->font.storage.data() + policy::kFontSizeOffset, sizeof(output->size));
    return output->typeface != nullptr;
}

bool numberForTrait(CFDictionaryRef dictionary, CFStringRef key,
                    std::uint64_t *bits) noexcept
{
    if (dictionary == nullptr || key == nullptr || bits == nullptr) return false;
    const void *raw = CFDictionaryGetValue(dictionary, key);
    double value = 0.0;
    if (raw != nullptr) {
        if (CFGetTypeID(raw) != CFNumberGetTypeID() ||
            !CFNumberGetValue(static_cast<CFNumberRef>(raw), kCFNumberDoubleType, &value) ||
            !std::isfinite(value)) return false;
    }
    std::memcpy(bits, &value, sizeof(value));
    return true;
}

bool fontTraits(CTFontRef font, FontTraits *output) noexcept
{
    if (font == nullptr || output == nullptr) return false;
    CFDictionaryOwner dictionary(CTFontCopyTraits(font));
    if (dictionary.get() == nullptr) return false;
    FontTraits traits{};
    traits.symbolic = static_cast<std::uint32_t>(CTFontGetSymbolicTraits(font));
    if (!numberForTrait(dictionary.get(), kCTFontWeightTrait, &traits.weightBits) ||
        !numberForTrait(dictionary.get(), kCTFontWidthTrait, &traits.widthBits) ||
        !numberForTrait(dictionary.get(), kCTFontSlantTrait, &traits.slantBits)) return false;
    *output = traits;
    return true;
}

bool makeKeyForFont(CTFontRef font, Locale locale, Caller caller,
                    FontKey *output) noexcept
{
    if (font == nullptr || output == nullptr) return false;
    CFStringOwner name(CTFontCopyPostScriptName(font));
    if (name.get() == nullptr) return false;
    char postScriptName[policy::kPostScriptNameBytes]{};
    if (!CFStringGetCString(name.get(), postScriptName, sizeof(postScriptName),
                            kCFStringEncodingUTF8)) return false;
    FontTraits traits{};
    if (!fontTraits(font, &traits)) return false;
    return policy::makeFontKey(postScriptName, traits.symbolic,
        traits.weightBits, traits.widthBits, traits.slantBits,
        locale, caller, output);
}

bool sameFontIdentity(CTFontRef left, CTFontRef right) noexcept
{
    if (left == nullptr || right == nullptr) return false;
    CFStringOwner leftName(CTFontCopyPostScriptName(left));
    CFStringOwner rightName(CTFontCopyPostScriptName(right));
    if (leftName.get() == nullptr || rightName.get() == nullptr ||
        !CFEqual(leftName.get(), rightName.get())) return false;
    FontTraits leftTraits{};
    FontTraits rightTraits{};
    return fontTraits(left, &leftTraits) && fontTraits(right, &rightTraits) &&
           policy::sameFontTraits(leftTraits, rightTraits);
}
CFStringRef makeLanguageString(Locale locale) noexcept
{
    const char *identifier = localeIdentifier(locale);
    return identifier == nullptr ? nullptr : CFStringCreateWithCString(
        kCFAllocatorDefault, identifier, kCFStringEncodingUTF8);
}
CFStringRef makeOwnerString(const TextSnapshot &snapshot) noexcept
{
    return CFStringCreateWithBytes(kCFAllocatorDefault, snapshot.bytes.data(),
        static_cast<CFIndex>(snapshot.size), kCFStringEncodingUTF8, false);
}
FontSlot *findOrCreateSlot(const FontKey &key, CTFontRef resolvedFont,
                           const FontSnapshot &input,
                           DecisionReason *failure) noexcept
{
    for (std::size_t index = 0; index < gSlotCount; ++index) {
        if (policy::sameFontKey(gSlots[index].key, key)) {
            if (!gSlots[index].ready && failure != nullptr) *failure = gSlots[index].failure;
            return gSlots[index].ready ? &gSlots[index] : nullptr;
        }
    }
    if (gSlotCount == gSlots.size()) {
        if (failure != nullptr) *failure = DecisionReason::CacheFull;
        return nullptr;
    }
    FontSlot &slot = gSlots[gSlotCount++];
    slot.key = key;
    slot.failure = DecisionReason::FactoryFailed;
    CTFontOwner seedFont(CTFontCreateCopyWithAttributes(
        resolvedFont, static_cast<CGFloat>(contract::kFactorySeedSize), nullptr, nullptr));
    if (seedFont.get() == nullptr || !sameFontIdentity(resolvedFont, seedFont.get())) {
        slot.failure = DecisionReason::FactoryFailed;
        if (failure != nullptr) *failure = slot.failure;
        return nullptr;
    }
#if defined(__x86_64__)
    if (gMakeTypeface == nullptr || gGetCTFont == nullptr || gMakeFont == nullptr) {
        slot.failure = DecisionReason::FactoryFailed;
        if (failure != nullptr) *failure = slot.failure;
        return nullptr;
    }
    SkSpTypefaceAbi typefaceOwner = gMakeTypeface(seedFont.get());
    if (typefaceOwner.pointer == nullptr ||
        !sameFontIdentity(resolvedFont, gGetCTFont(typefaceOwner.pointer))) {
#else
    const auto makeTypeface = reinterpret_cast<MakeTypeface>(
        imageAddress(gSkiaImage, e4_contract::kTypefaceOffset));
    const auto getCTFont = reinterpret_cast<GetCTFont>(
        imageAddress(gSkiaImage, e4_contract::kGetCTFontOffset));
    const auto makeFont = reinterpret_cast<MakeFont>(
        imageAddress(gCoreImage, e4_contract::kMakeScalableFontOffset));
    SkSpTypefaceAbi typefaceOwner = makeTypeface(seedFont.get());
    if (typefaceOwner.pointer == nullptr ||
        !sameFontIdentity(resolvedFont, getCTFont(typefaceOwner.pointer))) {
#endif
        slot.failure = DecisionReason::FactoryFailed;
        if (failure != nullptr) *failure = slot.failure;
        return nullptr;
    }
    // 只保存真实factory返回的SkFont及其内部true owner；它们进程期不析构、不伪造refcount。
#if defined(__x86_64__)
    SkFontAbi factoryResult = gMakeFont(std::move(typefaceOwner), contract::kFactorySeedSize);
#else
    SkFontAbi factoryResult = makeFont(std::move(typefaceOwner), contract::kFactorySeedSize);
#endif
    SkFontAbi *font = new (std::nothrow) SkFontAbi(std::move(factoryResult));
    if (font == nullptr) {
        slot.failure = DecisionReason::FactoryFailed;
        if (failure != nullptr) *failure = slot.failure;
        return nullptr;
    }
    const void *slotTypeface = nullptr;
    std::memcpy(&slotTypeface, font->storage.data(), sizeof(slotTypeface));
    if (slotTypeface == nullptr) {
        slot.failure = DecisionReason::FactoryFailed;
        if (failure != nullptr) *failure = slot.failure;
        return nullptr;
    }
    if (!policy::sameFontStyle(font->storage.data(), input.font.storage.data())) {
        slot.font = font;
        slot.typeface = slotTypeface;
        slot.failure = DecisionReason::StyleMismatch;
        if (failure != nullptr) *failure = slot.failure;
        return nullptr;
    }
    slot.font = font;
    slot.typeface = slotTypeface;
    slot.ready = true;
    return &slot;
}

#include "shared_verified_text_fallback.inc"
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
#include "dependency_node_font_adapter.inc"
#endif
#include "viewport_font_adapter.inc"
#include "timeline_font_adapter.inc"
#include "getpath_font_adapter.inc"
#include "welcome_log_it_adapter.inc"
#include "welcome_log_it_runtime.inc"

MeasureOriginal requireMeasureOriginal() noexcept
{
    auto original = gOriginalMeasure.load(std::memory_order_acquire);
    if (original == nullptr && resolveOriginals())
        original = gOriginalMeasure.load(std::memory_order_acquire);
    if (original == nullptr) std::abort();
    return original;
}

DrawOriginal requireDrawOriginal() noexcept
{
    auto original = gOriginalDraw.load(std::memory_order_acquire);
    if (original == nullptr && resolveOriginals())
        original = gOriginalDraw.load(std::memory_order_acquire);
    if (original == nullptr) std::abort();
    return original;
}

__attribute__((constructor)) void initializeSystemFallback() noexcept
{
    // -- 原函数先绑定；每个功能按自己的架构合同发布独立准入门 ------------
    (void)resolveOriginals();
    (void)resolveNativeLocaleOriginal();
#if defined(__x86_64__)
    gNativeLocaleContractReady.store(
        verifyNativeLocaleRuntimeContract(), std::memory_order_release);
    gFontContractReady.store(verifyContract(), std::memory_order_release);
#else
    gNativeLocaleContractReady.store(verifyContract(), std::memory_order_release);
#endif
    gTitleFormatContractReady.store(verifyTitleFormatContract(), std::memory_order_release);
    (void)verifyHelpDescriptionContract();
    (void)verifyGuideBodyContract();
    (void)verifyEasingMenuContract();
    (void)verifySaveSceneCaptionContract();
    (void)verifyWelcomeLogItContract();
    native_demo_reader::gContractReady.store(
        verifyDemoReaderContract(), std::memory_order_release);
}

__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} measureInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(timelineMeasureVeneer),
    reinterpret_cast<const void *>(measureTarget)
};
__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} drawInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(timelineDrawVeneer),
    reinterpret_cast<const void *>(drawTarget)
};
__attribute__((used)) static struct { const void *replacement; const void *replacee; }
blobInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(viewport_blob::viewportBlobVeneer), reinterpret_cast<const void *>(blobTarget)
};
__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} nativeLocaleInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(nativeActiveLocaleInterpose),
    reinterpret_cast<const void *>(activeLocaleTarget)
};
__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} titleVformatInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(nativeTitleVformatInterpose),
    reinterpret_cast<const void *>(titleFormatVformatTarget)
};
__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} helpDocumentationInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(nativeHelpDocumentationInterpose),
    reinterpret_cast<const void *>(helpDocumentationEntryTarget)
};
__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} getPathInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(getPathFontVeneer),
    reinterpret_cast<const void *>(getPathTarget)
};
} // namespace

#include "demo_reader_runtime.inc"

extern "C" __attribute__((noinline)) DemoTextFromFileResult nativeDemoTextFromFileInterpose(
    const std::string &path)
{
    const std::uintptr_t callerReturnPc = reinterpret_cast<std::uintptr_t>(
        __builtin_return_address(0));
    const bool exactCaller = native_demo_reader::exactPresetCaller(callerReturnPc);
    std::size_t fileIndex = 0;
    const bool exactPath = exactCaller &&
        native_demo_reader::exactPresetFileIndex(path, &fileIndex);
    return native_demo_reader::forwardOnce(
        [&]() { return requireDemoTextFromFileOriginal()(path); },
        exactCaller, exactPath,
        []() noexcept { return gLocale.value(); },
        [&](std::string_view source, auto &&localeGetter, std::string *output) {
            return native_demo_reader::projectVerifiedSource(
                fileIndex, source,
                std::forward<decltype(localeGetter)>(localeGetter), output);
        });
}

extern "C" __attribute__((noinline)) std::string nativeActiveLocaleInterpose(Api *api)
{
    const std::uintptr_t callerPc = reinterpret_cast<std::uintptr_t>(
        __builtin_return_address(0));
    NativeLocaleGetter original = gOriginalNativeLocale.load(std::memory_order_acquire);
    if (original == nullptr) original = resolveNativeLocaleOriginal();
    if (original == nullptr) std::abort();

    // -- 每次仅调用原getter一次；原异常原样传播 -----------------------------
    const bool exactOwner = exactNativeLocaleOwner(callerPc);
    std::string result = native_locale::forwardNativeLocale(
        api, original, exactOwner, gLocale);
#if defined(__x86_64__)
    if (exactOwner && gFontContractReady.load(std::memory_order_acquire)) {
#else
    if (exactOwner) {
#endif
        Locale policyLocale{};
        if (policyLocaleFor(gLocale.value(), &policyLocale))
            gAdmitted.store(true, std::memory_order_release);
    }
    return result;
}

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
#include "skia_text_dispatch_281.inc"
#else
extern "C" float timelineMeasureDispatch(
    const void *font, const void *text, std::size_t length, int encoding,
    const void *bounds, const void *paint, const void *closure,
    std::uintptr_t callerPc) noexcept
{
    const MeasureOriginal original = requireMeasureOriginal();
    if (viewport_owner::measureCaller(callerPc - reinterpret_cast<std::uintptr_t>(imageAddress(gExtensionImage,0))))
        return dispatchViewportFont(font,text,length,encoding,callerPc,reinterpret_cast<std::uintptr_t>(__builtin_frame_address(0)),true,Caller::Measure,
            [&](const void *displayFont) { return original(displayFont,text,length,encoding,bounds,paint); });
    return dispatchFont(font, text, length, encoding, closure, callerPc, Caller::Measure,
        [&](const void *displayFont) {
            return original(displayFont, text, length, encoding, bounds, paint);
        });
}

extern "C" void timelineDrawDispatch(
    const void *canvas, const void *text, std::size_t length, int encoding,
    float x, float y, const void *font, const void *paint,
    const void *closure, std::uintptr_t callerPc) noexcept
{
    const DrawOriginal original = requireDrawOriginal();
    dispatchFont(font, text, length, encoding, closure, callerPc, Caller::Draw,
        [&](const void *displayFont) {
            original(canvas, text, length, encoding, x, y, displayFont, paint);
        });
}
#endif

extern "C" viewport_blob::BlobResultAbi viewport_blob::viewportBlobDispatch(
    const void *text,std::size_t length,const void *font,int encoding,
    std::uintptr_t callerPc,std::uintptr_t callerFrame) noexcept {
    auto original=gOriginalBlob.load(std::memory_order_acquire);
    if(original==nullptr && resolveOriginals()) original=gOriginalBlob.load(std::memory_order_acquire);
    if(original==nullptr) std::abort();
    return dispatchViewportFont(font,text,length,encoding,callerPc,callerFrame,false,Caller::Draw,
        [&](const void *displayFont) { return original(text,length,displayFont,encoding); });
}

#include "title_format_adapter.inc"
#include "help_description_runtime.inc"
#include "guide_body_runtime.inc"
#include "easing_menu_runtime.inc"
#include "save_scene_caption_runtime.inc"

extern "C" __attribute__((noinline, visibility("hidden")))
void nativeWelcomeLogItDispatcher(void *logger, const void *message,
                                  bool logEnabled, bool tracebackEnabled,
                                  std::uintptr_t callerPc)
{
    const welcome_log_it::Original original = &welcomeLogItTarget;
    welcome_log_it::forward(
        original, logger, message, logEnabled, tracebackEnabled, callerPc,
        nativeWelcomeLogItExpectedReturnPc.load(std::memory_order_acquire),
        gLocale.value());
}

