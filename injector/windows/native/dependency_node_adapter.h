/*
 * [INPUT]: 官方2.8.1 MSVC NodeView/TextView虚表、直属header关系与Skia完整串首测，复用共享UTF8省略策略。
 * [OUTPUT]: 为一次已证header paint提供有界源快照、单次字体选择与测量/绘制共用的安全省略span。
 * [POS]: Windows节点图薄适配；借用原厂完整串消费者，不调用getter、不改名称、不扫描场景或解析std::function。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "../../native/utf8_elision_policy.h"
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <limits>

namespace native_windows_dependency {
namespace abi {
inline constexpr char kExtensionSha256[] = "c2f0fcf5323f90fbd3b1d9d0375bc603e18dc070eae8ff3df72090d8ac858954";
inline constexpr std::uintptr_t kTextViewVtable = 0x18ba148;
inline constexpr std::uintptr_t kNodeViewVtable = 0x18b9f58;
inline constexpr std::size_t kPaintSlot = 3;
inline constexpr std::uintptr_t kPaintThunk = 0x1f93d;
inline constexpr std::uintptr_t kPaintFunction = 0x9bb640;
inline constexpr std::uintptr_t kNameMemberStore = 0x9b6162;
inline constexpr std::uintptr_t kHeaderParentStore = 0x9b61c8;
inline constexpr std::uintptr_t kChildrenBeginAddress = 0x9b618d;
inline constexpr std::uintptr_t kChildrenEndLoad = 0x9b6170;
inline constexpr std::uintptr_t kChildrenCapacityCompare = 0x9b6177;
inline constexpr std::uintptr_t kParentOffset = 0x318;
inline constexpr std::uintptr_t kChildrenOffset = 0x2c0;
inline constexpr std::uintptr_t kNameHeaderOffset = 0x6a0;
inline constexpr std::uintptr_t kFullMeasureReturn = 0x9bbf0b;
inline constexpr std::uintptr_t kDotsMeasureReturn = 0x9bbf76;
inline constexpr std::uintptr_t kPrefixMeasureReturn = 0x9bc2b8;
inline constexpr std::uintptr_t kFillDrawReturn = 0x84020e;
inline constexpr std::uintptr_t kStrokeDrawReturn = 0x840265;
inline constexpr std::size_t kHeaderPrefixChildren = 3;
inline constexpr std::size_t kMaxSourceBytes = cavalry_i18n::mac_timeline::kMaxTextBytes;
}

template <typename Read>
bool headerOwner(std::uintptr_t textView, std::uintptr_t extension, Read read) noexcept {
    if (!textView || !extension) return false;
    const auto at = [&](std::uintptr_t object, std::uintptr_t offset,
                        void *out, std::size_t bytes) {
        return object && offset <= std::numeric_limits<std::uintptr_t>::max() - object &&
            read(object + offset, out, bytes);
    };
    std::uintptr_t vtable = 0, parent = 0, name = 0;
    if (!at(textView, 0, &vtable, sizeof(vtable)) ||
        vtable < extension || vtable - extension != abi::kTextViewVtable ||
        !at(textView, abi::kParentOffset, &parent, sizeof(parent)) ||
        !at(parent, 0, &vtable, sizeof(vtable)) ||
        vtable < extension || vtable - extension != abi::kNodeViewVtable ||
        !at(parent, abi::kNameHeaderOffset, &name, sizeof(name)) || !name) return false;
    std::array<std::uintptr_t, 3> vector{};
    if (!at(parent, abi::kChildrenOffset, vector.data(), sizeof(vector))) return false;
    const auto begin = vector[0], end = vector[1], capacity = vector[2];
    if (!begin || begin % alignof(void *) || end < begin || capacity < end ||
        (end - begin) % sizeof(void *) || (capacity - begin) % sizeof(void *) ||
        (end - begin) / sizeof(void *) < 2) return false;
    const auto count = (end - begin) / sizeof(void *);
    const auto prefixCount = count < abi::kHeaderPrefixChildren ? count : abi::kHeaderPrefixChildren;
    std::array<std::uintptr_t, abi::kHeaderPrefixChildren> children{};
    if (!read(begin, children.data(), prefixCount * sizeof(void *))) return false;
    std::size_t nameIndex = prefixCount, targetCount = 0;
    for (std::size_t i = 0; i < prefixCount; ++i) {
        if (children[i] == textView) ++targetCount;
        if (children[i] == name) {
            if (nameIndex != prefixCount) return false;
            nameIndex = i;
        }
    }
    // 名称指针来自原厂NodeView成员；可选的前置child不会改变两行header的相邻关系。
    return targetCount == 1 && nameIndex < 2 && nameIndex + 1 < prefixCount &&
        (children[nameIndex] == textView || children[nameIndex + 1] == textView);
}

inline bool measureCaller(std::uintptr_t rva) noexcept {
    return rva == abi::kFullMeasureReturn || rva == abi::kDotsMeasureReturn ||
        rva == abi::kPrefixMeasureReturn;
}
inline bool drawCaller(std::uintptr_t rva) noexcept {
    return rva == abi::kFillDrawReturn || rva == abi::kStrokeDrawReturn;
}

struct Span { const void *text; std::size_t size; };

struct PaintFrame {
    std::array<unsigned char, abi::kMaxSourceBytes> source;
    std::array<unsigned char, abi::kMaxSourceBytes + 3> repaired;
    std::size_t sourceSize = 0;
    bool sourceKnown = false, sourceRejected = false, faceResolved = false;
    const void *fallbackFace = nullptr;

    bool capture(const void *text, std::size_t size, int encoding) noexcept {
        if (sourceKnown) return true;
        if (sourceRejected) return false;
        sourceRejected = true;
        if (!text || encoding != 0 || !size || size > source.size()) return false;
        const auto *bytes = static_cast<const unsigned char *>(text);
        std::size_t offset = 0;
        while (offset < size) {
            std::int32_t scalar = 0;
            if (!cavalry_i18n::mac_timeline::nextCodepoint(bytes, size, offset, scalar)) return false;
        }
        std::memcpy(source.data(), text, size);
        sourceSize = size;
        sourceKnown = true;
        sourceRejected = false;
        return true;
    }

    Span project(const void *text, std::size_t size, int encoding) noexcept {
        if (!sourceKnown) return {text, size};
        const auto prefix = native_utf8_elision::repairedElisionPrefix(
            source.data(), sourceSize, text, size, encoding);
        if (prefix == native_utf8_elision::kUnchangedTextSpan) return {text, size};
        std::memcpy(repaired.data(), source.data(), prefix);
        std::memcpy(repaired.data() + prefix, "...", 3);
        return {repaired.data(), prefix + 3};
    }

    template <typename Pick>
    const void *font(const void *original, std::array<std::byte, 24> &copy, Pick pick) {
        if (!original || !sourceKnown) return original;
        if (!faceResolved) {
            fallbackFace = pick(source.data(), sourceSize, original);
            faceResolved = true;
        }
        if (!fallbackFace) return original;
        std::memcpy(copy.data(), original, copy.size());
        std::memcpy(copy.data(), &fallbackFace, sizeof(fallbackFace));
        return copy.data();
    }
};
}
