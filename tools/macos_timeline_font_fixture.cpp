/**
 * [INPUT]: 依赖 cavalry_i18n::mac_timeline 的 UTF-8 字体选择与 24-byte 字体借用策略
 * [OUTPUT]: 以无 Qt、无 vendor ABI 的 mock typeface 验证 CJK 覆盖、候选顺序、严格输入拒绝与布局字节保真
 * [POS]: tools 的 macOS 时间轴字体原生合同 fixture；只证明共享策略的可观察语义，不读取或修改真实 Cavalry.app
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_macos_timeline_font_policy.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <iterator>

namespace {

struct Typeface {
    enum class Kind : std::uint8_t {
        Original,
        Japanese,
        SimplifiedChinese,
        PartialSimplifiedChinese,
        SimplifiedChineseWithAscii,
    };

    Kind kind;
};

// ---- mock glyph coverage -------------------------------------------------
// 返回非零 glyph id 代表该 typeface 能绘制 codepoint；0 代表缺字。
std::uint16_t glyphLookup(
    const void *rawTypeface,
    std::int32_t codepoint) noexcept
{
    if (rawTypeface == nullptr || codepoint < 0) {
        return 0;
    }

    const auto *typeface = static_cast<const Typeface *>(rawTypeface);
    switch (typeface->kind) {
    case Typeface::Kind::Original:
        // 原厂字体只证明部分覆盖：中、A 存在，文与 B 不存在。
        return codepoint == 0x4E2D || codepoint == 'A' ? 1 : 0;
    case Typeface::Kind::Japanese:
        return codepoint == 0x65E5 || codepoint == 0x672C ? 2 : 0;
    case Typeface::Kind::SimplifiedChinese:
        return codepoint == 0x4E2D || codepoint == 0x6587 ? 3 : 0;
    case Typeface::Kind::PartialSimplifiedChinese:
        return codepoint == 0x4E2D ? 4 : 0;
    case Typeface::Kind::SimplifiedChineseWithAscii:
        return (codepoint == 0x4E2D || codepoint == 0x6587
                || (codepoint >= 0x21 && codepoint <= 0x7E))
            ? 5
            : 0;
    }

    return 0;
}

struct alignas(8) FontBytes {
    std::uint8_t bytes[cavalry_i18n::mac_timeline::kFontBytes];
};

#define CHECK(condition) \
    do { \
        if (!(condition)) { \
            std::fprintf(stderr, "line %d: %s\n", __LINE__, #condition); \
            return 1; \
        } \
    } while (false)

void writePointer(std::uint8_t *destination, const void *value) noexcept
{
    std::memcpy(destination, &value, sizeof(value));
}

const void *readPointer(const std::uint8_t *source) noexcept
{
    const void *value = nullptr;
    std::memcpy(&value, source, sizeof(value));
    return value;
}

} // namespace

int main()
{
    using cavalry_i18n::mac_timeline::borrowFont;
    using cavalry_i18n::mac_timeline::selectTypeface;

    static_assert(cavalry_i18n::mac_timeline::kFontBytes == 24);
    static_assert(sizeof(const void *) == 8);

    Typeface original {Typeface::Kind::Original};
    Typeface japanese {Typeface::Kind::Japanese};
    Typeface simplifiedChinese {Typeface::Kind::SimplifiedChinese};
    Typeface partialSimplifiedChinese {
        Typeface::Kind::PartialSimplifiedChinese};
    Typeface simplifiedChineseWithAscii {
        Typeface::Kind::SimplifiedChineseWithAscii};

    const void *japaneseFirst[] = {&japanese, &simplifiedChinese};
    const void *partialFirst[] = {
        &partialSimplifiedChinese,
        &simplifiedChinese,
    };
    const void *asciiCapable[] = {&simplifiedChineseWithAscii};
    const void *simplifiedOnly[] = {&simplifiedChinese};

    // 原字体完整覆盖时，任何候选都不能抢走原字体。
    const char originalCovered[] = "A";
    CHECK(selectTypeface(
              &original,
              japaneseFirst,
              std::size(japaneseFirst),
              originalCovered,
              sizeof(originalCovered) - 1,
              0,
              glyphLookup)
        == &original);
    CHECK(selectTypeface(
              &original,
              simplifiedOnly,
              std::size(simplifiedOnly),
              u8"中",
              sizeof(u8"中") - 1,
              0,
              glyphLookup)
        == &original);

    // 日本候选优先但不覆盖简中时，必须继续选择后一个完整候选。
    const char simplifiedText[] = u8"中文";
    CHECK(selectTypeface(
              &original,
              japaneseFirst,
              std::size(japaneseFirst),
              simplifiedText,
              sizeof(simplifiedText) - 1,
              0,
              glyphLookup)
        == &simplifiedChinese);

    // 只覆盖首字的候选不能因部分命中而被选中。
    CHECK(selectTypeface(
              &original,
              partialFirst,
              std::size(partialFirst),
              simplifiedText,
              sizeof(simplifiedText) - 1,
              0,
              glyphLookup)
        == &simplifiedChinese);
    const void *partialOnly[] = {&partialSimplifiedChinese};
    CHECK(selectTypeface(
              &original,
              partialOnly,
              std::size(partialOnly),
              simplifiedText,
              sizeof(simplifiedText) - 1,
              0,
              glyphLookup)
        == &original);

    // 纯 ASCII 无论 mock 原字体是否缺字，都保持原字体；混排则要求候选连 ASCII 一并覆盖。
    const char asciiMissingFromOriginal[] = "B";
    CHECK(selectTypeface(
              &original,
              asciiCapable,
              std::size(asciiCapable),
              asciiMissingFromOriginal,
              sizeof(asciiMissingFromOriginal) - 1,
              0,
              glyphLookup)
        == &original);
    const char mixedCjkAndAscii[] = u8"文B";
    CHECK(selectTypeface(
              &original,
              asciiCapable,
              std::size(asciiCapable),
              mixedCjkAndAscii,
              sizeof(mixedCjkAndAscii) - 1,
              0,
              glyphLookup)
        == &simplifiedChineseWithAscii);
    CHECK(selectTypeface(
              &original,
              simplifiedOnly,
              std::size(simplifiedOnly),
              mixedCjkAndAscii,
              sizeof(mixedCjkAndAscii) - 1,
              0,
              glyphLookup)
        == &original);

    // 混排中的 U+0000..U+0020 不要求 glyph；它们不能阻断 CJK 候选。
    const char cjkWithWhitespace[] = {
        static_cast<char>(0xE6),
        static_cast<char>(0x96),
        static_cast<char>(0x87),
        ' ',
        '\t',
        '\0',
    };
    CHECK(selectTypeface(
              &original,
              simplifiedOnly,
              std::size(simplifiedOnly),
              cjkWithWhitespace,
              std::size(cjkWithWhitespace),
              0,
              glyphLookup)
        == &simplifiedChinese);
    const char whitespaceOnly[] = {' ', '\t', '\n', '\0'};
    CHECK(selectTypeface(
              &original,
              simplifiedOnly,
              std::size(simplifiedOnly),
              whitespaceOnly,
              std::size(whitespaceOnly),
              0,
              glyphLookup)
        == &original);

    // 只接受 UTF-8 encoding 0；其余编码即使内容可覆盖也保持原字体。
    CHECK(selectTypeface(
              &original,
              japaneseFirst,
              std::size(japaneseFirst),
              simplifiedText,
              sizeof(simplifiedText) - 1,
              1,
              glyphLookup)
        == &original);

    // 空、空指针及严格 UTF-8 错误均 fail-closed 到原字体。
    CHECK(selectTypeface(
              &original,
              simplifiedOnly,
              std::size(simplifiedOnly),
              "",
              0,
              0,
              glyphLookup)
        == &original);
    CHECK(selectTypeface(
              &original,
              simplifiedOnly,
              std::size(simplifiedOnly),
              nullptr,
              0,
              0,
              glyphLookup)
        == &original);
    const char invalidUtf8[][4] = {
        {static_cast<char>(0xC0), static_cast<char>(0x80), 0, 0}, // overlong
        {static_cast<char>(0xE4), static_cast<char>(0xB8), 0, 0}, // truncated
        {static_cast<char>(0xED), static_cast<char>(0xA0), static_cast<char>(0x80), 0}, // surrogate
        {static_cast<char>(0xF4), static_cast<char>(0x90), static_cast<char>(0x80), static_cast<char>(0x80)}, // > U+10FFFF
        {'A', static_cast<char>(0x80), 0, 0}, // bad continuation
    };
    const std::size_t invalidSizes[] = {2, 2, 3, 4, 2};
    for (std::size_t index = 0; index < std::size(invalidUtf8); ++index) {
        CHECK(selectTypeface(
                  &original,
                  simplifiedOnly,
                  std::size(simplifiedOnly),
                  invalidUtf8[index],
                  invalidSizes[index],
                  0,
                  glyphLookup)
            == &original);
    }

    std::array<char, 16385> oversized {};
    oversized.fill('B');
    CHECK(selectTypeface(
              &original,
              asciiCapable,
              std::size(asciiCapable),
              oversized.data(),
              oversized.size(),
              0,
              glyphLookup)
        == &original);

    // 借用字体只替换最初 8-byte typeface 指针，布局其余 16 bytes 完整保真。
    FontBytes source {};
    FontBytes sourceBefore {};
    FontBytes output {};
    for (std::size_t index = sizeof(const void *); index < sizeof(source.bytes); ++index) {
        source.bytes[index] = static_cast<std::uint8_t>(0x80 + index);
    }
    writePointer(source.bytes, &original);
    sourceBefore = source;
    const void *replacementTypeface = &simplifiedChinese;
    CHECK(borrowFont(source.bytes, replacementTypeface, output.bytes));
    CHECK(readPointer(output.bytes) == replacementTypeface);
    CHECK(readPointer(source.bytes) == &original);
    for (std::size_t index = sizeof(const void *); index < sizeof(source.bytes); ++index) {
        CHECK(output.bytes[index] == source.bytes[index]);
    }
    CHECK(std::memcmp(source.bytes, sourceBefore.bytes, sizeof(source.bytes)) == 0);

    CHECK(!borrowFont(nullptr, replacementTypeface, output.bytes));
    CHECK(!borrowFont(source.bytes, nullptr, output.bytes));
    CHECK(!borrowFont(source.bytes, replacementTypeface, nullptr));

    // 重复 select + borrow，证明热路径结果稳定且 source font 不被写脏。
    for (int iteration = 0; iteration < 1024; ++iteration) {
        CHECK(selectTypeface(
                  &original,
                  japaneseFirst,
                  std::size(japaneseFirst),
                  simplifiedText,
                  sizeof(simplifiedText) - 1,
                  0,
                  glyphLookup)
            == &simplifiedChinese);
        std::memset(output.bytes, 0xCC, sizeof(output.bytes));
        CHECK(borrowFont(source.bytes, replacementTypeface, output.bytes));
        CHECK(readPointer(output.bytes) == replacementTypeface);
        CHECK(std::memcmp(
                  output.bytes + sizeof(const void *),
                  source.bytes + sizeof(const void *),
                  sizeof(source.bytes) - sizeof(const void *))
            == 0);
        CHECK(std::memcmp(source.bytes, sourceBefore.bytes, sizeof(source.bytes)) == 0);
    }

    return 0;
}
