/**
 * [INPUT]: 依赖profile内官方2.8.1 x86_64 Timeline合同。
 * [OUTPUT]: 为共享字体核心提供正确的x86返回点和owner字段布局。
 * [POS]: 仅供隔离x86_64 2.8.1 composer覆盖；不引入arm64常量。
 * [PROTOCOL]: ABI变化时更新profile快照。
 */
#pragma once
#include "timeline_owner_observer_x86_64_contract.h"
namespace timeline_owner_observer::contract {
inline constexpr auto kMeasureSymbol = x86_64_contract::kMeasureSymbol;
inline constexpr auto kDrawSymbol = x86_64_contract::kDrawSymbol;
inline constexpr auto kPaintNodeTextSymbol = x86_64_contract::kPaintNodeTextSymbol;
inline constexpr auto kTimelineClosureSymbol = x86_64_contract::kTimelineClosureSymbol;
inline constexpr auto kMeasureSymbolOffset = x86_64_contract::kMeasureSymbolOffset;
inline constexpr auto kDrawSymbolOffset = x86_64_contract::kDrawSymbolOffset;
inline constexpr auto kMeasureReturnOffset = x86_64_contract::kMeasureReturnOffset;
inline constexpr auto kDrawReturnOffset = x86_64_contract::kDrawReturnOffset;
inline constexpr auto kPaintNodeTextOffset = x86_64_contract::kPaintNodeTextOffset;
inline constexpr auto kTimelineClosureOffset = x86_64_contract::kClosureEntryOffset;
inline constexpr auto kClosureEntryOffset = x86_64_contract::kClosureEntryOffset;
inline constexpr auto kNodeDataCaptureOffset = x86_64_contract::kCapturePointerOffset;
inline constexpr std::uintptr_t kStringFieldOffset = 0x08;
inline constexpr std::size_t kStringObjectBytes = 0x18;
inline constexpr std::size_t kStringTagOffset = 0x00;
inline constexpr std::size_t kShortStringCapacity = 22;
}
