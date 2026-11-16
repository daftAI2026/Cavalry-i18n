/**
 * [INPUT]: 依赖官方2.8.1 Intel libApi getter与Extension owner机器码证据。
 * [OUTPUT]: 锁定activeLocale的x86 sret窗口、owner调用窗、stub与GOT身份。
 * [POS]: Intel 2.8.1共享locale ABI覆盖；不借用arm64地址或旧Intel调用偏移。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#if !defined(__x86_64__)
#error "Cavalry 2.8.1 Intel locale ABI requires x86_64."
#endif

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_locale_interpose::contract {
inline constexpr char kApiUuid[] = "8A40A6FC-DE65-3845-8EA1-F1E80A2F0CCD";
inline constexpr char kApiSha256[] =
    "6aa6257c45222ea32135907cbed43cf6b2a67ffe7bd84afb1b42bc93cc29bb77";
inline constexpr char kExtensionUuid[] = "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kActiveLocaleSymbol[] = "__ZN7cavalry12activeLocaleEP3Api";
inline constexpr char kRegisterNodesSetupSymbol[] = "__Z18registerNodesSetupP3Api";
inline constexpr std::uintptr_t kRegisterNodesSetupEntryOffset = 0xd0f830;
inline constexpr std::uintptr_t kActiveLocaleEntryOffset = 0x21570;
inline constexpr std::array<std::uint8_t, 15> kActiveLocaleEntryBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x53, 0x48, 0x83, 0xec,
    0x18, 0x48, 0x89, 0xfb, 0x48, 0x8b, 0x06,
};
inline constexpr std::uintptr_t kActiveLocaleCallOffset = 0xd10075;
inline constexpr std::array<std::uint8_t, 16> kActiveLocaleCallBytes = {
    0x48, 0x8d, 0x7d, 0xa0, 0x48, 0x8b, 0xb5, 0x58,
    0xff, 0xff, 0xff, 0xe8, 0x03, 0x2d, 0x12, 0x00,
};
inline constexpr std::uintptr_t kActiveLocaleReturnOffset = 0xd10085;
inline constexpr std::uintptr_t kActiveLocaleStubOffset = 0xe32d88;
inline constexpr std::array<std::uint8_t, 6> kActiveLocaleStubBytes = {
    0xff, 0x25, 0x9a, 0x57, 0x2f, 0x00,
};
inline constexpr std::uintptr_t kActiveLocaleGotOffset = 0x1128528;

inline bool extensionGotTargetsInterposer(
    const void *loadedTarget, const void *interposer) noexcept
{
    return loadedTarget != nullptr && loadedTarget == interposer;
}

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
static_assert(kActiveLocaleCallOffset + kActiveLocaleCallBytes.size() ==
              kActiveLocaleReturnOffset);
static_assert(kActiveLocaleEntryOffset + 9U == 0x21579U);
static_assert(kActiveLocaleStubOffset + kActiveLocaleStubBytes.size() +
              signedRel32(readU32(kActiveLocaleStubBytes, 2U)) ==
              kActiveLocaleGotOffset);
static_assert(kActiveLocaleReturnOffset +
              signedRel32(readU32(kActiveLocaleCallBytes, 12U)) ==
              kActiveLocaleStubOffset);
}  // namespace native_locale_interpose::contract
