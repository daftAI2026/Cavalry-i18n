/**
 * [INPUT]: 依赖2.8.1 arm64 fmt11合同；仅供显式281目标。
 * [OUTPUT]: 锁定ARM281标题caller/import与参数布局；280继续使用原合同。
 * [POS]: 只记录已证ABI边界；架构合同未匹配时标题维持原厂格式。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#if !defined(__aarch64__)
#error "Cavalry 2.8.1 title ABI is arm64-only"
#endif

#include <array>
#include <cstddef>
#include <cstdint>
#include <type_traits>

namespace native_title_format_abi {

struct FormatStringView {
    const char *data;
    std::size_t size;
};

struct BorrowedStringArgument {
    const char *data;
    std::size_t size;
};

struct CStringArgument {
    const char *data;
    std::uintptr_t unused;
};

union FormatValue {
    BorrowedStringArgument string;
    CStringArgument cstring;
    std::uintptr_t words[2];
};

struct FormatArguments {
    std::uint64_t descriptor;
    const FormatValue *values;
};

struct LibCppStringSnapshot {
    std::uint8_t bytes[24]{};
};

static_assert(sizeof(FormatStringView) == 16);
static_assert(std::is_trivially_copyable_v<FormatStringView>);
static_assert(sizeof(BorrowedStringArgument) == 16);
static_assert(std::is_trivially_copyable_v<BorrowedStringArgument>);
static_assert(sizeof(CStringArgument) == 16);
static_assert(std::is_trivially_copyable_v<CStringArgument>);
static_assert(sizeof(FormatValue) == 16);
static_assert(std::is_trivially_copyable_v<FormatValue>);
static_assert(sizeof(FormatArguments) == 16);
static_assert(std::is_trivially_copyable_v<FormatArguments>);
static_assert(sizeof(LibCppStringSnapshot) == 24);
static_assert(std::is_trivially_copyable_v<LibCppStringSnapshot>);

inline bool isEmptyShortString(const LibCppStringSnapshot &snapshot) noexcept
{
    constexpr std::size_t shortLengthOffset = 23;
    return (snapshot.bytes[shortLengthOffset] & 0x80U) == 0 &&
        snapshot.bytes[shortLengthOffset] == 0;
}

namespace contract {


inline constexpr char kFmtImageName[] = "libfmt.11.dylib";

inline constexpr char kExtensionUuid[] =
    "AF1367BD-2D7E-3EC0-A111-935E4881C655";
inline constexpr char kFmtUuid[] = "FE88E41A-006C-3431-8760-B04C0D4487CD";
inline constexpr char kUpdateAppTitleSymbol[] = "__ZN3Gui14updateAppTitleEv";
inline constexpr std::uintptr_t kUpdateAppTitleOffset = 0x12a1dc;
inline constexpr char kVformatSymbol[] =
    "__ZN3fmt3v117vformatENS0_17basic_string_viewIcEENS0_17basic_format_argsINS0_7contextEEE";
inline constexpr std::uintptr_t kVformatOffset = 0x1a54;
inline constexpr std::array<std::uint8_t, 16> kVformatEntryBytes = {
    0xf8, 0x5f, 0xbc, 0xa9, 0xf6, 0x57, 0x01, 0xa9,
    0xf4, 0x4f, 0x02, 0xa9, 0xfd, 0x7b, 0x03, 0xa9
};

inline constexpr char kFormatString[] = "Project: {} - Scene: {} {}";
inline constexpr std::uintptr_t kFormatStringOffset = 0xf36e87;
inline constexpr std::size_t kFormatStringLength = 26;
inline constexpr std::uintptr_t kCallSetupOffset = 0x12a454;
inline constexpr std::array<std::uint8_t, 28> kCallSetupBytes = {
    0x60, 0x70, 0x00, 0x90, 0x00, 0x1c, 0x3a, 0x91,
    0xe8, 0xe3, 0x00, 0x91, 0xe3, 0x03, 0x04, 0x91,
    0x41, 0x03, 0x80, 0x52, 0xa2, 0x9b, 0x81, 0x52,
    0x9d, 0xd8, 0x2f, 0x94
};
inline constexpr std::uintptr_t kVformatCallOffset = 0x12a46c;
inline constexpr std::uintptr_t kVformatReturnOffset = 0x12a470;
inline constexpr std::array<std::uint8_t, 4> kVformatCallBytes = {
    0x9d, 0xd8, 0x2f, 0x94
};
inline constexpr std::uintptr_t kVformatImportStubOffset = 0xd206e0;
inline constexpr std::array<std::uint8_t, 12> kVformatImportStubBytes = {
    0x50, 0x18, 0x00, 0xb0, 0x10, 0x5e, 0x42, 0xf9,
    0x00, 0x02, 0x1f, 0xd6
};
inline constexpr std::uintptr_t kVformatGotOffset = 0x10294b8;
inline constexpr std::uint64_t kFormatDescriptor = 0x0cdd;
inline constexpr std::size_t kFormatValueCount = 3;
inline constexpr std::uintptr_t kCallerFrameOffset = 0x12a1dc;
inline constexpr std::array<std::uint8_t, 24> kCallerFrameBytes = {
    0xfc, 0x6f, 0xbc, 0xa9, 0xf6, 0x57, 0x01, 0xa9,
    0xf4, 0x4f, 0x02, 0xa9, 0xfd, 0x7b, 0x03, 0xa9,
    0xfd, 0xc3, 0x00, 0x91, 0xff, 0xc3, 0x07, 0xd1
};
inline constexpr std::uintptr_t kSourceStringGettersOffset = 0x12a20c;
inline constexpr std::array<std::uint8_t, 20> kSourceStringGettersBytes = {
    0xa8, 0x23, 0x01, 0xd1, 0x02, 0xe1, 0x2f, 0x94,
    0xa8, 0x83, 0x01, 0xd1, 0xe0, 0x03, 0x13, 0xaa,
    0x09, 0xef, 0x2f, 0x94
};
inline constexpr std::uintptr_t kProjectFallbackDistance = 0xe0;
inline constexpr std::size_t kProjectFallbackLength = 4;
inline constexpr std::uintptr_t kSceneFallbackDistance = 0x100;
inline constexpr std::size_t kSceneFallbackLength = 8;
// -- caller frame: values位于sp+0x100，x29位于sp+0x220 -------------------
inline constexpr std::uintptr_t kFormatValuesFromStackPointer = 0x100;
inline constexpr std::uintptr_t kFramePointerFromStackPointer = 0x220;
inline constexpr std::uintptr_t kProjectSourceFromFramePointer = 0x48;
inline constexpr std::uintptr_t kSceneSourceFromFramePointer = 0x60;
inline constexpr std::uintptr_t kProjectSourceObjectFromValues = 0xd8;
inline constexpr std::uintptr_t kSceneSourceObjectFromValues = 0xc0;
inline constexpr std::size_t kLibCppStringObjectBytes = 24;
inline constexpr std::size_t kLibCppShortLengthOffset = 23;
inline constexpr std::uintptr_t kSourceStringWindowOffset = 0x12a360;
inline constexpr std::array<std::uint8_t, 60> kSourceStringWindowBytes = {
    0xc8, 0x01, 0x38, 0x37, 0x48, 0x03, 0x00, 0x34,
    0xa0, 0x83, 0xdb, 0x3c, 0xe0, 0x0b, 0x80, 0x3d,
    0xa8, 0x83, 0x5c, 0xf8, 0xe8, 0x1b, 0x00, 0xf9,
    0xa8, 0x73, 0xdb, 0x38, 0xc8, 0x01, 0xf8, 0x36,
    0xa2, 0x83, 0x5a, 0xf8, 0x62, 0x03, 0x00, 0xb4,
    0xa1, 0x03, 0x5a, 0xf8, 0xe0, 0x03, 0x00, 0x91,
    0xe3, 0xa5, 0xfb, 0x97, 0x1f, 0x00, 0x00, 0x14,
    0xa2, 0x03, 0x5c, 0xf8
};
inline constexpr std::uintptr_t kFallbackValueWindowOffset = 0x12a3cc;
inline constexpr std::array<std::uint8_t, 100> kFallbackValueWindowBytes = {
    0x88, 0x00, 0x80, 0x52, 0xe8, 0xdf, 0x00, 0x39,
    0xc8, 0xe9, 0x8d, 0x52, 0xc8, 0xad, 0xac, 0x72,
    0xe8, 0x23, 0x00, 0xb9, 0xff, 0x93, 0x00, 0x39,
    0xa8, 0x73, 0xdb, 0x38, 0x68, 0xfe, 0xff, 0x36,
    0xe5, 0xff, 0xff, 0x17, 0x08, 0x01, 0x80, 0x52,
    0xe8, 0x5f, 0x00, 0x39, 0xa8, 0xca, 0x8d, 0xd2,
    0x88, 0x2e, 0xad, 0xf2, 0x88, 0x8e, 0xcd, 0xf2,
    0xa8, 0x8c, 0xec, 0xf2, 0xe8, 0x03, 0x00, 0xf9,
    0xff, 0x23, 0x00, 0x39, 0xe8, 0xdf, 0x80, 0x39,
    0xe9, 0x83, 0x00, 0x91, 0xea, 0x2f, 0x42, 0xa9,
    0x1f, 0x01, 0x00, 0xf1, 0x49, 0xb1, 0x89, 0x9a,
    0x1f, 0x01, 0x00, 0x71, 0x68, 0xb1, 0x88, 0x9a,
    0xe9, 0x23, 0x10, 0xa9
};
inline constexpr std::uintptr_t kFormatValuesWindowOffset = 0x12a410;
inline constexpr std::array<std::uint8_t, 64> kFormatValuesWindowBytes = {
    0xe8, 0xdf, 0x80, 0x39, 0xe9, 0x83, 0x00, 0x91,
    0xea, 0x2f, 0x42, 0xa9, 0x1f, 0x01, 0x00, 0xf1,
    0x49, 0xb1, 0x89, 0x9a, 0x1f, 0x01, 0x00, 0x71,
    0x68, 0xb1, 0x88, 0x9a, 0xe9, 0x23, 0x10, 0xa9,
    0xe8, 0x5f, 0x80, 0x39, 0xe9, 0x03, 0x00, 0x91,
    0xea, 0x2f, 0x40, 0xa9, 0x1f, 0x01, 0x00, 0xf1,
    0x49, 0xb1, 0x89, 0x9a, 0x1f, 0x01, 0x00, 0x71,
    0x68, 0xb1, 0x88, 0x9a, 0xe9, 0x23, 0x11, 0xa9
};
inline constexpr std::uintptr_t kEmptySuffixOffset = 0xf6a01c;
inline constexpr std::uintptr_t kRestrictedSuffixOffset = 0xf36e7a;

constexpr std::int64_t arm64BlDisplacement(std::uint32_t instruction) noexcept
{
    std::int64_t immediate = instruction & 0x03ffffffU;
    if ((immediate & 0x02000000) != 0) immediate -= 0x04000000;
    return immediate * 4;
}

static_assert(sizeof(kFormatString) - 1 == kFormatStringLength);
static_assert(kVformatCallOffset + 4 == kVformatReturnOffset);
static_assert(static_cast<std::int64_t>(kVformatCallOffset) +
                  arm64BlDisplacement(0x942fd89dU) ==
              static_cast<std::int64_t>(kVformatImportStubOffset));
static_assert(kVformatCallBytes[0] == 0x9d && kVformatCallBytes[1] == 0xd8 &&
              kVformatCallBytes[2] == 0x2f && kVformatCallBytes[3] == 0x94);
static_assert(kFormatValueCount * sizeof(FormatValue) == 48);
static_assert(kSceneSourceObjectFromValues + kLibCppStringObjectBytes ==
              kProjectSourceObjectFromValues);
static_assert(kFramePointerFromStackPointer - kProjectSourceFromFramePointer -
                  kFormatValuesFromStackPointer ==
              kProjectSourceObjectFromValues);
static_assert(kFramePointerFromStackPointer - kSceneSourceFromFramePointer -
                  kFormatValuesFromStackPointer ==
              kSceneSourceObjectFromValues);
static_assert(kLibCppShortLengthOffset + 1 == kLibCppStringObjectBytes);



}  // namespace contract
}  // namespace native_title_format_abi
