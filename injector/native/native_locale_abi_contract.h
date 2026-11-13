#if defined(CAVALRY_NATIVE_TARGET_281)
#include "abi_2_8_1/native_locale_abi_contract.h"
#else
/**
 * [INPUT]: 依赖独审的 Cavalry 2.8 arm64 activeLocale 与 Extension GOT 证据。
 * [OUTPUT]: 锁定 getter 入口、调用者、stub、GOT 偏移与机器码。
 * [POS]: 只定义 native getter ABI；不包含运行路径、开关或诊断配置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstdint>

namespace native_locale_interpose::contract {
inline constexpr char kApiUuid[] = "475E0957-00C1-325C-BC45-58D35DD5EB86";
inline constexpr char kActiveLocaleSymbol[] = "__ZN7cavalry12activeLocaleEP3Api";
inline constexpr std::uintptr_t kActiveLocaleEntryOffset = 0x2086c;
inline constexpr std::array<std::uint8_t, 20> kActiveLocaleEntryBytes = {
    0xff, 0x03, 0x01, 0xd1, 0xf4, 0x4f, 0x02, 0xa9,
    0xfd, 0x7b, 0x03, 0xa9, 0xfd, 0xc3, 0x00, 0x91,
    0xf3, 0x03, 0x08, 0xaa
};
inline constexpr std::uintptr_t kActiveLocaleCallOffset = 0xc725e0;
inline constexpr std::array<std::uint8_t, 12> kActiveLocaleCallBytes = {
    0xa8, 0x43, 0x02, 0xd1, 0xe0, 0x03, 0x18, 0xaa,
    0xd7, 0x35, 0x05, 0x94
};
inline constexpr std::uintptr_t kActiveLocaleReturnOffset = 0xc725ec;
inline constexpr std::uintptr_t kActiveLocaleStubOffset = 0xdbfd44;
inline constexpr std::array<std::uint8_t, 12> kActiveLocaleStubBytes = {
    0xb0, 0x14, 0x00, 0xb0, 0x10, 0xfa, 0x46, 0xf9,
    0x00, 0x02, 0x1f, 0xd6
};
inline constexpr std::uintptr_t kActiveLocaleGotOffset = 0x1054df0;

inline bool extensionGotTargetsInterposer(
    const void *loadedTarget, const void *interposer) noexcept
{
    return loadedTarget != nullptr && loadedTarget == interposer;
}
}  // namespace native_locale_interpose::contract

#endif  // CAVALRY_NATIVE_TARGET_281
