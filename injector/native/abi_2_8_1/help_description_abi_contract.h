/**
 * [INPUT]: 依赖 Cavalry 2.8.1 arm64 Extension/UI 导入与 callee 的静态二进制证据。
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
    "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050";
inline constexpr char kExtensionUuid[] = "AF1367BD-2D7E-3EC0-A111-935E4881C655";
inline constexpr char kCavalryUiSha256[] =
    "4d8e7139760af268230c084f269d9fe5c069fa46c7b579e6dee212984bf00c1d";
inline constexpr char kCavalryUiUuid[] = "98BBF79D-6439-3287-9A65-8FF8B64B06BB";

inline constexpr char kEntrySymbol[] =
    "__ZN8TextEdit27addScriptDocumentationEntryERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEERKN7cavalry19ScriptDocumentationE";
inline constexpr char kDefCallerSymbol[] =
    "__ZN9acrJSMath18formatForCompleterERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE";
inline constexpr std::uintptr_t kExtensionCallerOffset = 0x00ac6ee0;
inline constexpr std::uintptr_t kExtensionReturnOffset = 0x00ac6ee4;
inline constexpr std::uintptr_t kDefCallerConditionOffset = 0x006a8fc0;
inline constexpr std::uintptr_t kDefCallerOffset = 0x006a90d8;
inline constexpr std::uintptr_t kDefReturnOffset = 0x006a90dc;
inline constexpr std::uintptr_t kExtensionStubOffset = 0x00d23f98;
inline constexpr std::uintptr_t kExtensionImportSlotOffset = 0x01026a20;
inline constexpr std::uintptr_t kCavalryUiEntryOffset = 0x00091518;
inline constexpr bool kRequiresTwoLevelNamespace = true;

inline constexpr std::array<std::uint8_t, 4> kCallerBranchBytes = {
    0x2e, 0x74, 0x09, 0x94,
};
inline constexpr std::array<std::uint8_t, 4> kDefCallerConditionBytes = {
    0x80, 0x00, 0x00, 0x34,
};
inline constexpr std::array<std::uint8_t, 4> kDefCallerBranchBytes = {
    0xb0, 0xeb, 0x19, 0x94,
};
inline constexpr std::array<std::uint8_t, 12> kImportStubBytes = {
    0x10, 0x18, 0x00, 0xf0, 0x10, 0x12, 0x45, 0xf9,
    0x00, 0x02, 0x1f, 0xd6,
};
inline constexpr std::array<std::uint8_t, 16> kCalleeEntryBytes = {
    0xff, 0x83, 0x01, 0xd1, 0xf8, 0x5f, 0x02, 0xa9,
    0xf6, 0x57, 0x03, 0xa9, 0xf4, 0x4f, 0x04, 0xa9,
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
