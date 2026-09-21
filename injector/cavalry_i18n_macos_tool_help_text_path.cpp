/**
 * [INPUT]: 依赖共享 macos_abi 映像/字体解析与 Cavalry 2.7.2 的 libExtensionLayer/libCore/libskia 双 slice UUID、机器码包络、Mach-O 符号表与 Skia 字体/Path ABI
 * [OUTPUT]: 对外提供仅命中五条 TransformTool action 的 CJK Path 投影、逐 source 原子成功/回退计数及版本化只读 C ABI 快照；快捷键 prefix、未知 caller、ABI 漂移与渲染失败全部转发英文原路径
 * [POS]: injector 的 macOS 自绘文字适配器；以进程级 SkTextUtils::GetPath interpose 承接调用，但用三层 return-address 与逐 image 合同把有效范围收敛到唯一 action producer
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_macos_tool_help_text_path.h"
#include "cavalry_i18n_macos_abi.h"

#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/nlist.h>
#include <uuid/uuid.h>

#include <array>
#include <atomic>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <new>
#include <utility>

namespace {

using namespace cavalry_i18n::macos_abi;

using GetPathFunction =
    void (*)(const void *, std::size_t, int, float, float, const void *, void *);

using MakeTypefaceFunction = SkSpTypefaceAbi (*)(const char *, std::uint32_t);
using MakeScalableFontFunction = SkFontAbi (*)(SkSpTypefaceAbi, float);
using UnicharToGlyphFunction = std::uint16_t (*)(const void *, std::int32_t);
using SetFontSizeFunction = void (*)(void *, float);
using PathIsEmptyFunction = bool (*)(const void *);

constexpr std::uint64_t kAllSourceBits = 0x1f;
constexpr std::size_t kActionCount =
    cavalry_i18n::kMacToolHelpActionCount;
constexpr std::size_t kTranslationCapacity = 128;
constexpr std::uint32_t kNormalSkFontStyle = 0x00050190u;

struct ApprovedAction {
    const char *source;
    std::uint64_t sourceBit;
};

constexpr ApprovedAction kApprovedActions[kActionCount] = {
    {"Insert Keyframe", 1ull << 0},
    {"Direct Layer Selection", 1ull << 1},
    {"Play/ Stop", 1ull << 2},
    {"Pan", 1ull << 3},
    {"Enable Snapping", 1ull << 4},
};

struct ConfiguredAction {
    const char *source;
    std::uint64_t sourceBit;
    std::size_t translationSize;
    char translation[kTranslationCapacity];
};

struct RuntimeState {
    std::atomic<GetPathFunction> originalGetPath{nullptr};
    std::atomic<bool> configured{false};
    std::atomic<bool> vendorContractVerified{false};
    std::atomic<bool> rendererReady{false};

    ConfiguredAction actions[kActionCount]{};
    SkFontAbi *displayFont = nullptr;
    SetFontSizeFunction setFontSize = nullptr;
    PathIsEmptyFunction pathIsEmpty = nullptr;

    LoadedImage extensionImage{};
    LoadedImage coreImage{};
    LoadedImage skiaImage{};

    std::atomic<std::uint64_t> canonicalCalls{0};
    std::atomic<std::uint64_t> whitelistCalls{0};
    std::atomic<std::uint64_t> cjkPathSuccess{0};
    std::atomic<std::uint64_t> originalFallback{0};
    std::atomic<std::uint64_t> rendererFailure{0};
    std::atomic<std::uint64_t> translatedSourceMask{0};
    std::atomic<std::uint64_t> fallbackSourceMask{0};
    std::atomic<std::uint64_t> translatedSourceCalls[kActionCount]{};
    std::atomic<std::uint64_t> fallbackSourceCalls[kActionCount]{};
};

RuntimeState gState;
thread_local bool recursionActive = false;

/* -----------------------------------------------------------------------
 * Mach-O image + symbol recovery
 *
 * 静态 __interpose 生效后，RTLD_NEXT 会重新返回 replacement 本身。原函数必须从
 * 已加载 libskia 的 __LINKEDIT 符号表恢复；这个入口即使 UUID 漂移也能转发原文，
 * 而翻译能力则继续要求完整 UUID、地址和机器码合同。
 * ----------------------------------------------------------------------- */
