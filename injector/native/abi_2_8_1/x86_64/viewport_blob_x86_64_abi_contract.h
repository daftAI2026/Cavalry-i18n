/**
 * [INPUT]: 依赖官方2.8 x86_64 Extension与Skia机器码、Mach-O UUID。
 * [OUTPUT]: 锁定Viewport getNiceName到首个TextBlob caller及sret调用窗。
 * [POS]: 只证明固定Viewport名称路径；混合文字覆盖路径不获准入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#if !defined(__x86_64__)
#error "Viewport TextBlob x86_64 contract requires x86_64."
#endif

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_viewport_blob_x86_64::contract {
inline constexpr char kExtensionUuid[] =
    "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kSkiaUuid[] =
    "86ACD2F2-91F5-308C-BBAE-23183E8D218D";
inline constexpr char kCoreUuid[] =
    "23B9AC22-F909-3455-BD02-4E90796E35B5";

inline constexpr char kViewportNameLambdaSymbol[] =
    "__ZZN20GraphicsViewportBase11renderFrameER8SkCanvasbENK3$_1clEP12DrawableNodeb";
inline constexpr std::uintptr_t kViewportNameLambdaOffset = 0x25ed30;
inline constexpr std::array<std::uint8_t, 45> kViewportNameLambdaEntryBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56, 0x41, 0x55, 0x41, 0x54, 0x53, 0x48, 0x81, 0xec, 0xf8, 0x02, 0x00, 0x00, 0x41, 0x89, 0xd7, 0x48, 0x89, 0xf3, 0x49, 0x89, 0xfe, 0x48, 0x8b, 0x05, 0x74, 0x1a, 0xed, 0x00, 0x48, 0x8b, 0x00, 0x48, 0x89, 0x45, 0xd0, 0x48, 0x8b};

// -- getNiceName writes the source into the fixed local std::string ---------
inline constexpr std::uintptr_t kGetNiceNameCallOffset = 0x25ed7b;
inline constexpr std::array<std::uint8_t, 15> kGetNiceNameCallWindowBytes = {
    0x48, 0x8d, 0xbd, 0x00, 0xff, 0xff, 0xff, 0x48,
    0x89, 0xde, 0xe8, 0x72, 0x3f, 0xbd, 0x00};
inline constexpr char kGetNiceNameSymbol[] = "__ZN7cavalry11getNiceNameEPK8NodeBase";
inline constexpr std::uintptr_t kGetNiceNameExportOffset = 0x41b0f0;
inline constexpr std::uintptr_t kNameObjectBelowFrame = 0x100;
inline constexpr std::size_t kStringObjectBytes = 0x18;
inline constexpr std::uintptr_t kStringTagOffset = 0x00;
inline constexpr std::uint8_t kLongStringFlagMask = 0x01;
inline constexpr std::uintptr_t kLongStringLengthOffset = 0x08;
inline constexpr std::uintptr_t kLongStringDataOffset = 0x10;
inline constexpr std::uintptr_t kShortStringDataOffset = 0x01;
inline constexpr std::uint8_t kShortStringLengthShift = 1;
inline constexpr std::size_t kShortStringCapacity = 22;
inline constexpr std::size_t kMaximumNameBytes = 16384;
inline constexpr std::uintptr_t kNameDecodeOffset = 0x25ef51;
inline constexpr std::array<std::uint8_t, 40> kNameDecodeWindowBytes = {
    0x0f, 0xb6, 0x95, 0x00, 0xff, 0xff, 0xff, 0x4c,
    0x8d, 0xbd, 0x01, 0xff, 0xff, 0xff, 0xf6, 0xc2,
    0x01, 0x74, 0x10, 0x48, 0x8b, 0xb5, 0x10, 0xff,
    0xff, 0xff, 0x48, 0x8b, 0x95, 0x08, 0xff, 0xff,
    0xff, 0xeb, 0x05, 0xd1, 0xea, 0x4c, 0x89, 0xfe};

// -- 首个Blob使用完整裁切后名称；第二个Blob只绘制variant，不准入 ---------
inline constexpr char kMakeFromTextSymbol[] =
    "__ZN10SkTextBlob12MakeFromTextEPKvmRK6SkFont14SkTextEncoding";
inline constexpr std::uintptr_t kMakeFromTextOffset = 0x1e42f0;
inline constexpr std::uintptr_t kViewportBlobCallOffset = 0x25f8b4;
inline constexpr std::uintptr_t kViewportBlobReturnOffset = 0x25f8b9;
inline constexpr std::array<std::uint8_t, 38> kViewportBlobCallWindowBytes = {
    0x48, 0x8d, 0x0d, 0x61, 0xea, 0xed, 0x00, 0x48,
    0x8d, 0x7d, 0x90, 0x4c, 0x89, 0xfe, 0x48, 0x89,
    0xc2, 0x45, 0x31, 0xc0, 0xe8, 0x5b, 0x09, 0xbd,
    0x00, 0x48, 0x8b, 0x75, 0x90, 0x48, 0x85, 0xf6,
    0x0f, 0x84, 0xab, 0x09, 0x00, 0x00};
inline constexpr std::uintptr_t kMixedVariantBlobCallOffset = 0x260067;
inline constexpr std::uintptr_t kMixedVariantBlobReturnOffset = 0x26006c;
inline constexpr std::array<std::uint8_t, 26> kMixedVariantBlobCallWindowBytes = {
    0x54, 0x24, 0x08, 0x49, 0x8b, 0x74, 0x24, 0x10,
    0x48, 0x8d, 0xbd, 0x90, 0xfe, 0xff, 0xff, 0x48,
    0x89, 0xd9, 0x45, 0x31, 0xc0, 0xe8, 0xa8, 0x01,
    0xbd, 0x00};

inline constexpr std::array<std::uint8_t, 32> kMakeFromTextFunctionBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56,
    0x41, 0x55, 0x41, 0x54, 0x53, 0x48, 0x81, 0xec,
    0x88, 0x00, 0x00, 0x00, 0x45, 0x89, 0xc7, 0x49,
    0x89, 0xce, 0x49, 0x89, 0xd4, 0x49, 0x89, 0xf5};
inline constexpr std::uintptr_t kSretSlotBelowFrame = 0x70;

inline constexpr bool exactViewportNameBlobCaller(
    std::uintptr_t extensionOffset) noexcept
{
    return extensionOffset == kViewportBlobReturnOffset;
}

static_assert(kViewportBlobCallOffset + 5U == kViewportBlobReturnOffset);
static_assert(kMixedVariantBlobCallOffset + 5U == kMixedVariantBlobReturnOffset);
static_assert(kStringObjectBytes == 24U && kNameObjectBelowFrame == 0x100U);
static_assert(kViewportBlobCallWindowBytes.size() == 38U);
} // namespace native_viewport_blob_x86_64::contract
