#if defined(CAVALRY_NATIVE_TARGET_281)
#include "abi_2_8_1/timeline_owner_observer_contract.h"
#else
/**
 * [INPUT]: 依赖已审 Cavalry 2.8 arm64 Timeline call windows 与 caller symbols。
 * [OUTPUT]: 锁定两个 Measure/Draw return PC、closure 字段和调用窗口。
 * [POS]: 只提供 Timeline ABI 常量；路径由主映像推导，不保存构建配置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace timeline_owner_observer::contract {
inline constexpr char kMeasureSymbol[] =
    "__ZNK6SkFont11measureTextEPKvm14SkTextEncodingP6SkRectPK7SkPaint";
inline constexpr char kDrawSymbol[] =
    "__ZN8SkCanvas14drawSimpleTextEPKvm14SkTextEncodingffRK6SkFontRK7SkPaint";
inline constexpr char kPaintNodeTextSymbol[] =
    "__ZN7cavalry16SkTimeEditorView13paintNodeTextEP8SkCanvasd4num2IdES4_RKNS_9RectangleE";
inline constexpr char kTimelineClosureSymbol[] =
    "__ZZN7cavalry16SkTimeEditorView13paintNodeTextEP8SkCanvasd4num2IdES4_RKNS_9RectangleEENK4$_46clEdd";
inline constexpr std::uintptr_t kMeasureSymbolOffset = 0x10bb8c;
inline constexpr std::uintptr_t kDrawSymbolOffset = 0x0ec0f0;
inline constexpr std::uintptr_t kMeasureReturnOffset = 0x5dd6ac;
inline constexpr std::uintptr_t kDrawReturnOffset = 0x5dda48;
inline constexpr std::uintptr_t kMeasureWindowOffset = 0x5dd698;
inline constexpr std::uintptr_t kDrawWindowOffset = 0x5dda34;
inline constexpr std::uintptr_t kPaintNodeTextOffset = 0x5dc6fc;
inline constexpr std::uintptr_t kTimelineClosureOffset = 0x5dd594;
inline constexpr std::uintptr_t kClosureEntryOffset = 0x5dd5d4;
inline constexpr std::uintptr_t kMeasureOwnerLoadOffset = 0x5dd674;
inline constexpr std::uintptr_t kNodeDataCaptureOffset = 0x18;
inline constexpr std::uintptr_t kStringFieldOffset = 0x08;
inline constexpr std::size_t kStringObjectBytes = 0x18;
inline constexpr std::size_t kStringTagOffset = 0x17;
inline constexpr std::size_t kShortStringCapacity = 22;
inline constexpr std::size_t kMeasureWindowBytes = 24;
inline constexpr std::size_t kDrawWindowBytes = 24;
inline constexpr std::array<std::uint8_t, kMeasureWindowBytes> kMeasureWindow = {
    0xe4, 0x23, 0x06, 0x91, 0xe5, 0x63, 0x06, 0x91,
    0xe1, 0x03, 0x14, 0xaa, 0x03, 0x00, 0x80, 0x52,
    0x3d, 0x99, 0x1f, 0x94, 0x68, 0x12, 0x40, 0xf9
};
inline constexpr std::array<std::uint8_t, kDrawWindowBytes> kDrawWindow = {
    0x01, 0xe4, 0x00, 0x2f, 0xe4, 0xc3, 0x05, 0x91,
    0xe5, 0x63, 0x06, 0x91, 0x03, 0x00, 0x80, 0x52,
    0x02, 0x8f, 0x1f, 0x94, 0xe0, 0xbb, 0x40, 0xf9
};
inline constexpr std::array<std::uint8_t, 4> kClosureEntry = {0xf3, 0x03, 0x00, 0xaa};
inline constexpr std::array<std::uint8_t, 4> kMeasureOwnerLoad = {0x68, 0x0e, 0x40, 0xf9};
}  // namespace timeline_owner_observer::contract

#endif  // CAVALRY_NATIVE_TARGET_281
