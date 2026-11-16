/**
 * [INPUT]: Official Cavalry 2.8.1 x86_64 ExtensionLayer NodeView, Lina TextView/Drawable,
 *          and the intercepted Skia call windows from the same universal bundle.
 * [OUTPUT]: Locks the Intel 2.8.1 NodeView header owner, complete-source closure, and callers.
 * [POS]: x86_64-only profile; no ARM address or frame slot is reused.
 * [PROTOCOL]: Promote only with the matching x86_64 static checker and native map update.
 */
#pragma once

#if !defined(__x86_64__)
#error "Cavalry 2.8.1 NodeView font ABI profile requires x86_64."
#endif

#include <array>
#include <cstddef>
#include <cstdint>

namespace dependency_node_font::contract {
inline constexpr char kExtensionUuid[] = "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kExtensionSha256[] =
    "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050";

inline constexpr char kNodeViewConstructorSymbol[] =
    "__ZN7cavalry8NodeViewC2EP3ApiP8NodeBaseRKNS_12DGLayoutNodeEddNSt3__18functionIFvRKNS8_12basic_stringIcNS8_11char_traitsIcEENS8_9allocatorIcEEEESH_EEENS9_IFvSH_EEENS9_IFvRK13AttributePathEEE";
inline constexpr char kTextViewConstructorSymbol[] =
    "__ZN4lina8TextViewC2ERKNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE";
inline constexpr char kTextViewPaintSymbol[] = "__ZN4lina8TextView5paintEP8SkCanvas";
inline constexpr char kTextViewElideSymbol[] =
    "__ZN4lina8TextView16elideTextToWidthERKNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEfRK6SkFont";
inline constexpr char kDrawablePaintSymbol[] = "__ZN4lina8Drawable5paintEP8SkCanvas";
inline constexpr char kDrawableParentGetterSymbol[] =
    "__ZNK4lina8Drawable24getGlobalTransformMatrixEv";
inline constexpr char kViewComposerConstructorSymbol[] =
    "__ZN4lina12ViewComposerC2IJNS_8DrawableEN7cavalry9InOutViewEEEEDpPT_";
inline constexpr char kNodeNameUpdatedLambdaSymbol[] =
    "__ZZN7cavalry8NodeView18setNodeNameUpdatedEPK7QObjectENKUlRKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEE_clESC_";
inline constexpr char kTextViewConstructorTargetVtableSymbol[] =
    "__ZTVNSt3__110__function6__funcIZN4lina8TextViewC1ERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEEUlvE_FS9_vEEE";
inline constexpr char kTextViewSetTextTargetVtableSymbol[] =
    "__ZTVNSt3__110__function6__funcIZN4lina8TextView7setTextERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEEUlvE_FS9_vEEE";
inline constexpr char kTextViewConstructorTargetInvokeSymbol[] =
    "__ZNSt3__110__function6__funcIZN4lina8TextViewC1ERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEEUlvE_FS9_vEEclEv";
inline constexpr char kTextViewSetTextTargetInvokeSymbol[] =
    "__ZNSt3__110__function6__funcIZN4lina8TextView7setTextERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEEUlvE_FS9_vEEclEv";
inline constexpr char kTextViewVtableSymbol[] = "__ZTVN4lina8TextViewE";
inline constexpr char kNodeViewVtableSymbol[] = "__ZTVN7cavalry8NodeViewE";
inline constexpr char kHeaderDecorationVtableSymbol[] = "__ZTVN4lina20ComplexRoundRectViewE";

// Offsets below are for the official x86_64 slice only. Vtable pointer stores use Itanium +0x10.
inline constexpr std::uintptr_t kNodeViewConstructorOffset = 0x5c4190;
inline constexpr std::uintptr_t kTextViewConstructorOffset = 0x5be5b0;
inline constexpr std::uintptr_t kTextViewPaintOffset = 0x5be7a0;
inline constexpr std::uintptr_t kTextViewElideOffset = 0x5bed30;
inline constexpr std::uintptr_t kDrawablePaintOffset = 0x4d57c0;
inline constexpr std::uintptr_t kDrawableParentGetterOffset = 0x51d40;
inline constexpr std::uintptr_t kViewComposerConstructorOffset = 0x5c7300;
inline constexpr std::uintptr_t kNodeNameUpdatedLambdaOffset = 0x5cd0b0;

inline constexpr std::uintptr_t kNodeViewVtableOffset = 0x10f2bc0;
inline constexpr std::uintptr_t kNodeViewVtableAddressPointOffset = kNodeViewVtableOffset + 0x10;
inline constexpr std::uintptr_t kHeaderDecorationVtableOffset = 0x10f2c08;
inline constexpr std::uintptr_t kHeaderDecorationAddressPointOffset = kHeaderDecorationVtableOffset + 0x10;
inline constexpr std::uintptr_t kTextViewVtableOffset = 0x10f25d8;
inline constexpr std::uintptr_t kTextViewVtableAddressPointOffset = kTextViewVtableOffset + 0x10;
inline constexpr std::uintptr_t kTextViewConstructorTargetVtableOffset = 0x10f2620;
inline constexpr std::uintptr_t kTextViewConstructorTargetAddressPointOffset =
    kTextViewConstructorTargetVtableOffset + 0x10;
inline constexpr std::uintptr_t kTextViewSetTextTargetVtableOffset = 0x10f30a8;
inline constexpr std::uintptr_t kTextViewSetTextTargetAddressPointOffset =
    kTextViewSetTextTargetVtableOffset + 0x10;
inline constexpr std::uintptr_t kTextViewConstructorTargetInvokeOffset = 0x5bea80;
inline constexpr std::uintptr_t kTextViewSetTextTargetInvokeOffset = 0x5cd480;

// NodeView's direct-child vector is at +0x290; header text children are relative slots 0 and 1.
// Layout type 1 first appends ComplexRoundRectView; ViewComposer is appended after both headers.
inline constexpr std::uintptr_t kNodeViewChildrenVectorOffset = 0x290;
inline constexpr std::uintptr_t kNodeViewChildrenBeginOffset = 0x290;
inline constexpr std::uintptr_t kNodeViewChildrenEndOffset = 0x298;
inline constexpr std::uintptr_t kNodeViewChildrenCapacityOffset = 0x2a0;
inline constexpr std::size_t kNodeViewNameHeaderChildIndex = 0;
inline constexpr std::size_t kNodeViewTypeHeaderChildIndex = 1;
inline constexpr std::uintptr_t kDrawableParentPointerOffset = 0x2d8;
inline constexpr std::uintptr_t kNodeViewOptionalDecorationLayoutTypeOffset = 0x30;
inline constexpr std::uintptr_t kNodeViewOptionalDecorationConstructorCallOffset = 0x5c4596;
inline constexpr std::uintptr_t kNodeViewOptionalDecorationChildPushOffset = 0x5c4662;
inline constexpr std::uintptr_t kNodeViewNameHeaderTextViewCtorCallOffset = 0x5c46c9;
inline constexpr std::uintptr_t kNodeViewNameHeaderChildPushOffset = 0x5c4837;
inline constexpr std::uintptr_t kNodeViewNameHeaderParentStoreOffset = 0x5c486d;
inline constexpr std::uintptr_t kNodeViewTypeHeaderTextViewCtorCallOffset = 0x5c48c4;
inline constexpr std::uintptr_t kNodeViewTypeHeaderChildPushOffset = 0x5c4a4f;
inline constexpr std::uintptr_t kNodeViewTypeHeaderParentStoreOffset = 0x5c4a8c;
inline constexpr std::uintptr_t kNodeViewComposerConstructorCallOffset = 0x5c4e0f;
inline constexpr std::uintptr_t kNodeViewComposerChildPushOffset = 0x5c4ecf;
inline constexpr std::uintptr_t kNodeViewComposerParentStoreOffset = 0x5c4f0c;

// TextView's function object starts at +0x530; its heap target pointer is at +0x550.
// Both approved closure objects store the captured 24-byte libc++ string at target +0x08.
inline constexpr std::uintptr_t kTextViewTextFunctionOffset = 0x530;
inline constexpr std::uintptr_t kTextViewTextTargetPointerOffset = 0x550;
inline constexpr std::uintptr_t kTextTargetStringOffset = 0x08;
inline constexpr std::size_t kLibcxxStringObjectBytes = 0x18;
inline constexpr std::uintptr_t kLibcxxStringTagOffset = 0x00;
inline constexpr std::uint8_t kLibcxxLongStringFlagMask = 0x01;
inline constexpr std::uintptr_t kLibcxxLongStringLengthOffset = 0x08;
inline constexpr std::uintptr_t kLibcxxLongStringDataOffset = 0x10;
inline constexpr std::uintptr_t kLibcxxShortStringDataOffset = 0x01;
inline constexpr std::uint8_t kLibcxxShortStringLengthShift = 1;
inline constexpr std::size_t kLibcxxShortStringCapacity = 22;
inline constexpr std::size_t kMaximumSourceBytes = 16384;

// The x86_64 veneer preserves RBP and passes the original return PC; the C dispatcher frame's
// saved RBP is the Skia caller's Lina frame. %rbx is forwarded as the generic closure only.
inline constexpr std::uintptr_t kDispatcherSavedFramePointerOffset = 0x00;
inline constexpr std::uintptr_t kFrameSavedReturnAddressOffset = 0x08;
// elideTextToWidth saves its caller's (TextView::paint) R14 at its own FP-0x10.
inline constexpr std::intptr_t kTextViewElideSavedThisOffset = -0x10;
// Drawable::paint saves its caller's (TextView::paint) R14 at its own FP-0x10.
inline constexpr std::intptr_t kDrawablePaintSavedThisOffset = -0x10;
inline constexpr std::uintptr_t kTextViewElideReturnToPaintOffset = 0x5be889;
inline constexpr std::uintptr_t kDrawablePaintReturnToTextViewPaintOffset = 0x5be8e0;
inline constexpr std::array<std::uintptr_t, 3> kMeasureReturnOffsets = {
    0x5bedfd, 0x5bee4e, 0x5bf07e,
};
inline constexpr std::array<std::uintptr_t, 2> kDrawReturnOffsets = {
    0x4d5e30, 0x4d5e7b,
};
inline constexpr std::uintptr_t kTextViewElideCallOffset = 0x5be884;
inline constexpr std::uintptr_t kTextViewToDrawablePaintCallOffset = 0x5be8db;

// Exact x86_64 byte windows copied from the named functions in the frozen 2.8.1 vendor slice.
inline constexpr std::array<std::uint8_t, 28> kTextViewPaintEntryWindow = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56, 0x41, 0x54, 0x53, 0x48, 0x83, 0xec,
    0x40, 0x48, 0x89, 0xf3, 0x48, 0x8b, 0xb7, 0x50, 0x05, 0x00, 0x00, 0x48, 0x85, 0xf6,
};
inline constexpr std::array<std::uint8_t, 3> kTextViewPaintReceiverStore = {0x49, 0x89, 0xfe};
inline constexpr std::array<std::uint8_t, 5> kTextViewPaintElideCall = {0xe8, 0xa7, 0x04, 0x00, 0x00};
inline constexpr std::array<std::uint8_t, 5> kTextViewPaintDrawableCall = {0xe8, 0xe0, 0x6e, 0xf1, 0xff};
inline constexpr std::array<std::uint8_t, 20> kTextViewElideEntryWindow = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56, 0x41, 0x55,
    0x41, 0x54, 0x53, 0x48, 0x81, 0xec, 0x08, 0x01, 0x00, 0x00,
};
inline constexpr std::array<std::array<std::uint8_t, 5>, 3> kMeasureCallWindows = {{
    {{0xe8, 0xdb, 0x5e, 0x87, 0x00}},
    {{0xe8, 0x8a, 0x5e, 0x87, 0x00}},
    {{0xe8, 0x5a, 0x5c, 0x87, 0x00}},
}};
inline constexpr std::array<std::uint8_t, 26> kDrawablePaintEntryWindow = {
    0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56, 0x41, 0x55, 0x41, 0x54, 0x53,
    0x48, 0x81, 0xec, 0x78, 0x01, 0x00, 0x00, 0x48, 0x89, 0xf3, 0x49, 0x89, 0xfe,
};
inline constexpr std::array<std::array<std::uint8_t, 5>, 2> kDrawCallWindows = {{
    {{0xe8, 0x00, 0xdc, 0x95, 0x00}},
    {{0xe8, 0xb5, 0xdb, 0x95, 0x00}},
}};
inline constexpr std::array<std::uint8_t, 7> kDrawableParentLoadWindow = {
    0x48, 0x8b, 0x9b, 0xd8, 0x02, 0x00, 0x00,
};
inline constexpr std::array<std::uint8_t, 15> kNodeViewVtableStoreWindow = {
    0x48, 0x8d, 0x05, 0x2a, 0xe9, 0xb2, 0x00, 0x48, 0x83, 0xc0, 0x10, 0x49, 0x89, 0x45, 0x00,
};
inline constexpr std::array<std::uint8_t, 28> kNodeViewChildrenVectorWindow = {
    0x49, 0x8b, 0x85, 0x98, 0x02, 0x00, 0x00, 0x48, 0x89, 0x85, 0x20, 0xff, 0xff, 0xff,
    0x49, 0x3b, 0x85, 0xa0, 0x02, 0x00, 0x00, 0x49, 0x8d, 0x8d, 0x90, 0x02, 0x00, 0x00,
};
inline constexpr std::array<std::uint8_t, 5> kOptionalDecorationCtorCall = {0xe8, 0xd5, 0x1f, 0x00, 0x00};
inline constexpr std::array<std::uint8_t, 3> kOptionalDecorationChildPush = {0x4c, 0x89, 0x38};
inline constexpr std::array<std::uint8_t, 5> kNameHeaderTextViewCtorCall = {0xe8, 0xe2, 0x9e, 0xff, 0xff};
inline constexpr std::array<std::uint8_t, 3> kNameHeaderChildPush = {0x4c, 0x89, 0x38};
inline constexpr std::array<std::uint8_t, 7> kNameHeaderParentStore = {0x4c, 0x89, 0xa8, 0xd8, 0x02, 0x00, 0x00};
inline constexpr std::array<std::uint8_t, 5> kTypeHeaderTextViewCtorCall = {0xe8, 0xe7, 0x9c, 0xff, 0xff};
inline constexpr std::array<std::uint8_t, 3> kTypeHeaderChildPush = {0x4c, 0x89, 0x30};
inline constexpr std::array<std::uint8_t, 7> kTypeHeaderParentStore = {0x4c, 0x89, 0xa8, 0xd8, 0x02, 0x00, 0x00};
inline constexpr std::array<std::uint8_t, 5> kComposerCtorCall = {0xe8, 0xec, 0x24, 0x00, 0x00};
inline constexpr std::array<std::uint8_t, 3> kComposerChildPush = {0x4c, 0x89, 0x30};
inline constexpr std::array<std::uint8_t, 7> kComposerParentStore = {0x48, 0x89, 0x98, 0xd8, 0x02, 0x00, 0x00};
inline constexpr std::array<std::uint8_t, 14> kTextViewVtableStoreWindow = {
    0x48, 0x8d, 0x05, 0x6d, 0x3f, 0xb3, 0x00, 0x48, 0x83, 0xc0, 0x10, 0x48, 0x89, 0x03,
};
inline constexpr std::array<std::uint8_t, 17> kConstructorClosureVtableAndCaptureWindow = {
    0x48, 0x8d, 0x05, 0x65, 0x3f, 0xb3, 0x00, 0x49, 0x89, 0x06, 0x4c, 0x89, 0xf7,
    0x48, 0x83, 0xc7, 0x08,
};
inline constexpr std::array<std::uint8_t, 7> kTextViewTargetPointerStore = {
    0x4c, 0x89, 0xb3, 0x50, 0x05, 0x00, 0x00,
};
inline constexpr std::array<std::uint8_t, 7> kNodeNameUpdateUsesTextViewFunction = {
    0x48, 0x81, 0xc3, 0x30, 0x05, 0x00, 0x00,
};

constexpr bool isMeasureReturnOffset(std::uintptr_t offset) noexcept
{
    for (const auto candidate : kMeasureReturnOffsets) if (candidate == offset) return true;
    return false;
}
constexpr bool isDrawReturnOffset(std::uintptr_t offset) noexcept
{
    for (const auto candidate : kDrawReturnOffsets) if (candidate == offset) return true;
    return false;
}

static_assert(kNodeViewChildrenBeginOffset + 8U == kNodeViewChildrenEndOffset);
static_assert(kNodeViewChildrenEndOffset + 8U == kNodeViewChildrenCapacityOffset);
static_assert(kTextViewPaintOffset + 0xE9U == kTextViewElideReturnToPaintOffset);
static_assert(kTextViewElideCallOffset + 5U == kTextViewElideReturnToPaintOffset);
static_assert(kTextViewToDrawablePaintCallOffset + 5U == kDrawablePaintReturnToTextViewPaintOffset);
static_assert(kLibcxxStringObjectBytes == 24U && kLibcxxShortStringCapacity == 22U);
static_assert(kMeasureCallWindows.size() == kMeasureReturnOffsets.size());
static_assert(kDrawCallWindows.size() == kDrawReturnOffsets.size());
} // namespace dependency_node_font::contract