GetPathFunction resolveOriginalGetPath() noexcept
{
    GetPathFunction original = gState.originalGetPath.load(std::memory_order_acquire);
    if (original != nullptr) {
        return original;
    }

    LoadedImage skia{};
    if (!findLoadedImage("libskia.dylib", &skia)) {
        return nullptr;
    }
    original = reinterpret_cast<GetPathFunction>(findMachOSymbol(
        skia,
        "__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath"));
    if (original != nullptr) {
        gState.skiaImage = skia;
        gState.originalGetPath.store(original, std::memory_order_release);
    }
    return original;
}

/* -----------------------------------------------------------------------
 * Cavalry 2.7.2 双 slice 不可变合同
 * ----------------------------------------------------------------------- */
#if defined(__arm64__)
constexpr char kExtensionUuid[] = "9A99CECD-995B-34D6-B089-6A19093A35B1";
constexpr char kCoreUuid[] = "78BAF3D2-2FEA-3189-A62B-24F20318AB28";
constexpr char kSkiaUuid[] = "2BAE604B-4AEE-3007-B6C3-4369789BBCB0";
constexpr std::uintptr_t kCoreGetPathReturn = 0x66d74;
constexpr std::uintptr_t kExtensionMakePathReturn = 0x180150;
constexpr std::uintptr_t kExtensionActionReturn = 0x17602c;
constexpr std::uintptr_t kMakeScalableFontOffset = 0x9ae6c;
constexpr std::uintptr_t kGetPathOffset = 0x1457cc;
constexpr std::uintptr_t kMakeTypefaceOffset = 0xed998;
constexpr std::uintptr_t kUnicharToGlyphOffset = 0xee500;
constexpr std::uintptr_t kSetFontSizeOffset = 0x4dd48;
constexpr std::uintptr_t kPathIsEmptyOffset = 0x8ce90;
constexpr std::array<std::uint8_t, 16> kCoreGetPathCall = {
    0xA3, 0xE3, 0x00, 0xD1, 0xE4, 0xC3, 0x00, 0x91,
    0x02, 0x00, 0x80, 0x52, 0xE0, 0x24, 0x27, 0x94,
};
constexpr std::array<std::uint8_t, 20> kExtensionMakePathCall = {
    0xE8, 0x03, 0x13, 0xAA, 0xE0, 0x03, 0x15, 0xAA, 0x00, 0x41,
    0x60, 0x1E, 0x2B, 0x96, 0x28, 0x94, 0xE8, 0xC3, 0x00, 0x91,
};
constexpr std::array<std::uint8_t, 20> kExtensionActionCall = {
    0xE8, 0x03, 0x00, 0x91, 0x00, 0x10, 0x65, 0x1E, 0xE1, 0x03,
    0x16, 0xAA, 0xE2, 0x03, 0x15, 0xAA, 0xE4, 0x27, 0x00, 0x94,
};
constexpr std::uintptr_t kCoreGetPathCallOffset = 0x66d64;
constexpr std::uintptr_t kExtensionMakePathCallOffset = 0x180140;
constexpr std::uintptr_t kExtensionActionCallOffset = 0x176018;
#elif defined(__x86_64__)
constexpr char kExtensionUuid[] = "C48EFBA5-24C5-318E-B7CD-FC39A6A01FF8";
constexpr char kCoreUuid[] = "191E0980-9810-3A85-BAE0-9FBE90F321F9";
constexpr char kSkiaUuid[] = "CD1F93AE-42B7-3105-AEB5-8EBF88FE2C7B";
constexpr std::uintptr_t kCoreGetPathReturn = 0x75ed8;
constexpr std::uintptr_t kExtensionMakePathReturn = 0x1aa18e;
constexpr std::uintptr_t kExtensionActionReturn = 0x19ddbd;
constexpr std::uintptr_t kMakeScalableFontOffset = 0xb12f0;
constexpr std::uintptr_t kGetPathOffset = 0x16f3f0;
constexpr std::uintptr_t kMakeTypefaceOffset = 0x10e1c0;
constexpr std::uintptr_t kUnicharToGlyphOffset = 0x10ed70;
constexpr std::uintptr_t kSetFontSizeOffset = 0x55b70;
constexpr std::uintptr_t kPathIsEmptyOffset = 0xa6750;
constexpr std::array<std::uint8_t, 24> kCoreGetPathCall = {
    0x48, 0x8D, 0x4D, 0xB0, 0x4C, 0x8D, 0x45, 0xD8,
    0x0F, 0x57, 0xC0, 0x0F, 0x57, 0xC9, 0x4C, 0x89,
    0xF7, 0x31, 0xD2, 0xE8, 0x6E, 0xEC, 0xB6, 0x00,
};
constexpr std::array<std::uint8_t, 16> kExtensionMakePathCall = {
    0x48, 0x89, 0xDF, 0x4C, 0x89, 0xF6, 0xF2, 0x0F,
    0x10, 0x45, 0x98, 0xE8, 0x03, 0x5E, 0xB8, 0x00,
};
constexpr std::array<std::uint8_t, 25> kExtensionActionCall = {
    0x4C, 0x89, 0xE3, 0x4C, 0x89, 0xE7, 0x4C, 0x89, 0xF2,
    0xF2, 0x0F, 0x10, 0x05, 0x1B, 0x0F, 0xBA, 0x00, 0x4C,
    0x89, 0xE9, 0xE8, 0x23, 0xC2, 0x00, 0x00,
};
constexpr std::uintptr_t kCoreGetPathCallOffset = 0x75ec0;
constexpr std::uintptr_t kExtensionMakePathCallOffset = 0x1aa17e;
constexpr std::uintptr_t kExtensionActionCallOffset = 0x19dda4;
#endif

