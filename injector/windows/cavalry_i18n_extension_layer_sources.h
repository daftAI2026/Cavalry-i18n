/**
 * [INPUT]: 不依赖 Qt 或厂商模块；只承载经静态采证的 ASCII source 常量
 * [OUTPUT]: 对外提供九条 QWidget helper、十三条 CustomListWidget placeholder、一条 MessageBar 日志，以及十五条 Skia text-path source 的共享 ABI 合同
 * [POS]: injector/windows 的 ExtensionLayer 文本边界真相，供运行时 hook、无厂商单测和只读 vendor 合同共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>

namespace cavalry_i18n::extension_layer_contract {

struct ToolHelpSourcePair {
    const char *prefix;
    const char *action;
};

inline constexpr std::array<const char *, 9> kStaticHelperSources {{
    "Double click here to import Assets.",
    "Drag layers here to see their settings.",
    "Use the Create menu to add a layer to your Composition.",
    "Select layers to see their settings",
    "Drag an Attribute connection here.",
    "Reset Shortcuts in progress. Please restart Cavalry to continue.",
    "Drag colors here.",
    "Drag in Compositions or use the '+ Current Composition' button.",
    "Right Click on Attributes to add them to this window.",
}};

inline constexpr std::array<const char *, 13> kStaticPlaceholderSources {{
    "No Connections.",
    "Right click to add a Falloff",
    "Right click to add a Modifier",
    "Right click to add a Shader",
    "Drag at least two Shapes here",
    "Drag a Shape here",
    "No presets yet.",
    "Drag colours here.",
    "Drag colors here.",
    "No Project Set.",
    "No bookmarks yet.",
    "Organise Pre-Comp Overrides here.",
    "Drag some JavaScript here to make a Snippet.",
}};

inline constexpr char kPencilCameraDistanceWarning[] =
    "Pencil Tool: You're drawing too far away from the camera, try drawing in 2d.";
inline constexpr std::array<const char *, 1> kStaticMessageBarSources {{
    kPencilCameraDistanceWarning,
}};

inline constexpr char kViewportQualityHigh[] = "Viewport Quality: High";
inline constexpr char kViewportQualityLow[] = "Viewport Quality: Low";
inline constexpr char kViewportQualityLowest[] = "Viewport Quality: Lowest";
inline constexpr char kViewportQualityBalanced[] = "Viewport Quality: Balanced";
inline constexpr char kDisableSnapping[] = "Disable Snapping";
inline constexpr char kEnableBezierAngleSnapping[] =
    "Enable B\xC3\xA9zier Angle Snapping";
inline constexpr char kSplitPathCorner[] = "Split Path (Corner)";
inline constexpr char kSplitPathBezier[] = "Split Path (B\xC3\xA9zier)";
inline constexpr char kToggleTransformTool[] = "Toggle Transform Tool";
inline constexpr char kDeleteBezierHandle[] =
    "Delete B\xC3\xA9zier Handle";
inline constexpr char kEnableSnapping[] = "Enable Snapping";
inline constexpr char kPan[] = "Pan";
inline constexpr char kPlayStop[] = "Play/ Stop";
inline constexpr char kDirectLayerSelection[] = "Direct Layer Selection";
inline constexpr char kInsertKeyframe[] = "Insert Keyframe";

// `[viewportQuality - 1]` 的 vendor 跳转表顺序；越界值回退 High。
inline constexpr std::array<const char *, 4> kViewportQualitySources {{
    kViewportQualityLow,
    kViewportQualityLowest,
    kViewportQualityHigh,
    kViewportQualityBalanced,
}};

// 快捷键前缀与动作文本由 EditShapeTool 分开存储、分开生成 Path。
inline constexpr std::array<ToolHelpSourcePair, 6> kEditShapeToolHelpPairs {{
    { "Control", kDisableSnapping },
    { "Shift", kEnableBezierAngleSnapping },
    { "S + double click", kSplitPathCorner },
    { "S + click", kSplitPathBezier },
    { "H", kToggleTransformTool },
    { "X + click", kDeleteBezierHandle },
}};

// TransformTool 通过 GraphicsToolBase::toolHelp 返回这五组 pair，
// setupToolHelp 仍把 prefix/action 分开送入同一 getOrCreateTextPath。
inline constexpr std::array<ToolHelpSourcePair, 5>
    kTransformToolHelpPairs {{
        { "Shift", kEnableSnapping },
        { "Space + click + drag", kPan },
        { "Space", kPlayStop },
        { "Hold S", kDirectLayerSelection },
        { "S + click path", kInsertKeyframe },
    }};

inline constexpr std::array<const char *, 15> kStaticTextPathSources {{
    kViewportQualityHigh,
    kViewportQualityLow,
    kViewportQualityLowest,
    kViewportQualityBalanced,
    kDisableSnapping,
    kEnableBezierAngleSnapping,
    kSplitPathCorner,
    kSplitPathBezier,
    kToggleTransformTool,
    kDeleteBezierHandle,
    kEnableSnapping,
    kPan,
    kPlayStop,
    kDirectLayerSelection,
    kInsertKeyframe,
}};

static_assert(kStaticHelperSources.size() == 9);
static_assert(kStaticPlaceholderSources.size() == 13);
static_assert(kStaticMessageBarSources.size() == 1);
static_assert(kViewportQualitySources.size() == 4);
static_assert(kEditShapeToolHelpPairs.size() == 6);
static_assert(kTransformToolHelpPairs.size() == 5);
static_assert(kStaticTextPathSources.size() == 15);

} // namespace cavalry_i18n::extension_layer_contract
