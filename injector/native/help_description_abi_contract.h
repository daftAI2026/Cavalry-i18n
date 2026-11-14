#if defined(CAVALRY_NATIVE_TARGET_281)
#include "abi_2_8_1/help_description_abi_contract.h"
#else
/**
 * [INPUT]: 依赖 Cavalry 2.8 arm64 Extension/UI 导入与 callee 的静态二进制证据。
 * [OUTPUT]: 锁定main/def两caller、同一导入callee与文档对象布局。
 * [POS]: 仅证明当前SHA的arm64 ABI；后三成员语义未知，不声明跨版本合同。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace native_help_description::contract {
inline constexpr char kExtensionSha256[] =
    "55c165bfa3f780f73e35a0b4e7cbd30929fe54de46c41424c74a239e2f9f4d15";
inline constexpr char kExtensionUuid[] = "448DD50E-75F4-3F2D-A46B-2C9F00DF9408";
inline constexpr char kCavalryUiSha256[] =
    "185a297e776ab050a0842aa10a6f2e8f52c092577f5aa6b903d3e11762782947";
inline constexpr char kCavalryUiUuid[] = "D579B833-98FF-3E13-B79E-624C9D9AA776";

inline constexpr char kEntrySymbol[] =
    "__ZN8TextEdit27addScriptDocumentationEntryERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEERKN7cavalry19ScriptDocumentationE";
inline constexpr char kDefCallerSymbol[] =
    "__ZN9acrJSMath18formatForCompleterERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE";
inline constexpr std::uintptr_t kExtensionCallerOffset = 0x00b2b3ac;
inline constexpr std::uintptr_t kExtensionReturnOffset = 0x00b2b3b0;
inline constexpr std::uintptr_t kDefCallerConditionOffset = 0x006cc1a8;
inline constexpr std::uintptr_t kDefCallerOffset = 0x006cc24c;
inline constexpr std::uintptr_t kDefReturnOffset = 0x006cc250;
inline constexpr std::uintptr_t kExtensionStubOffset = 0x00dc1874;
inline constexpr std::uintptr_t kExtensionImportSlotOffset = 0x01056170;
inline constexpr std::uintptr_t kCavalryUiEntryOffset = 0x0009253c;
inline constexpr std::uint32_t kImportIndex = 0x0c2e;
inline constexpr std::uint32_t kIndirectSymbolIndex = 88275;
inline constexpr bool kRequiresTwoLevelNamespace = true;

inline constexpr std::array<std::uint8_t, 4> kCallerBranchBytes = {
    0x32, 0x59, 0x0a, 0x94,
};
inline constexpr std::array<std::uint8_t, 4> kDefCallerConditionBytes = {
    0x48, 0x11, 0x00, 0xb4,
};
inline constexpr std::array<std::uint8_t, 4> kDefCallerBranchBytes = {
    0x8a, 0xd5, 0x1b, 0x94,
};
inline constexpr std::array<std::uint8_t, 12> kImportStubBytes = {
    0xb0, 0x14, 0x00, 0xb0, 0x10, 0xba, 0x40, 0xf9,
    0x00, 0x02, 0x1f, 0xd6,
};
inline constexpr std::array<std::uint8_t, 16> kCalleeEntryBytes = {
    0xff, 0x03, 0x01, 0xd1, 0xf6, 0x57, 0x01, 0xa9,
    0xf4, 0x4f, 0x02, 0xa9, 0xfd, 0x7b, 0x03, 0xa9,
};
static_assert(kExtensionReturnOffset != kDefReturnOffset,
    "main and def callers must remain separate dispatch identities");

// -- 这是目标 ABI 镜像，不是厂商头文件 ------------------------------------
struct ScriptDocumentationAbiMirror {
    std::string description;
    std::string opaqueString18;
    std::string opaqueString30;
    std::string opaqueString48;
    std::vector<std::string> opaqueStrings60;
};

static_assert(sizeof(void *) == 8, "help consumer requires arm64 pointer width");
static_assert(sizeof(std::string) == 0x18, "libc++ string ABI changed");
static_assert(sizeof(std::vector<std::string>) == 0x18,
    "libc++ vector ABI changed");
static_assert(sizeof(ScriptDocumentationAbiMirror) == 0x78,
    "ScriptDocumentation mirror size changed");

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Winvalid-constexpr"
static_assert(__builtin_offsetof(ScriptDocumentationAbiMirror, description) == 0x00,
    "description offset changed");
static_assert(__builtin_offsetof(ScriptDocumentationAbiMirror, opaqueString18) == 0x18,
    "opaque string at +0x18 moved");
static_assert(__builtin_offsetof(ScriptDocumentationAbiMirror, opaqueString30) == 0x30,
    "opaque string at +0x30 moved");
static_assert(__builtin_offsetof(ScriptDocumentationAbiMirror, opaqueString48) == 0x48,
    "opaque string at +0x48 moved");
static_assert(__builtin_offsetof(ScriptDocumentationAbiMirror, opaqueStrings60) == 0x60,
    "opaque vector at +0x60 moved");
#pragma clang diagnostic pop

}  // namespace native_help_description::contract

#endif  // CAVALRY_NATIVE_TARGET_281
