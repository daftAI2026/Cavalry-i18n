/**
 * [INPUT]: 依赖官方2.8.1 Intel activeLocale导出、sret、owner调用窗、GOT与stub字节。
 * [OUTPUT]: 锁定getter sret、registerNodesSetup返回PC、调用目标与GOT相对跳转。
 * [POS]: 独立x86 locale静态合同；只准入registerNodesSetup语言快照owner。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#if !defined(__x86_64__)
#error "activeLocale Intel ABI contract requires an x86_64 target."
#endif

#include <array>
#include <cstddef>
#include <cstdint>
#include <limits>

namespace native_locale_interpose::x86_64_contract {
inline constexpr char kApiUuid[] = "8A40A6FC-DE65-3845-8EA1-F1E80A2F0CCD";
inline constexpr char kApiSha256[] =
    "6aa6257c45222ea32135907cbed43cf6b2a67ffe7bd84afb1b42bc93cc29bb77";
inline constexpr char kExtensionUuid[] = "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kExtensionSha256[] =
    "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050";
inline constexpr char kGetterSymbol[] = "__ZN7cavalry12activeLocaleEP3Api";
inline constexpr char kRegisterNodesSetupSymbol[] = "__Z18registerNodesSetupP3Api";
inline constexpr std::uintptr_t kGetterEntryOffset = 0x21570;
inline constexpr std::uintptr_t kRegisterNodesSetupEntryOffset = 0xd0f830;
inline constexpr std::uintptr_t kRegisterNodesSetupCallOffset = 0xd10080;
inline constexpr std::uintptr_t kRegisterNodesSetupReturnOffset = 0xd10085;
inline constexpr std::uintptr_t kStubOffset = 0xe32d88;
inline constexpr std::uintptr_t kGotOffset = 0x1128528;
inline constexpr std::size_t kObservedReturnObjectBytes = 24;

inline constexpr std::uintptr_t kGetterSretSaveOffset = 0x21579;
inline constexpr std::array<std::uint8_t, 15> kGetterEntryBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x53, 0x48, 0x83, 0xec,
    0x18, 0x48, 0x89, 0xfb, 0x48, 0x8b, 0x06,
};
inline constexpr std::array<std::uint8_t, 3> kGetterSretSaveBytes = {
    0x48, 0x89, 0xfb,
};
inline constexpr std::uintptr_t kGetterReturnSretOffset = 0x215bf;
inline constexpr std::array<std::uint8_t, 3> kGetterReturnSretBytes = {
    0x48, 0x89, 0xd8,
};
inline constexpr std::uintptr_t kOwnerSretArgumentOffset = 0xd10075;
inline constexpr std::array<std::uint8_t, 4> kOwnerSretArgumentBytes = {
    0x48, 0x8d, 0x7d, 0xa0,
};
inline constexpr std::uintptr_t kOwnerApiArgumentOffset = 0xd10079;
inline constexpr std::array<std::uint8_t, 7> kOwnerApiArgumentBytes = {
    0x48, 0x8b, 0xb5, 0x58, 0xff, 0xff, 0xff,
};
inline constexpr std::array<std::uint8_t, 5> kOwnerCallBytes = {
    0xe8, 0x03, 0x2d, 0x12, 0x00,
};
inline constexpr std::uintptr_t kOwnerReturnUseOffset = 0xd10085;
inline constexpr std::array<std::uint8_t, 4> kOwnerReturnUseBytes = {
    0x48, 0x8d, 0x75, 0xa0,
};
inline constexpr std::uintptr_t kOwnerSetLocaleCallOffset = 0xd1008c;
inline constexpr std::array<std::uint8_t, 5> kOwnerSetLocaleCallBytes = {
    0xe8, 0xd9, 0x08, 0x12, 0x00,
};
inline constexpr std::array<std::uint8_t, 6> kActiveLocaleStubBytes = {
    0xff, 0x25, 0x9a, 0x57, 0x2f, 0x00,
};

constexpr std::uint32_t readU32(
    const std::array<std::uint8_t, 6> &bytes, std::size_t offset) noexcept
{
    return static_cast<std::uint32_t>(bytes[offset]) |
        (static_cast<std::uint32_t>(bytes[offset + 1U]) << 8U) |
        (static_cast<std::uint32_t>(bytes[offset + 2U]) << 16U) |
        (static_cast<std::uint32_t>(bytes[offset + 3U]) << 24U);
}
constexpr std::uint32_t readOwnerCallRel32() noexcept
{
    return static_cast<std::uint32_t>(kOwnerCallBytes[1]) |
        (static_cast<std::uint32_t>(kOwnerCallBytes[2]) << 8U) |
        (static_cast<std::uint32_t>(kOwnerCallBytes[3]) << 16U) |
        (static_cast<std::uint32_t>(kOwnerCallBytes[4]) << 24U);
}
constexpr std::int64_t signedRel32(std::uint32_t value) noexcept
{
    return (value & 0x80000000U) != 0
        ? static_cast<std::int64_t>(value) - 0x100000000LL
        : static_cast<std::int64_t>(value);
}

inline bool isRegisterNodesSetupOwnerReturn(
    bool contractReady, std::uintptr_t extensionBase,
    std::uintptr_t callerPc) noexcept
{
    if (!contractReady || extensionBase == 0 ||
        extensionBase > std::numeric_limits<std::uintptr_t>::max() -
            kRegisterNodesSetupReturnOffset) return false;
    return callerPc == extensionBase + kRegisterNodesSetupReturnOffset;
}

static_assert(kRegisterNodesSetupCallOffset + kOwnerCallBytes.size() ==
              kRegisterNodesSetupReturnOffset);
static_assert(kRegisterNodesSetupReturnOffset == kOwnerReturnUseOffset);
static_assert(kGetterEntryOffset + 9U == kGetterSretSaveOffset);
static_assert(kObservedReturnObjectBytes == 24);
static_assert(kStubOffset + kActiveLocaleStubBytes.size() +
              signedRel32(readU32(kActiveLocaleStubBytes, 2U)) == kGotOffset);
static_assert(kRegisterNodesSetupCallOffset + kOwnerCallBytes.size() +
              signedRel32(readOwnerCallRel32()) == kStubOffset);
}  // namespace native_locale_interpose::x86_64_contract
