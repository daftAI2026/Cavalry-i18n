/**
 * [INPUT]: 依赖 Cavalry 2.8.1 arm64 `addEasingMenu` 调用窗与 Qt 6.9.2 导出。
 * [OUTPUT]: 锁定 Extension、QtWidgets、QtGui 的 UUID、偏移与机器码。
 * [POS]: Magic Easing 显示投影的构造期 ABI 门；不声明运行时消费。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_easing_menu::contract {
inline constexpr char kExtensionUuid[] =
    "AF1367BD-2D7E-3EC0-A111-935E4881C655";
inline constexpr char kQtWidgetsUuid[] =
    "01652E29-047E-3528-9DC2-1BD084292E50";
inline constexpr char kQtGuiUuid[] =
    "3786AFD4-5351-3B21-A2DF-06A901C3C6EE";
inline constexpr char kQtVersion[] = "6.9.2";

inline constexpr char kAddActionSymbol[] = "__ZN7QWidget9addActionEP7QAction";
inline constexpr char kActionTextSymbol[] = "__ZNK7QAction4textEv";
inline constexpr char kActionSetTextSymbol[] = "__ZN7QAction7setTextERK7QString";

inline constexpr std::uintptr_t kAddActionCallWindowOffset = 0x00688ed0;
inline constexpr std::uintptr_t kAddActionCallerOffset = 0x00688ed4;
inline constexpr std::uintptr_t kAddActionReturnOffset = 0x00688ed8;
inline constexpr std::uintptr_t kAddActionImportStubOffset = 0x00d21f10;
inline constexpr std::uintptr_t kAddActionExportOffset = 0x00053864;
inline constexpr std::uintptr_t kActionTextExportOffset = 0x00407ecc;
inline constexpr std::uintptr_t kActionSetTextExportOffset = 0x00407dfc;
inline constexpr std::size_t kPresetSourceCount = 20;

inline constexpr std::array<std::uint8_t, 8> kAddActionCallWindowBytes = {
    0xe1, 0x03, 0x1b, 0xaa, 0x0f, 0x64, 0x1a, 0x94,
};
inline constexpr std::array<std::uint8_t, 4> kAddActionBranchBytes = {
    kAddActionCallWindowBytes[4], kAddActionCallWindowBytes[5],
    kAddActionCallWindowBytes[6], kAddActionCallWindowBytes[7],
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

static_assert(kAddActionReturnOffset == kAddActionCallerOffset + 4U);
static_assert(kAddActionCallWindowOffset + 4U == kAddActionCallerOffset);
static_assert((arm64Instruction(kAddActionBranchBytes) & 0xfc000000U) ==
              0x94000000U);
static_assert(static_cast<std::int64_t>(kAddActionCallerOffset) +
              arm64BranchDisplacement(kAddActionBranchBytes) ==
              static_cast<std::int64_t>(kAddActionImportStubOffset));
}  // namespace native_easing_menu::contract
