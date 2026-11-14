#if defined(CAVALRY_NATIVE_TARGET_281)
#include "abi_2_8_1/fast_search_unicode_abi_contract.h"
#else
/**
 * [INPUT]: 依赖固定Cavalry 2.8 arm64 Fast调用和Qt 6.9.2 C1符号审查。
 * [OUTPUT]: 锁定Extension调用点、import stub、原正则与QtCore构造入口。
 * [POS]: Fast正则选项适配的窄ABI合同；不扩展到Classic或其它caller。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_fast_search::abi {
inline constexpr char kExtensionUuid[] = "448DD50E-75F4-3F2D-A46B-2C9F00DF9408";
inline constexpr char kQtVersion[] = "6.9.2";
inline constexpr char kConstructorSymbol[] =
    "__ZN18QRegularExpressionC1ERK7QString6QFlagsINS_13PatternOptionEE";
inline constexpr char kPattern[] = "[\\s\\-_\\W]";

inline constexpr std::uintptr_t kOptionsOffset = 0x730f18;
inline constexpr std::uintptr_t kCallOffset = 0x730f1c;
inline constexpr std::uintptr_t kReturnOffset = 0x730f20;
inline constexpr std::uintptr_t kImportStubOffset = 0xdbcef4;
inline constexpr std::uintptr_t kConstructorOffset = 0x2664c8;
inline constexpr int kNoPatternOption = 0x0000;
inline constexpr int kUnicodePropertiesOption = 0x0040;

inline constexpr std::array<std::uint8_t, 4> kOptionsBytes = {
    0x02, 0x00, 0x80, 0xd2
};
inline constexpr std::array<std::uint8_t, 4> kCallBytes = {
    0xf6, 0x2f, 0x1a, 0x94
};
}  // namespace native_fast_search::abi

#endif  // CAVALRY_NATIVE_TARGET_281
