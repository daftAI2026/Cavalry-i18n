/**
 * [INPUT]: 依赖Cavalry 2.8.1 arm64 TransformTool→ToolMenu调用链与Qt 6.9.2。
 * [OUTPUT]: 锁定五个菜单helper、ToolMenu::addMenuItem及唯一QWidget入口。
 * [POS]: 仅授予281 arm64的窄调用帧文字投影；不声明DG专属或模型写入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_dg_context_menu::contract {
inline constexpr char kExtensionUuid[] =
    "AF1367BD-2D7E-3EC0-A111-935E4881C655";
inline constexpr char kQtVersion[] = "6.9.2";
inline constexpr char kAddActionSymbol[] = "__ZN7QWidget9addActionEP7QAction";
inline constexpr char kToolMenuAddMenuItemSymbol[] =
    "__ZN8ToolMenu11addMenuItemERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEERKNS0_8functionIFvvEEERKNS0_8optionalINS9_IFbvEEEEE";
inline constexpr char kAddDuplicatorActionsSymbol[] =
    "__ZN7cavalry4tool20addDuplicatorActionsEP3ApiR8ToolMenu";
inline constexpr char kAddGroupActionSymbol[] =
    "__ZN7cavalry4tool14addGroupActionEP3ApiR8ToolMenu";
inline constexpr char kAddLockActionSymbol[] =
    "__ZN7cavalry4tool13addLockActionEP3ApiR8ToolMenu";
inline constexpr char kAddShowInWindowActionsSymbol[] =
    "__ZN7cavalry4tool22addShowInWindowActionsEP3ApiR8ToolMenu";

inline constexpr std::uintptr_t kToolMenuAddMenuItemOffset = 0x006cae8c;
inline constexpr std::uintptr_t kToolMenuFrameWindowOffset = 0x006cae8c;
inline constexpr std::array<std::uint8_t, 24> kToolMenuFrameWindowBytes = {
    0xff, 0x43, 0x02, 0xd1, 0xf8, 0x5f, 0x05, 0xa9,
    0xf6, 0x57, 0x06, 0xa9, 0xf4, 0x4f, 0x07, 0xa9,
    0xfd, 0x7b, 0x08, 0xa9, 0xfd, 0x03, 0x02, 0x91,
};
inline constexpr std::uintptr_t kToolMenuAddActionWindowOffset = 0x006cb10c;
inline constexpr std::uintptr_t kToolMenuAddActionCallOffset = 0x006cb114;
inline constexpr std::uintptr_t kToolMenuAddActionReturnOffset = 0x006cb118;
inline constexpr std::uintptr_t kAddActionImportStubOffset = 0x00d21f10;
inline constexpr std::array<std::uint8_t, 12> kToolMenuAddActionWindowBytes = {
    0x80, 0x02, 0x40, 0xf9, 0xe1, 0x03, 0x13, 0xaa,
    0x7f, 0x5b, 0x19, 0x94,
};
inline constexpr std::array<std::uint8_t, 4> kToolMenuAddActionBranchBytes = {
    0x7f, 0x5b, 0x19, 0x94,
};

inline constexpr std::uintptr_t kAddDuplicatorActionsOffset = 0x00be0cc0;
inline constexpr std::uintptr_t kAddDuplicatorActionsFrameWindowOffset = 0x00be0cc0;
inline constexpr std::array<std::uint8_t, 16> kAddDuplicatorActionsFrameWindowBytes = {
    0xff, 0x43, 0x02, 0xd1, 0xf4, 0x4f, 0x07, 0xa9,
    0xfd, 0x7b, 0x08, 0xa9, 0xfd, 0x03, 0x02, 0x91,
};
inline constexpr std::uintptr_t kAddDuplicatorActionsCallOffset = 0x00be0d50;
inline constexpr std::uintptr_t kAddDuplicatorActionsReturnOffset = 0x00be0d54;
inline constexpr std::array<std::uint8_t, 4> kAddDuplicatorActionsBranchBytes = {
    0x4f, 0xa8, 0xeb, 0x97,
};

inline constexpr std::uintptr_t kAddGroupActionOffset = 0x00be0258;
inline constexpr std::uintptr_t kAddGroupActionFrameWindowOffset = 0x00be0258;
inline constexpr std::array<std::uint8_t, 16> kAddGroupActionFrameWindowBytes = {
    0xff, 0x43, 0x02, 0xd1, 0xf4, 0x4f, 0x07, 0xa9,
    0xfd, 0x7b, 0x08, 0xa9, 0xfd, 0x03, 0x02, 0x91,
};
inline constexpr std::uintptr_t kAddGroupActionCallOffset = 0x00be02cc;
inline constexpr std::uintptr_t kAddGroupActionReturnOffset = 0x00be02d0;
inline constexpr std::array<std::uint8_t, 4> kAddGroupActionBranchBytes = {
    0xf0, 0xaa, 0xeb, 0x97,
};

inline constexpr std::uintptr_t kAddLockActionOffset = 0x00be03d8;
inline constexpr std::uintptr_t kAddLockActionFrameWindowOffset = 0x00be03d8;
inline constexpr std::array<std::uint8_t, 32> kAddLockActionFrameWindowBytes = {
    0xff, 0x43, 0x03, 0xd1, 0xfc, 0x6f, 0x07, 0xa9,
    0xfa, 0x67, 0x08, 0xa9, 0xf8, 0x5f, 0x09, 0xa9,
    0xf6, 0x57, 0x0a, 0xa9, 0xf4, 0x4f, 0x0b, 0xa9,
    0xfd, 0x7b, 0x0c, 0xa9, 0xfd, 0x03, 0x03, 0x91,
};
inline constexpr std::uintptr_t kAddLockActionCallOffset = 0x00be0598;
inline constexpr std::uintptr_t kAddLockActionReturnOffset = 0x00be059c;
inline constexpr std::array<std::uint8_t, 4> kAddLockActionBranchBytes = {
    0x3d, 0xaa, 0xeb, 0x97,
};

inline constexpr std::uintptr_t kAddShowInWindowActionsOffset = 0x00bdffbc;
inline constexpr std::uintptr_t kAddShowInWindowActionsFrameWindowOffset = 0x00bdffbc;
inline constexpr std::array<std::uint8_t, 16> kAddShowInWindowActionsFrameWindowBytes = {
    0xff, 0x43, 0x02, 0xd1, 0xf4, 0x4f, 0x07, 0xa9,
    0xfd, 0x7b, 0x08, 0xa9, 0xfd, 0x03, 0x02, 0x91,
};
inline constexpr std::uintptr_t kAddShowAttributeEditorCallOffset = 0x00be004c;
inline constexpr std::uintptr_t kAddShowAttributeEditorReturnOffset = 0x00be0050;
inline constexpr std::array<std::uint8_t, 4> kAddShowAttributeEditorBranchBytes = {
    0x90, 0xab, 0xeb, 0x97,
};

inline constexpr std::uintptr_t kAddShowSceneWindowCallOffset = 0x00be0118;
inline constexpr std::uintptr_t kAddShowSceneWindowReturnOffset = 0x00be011c;
inline constexpr std::array<std::uint8_t, 4> kAddShowSceneWindowBranchBytes = {
    0x5d, 0xab, 0xeb, 0x97,
};

constexpr std::uint32_t arm64Instruction(
    const std::array<std::uint8_t, 4> &bytes) noexcept
{
    return static_cast<std::uint32_t>(bytes[0]) |
        (static_cast<std::uint32_t>(bytes[1]) << 8U) |
        (static_cast<std::uint32_t>(bytes[2]) << 16U) |
        (static_cast<std::uint32_t>(bytes[3]) << 24U);
}

constexpr std::int64_t arm64BranchDisplacement(
    const std::array<std::uint8_t, 4> &bytes) noexcept
{
    const std::uint32_t instruction = arm64Instruction(bytes);
    std::int64_t immediate = instruction & 0x03ffffffU;
    if ((immediate & 0x02000000LL) != 0) immediate -= 0x04000000LL;
    return immediate * 4;
}

constexpr std::uintptr_t arm64BranchTarget(
    std::uintptr_t callOffset,
    const std::array<std::uint8_t, 4> &bytes) noexcept
{
    return static_cast<std::uintptr_t>(
        static_cast<std::int64_t>(callOffset) + arm64BranchDisplacement(bytes));
}

static_assert(kToolMenuAddActionReturnOffset == kToolMenuAddActionCallOffset + 4U);
static_assert(kToolMenuAddActionCallOffset == kToolMenuAddActionWindowOffset + 8U);
static_assert(kAddDuplicatorActionsReturnOffset == kAddDuplicatorActionsCallOffset + 4U);
static_assert(kAddGroupActionReturnOffset == kAddGroupActionCallOffset + 4U);
static_assert(kAddLockActionReturnOffset == kAddLockActionCallOffset + 4U);
static_assert(kAddShowAttributeEditorReturnOffset == kAddShowAttributeEditorCallOffset + 4U);
static_assert(kAddShowSceneWindowReturnOffset == kAddShowSceneWindowCallOffset + 4U);
static_assert(arm64BranchTarget(kAddDuplicatorActionsCallOffset,
                                kAddDuplicatorActionsBranchBytes) ==
              kToolMenuAddMenuItemOffset);
static_assert(arm64BranchTarget(kAddGroupActionCallOffset,
                                kAddGroupActionBranchBytes) ==
              kToolMenuAddMenuItemOffset);
static_assert(arm64BranchTarget(kAddLockActionCallOffset,
                                kAddLockActionBranchBytes) ==
              kToolMenuAddMenuItemOffset);
static_assert(arm64BranchTarget(kAddShowAttributeEditorCallOffset,
                                kAddShowAttributeEditorBranchBytes) ==
              kToolMenuAddMenuItemOffset);
static_assert(arm64BranchTarget(kAddShowSceneWindowCallOffset,
                                kAddShowSceneWindowBranchBytes) ==
              kToolMenuAddMenuItemOffset);
static_assert(arm64BranchTarget(kToolMenuAddActionCallOffset,
                                kToolMenuAddActionBranchBytes) ==
              kAddActionImportStubOffset);
}  // namespace native_dg_context_menu::contract

#endif  // CAVALRY_NATIVE_TARGET_281 && __aarch64__
