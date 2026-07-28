/**
 * [INPUT]: 依赖生成翻译表中的原始 context/source 键
 * [OUTPUT]: 对外提供自绘与受控动态 Qt 表面必须保留的精确 context/source 常量及 source-only 排除判定
 * [POS]: injector 的跨平台翻译查询策略；让自绘专用词条和动态模板只由已验证显示槽消费，普通 QWidget 与用户文本保持原文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <string_view>

namespace cavalry_i18n {

inline constexpr char kCogToolPitchContext[] = "CogTool";
inline constexpr char kCogToolPitchSource[] = "Pitch Radius: ";
inline constexpr char kColorSettingsContext[] = "ColorSettingsDialog";
inline constexpr char kColorSettingsAutomaticSource[] = "Automatic (%1)";
inline constexpr char kSingleIndexContext[] = "acrStringSingleIndex";
inline constexpr char kSingleIndexPlaceholderSource[] =
    "Enter an index, e.g: 0";
inline constexpr char kMeshExplorerContext[] = "MeshExplorerRowWidget";
inline constexpr char kMeshExplorerIndexPrefixSource[] = "Index: ";
inline constexpr char kMeshExplorerPointsSource[] = "Points: %1";
inline constexpr char kMeshExplorerVerbsSource[] = "Verbs: %1";
inline constexpr char kMeshExplorerChildMeshesSource[] = "Child Meshes: %1";

inline constexpr bool requiresExactTranslationContext(
    const char *context,
    const char *sourceText) noexcept
{
    if (context == nullptr || sourceText == nullptr) {
        return false;
    }

    const std::string_view contextView(context);
    const std::string_view sourceView(sourceText);
    if (contextView == kCogToolPitchContext) {
        return sourceView == kCogToolPitchSource;
    }
    if (contextView == kColorSettingsContext) {
        return sourceView == kColorSettingsAutomaticSource;
    }
    if (contextView == kSingleIndexContext) {
        return sourceView == kSingleIndexPlaceholderSource;
    }
    if (contextView == kMeshExplorerContext) {
        return sourceView == kMeshExplorerIndexPrefixSource
            || sourceView == kMeshExplorerPointsSource
            || sourceView == kMeshExplorerVerbsSource
            || sourceView == kMeshExplorerChildMeshesSource;
    }
    return false;
}

} // namespace cavalry_i18n