bool verifyVendorContract() noexcept
{
    LoadedImage extension{};
    LoadedImage core{};
    LoadedImage skia{};
    if (!findLoadedImage("libExtensionLayer.dylib", &extension) ||
        !findLoadedImage("libCore.dylib", &core) ||
        !findLoadedImage("libskia.dylib", &skia)) {
        return false;
    }

    GetPathFunction original = reinterpret_cast<GetPathFunction>(findMachOSymbol(
        skia,
        "__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath"));
    if (original == nullptr) {
        return false;
    }
    gState.originalGetPath.store(original, std::memory_order_release);

    if (!imageUuidEquals(extension, kExtensionUuid) ||
        !imageUuidEquals(core, kCoreUuid) ||
        !imageUuidEquals(skia, kSkiaUuid) ||
        original != reinterpret_cast<GetPathFunction>(imageAddress(skia, kGetPathOffset)) ||
        !matchesCode(core, kCoreGetPathCallOffset, kCoreGetPathCall) ||
        !matchesCode(extension, kExtensionMakePathCallOffset, kExtensionMakePathCall) ||
        !matchesCode(extension, kExtensionActionCallOffset, kExtensionActionCall)) {
        return false;
    }

    gState.extensionImage = extension;
    gState.coreImage = core;
    gState.skiaImage = skia;
    return true;
}

bool decodeNextUtf8(
    const char *text,
    std::size_t size,
    std::size_t *offset,
    std::int32_t *codepoint) noexcept
{
    if (text == nullptr || offset == nullptr || codepoint == nullptr || *offset >= size) {
        return false;
    }
    const auto *bytes = reinterpret_cast<const std::uint8_t *>(text);
    const std::uint8_t first = bytes[(*offset)++];
    if (first < 0x80) {
        *codepoint = first;
        return true;
    }

    int continuationCount = 0;
    std::int32_t value = 0;
    if ((first & 0xE0) == 0xC0) {
        continuationCount = 1;
        value = first & 0x1F;
    } else if ((first & 0xF0) == 0xE0) {
        continuationCount = 2;
        value = first & 0x0F;
    } else if ((first & 0xF8) == 0xF0) {
        continuationCount = 3;
        value = first & 0x07;
    } else {
        return false;
    }

    for (int index = 0; index < continuationCount; ++index) {
        if (*offset >= size || (bytes[*offset] & 0xC0) != 0x80) {
            return false;
        }
        value = (value << 6) | (bytes[(*offset)++] & 0x3F);
    }
    *codepoint = value;
    return value <= 0x10FFFF && !(value >= 0xD800 && value <= 0xDFFF);
}

