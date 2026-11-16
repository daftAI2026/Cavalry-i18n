/**
 * [INPUT]: 依赖官方 Cavalry 2.8.1 Core/Extension/Skia x86_64 切片与专用caller合同。
 * [OUTPUT]: 为共享GetPath策略提供经x86合同导出的真实映像身份和owner返回点。
 * [POS]: x86_64共享头；具体机器码窗由同profile下的getpath_*_x86_64合同锁定。
 * [PROTOCOL]: ABI变化时更新profile快照。
 */
#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include "getpath_graph_empty_x86_64_abi_contract.h"
#include "getpath_fps_x86_64_abi_contract.h"
#include "getpath_cache_x86_64_abi_contract.h"
namespace native_getpath_abi::contract {
inline constexpr char kCoreUuid[] = "23B9AC22-F909-3455-BD02-4E90796E35B5";
inline constexpr char kExtensionUuid[] = "AEAD00DA-F97D-3DD0-9602-D5668F1341A2";
inline constexpr char kSkiaUuid[] = "86ACD2F2-91F5-308C-BBAE-23183E8D218D";
inline constexpr char kGetPathSymbol[] = "__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath";
inline constexpr std::uintptr_t kGetPathOffset = 0x1b650;
inline constexpr std::array<std::uint8_t,32> kGetPathBytes = {
    0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,0x41,0x54,0x53,0x48,0x81,0xec,0x30,0x01,
    0x00,0x00,0x4c,0x89,0xc3,0x49,0x89,0xcf,0x0f,0x29,0x8d,0xd0,0xfe,0xff,0xff,0x0f};
inline constexpr char kMakePathFromTextSymbol[] = "__ZN7cavalry16MakePathFromTextERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEd";
inline constexpr std::uintptr_t kCoreOwnerReturnOffset = native_getpath_graph_x86_64::contract::kCoreGetPathReturnOffset;
inline constexpr std::uintptr_t kCacheOwnerReturnOffset = native_getpath_cache_x86_64::contract::kCachedGetPathReturnOffset;
inline constexpr std::uintptr_t kToolHelpProducerReturnA = native_getpath_cache_x86_64::contract::kToolHelpProducerReturnAOffset;
inline constexpr std::uintptr_t kToolHelpProducerReturnB = native_getpath_cache_x86_64::contract::kToolHelpProducerReturnBOffset;
inline constexpr std::uintptr_t kViewportStatusProducerReturn = native_getpath_cache_x86_64::contract::kViewportQualityProducerReturnOffset;
inline constexpr std::uintptr_t kViewportFpsProducerReturn = native_getpath_fps_x86_64::contract::kMakePathFromTextReturnOffset;
inline constexpr std::uintptr_t kGraphEditorEmptyStateProducerReturn = native_getpath_graph_x86_64::contract::kExtensionGraphProducerReturnOffset;
inline constexpr std::uintptr_t kNodeDataCaptureOffset = 0x18;
inline constexpr std::uintptr_t kStringFieldOffset = 0x08;
inline constexpr std::size_t kStringObjectBytes = 0x18;
inline constexpr std::size_t kStringTagOffset = 0x00;
inline constexpr std::size_t kShortStringCapacity = 22;
}
