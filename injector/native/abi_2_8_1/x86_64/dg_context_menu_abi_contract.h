/**
 * [INPUT]: Official Cavalry 2.8.1 Intel ToolMenu/helper frames and Qt 6.9.2.
 * [OUTPUT]: Locks five helper callers and the shared QWidget::addAction import.
 * [POS]: Intel 2.8.1 DG menu profile; translation still requires exact source rows.
 * [PROTOCOL]: No global menu translation; preserve exact caller, frame, and stub bytes.
 */
#pragma once

#if !defined(CAVALRY_NATIVE_TARGET_281) || !defined(__x86_64__)
#error "The Intel DG context menu ABI is only valid for the 2.8.1 x86_64 profile."
#endif

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_dg_context_menu::contract {
inline constexpr char kExtensionUuid[] = "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kExtensionSha256[] =
    "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050";
inline constexpr char kQtVersion[] = "6.9.2";
inline constexpr char kQtWidgetsUuid[] = "0C194E6E-1E76-3FD4-83A3-9263616E2F3F";
inline constexpr char kQtWidgetsSha256[] =
    "49edad6d9347af5b5373d3768cccf661ef4876d5fe508ce25324df2aadfaf5b7";
inline constexpr char kQtGuiUuid[] = "C5244FEA-136F-3ED0-8F82-85A535F14F2B";
inline constexpr char kQtGuiSha256[] =
    "e5fb267a4a89f2231c76dff2c4b1d4566115acab847962192d1de855335ec669";
inline constexpr char kAddActionSymbol[] = "__ZN7QWidget9addActionEP7QAction";
inline constexpr char kActionTextSymbol[] = "__ZNK7QAction4textEv";
inline constexpr char kActionSetTextSymbol[] = "__ZN7QAction7setTextERK7QString";
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

inline constexpr std::uintptr_t kToolMenuAddMenuItemOffset = 0x0075fbf0;
inline constexpr std::uintptr_t kToolMenuFrameWindowOffset = 0x0075fbf0;
inline constexpr std::array<std::uint8_t, 24> kToolMenuFrameWindowBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56,
    0x41, 0x55, 0x41, 0x54, 0x53, 0x48, 0x81, 0xec,
    0x88, 0x00, 0x00, 0x00, 0x48, 0x8b, 0x05, 0xbd,
};
inline constexpr std::uintptr_t kToolMenuAddActionWindowOffset = 0x0075fe71;
inline constexpr std::uintptr_t kToolMenuAddActionCallOffset = 0x0075fe77;
inline constexpr std::uintptr_t kToolMenuAddActionReturnOffset = 0x0075fe7c;
inline constexpr std::uintptr_t kAddActionImportStubOffset = 0x00e32b00;
inline constexpr std::uintptr_t kAddActionGotOffset = 0x0112d0b8;
inline constexpr std::uintptr_t kAddActionExportOffset = 0x0005bd80;
inline constexpr std::uintptr_t kActionTextExportOffset = 0x0048a1c0;
inline constexpr std::uintptr_t kActionSetTextExportOffset = 0x0048a0f0;
inline constexpr std::array<std::uint8_t, 11> kToolMenuAddActionWindowBytes = {
    0x49, 0x8b, 0x3e, 0x48, 0x89, 0xde, 0xe8, 0x84,
    0x2c, 0x6d, 0x00,
};
inline constexpr std::array<std::uint8_t, 5> kToolMenuAddActionBranchBytes = {
    0xe8, 0x84, 0x2c, 0x6d, 0x00,
};
inline constexpr std::array<std::uint8_t, 6> kToolMenuAddActionImportStubBytes = {
    0xff, 0x25, 0xb2, 0xa5, 0x2f, 0x00,
};

inline constexpr std::uintptr_t kAddDuplicatorActionsOffset = 0x00cdf6c0;
inline constexpr std::uintptr_t kAddDuplicatorActionsFrameWindowOffset = 0x00cdf6c0;
inline constexpr std::array<std::uint8_t, 24> kAddDuplicatorActionsFrameWindowBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56,
    0x53, 0x48, 0x81, 0xec, 0x98, 0x00, 0x00, 0x00,
    0x49, 0x89, 0xf7, 0x49, 0x89, 0xfe, 0x48, 0x8b,
};
inline constexpr std::uintptr_t kAddDuplicatorActionsCallOffset = 0x00cdf755;
inline constexpr std::uintptr_t kAddDuplicatorActionsReturnOffset = 0x00cdf75a;
inline constexpr std::array<std::uint8_t, 5> kAddDuplicatorActionsBranchBytes = {
    0xe8, 0x96, 0x04, 0xa8, 0xff,
};

inline constexpr std::uintptr_t kAddGroupActionOffset = 0x00cdebe0;
inline constexpr std::uintptr_t kAddGroupActionFrameWindowOffset = 0x00cdebe0;
inline constexpr std::array<std::uint8_t, 24> kAddGroupActionFrameWindowBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x56, 0x53, 0x48,
    0x81, 0xec, 0xa0, 0x00, 0x00, 0x00, 0x48, 0x89,
    0xf0, 0x48, 0x8b, 0x0d, 0xd0, 0x1b, 0x45, 0x00,
};
inline constexpr std::uintptr_t kAddGroupActionCallOffset = 0x00cdec68;
inline constexpr std::uintptr_t kAddGroupActionReturnOffset = 0x00cdec6d;
inline constexpr std::array<std::uint8_t, 5> kAddGroupActionBranchBytes = {
    0xe8, 0x83, 0x0f, 0xa8, 0xff,
};

