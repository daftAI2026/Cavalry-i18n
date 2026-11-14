#if defined(CAVALRY_NATIVE_TARGET_281)
#include "abi_2_8_1/help_popup_layout_abi_contract.h"
#else
/**
 * [INPUT]: 依赖Cavalry 2.8各架构DocumentationPopup与QtWidgets Mach-O证据。
 * [OUTPUT]: 分架构锁定setContent内QLayout::activate返回地址与调用窗。
 * [POS]: 帮助布局adapter的窄准入合同；未知调用只透传原函数。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstdint>

namespace native_help_popup_layout::abi {

inline constexpr char kQtWidgetsUuid[] =
    "01652E29-047E-3528-9DC2-1BD084292E50";
inline constexpr char kDocumentationSetContentSymbol[] =
    "__ZN18DocumentationPopup10setContentERK7QStringS2_S2_S2_S2_";
inline constexpr char kQtLayoutActivateSymbol[] = "__ZN7QLayout8activateEv";

inline constexpr std::uintptr_t kDocumentationSetContentOffset = 0x92394;
inline constexpr std::uintptr_t kActivateCallWindowOffset = 0x924f4;
inline constexpr std::uintptr_t kActivateReturnOffset = 0x92500;
inline constexpr std::uintptr_t kActivateImportStubOffset = 0xad15c;
inline constexpr std::uintptr_t kQtLayoutActivateOffset = 0x3cda0;

inline constexpr std::array<std::uint8_t, 20> kActivateCallWindowBytes = {
    0xe0, 0x03, 0x13, 0xaa, 0xac, 0x71, 0x00, 0x94,
    0x18, 0x6b, 0x00, 0x94, 0xe0, 0x03, 0x13, 0xaa,
    0xaf, 0x6b, 0x00, 0x94,
};
inline constexpr std::array<std::uint8_t, 12> kActivateImportStubBytes = {
    0xd0, 0x00, 0x00, 0x90, 0x10, 0x26, 0x41, 0xf9,
    0x00, 0x02, 0x1f, 0xd6,
};

static_assert(kActivateReturnOffset == kActivateCallWindowOffset + 12,
    "the approved return address must follow the QLayout::activate call");

constexpr bool isExactActivationCaller(std::uintptr_t caller,
                                       std::uintptr_t expected) noexcept
{
    return expected != 0 && caller == expected;
}

namespace x86_64 {
inline constexpr char kCavalryUiUuid[] =
    "2E9322B5-C7A3-3891-9B33-D0DED802D37D";
inline constexpr char kQtWidgetsUuid[] =
    "0C194E6E-1E76-3FD4-83A3-9263616E2F3F";
inline constexpr char kDocumentationSetContentSymbol[] =
    "__ZN18DocumentationPopup10setContentERK7QStringS2_S2_S2_S2_";
inline constexpr char kQtLayoutActivateSymbol[] = "__ZN7QLayout8activateEv";

inline constexpr std::uintptr_t kDocumentationSetContentOffset = 0x9af20;
inline constexpr std::uintptr_t kActivateCallWindowOffset = 0x9b072;
inline constexpr std::uintptr_t kActivateCallOffset = 0x9b07a;
inline constexpr std::uintptr_t kActivateReturnOffset = 0x9b07f;
inline constexpr std::uintptr_t kActivateImportStubOffset = 0xb76cd;
inline constexpr std::uintptr_t kActivateGotOffset = 0xce248;
inline constexpr std::uintptr_t kQtLayoutActivateOffset = 0x42fb0;

inline constexpr std::array<std::uint8_t, 21> kActivateCallWindowBytes = {
    0xe8, 0x7c, 0xd3, 0x01, 0x00, 0x48, 0x89, 0xc7,
    0xe8, 0x4e, 0xc6, 0x01, 0x00, 0x48, 0x89, 0xdf,
    0xe8, 0x78, 0xc7, 0x01, 0x00,
};
inline constexpr std::array<std::uint8_t, 6> kActivateImportStubBytes = {
    0xff, 0x25, 0x75, 0x6b, 0x01, 0x00,
};

static_assert(kActivateCallOffset == kActivateCallWindowOffset + 8U,
              "QLayout::activate must remain the middle call in the approved window");
static_assert(kActivateReturnOffset == kActivateCallOffset + 5U,
              "approved x86 return PC must follow the five-byte call instruction");
static_assert(kActivateImportStubOffset + kActivateImportStubBytes.size() +
              static_cast<std::int32_t>(0x16b75) == kActivateGotOffset,
              "the approved import stub must jump to the QtWidgets GOT slot");
}  // namespace x86_64

}  // namespace native_help_popup_layout::abi

#endif  // CAVALRY_NATIVE_TARGET_281
