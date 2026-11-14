/**
 * [INPUT]: 依赖GetPath FPS/Graph/cache owner、三语文本表与标题策略。
 * [OUTPUT]: 验证精确owner/文本门、75项lane、ToolHelp及单次透传。
 * [POS]: 纯合同测试；不加载App、vendor framework或candidate dylib。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "getpath_owner_adapter.h"
#include "getpath_font_texts.inc"
#include "getpath_graph_editor_empty_texts.inc"
#include "native_locale_abi_contract.h"
#include "native_locale_snapshot.h"
#include "native_image_paths.h"
#include "title_format_policy.h"
#include "title_format_abi_contract.h"
#include "verified_text_selection.h"

#include <array>
#include <cstdint>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <limits>
#include <limits.h>
#include <stdexcept>
#include <string>

#if defined(NATIVE_TITLE_FORMAT_ABI_PROBE_ONLY)
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wreturn-type-c-linkage"
extern "C" std::string fmt10VformatAbiProbeTarget(
    native_title_format_abi::FormatStringView,
    native_title_format_abi::FormatArguments)
    __asm__("__ZN3fmt3v107vformatENS0_17basic_string_viewIcEENS0_17basic_format_argsINS0_20basic_format_contextINS0_8appenderEcEEEE");
extern "C" __attribute__((noinline)) std::string titleFormatAbiProbe(
    native_title_format_abi::FormatStringView format,
    native_title_format_abi::FormatArguments arguments)
{
    return fmt10VformatAbiProbeTarget(format, arguments);
}
#pragma clang diagnostic pop
#else
namespace {
int fail(int code) { return code; }

const int kOriginalPartial = 1;
const int kOriginalFull = 2;
const int kCandidateFirstPartial = 3;
const int kCandidateSecondPartial = 4;
const int kCandidateFull = 5;
const int kCandidateControlPartial = 6;
const int kCandidateTextPartial = 7;
const int kCandidateCjkOnly = 8;

std::uint16_t fakeFontGlyph(const void *font, std::int32_t codepoint)
{
    if (font == &kOriginalFull || font == &kCandidateFull) return 1;
    if (font == &kOriginalPartial || font == &kCandidateFirstPartial)
        return codepoint == 0x4e2d ? 1 : 0;
    if (font == &kCandidateSecondPartial) return codepoint == 0x6587 ? 1 : 0;
    if (font == &kCandidateControlPartial)
        return codepoint < 0x80 || codepoint == 0x63a7 ? 1 : 0;
    if (font == &kCandidateTextPartial)
        return codepoint < 0x80 || codepoint == 0x81ea ? 1 : 0;
    if (font == &kCandidateCjkOnly)
        return codepoint >= 0x4e00 && codepoint <= 0x9fff ? 1 : 0;
    return 0;
}

bool finiteVerifiedFontCandidatesPreserveCoverageOrder()
{
    const char text[] = "中文";
    constexpr std::size_t textSize = sizeof(text) - 1;
    const void *original = &kOriginalPartial;
    std::array<std::size_t, 4> order{};
    std::size_t calls = 0;
    std::size_t selectedIndex = 0;
    viewport_font::TextDisposition disposition = viewport_font::TextDisposition::Invalid;
    const void *selected = viewport_font::selectVerifiedTextCandidates(
        original, text, textSize, 0, fakeFontGlyph, 2,
        [&](std::size_t index) noexcept -> const void * {
            order[calls++] = index;
            return index == 0 ? &kCandidateFirstPartial : &kCandidateFull;
        }, &disposition, &selectedIndex);
    if (selected != &kCandidateFull || selectedIndex != 1 || calls != 2 ||
        order[0] != 0 || order[1] != 1 ||
        disposition != viewport_font::TextDisposition::NeedsSystemFallback) return false;

    calls = 0;
    selectedIndex = 0;
    selected = viewport_font::selectVerifiedTextCandidates(
        original, text, textSize, 0, fakeFontGlyph, 2,
        [&](std::size_t index) noexcept -> const void * {
            order[calls++] = index;
            return index == 0 ? &kCandidateFirstPartial : &kCandidateSecondPartial;
        }, &disposition, &selectedIndex);
    if (selected != original || selectedIndex != 2 || calls != 2 ||
        order[0] != 0 || order[1] != 1) return false;

    calls = 0;
    selectedIndex = 0;
    selected = viewport_font::selectVerifiedTextCandidates(
        original, text, textSize, 0, fakeFontGlyph, 2,
        [&](std::size_t index) noexcept -> const void * {
            ++calls;
            return index == 0 ? nullptr : &kCandidateFull;
        }, &disposition, &selectedIndex);
    if (selected != original || selectedIndex != 2 || calls != 1) return false;

    const char ascii[] = "ASCII";
    calls = 0;
    selected = viewport_font::selectVerifiedTextCandidates(
        original, ascii, sizeof(ascii) - 1, 0, fakeFontGlyph, 2,
        [&](std::size_t) noexcept -> const void * { ++calls; return &kCandidateFull; },
        &disposition, &selectedIndex);
    if (selected != original || calls != 0 ||
        disposition != viewport_font::TextDisposition::Ascii) return false;

    selected = viewport_font::selectVerifiedTextCandidates(
        &kOriginalFull, text, textSize, 0, fakeFontGlyph, 2,
        [&](std::size_t) noexcept -> const void * { ++calls; return &kCandidateFull; },
        &disposition, &selectedIndex);
    if (selected != &kOriginalFull || calls != 0 ||
        disposition != viewport_font::TextDisposition::OriginalCovers) return false;

    constexpr const char *expectedHans[] = {"PingFangSC-Regular", "PingFangTC-Regular", "HiraginoSans-W3"};
    constexpr const char *expectedHant[] = {"PingFangTC-Regular", "PingFangSC-Regular", "HiraginoSans-W3"};
    constexpr const char *expectedJapanese[] = {"HiraginoSans-W3", "PingFangTC-Regular", "PingFangSC-Regular"};
    for (std::size_t index = 0; index < viewport_font::kNamedFallbackPostScriptNameCount; ++index) {
        if (std::strcmp(viewport_font::namedFallbackPostScriptName(
                viewport_font::Locale::Hans, index), expectedHans[index]) != 0 ||
            std::strcmp(viewport_font::namedFallbackPostScriptName(
                viewport_font::Locale::Hant, index), expectedHant[index]) != 0 ||
            std::strcmp(viewport_font::namedFallbackPostScriptName(
                viewport_font::Locale::Japanese, index), expectedJapanese[index]) != 0) return false;
    }
    if (viewport_font::namedFallbackPostScriptName(viewport_font::Locale::Unset, 0) != nullptr ||
        viewport_font::namedFallbackPostScriptName(viewport_font::Locale::Hans, 3) != nullptr) return false;
    std::puts("GREEN: CoreText-first selection retries only coverage rejects in locale order");
    return true;
}

bool mixedApprovedNamesRequireEveryCjkAndAsciiGlyph()
{
    const char controlName[] = "控制测试33";
    const char textName[] = "Text Box 自定义33";
    const auto selectsWholeName = [](const char *text, const void *firstCandidate) {
        std::size_t calls = 0;
        std::size_t selectedIndex = 0;
        viewport_font::TextDisposition disposition = viewport_font::TextDisposition::Invalid;
        const void *selected = viewport_font::selectVerifiedTextCandidates(
            &kOriginalPartial, text, std::strlen(text), 0, fakeFontGlyph, 2,
            [&](std::size_t index) noexcept -> const void * {
                ++calls;
                return index == 0 ? firstCandidate : &kCandidateFull;
            }, &disposition, &selectedIndex);
        return selected == &kCandidateFull && selectedIndex == 1 && calls == 2 &&
            disposition == viewport_font::TextDisposition::NeedsSystemFallback;
    };
    if (!selectsWholeName(controlName, &kCandidateControlPartial) ||
        !selectsWholeName(textName, &kCandidateTextPartial) ||
        !selectsWholeName(textName, &kCandidateCjkOnly)) return false;
    std::puts("GREEN: approved mixed CJK/ASCII names reject partial faces before full coverage");
    return true;
}

void storeLibCppString(char *frame, std::size_t offset,
                       const std::string &value)
{
    static_assert(sizeof(std::string) ==
                  sizeof(native_title_format_abi::LibCppStringSnapshot));
    std::memcpy(frame + offset, &value, sizeof(value));
}

native_title_format_abi::LibCppStringSnapshot snapshotLibCppString(
    const char *frame, std::size_t offset)
{
    native_title_format_abi::LibCppStringSnapshot snapshot{};
    std::memcpy(snapshot.bytes, frame + offset, sizeof(snapshot));
    return snapshot;
}

struct TemporaryDirectory {
    std::filesystem::path path;
    ~TemporaryDirectory()
    {
        std::error_code error;
        if (!path.empty()) std::filesystem::remove_all(path, error);
    }
};

bool pathHelperCanonicalizesRealBundleAliases()
{
    const auto stamp = std::chrono::steady_clock::now().time_since_epoch().count();
    TemporaryDirectory cleanup{
        std::filesystem::temp_directory_path() /
        ("native-font-path-contract." + std::to_string(stamp))};
    std::error_code error;
    if (!std::filesystem::create_directory(cleanup.path, error) || error) return false;
    const auto app = cleanup.path / "Cavalry.app";
    const auto executable = app / "Contents/MacOS/Cavalry";
    const auto framework = app / "Contents/Frameworks/libApi.dylib";
    std::filesystem::create_directories(executable.parent_path(), error);
    if (error) return false;
    std::filesystem::create_directories(framework.parent_path(), error);
    if (error) return false;
    {
        std::ofstream file(executable);
        if (!file) return false;
        file << "executable";
    }
    {
        std::ofstream file(framework);
        if (!file) return false;
        file << "framework";
    }

    const std::string executableAlias =
        (app / "Contents/MacOS/../MacOS/Cavalry").string();
    const std::string imageAlias =
        (app / "Contents/MacOS/../Frameworks/libApi.dylib").string();
    char expected[PATH_MAX]{};
    char derived[PATH_MAX]{};
    if (::realpath(framework.c_str(), expected) == nullptr ||
        !native_image_paths::frameworksPathForExecutable(
            executableAlias.c_str(), "libApi.dylib", derived, sizeof(derived)) ||
        std::strcmp(expected, derived) != 0) return false;

    const bool rawMatcherAccepts = std::strcmp(imageAlias.c_str(), expected) == 0;
    if (rawMatcherAccepts ||
        !native_image_paths::pathMatchesCanonical(imageAlias.c_str(), derived)) return false;

    std::puts("RED reproduced: raw strcmp rejects Contents/MacOS/../Frameworks");
    std::puts("GREEN: shared helper canonicalizes image and executable paths");
    return true;
}

bool getterRunsOnceAndPublishesOneLocale()
{
    int api = 0;
    int calls = 0;
    cavalry_native_font::LocaleSnapshot locale{};
    const auto getter = [&calls](int *) {
        ++calls;
        return std::string("zh-Hant");
    };
    const std::string result = cavalry_native_font::forwardNativeLocale(
        &api, getter, true, locale);
    if (calls != 1 || result != "zh-Hant" ||
        locale.value() != cavalry_native_font::Locale::Hant) return false;

    const auto secondGetter = [&calls](int *) {
        ++calls;
        return std::string("ja");
    };
    const std::string second = cavalry_native_font::forwardNativeLocale(
        &api, secondGetter, true, locale);
    return calls == 2 && second == "ja" &&
        locale.value() == cavalry_native_font::Locale::Hant;
}

bool getterExceptionPropagatesWithoutRetry()
{
    int api = 0;
    int calls = 0;
    cavalry_native_font::LocaleSnapshot locale{};
    const auto throwingGetter = [&calls](int *) -> std::string {
        ++calls;
        throw std::runtime_error("getter sentinel");
    };
    try {
        (void)cavalry_native_font::forwardNativeLocale(
            &api, throwingGetter, true, locale);
    } catch (const std::runtime_error &) {
        return calls == 1 && locale.value() == cavalry_native_font::Locale::Unset;
    }
    return false;
}

bool unknownOwnerUsesProductionForwardGate()
{
    using Owner = native_getpath_font::Owner;
    int forwards = 0;
    int fontCalls = 0;
    auto original = [&forwards] { ++forwards; };
    if (!native_getpath::forwardUnknownOwner(Owner::Unknown, original)) return false;
    if (forwards != 1) return false;
    if (!native_getpath::forwardUnknownOwner(Owner::ToolHelp, original)) ++fontCalls;
    if (forwards != 1 || fontCalls != 1) return false;

    int reads = 0;
    const auto read = [&reads](std::uintptr_t, std::size_t, void *) noexcept {
        ++reads;
        return false;
    };
    const auto owner = native_getpath::owner(
        0, 0, 0, 0, viewport_owner::StackRange{}, read);
    return owner == Owner::Unknown && reads == 0;
}

bool viewportFpsOwnerUsesExactTwoReturnAddresses()
{
    using Owner = native_getpath_font::Owner;
    using namespace native_getpath_abi::contract;
    alignas(16) std::array<std::uintptr_t, 8> words{};
    const std::uintptr_t low = reinterpret_cast<std::uintptr_t>(words.data());
    const std::uintptr_t frame0 = low;
    const std::uintptr_t frame1 = low + 16;
    const viewport_owner::StackRange stack{low, low + sizeof(words)};
    constexpr std::uintptr_t coreBase = 0x10000000;
    constexpr std::uintptr_t extensionBase = 0x20000000;
    words[0] = frame1;
    words[1] = extensionBase + kViewportFpsProducerReturn;
    int reads = 0;
    const auto read = [&](std::uintptr_t address, std::size_t size,
                          void *destination) noexcept {
        ++reads;
        if (address < low || address > stack.high || size > stack.high - address)
            return false;
        std::memcpy(destination, reinterpret_cast<const void *>(address), size);
        return true;
    };

    const auto fps = native_getpath::owner(
        coreBase, extensionBase, coreBase + kCoreOwnerReturnOffset,
        frame0, stack, read);
    if (fps != Owner::ViewportFps || reads != 1) return false;

    reads = 0;
    const auto wrongProducer = native_getpath::owner(
        coreBase, extensionBase, coreBase + kCoreOwnerReturnOffset,
        frame0, stack, [&](std::uintptr_t address, std::size_t size,
                           void *destination) noexcept {
            ++reads;
            if (address < low || address > stack.high || size > stack.high - address)
                return false;
            std::array<std::uintptr_t, 2> changed{};
            std::memcpy(changed.data(), reinterpret_cast<const void *>(address), size);
            changed[1] = extensionBase + kViewportFpsProducerReturn + 4;
            std::memcpy(destination, changed.data(), size);
            return true;
        });
    if (wrongProducer != Owner::Unknown || reads != 1) return false;
    int forwards = 0;
    if (!native_getpath::forwardUnknownOwner(
            wrongProducer, [&forwards] { ++forwards; }) || forwards != 1) return false;

    reads = 0;
    const auto wrongCore = native_getpath::owner(
        coreBase, extensionBase, coreBase + kCoreOwnerReturnOffset + 4,
        frame0, stack, read);
    if (wrongCore != Owner::Unknown || reads != 0) return false;

    reads = 0;
    const auto readFailed = native_getpath::owner(
        coreBase, extensionBase, coreBase + kCoreOwnerReturnOffset,
        frame0, stack, [&](std::uintptr_t, std::size_t, void *) noexcept {
            ++reads;
            return false;
        });
    if (readFailed != Owner::Unknown || reads != 1) return false;

    reads = 0;
    const auto overflow = native_getpath::owner(
        coreBase, std::numeric_limits<std::uintptr_t>::max() -
            kCacheOwnerReturnOffset + 1,
        coreBase + kCoreOwnerReturnOffset, frame0, stack, read);
    return overflow == Owner::Unknown && reads == 0;
}

bool cachedGetPathProducersKeepTheirOwnerChain()
{
    using Owner = native_getpath_font::Owner;
    using namespace native_getpath_abi::contract;
    constexpr std::uintptr_t coreBase = 0x10000000;
    constexpr std::uintptr_t extensionBase = 0x20000000;
    const std::uintptr_t returns[] = {
        kToolHelpProducerReturnA,
        kToolHelpProducerReturnB,
        kViewportStatusProducerReturn
    };
    const Owner owners[] = {Owner::ToolHelp, Owner::ToolHelp, Owner::ViewportStatus};
    for (std::size_t i = 0; i < 3; ++i) {
        alignas(16) std::array<std::uintptr_t, 8> words{};
        const std::uintptr_t low = reinterpret_cast<std::uintptr_t>(words.data());
        const std::uintptr_t frame0 = low;
        const std::uintptr_t frame1 = low + 16;
        const std::uintptr_t frame2 = low + 32;
        const viewport_owner::StackRange stack{low, low + sizeof(words)};
        words[0] = frame1;
        words[1] = extensionBase + kCacheOwnerReturnOffset;
        words[2] = frame2;
        words[3] = extensionBase + returns[i];
        int reads = 0;
        const auto read = [&](std::uintptr_t address, std::size_t size,
                              void *destination) noexcept {
            ++reads;
            if (address < low || address > stack.high || size > stack.high - address)
                return false;
            std::memcpy(destination, reinterpret_cast<const void *>(address), size);
            return true;
        };
        const auto owner = native_getpath::owner(
            coreBase, extensionBase, coreBase + kCoreOwnerReturnOffset,
            frame0, stack, read);
        if (owner != owners[i] || reads != 2) return false;
    }
    return true;
}

bool graphEditorEmptyOwnerUsesOneDirectFrameRead()
{
    using Owner = native_getpath_font::Owner;
    using namespace native_getpath_abi::contract;
    alignas(16) std::array<std::uintptr_t, 8> words{};
    const std::uintptr_t low = reinterpret_cast<std::uintptr_t>(words.data());
    const std::uintptr_t frame = low;
    const viewport_owner::StackRange stack{low, low + sizeof(words)};
    constexpr std::uintptr_t coreBase = 0x10000000;
    constexpr std::uintptr_t extensionBase = 0x20000000;
    words[0] = low + 16;
    words[1] = extensionBase + kGraphEditorEmptyStateProducerReturn;
    int reads = 0;
    const auto read = [&](std::uintptr_t address, std::size_t size,
                          void *destination) noexcept {
        ++reads;
        if (address < low || address > stack.high || size > stack.high - address)
            return false;
        std::memcpy(destination, reinterpret_cast<const void *>(address), size);
        return true;
    };
    const auto graph = native_getpath::owner(
        coreBase, extensionBase, coreBase + kCoreOwnerReturnOffset,
        frame, stack, read);
    if (graph != Owner::GraphEditorEmptyState || reads != 1) return false;

    reads = 0;
    words[1] = extensionBase + kGraphEditorEmptyStateProducerReturn + 4;
    const auto unknown = native_getpath::owner(
        coreBase, extensionBase, coreBase + kCoreOwnerReturnOffset,
        frame, stack, read);
    int forwards = 0;
    if (unknown != Owner::Unknown || reads != 1 ||
        !native_getpath::forwardUnknownOwner(
            unknown, [&forwards] { ++forwards; }) || forwards != 1) return false;

    reads = 0;
    const auto wrongCore = native_getpath::owner(
        coreBase, extensionBase, coreBase + kCoreOwnerReturnOffset + 4,
        frame, stack, read);
    return wrongCore == Owner::Unknown && reads == 0;
}

bool graphEditorEmptyTextRequiresExactLocaleAndSource()
{
    using namespace native_getpath_font;
    struct Case {
        cavalry_native_font::Locale locale;
        const char *text;
    };
    constexpr Case cases[] = {
        {cavalry_native_font::Locale::Hans, "选择图层或属性以查看其关键帧"},
        {cavalry_native_font::Locale::Hant, "選取圖層或屬性以檢視其關鍵幀"},
        {cavalry_native_font::Locale::Japanese,
         "レイヤーまたは属性を選択するとキーフレームが表示されます"},
    };
    for (const Case &item : cases) {
        const TextEntry *entry = graphEditorEmptyTextEntry(item.locale);
        if (entry == nullptr || entry->owner != Owner::GraphEditorEmptyState ||
            !exactGraphEditorEmptyText(item.text, std::strlen(item.text), 0,
                                       Owner::GraphEditorEmptyState, entry))
            return false;
    }
    if (graphEditorEmptyTextEntry(cavalry_native_font::Locale::English) != nullptr ||
        graphEditorEmptyTextEntry(cavalry_native_font::Locale::Unknown) != nullptr)
        return false;

    const TextEntry *hans = graphEditorEmptyTextEntry(
        cavalry_native_font::Locale::Hans);
    constexpr char wrongLocale[] = "選取圖層或屬性以檢視其關鍵幀";
    if (exactGraphEditorEmptyText(wrongLocale, sizeof(wrongLocale) - 1, 0,
                                  Owner::GraphEditorEmptyState, hans) ||
        exactGraphEditorEmptyText(cases[0].text, std::strlen(cases[0].text), 1,
                                  Owner::GraphEditorEmptyState, hans) ||
        exactGraphEditorEmptyText(cases[0].text, std::strlen(cases[0].text), 0,
                                  Owner::ToolHelp, hans)) return false;

    int forwards = 0;
    const bool forwarded = forwardUnapprovedGraphEditorEmptyText(
        wrongLocale, sizeof(wrongLocale) - 1, 0,
        Owner::GraphEditorEmptyState, hans, [&forwards] { ++forwards; });
    return forwarded && forwards == 1;
}

bool viewportFpsPrefixRequiresApprovedLocaleAndSuffix()
{
    using namespace native_getpath_font;
    const char *hansPrefix = viewportFpsPrefix(cavalry_native_font::Locale::Hans);
    const char *hantPrefix = viewportFpsPrefix(cavalry_native_font::Locale::Hant);
    const char *japanesePrefix = viewportFpsPrefix(cavalry_native_font::Locale::Japanese);
    constexpr char hansText[] = "帧率：24.00";
    constexpr char hantText[] = "幀率：24.00";
    constexpr char japaneseText[] = "フレームレート: --.--";
    if (hansPrefix == nullptr || hantPrefix == nullptr || japanesePrefix == nullptr ||
        viewportFpsPrefix(cavalry_native_font::Locale::English) != nullptr ||
        viewportFpsPrefix(cavalry_native_font::Locale::Unknown) != nullptr ||
        !viewportFpsText(hansText, sizeof(hansText) - 1, 0,
                         Owner::ViewportFps, hansPrefix) ||
        !viewportFpsText(hantText, sizeof(hantText) - 1, 0,
                         Owner::ViewportFps, hantPrefix) ||
        !viewportFpsText(japaneseText, sizeof(japaneseText) - 1, 0,
                         Owner::ViewportFps, japanesePrefix)) return false;

    constexpr char wrongLocale[] = "幀率：24.00";
    constexpr char wrongPrefix[] = "X帧率：24.00";
    if (viewportFpsText(wrongLocale, sizeof(wrongLocale) - 1, 0,
                        Owner::ViewportFps, hansPrefix) ||
        viewportFpsText(wrongPrefix, sizeof(wrongPrefix) - 1, 0,
                        Owner::ViewportFps, hansPrefix) ||
        viewportFpsText(hansPrefix, sizeof(hansPrefix) - 1, 0,
                        Owner::ViewportFps, hansPrefix) ||
        viewportFpsText(hansText, sizeof(hansText) - 1, 1,
                        Owner::ViewportFps, hansPrefix) ||
        viewportFpsText(hansText, sizeof(hansText) - 1, 0,
                        Owner::ViewportStatus, hansPrefix) ||
        viewportFpsText(nullptr, sizeof(hansText) - 1, 0,
                        Owner::ViewportFps, hansPrefix)) return false;

    std::array<char, kMaxTextBytes + 1> overLimit{};
    std::memcpy(overLimit.data(), hansPrefix, std::strlen(hansPrefix));
    return !viewportFpsText(overLimit.data(), overLimit.size(), 0,
                             Owner::ViewportFps, hansPrefix);
}

template <std::size_t N>
bool fixedTextLaneUsesExactOwnerAndBytes(
    const native_getpath_font::TextEntry (&entries)[N], const char *prefix)
{
    using namespace native_getpath_font;
    static_assert(N == kEntriesPerLocale && N == 75);

    for (std::size_t i = 0; i < N; ++i) {
        const TextEntry &entry = entries[i];
        if (entry.owner == Owner::Unknown || entry.text == nullptr) return false;
        const std::size_t size = std::strlen(entry.text);
        const Owner wrongOwner = entry.owner == Owner::ToolHelp
            ? Owner::ViewportStatus : Owner::ToolHelp;
        const int matched = exactText(entry.text, size, 0, entry.owner, entries, N);
        if (matched < 0 || entries[matched].owner != entry.owner ||
            std::strcmp(entries[matched].text, entry.text) != 0 ||
            exactText(entry.text, size, 0, wrongOwner, entries, N) != -1 ||
            exactText(entry.text, size, 0, Owner::Unknown, entries, N) != -1 ||
            exactText(entry.text, size, 1, entry.owner, entries, N) != -1)
            return false;
    }

    constexpr char unknown[] = "__unapproved GetPath text__";
    const std::size_t prefixSize = std::strlen(prefix);
    if (prefixSize == 0 || prefixSize >= std::strlen(entries[18].text) ||
        std::memcmp(entries[18].text, prefix, prefixSize) != 0 ||
        exactText(prefix, prefixSize, 0, Owner::ToolHelp, entries, N) != -1 ||
        exactText(unknown, sizeof(unknown) - 1, 0, Owner::ToolHelp,
                  entries, N) != -1 ||
        exactText(unknown, sizeof(unknown) - 1, 0, Owner::ViewportStatus,
                  entries, N) != -1)
        return false;

    char overLimit[kMaxTextBytes + 1]{};
    return exactText(overLimit, sizeof(overLimit), 0, Owner::ToolHelp,
                     entries, N) == -1;
}

template <std::size_t N>
bool appendedGetPathRowsStayToolHelp(
    const native_getpath_font::TextEntry (&entries)[N])
{
    using namespace native_getpath_font;
    static_assert(N == kEntriesPerLocale && N == 75);
    for (std::size_t index = 31; index < N; ++index) {
        if (entries[index].owner != Owner::ToolHelp || !entries[index].text ||
            std::strcmp(entries[index].text, "Delete") == 0 ||
            std::strcmp(entries[index].text, "Space") == 0)
            return false;
    }
    return true;
}

template <std::size_t N>
bool appendedCompositeRowsAreExact(
    const native_getpath_font::TextEntry (&entries)[N],
    const char *optionDrag, const char *shiftDrag,
    const char *commandDrag, const char *skeletonSuffix)
{
    using namespace native_getpath_font;
    static_assert(N == kEntriesPerLocale && N == 75);
    const std::array<const char *, 4> expected = {
        optionDrag, shiftDrag, commandDrag, skeletonSuffix};
    for (std::size_t offset = 0; offset < expected.size(); ++offset) {
        const std::size_t index = 71 + offset;
        if (entries[index].owner != Owner::ToolHelp || !entries[index].text ||
            std::strcmp(entries[index].text, expected[offset]) != 0 ||
            exactText(expected[offset], std::strlen(expected[offset]), 0,
                      Owner::ToolHelp, entries, N) != static_cast<int>(index))
            return false;
    }

    constexpr char fixedPrefix[] = "Option/Alt + ";
    const std::string wrongPrefix = "Alt/Option + " +
        std::string(optionDrag + sizeof(fixedPrefix) - 1);
    const std::string partial = std::string(optionDrag).substr(
        0, std::strlen(optionDrag) - 1);
    return exactText(wrongPrefix.data(), wrongPrefix.size(), 0,
                     Owner::ToolHelp, entries, N) == -1 &&
        exactText(fixedPrefix, sizeof(fixedPrefix) - 1, 0,
                  Owner::ToolHelp, entries, N) == -1 &&
        exactText(partial.data(), partial.size(), 0,
                  Owner::ToolHelp, entries, N) == -1;
}

bool allFixedGetPathTextLanesRespectExactGate()
{
    using namespace native_getpath_font;
    static_assert(sizeof(kZhHansEntries) / sizeof(kZhHansEntries[0]) ==
                  kEntriesPerLocale);
    static_assert(sizeof(kZhHantEntries) / sizeof(kZhHantEntries[0]) ==
                  kEntriesPerLocale);
    static_assert(sizeof(kJaJpEntries) / sizeof(kJaJpEntries[0]) ==
                  kEntriesPerLocale);
    return appendedGetPathRowsStayToolHelp(kZhHansEntries) &&
        appendedGetPathRowsStayToolHelp(kZhHantEntries) &&
        appendedGetPathRowsStayToolHelp(kJaJpEntries) &&
        appendedCompositeRowsAreExact(
            kZhHansEntries, "Option/Alt + 拖拽", "Shift + 拖拽",
            "Cmd/Ctrl + 拖拽", "Option/Alt + 单击控制柄并拖动") &&
        appendedCompositeRowsAreExact(
            kZhHantEntries, "Option/Alt + 拖曳", "Shift + 拖曳",
            "Cmd/Ctrl + 拖曳", "Option/Alt + 按一下控制柄並拖曳") &&
        appendedCompositeRowsAreExact(
            kJaJpEntries, "Option/Alt + ドラッグ", "Shift + ドラッグ",
            "Cmd/Ctrl + ドラッグ", "Option/Alt + ハンドルをクリックしてドラッグ") &&
        fixedTextLaneUsesExactOwnerAndBytes(kZhHansEntries, "启用贝塞尔角度") &&
        fixedTextLaneUsesExactOwnerAndBytes(kZhHantEntries, "啟用貝茲角度") &&
        fixedTextLaneUsesExactOwnerAndBytes(kJaJpEntries, "ベジェ角度");
}

bool extensionGotMustMatchThisInterposer()
{
    int loadedTarget = 0;
    int otherTarget = 0;
    const void *interposer = &loadedTarget;
    return native_locale_interpose::contract::extensionGotTargetsInterposer(
               &loadedTarget, interposer) &&
        !native_locale_interpose::contract::extensionGotTargetsInterposer(
               &loadedTarget, &otherTarget) &&
        !native_locale_interpose::contract::extensionGotTargetsInterposer(
               nullptr, interposer);
}

bool titleProjectionRequiresEmptySourcesAndPreservesSameAddressNames()
{
    char callerStack[512]{};
    constexpr std::size_t valuesOffset = 256;
    std::memcpy(callerStack, "Untitled", 8);
    std::memcpy(callerStack + 32, "None", 4);
    const auto valuesAddress = reinterpret_cast<std::uintptr_t>(callerStack + valuesOffset);
    const std::string emptySource;
    const std::string userProjectSource = "None";
    const std::string userSceneSource = "Untitled";
    const std::string delimiterProjectSource = "Shot - Scene: Take";
    const auto projectSourceOffset = valuesOffset +
        native_title_format_abi::contract::kProjectSourceObjectFromValues;
    const auto sceneSourceOffset = valuesOffset +
        native_title_format_abi::contract::kSceneSourceObjectFromValues;
    storeLibCppString(callerStack, projectSourceOffset, emptySource);
    storeLibCppString(callerStack, sceneSourceOffset, emptySource);
    const auto emptyProjectSnapshot =
        snapshotLibCppString(callerStack, projectSourceOffset);
    const auto emptySceneSnapshot = snapshotLibCppString(callerStack, sceneSourceOffset);
    if (!native_title_format_abi::isEmptyShortString(emptyProjectSnapshot) ||
        !native_title_format_abi::isEmptyShortString(emptySceneSnapshot)) return false;
    if (!native_title_format::isFallbackAt(
            valuesAddress, {callerStack + 32, 4},
            native_title_format_abi::contract::kProjectFallbackDistance,
            native_title_format_abi::contract::kProjectFallbackLength) ||
        !native_title_format::isFallbackAt(
            valuesAddress, {callerStack, 8},
            native_title_format_abi::contract::kSceneFallbackDistance,
            native_title_format_abi::contract::kSceneFallbackLength)) return false;

    const native_title_format::Inputs fallback{
        valuesAddress,
        {callerStack + 32, 4},
        {callerStack, 8},
        emptyProjectSnapshot,
        emptySceneSnapshot
    };
    const auto projectFallback = [&](cavalry_native_font::Locale locale,
                                     const char *expected) {
        std::string title = "Project: None - Scene: Untitled - Restricted";
        return native_title_format::project(title, locale, fallback) &&
            title == expected;
    };
    if (!projectFallback(cavalry_native_font::Locale::Hans,
                         "项目: 无 - 场景: 无标题 - Restricted") ||
        !projectFallback(cavalry_native_font::Locale::Hant,
                         "專案: 無 - 場景: 無標題 - Restricted") ||
        !projectFallback(cavalry_native_font::Locale::Japanese,
                         "プロジェクト: なし - シーン: 無題 - Restricted")) return false;
    std::puts("GREEN: empty source objects at exact fallback slots translate as placeholders");

    std::string userNames = "Project: None - Scene: Untitled - Restricted";
    storeLibCppString(callerStack, projectSourceOffset, userProjectSource);
    storeLibCppString(callerStack, sceneSourceOffset, userSceneSource);
    const auto userProjectSnapshot =
        snapshotLibCppString(callerStack, projectSourceOffset);
    const auto userSceneSnapshot = snapshotLibCppString(callerStack, sceneSourceOffset);
    if (native_title_format_abi::isEmptyShortString(userProjectSnapshot) ||
        native_title_format_abi::isEmptyShortString(userSceneSnapshot)) return false;
    const bool legacyPointerOnlyWouldMisclassify =
        native_title_format::isFallbackAt(
            valuesAddress, {callerStack + 32, 4},
            native_title_format_abi::contract::kProjectFallbackDistance,
            native_title_format_abi::contract::kProjectFallbackLength) &&
        native_title_format::isFallbackAt(
            valuesAddress, {callerStack, 8},
            native_title_format_abi::contract::kSceneFallbackDistance,
            native_title_format_abi::contract::kSceneFallbackLength);
    if (!legacyPointerOnlyWouldMisclassify) return false;
    std::puts("RED reproduced: nonempty None/Untitled names alias fallback pointers");
    const native_title_format::Inputs named{
        valuesAddress,
        {callerStack + 32, 4},
        {callerStack, 8},
        userProjectSnapshot,
        userSceneSnapshot
    };
    if (!native_title_format::project(
            userNames, cavalry_native_font::Locale::Hans, named) ||
        userNames != "项目: None - 场景: Untitled - Restricted") return false;
    std::puts("GREEN: source-object length preserves same-address None/Untitled names");

    const char delimiterName[] = "Shot - Scene: Take";
    std::string delimiterTitle =
        "Project: Shot - Scene: Take - Scene: Untitled ";
    storeLibCppString(callerStack, projectSourceOffset, delimiterProjectSource);
    storeLibCppString(callerStack, sceneSourceOffset, emptySource);
    const auto delimiterProjectSnapshot =
        snapshotLibCppString(callerStack, projectSourceOffset);
    const auto delimiterSceneSnapshot = snapshotLibCppString(callerStack, sceneSourceOffset);
    if (native_title_format_abi::isEmptyShortString(delimiterProjectSnapshot) ||
        !native_title_format_abi::isEmptyShortString(delimiterSceneSnapshot)) return false;
    const native_title_format::Inputs delimiter{
        valuesAddress,
        {delimiterName, sizeof(delimiterName) - 1},
        {callerStack, 8},
        delimiterProjectSnapshot,
        delimiterSceneSnapshot
    };
    if (!native_title_format::project(
            delimiterTitle, cavalry_native_font::Locale::Hans, delimiter) ||
        delimiterTitle != "项目: Shot - Scene: Take - 场景: 无标题 ") return false;

    std::string unknown = "not a vendor title";
    const std::string before = unknown;
    return !native_title_format::project(
               unknown, cavalry_native_font::Locale::Hans, fallback) &&
        unknown == before;
}
}  // namespace

int main()
{
    if (!finiteVerifiedFontCandidatesPreserveCoverageOrder()) return fail(8);
    if (!mixedApprovedNamesRequireEveryCjkAndAsciiGlyph()) return fail(9);
    if (!pathHelperCanonicalizesRealBundleAliases()) return fail(5);
    if (!getterRunsOnceAndPublishesOneLocale()) return fail(1);
    if (!getterExceptionPropagatesWithoutRetry()) return fail(2);
    if (!unknownOwnerUsesProductionForwardGate()) return fail(3);
    if (!viewportFpsOwnerUsesExactTwoReturnAddresses()) return fail(10);
    std::puts("GREEN: FPS requires the Core and direct Extension return PCs");
    if (!cachedGetPathProducersKeepTheirOwnerChain()) return fail(11);
    std::puts("GREEN: ToolHelp and ViewportStatus retain the cached owner chain");
    if (!graphEditorEmptyOwnerUsesOneDirectFrameRead()) return fail(13);
    if (!graphEditorEmptyTextRequiresExactLocaleAndSource()) return fail(14);
    std::puts("GREEN: GraphEditor exact direct caller and three approved empty-state strings only");
    if (!viewportFpsPrefixRequiresApprovedLocaleAndSuffix()) return fail(12);
    std::puts("GREEN: FPS prefix matches approved locales and non-empty suffixes only");
    if (!extensionGotMustMatchThisInterposer()) return fail(4);
    if (!allFixedGetPathTextLanesRespectExactGate()) return fail(6);
    std::puts("GREEN: 44 appended ToolHelp rows include four exact composite shortcuts");
    if (!titleProjectionRequiresEmptySourcesAndPreservesSameAddressNames()) return fail(7);
    return 0;
}
#endif