inline constexpr std::uintptr_t kAddLockActionOffset = 0x00cded40;
inline constexpr std::uintptr_t kAddLockActionFrameWindowOffset = 0x00cded40;
inline constexpr std::array<std::uint8_t, 24> kAddLockActionFrameWindowBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56,
    0x41, 0x55, 0x41, 0x54, 0x53, 0x48, 0x81, 0xec,
    0xa8, 0x00, 0x00, 0x00, 0x48, 0x89, 0xb5, 0x30,
};
inline constexpr std::uintptr_t kAddLockActionCallOffset = 0x00cdeece;
inline constexpr std::uintptr_t kAddLockActionReturnOffset = 0x00cdeed3;
inline constexpr std::array<std::uint8_t, 5> kAddLockActionBranchBytes = {
    0xe8, 0x1d, 0x0d, 0xa8, 0xff,
};

inline constexpr std::uintptr_t kAddShowInWindowActionsOffset = 0x00cde910;
inline constexpr std::uintptr_t kAddShowInWindowActionsFrameWindowOffset = 0x00cde910;
inline constexpr std::array<std::uint8_t, 24> kAddShowInWindowActionsFrameWindowBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56,
    0x41, 0x54, 0x53, 0x48, 0x81, 0xec, 0xa0, 0x00,
    0x00, 0x00, 0x49, 0x89, 0xf6, 0x49, 0x89, 0xff,
};
inline constexpr std::uintptr_t kAddShowAttributeEditorCallOffset = 0x00cde9ba;
inline constexpr std::uintptr_t kAddShowAttributeEditorReturnOffset = 0x00cde9bf;
inline constexpr std::array<std::uint8_t, 5> kAddShowAttributeEditorBranchBytes = {
    0xe8, 0x31, 0x12, 0xa8, 0xff,
};
inline constexpr std::uintptr_t kAddShowSceneWindowCallOffset = 0x00cdea6b;
inline constexpr std::uintptr_t kAddShowSceneWindowReturnOffset = 0x00cdea70;
inline constexpr std::array<std::uint8_t, 5> kAddShowSceneWindowBranchBytes = {
    0xe8, 0x80, 0x11, 0xa8, 0xff,
};

constexpr std::uint32_t readU32(const std::uint8_t *bytes) noexcept
{
    return static_cast<std::uint32_t>(bytes[0]) |
        (static_cast<std::uint32_t>(bytes[1]) << 8U) |
        (static_cast<std::uint32_t>(bytes[2]) << 16U) |
        (static_cast<std::uint32_t>(bytes[3]) << 24U);
}
constexpr std::int64_t signedRel32(std::uint32_t value) noexcept
{
    return (value & 0x80000000U) != 0
        ? static_cast<std::int64_t>(value) - 0x100000000LL
        : static_cast<std::int64_t>(value);
}
constexpr std::int64_t callTarget(std::uintptr_t callOffset,
                                  const std::uint8_t *bytes) noexcept
{
    return static_cast<std::int64_t>(callOffset) + 5 +
        signedRel32(readU32(bytes + 1U));
}
static_assert(kToolMenuAddActionCallOffset == kToolMenuAddActionWindowOffset + 6U);
static_assert(kToolMenuAddActionReturnOffset == kToolMenuAddActionCallOffset + 5U);
static_assert(kToolMenuAddActionWindowBytes[6] == 0xe8);
static_assert(callTarget(kToolMenuAddActionCallOffset,
                         kToolMenuAddActionBranchBytes.data()) ==
              static_cast<std::int64_t>(kAddActionImportStubOffset));
static_assert(kAddActionImportStubOffset + kToolMenuAddActionImportStubBytes.size() +
              signedRel32(readU32(kToolMenuAddActionImportStubBytes.data() + 2U)) ==
              kAddActionGotOffset);
static_assert(kAddDuplicatorActionsReturnOffset == kAddDuplicatorActionsCallOffset + 5U);
static_assert(kAddGroupActionReturnOffset == kAddGroupActionCallOffset + 5U);
static_assert(kAddLockActionReturnOffset == kAddLockActionCallOffset + 5U);
static_assert(kAddShowAttributeEditorReturnOffset == kAddShowAttributeEditorCallOffset + 5U);
static_assert(kAddShowSceneWindowReturnOffset == kAddShowSceneWindowCallOffset + 5U);
static_assert(callTarget(kAddDuplicatorActionsCallOffset,
                         kAddDuplicatorActionsBranchBytes.data()) ==
              static_cast<std::int64_t>(kToolMenuAddMenuItemOffset));
static_assert(callTarget(kAddGroupActionCallOffset,
                         kAddGroupActionBranchBytes.data()) ==
              static_cast<std::int64_t>(kToolMenuAddMenuItemOffset));
static_assert(callTarget(kAddLockActionCallOffset,
                         kAddLockActionBranchBytes.data()) ==
              static_cast<std::int64_t>(kToolMenuAddMenuItemOffset));
static_assert(callTarget(kAddShowAttributeEditorCallOffset,
                         kAddShowAttributeEditorBranchBytes.data()) ==
              static_cast<std::int64_t>(kToolMenuAddMenuItemOffset));
static_assert(callTarget(kAddShowSceneWindowCallOffset,
                         kAddShowSceneWindowBranchBytes.data()) ==
              static_cast<std::int64_t>(kToolMenuAddMenuItemOffset));
}  // namespace native_dg_context_menu::contract
