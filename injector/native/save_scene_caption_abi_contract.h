/**
 * [INPUT]: 依赖官方2.8.1 arm64及既有x86 QFileDialog调用窗、QtWidgets UUID与导出符号。
 * [OUTPUT]: 锁定QString返回槽、四个引用参数、精确caption caller及BL目标。
 * [POS]: 两个caption共用同一QFileDialog调用边界；不改全局标题或文件名。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_save_scene_caption::contract {
#if defined(__x86_64__)
inline constexpr char kExtensionUuid[] =
    "DB431633-99A8-3C32-89EF-3378D4B418EA";
inline constexpr char kQtWidgetsUuid[] =
    "0C194E6E-1E76-3FD4-83A3-9263616E2F3F";
inline constexpr char kQtVersion[] = "6.9.2";
inline constexpr char kGetSaveFileNameSymbol[] =
    "__ZN11QFileDialog15getSaveFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE";
inline constexpr std::uintptr_t kCallWindowOffset = 0x007bb908;
inline constexpr std::uintptr_t kCallOffset = 0x007bb931;
inline constexpr std::uintptr_t kReturnOffset = 0x007bb936;
inline constexpr std::uintptr_t kImportStubOffset = 0x00f3ff1b;
inline constexpr std::uintptr_t kQtWidgetsExportOffset = 0x002aeab0;
inline constexpr std::array<std::uint8_t, 46> kCallWindowBytes = {
    0xc7, 0x04, 0x24, 0x00, 0x00, 0x00, 0x00,
    0x48, 0x8d, 0xbd, 0x30, 0xff, 0xff, 0xff,
    0x48, 0x8d, 0x95, 0x48, 0xff, 0xff, 0xff,
    0x48, 0x8d, 0x8d, 0x60, 0xff, 0xff, 0xff,
    0x4c, 0x8d, 0x85, 0x78, 0xff, 0xff, 0xff,
    0x4c, 0x89, 0xe6, 0x45, 0x31, 0xc9,
    0xe8, 0xe5, 0x45, 0x78, 0x00,
};
constexpr std::uint32_t x86ReadU32(
    const std::array<std::uint8_t, 46> &bytes, std::size_t offset) noexcept
{
    return static_cast<std::uint32_t>(bytes[offset]) |
        (static_cast<std::uint32_t>(bytes[offset + 1U]) << 8U) |
        (static_cast<std::uint32_t>(bytes[offset + 2U]) << 16U) |
        (static_cast<std::uint32_t>(bytes[offset + 3U]) << 24U);
}
constexpr std::int64_t x86SignedRel32(std::uint32_t value) noexcept
{
    return (value & 0x80000000U) != 0
        ? static_cast<std::int64_t>(value) - 0x100000000LL
        : static_cast<std::int64_t>(value);
}
static_assert(kCallWindowOffset + kCallWindowBytes.size() == kReturnOffset);
static_assert(kCallOffset - kCallWindowOffset == 41U);
static_assert(kCallOffset + 5U == kReturnOffset);
static_assert(kCallWindowBytes[41] == 0xe8);
static_assert(static_cast<std::int64_t>(kReturnOffset) +
              x86SignedRel32(x86ReadU32(kCallWindowBytes, 42U)) ==
              static_cast<std::int64_t>(kImportStubOffset));
#else
inline constexpr char kExtensionUuid[] =
    "AF1367BD-2D7E-3EC0-A111-935E4881C655";
inline constexpr char kQtWidgetsUuid[] =
    "01652E29-047E-3528-9DC2-1BD084292E50";
inline constexpr char kQtVersion[] = "6.9.2";
inline constexpr char kGetSaveFileNameSymbol[] =
    "__ZN11QFileDialog15getSaveFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE";

inline constexpr std::uintptr_t kCallWindowOffset = 0x006c1744;
inline constexpr std::uintptr_t kCallOffset = 0x006c1760;
inline constexpr std::uintptr_t kReturnOffset = 0x006c1764;
inline constexpr std::uintptr_t kImportStubOffset = 0x00d1d0d4;
inline constexpr std::uintptr_t kQtWidgetsExportOffset = 0x00260b7c;

// -- x8为QString返回槽，x1-x3为const QString引用 -------------------------
inline constexpr std::array<std::uint8_t, 32> kCallWindowBytes = {
    0xe8, 0x83, 0x01, 0x91, 0xe1, 0x23, 0x01, 0x91,
    0xe2, 0xc3, 0x00, 0x91, 0xe3, 0x63, 0x00, 0x91,
    0xe0, 0x03, 0x16, 0xaa, 0x04, 0x00, 0x80, 0xd2,
    0x05, 0x00, 0x80, 0xd2, 0x5d, 0x6e, 0x19, 0x94,
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
    std::int64_t immediate = arm64Instruction(bytes) & 0x03ffffffU;
    if ((immediate & 0x02000000LL) != 0) immediate -= 0x04000000LL;
    return immediate * 4;
}

static_assert(kCallWindowOffset + kCallWindowBytes.size() == kReturnOffset);
static_assert(kCallOffset + 4U == kReturnOffset);
static_assert(kCallWindowOffset + 28U == kCallOffset);
static_assert((arm64Instruction({
                  kCallWindowBytes[28], kCallWindowBytes[29],
                  kCallWindowBytes[30], kCallWindowBytes[31]}) & 0xfc000000U) ==
              0x94000000U);
static_assert(static_cast<std::int64_t>(kCallOffset) +
              arm64BranchDisplacement({
                  kCallWindowBytes[28], kCallWindowBytes[29],
                  kCallWindowBytes[30], kCallWindowBytes[31]}) ==
              static_cast<std::int64_t>(kImportStubOffset));
#endif
}  // namespace native_save_scene_caption::contract
