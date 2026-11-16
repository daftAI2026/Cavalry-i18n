/**
 * [INPUT]: Official Cavalry 2.8.1 Intel Core/Extension symbols and call windows.
 * [OUTPUT]: Locks the optional<string> result and the unique Run Preset caller.
 * [POS]: Intel 2.8.1 Demo reader profile; the sibling $_0 import caller is excluded.
 * [PROTOCOL]: Keep the caller, machine bytes, and import target tied together.
 */
#pragma once

#if !defined(__x86_64__)
#error "Cavalry 2.8.1 Intel Demo reader ABI requires x86_64."
#endif

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>

namespace native_demo_reader::contract {
inline constexpr char kCoreUuid[] = "23B9AC22-F909-3455-BD02-4E90796E35B5";
inline constexpr char kExtensionUuid[] = "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kCoreSha256[] =
    "9be57aae3a950c36ee7983f7231031114bbd438822bb7e06ffc6a9da17a8e955";
inline constexpr char kExtensionSha256[] =
    "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050";
inline constexpr char kTextFromFileSymbol[] =
    "__ZN7cavalry12textFromFileERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE";
inline constexpr char kPresetCallbackSymbol[] =
    "__ZN9QtPrivate15QCallableObjectIZN7cavalry19populatePresetsMenuEP3ApiP5QMenuRKNSt3__112basic_stringIcNS6_11char_traitsIcEENS6_9allocatorIcEEEESE_E3$_1NS_4ListIJEEEvE4implEiPNS_15QSlotObjectBaseEP7QObjectPPvPb";
inline constexpr char kRunGuiScriptSymbol[] =
    "__ZN7cavalry12runGuiScriptEP3ApiRKNSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEENS2_8functionIFvPN2v87IsolateERNSC_5LocalINSC_7ContextEEEEEEbb";
inline constexpr std::uintptr_t kRunGuiScriptOffset = 0x007f7b60;

inline constexpr std::uintptr_t kTextFromFileExportOffset = 0x00514780;
inline constexpr std::uintptr_t kCoreEntryWindowOffset = 0x00514780;
inline constexpr std::array<std::uint8_t, 40> kCoreEntryWindowBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56,
    0x53, 0x48, 0x81, 0xec, 0x88, 0x02, 0x00, 0x00,
    0x49, 0x89, 0xf6, 0x48, 0x89, 0xfb, 0x48, 0x8b,
    0x05, 0xcb, 0x14, 0xad, 0x00, 0x48, 0x8b, 0x00,
    0x48, 0x89, 0x45, 0xe0, 0x48, 0x8d, 0xbd, 0xa0,
};

inline constexpr std::uintptr_t kOptionalEngagedOffset = 0x18;
inline constexpr std::size_t kOptionalResultBytes = 0x20;
inline constexpr std::uintptr_t kPresetCallbackEntryOffset = 0x00770650;
inline constexpr std::array<std::uint8_t, 24> kPresetCallbackEntryBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x56, 0x53, 0x48,
    0x83, 0xec, 0x70, 0x48, 0x89, 0xf3, 0x48, 0x8b,
    0x05, 0x63, 0x01, 0x9c, 0x00, 0x48, 0x8b, 0x00,
};
inline constexpr std::uintptr_t kPresetCallWindowOffset = 0x007706b5;
inline constexpr std::uintptr_t kPresetTextFromFileCallOffset = 0x007706bd;
inline constexpr std::uintptr_t kPresetTextFromFileReturnOffset = 0x007706c2;
inline constexpr std::uintptr_t kPresetRunGuiScriptCallOffset = 0x00770713;
inline constexpr std::uintptr_t kPresetRunGuiScriptReturnOffset = 0x00770718;
inline constexpr std::uintptr_t kTextFromFileGotOffset = 0x0112a708;
inline constexpr std::uintptr_t kTextFromFileStubOffset = 0x00e32db2;
inline constexpr std::array<std::uint8_t, 6> kTextFromFileStubBytes = {
    0xff, 0x25, 0x50, 0x79, 0x2f, 0x00,
};
inline constexpr std::array<std::uint8_t, 23> kPresetCallWindowBytes = {
    0x48, 0x8d, 0x73, 0x18, 0x48, 0x8d, 0x7d, 0x80,
    0xe8, 0xf0, 0x26, 0x6c, 0x00, 0x80, 0x7d, 0x98,
    0x01, 0x0f, 0x85, 0xdd, 0x00, 0x00, 0x00,
};
inline constexpr std::array<std::uint8_t, 5> kPresetRunGuiScriptCallBytes = {
    0xe8, 0x48, 0x74, 0x08, 0x00,
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
static_assert(kPresetTextFromFileReturnOffset +
              signedRel32(readU32(kPresetCallWindowBytes.data() + 9U)) ==
              static_cast<std::int64_t>(kTextFromFileStubOffset));
static_assert(kPresetRunGuiScriptCallBytes[0] == 0xe8);
static_assert(kPresetRunGuiScriptCallOffset + 5U +
              signedRel32(readU32(kPresetRunGuiScriptCallBytes.data() + 1U)) ==
              static_cast<std::int64_t>(kRunGuiScriptOffset));
}  // namespace native_demo_reader::contract
