/**
 * [INPUT]: 依赖生成翻译表中的原始 context/source 键
 * [OUTPUT]: 对外提供自绘/动态 Qt 表面的精确 context/source 常量、8 条跨平台 owner-aware key、macOS TagHeader 邻接标签/Assets 动态菜单模板 key，以及具体快捷键与旧 MenuBarManager 静态前缀的 exact-only 判定
 * [POS]: injector 的翻译查询策略；共享专用词条与 macOS 已采证而 Windows producer 待证的邻接表面分层退出 source fallback，只能由精确 Qt 上下文或已验证的平台 owner 回补消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
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
inline constexpr char kSearchBarContainerContext[] =
    "SearchBarContainerWidget";
inline constexpr char kSearchBarAddLayerSource[] =
    "Add a layer to your Composition (%1)";
inline constexpr char kTagHeaderContext[] = "cavalry::TagHeader";
inline constexpr char kTagHeaderAddTagSource[] = "Add Tag:";
inline constexpr char kTagHeaderAssignSelectionSource[] =
    "Assign Tag to Selection: ";
inline constexpr char kColorWindowContext[] = "ColorWindow";
inline constexpr char kColorWindowSaveSource[] = "Save...";
inline constexpr char kAssetsWindowContext[] = "assets::Window";
inline constexpr char kAssetsWindowReplaceSource[] = "Replace...";
inline constexpr char kAssetsWindowCreateCompositionSource[] =
    "Create Composition based on %1";
inline constexpr char kMenuBarManagerContext[] = "MenuBarManager";
inline constexpr char kMenuBarManagerCreateCompositionPrefixSource[] =
    "Create Composition based on";
inline constexpr char kSearchBarAddLayerShortcutSource[] =
    "Add a layer to your Composition (⌘.)";
inline constexpr char kProjectStatisticsComputeTimeSource[] = "Compute Time:";
inline constexpr char kProjectStatisticsDrawTimeSource[] = "Draw Time:";
inline constexpr char kProjectStatisticsTotalNodesSource[] = "Total Nodes:";
inline constexpr char kTrackingWindowTitleSource[] = "Tracking...";

struct ScopedTranslationKey
{
    std::string_view context;
    std::string_view source;
};

inline constexpr ScopedTranslationKey kSearchBarAddLayerKey {
    kSearchBarContainerContext,
    kSearchBarAddLayerSource,
};
inline constexpr ScopedTranslationKey kTagHeaderAddTagKey {
    kTagHeaderContext,
    kTagHeaderAddTagSource,
};
inline constexpr ScopedTranslationKey kTagHeaderAssignSelectionKey {
    kTagHeaderContext,
    kTagHeaderAssignSelectionSource,
};
inline constexpr ScopedTranslationKey kColorWindowSaveKey {
    kColorWindowContext,
    kColorWindowSaveSource,
};
inline constexpr ScopedTranslationKey kAssetsWindowReplaceKey {
    kAssetsWindowContext,
    kAssetsWindowReplaceSource,
};
inline constexpr ScopedTranslationKey kAssetsWindowCreateCompositionKey {
    kAssetsWindowContext,
    kAssetsWindowCreateCompositionSource,
};
inline constexpr ScopedTranslationKey kProjectStatisticsComputeTimeKey {
    kMenuBarManagerContext,
    kProjectStatisticsComputeTimeSource,
};
inline constexpr ScopedTranslationKey kProjectStatisticsDrawTimeKey {
    kMenuBarManagerContext,
    kProjectStatisticsDrawTimeSource,
};
inline constexpr ScopedTranslationKey kProjectStatisticsTotalNodesKey {
    kMenuBarManagerContext,
    kProjectStatisticsTotalNodesSource,
};
inline constexpr ScopedTranslationKey kTrackingWindowTitleKey {
    kMenuBarManagerContext,
    kTrackingWindowTitleSource,
};

inline constexpr std::array<const ScopedTranslationKey *, 8>
    kCrossPlatformScopedTranslationKeys {{
        &kSearchBarAddLayerKey,
        &kTagHeaderAddTagKey,
        &kColorWindowSaveKey,
        &kAssetsWindowReplaceKey,
        &kProjectStatisticsComputeTimeKey,
        &kProjectStatisticsDrawTimeKey,
        &kProjectStatisticsTotalNodesKey,
        &kTrackingWindowTitleKey,
    }};

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
    if (contextView == kMenuBarManagerContext
        && (sourceView == kSearchBarAddLayerShortcutSource
            || sourceView
                == kMenuBarManagerCreateCompositionPrefixSource)) {
        return true;
    }
    for (const ScopedTranslationKey *key
         : kCrossPlatformScopedTranslationKeys) {
        if (contextView == key->context && sourceView == key->source) {
            return true;
        }
    }
    return false;
}

static_assert(
    requiresExactTranslationContext(
        kMenuBarManagerContext,
        kProjectStatisticsComputeTimeSource)
    && requiresExactTranslationContext(
        kMenuBarManagerContext,
        kProjectStatisticsDrawTimeSource)
    && requiresExactTranslationContext(
        kMenuBarManagerContext,
        kProjectStatisticsTotalNodesSource)
    && requiresExactTranslationContext(
        kMenuBarManagerContext,
        kTrackingWindowTitleSource),
    "MenuBarManager owner-scoped surfaces must never enter source fallback");

inline constexpr bool requiresMacOwnerTranslationContext(
    const char *context,
    const char *sourceText) noexcept
{
    if (context == nullptr || sourceText == nullptr) {
        return false;
    }

    const std::string_view contextView(context);
    const std::string_view sourceView(sourceText);
    return (contextView == kTagHeaderAssignSelectionKey.context
            && sourceView == kTagHeaderAssignSelectionKey.source)
        || (contextView == kAssetsWindowCreateCompositionKey.context
            && sourceView == kAssetsWindowCreateCompositionKey.source);
}

} // namespace cavalry_i18n
