/**
 * [INPUT]: 不依赖 Qt 或厂商模块；只承载经静态采证的 ASCII source 常量
 * [OUTPUT]: 对外提供 helper/placeholder/MessageBar source、二十八条静态 text-path source（含 EditShapeTool 与 TransformTool 各三条已采证长操作前缀）、一条 CogTool 动态前缀及其精确 lookup context
 * [POS]: injector/windows 的 ExtensionLayer 文本边界真相，供运行时 hook、无厂商单测和只读 vendor 合同共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "../cavalry_i18n_translation_policy.h"

#include <array>
#include <cstddef>

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
inline constexpr char kEditShapeSplitCornerPrefix[] = "S + double click";
inline constexpr char kEditShapeSplitBezierPrefix[] = "S + click";
inline constexpr char kEditShapeDeleteBezierHandlePrefix[] = "X + click";
inline constexpr char kEnableSnapping[] = "Enable Snapping";
inline constexpr char kPan[] = "Pan";
inline constexpr char kPlayStop[] = "Play/ Stop";
inline constexpr char kDirectLayerSelection[] = "Direct Layer Selection";
inline constexpr char kInsertKeyframe[] = "Insert Keyframe";
inline constexpr char kTransformPanPrefix[] = "Space + click + drag";
inline constexpr char kTransformPlayStopPrefix[] = "Space";
inline constexpr char kTransformDirectSelectionPrefix[] = "Hold S";
inline constexpr char kTransformInsertKeyframePrefix[] = "S + click path";
inline constexpr char kClearPath[] = "Clear Path";
inline constexpr char kNewShape[] = "New Shape";
inline constexpr char kCreateAsMask[] = "Create as Mask";
inline constexpr char kStartNewShape[] = "Start New Shape";
inline constexpr char kStartNewContour[] = "Start New Contour";
inline constexpr char kCreateFromTheCentre[] = "Create from the Centre";
inline constexpr char kConstrainProportions[] = "Constrain Proportions";
inline constexpr auto &kPitchRadiusPrefix =
    cavalry_i18n::kCogToolPitchSource;

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
    { kEditShapeSplitCornerPrefix, kSplitPathCorner },
    { kEditShapeSplitBezierPrefix, kSplitPathBezier },
    { "H", kToggleTransformTool },
    { kEditShapeDeleteBezierHandlePrefix, kDeleteBezierHandle },
}};

// TransformTool 通过 GraphicsToolBase::toolHelp 返回这五组 pair，
// setupToolHelp 仍把 prefix/action 分开送入同一 getOrCreateTextPath；
// 三条含操作语义的长前缀允许翻译，纯键位 Shift/Space 保持原文。
inline constexpr std::array<ToolHelpSourcePair, 5>
    kTransformToolHelpPairs {{
        { "Shift", kEnableSnapping },
        { kTransformPanPrefix, kPan },
        { kTransformPlayStopPrefix, kPlayStop },
        { kTransformDirectSelectionPrefix, kDirectLayerSelection },
        { kTransformInsertKeyframePrefix, kInsertKeyframe },
    }};

// Pencil/Pen/Centre 工具同样把快捷键与动作分别生成 Path；
// 快捷键保持 ASCII 原文，只批准已由 vendor producer 证明的动作文本。
inline constexpr std::array<ToolHelpSourcePair, 3>
    kPencilToolHelpPairs {{
        { "Control + /", kClearPath },
        { "S", kNewShape },
        { "M", kCreateAsMask },
    }};

inline constexpr std::array<ToolHelpSourcePair, 3>
    kPenToolHelpPairs {{
        { "S", kStartNewShape },
        { "G", kStartNewContour },
        { "M", kCreateAsMask },
    }};

inline constexpr std::array<ToolHelpSourcePair, 2>
    kCentreToolHelpPairs {{
        { "Shift", kConstrainProportions },
        { "Alt", kCreateFromTheCentre },
    }};

inline constexpr std::array<const char *, 28> kStaticTextPathSources {{
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
    kClearPath,
    kNewShape,
    kCreateAsMask,
    kStartNewShape,
    kStartNewContour,
    kCreateFromTheCentre,
    kConstrainProportions,
    kTransformInsertKeyframePrefix,
    kTransformDirectSelectionPrefix,
    kTransformPanPrefix,
    kEditShapeSplitCornerPrefix,
    kEditShapeSplitBezierPrefix,
    kEditShapeDeleteBezierHandlePrefix,
}};

inline constexpr std::size_t kPitchRadiusSourceIndex =
    kStaticTextPathSources.size();
inline constexpr std::size_t kTextPathSourceCount =
    kStaticTextPathSources.size() + 1;

inline constexpr const char *textPathTranslationSource(
    std::size_t index) noexcept
{
    return index < kStaticTextPathSources.size()
        ? kStaticTextPathSources[index]
        : (index == kPitchRadiusSourceIndex
            ? kPitchRadiusPrefix
            : nullptr);
}

inline constexpr const char *textPathTranslationContext(
    std::size_t index) noexcept
{
    return index == kPitchRadiusSourceIndex
        ? cavalry_i18n::kCogToolPitchContext
        : nullptr;
}

static_assert(kStaticHelperSources.size() == 9);
static_assert(kStaticPlaceholderSources.size() == 13);
static_assert(kStaticMessageBarSources.size() == 1);
static_assert(kViewportQualitySources.size() == 4);
static_assert(kEditShapeToolHelpPairs.size() == 6);
static_assert(kTransformToolHelpPairs.size() == 5);
static_assert(kPencilToolHelpPairs.size() == 3);
static_assert(kPenToolHelpPairs.size() == 3);
static_assert(kCentreToolHelpPairs.size() == 2);
static_assert(kStaticTextPathSources.size() == 28);
static_assert(kTextPathSourceCount == 29);

} // namespace cavalry_i18n::extension_layer_contract
