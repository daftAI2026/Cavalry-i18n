/**
 * [INPUT]: 依赖已审 Cavalry 2.8.1 arm64 Timeline call windows 与 caller symbols。
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
inline constexpr char kTextBlobSymbol[] =
    "__ZN10SkTextBlob12MakeFromTextEPKvmRK6SkFont14SkTextEncoding";
inline constexpr char kPaintNodeTextSymbol[] =
    "__ZN7cavalry16SkTimeEditorView13paintNodeTextEP8SkCanvasd4num2IdES4_RKNS_9RectangleE";
inline constexpr char kTimelineClosureSymbol[] =
    "__ZZN7cavalry16SkTimeEditorView13paintNodeTextEP8SkCanvasd4num2IdES4_RKNS_9RectangleEENK3$_0clEdd";
inline constexpr std::uintptr_t kMeasureSymbolOffset = 0x109314;
inline constexpr std::uintptr_t kDrawSymbolOffset = 0x0e9af4;
inline constexpr std::uintptr_t kTextBlobSymbolOffset = 0x1b2174;
inline constexpr std::uintptr_t kMeasureReturnOffset = 0x5c20d4;
inline constexpr std::uintptr_t kDrawReturnOffset = 0x5c2478;
inline constexpr std::uintptr_t kMeasureWindowOffset = 0x5c20c0;
inline constexpr std::uintptr_t kDrawWindowOffset = 0x5c2460;
inline constexpr std::uintptr_t kPaintNodeTextOffset = 0x5c1048;
inline constexpr std::uintptr_t kTimelineClosureOffset = 0x5c1fbc;
inline constexpr std::uintptr_t kClosureEntryOffset = 0x5c1ffc;
inline constexpr std::uintptr_t kMeasureOwnerLoadOffset = 0x5c209c;
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
    0x7c, 0x90, 0x1d, 0x94, 0x68, 0x12, 0x40, 0xf9
};
inline constexpr std::array<std::uint8_t, kDrawWindowBytes> kDrawWindow = {
    0x00, 0x01, 0x22, 0x1e, 0x01, 0xe4, 0x00, 0x6f,
    0xe4, 0xc3, 0x05, 0x91, 0xe5, 0x63, 0x06, 0x91,
    0x03, 0x00, 0x80, 0x52, 0x3f, 0x86, 0x1d, 0x94
};
inline constexpr std::array<std::uint8_t, 4> kClosureEntry = {0xf3, 0x03, 0x00, 0xaa};
inline constexpr std::array<std::uint8_t, 4> kMeasureOwnerLoad = {0x68, 0x0e, 0x40, 0xf9};
}  // namespace timeline_owner_observer::contract