bool fontCoversTranslations(
    void *typeface,
    UnicharToGlyphFunction unicharToGlyph) noexcept
{
    if (typeface == nullptr || unicharToGlyph == nullptr) {
        return false;
    }
    for (const ConfiguredAction &action : gState.actions) {
        std::size_t offset = 0;
        while (offset < action.translationSize) {
            std::int32_t codepoint = 0;
            if (!decodeNextUtf8(
                    action.translation,
                    action.translationSize,
                    &offset,
                    &codepoint)) {
                return false;
            }
            if (codepoint > 0x20 && unicharToGlyph(typeface, codepoint) == 0) {
                return false;
            }
        }
    }
    return true;
}

bool buildDisplayFont(const char *language) noexcept
{
    const char *family = nullptr;
    if (std::strcmp(language, "zh-Hans") == 0) {
        family = "PingFang SC";
    } else if (std::strcmp(language, "zh-Hant") == 0) {
        family = "PingFang TC";
    } else if (std::strcmp(language, "ja_JP") == 0) {
        family = "Hiragino Sans";
    }
    if (family == nullptr) {
        return false;
    }

    auto makeTypeface = reinterpret_cast<MakeTypefaceFunction>(
        findMachOSymbol(gState.skiaImage, "__ZN10SkTypeface12MakeFromNameEPKc11SkFontStyle"));
    auto makeScalableFont = reinterpret_cast<MakeScalableFontFunction>(
        findMachOSymbol(
            gState.coreImage,
            "__ZN7cavalry16MakeScalableFontE5sk_spI10SkTypefaceEf"));
    auto unicharToGlyph = reinterpret_cast<UnicharToGlyphFunction>(
        findMachOSymbol(gState.skiaImage, "__ZNK10SkTypeface14unicharToGlyphEi"));
    auto setFontSize = reinterpret_cast<SetFontSizeFunction>(
        findMachOSymbol(gState.skiaImage, "__ZN6SkFont7setSizeEf"));
    auto pathIsEmpty = reinterpret_cast<PathIsEmptyFunction>(
        findMachOSymbol(gState.skiaImage, "__ZNK6SkPath7isEmptyEv"));

    if (makeTypeface != reinterpret_cast<MakeTypefaceFunction>(
            imageAddress(gState.skiaImage, kMakeTypefaceOffset)) ||
        makeScalableFont != reinterpret_cast<MakeScalableFontFunction>(
            imageAddress(gState.coreImage, kMakeScalableFontOffset)) ||
        unicharToGlyph != reinterpret_cast<UnicharToGlyphFunction>(
            imageAddress(gState.skiaImage, kUnicharToGlyphOffset)) ||
        setFontSize != reinterpret_cast<SetFontSizeFunction>(
            imageAddress(gState.skiaImage, kSetFontSizeOffset)) ||
        pathIsEmpty != reinterpret_cast<PathIsEmptyFunction>(
            imageAddress(gState.skiaImage, kPathIsEmptyOffset))) {
        return false;
    }

    SkSpTypefaceAbi typeface = makeTypeface(family, kNormalSkFontStyle);
    if (typeface.pointer == nullptr ||
        !fontCoversTranslations(typeface.pointer, unicharToGlyph)) {
        return false;
    }

    SkFontAbi font = makeScalableFont(std::move(typeface), 1.0f);
    auto *persistentFont = new (std::nothrow) SkFontAbi(std::move(font));
    if (persistentFont == nullptr) {
        return false;
    }

    gState.displayFont = persistentFont;
    gState.setFontSize = setFontSize;
    gState.pathIsEmpty = pathIsEmpty;
    return true;
}

