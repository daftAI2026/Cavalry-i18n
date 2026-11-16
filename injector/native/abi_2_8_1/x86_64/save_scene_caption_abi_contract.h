/**
 * [INPUT]: Official Cavalry 2.8.1 Intel Extension and QtWidgets call windows.
 * [OUTPUT]: Locks Save and fixed Load .cv caption paths to their exact Qt imports.
 * [POS]: Intel 2.8.1 save/open profile; caller and caption source stay bounded.
 * [PROTOCOL]: Keep both QFileDialog callers and their import targets byte-validated.
 */
#pragma once

#if !defined(__x86_64__)
#error "Cavalry 2.8.1 Intel scene caption ABI requires x86_64."
#endif

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_save_scene_caption::contract {
inline constexpr char kExtensionUuid[] = "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kExtensionSha256[] =
    "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050";
inline constexpr char kQtWidgetsUuid[] = "0C194E6E-1E76-3FD4-83A3-9263616E2F3F";
inline constexpr char kQtWidgetsSha256[] =
    "49edad6d9347af5b5373d3768cccf661ef4876d5fe508ce25324df2aadfaf5b7";
inline constexpr char kQtVersion[] = "6.9.2";
inline constexpr char kGetSaveFileNameSymbol[] =
    "__ZN11QFileDialog15getSaveFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE";
inline constexpr char kGetOpenFileNameSymbol[] =
    "__ZN11QFileDialog15getOpenFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE";
inline constexpr char kChooseSceneSaveSymbol[] =
    "__ZN7cavalry15presentSaveFileERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEES8_S8_S8_";
inline constexpr std::uintptr_t kChooseSceneSaveOffset = 0x00755360;
inline constexpr char kChooseSceneOpenSymbol[] = "__ZN7cavalry15chooseSceneOpenEP3Api";
inline constexpr char kPresentOpenFileSymbol[] =
    "__ZN7cavalry15presentOpenFileERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEES8_S8_";
inline constexpr char kLoadCvSource[] = "Load .cv";

// Existing fixed Save caption path.
inline constexpr std::uintptr_t kCallWindowOffset = 0x007556ca;
inline constexpr std::uintptr_t kCallOffset = 0x007556f3;
inline constexpr std::uintptr_t kReturnOffset = 0x007556f8;
inline constexpr std::uintptr_t kImportStubOffset = 0x00e303e2;
inline constexpr std::array<std::uint8_t, 6> kSaveImportStubBytes = {
    0xff, 0x25, 0x78, 0xc0, 0x2f, 0x00,
};
inline constexpr std::uintptr_t kQtWidgetsExportOffset = 0x002aeab0;
inline constexpr std::uintptr_t kGetSaveFileNameGotOffset = 0x0112c460;
inline constexpr std::array<std::uint8_t, 46> kCallWindowBytes = {
    0xc7, 0x04, 0x24, 0x00, 0x00, 0x00, 0x00,
    0x48, 0x8d, 0xbd, 0x18, 0xff, 0xff, 0xff,
    0x48, 0x8d, 0x95, 0x30, 0xff, 0xff, 0xff,
    0x48, 0x8d, 0x8d, 0x48, 0xff, 0xff, 0xff,
    0x4c, 0x8d, 0x85, 0x60, 0xff, 0xff, 0xff,
    0x4c, 0x89, 0xe6, 0x45, 0x31, 0xc9,
    0xe8, 0xea, 0xac, 0x6d, 0x00,
};

// 2.8.1 fixed Open caption producer and QFileDialog path.
inline constexpr std::uintptr_t kChooseSceneOpenOffset = 0x006abf00;
inline constexpr std::uintptr_t kLoadCvSourceWindowOffset = 0x006abf2b;
inline constexpr std::array<std::uint8_t, 22> kLoadCvSourceWindowBytes = {
    0xc6, 0x45, 0xc8, 0x10, 0x48, 0xb8, 0x4c, 0x6f,
    0x61, 0x64, 0x20, 0x2e, 0x63, 0x76, 0x48, 0x89,
    0x45, 0xc9, 0xc6, 0x45, 0xd1, 0x00,
};
inline constexpr std::uintptr_t kChooseSceneOpenProducerCallOffset = 0x006abf88;
inline constexpr std::uintptr_t kChooseSceneOpenProducerReturnOffset = 0x006abf8d;
inline constexpr std::array<std::uint8_t, 5> kChooseSceneOpenProducerCallBytes = {
    0xe8, 0x83, 0x90, 0x0a, 0x00,
};
inline constexpr std::uintptr_t kPresentOpenFileOffset = 0x00755010;
inline constexpr std::uintptr_t kOpenFileNameQtWidgetsExportOffset = 0x002adb50;
inline constexpr std::uintptr_t kOpenFileNameImportStubOffset = 0x00e303dc;
inline constexpr std::array<std::uint8_t, 6> kOpenFileNameImportStubBytes = {
    0xff, 0x25, 0x76, 0xc0, 0x2f, 0x00,
};
inline constexpr std::uintptr_t kOpenFileNameGotOffset = 0x0112c458;
inline constexpr std::uintptr_t kOpenFileNameCallWindowOffset = 0x00755130;
inline constexpr std::uintptr_t kOpenFileNameCallOffset = 0x00755150;
inline constexpr std::uintptr_t kOpenFileNameReturnOffset = 0x00755155;
inline constexpr std::array<std::uint8_t, 37> kOpenFileNameCallWindowBytes = {
    0x00, 0x00, 0x00, 0x00, 0x48, 0x8d, 0xbd, 0x60,
    0xff, 0xff, 0xff, 0x48, 0x8d, 0x95, 0x78, 0xff,
    0xff, 0xff, 0x48, 0x8d, 0x4d, 0x90, 0x4c, 0x8d,
    0x45, 0xa8, 0x4c, 0x89, 0xf6, 0x45, 0x31, 0xc9,
    0xe8, 0x87, 0xb2, 0x6d, 0x00,
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
static_assert(kCallWindowOffset + kCallWindowBytes.size() == kReturnOffset);
static_assert(kCallOffset - kCallWindowOffset == 41U);
static_assert(kCallOffset + 5U == kReturnOffset);
static_assert(kCallWindowBytes[41] == 0xe8);
static_assert(kReturnOffset + signedRel32(readU32(kCallWindowBytes.data() + 42U)) ==
              static_cast<std::int64_t>(kImportStubOffset));
static_assert(kImportStubOffset + kSaveImportStubBytes.size() +
              signedRel32(readU32(kSaveImportStubBytes.data() + 2U)) ==
              kGetSaveFileNameGotOffset);
static_assert(kChooseSceneOpenOffset < kLoadCvSourceWindowOffset);
static_assert(kLoadCvSourceWindowOffset + kLoadCvSourceWindowBytes.size() <
              kChooseSceneOpenProducerCallOffset);
static_assert(kChooseSceneOpenProducerCallOffset + 5U ==
              kChooseSceneOpenProducerReturnOffset);
static_assert(kChooseSceneOpenProducerCallBytes[0] == 0xe8);
static_assert(kChooseSceneOpenProducerReturnOffset +
              signedRel32(readU32(kChooseSceneOpenProducerCallBytes.data() + 1U)) ==
              static_cast<std::int64_t>(kPresentOpenFileOffset));
static_assert(kOpenFileNameCallOffset == kOpenFileNameCallWindowOffset + 32U);
static_assert(kOpenFileNameCallOffset + 5U == kOpenFileNameReturnOffset);
static_assert(kOpenFileNameCallWindowBytes[32] == 0xe8);
static_assert(kOpenFileNameReturnOffset +
              signedRel32(readU32(kOpenFileNameCallWindowBytes.data() + 33U)) ==
              static_cast<std::int64_t>(kOpenFileNameImportStubOffset));
static_assert(kOpenFileNameImportStubOffset +
              kOpenFileNameImportStubBytes.size() +
              signedRel32(readU32(kOpenFileNameImportStubBytes.data() + 2U)) ==
              kOpenFileNameGotOffset);
}  // namespace native_save_scene_caption::contract
