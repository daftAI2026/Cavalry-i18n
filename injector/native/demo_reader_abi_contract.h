/**
 * [INPUT]: 依赖官方2.8.1 Core/Extension arm64切片与Preset回调反汇编；x86保留2.8合同。
 * [OUTPUT]: 锁定textFromFile optional返回槽、导出、导入和唯一菜单caller。
 * [POS]: Demo读取ABI合同；不修改原厂返回类型或未准入调用。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>

namespace native_demo_reader::contract {
#if defined(__x86_64__)
inline constexpr char kCoreUuid[] = "F1CF1469-3FB9-3C2B-B695-3827F32F341A";
inline constexpr char kExtensionUuid[] = "DB431633-99A8-3C32-89EF-3378D4B418EA";
inline constexpr char kCoreSha256[] =
    "8df2a434b5a6b73da691f7c8d0bba6fbb4c244dc0b388ea466ba8220c5ebeafb";
inline constexpr char kExtensionSha256[] =
    "55c165bfa3f780f73e35a0b4e7cbd30929fe54de46c41424c74a239e2f9f4d15";
inline constexpr char kTextFromFileSymbol[] =
    "__ZN7cavalry12textFromFileERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE";
inline constexpr std::uintptr_t kTextFromFileExportOffset = 0x0052e180;
inline constexpr std::uintptr_t kCoreEntryWindowOffset = 0x0052e180;
inline constexpr std::array<std::uint8_t, 34> kCoreEntryWindowBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56,
    0x41, 0x55, 0x41, 0x54, 0x53, 0x48, 0x81, 0xec,
    0x98, 0x02, 0x00, 0x00, 0x48, 0x89, 0xb5, 0x68,
    0xfd, 0xff, 0xff, 0x48, 0x89, 0xbd, 0x60, 0xfd,
    0xff, 0xff,
};
inline constexpr std::uintptr_t kOptionalEngagedOffset = 0x18;
inline constexpr std::size_t kOptionalResultBytes = 0x20;
inline constexpr std::uintptr_t kPresetCallbackEntryOffset = 0x007d7e30;
inline constexpr std::uintptr_t kPresetCallWindowOffset = 0x007d7e9a;
inline constexpr std::uintptr_t kPresetTextFromFileCallOffset = 0x007d7ea2;
inline constexpr std::uintptr_t kPresetTextFromFileReturnOffset = 0x007d7ea7;
inline constexpr std::uintptr_t kPresetRunGuiScriptCallOffset = 0x007d7ef0;
inline constexpr std::uintptr_t kPresetRunGuiScriptReturnOffset = 0x007d7ef5;
inline constexpr std::uintptr_t kTextFromFileImportIndex = 0x09c8;
inline constexpr std::uintptr_t kTextFromFileGotOffset = 0x011c3e40;
inline constexpr std::uintptr_t kTextFromFileStubOffset = 0x00f428df;
inline constexpr std::array<std::uint8_t, 23> kPresetCallWindowBytes = {
    0x49, 0x8d, 0x76, 0x18, 0x48, 0x8d, 0x7d, 0x90,
    0xe8, 0x38, 0xaa, 0x76, 0x00, 0x80, 0x7d, 0xa8,
    0x00, 0x0f, 0x84, 0xd5, 0x00, 0x00, 0x00,
};
constexpr std::uint32_t x86ReadU32(
    const std::array<std::uint8_t, 23> &bytes, std::size_t offset) noexcept
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
using TextFromFileResult = std::optional<std::string>;
using TextFromFileFunction = TextFromFileResult (*)(const std::string &);
static_assert(sizeof(std::string) == 0x18);
static_assert(sizeof(TextFromFileResult) == kOptionalResultBytes);
static_assert(alignof(TextFromFileResult) == alignof(void *));
static_assert(kOptionalEngagedOffset == sizeof(std::string));
static_assert(kPresetCallWindowOffset + 8U == kPresetTextFromFileCallOffset);
static_assert(kPresetTextFromFileCallOffset + 5U == kPresetTextFromFileReturnOffset);
static_assert(kPresetRunGuiScriptCallOffset + 5U == kPresetRunGuiScriptReturnOffset);
static_assert(kPresetCallWindowOffset + kPresetCallWindowBytes.size() ==
              kPresetTextFromFileReturnOffset + 10U);
static_assert(kPresetCallWindowBytes[8] == 0xe8);
static_assert(static_cast<std::int64_t>(kPresetTextFromFileReturnOffset) +
              x86SignedRel32(x86ReadU32(kPresetCallWindowBytes, 9U)) ==
              static_cast<std::int64_t>(kTextFromFileStubOffset));
#else
inline constexpr char kCoreUuid[] = "FEFE5F95-740D-374F-9413-2AF1173AD9E0";
inline constexpr char kExtensionUuid[] = "AF1367BD-2D7E-3EC0-A111-935E4881C655";
inline constexpr char kCoreSha256[] =
    "9be57aae3a950c36ee7983f7231031114bbd438822bb7e06ffc6a9da17a8e955";
inline constexpr char kExtensionSha256[] =
    "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050";
inline constexpr char kTextFromFileSymbol[] =
    "__ZN7cavalry12textFromFileERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE";
inline constexpr std::uintptr_t kTextFromFileExportOffset = 0x004b175c;
inline constexpr std::uintptr_t kCoreEntryWindowOffset = 0x004b175c;
inline constexpr std::array<std::uint8_t, 40> kCoreEntryWindowBytes = {
    0xf6, 0x57, 0xbd, 0xa9, 0xf4, 0x4f, 0x01, 0xa9,
    0xfd, 0x7b, 0x02, 0xa9, 0xfd, 0x83, 0x00, 0x91,
    0xff, 0xc3, 0x09, 0xd1, 0xf4, 0x03, 0x00, 0xaa,
    0xf3, 0x03, 0x08, 0xaa, 0xc8, 0x4a, 0x00, 0xf0,
    0x08, 0xbd, 0x46, 0xf9, 0x08, 0x01, 0x40, 0xf9,
};
inline constexpr std::uintptr_t kOptionalEngagedOffset = 0x18;
inline constexpr std::size_t kOptionalResultBytes = 0x20;

inline constexpr std::uintptr_t kPresetCallbackEntryOffset = 0x006d9a38;
inline constexpr std::uintptr_t kPresetCallWindowOffset = 0x006d9aa8;
inline constexpr std::uintptr_t kPresetTextFromFileCallOffset = 0x006d9ab0;
inline constexpr std::uintptr_t kPresetTextFromFileReturnOffset = 0x006d9ab4;
inline constexpr std::uintptr_t kPresetRunGuiScriptCallOffset = 0x006d9b04;
inline constexpr std::uintptr_t kPresetRunGuiScriptReturnOffset = 0x006d9b08;
inline constexpr std::uintptr_t kTextFromFileGotOffset = 0x010278a8;
inline constexpr std::uintptr_t kTextFromFileStubOffset = 0x00d22474;
inline constexpr std::array<std::uint8_t, 20> kPresetCallWindowBytes = {
    0xe8, 0x63, 0x00, 0x91, 0x60, 0x62, 0x00, 0x91,
    0x71, 0x22, 0x19, 0x94, 0xe8, 0xc3, 0x40, 0x39,
    0x1f, 0x05, 0x00, 0x71,
};

constexpr std::uint32_t instructionAt(
    const std::array<std::uint8_t, 20> &bytes, std::size_t offset) noexcept
{
    return static_cast<std::uint32_t>(bytes[offset]) |
        (static_cast<std::uint32_t>(bytes[offset + 1U]) << 8U) |
        (static_cast<std::uint32_t>(bytes[offset + 2U]) << 16U) |
        (static_cast<std::uint32_t>(bytes[offset + 3U]) << 24U);
}
constexpr std::int64_t branchDisplacement(std::uint32_t instruction) noexcept
{
    std::int64_t immediate = instruction & 0x03ffffffU;
    if ((immediate & 0x02000000LL) != 0) immediate -= 0x04000000LL;
    return immediate * 4;
}

using TextFromFileResult = std::optional<std::string>;
using TextFromFileFunction = TextFromFileResult (*)(const std::string &);
static_assert(sizeof(std::string) == 0x18,
              "The verified arm64 libc++ string layout changed");
static_assert(sizeof(TextFromFileResult) == kOptionalResultBytes,
              "The verified arm64 libc++ optional<string> layout changed");
static_assert(alignof(TextFromFileResult) == alignof(void *));
static_assert(kOptionalEngagedOffset == sizeof(std::string));
static_assert(kPresetCallWindowOffset + 8U == kPresetTextFromFileCallOffset);
static_assert(kPresetTextFromFileCallOffset + 4U == kPresetTextFromFileReturnOffset);
static_assert(kPresetRunGuiScriptCallOffset + 4U == kPresetRunGuiScriptReturnOffset);
static_assert(kPresetCallWindowOffset + kPresetCallWindowBytes.size() ==
              kPresetCallWindowOffset + 20U);
static_assert((instructionAt(kPresetCallWindowBytes, 8U) & 0xfc000000U) ==
              0x94000000U);
static_assert(static_cast<std::int64_t>(kPresetTextFromFileCallOffset) +
              branchDisplacement(instructionAt(kPresetCallWindowBytes, 8U)) ==
              static_cast<std::int64_t>(kTextFromFileStubOffset));
#endif
}  // namespace native_demo_reader::contract