const ConfiguredAction *configuredActionFor(
    const void *text,
    std::size_t size) noexcept
{
    if (text == nullptr) {
        return nullptr;
    }
    for (const ConfiguredAction &action : gState.actions) {
        const std::size_t sourceSize = std::strlen(action.source);
        if (size == sourceSize && std::memcmp(text, action.source, size) == 0) {
            return &action;
        }
    }
    return nullptr;
}

bool callerChainMatches(void *return0, void *return1, void *return2) noexcept
{
    return return0 == imageAddress(gState.coreImage, kCoreGetPathReturn) &&
        return1 == imageAddress(gState.extensionImage, kExtensionMakePathReturn) &&
        return2 == imageAddress(gState.extensionImage, kExtensionActionReturn);
}

void recordFallback(const ConfiguredAction &action) noexcept
{
    const std::size_t actionIndex =
        static_cast<std::size_t>(&action - gState.actions);
    gState.originalFallback.fetch_add(1, std::memory_order_relaxed);
    gState.fallbackSourceMask.fetch_or(action.sourceBit, std::memory_order_relaxed);
    gState.fallbackSourceCalls[actionIndex].fetch_add(
        1,
        std::memory_order_relaxed);
}

} // namespace

namespace cavalry_i18n {

void configureMacToolHelpTextPath(
    const char *language,
    const MacToolHelpTextPathTranslation *translations,
    std::size_t translationCount) noexcept
{
    if (language == nullptr || translations == nullptr ||
        translationCount != kActionCount ||
        gState.configured.load(std::memory_order_acquire)) {
        return;
    }

    std::uint64_t configuredMask = 0;
    for (std::size_t actionIndex = 0; actionIndex < kActionCount; ++actionIndex) {
        const ApprovedAction &approved = kApprovedActions[actionIndex];
        for (std::size_t inputIndex = 0; inputIndex < translationCount; ++inputIndex) {
            const MacToolHelpTextPathTranslation &input = translations[inputIndex];
            if (input.source == nullptr || input.translation == nullptr ||
                input.sourceBit != approved.sourceBit ||
                std::strcmp(input.source, approved.source) != 0) {
                continue;
            }
            const std::size_t translationSize = std::strlen(input.translation);
            if (translationSize == 0 || translationSize >= kTranslationCapacity) {
                return;
            }
            ConfiguredAction &output = gState.actions[actionIndex];
            output.source = approved.source;
            output.sourceBit = approved.sourceBit;
            output.translationSize = translationSize;
            std::memcpy(output.translation, input.translation, translationSize + 1);
            configuredMask |= approved.sourceBit;
            break;
        }
    }
    if (configuredMask != kAllSourceBits) {
        return;
    }

    gState.configured.store(true, std::memory_order_release);
    const bool verified = verifyVendorContract();
    gState.vendorContractVerified.store(verified, std::memory_order_release);
    if (!verified) {
        return;
    }

    const bool rendererReady = buildDisplayFont(language);
    gState.rendererReady.store(rendererReady, std::memory_order_release);
    if (!rendererReady) {
        gState.rendererFailure.fetch_add(1, std::memory_order_relaxed);
    }
}

MacToolHelpTextPathDiagnostics macToolHelpTextPathDiagnostics() noexcept
{
    MacToolHelpTextPathDiagnostics diagnostics{
        gState.configured.load(std::memory_order_acquire),
        gState.vendorContractVerified.load(std::memory_order_acquire),
        gState.rendererReady.load(std::memory_order_acquire),
        gState.canonicalCalls.load(std::memory_order_relaxed),
        gState.whitelistCalls.load(std::memory_order_relaxed),
        gState.cjkPathSuccess.load(std::memory_order_relaxed),
        gState.originalFallback.load(std::memory_order_relaxed),
        gState.rendererFailure.load(std::memory_order_relaxed),
        gState.translatedSourceMask.load(std::memory_order_relaxed),
        gState.fallbackSourceMask.load(std::memory_order_relaxed),
        {},
        {},
    };
    for (std::size_t index = 0; index < kActionCount; ++index) {
        diagnostics.translatedSourceCalls[index] =
            gState.translatedSourceCalls[index].load(std::memory_order_relaxed);
        diagnostics.fallbackSourceCalls[index] =
            gState.fallbackSourceCalls[index].load(std::memory_order_relaxed);
    }
    return diagnostics;
}

} // namespace cavalry_i18n

