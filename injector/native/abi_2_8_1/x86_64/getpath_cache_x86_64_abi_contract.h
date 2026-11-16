/**
 * [INPUT]: 依赖官方2.8 x86 Core GetPath与Extension缓存调用窗口。
 * [OUTPUT]: 锁定Core→缓存→固定生产者的两帧owner链。
 * [POS]: x86 ToolHelp与Viewport质量owner合同；未知生产者保持原路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#if !defined(__x86_64__)
#error "Cached GetPath x86_64 contract requires x86_64."
#endif

#include <array>
#include <cstdint>

namespace native_getpath_cache_x86_64::contract {
inline constexpr char kCoreUuid[] =
    "23B9AC22-F909-3455-BD02-4E90796E35B5";
inline constexpr char kExtensionUuid[] =
    "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kMakePathFromTextSymbol[] =
    "__ZN7cavalry16MakePathFromTextERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEd";
inline constexpr char kGetOrCreateTextPathSymbol[] =
    "__ZN20GraphicsViewportBase19getOrCreateTextPathERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEdRNS0_13unordered_mapIS6_N7cavalry4PathENS0_4hashIS6_EENS0_8equal_toIS6_EENS4_INS0_4pairIS7_SB_EEEEEE";
inline constexpr char kToolHelpProducerSymbol[] =
    "__ZN20GraphicsViewportBase13setupToolHelpEv";
inline constexpr char kViewportStatusProducerSymbol[] =
    "__ZN20GraphicsViewportBase11renderFrameER8SkCanvasb";

inline constexpr std::uintptr_t kGetOrCreateTextPathFunctionOffset = 0x00261770;
inline constexpr std::uintptr_t kToolHelpProducerFunctionOffset = 0x002554b0;
inline constexpr std::uintptr_t kViewportQualityProducerFunctionOffset = 0x002573c0;
inline constexpr std::uintptr_t kCoreGetPathReturnOffset = 0x00072736;
inline constexpr std::uintptr_t kCachedGetPathCallOffset = 0x00261aa6;
inline constexpr std::uintptr_t kCachedGetPathReturnOffset = 0x00261aab;
inline constexpr std::uintptr_t kToolHelpProducerCallAOffset = 0x002555a9;
inline constexpr std::uintptr_t kToolHelpProducerReturnAOffset = 0x002555ae;
inline constexpr std::uintptr_t kToolHelpProducerCallBOffset = 0x002555c2;
inline constexpr std::uintptr_t kToolHelpProducerReturnBOffset = 0x002555c7;
inline constexpr std::uintptr_t kViewportQualityProducerCallOffset = 0x0025c7e6;
inline constexpr std::uintptr_t kViewportQualityProducerReturnOffset = 0x0025c7eb;

inline constexpr std::uintptr_t kCachedGetPathWindowOffset = 0x00261a9b;
inline constexpr std::array<std::uint8_t, 16> kCachedGetPathWindowBytes = {
    0x5f, 0x5d, 0xc3, 0x4c, 0x89, 0xff, 0xf2, 0x0f,
    0x10, 0x45, 0x88, 0xe8, 0x87, 0x14, 0xbd, 0x00,
};
inline constexpr std::uintptr_t kToolHelpProducerAWindowOffset = 0x002555a2;
inline constexpr std::array<std::uint8_t, 12> kToolHelpProducerAWindowBytes = {
    0x4c, 0x8b, 0x65, 0xc0, 0x4c, 0x89,
    0xe1, 0xe8, 0xc2, 0xc1, 0x00, 0x00,
};
inline constexpr std::uintptr_t kToolHelpProducerBWindowOffset = 0x002555bf;
inline constexpr std::array<std::uint8_t, 8> kToolHelpProducerBWindowBytes = {
    0x4c, 0x89, 0xe1, 0xe8, 0xa9, 0xc1, 0x00, 0x00,
};
inline constexpr std::uintptr_t kViewportQualityProducerWindowOffset = 0x0025c7c2;
inline constexpr std::array<std::uint8_t, 41> kViewportQualityProducerWindowBytes = {
    0x48, 0x8b, 0x8d, 0x48, 0xf6, 0xff, 0xff, 0x48,
    0x81, 0xc1, 0x30, 0x05, 0x00, 0x00, 0x48, 0x8d,
    0xbd, 0xc0, 0xf5, 0xff, 0xff, 0x48, 0x8d, 0x95,
    0x10, 0xf1, 0xff, 0xff, 0xf2, 0x0f, 0x10, 0x05,
    0x82, 0x7f, 0xd6, 0x00, 0xe8, 0x85, 0x4f, 0x00, 0x00,
};

static_assert(kCachedGetPathCallOffset + 5U == kCachedGetPathReturnOffset);
static_assert(kToolHelpProducerCallAOffset + 5U == kToolHelpProducerReturnAOffset);
static_assert(kToolHelpProducerCallBOffset + 5U == kToolHelpProducerReturnBOffset);
static_assert(kViewportQualityProducerCallOffset + 5U ==
              kViewportQualityProducerReturnOffset);
static_assert(kCachedGetPathWindowOffset + kCachedGetPathWindowBytes.size() ==
              kCachedGetPathReturnOffset);
static_assert(kToolHelpProducerAWindowOffset + kToolHelpProducerAWindowBytes.size() ==
              kToolHelpProducerReturnAOffset);
static_assert(kToolHelpProducerBWindowOffset + kToolHelpProducerBWindowBytes.size() ==
              kToolHelpProducerReturnBOffset);
static_assert(kViewportQualityProducerWindowOffset +
              kViewportQualityProducerWindowBytes.size() ==
              kViewportQualityProducerReturnOffset);

enum class CachedProducer : std::uint8_t {
    Unknown,
    ToolHelpA,
    ToolHelpB,
    ViewportQuality,
};

constexpr CachedProducer producerForReturn(std::uintptr_t producerReturn) noexcept
{
    if (producerReturn == kToolHelpProducerReturnAOffset)
        return CachedProducer::ToolHelpA;
    if (producerReturn == kToolHelpProducerReturnBOffset)
        return CachedProducer::ToolHelpB;
    if (producerReturn == kViewportQualityProducerReturnOffset)
        return CachedProducer::ViewportQuality;
    return CachedProducer::Unknown;
}
}  // namespace native_getpath_cache_x86_64::contract
