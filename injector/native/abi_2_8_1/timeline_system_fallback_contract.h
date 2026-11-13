/**
 * [INPUT]: 依赖已验 Cavalry 2.8.1 SkFont::setSize arm64 导出窗口与原字体槽合同。
 * [OUTPUT]: 锁定8个字体槽、factory seed、PostScript 上限与 setSize ABI。
 * [POS]: 共享字体核心的资源边界；决定缓存保持关闭。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
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
inline constexpr std::uintptr_t kSetSizeOffset = 0x1091e4;
inline constexpr std::array<std::uint8_t, 16> kSetSizeBytes = {
    0x01, 0xe4, 0x00, 0x6f, 0x00, 0x68, 0x21, 0x1e,
    0x00, 0x08, 0x00, 0xbd, 0xc0, 0x03, 0x5f, 0xd6
};
}  // namespace timeline_system_fallback::contract
