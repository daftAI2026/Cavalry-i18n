/**
 * [INPUT]: 依赖 PE/IAT 解析器、ExtensionLayer MessageBar source 合同与只读映射 PE64 映像
 * [OUTPUT]: 对外验证 Qt6Widgets QTextEdit::append canonical slot、全部三处 RIP-relative 调用、history/live 双 return、js_logger 排除项与 MessageBar HTML/Pencil literals
 * [POS]: injector/windows 的 MessageBar 静态 ABI 防线；不加载或执行厂商代码，锁定批准/排除 caller 的指令形状与全映像 literals，防止命名 logger 被误接
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_vendor_messagebar_contract.h"

#include "cavalry_i18n_extension_layer_sources.h"
#include "cavalry_i18n_pe_iat.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <limits>
#include <string_view>
#include <vector>

namespace {

constexpr char kQt6WidgetsImportName[] = "Qt6Widgets.dll";
constexpr char kQTextEditAppendSymbol[] =
    "?append@QTextEdit@@QEAAXAEBVQString@@@Z";
constexpr std::size_t kExpectedQTextEditAppendIatRva = 0x01B2E420;
constexpr std::size_t kExpectedQTextEditAppendCallCount = 3;
constexpr std::array<std::size_t, 3> kExpectedQTextEditAppendCallRvas {{
    0x00FB40F4,
    0x00FB4B91,
    0x010DF4B0,
}};
constexpr std::array<std::size_t, 2> kApprovedMessageBarAppendCallRvas {{
    0x00FB40F4,
    0x00FB4B91,
}};
constexpr std::size_t kExcludedJsLoggerAppendCallRva = 0x010DF4B0;
constexpr std::array<std::array<std::uint8_t, 9>, 2>
    kApprovedContinuations {{
        {{
            0x48, 0x8B, 0x4D, 0x40,
            0x48, 0x85, 0xC9, 0x74, 0x14,
        }},
        {{
            0x48, 0x8B, 0x4D, 0xD8,
            0x48, 0x85, 0xC9, 0x74, 0x14,
        }},
}};
constexpr std::array<std::uint8_t, 8> kExcludedJsLoggerContinuation {{
    0x48, 0x8B, 0x4F, 0x70,
    0x48, 0x83, 0xC1, 0x04,
}};
constexpr char kMessageBarSinkRtti[] = ".?AVSink@MessageBar@@";
constexpr char kMessageBarHtmlFormat[] = " {} <b>{}</b> <br>{}";
constexpr char kExcludedLoggerName[] = "js_logger";

static_assert(
    kExcludedJsLoggerAppendCallRva
        != kApprovedMessageBarAppendCallRvas[0]
    && kExcludedJsLoggerAppendCallRva
        != kApprovedMessageBarAppendCallRvas[1]);

bool hasBytes(std::size_t size, std::size_t offset, std::size_t length)
{
    return offset <= size && length <= size - offset;
}

template <typename Value>
bool readObject(
    const std::vector<std::uint8_t> &image,
    std::size_t offset,
    Value *value)
{
    if (value == nullptr || !hasBytes(image.size(), offset, sizeof(Value))) {
        return false;
    }
    std::memcpy(value, image.data() + offset, sizeof(Value));
    return true;
}

bool readI32(
    const std::vector<std::uint8_t> &image,
    std::size_t offset,
    std::int32_t *value)
{
    return readObject(image, offset, value);
}

bool hasNulTerminatedAsciiLiteral(
    const std::vector<std::uint8_t> &image,
    std::string_view expected)
{
    if (expected.empty() || image.size() <= expected.size()) {
        return false;
    }
    const auto found = std::search(
        image.cbegin(),
        image.cend(),
        expected.cbegin(),
        expected.cend());
    return found != image.cend()
        && static_cast<std::size_t>(image.cend() - found) > expected.size()
        && *(found + expected.size()) == '\0';
}

bool imageSectionTable(
    const std::vector<std::uint8_t> &image,
    std::size_t *sectionTableOffset,
    std::uint16_t *sectionCount)
{
    IMAGE_DOS_HEADER dos {};
    if (sectionTableOffset == nullptr || sectionCount == nullptr
        || !readObject(image, 0, &dos)
        || dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0) {
        return false;
    }
    const std::size_t ntOffset = static_cast<std::size_t>(dos.e_lfanew);
    std::uint32_t signature = 0;
    IMAGE_FILE_HEADER fileHeader {};
    if (!readObject(image, ntOffset, &signature)
        || signature != IMAGE_NT_SIGNATURE
        || !readObject(
            image,
            ntOffset + sizeof(signature),
            &fileHeader)) {
        return false;
    }
    const std::size_t optionalOffset =
        ntOffset + sizeof(signature) + sizeof(fileHeader);
    if (fileHeader.SizeOfOptionalHeader
            > std::numeric_limits<std::size_t>::max() - optionalOffset) {
        return false;
    }
    *sectionTableOffset =
        optionalOffset + fileHeader.SizeOfOptionalHeader;
    *sectionCount = fileHeader.NumberOfSections;
    return hasBytes(
        image.size(),
        *sectionTableOffset,
        static_cast<std::size_t>(*sectionCount)
            * sizeof(IMAGE_SECTION_HEADER));
}

bool ripIndirectCallTargets(
    const std::vector<std::uint8_t> &image,
    std::size_t callRva,
    std::size_t expectedSlotRva)
{
    if (!hasBytes(image.size(), callRva, 6)
        || image[callRva] != 0xFF || image[callRva + 1] != 0x15) {
        return false;
    }
    std::int32_t displacement = 0;
    if (!readI32(image, callRva + 2, &displacement)) {
        return false;
    }
    const std::int64_t target =
        static_cast<std::int64_t>(callRva) + 6 + displacement;
    return target == static_cast<std::int64_t>(expectedSlotRva);
}

bool collectAppendCalls(
    const std::vector<std::uint8_t> &image,
    std::vector<std::size_t> *calls)
{
    std::size_t sectionTableOffset = 0;
    std::uint16_t sectionCount = 0;
    if (calls == nullptr
        || !imageSectionTable(
            image,
            &sectionTableOffset,
            &sectionCount)) {
        return false;
    }
    for (std::size_t index = 0; index < sectionCount; ++index) {
        IMAGE_SECTION_HEADER section {};
        if (!readObject(
                image,
                sectionTableOffset
                    + index * sizeof(IMAGE_SECTION_HEADER),
                &section)) {
            return false;
        }
        if ((section.Characteristics & IMAGE_SCN_MEM_EXECUTE) == 0) {
            continue;
        }
        const std::size_t sectionRva = section.VirtualAddress;
        const std::size_t sectionSize = std::max(
            static_cast<std::size_t>(section.Misc.VirtualSize),
            static_cast<std::size_t>(section.SizeOfRawData));
        if (!hasBytes(image.size(), sectionRva, sectionSize)) {
            return false;
        }
        for (std::size_t offset = 0; offset + 6 <= sectionSize; ++offset) {
            const std::size_t callRva = sectionRva + offset;
            if (ripIndirectCallTargets(
                    image,
                    callRva,
                    kExpectedQTextEditAppendIatRva)) {
                calls->push_back(callRva);
            }
        }
    }
    return true;
}

} // namespace

bool verifyCavalryExtensionLayerMessageBarContract(
    const std::vector<std::uint8_t> &extensionLayerImage,
    std::string *failure)
{
    if (failure == nullptr) {
        return false;
    }
    const CavalryPeIatLookupResult lookup = findCavalryPe64IatSlot(
        extensionLayerImage.data(),
        extensionLayerImage.size(),
        kQt6WidgetsImportName,
        kQTextEditAppendSymbol);
    if (lookup.status != CavalryPeIatLookupStatus::Found
        || lookup.iatSlotOffset != kExpectedQTextEditAppendIatRva) {
        *failure =
            "QTextEdit::append is not at the canonical ExtensionLayer IAT slot.";
        return false;
    }

    std::vector<std::size_t> calls;
    if (!collectAppendCalls(extensionLayerImage, &calls)) {
        *failure = "Could not enumerate executable QTextEdit::append calls.";
        return false;
    }
    std::sort(calls.begin(), calls.end());
    if (calls.size() != kExpectedQTextEditAppendCallCount
        || !std::equal(
            calls.cbegin(),
            calls.cend(),
            kExpectedQTextEditAppendCallRvas.cbegin())) {
        *failure =
            "QTextEdit::append callsites differ from the three Cavalry 2.7.2 references.";
        return false;
    }
    for (std::size_t index = 0;
         index < kApprovedMessageBarAppendCallRvas.size();
         ++index) {
        const std::size_t callRva =
            kApprovedMessageBarAppendCallRvas[index];
        const auto &continuation = kApprovedContinuations[index];
        if (!hasBytes(
                extensionLayerImage.size(),
                callRva + 6,
                continuation.size())
            || std::memcmp(
                   extensionLayerImage.data() + callRva + 6,
                   continuation.data(),
                   continuation.size())
                != 0) {
            *failure =
                "An approved MessageBar append return no longer has its canonical history/live continuation.";
            return false;
        }
    }
    if (!hasBytes(
            extensionLayerImage.size(),
            kExcludedJsLoggerAppendCallRva + 6,
            kExcludedJsLoggerContinuation.size())
        || std::memcmp(
               extensionLayerImage.data()
                   + kExcludedJsLoggerAppendCallRva + 6,
               kExcludedJsLoggerContinuation.data(),
               kExcludedJsLoggerContinuation.size())
            != 0) {
        *failure =
            "The excluded js_logger append return no longer has its canonical QTextEditSink continuation.";
        return false;
    }
    if (!hasNulTerminatedAsciiLiteral(
            extensionLayerImage,
            kMessageBarSinkRtti)
        || !hasNulTerminatedAsciiLiteral(
            extensionLayerImage,
            kMessageBarHtmlFormat)
        || !hasNulTerminatedAsciiLiteral(
            extensionLayerImage,
            kExcludedLoggerName)
        || !hasNulTerminatedAsciiLiteral(
            extensionLayerImage,
            cavalry_i18n::extension_layer_contract::
                kPencilCameraDistanceWarning)) {
        *failure =
            "ExtensionLayer is missing MessageBar HTML, Pencil, Sink, or js_logger exclusion evidence.";
        return false;
    }
    return true;
}
