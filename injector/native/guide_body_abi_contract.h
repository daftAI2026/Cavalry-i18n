#if defined(CAVALRY_NATIVE_TARGET_281)
#include "abi_2_8_1/guide_body_abi_contract.h"
#else
/**
 * [INPUT]: 依赖Cavalry 2.8 arm64 Guide caller与Qt 6.9.2 QTextEdit导出。
 * [OUTPUT]: 锁定唯一source caller、尾跳callee、映像UUID与setter符号。
 * [POS]: Guide正文适配的构造期ABI门；不声明跨版本兼容。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace native_guide_body::contract {
inline constexpr char kExtensionUuid[] =
    "448DD50E-75F4-3F2D-A46B-2C9F00DF9408";
inline constexpr char kQtWidgetsUuid[] =
    "01652E29-047E-3528-9DC2-1BD084292E50";
inline constexpr char kQtVersion[] = "6.9.2";
inline constexpr char kSetTextSymbol[] = "__ZN9QTextEdit7setTextERK7QString";

inline constexpr std::uintptr_t kCallerOffset = 0x004b9e44;
inline constexpr std::uintptr_t kReturnOffset = 0x004b9e48;
inline constexpr std::uintptr_t kBodyOverrideOffset = 0x004bcb30;
inline constexpr std::uintptr_t kSetTextImportStubOffset = 0x00dc1f70;
inline constexpr std::uintptr_t kSetTextOffset = 0x00214464;

inline constexpr std::array<std::uint8_t, 4> kCallerBranchBytes = {
    0x3b, 0x0b, 0x00, 0x94,
};
inline constexpr std::array<std::uint8_t, 8> kBodyOverrideBytes = {
    0x00, 0x58, 0x40, 0xf9, 0x0f, 0x15, 0x24, 0x14,
};
inline constexpr std::array<std::uint8_t, 4> kBodyOverrideBranchBytes = {
    kBodyOverrideBytes[4], kBodyOverrideBytes[5],
    kBodyOverrideBytes[6], kBodyOverrideBytes[7],
};
inline constexpr char kSourceText[] = "Keep going...";

constexpr std::uint32_t arm64Instruction(
    const std::array<std::uint8_t, 4> &bytes) noexcept
{
    return static_cast<std::uint32_t>(bytes[0]) |
        (static_cast<std::uint32_t>(bytes[1]) << 8U) |
        (static_cast<std::uint32_t>(bytes[2]) << 16U) |
        (static_cast<std::uint32_t>(bytes[3]) << 24U);
}

constexpr std::int64_t arm64BranchDisplacement(
    const std::array<std::uint8_t, 4> &bytes) noexcept
{
    const std::uint32_t instruction = arm64Instruction(bytes);
    std::int64_t immediate = instruction & 0x03ffffffU;
    if ((immediate & 0x02000000LL) != 0) immediate -= 0x04000000LL;
    return immediate * 4;
}

static_assert(kReturnOffset == kCallerOffset + kCallerBranchBytes.size());
static_assert((arm64Instruction(kCallerBranchBytes) & 0xfc000000U) == 0x94000000U);
static_assert((arm64Instruction(kBodyOverrideBranchBytes) & 0xfc000000U) ==
              0x14000000U);
static_assert(static_cast<std::int64_t>(kCallerOffset) +
              arm64BranchDisplacement(kCallerBranchBytes) ==
              static_cast<std::int64_t>(kBodyOverrideOffset));
static_assert(static_cast<std::int64_t>(kBodyOverrideOffset + 4U) +
              arm64BranchDisplacement(kBodyOverrideBranchBytes) ==
              static_cast<std::int64_t>(kSetTextImportStubOffset));
}  // namespace native_guide_body::contract

#endif  // CAVALRY_NATIVE_TARGET_281
