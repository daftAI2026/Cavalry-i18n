/**
 * [INPUT]: 依赖官方2.8 x86_64 Core、Extension与Skia字节窗。
 * [OUTPUT]: 锁定Graph空态GetPath调用及Core到Extension双帧owner链。
 * [POS]: x86 Graph静态合同；不改arm64 GetPath合同或准入其他owner。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_getpath_graph_x86_64::contract {
inline constexpr char kCoreUuid[] = "23B9AC22-F909-3455-BD02-4E90796E35B5";
inline constexpr char kExtensionUuid[] = "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kSkiaUuid[] = "86ACD2F2-91F5-308C-BBAE-23183E8D218D";
inline constexpr char kMakePathFromTextSymbol[] =
    "__ZN7cavalry16MakePathFromTextERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEd";
inline constexpr char kGetPathSymbol[] =
    "__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath";
inline constexpr std::uintptr_t kMakePathFromTextExportOffset = 0x00072670;
inline constexpr std::uintptr_t kGetPathExportOffset = 0x0001b650;
inline constexpr std::uintptr_t kCoreGetPathCallOffset = 0x00072731;
inline constexpr std::uintptr_t kCoreGetPathReturnOffset = 0x00072736;
inline constexpr std::array<std::uint8_t, 24> kCoreGetPathCallWindowBytes = {
    0x48, 0x8d, 0x4d, 0xb0, 0x4c, 0x8d, 0x45, 0xd8,
    0x0f, 0x57, 0xc0, 0x0f, 0x57, 0xc9, 0x4c, 0x89,
    0xf7, 0x31, 0xd2, 0xe8, 0xce, 0x31, 0xbf, 0x00,
};
inline constexpr std::uintptr_t kExtensionGraphProducerCallOffset = 0x005edc30;
inline constexpr std::uintptr_t kExtensionGraphProducerReturnOffset = 0x005edc35;
inline constexpr std::array<std::uint8_t, 16> kExtensionGraphProducerCallWindowBytes = {
    0x48, 0x8d, 0x7d, 0x80, 0x48, 0x8d, 0xb5, 0xd0,
    0xfe, 0xff, 0xff, 0xe8, 0xfd, 0x52, 0x84, 0x00,
};
static_assert(kCoreGetPathCallOffset + 5U == kCoreGetPathReturnOffset);
static_assert(kExtensionGraphProducerCallOffset + 5U ==
              kExtensionGraphProducerReturnOffset);
static_assert(kCoreGetPathCallWindowBytes[19] == 0xe8);
static_assert(kExtensionGraphProducerCallWindowBytes[11] == 0xe8);
}  // namespace native_getpath_graph_x86_64::contract
