/**
 * [INPUT]: 依赖NodeView header合同、完整源串、实际省略片段与既有严格UTF8解码器。
 * [OUTPUT]: 判定header owner，并仅为切断UTF8字符的原厂省略片段提供完整字符边界。
 * [POS]: 仅描述已证 NodeView header 的准入条件；未知 Lina owner 一律不准入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstddef>
#include <cstdint>
#include <limits>
#include <cstring>

#include "dependency_node_font_abi_contract.h"
#include "../cavalry_i18n_macos_timeline_font_policy.h"

namespace dependency_node_font::policy {
inline constexpr std::size_t kUnchangedTextSpan = std::numeric_limits<std::size_t>::max();

inline std::size_t repairedElisionPrefix(const unsigned char *source, std::size_t sourceSize,
                                        const void *text, std::size_t length, int encoding) noexcept
{
    if (!source || !text || encoding != 0 || length <= 3) return kUnchangedTextSpan;
    const auto *span = static_cast<const unsigned char *>(text);
    const std::size_t prefix = length - 3;
    if (prefix >= sourceSize || std::memcmp(span + prefix, "...", 3) != 0 ||
        std::memcmp(span, source, prefix) != 0 || (source[prefix] & 0xc0) != 0x80)
        return kUnchangedTextSpan;
    std::size_t offset = 0, boundary = 0;
    while (offset < sourceSize) {
        std::int32_t scalar = 0;
        if (!cavalry_i18n::mac_timeline::nextCodepoint(source, sourceSize, offset, scalar))
            return kUnchangedTextSpan;
        if (offset <= prefix) boundary = offset;
    }
    return boundary;
}

enum class HeaderSlot : std::uint8_t {
    None,
    NiceName,
    NodeType,
};

enum class SourceTarget : std::uint8_t {
    Unknown,
    ConstructorText,
    UpdatedNameText,
};

struct OwnerProof {
    bool exactSkiaCaller = false;
    bool frameChainReadable = false;
    bool exactLinaCallChain = false;
    bool textViewVtable = false;
    bool nodeViewParentPointer = false;
    bool nodeViewVtable = false;
    bool directChildVector = false;
    bool exactHeaderChild = false;
    bool recognizedSourceTarget = false;
    bool completeSourceString = false;
};

constexpr HeaderSlot headerSlotForIndex(std::size_t index) noexcept
{
    if (index == contract::kNodeViewNameHeaderChildIndex) return HeaderSlot::NiceName;
    if (index == contract::kNodeViewTypeHeaderChildIndex) return HeaderSlot::NodeType;
    return HeaderSlot::None;
}

constexpr bool isHeaderChildIndex(std::size_t index) noexcept
{
    return headerSlotForIndex(index) != HeaderSlot::None;
}

constexpr bool completeOwnerProof(const OwnerProof &proof) noexcept
{
    return proof.exactSkiaCaller && proof.frameChainReadable &&
        proof.exactLinaCallChain && proof.textViewVtable &&
        proof.nodeViewParentPointer && proof.nodeViewVtable &&
        proof.directChildVector && proof.exactHeaderChild &&
        proof.recognizedSourceTarget && proof.completeSourceString;
}

constexpr SourceTarget sourceTargetForAddressPoint(
    std::uintptr_t addressPoint, std::uintptr_t extensionImageBase) noexcept
{
    if (addressPoint >= extensionImageBase &&
        addressPoint - extensionImageBase ==
            contract::kTextViewConstructorTargetAddressPointOffset) {
        return SourceTarget::ConstructorText;
    }
    if (addressPoint >= extensionImageBase &&
        addressPoint - extensionImageBase ==
            contract::kTextViewSetTextTargetAddressPointOffset) {
        return SourceTarget::UpdatedNameText;
    }
    return SourceTarget::Unknown;
}

template <typename Read>
bool readSavedThis(std::uintptr_t frame, std::intptr_t savedThisOffset,
                   Read read, std::uintptr_t *output) noexcept
{
    if (frame == 0 || output == nullptr || (frame & (alignof(void *) - 1U)) != 0)
        return false;
    std::uintptr_t slot = 0;
    if (savedThisOffset < 0) {
        const auto distance = static_cast<std::uintptr_t>(-(savedThisOffset + 1)) + 1U;
        if (frame < distance) return false;
        slot = frame - distance;
    } else {
        const auto distance = static_cast<std::uintptr_t>(savedThisOffset);
        if (frame > std::numeric_limits<std::uintptr_t>::max() - distance) return false;
        slot = frame + distance;
    }
    return (slot & (alignof(void *) - 1U)) == 0 && read(slot, sizeof(*output), output);
}
}  // namespace dependency_node_font::policy
