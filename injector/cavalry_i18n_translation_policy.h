/**
 * [INPUT]: 依赖生成翻译表中的原始 context/source 键
 * [OUTPUT]: 对外提供必须保留精确 context、不得进入 source-only 显示兜底的共享判定
 * [POS]: injector 的跨平台翻译查询策略；让自绘专用词条只由已验证调用链消费，普通 QWidget 与用户文本保持原文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <string_view>

namespace cavalry_i18n {

inline constexpr char kCogToolPitchContext[] = "CogTool";
inline constexpr char kCogToolPitchSource[] = "Pitch Radius: ";

inline constexpr bool requiresExactTranslationContext(
    const char *context,
    const char *sourceText) noexcept
{
    return context != nullptr
        && sourceText != nullptr
        && std::string_view(context) == kCogToolPitchContext
        && std::string_view(sourceText) == kCogToolPitchSource;
}

} // namespace cavalry_i18n
