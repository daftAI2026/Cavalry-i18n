/**
 * [INPUT]: 依赖官方2.8.1 Intel DocumentationPopup与QtWidgets Mach-O证据。
 * [OUTPUT]: 锁定setContent内QLayout::activate返回地址、调用窗、stub和GOT。
 * [POS]: Intel帮助布局adapter窄准入合同；未知调用只透传原函数。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#if !defined(__x86_64__)
#error "Cavalry 2.8.1 Intel popup ABI contract requires x86_64."
#endif

#include <array>
#include <cstdint>

namespace native_help_popup_layout::abi {
inline constexpr char kQtWidgetsUuid[] = "0C194E6E-1E76-3FD4-83A3-9263616E2F3F";
inline constexpr char kDocumentationSetContentSymbol[] =
    "__ZN18DocumentationPopup10setContentERK7QStringS2_S2_S2_S2_";
inline constexpr char kQtLayoutActivateSymbol[] = "__ZN7QLayout8activateEv";

constexpr bool isExactActivationCaller(std::uintptr_t caller,
                                       std::uintptr_t expected) noexcept
{
    return expected != 0 && caller == expected;
}

namespace x86_64 {
inline constexpr char kCavalryUiUuid[] = "3CC166C8-F163-3F2D-8AEC-B19A8EBCDE71";
inline constexpr char kCavalryUiSha256[] =
    "4d8e7139760af268230c084f269d9fe5c069fa46c7b579e6dee212984bf00c1d";
inline constexpr char kQtWidgetsUuid[] = "0C194E6E-1E76-3FD4-83A3-9263616E2F3F";
inline constexpr char kDocumentationSetContentSymbol[] =
    "__ZN18DocumentationPopup10setContentERK7QStringS2_S2_S2_S2_";
inline constexpr char kQtLayoutActivateSymbol[] = "__ZN7QLayout8activateEv";

inline constexpr std::uintptr_t kDocumentationSetContentOffset = 0x96ad0;
inline constexpr std::uintptr_t kActivateCallWindowOffset = 0x96c1e;
inline constexpr std::uintptr_t kActivateCallOffset = 0x96c26;
inline constexpr std::uintptr_t kActivateReturnOffset = 0x96c2b;
inline constexpr std::uintptr_t kActivateImportStubOffset = 0xae286;
inline constexpr std::uintptr_t kActivateGotOffset = 0xd6838;
inline constexpr std::uintptr_t kQtLayoutActivateOffset = 0x42fb0;

inline constexpr std::array<std::uint8_t, 21> kActivateCallWindowBytes = {
    0xe8, 0x8f, 0x83, 0x01, 0x00, 0x48, 0x89, 0xc7,
    0xe8, 0x5b, 0x76, 0x01, 0x00, 0x48, 0x89, 0xdf,
    0xe8, 0x85, 0x77, 0x01, 0x00,
};
inline constexpr std::array<std::uint8_t, 6> kActivateImportStubBytes = {
    0xff, 0x25, 0xac, 0x85, 0x02, 0x00,
};

template <std::size_t Size>
constexpr std::uint32_t readU32(
    const std::array<std::uint8_t, Size> &bytes, std::size_t offset) noexcept
{
    return static_cast<std::uint32_t>(bytes[offset]) |
        (static_cast<std::uint32_t>(bytes[offset + 1U]) << 8U) |
        (static_cast<std::uint32_t>(bytes[offset + 2U]) << 16U) |
        (static_cast<std::uint32_t>(bytes[offset + 3U]) << 24U);
}
constexpr std::int64_t signedRel32(std::uint32_t value) noexcept
{
    return (value & 0x80000000U) != 0
        ? static_cast<std::int64_t>(value) - 0x100000000LL
        : static_cast<std::int64_t>(value);
}
static_assert(kActivateCallOffset == kActivateCallWindowOffset + 8U);
static_assert(kActivateReturnOffset == kActivateCallOffset + 5U);
static_assert(kActivateCallWindowOffset + kActivateCallWindowBytes.size() ==
              kActivateReturnOffset + 8U);
static_assert(kActivateCallWindowBytes[8] == 0xe8);
static_assert(static_cast<std::int64_t>(kActivateReturnOffset) +
              signedRel32(readU32(kActivateCallWindowBytes, 9U)) ==
              static_cast<std::int64_t>(kActivateImportStubOffset));
static_assert(kActivateImportStubOffset + kActivateImportStubBytes.size() +
              signedRel32(readU32(kActivateImportStubBytes, 2U)) ==
              kActivateGotOffset);
}  // namespace x86_64
}  // namespace native_help_popup_layout::abi
