/**
 * [INPUT]: 依赖官方 Cavalry 2.8.1 arm64 ExtensionLayer 的 NodeView、Lina TextView 与 Skia 调用窗。
 * [OUTPUT]: 锁定Name/Type相对0/1、可选装饰前项、完整源闭包与Skia返回点。
 * [POS]: Dependency Graph 节点文字的窄 ABI 合同；不授权 GraphEditor 空态或其它 Lina 文字。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace dependency_node_font::contract {
inline constexpr char kExtensionUuid[] = "AF1367BD-2D7E-3EC0-A111-935E4881C655";
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
inline constexpr char kInOutViewConstructorSymbol[] =
    "__ZN7cavalry9InOutViewC2EP3ApiP9AttributeddRKNS_11PaletteDataENSt3__18functionIFvRKNS8_12basic_stringIcNS8_11char_traitsIcEENS8_9allocatorIcEEEESH_EEENS9_IFvRK13AttributePathEEE";
inline constexpr char kNodeNameUpdatedLambdaSymbol[] =
    "__ZZN7cavalry8NodeView18setNodeNameUpdatedEPK7QObjectENKUlRKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEE_clESC_";
inline constexpr char kTextViewSetTextTargetCallSymbol[] =
    "__ZNSt3__18functionIFNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEvEEaSIZN4lina8TextView7setTextERKS6_EUlvE_vEERS8_OT_";
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

// Mach-O link addresses are also the image-relative offsets consumed by imageAddress().
inline constexpr std::uintptr_t kNodeViewConstructorOffset = 0x558da0;
inline constexpr std::uintptr_t kNodeViewVtableOffset = 0x0fecfb8;
inline constexpr std::uintptr_t kNodeViewVtableAddressPointOffset = kNodeViewVtableOffset + 0x10;
inline constexpr std::uintptr_t kHeaderDecorationVtableOffset = 0xfed000;
inline constexpr std::uintptr_t kHeaderDecorationAddressPointOffset =
    kHeaderDecorationVtableOffset + 0x10;
inline constexpr std::uintptr_t kTextViewConstructorOffset = 0x553908;
inline constexpr std::uintptr_t kTextViewVtableOffset = 0x0fec9d0;
inline constexpr std::uintptr_t kTextViewVtableAddressPointOffset = kTextViewVtableOffset + 0x10;
inline constexpr std::uintptr_t kTextViewConstructorTargetVtableOffset = 0x0feca18;
inline constexpr std::uintptr_t kTextViewConstructorTargetAddressPointOffset =
    kTextViewConstructorTargetVtableOffset + 0x10;
inline constexpr std::uintptr_t kTextViewSetTextTargetVtableOffset = 0x0fed4a0;
inline constexpr std::uintptr_t kTextViewSetTextTargetAddressPointOffset =
    kTextViewSetTextTargetVtableOffset + 0x10;
inline constexpr std::uintptr_t kTextViewConstructorTargetInvokeOffset = 0x553d80;
inline constexpr std::uintptr_t kTextViewSetTextTargetInvokeOffset = 0x560fe8;

inline constexpr std::uintptr_t kDrawableParentGetterOffset = 0x4f894;
inline constexpr std::uintptr_t kTextViewPaintFrameSetupOffset = 0x553aa0;
inline constexpr std::uintptr_t kTextViewElideFrameSetupOffset = 0x553fd0;
inline constexpr std::uintptr_t kDrawablePaintFrameSetupOffset = 0x4778c8;
inline constexpr std::uintptr_t kNodeViewNameHeaderTextViewCtorCallOffset = 0x559198;
inline constexpr std::uintptr_t kNodeViewNameHeaderChildPushOffset = 0x5592b0;
inline constexpr std::uintptr_t kNodeViewNameHeaderParentStoreOffset = 0x5592d8;
inline constexpr std::uintptr_t kNodeViewTypeHeaderTextViewCtorCallOffset = 0x559318;
inline constexpr std::uintptr_t kNodeViewTypeHeaderChildPushOffset = 0x559434;
inline constexpr std::uintptr_t kNodeViewTypeHeaderParentStoreOffset = 0x55945c;
inline constexpr std::uintptr_t kNodeViewFirstDrawableChildPushOffset = 0x559150;
inline constexpr std::uintptr_t kNodeViewNestedTextViewCtorCallOffset = 0x559678;
inline constexpr std::uintptr_t kNodeViewInOutViewMakeCallOffset = 0x559700;
inline constexpr std::uintptr_t kNodeViewComposerCtorCallOffset = 0x55971c;
inline constexpr std::uintptr_t kNodeViewComposerChildPushOffset = 0x559780;
inline constexpr std::uintptr_t kNodeViewComposerParentStoreOffset = 0x5597a8;
inline constexpr std::uintptr_t kViewComposerTextChildParentStoreOffset = 0x55b6c4;

inline constexpr std::uintptr_t kNodeViewChildrenVectorOffset = 0x260;
inline constexpr std::uintptr_t kNodeViewChildrenBeginOffset = 0x260;
inline constexpr std::uintptr_t kNodeViewChildrenEndOffset = 0x268;
inline constexpr std::uintptr_t kNodeViewChildrenCapacityOffset = 0x270;
// Header-relative positions. NodeView conditionally prepends a ComplexRoundRectView.
inline constexpr std::size_t kNodeViewNameHeaderChildIndex = 0;
inline constexpr std::size_t kNodeViewTypeHeaderChildIndex = 1;
inline constexpr std::uintptr_t kDrawableParentPointerOffset = 0x2a8;

// The std::function object begins at TextView+0x480; its heap target pointer is at +0x498.
inline constexpr std::uintptr_t kTextViewTextFunctionOffset = 0x480;
inline constexpr std::uintptr_t kTextViewTextTargetPointerOffset = 0x498;
inline constexpr std::uintptr_t kTextTargetStringOffset = 0x08;
inline constexpr std::size_t kLibcxxStringObjectBytes = 0x18;
inline constexpr std::size_t kLibcxxStringTagOffset = 0x17;
inline constexpr std::size_t kLibcxxShortStringCapacity = 22;

// The original caller LR is the Skia callsite; the dispatcher frame's saved FP points to it.
inline constexpr std::uintptr_t kDispatcherSavedFramePointerOffset = 0x00;
inline constexpr std::uintptr_t kFrameSavedReturnAddressOffset = 0x08;
inline constexpr std::intptr_t kTextViewElideSavedThisOffset = -0x10;
inline constexpr std::intptr_t kDrawablePaintSavedThisOffset = -0x10;
inline constexpr std::uintptr_t kTextViewElideReturnToPaintOffset = 0x553b6c;
inline constexpr std::uintptr_t kDrawablePaintReturnToTextViewPaintOffset = 0x553bd0;

inline constexpr std::array<std::uintptr_t, 3> kMeasureReturnOffsets = {
    0x554058, 0x5540a0, 0x554248,
};
inline constexpr std::array<std::uintptr_t, 2> kDrawReturnOffsets = {
    0x477e18, 0x477e58,
};
inline constexpr std::uintptr_t kTextViewElideCallOffset = 0x553b68;
inline constexpr std::uintptr_t kTextViewToDrawablePaintCallOffset = 0x553bcc;

// Exact 2.8.1 ARM64 instruction windows, copied from the named vendor functions.
inline constexpr std::array<std::uint8_t, 16> kNodeViewVtableStoreWindow = {
    0xa8, 0x54, 0x00, 0x90, 0x08, 0xe1, 0x3e, 0x91,
    0x08, 0x41, 0x00, 0x91, 0x08, 0x00, 0x00, 0xf9,
};
inline constexpr std::array<std::uint8_t, 20> kTextViewVtableStoreWindow = {
    0xc8, 0x54, 0x00, 0xb0, 0x08, 0x41, 0x27, 0x91,
    0x1f, 0x70, 0x11, 0x39, 0x08, 0x41, 0x00, 0x91,
    0x08, 0x00, 0x00, 0xf9,
};
inline constexpr std::array<std::uint8_t, 16> kConstructorTargetVtableStoreWindow = {
    0xc9, 0x54, 0x00, 0xb0, 0x29, 0xa1, 0x28, 0x91,
    0xe8, 0x03, 0x00, 0xaa, 0x09, 0x85, 0x00, 0xf8,
};
inline constexpr std::array<std::uint8_t, 16> kConstructorTargetStringCaptureWindow = {
    0xe0, 0x03, 0xc0, 0x3d, 0x00, 0x01, 0x80, 0x3d,
    0xe9, 0x0b, 0x40, 0xf9, 0x09, 0x09, 0x00, 0xf9,
};
inline constexpr std::array<std::uint8_t, 4> kConstructorTargetPointerStore = {
    0x60, 0x4e, 0x02, 0xf9,
};
inline constexpr std::array<std::uint8_t, 12> kSetTextTargetVtableStoreWindow = {
    0x68, 0x54, 0x00, 0xb0, 0x08, 0xc1, 0x12, 0x91,
    0x08, 0x84, 0x00, 0xf8,
};
inline constexpr std::array<std::uint8_t, 16> kSetTextTargetStringCaptureWindow = {
    0xe0, 0x03, 0xc0, 0x3d, 0x00, 0x00, 0x80, 0x3d,
    0xe8, 0x0b, 0x40, 0xf9, 0x08, 0x08, 0x00, 0xf9,
};
inline constexpr std::array<std::uint8_t, 24> kTextViewPaintFrameAndTargetWindow = {
    0xf4, 0x4f, 0x06, 0xa9, 0xfd, 0x7b, 0x07, 0xa9,
    0xfd, 0xc3, 0x01, 0x91, 0xf4, 0x03, 0x00, 0xaa,
    0x00, 0x4c, 0x42, 0xf9, 0xa0, 0x09, 0x00, 0xb4,
};
inline constexpr std::array<std::uint8_t, 20> kTextViewTargetInvocationWindow = {
    0xf3, 0x03, 0x01, 0xaa, 0x08, 0x00, 0x40, 0xf9,
    0x09, 0x19, 0x40, 0xf9, 0xe8, 0x83, 0x00, 0x91,
    0x20, 0x01, 0x3f, 0xd6,
};
inline constexpr std::array<std::uint8_t, 12> kTextViewElideCallWindow = {
    0xe0, 0x03, 0x14, 0xaa, 0xe1, 0x03, 0x15, 0xaa,
    0x13, 0x01, 0x00, 0x94,
};
inline constexpr std::array<std::uint8_t, 12> kTextViewDrawablePaintCallWindow = {
    0xe0, 0x03, 0x14, 0xaa, 0xe1, 0x03, 0x13, 0xaa,
    0x3a, 0x8f, 0xfc, 0x97,
};
inline constexpr std::array<std::uint8_t, 12> kElideFrameWindow = {
    0xf4, 0x4f, 0x13, 0xa9, 0xfd, 0x7b, 0x14, 0xa9,
    0xfd, 0x03, 0x05, 0x91,
};
inline constexpr std::array<std::array<std::uint8_t, 4>, 3> kMeasureCallWindows = {{
    {{0x9b, 0x48, 0x1f, 0x94}},
    {{0x89, 0x48, 0x1f, 0x94}},
    {{0x1f, 0x48, 0x1f, 0x94}},
}};
inline constexpr std::array<std::uint8_t, 20> kDrawablePaintFrameWindow = {
    0xf4, 0x4f, 0x1b, 0xa9, 0xfd, 0x7b, 0x1c, 0xa9,
    0xfd, 0x03, 0x07, 0x91, 0xf3, 0x03, 0x01, 0xaa,
    0xf4, 0x03, 0x00, 0xaa,
};
inline constexpr std::array<std::uint8_t, 4> kDrawCallWindow = {
    0xd7, 0xaf, 0x22, 0x94,
};
inline constexpr std::array<std::uint8_t, 4> kStrokeDrawCallWindow = {
    0xc7, 0xaf, 0x22, 0x94,
};
inline constexpr std::array<std::uint8_t, 16> kTextViewConstructorCallWindows = {
    0xdc, 0xe9, 0xff, 0x97, 0x7c, 0xe9, 0xff, 0x97,
    0xa4, 0xe8, 0xff, 0x97, 0x56, 0x04, 0x00, 0x94,
};
inline constexpr std::array<std::uint8_t, 8> kChildPushWindows = {
    0x00, 0x85, 0x00, 0xf8, 0x19, 0x85, 0x00, 0xf8,
};
inline constexpr std::array<std::uint8_t, 4> kChildParentStore = {
    0x13, 0x55, 0x01, 0xf9,
};
inline constexpr std::array<std::uint8_t, 4> kParentGetterLoad = {
    0x94, 0x56, 0x41, 0xf9,
};
inline constexpr std::array<std::uint8_t, 4> kTextViewTypeHeaderChildPush = {
    0x19, 0x85, 0x00, 0xf8,
};
inline constexpr std::array<std::uint8_t, 4> kNodeViewComposerChildPush = {
    0x14, 0x85, 0x00, 0xf8,
};
inline constexpr std::array<std::uint8_t, 4> kViewComposerParentStore = {
    0x33, 0x55, 0x01, 0xf9,
};

constexpr bool isMeasureReturnOffset(std::uintptr_t offset) noexcept
{
    for (const auto candidate : kMeasureReturnOffsets) {
        if (candidate == offset) return true;
    }
    return false;
}

constexpr bool isDrawReturnOffset(std::uintptr_t offset) noexcept
{
    for (const auto candidate : kDrawReturnOffsets) {
        if (candidate == offset) return true;
    }
    return false;
}
}  // namespace dependency_node_font::contract
