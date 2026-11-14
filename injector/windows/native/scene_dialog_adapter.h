/**
 * [INPUT]: 依赖Windows 2.8.1 QFileDialog调用窗、共享Save/Load caption策略与locale快照。
 * [OUTPUT]: 提供save wrapper和scene-only open wrapper的严格单次转发入口。
 * [POS]: runtime IAT hook与共享纯策略之间的薄边界；未知caller、source和locale均透传。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "scene_dialog_abi_contract.h"
#include "../../native/save_scene_caption_policy.h"

#include <cstdint>
#include <utility>

namespace native_windows_scene_dialog {
template <typename Original, typename Parent, typename Options, typename LocaleGetter>
QString forwardSaveCaption(
    Original &&original,
    bool contractReady,
    std::uintptr_t callerReturnPc,
    std::uintptr_t extensionBase,
    Parent *parent,
    const QString &caption,
    const QString &directory,
    const QString &filter,
    QString *selectedFilter,
    Options options,
    LocaleGetter &&locale)
{
    return native_save_scene_caption::forwardSaveCaption(
        std::forward<Original>(original), contractReady, callerReturnPc,
        extensionBase + contract::kSceneSaveFileDialogReturnRva, parent,
        caption, directory, filter, selectedFilter, options,
        std::forward<LocaleGetter>(locale));
}

template <typename Original, typename Parent, typename Options, typename LocaleGetter>
QString forwardOpenCaption(
    Original &&original,
    bool contractReady,
    std::uintptr_t callerReturnPc,
    std::uintptr_t sceneCallerReturnPc,
    std::uintptr_t extensionBase,
    Parent *parent,
    const QString &caption,
    const QString &directory,
    const QString &filter,
    QString *selectedFilter,
    Options options,
    LocaleGetter &&locale)
{
    const bool exactSceneCall = contractReady &&
        callerReturnPc == extensionBase + contract::kSceneOpenFileDialogReturnRva &&
        sceneCallerReturnPc == extensionBase + contract::kSceneOpenThunkReturnRva;
    return native_save_scene_caption::forwardOpenCaption(
        std::forward<Original>(original), exactSceneCall, callerReturnPc,
        extensionBase + contract::kSceneOpenFileDialogReturnRva, parent,
        caption, directory, filter, selectedFilter, options,
        std::forward<LocaleGetter>(locale));
}
}  // namespace native_windows_scene_dialog
