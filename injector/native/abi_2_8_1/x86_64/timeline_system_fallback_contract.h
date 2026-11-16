/**
 * [INPUT]: 依赖官方 Cavalry 2.8.1 x86_64 SkFont::setSize导出。
 * [OUTPUT]: 锁定共享字体槽数、factory seed和Intel原生setSize窗口。
 * [POS]: 仅供隔离x86_64 2.8.1 composer覆盖使用。
 * [PROTOCOL]: ABI变化时更新profile快照。
 */
#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
namespace timeline_system_fallback::contract {
inline constexpr std::size_t kMaxFontSlots = 8;
inline constexpr std::size_t kMaxPostScriptNameBytes = 256;
inline constexpr float kFactorySeedSize = 12.0F;
inline constexpr char kSetSizeSymbol[] = "__ZN6SkFont7setSizeEf";
inline constexpr std::uintptr_t kSetSizeOffset = 0x121560;
inline constexpr std::array<std::uint8_t,18> kSetSizeBytes = {
    0x55,0x48,0x89,0xe5,0x0f,0x57,0xc9,0xf3,0x0f,0x5f,0xc1,0xf3,0x0f,0x11,0x47,0x08,0x5d,0xc3};
}