extern "C" bool cavalry_i18n_mac_tool_help_diagnostics_v1(
    cavalry_i18n::MacToolHelpTextPathDiagnostics *output,
    std::size_t outputSize) noexcept
{
    if (output == nullptr ||
        outputSize !=
            sizeof(cavalry_i18n::MacToolHelpTextPathDiagnostics)) {
        return false;
    }
    *output = cavalry_i18n::macToolHelpTextPathDiagnostics();
    return true;
}

extern "C" __attribute__((noinline)) void replacementSkTextUtilsGetPath(
    const void *text,
    std::size_t size,
    int encoding,
    float x,
    float y,
    const void *font,
    void *path) noexcept
{
    GetPathFunction original = resolveOriginalGetPath();
    if (original == nullptr) {
        return;
    }
    if (recursionActive) {
        original(text, size, encoding, x, y, font, path);
        return;
    }
    if (!gState.configured.load(std::memory_order_acquire)) {
        original(text, size, encoding, x, y, font, path);
        return;
    }

    const ConfiguredAction *action = configuredActionFor(text, size);
    if (action == nullptr) {
        original(text, size, encoding, x, y, font, path);
        return;
    }
    gState.whitelistCalls.fetch_add(1, std::memory_order_relaxed);

    if (!gState.vendorContractVerified.load(std::memory_order_acquire) ||
        !gState.rendererReady.load(std::memory_order_acquire) ||
        encoding != 0 || font == nullptr || path == nullptr) {
        recordFallback(*action);
        original(text, size, encoding, x, y, font, path);
        return;
    }

    void *return0 = __builtin_extract_return_addr(__builtin_return_address(0));
    void *return1 = __builtin_extract_return_addr(__builtin_return_address(1));
    void *return2 = __builtin_extract_return_addr(__builtin_return_address(2));
    if (!callerChainMatches(return0, return1, return2)) {
        recordFallback(*action);
        original(text, size, encoding, x, y, font, path);
        return;
    }
    gState.canonicalCalls.fetch_add(1, std::memory_order_relaxed);

    float fontSize = 0.0f;
    std::memcpy(
        &fontSize,
        static_cast<const std::uint8_t *>(font) + sizeof(void *),
        sizeof(fontSize));
    if (!std::isfinite(fontSize) || fontSize <= 0.0f || fontSize > 4096.0f ||
        !gState.pathIsEmpty(path)) {
        gState.rendererFailure.fetch_add(1, std::memory_order_relaxed);
        recordFallback(*action);
        original(text, size, encoding, x, y, font, path);
        return;
    }

    SkFontAbi displayFont;
    std::memcpy(
        displayFont.storage.data(),
        gState.displayFont->storage.data(),
        displayFont.storage.size());
    gState.setFontSize(&displayFont, fontSize);

    recursionActive = true;
    original(
        action->translation,
        action->translationSize,
        encoding,
        x,
        y,
        &displayFont,
        path);
    recursionActive = false;

    if (!gState.pathIsEmpty(path)) {
        const std::size_t actionIndex =
            static_cast<std::size_t>(action - gState.actions);
        gState.cjkPathSuccess.fetch_add(1, std::memory_order_relaxed);
        gState.translatedSourceMask.fetch_or(
            action->sourceBit,
            std::memory_order_relaxed);
        gState.translatedSourceCalls[actionIndex].fetch_add(
            1,
            std::memory_order_relaxed);
        return;
    }

    gState.rendererFailure.fetch_add(1, std::memory_order_relaxed);
    recordFallback(*action);
    original(text, size, encoding, x, y, font, path);
}

extern "C" void skTextUtilsGetPathInterposeTarget(
    const void *,
    std::size_t,
    int,
    float,
    float,
    const void *,
    void *)
    __asm("__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath");

__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} kSkTextUtilsGetPathInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(replacementSkTextUtilsGetPath),
    reinterpret_cast<const void *>(skTextUtilsGetPathInterposeTarget),
};
