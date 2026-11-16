/**
 * [INPUT]: Official Cavalry 2.8.1 Intel Extension/spdlog images and Welcome producer.
 * [OUTPUT]: Locks one async Welcome log call, its source literal, stub, and GOT.
 * [POS]: Intel 2.8.1 Welcome profile; unknown log callers remain pass-through.
 * [PROTOCOL]: Keep exact producer bytes, source reference, and import binding.
 */
#pragma once

#if !defined(__x86_64__)
#error "Cavalry 2.8.1 Intel Welcome ABI requires x86_64."
#endif

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <type_traits>

namespace welcome_log_it::contract {
inline constexpr char kExtensionImageName[] = "libExtensionLayer.dylib";
inline constexpr char kExtensionUuid[] = "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kExtensionSha256[] =
    "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050";
inline constexpr char kSpdlogImageName[] = "libspdlog.1.15.dylib";
inline constexpr char kSpdlogUuid[] = "B2A4829C-F4AE-30AE-A15A-DB00BB634B61";
inline constexpr char kSpdlogSha256[] =
    "507d667ff30c688ca0d19bff0c1fe3f566c96a05160d2b2e12883bf7eb9992ae";
inline constexpr char kLogItSymbol[] =
    "__ZN6spdlog6logger7log_it_ERKNS_7details7log_msgEbb";
inline constexpr std::uintptr_t kLogItOffset = 0x000071f0;

inline constexpr char kExtensionAsyncWelcomeSymbol[] =
    "__ZN9QtPrivate15QCallableObjectIZZ14wrapInvokeMainIRKZ28refreshCanvaAuthInBackgroundP10DesktopAppNSt3__18optionalIN7cavalry17LicenceStatusInfoEEENS4_8functionIFvbEEEE3$_1EDcOT_ENKUlDpOT_E_clIJNS6_18RevalidationResultEEEEDaSK_EUlvE_NS_4ListIJEEEvE4implEiPNS_15QSlotObjectBaseEP7QObjectPPvPb";
inline constexpr std::uintptr_t kExtensionAsyncWelcomeSymbolOffset = 0x00711490;
inline constexpr std::uintptr_t kExtensionAsyncWelcomeSourceRefOffset = 0x00711d2d;
inline constexpr std::array<std::uint8_t, 7> kExtensionAsyncWelcomeSourceRefBytes = {
    0x0f, 0x10, 0x05, 0x49, 0x3a, 0x93, 0x00,
};
inline constexpr std::uintptr_t kExtensionAsyncWelcomeCallSetupOffset = 0x00711fd0;
inline constexpr std::array<std::uint8_t, 28> kExtensionAsyncWelcomeCallSetupBytes = {
    0x31, 0xd2, 0x41, 0x83, 0xff, 0x03, 0x0f, 0x9c,
    0xc2, 0x41, 0x0f, 0xb6, 0xcc, 0x48, 0x8d, 0xb5,
    0xf0, 0xfe, 0xff, 0xff, 0x4c, 0x89, 0xf7, 0xe8,
    0x1c, 0x06, 0x72, 0x00,
};
inline constexpr std::uintptr_t kExtensionWelcomeSourceOffset = 0x0104577d;
inline constexpr std::array<std::uint8_t, 20> kExtensionWelcomeSourceBytes = {
    0x57, 0x65, 0x6c, 0x63, 0x6f, 0x6d, 0x65, 0x20, 0x74, 0x6f,
    0x20, 0x43, 0x61, 0x76, 0x61, 0x6c, 0x72, 0x79, 0x2e, 0x00,
};

inline constexpr std::uintptr_t kExtensionCallOffset = 0x00711fe7;
inline constexpr std::uintptr_t kExtensionReturnOffset = 0x00711fec;
inline constexpr std::uintptr_t kExtensionStubOffset = 0x00e32608;
inline constexpr std::array<std::uint8_t, 6> kExtensionStubBytes = {
    0xff, 0x25, 0xda, 0x9c, 0x2f, 0x00,
};
inline constexpr std::uintptr_t kExtensionGotOffset = 0x0112c2e8;

inline constexpr std::size_t kLogMessagePayloadOffset = 0x50;
inline constexpr std::size_t kLogMessagePayloadSizeOffset = 0x58;
inline constexpr std::size_t kLogMessageBytes = 0x60;
struct LogMessageAbi {
    std::byte prefix[kLogMessagePayloadOffset];
    const char *payload;
    std::size_t payloadSize;
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
static_assert(sizeof(void *) == 8);
static_assert(sizeof(std::uintptr_t) == 8);
static_assert(std::atomic<std::uintptr_t>::is_always_lock_free);
static_assert(std::is_trivially_copyable_v<LogMessageAbi>);
static_assert(offsetof(LogMessageAbi, payload) == kLogMessagePayloadOffset);
static_assert(offsetof(LogMessageAbi, payloadSize) == kLogMessagePayloadSizeOffset);
static_assert(sizeof(LogMessageAbi) == kLogMessageBytes);
static_assert(kExtensionCallOffset == kExtensionAsyncWelcomeCallSetupOffset + 23U);
static_assert(kExtensionReturnOffset == kExtensionCallOffset + 5U);
static_assert(kExtensionAsyncWelcomeCallSetupOffset +
              kExtensionAsyncWelcomeCallSetupBytes.size() == kExtensionReturnOffset);
static_assert(kExtensionAsyncWelcomeCallSetupBytes[23] == 0xe8);
static_assert(kExtensionReturnOffset + signedRel32(
                  readU32(kExtensionAsyncWelcomeCallSetupBytes.data() + 24U)) ==
              static_cast<std::int64_t>(kExtensionStubOffset));
static_assert(kExtensionStubOffset + kExtensionStubBytes.size() +
              signedRel32(readU32(kExtensionStubBytes.data() + 2U)) ==
              kExtensionGotOffset);
}  // namespace welcome_log_it::contract
