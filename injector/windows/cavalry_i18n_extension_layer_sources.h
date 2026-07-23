/**
 * [INPUT]: 不依赖 Qt 或厂商模块；只承载经静态采证的 ASCII source 常量
 * [OUTPUT]: 对外提供九条 helper source 与十三条 CustomListWidget placeholder source 的共享 ABI 合同
 * [POS]: injector/windows 的 ExtensionLayer 文本边界真相，供运行时 hook、无厂商单测和只读 vendor 合同共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>

namespace cavalry_i18n::extension_layer_contract {

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

static_assert(kStaticHelperSources.size() == 9);
static_assert(kStaticPlaceholderSources.size() == 13);

} // namespace cavalry_i18n::extension_layer_contract
