/**
 * [INPUT]: 依赖官方Cavalry 2.8.1 ExtensionLayer PE与Qt6Widgets QFileDialog导入。
 * [OUTPUT]: 锁定scene-save/open IAT返回位、Load .cv构造点和已知非scene文件对话框调用位。
 * [POS]: Windows scene dialog适配的只读二进制身份；不依赖Qt私有布局或用户安装路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstdint>
#include <string_view>

namespace native_windows_scene_dialog::contract {
inline constexpr std::string_view kExtensionSha256 =
    "c2f0fcf5323f90fbd3b1d9d0375bc603e18dc070eae8ff3df72090d8ac858954";

inline constexpr std::uintptr_t kGetOpenFileNameIatRva = 0x01fc7840;
inline constexpr std::uintptr_t kGetSaveFileNameIatRva = 0x01fc7848;

inline constexpr std::uintptr_t kSceneOpenFileDialogCallRva = 0x00c78b2c;
inline constexpr std::uintptr_t kSceneOpenFileDialogReturnRva = 0x00c78b32;
inline constexpr std::uintptr_t kSceneOpenFileDialogWrapperRva = 0x00c789f0;
inline constexpr std::uintptr_t kSceneSaveFileDialogCallRva = 0x00c79136;
inline constexpr std::uintptr_t kSceneSaveFileDialogReturnRva = 0x00c7913c;

inline constexpr std::uintptr_t kSceneOpenBuilderRva = 0x00b55b90;
inline constexpr std::uintptr_t kLoadCaptionImmediateRva = 0x00b55c26;
inline constexpr std::uintptr_t kSceneOpenThunkCallRva = 0x00b55c44;
inline constexpr std::uintptr_t kSceneOpenThunkReturnRva = 0x00b55c49;
inline constexpr std::uintptr_t kSceneOpenThunkRva = 0x0000e34f;

// 这些同IAT调用属于预设或Snippet文件操作，必须留给Qt原样处理。
inline constexpr std::uintptr_t kPresetOpenFileDialogReturnRva = 0x00c3770a;
inline constexpr std::uintptr_t kSnippetImportFileDialogReturnRva = 0x013d32cc;
inline constexpr std::uintptr_t kPresetExportFileDialogReturnRva = 0x00c37ae0;
inline constexpr std::uintptr_t kSnippetExportFileDialogReturnRva = 0x013d374f;

static_assert(kSceneOpenFileDialogReturnRva == kSceneOpenFileDialogCallRva + 6U);
static_assert(kSceneSaveFileDialogReturnRva == kSceneSaveFileDialogCallRva + 6U);
static_assert(kSceneOpenThunkReturnRva == kSceneOpenThunkCallRva + 5U);
}  // namespace native_windows_scene_dialog::contract
