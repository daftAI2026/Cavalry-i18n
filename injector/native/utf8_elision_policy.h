/**
 * [INPUT]: 依赖既有严格UTF8解码器、完整源串与原厂省略片段，不依赖平台对象或调用ABI。
 * [OUTPUT]: 仅在原厂省略截断UTF8字符时返回完整字符前缀边界，其它span保持原样。
 * [POS]: macOS与Windows节点图共用的纯文字策略；字体和owner准入由各自平台适配器承担。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include "../cavalry_i18n_macos_timeline_font_policy.h"
#include <cstddef>
#include <cstring>
#include <limits>

namespace native_utf8_elision {
inline constexpr std::size_t kUnchangedTextSpan = std::numeric_limits<std::size_t>::max();
inline std::size_t repairedElisionPrefix(const unsigned char *source, std::size_t sourceSize,
                                        const void *text, std::size_t length, int encoding) noexcept {
    if (!source || !text || encoding != 0 || length <= 3) return kUnchangedTextSpan;
    const auto *span = static_cast<const unsigned char *>(text);
    const std::size_t prefix = length - 3;
    if (prefix >= sourceSize || std::memcmp(span + prefix, "...", 3) != 0 ||
        std::memcmp(span, source, prefix) != 0 || (source[prefix] & 0xc0) != 0x80)
        return kUnchangedTextSpan;
    std::size_t offset = 0, boundary = 0;
    while (offset < sourceSize) {
        std::int32_t scalar = 0;
        if (!cavalry_i18n::mac_timeline::nextCodepoint(source, sourceSize, offset, scalar))
            return kUnchangedTextSpan;
        if (offset <= prefix) boundary = offset;
    }
    return boundary;
}
}
