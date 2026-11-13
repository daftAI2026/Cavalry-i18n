/**
 * [INPUT]: 依赖独审的 Cavalry 2.8.1 arm64 activeLocale 与 Extension GOT 证据。
 * [OUTPUT]: 锁定 getter 入口、调用者、stub、GOT 偏移与机器码。
 * [POS]: 只定义 native getter ABI；不包含运行路径、开关或诊断配置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstdint>

namespace native_locale_interpose::contract {
inline constexpr char kApiUuid[] = "7299A0A0-093E-3E7D-8CDD-226BE63049E0";
inline constexpr char kActiveLocaleSymbol[] = "__ZN7cavalry12activeLocaleEP3Api";
inline constexpr std::uintptr_t kActiveLocaleEntryOffset = 0x20ecc;
inline constexpr std::array<std::uint8_t, 20> kActiveLocaleEntryBytes = {
    0xff, 0x03, 0x01, 0xd1, 0xf4, 0x4f, 0x02, 0xa9,
    0xfd, 0x7b, 0x03, 0xa9, 0xfd, 0xc3, 0x00, 0x91,
    0xf3, 0x03, 0x08, 0xaa
};
inline constexpr std::uintptr_t kActiveLocaleCallOffset = 0xc0c794;
inline constexpr std::array<std::uint8_t, 12> kActiveLocaleCallBytes = {
    0xa8, 0x43, 0x02, 0xd1, 0xe0, 0x03, 0x1c, 0xaa,
    0x21, 0x57, 0x04, 0x94
};
inline constexpr std::uintptr_t kActiveLocaleReturnOffset = 0xc0c7a0;
inline constexpr char kRegisterNodesSetupSymbol[] = "__Z18registerNodesSetupP3Api";
inline constexpr std::uintptr_t kRegisterNodesSetupOffset = 0xc0bf74;
inline constexpr std::uintptr_t kActiveLocaleStubOffset = 0xd22420;
inline constexpr std::array<std::uint8_t, 12> kActiveLocaleStubBytes = {
    0x10, 0x18, 0x00, 0xf0, 0x10, 0x66, 0x43, 0xf9,
    0x00, 0x02, 0x1f, 0xd6
};
inline constexpr std::uintptr_t kActiveLocaleGotOffset = 0x10256c8;

inline bool extensionGotTargetsInterposer(
    const void *loadedTarget, const void *interposer) noexcept
{
    return loadedTarget != nullptr && loadedTarget == interposer;
}
}  // namespace native_locale_interpose::contract
