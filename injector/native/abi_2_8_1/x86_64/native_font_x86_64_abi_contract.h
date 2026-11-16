/**
 * [INPUT]: 依赖官方2.8 x86_64 Core、Extension与Skia Mach-O切片。
 * [OUTPUT]: 锁定x86 factory、原函数绑定、Timeline解码与透传合同。
 * [POS]: x86字体ABI事实表；主门还要求locale合同同时通过。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#if !defined(__x86_64__)
#error "x86_64 font ABI contract requires an x86_64 target."
#endif

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string_view>

namespace native_font_x86_64_abi::contract {
inline constexpr char kCoreUuid[] =
    "23B9AC22-F909-3455-BD02-4E90796E35B5";
inline constexpr char kExtensionUuid[] =
    "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kSkiaUuid[] =
    "86ACD2F2-91F5-308C-BBAE-23183E8D218D";

inline constexpr char kMakeScalableFontSymbol[] =
    "__ZN7cavalry16MakeScalableFontE5sk_spI10SkTypefaceEf";
inline constexpr std::uintptr_t kMakeScalableFontOffset = 0x0aec60;
inline constexpr std::array<std::uint8_t, 37> kMakeScalableFontBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x56, 0x53, 0x48, 0x83, 0xec,
    0x10, 0x48, 0x89, 0xfb, 0x48, 0x8b, 0x06, 0x48, 0xc7, 0x06,
    0x00, 0x00, 0x00, 0x00, 0x48, 0x89, 0x45, 0xe8, 0x48, 0x8d,
    0x75, 0xe8, 0xe8, 0x65, 0x74, 0xbb, 0x00};

inline constexpr char kMakeTypefaceSymbol[] =
    "__Z24SkMakeTypefaceFromCTFontPK8__CTFont";
inline constexpr std::uintptr_t kMakeTypefaceOffset = 0x3dd960;
inline constexpr std::array<std::uint8_t, 29> kMakeTypefaceBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x56, 0x53, 0x48, 0x83, 0xec,
    0x10, 0x49, 0x89, 0xf6, 0x48, 0x89, 0xfb, 0x48, 0x89, 0xf7,
    0xe8, 0xb3, 0x4c, 0x3c, 0x00, 0x4c, 0x89, 0x75, 0xe0};
inline constexpr char kGetCTFontSymbol[] =
    "__Z23SkTypeface_GetCTFontRefPK10SkTypeface";
inline constexpr std::uintptr_t kGetCTFontOffset = 0x3dd670;
inline constexpr std::array<std::uint8_t, 19> kGetCTFontBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x48, 0x85, 0xff, 0x74, 0x0a, 0x48,
    0x8b, 0x07, 0x5d, 0xff, 0xa0, 0xf8, 0x00, 0x00, 0x00};
inline constexpr char kGlyphSymbol[] =
    "__ZNK10SkTypeface14unicharToGlyphEi";
inline constexpr std::uintptr_t kGlyphOffset = 0x1e6050;
inline constexpr std::array<std::uint8_t, 33> kGlyphBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x48, 0x83, 0xec, 0x10, 0x89, 0x75,
    0xf8, 0x66, 0xc7, 0x45, 0xfe, 0x00, 0x00, 0x48, 0x8b, 0x07,
    0x48, 0x8d, 0x75, 0xf8, 0x48, 0x8d, 0x4d, 0xfe, 0xba, 0x01,
    0x00, 0x00, 0x00};

inline constexpr char kGetPathSymbol[] =
    "__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath";
inline constexpr std::uintptr_t kGetPathOffset = 0x1b650;
inline constexpr std::array<std::uint8_t, 32> kGetPathBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56, 0x41, 0x54,
    0x53, 0x48, 0x81, 0xec, 0x30, 0x01, 0x00, 0x00, 0x4c, 0x89,
    0xc3, 0x49, 0x89, 0xcf, 0x0f, 0x29, 0x8d, 0xd0, 0xfe, 0xff,
    0xff, 0x0f};
inline constexpr char kSetSizeSymbol[] = "__ZN6SkFont7setSizeEf";
inline constexpr std::uintptr_t kSetSizeOffset = 0x121560;
inline constexpr std::array<std::uint8_t, 18> kSetSizeBytes = {
    0x55, 0x48, 0x89, 0xe5, 0x0f, 0x57, 0xc9, 0xf3, 0x0f,
    0x5f, 0xc1, 0xf3, 0x0f, 0x11, 0x47, 0x08, 0x5d, 0xc3};

inline constexpr std::uintptr_t kTimelineCapturePointerOffset = 0x18;
inline constexpr std::uintptr_t kTimelineNodeDataStringOffset = 0x08;
inline constexpr std::size_t kTimelineStringObjectBytes = 0x18;
inline constexpr std::uintptr_t kStringFlagOffset = 0x00;
inline constexpr std::uint8_t kLongStringFlagMask = 0x01;
inline constexpr std::uintptr_t kLongStringLengthOffset = 0x08;
inline constexpr std::uintptr_t kLongStringDataOffset = 0x10;
inline constexpr std::uintptr_t kShortStringDataOffset = 0x01;
inline constexpr std::uint8_t kShortStringLengthShift = 1;
inline constexpr std::size_t kShortStringCapacity = 22;

inline constexpr std::uintptr_t kMeasureCaptureLoadOffset = 0x639947;
inline constexpr std::array<std::uint8_t, 4> kMeasureCaptureLoadBytes = {
    0x4c, 0x8b, 0x73, 0x18};
inline constexpr std::uintptr_t kMeasureStringTagReadOffset = 0x63994b;
inline constexpr std::array<std::uint8_t, 5> kMeasureStringTagReadBytes = {
    0x41, 0xf6, 0x46, 0x08, 0x01};
inline constexpr std::array<std::uint8_t, 17> kMeasureStringBranchBytes = {
    0x41, 0xf6, 0x46, 0x08, 0x01, 0x75, 0x06, 0x49, 0x83,
    0xc6, 0x09, 0xeb, 0x04, 0x4d, 0x8b, 0x76, 0x18};
inline constexpr std::uintptr_t kMeasureCallOffset = 0x63997e;
inline constexpr std::uintptr_t kMeasureReturnOffset = 0x639983;
inline constexpr std::array<std::uint8_t, 5> kMeasureCallBytes = {
    0xe8, 0x55, 0xb3, 0x7f, 0x00};
inline constexpr std::uintptr_t kDrawStringDecodeOffset = 0x639e2b;
inline constexpr std::array<std::uint8_t, 36> kDrawStringDecodeBytes = {
    0x48, 0x8b, 0x4b, 0x08, 0x48, 0x8b, 0x73, 0x18, 0x48, 0x8b,
    0x39, 0x0f, 0xb6, 0x56, 0x08, 0xf6, 0xc2, 0x01, 0x75, 0x08,
    0x48, 0x83, 0xc6, 0x09, 0xd1, 0xea, 0xeb, 0x08, 0x48, 0x8b,
    0x56, 0x10, 0x48, 0x8b, 0x76, 0x18};
inline constexpr std::uintptr_t kDrawCallOffset = 0x639e6a;
inline constexpr std::uintptr_t kDrawReturnOffset = 0x639e6f;
inline constexpr std::array<std::uint8_t, 5> kDrawCallBytes = {
    0xe8, 0xc1, 0x9b, 0x7f, 0x00};

struct TimelineStringLayout {
    std::uintptr_t fieldOffset;
    std::size_t objectBytes;
    std::uintptr_t flagOffset;
    std::uint8_t longFlagMask;
    std::uintptr_t longLengthOffset;
    std::uintptr_t longDataOffset;
    std::uintptr_t shortDataOffset;
    std::uint8_t shortLengthShift;
    std::size_t shortCapacity;
};

struct TimelineStringView {
    std::uintptr_t dataAddress = 0;
    std::size_t size = 0;
    bool longForm = false;
};

struct FactoryAddresses {
    std::uintptr_t makeTypeface = 0;
    std::uintptr_t getCTFont = 0;
    std::uintptr_t makeScalableFont = 0;
    std::uintptr_t glyph = 0;
    std::uintptr_t setSize = 0;
};

struct OriginalFunctionAddresses {
    std::uintptr_t getPath = 0;
    std::uintptr_t measureText = 0;
    std::uintptr_t drawText = 0;
    std::uintptr_t makeTextBlob = 0;
};

constexpr bool originalFunctionsMatch(
    const OriginalFunctionAddresses &actual, std::uintptr_t skiaBase,
    std::uintptr_t getPathOffset, std::uintptr_t measureTextOffset,
    std::uintptr_t drawTextOffset, std::uintptr_t makeTextBlobOffset) noexcept
{
    if (skiaBase == 0 || getPathOffset == 0 || measureTextOffset == 0 ||
        drawTextOffset == 0 || makeTextBlobOffset == 0 ||
        skiaBase > UINTPTR_MAX - getPathOffset ||
        skiaBase > UINTPTR_MAX - measureTextOffset ||
        skiaBase > UINTPTR_MAX - drawTextOffset ||
        skiaBase > UINTPTR_MAX - makeTextBlobOffset) return false;
    return actual.getPath == skiaBase + getPathOffset &&
        actual.measureText == skiaBase + measureTextOffset &&
        actual.drawText == skiaBase + drawTextOffset &&
        actual.makeTextBlob == skiaBase + makeTextBlobOffset;
}

constexpr bool factoryAddressesMatch(const FactoryAddresses &actual,
                                     std::uintptr_t skiaBase,
                                     std::uintptr_t coreBase) noexcept
{
    return skiaBase != 0 && coreBase != 0 &&
        skiaBase <= UINTPTR_MAX - kSetSizeOffset &&
        coreBase <= UINTPTR_MAX - kMakeScalableFontOffset &&
        actual.makeTypeface == skiaBase + kMakeTypefaceOffset &&
        actual.getCTFont == skiaBase + kGetCTFontOffset &&
        actual.glyph == skiaBase + kGlyphOffset &&
        actual.setSize == skiaBase + kSetSizeOffset &&
        actual.makeScalableFont == coreBase + kMakeScalableFontOffset;
}

constexpr bool fontLaneContractsReady(bool localeReady,
                                      bool x86FontAbiReady) noexcept
{
    return localeReady && x86FontAbiReady;
}

inline bool decodeTimelineString(const std::uint8_t *object,
                                std::uintptr_t objectAddress,
                                std::size_t maximumSize,
                                TimelineStringView *output) noexcept
{
    if (object == nullptr || objectAddress == 0 || output == nullptr ||
        maximumSize == 0) return false;
    TimelineStringView candidate{};
    const std::uint8_t tag = object[kStringFlagOffset];
    if ((tag & kLongStringFlagMask) != 0) {
        std::uint64_t size = 0;
        std::uintptr_t data = 0;
        std::memcpy(&size, object + kLongStringLengthOffset, sizeof(size));
        std::memcpy(&data, object + kLongStringDataOffset, sizeof(data));
        if (data == 0 || size == 0 || size > maximumSize ||
            size > static_cast<std::uint64_t>(SIZE_MAX)) return false;
        candidate = {data, static_cast<std::size_t>(size), true};
    } else {
        const std::size_t size = static_cast<std::size_t>(tag >> kShortStringLengthShift);
        if (size == 0 || size > kShortStringCapacity || size > maximumSize ||
            object[kShortStringDataOffset + size] != 0 ||
            objectAddress > UINTPTR_MAX - kShortStringDataOffset) return false;
        candidate = {objectAddress + kShortStringDataOffset, size, false};
    }
    *output = candidate;
    return true;
}

template <typename Forward, typename Adapt>
auto forwardUnlessVerified(bool admitted, bool exactCaller, bool completeOwner,
                           Forward &&forward, Adapt &&adapt)
    noexcept(noexcept(forward()) && noexcept(adapt())) -> decltype(forward())
{
    if (!admitted || !exactCaller || !completeOwner) return forward();
    return adapt();
}

inline constexpr TimelineStringLayout kTimelineStringLayout = {
    kTimelineNodeDataStringOffset, kTimelineStringObjectBytes,
    kStringFlagOffset, kLongStringFlagMask, kLongStringLengthOffset,
    kLongStringDataOffset, kShortStringDataOffset,
    kShortStringLengthShift, kShortStringCapacity};

constexpr bool uuidMatches(std::string_view actual,
                           std::string_view expected) noexcept
{
    return !expected.empty() && actual == expected;
}

template <std::size_t N>
constexpr bool codeWindowMatches(const std::array<std::uint8_t, N> &expected,
                                 const std::array<std::uint8_t, N> &actual) noexcept
{
    return expected == actual;
}

constexpr bool timelineStringLayoutMatches(
    const TimelineStringLayout &layout) noexcept
{
    return layout.fieldOffset == 0x08 && layout.objectBytes == 0x18 &&
        layout.flagOffset == 0 && layout.longFlagMask == 0x01 &&
        layout.longLengthOffset == 0x08 && layout.longDataOffset == 0x10 &&
        layout.shortDataOffset == 0x01 && layout.shortLengthShift == 1 &&
        layout.shortCapacity == 22;
}

static_assert(kMeasureCallOffset + kMeasureCallBytes.size() ==
              kMeasureReturnOffset);
static_assert(kDrawCallOffset + kDrawCallBytes.size() == kDrawReturnOffset);
static_assert(kTimelineStringLayout.objectBytes == 24);
}  // namespace native_font_x86_64_abi::contract
