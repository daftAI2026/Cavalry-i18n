/**
 * [INPUT]: 依赖签名官方2.8.1 ExtensionLayer导出、五个菜单source caller与Qt IAT。
 * [OUTPUT]: 锁定ToolMenu::addMenuItem到QWidget::addAction的Windows x64调用窗。
 * [POS]: 供DG窄投影和只读binary contract共享；未知源与其他菜单不获准。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <string_view>

namespace native_dg_context_menu::contract {
inline constexpr char kExtensionSha256[] =
    "c2f0fcf5323f90fbd3b1d9d0375bc603e18dc070eae8ff3df72090d8ac858954";
inline constexpr char kToolMenuAddMenuItemSymbol[] =
    "?addMenuItem@ToolMenu@@QEAAXAEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@AEBV?$function@$$A6AXXZ@3@AEBV?$optional@V?$function@$$A6A_NXZ@std@@@3@@Z";
inline constexpr char kQWidgetAddActionSymbol[] =
    "?addAction@QWidget@@QEAAXPEAVQAction@@@Z";

inline constexpr std::uintptr_t kToolMenuAddMenuItemThunkOffset = 0x00018cc8;
inline constexpr std::uintptr_t kToolMenuAddMenuItemOffset = 0x00c8b650;
inline constexpr std::uintptr_t kToolMenuAddActionCallOffset = 0x00c8b8e2;
inline constexpr std::uintptr_t kToolMenuAddActionReturnOffset = 0x00c8b8e8;
inline constexpr std::uintptr_t kAddActionImportRva = 0x01fc9328;

// 沿共享生成器的callsite常量命名，仅由Windows返回位赋值，不复制译文。
inline constexpr std::uintptr_t kAddDuplicatorActionsReturnOffset = 0x015df01b;
inline constexpr std::uintptr_t kAddGroupActionReturnOffset = 0x015dd44a;
inline constexpr std::uintptr_t kAddLockActionReturnOffset = 0x015dd7b2;
inline constexpr std::uintptr_t kAddShowAttributeEditorReturnOffset = 0x015dd062;
inline constexpr std::uintptr_t kAddShowSceneWindowReturnOffset = 0x015dd13d;
inline constexpr std::array<std::uintptr_t, 5> kHelperReturnOffsets = {
    kAddDuplicatorActionsReturnOffset,
    kAddGroupActionReturnOffset,
    kAddLockActionReturnOffset,
    kAddShowAttributeEditorReturnOffset,
    kAddShowSceneWindowReturnOffset,
};

inline constexpr std::uintptr_t kShowAttributeSourceRva = 0x0193fafe;
inline constexpr std::uintptr_t kShowSceneSourceRva = 0x0193fb1c;
inline constexpr std::uintptr_t kUnlockSelectedSourceRva = 0x0193fb47;
inline constexpr std::uintptr_t kLockSelectedSourceRva = 0x0193fb5a;
inline constexpr std::uintptr_t kAddDuplicatorSourceRva = 0x0193fb7d;

static_assert(kToolMenuAddActionReturnOffset == kToolMenuAddActionCallOffset + 6U);
static_assert(kAddDuplicatorActionsReturnOffset != kAddGroupActionReturnOffset);
static_assert(kAddGroupActionReturnOffset != kAddLockActionReturnOffset);
static_assert(kAddLockActionReturnOffset != kAddShowAttributeEditorReturnOffset);
static_assert(kAddShowAttributeEditorReturnOffset != kAddShowSceneWindowReturnOffset);
}  // namespace native_dg_context_menu::contract
