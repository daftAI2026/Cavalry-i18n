/**
 * [INPUT]: 依赖 cavalry_i18n_vendor_text_path_contract.h、共享十五项 source、PE/IAT 解析器与已采证 RVAs
 * [OUTPUT]: 对外锁定 Core::MakePathFromText 唯一槽/调用数、十字节 ABI preamble、canonical 返回点、viewport 表顺序及 EditShapeTool/TransformTool 双 Path 数据流
 * [POS]: injector/windows 的 Cavalry 2.7.2 text-path 静态兼容合同；只读取已映射字节，不执行 vendor 代码
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_vendor_text_path_contract.h"

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
#include <cstring>
#include <string_view>
#include <utility>

namespace {

constexpr char kCoreImportName[] = "Core.dll";
constexpr char kMakePathFromTextSymbol[] =
    "?MakePathFromText@cavalry@@YA?AVPath@1@AEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@N@Z";
constexpr std::size_t kMakePathIatRva = 0x01B28F98;
constexpr std::size_t kCanonicalMakePathPreambleRva = 0x002D9170;
constexpr std::size_t kCanonicalMakePathCallRva = 0x002D917A;
constexpr std::size_t kCanonicalMakePathReturnRva = 0x002D9180;
constexpr std::size_t kExpectedMakePathCallCount = 20;
constexpr std::array<std::uint8_t, 10> kCanonicalMakePathPreamble {{
    0x4C, 0x89, 0xF1,
    0x48, 0x89, 0xF2,
    0x66, 0x0F, 0x28, 0xD6,
}};

constexpr std::size_t kGetOrCreateTextPathThunkRva = 0x0001FEB0;
constexpr std::size_t kGetOrCreateTextPathBodyRva = 0x002D8FA0;
constexpr std::size_t kExpectedGetOrCreateCallCount = 8;

constexpr std::size_t kRenderFrameThunkRva = 0x0001365B;
constexpr std::size_t kRenderFrameBodyRva = 0x002C7F40;
constexpr std::size_t kViewportQualityTableRva = 0x014E7350;
constexpr std::array<std::size_t, 4> kViewportLiteralRvas {{
    0x014E6BB0,
    0x014E6BCA,
    0x014E6B95,
    0x014E6BE8,
}};
constexpr std::size_t kViewportDefaultHighLeaRva = 0x002CBA70;
constexpr std::size_t kViewportGetOrCreateCallRva = 0x002CBB57;

constexpr std::size_t kSetupToolHelpThunkRva = 0x0000A05B;
constexpr std::size_t kSetupToolHelpBodyRva = 0x002C4070;
constexpr std::size_t kSetupPrefixPathCallRva = 0x002C419E;
constexpr std::size_t kSetupActionPathCallRva = 0x002C41B1;
constexpr std::size_t kRenderToolHelpThunkRva = 0x00015DCF;
constexpr std::size_t kRenderToolHelpBodyRva = 0x002D7210;
constexpr std::size_t kPaintGeometryIatRva = 0x01B29098;
constexpr std::size_t kPaintPrefixCallRva = 0x002D7645;
constexpr std::size_t kPaintActionCallRva = 0x002D77AE;

struct ToolHelpEvidence {
    std::size_t prefixLeaRva;
    std::size_t actionLeaRva;
    std::size_t prefixLiteralRva;
    std::size_t actionLiteralRva;
};

constexpr std::array<ToolHelpEvidence, 6> kToolHelpEvidence {{
    { 0x012663E7, 0x012663EE, 0x015A30EC, 0x015A30F5 },
    { 0x01266413, 0x0126641A, 0x015A312D, 0x015A3109 },
    { 0x0126643F, 0x01266446, 0x015A6DDB, 0x015A6DC3 },
    { 0x0126646B, 0x01266472, 0x015A6E08, 0x015A6DEF },
    { 0x01266497, 0x0126649E, 0x0153A7E5, 0x015A6E14 },
    { 0x012664C3, 0x012664CA, 0x015A6E48, 0x015A6E2E },
}};

constexpr std::size_t kTransformToolHelpThunkRva = 0x0000DC51;
constexpr std::size_t kTransformToolHelpBodyRva = 0x011CA3C0;
constexpr std::size_t kTransformToolSecondaryVtableSlotRva = 0x0159EB08;
constexpr std::size_t kSetupGetToolCallRva = 0x002C40E7;
constexpr std::size_t kGetToolThunkRva = 0x0001915F;
constexpr std::array<std::uint8_t, 6> kToolHelpVirtualCall {{
    0xFF, 0x90, 0xE0, 0x00, 0x00, 0x00,
}};

struct TransformToolHelpEvidence {
    std::size_t firstPrefixLeaRva;
    std::size_t firstActionLeaRva;
    std::size_t secondPrefixLeaRva;
    std::size_t secondActionLeaRva;
    std::size_t prefixLiteralRva;
    std::size_t actionLiteralRva;
};

constexpr std::array<TransformToolHelpEvidence, 5>
    kTransformToolHelpEvidence {{
        {
            0x011CA417,
            0x011CA41E,
            0x011CA4F7,
            0x011CA4FE,
            0x015A312D,
            0x014F4824,
        },
        {
            0x011CA443,
            0x011CA44A,
            0x011CA51E,
            0x011CA525,
            0x015A365F,
            0x015A365B,
        },
        {
            0x011CA46F,
            0x011CA476,
            0x011CA545,
            0x011CA54C,
            0x015A3685,
            0x015A3678,
        },
        {
            0x011CA49B,
            0x011CA4A2,
            0x011CA56C,
            0x011CA573,
            0x015A36A7,
            0x015A368C,
        },
        {
            0x011CA4C7,
            0x011CA4CE,
            0x011CA593,
            0x011CA59A,
            0x015A36AF,
            0x015325FE,
        },
    }};

bool hasRange(
    const std::vector<std::uint8_t> &image,
    std::size_t offset,
    std::size_t size)
{
    return offset <= image.size() && size <= image.size() - offset;
}

template <typename Value>
bool readValue(
    const std::vector<std::uint8_t> &image,
    std::size_t offset,
    Value *value)
{
    if (value == nullptr || !hasRange(image, offset, sizeof(Value))) {
        return false;
    }
    std::memcpy(value, image.data() + offset, sizeof(Value));
    return true;
}

bool peHeaders(
    const std::vector<std::uint8_t> &image,
    IMAGE_FILE_HEADER *fileHeader,
    IMAGE_OPTIONAL_HEADER64 *optionalHeader,
    std::size_t *sectionTableRva)
{
    IMAGE_DOS_HEADER dos {};
    if (!readValue(image, 0, &dos)
        || dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0) {
        return false;
    }

    const std::size_t ntRva = static_cast<std::size_t>(dos.e_lfanew);
    std::uint32_t signature = 0;
    if (!readValue(image, ntRva, &signature)
        || signature != IMAGE_NT_SIGNATURE
        || !readValue(image, ntRva + sizeof(signature), fileHeader)) {
        return false;
    }
    const std::size_t optionalRva =
        ntRva + sizeof(signature) + sizeof(*fileHeader);
    if (!readValue(image, optionalRva, optionalHeader)
        || optionalHeader->Magic != IMAGE_NT_OPTIONAL_HDR64_MAGIC) {
        return false;
    }
    *sectionTableRva = optionalRva + fileHeader->SizeOfOptionalHeader;
    return hasRange(
        image,
        *sectionTableRva,
        static_cast<std::size_t>(fileHeader->NumberOfSections)
            * sizeof(IMAGE_SECTION_HEADER));
}

bool relativeTarget(
    const std::vector<std::uint8_t> &image,
    std::size_t instructionRva,
    std::size_t instructionSize,
    std::size_t displacementOffset,
    std::size_t *targetRva)
{
    std::int32_t displacement = 0;
    if (targetRva == nullptr
        || !readValue(
            image,
            instructionRva + displacementOffset,
            &displacement)) {
        return false;
    }
    const std::int64_t target =
        static_cast<std::int64_t>(instructionRva + instructionSize)
        + displacement;
    if (target < 0
        || static_cast<std::uint64_t>(target) >= image.size()) {
        return false;
    }
    *targetRva = static_cast<std::size_t>(target);
    return true;
}

bool directCallTargets(
    const std::vector<std::uint8_t> &image,
    std::size_t callRva,
    std::size_t expectedTargetRva)
{
    std::size_t targetRva = 0;
    return hasRange(image, callRva, 5)
        && image[callRva] == 0xE8
        && relativeTarget(image, callRva, 5, 1, &targetRva)
        && targetRva == expectedTargetRva;
}

bool nearJumpTargets(
    const std::vector<std::uint8_t> &image,
    std::size_t jumpRva,
    std::size_t expectedTargetRva)
{
    std::size_t targetRva = 0;
    return hasRange(image, jumpRva, 5)
        && image[jumpRva] == 0xE9
        && relativeTarget(image, jumpRva, 5, 1, &targetRva)
        && targetRva == expectedTargetRva;
}

bool indirectCallTargets(
    const std::vector<std::uint8_t> &image,
    std::size_t callRva,
    std::size_t expectedSlotRva)
{
    std::size_t targetRva = 0;
    return hasRange(image, callRva, 6)
        && image[callRva] == 0xFF && image[callRva + 1] == 0x15
        && relativeTarget(image, callRva, 6, 2, &targetRva)
        && targetRva == expectedSlotRva;
}

bool leaTargets(
    const std::vector<std::uint8_t> &image,
    std::size_t leaRva,
    std::size_t expectedTargetRva)
{
    std::size_t targetRva = 0;
    return hasRange(image, leaRva, 7)
        && (image[leaRva] & 0xF0) == 0x40
        && image[leaRva + 1] == 0x8D
        && (image[leaRva + 2] & 0xC7) == 0x05
        && relativeTarget(image, leaRva, 7, 3, &targetRva)
        && targetRva == expectedTargetRva;
}

bool literalAt(
    const std::vector<std::uint8_t> &image,
    std::size_t rva,
    std::string_view expected)
{
    return hasRange(image, rva, expected.size() + 1)
        && std::memcmp(image.data() + rva, expected.data(), expected.size()) == 0
        && image[rva + expected.size()] == '\0';
}

bool exportTableContainsRva(
    const std::vector<std::uint8_t> &image,
    std::size_t expectedRva)
{
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    std::size_t ignoredSectionTable = 0;
    if (!peHeaders(
            image,
            &fileHeader,
            &optionalHeader,
            &ignoredSectionTable)
        || optionalHeader.NumberOfRvaAndSizes <= IMAGE_DIRECTORY_ENTRY_EXPORT) {
        return false;
    }

    const IMAGE_DATA_DIRECTORY directory =
        optionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
    IMAGE_EXPORT_DIRECTORY exports {};
    if (!readValue(image, directory.VirtualAddress, &exports)) {
        return false;
    }
    const std::size_t functionCount = exports.NumberOfFunctions;
    if (functionCount > image.size() / sizeof(std::uint32_t)
        || !hasRange(
            image,
            exports.AddressOfFunctions,
            functionCount * sizeof(std::uint32_t))) {
        return false;
    }
    for (std::size_t index = 0; index < functionCount; ++index) {
        std::uint32_t functionRva = 0;
        if (!readValue(
                image,
                exports.AddressOfFunctions
                    + index * sizeof(functionRva),
                &functionRva)) {
            return false;
        }
        if (functionRva == expectedRva) {
            return true;
        }
    }
    return false;
}

template <typename Predicate>
bool countExecutableMatches(
    const std::vector<std::uint8_t> &image,
    std::size_t instructionSize,
    Predicate predicate,
    std::size_t *count)
{
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    std::size_t sectionTableRva = 0;
    if (count == nullptr
        || !peHeaders(
            image,
            &fileHeader,
            &optionalHeader,
            &sectionTableRva)) {
        return false;
    }

    std::size_t matches = 0;
    for (std::size_t index = 0; index < fileHeader.NumberOfSections; ++index) {
        IMAGE_SECTION_HEADER section {};
        if (!readValue(
                image,
                sectionTableRva + index * sizeof(section),
                &section)) {
            return false;
        }
        if ((section.Characteristics & IMAGE_SCN_MEM_EXECUTE) == 0) {
            continue;
        }
        const std::size_t begin = section.VirtualAddress;
        const std::size_t span = std::max<std::size_t>(
            section.Misc.VirtualSize,
            section.SizeOfRawData);
        if (!hasRange(image, begin, span)) {
            return false;
        }
        for (std::size_t offset = 0;
             offset + instructionSize <= span;
             ++offset) {
            if (predicate(begin + offset)) {
                ++matches;
            }
        }
    }
    *count = matches;
    return true;
}

bool verifyMakePathBoundary(
    const std::vector<std::uint8_t> &image,
    std::string *failure)
{
    const CavalryPeIatLookupResult lookup = findCavalryPe64IatSlot(
        image.data(),
        image.size(),
        kCoreImportName,
        kMakePathFromTextSymbol);
    if (lookup.status != CavalryPeIatLookupStatus::Found
        || lookup.iatSlotOffset != kMakePathIatRva) {
        *failure = "Core::MakePathFromText exact IAT slot contract changed.";
        return false;
    }
    if (kCanonicalMakePathPreambleRva
                + kCanonicalMakePathPreamble.size()
            != kCanonicalMakePathCallRva
        || !hasRange(
            image,
            kCanonicalMakePathPreambleRva,
            kCanonicalMakePathPreamble.size())
        || std::memcmp(
               image.data() + kCanonicalMakePathPreambleRva,
               kCanonicalMakePathPreamble.data(),
               kCanonicalMakePathPreamble.size())
            != 0) {
        *failure =
            "Canonical MakePathFromText hidden-sret/string/XMM2 ABI preamble changed.";
        return false;
    }
    if (kCanonicalMakePathCallRva + 6 != kCanonicalMakePathReturnRva
        || !indirectCallTargets(
            image,
            kCanonicalMakePathCallRva,
            kMakePathIatRva)) {
        *failure = "Canonical getOrCreateTextPath return/call contract changed.";
        return false;
    }

    std::size_t makePathCalls = 0;
    if (!countExecutableMatches(
            image,
            6,
            [&](std::size_t rva) {
                return indirectCallTargets(image, rva, kMakePathIatRva);
            },
            &makePathCalls)
        || makePathCalls != kExpectedMakePathCallCount) {
        *failure = "Core::MakePathFromText ExtensionLayer call count changed.";
        return false;
    }
    if (!exportTableContainsRva(image, kGetOrCreateTextPathThunkRva)
        || !nearJumpTargets(
            image,
            kGetOrCreateTextPathThunkRva,
            kGetOrCreateTextPathBodyRva)) {
        *failure = "getOrCreateTextPath export/body contract changed.";
        return false;
    }

    std::size_t getOrCreateCalls = 0;
    if (!countExecutableMatches(
            image,
            5,
            [&](std::size_t rva) {
                return directCallTargets(
                    image,
                    rva,
                    kGetOrCreateTextPathThunkRva);
            },
            &getOrCreateCalls)
        || getOrCreateCalls != kExpectedGetOrCreateCallCount) {
        *failure = "getOrCreateTextPath direct-call count changed.";
        return false;
    }
    return true;
}

bool verifyViewportBoundary(
    const std::vector<std::uint8_t> &image,
    std::string *failure)
{
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    std::size_t ignoredSectionTable = 0;
    if (!peHeaders(
            image,
            &fileHeader,
            &optionalHeader,
            &ignoredSectionTable)
        || !exportTableContainsRva(image, kRenderFrameThunkRva)
        || !nearJumpTargets(image, kRenderFrameThunkRva, kRenderFrameBodyRva)) {
        *failure = "GraphicsViewportBase::renderFrame export/body contract changed.";
        return false;
    }

    for (std::size_t index = 0; index < kViewportLiteralRvas.size(); ++index) {
        std::uint64_t literalVa = 0;
        if (!readValue(
                image,
                kViewportQualityTableRva + index * sizeof(literalVa),
                &literalVa)
            || literalVa != optionalHeader.ImageBase + kViewportLiteralRvas[index]
            || !literalAt(
                image,
                kViewportLiteralRvas[index],
                cavalry_i18n::extension_layer_contract::kViewportQualitySources[index])) {
            *failure = "Viewport quality enum/table order changed.";
            return false;
        }
    }
    if (!leaTargets(
            image,
            kViewportDefaultHighLeaRva,
            kViewportLiteralRvas[2])
        || !directCallTargets(
            image,
            kViewportGetOrCreateCallRva,
            kGetOrCreateTextPathThunkRva)) {
        *failure = "Viewport default-high/text-path call contract changed.";
        return false;
    }
    return true;
}

bool verifyToolHelpBoundary(
    const std::vector<std::uint8_t> &image,
    std::string *failure)
{
    for (std::size_t index = 0; index < kToolHelpEvidence.size(); ++index) {
        const auto &evidence = kToolHelpEvidence[index];
        const auto &pair =
            cavalry_i18n::extension_layer_contract::kEditShapeToolHelpPairs[index];
        if (!leaTargets(image, evidence.prefixLeaRva, evidence.prefixLiteralRva)
            || !leaTargets(image, evidence.actionLeaRva, evidence.actionLiteralRva)
            || !literalAt(image, evidence.prefixLiteralRva, pair.prefix)
            || !literalAt(image, evidence.actionLiteralRva, pair.action)) {
            *failure = "EditShapeTool prefix/action pair evidence changed.";
            return false;
        }
    }

    if (!exportTableContainsRva(image, kSetupToolHelpThunkRva)
        || !nearJumpTargets(
            image,
            kSetupToolHelpThunkRva,
            kSetupToolHelpBodyRva)
        || !directCallTargets(
            image,
            kSetupPrefixPathCallRva,
            kGetOrCreateTextPathThunkRva)
        || !directCallTargets(
            image,
            kSetupActionPathCallRva,
            kGetOrCreateTextPathThunkRva)) {
        *failure = "setupToolHelp separate prefix/action Path contract changed.";
        return false;
    }

    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    std::size_t ignoredSectionTable = 0;
    std::uint64_t virtualTarget = 0;
    if (!peHeaders(
            image,
            &fileHeader,
            &optionalHeader,
            &ignoredSectionTable)
        || !readValue(
            image,
            kTransformToolSecondaryVtableSlotRva,
            &virtualTarget)
        || virtualTarget
            != optionalHeader.ImageBase + kTransformToolHelpThunkRva
        || !nearJumpTargets(
            image,
            kTransformToolHelpThunkRva,
            kTransformToolHelpBodyRva)
        || !directCallTargets(
            image,
            kSetupGetToolCallRva,
            kGetToolThunkRva)
        || !hasRange(
            image,
            0x002C40FE,
            kToolHelpVirtualCall.size())
        || std::memcmp(
               image.data() + 0x002C40FE,
               kToolHelpVirtualCall.data(),
               kToolHelpVirtualCall.size())
            != 0
        || !hasRange(
            image,
            0x002C4122,
            kToolHelpVirtualCall.size())
        || std::memcmp(
               image.data() + 0x002C4122,
               kToolHelpVirtualCall.data(),
               kToolHelpVirtualCall.size())
            != 0) {
        *failure =
            "TransformTool secondary vtable/toolHelp dispatch contract changed.";
        return false;
    }

    for (std::size_t index = 0;
         index < kTransformToolHelpEvidence.size();
         ++index) {
        const TransformToolHelpEvidence &evidence =
            kTransformToolHelpEvidence[index];
        const auto &pair =
            cavalry_i18n::extension_layer_contract::
                kTransformToolHelpPairs[index];
        if (!leaTargets(
                image,
                evidence.firstPrefixLeaRva,
                evidence.prefixLiteralRva)
            || !leaTargets(
                image,
                evidence.firstActionLeaRva,
                evidence.actionLiteralRva)
            || !leaTargets(
                image,
                evidence.secondPrefixLeaRva,
                evidence.prefixLiteralRva)
            || !leaTargets(
                image,
                evidence.secondActionLeaRva,
                evidence.actionLiteralRva)
            || !literalAt(
                image,
                evidence.prefixLiteralRva,
                pair.prefix)
            || !literalAt(
                image,
                evidence.actionLiteralRva,
                pair.action)) {
            *failure =
                "TransformTool prefix/action vector evidence changed.";
            return false;
        }
    }
    if (!exportTableContainsRva(image, kRenderToolHelpThunkRva)
        || !nearJumpTargets(
            image,
            kRenderToolHelpThunkRva,
            kRenderToolHelpBodyRva)
        || !indirectCallTargets(
            image,
            kPaintPrefixCallRva,
            kPaintGeometryIatRva)
        || !indirectCallTargets(
            image,
            kPaintActionCallRva,
            kPaintGeometryIatRva)) {
        *failure = "renderToolHelp separate prefix/action paint contract changed.";
        return false;
    }
    return true;
}

} // namespace

bool verifyCavalryExtensionLayerTextPathContract(
    const std::vector<std::uint8_t> &image,
    std::string *failure)
{
    if (failure == nullptr || image.empty()) {
        return false;
    }
    if (!verifyMakePathBoundary(image, failure)
        || !verifyViewportBoundary(image, failure)
        || !verifyToolHelpBoundary(image, failure)) {
        return false;
    }
    return true;
}
