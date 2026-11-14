/**
 * [INPUT]: 依赖官方2.8.1 arm64及既有x86 QFileDialog调用窗、QtWidgets UUID与导出符号。
 * [OUTPUT]: 锁定Save captions与281 Load .cv的source、QString返回槽、参数和BL目标。
 * [POS]: Load .cv只对应chooseSceneOpen固定caption；不改全局标题或文件名。
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

inline constexpr char kChooseSceneOpenSymbol[] =
    "__ZN7cavalry15chooseSceneOpenEP3Api";
inline constexpr std::uintptr_t kChooseSceneOpenOffset = 0x006266c8;
inline constexpr std::uintptr_t kLoadCvSourceWindowOffset = 0x00626700;
inline constexpr std::array<std::uint8_t, 100> kLoadCvSourceWindowBytes = {
    0xe8, 0xbf, 0x00, 0x39, 0x88, 0xe9, 0x8d, 0xd2,
    0x28, 0x8c, 0xac, 0xf2, 0x08, 0xc4, 0xc5, 0xf2,
    0x68, 0xcc, 0xee, 0xf2, 0xe8, 0x0f, 0x00, 0xf9,
    0xff, 0x83, 0x00, 0x39, 0x00, 0x04, 0x80, 0x52,
    0x9c, 0x05, 0x1c, 0x94, 0xe0, 0x03, 0x00, 0xf9,
    0x88, 0x44, 0x00, 0x90, 0x00, 0xc9, 0xc1, 0x3d,
    0xc8, 0x48, 0x00, 0x90, 0x08, 0xcd, 0x09, 0x91,
    0xe0, 0x83, 0x80, 0x3c, 0x00, 0x01, 0xc0, 0x3d,
    0x00, 0x00, 0x80, 0x3d, 0x00, 0xa1, 0xc0, 0x3c,
    0x00, 0xa0, 0x80, 0x3c, 0x1f, 0x68, 0x00, 0x39,
    0xe8, 0xc3, 0x00, 0x91, 0xe0, 0x63, 0x00, 0x91,
    0xa1, 0xa3, 0x00, 0xd1, 0xe2, 0x03, 0x00, 0x91,
    0x6b, 0x6a, 0x02, 0x94,
};
inline constexpr std::uintptr_t kChooseSceneOpenProducerCallOffset = 0x00626760;
inline constexpr std::uintptr_t kChooseSceneOpenProducerReturnOffset = 0x00626764;
inline constexpr char kPresentOpenFileSymbol[] =
    "__ZN7cavalry15presentOpenFileERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEES8_S8_";
inline constexpr std::uintptr_t kPresentOpenFileOffset = 0x006c110c;
inline constexpr char kGetOpenFileNameSymbol[] =
    "__ZN11QFileDialog15getOpenFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE";
inline constexpr std::uintptr_t kOpenFileNameImportIndex = 0x0c09;
inline constexpr std::uintptr_t kOpenFileNameGotOffset = 0x010295f8;
inline constexpr std::uintptr_t kOpenFileNameImportStubOffset = 0x00d1d0c8;
inline constexpr std::uintptr_t kOpenFileNameQtWidgetsExportOffset = 0x0025fc44;
inline constexpr std::uintptr_t kOpenFileNameCallWindowOffset = 0x006c1200;
inline constexpr std::uintptr_t kOpenFileNameCallOffset = 0x006c1220;
inline constexpr std::uintptr_t kOpenFileNameReturnOffset = 0x006c1224;
inline constexpr std::array<std::uint8_t, 36> kOpenFileNameCallWindowBytes = {
    0x3c, 0x82, 0x19, 0x94, 0xe8, 0x83, 0x01, 0x91,
    0xe1, 0x23, 0x01, 0x91, 0xe2, 0xc3, 0x00, 0x91,
    0xe3, 0x03, 0x00, 0x91, 0xe0, 0x03, 0x14, 0xaa,
    0x04, 0x00, 0x80, 0xd2, 0x05, 0x00, 0x80, 0xd2,
    0xaa, 0x6f, 0x19, 0x94,
};
static_assert(kChooseSceneOpenOffset < kLoadCvSourceWindowOffset);
static_assert(kLoadCvSourceWindowOffset + kLoadCvSourceWindowBytes.size() ==
              kChooseSceneOpenProducerReturnOffset);
static_assert(kChooseSceneOpenProducerCallOffset + 4U ==
              kChooseSceneOpenProducerReturnOffset);
static_assert(kOpenFileNameCallWindowOffset +
              kOpenFileNameCallWindowBytes.size() == kOpenFileNameReturnOffset);
static_assert(kOpenFileNameCallOffset + 4U == kOpenFileNameReturnOffset);
static_assert(kOpenFileNameCallWindowOffset + 32U == kOpenFileNameCallOffset);
static_assert((arm64Instruction({
                  kOpenFileNameCallWindowBytes[32],
                  kOpenFileNameCallWindowBytes[33],
                  kOpenFileNameCallWindowBytes[34],
                  kOpenFileNameCallWindowBytes[35]}) & 0xfc000000U) ==
              0x94000000U);
static_assert(static_cast<std::int64_t>(kOpenFileNameCallOffset) +
              arm64BranchDisplacement({
                  kOpenFileNameCallWindowBytes[32],
                  kOpenFileNameCallWindowBytes[33],
                  kOpenFileNameCallWindowBytes[34],
                  kOpenFileNameCallWindowBytes[35]}) ==
              static_cast<std::int64_t>(kOpenFileNameImportStubOffset));
#endif
}  // namespace native_save_scene_caption::contract
