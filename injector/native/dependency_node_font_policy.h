/**
 * [INPUT]: 依赖 Dependency Graph NodeView 的两个直系 header 索引与 2.8.1 source target ABI。
 * [OUTPUT]: 以纯值合同判定调用帧、NodeView owner、header 槽和完整源闭包是否齐全。
 * [POS]: 仅描述已证 NodeView header 的准入条件；未知 Lina owner 一律不准入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstddef>
#include <cstdint>
#include <limits>

#include "dependency_node_font_abi_contract.h"

namespace dependency_node_font::policy {
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
