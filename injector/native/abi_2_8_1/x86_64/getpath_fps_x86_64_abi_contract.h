/**
 * [INPUT]: 依赖官方2.8 x86_64 Extension与Core GetPath调用合同。
 * [OUTPUT]: 锁定Viewport FPS格式化文案进入MakePathFromText的返回点。
 * [POS]: GetPath x86 FPS owner的窄补充；不匹配时保留原绘制。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#if !defined(__x86_64__)
#error "Viewport FPS x86_64 contract requires x86_64."
#endif

#include <array>
#include <cstdint>

namespace native_getpath_fps_x86_64::contract {
inline constexpr char kExtensionUuid[] =
    "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kCoreUuid[] =
    "23B9AC22-F909-3455-BD02-4E90796E35B5";
inline constexpr char kMakePathFromTextSymbol[] =
    "__ZN7cavalry16MakePathFromTextERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEd";
inline constexpr std::uintptr_t kMakePathFromTextCallOffset = 0x25bb82;
inline constexpr std::uintptr_t kMakePathFromTextReturnOffset = 0x25bb87;
inline constexpr std::uintptr_t kViewportFpsProducerWindowOffset = 0x25bb52;
inline constexpr std::array<std::uint8_t, 53> kViewportFpsProducerWindowBytes = {
    0x48, 0x8d, 0x35, 0x82, 0xbd, 0xde, 0x00, 0x48,
    0x8d, 0xbd, 0x10, 0xf1, 0xff, 0xff, 0x48, 0x8d,
    0x95, 0x00, 0xf5, 0xff, 0xff, 0xe8, 0xc4, 0x13,
    0xe1, 0xff, 0x48, 0x8d, 0xbd, 0xc0, 0xf5, 0xff,
    0xff, 0x48, 0x8d, 0xb5, 0x10, 0xf1, 0xff, 0xff,
    0xf2, 0x0f, 0x10, 0x05, 0xe6, 0x8b, 0xd6, 0x00,
    0xe8, 0xab, 0x73, 0xbd, 0x00};
inline constexpr char kLocaleKey[] = "viewport.fps";

constexpr bool viewportFpsProducerReturn(std::uintptr_t extensionOffset) noexcept
{
    return extensionOffset == kMakePathFromTextReturnOffset;
}

static_assert(kMakePathFromTextCallOffset + 5U == kMakePathFromTextReturnOffset);
static_assert(kViewportFpsProducerWindowOffset +
              kViewportFpsProducerWindowBytes.size() ==
              kMakePathFromTextReturnOffset);
} // namespace native_getpath_fps_x86_64::contract
