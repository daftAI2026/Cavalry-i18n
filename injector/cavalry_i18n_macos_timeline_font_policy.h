/**
 * [INPUT]: 依赖调用方已验证的 SkTypeface glyph 查询、有限候选与 UTF-8 原文
 * [OUTPUT]: 提供全名称覆盖选择和只改 typeface 指针的 24-byte borrowed SkFont；非法/不支持输入保持原字体
 * [POS]: macOS 时间轴测量/绘制共同消费的纯策略，无字体创建、缓存、分配、翻译或平台调用点知识
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include <cstddef>
#include <cstdint>
#include <cstring>
namespace cavalry_i18n::mac_timeline {
using GlyphLookup = std::uint16_t (*)(const void *, std::int32_t);
inline constexpr std::size_t kFontBytes = 24;
inline constexpr std::size_t kMaxTextBytes = 16384;

inline bool nextCodepoint(const unsigned char *text, std::size_t size,
                          std::size_t &offset, std::int32_t &value) noexcept
{
    const unsigned char first = text[offset++];
    if (first < 0x80) { value = first; return true; }
    int count = 0; std::int32_t minimum = 0;
    if (first >= 0xc2 && first <= 0xdf) { count = 1; value = first & 0x1f; minimum = 0x80; }
    else if (first >= 0xe0 && first <= 0xef) { count = 2; value = first & 0xf; minimum = 0x800; }
    else if (first >= 0xf0 && first <= 0xf4) { count = 3; value = first & 7; minimum = 0x10000; }
    else return false;
    while (count-- > 0) {
        if (offset >= size || (text[offset] & 0xc0) != 0x80) return false;
        value = (value << 6) | (text[offset++] & 0x3f);
    }
    return value >= minimum && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff);
}

inline const void *selectTypeface(const void *original, const void *const *candidates,
    std::size_t candidateCount, const void *text, std::size_t size,
    int encoding, GlyphLookup glyph) noexcept
{
    if (!original || !text || !size || size > kMaxTextBytes || encoding != 0 || !glyph)
        return original;
    const auto *bytes = static_cast<const unsigned char *>(text);
    bool nonAscii = false;
    for (std::size_t i = 0; i < size; ++i) nonAscii |= bytes[i] >= 0x80;
    if (!nonAscii) return original;
    bool originalCovers = true;
    std::size_t offset = 0;
    while (offset < size) {
        std::int32_t cp = 0;
        if (!nextCodepoint(bytes, size, offset, cp)) return original;
        if (originalCovers && cp > 0x20 && glyph(original, cp) == 0) originalCovers = false;
    }
    if (!nonAscii || originalCovers || !candidates) return original;
    for (std::size_t i = 0; i < candidateCount; ++i) {
        if (!candidates[i] || candidates[i] == original) continue;
        bool covers = true; offset = 0;
        while (offset < size) {
            std::int32_t cp = 0;
            // 上面的完整严格解码已验证同一不可变输入。
            if (!nextCodepoint(bytes, size, offset, cp) ||
                (cp > 0x20 && glyph(candidates[i], cp) == 0)) { covers = false; break; }
        }
        if (covers) return candidates[i];
    }
    return original;
}

inline bool borrowFont(const void *originalFont, const void *replacementTypeface,
                       void *outputFont) noexcept
{
    if (!originalFont || !replacementTypeface || !outputFont || originalFont == outputFont)
        return false;
    std::memcpy(outputFont, originalFont, kFontBytes);
    std::memcpy(outputFont, &replacementTypeface, sizeof(replacementTypeface));
    return true;
}
} // namespace cavalry_i18n::mac_timeline
