/**
 * [INPUT]: Cavalry 2.7.2 的 ExtensionLayer/Core/skia 映射 PE 镜像，以及时间轴字体 ABI 合同
 * [OUTPUT]: 锁定真实 vendor 正例，并证明 image identity、导出跳板、helper hash、两条精确 callsite、IAT slot 与 SkFont 边界漂移都会 fail-closed
 * [POS]: injector/windows 时间轴字体 fallback 的只读 vendor 合同测试；不加载、执行或修改厂商 DLL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <limits>
#include <string>
#include <vector>

#if __has_include("cavalry_i18n_timeline_font_contract.h")
#include "cavalry_i18n_timeline_font_contract.h"
#else
// RED stub: missing implementation must reject the real vendor positive case.
bool verifyCavalryTimelineFontContract(
    const std::vector<std::uint8_t> &,
    const std::vector<std::uint8_t> &,
    const std::vector<std::uint8_t> &,
    std::string *failure)
{
    if (failure != nullptr) {
        *failure = "timeline font vendor contract implementation is missing";
    }
    return false;
}
#endif

namespace {

constexpr std::size_t kMaximumMappedImageSize = 128U * 1024U * 1024U;

bool hasBytes(std::size_t size, std::size_t offset, std::size_t length)
{
    return offset <= size && length <= size - offset;
}

template <typename Value>
bool readObject(
    const std::vector<std::uint8_t> &bytes,
    std::size_t offset,
    Value *value)
{
    if (value == nullptr || !hasBytes(bytes.size(), offset, sizeof(Value))) {
        return false;
    }
    std::memcpy(value, bytes.data() + offset, sizeof(Value));
    return true;
}

template <typename Value>
bool writeObject(
    std::vector<std::uint8_t> *bytes,
    std::size_t offset,
    const Value &value)
{
    if (bytes == nullptr || !hasBytes(bytes->size(), offset, sizeof(Value))) {
        return false;
    }
    std::memcpy(bytes->data() + offset, &value, sizeof(Value));
    return true;
}

bool readRawFile(
    const std::filesystem::path &path,
    std::vector<std::uint8_t> *raw,
    std::string *failure)
{
    if (raw == nullptr || failure == nullptr) {
        return false;
    }
    std::ifstream input(path, std::ios::binary | std::ios::ate);
    if (!input) {
        *failure = "Cannot open vendor binary: " + path.string();
        return false;
    }
    const std::streamsize length = input.tellg();
    if (length <= 0
        || static_cast<unsigned long long>(length)
            > kMaximumMappedImageSize) {
        *failure = "Vendor binary is empty or exceeds the test size limit.";
        return false;
    }
    raw->resize(static_cast<std::size_t>(length));
    input.seekg(0, std::ios::beg);
    if (!input.read(
            reinterpret_cast<char *>(raw->data()),
            static_cast<std::streamsize>(raw->size()))) {
        *failure = "Cannot read vendor binary: " + path.string();
        return false;
    }
    return true;
}

bool mapRawPeImage(
    const std::filesystem::path &path,
    std::vector<std::uint8_t> *mapped,
    std::string *failure)
{
    std::vector<std::uint8_t> raw;
    if (mapped == nullptr || failure == nullptr
        || !readRawFile(path, &raw, failure)) {
        return false;
    }

    IMAGE_DOS_HEADER dos {};
    if (!readObject(raw, 0, &dos)
        || dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0) {
        *failure = "Vendor binary has no valid DOS header.";
        return false;
    }

    const std::size_t ntOffset = static_cast<std::size_t>(dos.e_lfanew);
    std::uint32_t signature = 0;
    IMAGE_FILE_HEADER fileHeader {};
    const std::size_t optionalOffset =
        ntOffset + sizeof(signature) + sizeof(fileHeader);
    if (!readObject(raw, ntOffset, &signature)
        || signature != IMAGE_NT_SIGNATURE
        || !readObject(raw, ntOffset + sizeof(signature), &fileHeader)
        || fileHeader.Machine != IMAGE_FILE_MACHINE_AMD64
        || fileHeader.SizeOfOptionalHeader < sizeof(IMAGE_OPTIONAL_HEADER64)) {
        *failure = "Vendor binary is not a supported PE64 image.";
        return false;
    }

    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    if (!readObject(raw, optionalOffset, &optionalHeader)
        || optionalHeader.Magic != IMAGE_NT_OPTIONAL_HDR64_MAGIC
        || optionalHeader.SizeOfImage == 0
        || optionalHeader.SizeOfImage > kMaximumMappedImageSize
        || optionalHeader.SizeOfHeaders == 0
        || optionalHeader.SizeOfHeaders > optionalHeader.SizeOfImage
        || !hasBytes(raw.size(), 0, optionalHeader.SizeOfHeaders)) {
        *failure = "Vendor binary has invalid PE64 image sizes.";
        return false;
    }

    const std::size_t sectionTable =
        optionalOffset + fileHeader.SizeOfOptionalHeader;
    const std::size_t sectionTableBytes =
        static_cast<std::size_t>(fileHeader.NumberOfSections)
        * sizeof(IMAGE_SECTION_HEADER);
    if (!hasBytes(raw.size(), sectionTable, sectionTableBytes)) {
        *failure = "Vendor binary section table is truncated.";
        return false;
    }

    mapped->assign(optionalHeader.SizeOfImage, 0);
    std::copy_n(
        raw.data(),
        optionalHeader.SizeOfHeaders,
        mapped->data());
    for (std::size_t index = 0; index < fileHeader.NumberOfSections; ++index) {
        IMAGE_SECTION_HEADER section {};
        if (!readObject(
                raw,
                sectionTable + index * sizeof(section),
                &section)) {
            *failure = "Vendor binary section header is truncated.";
            return false;
        }
        const std::size_t virtualAddress = section.VirtualAddress;
        const std::size_t virtualSize = section.Misc.VirtualSize;
        const std::size_t rawSize = section.SizeOfRawData;
        const std::size_t span = std::max(virtualSize, rawSize);
        if (!hasBytes(mapped->size(), virtualAddress, span)
            || (rawSize != 0 && !hasBytes(raw.size(), section.PointerToRawData, rawSize))
            || (rawSize != 0 && !hasBytes(mapped->size(), virtualAddress, rawSize))) {
            *failure = "Vendor binary section range is invalid.";
            return false;
        }
        if (rawSize != 0) {
            std::copy_n(
                raw.data() + section.PointerToRawData,
                rawSize,
                mapped->data() + virtualAddress);
        }
    }
    return true;
}

bool readPeHeaderOffsets(
    const std::vector<std::uint8_t> &image,
    std::size_t *timestampOffset,
    std::size_t *imageSizeOffset)
{
    IMAGE_DOS_HEADER dos {};
    if (timestampOffset == nullptr || imageSizeOffset == nullptr
        || !readObject(image, 0, &dos)
        || dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0) {
        return false;
    }
    const std::size_t ntOffset = static_cast<std::size_t>(dos.e_lfanew);
    const std::size_t fileHeaderOffset = ntOffset + sizeof(std::uint32_t);
    const std::size_t optionalOffset =
        fileHeaderOffset + sizeof(IMAGE_FILE_HEADER);
    *timestampOffset =
        fileHeaderOffset + offsetof(IMAGE_FILE_HEADER, TimeDateStamp);
    *imageSizeOffset =
        optionalOffset + offsetof(IMAGE_OPTIONAL_HEADER64, SizeOfImage);
    return hasBytes(image.size(), *timestampOffset, sizeof(std::uint32_t))
        && hasBytes(image.size(), *imageSizeOffset, sizeof(std::uint32_t));
}

bool writeRelativeTarget(
    std::vector<std::uint8_t> *image,
    std::size_t instructionRva,
    std::size_t instructionSize,
    std::size_t displacementOffset,
    std::size_t targetRva)
{
    if (image == nullptr
        || displacementOffset > instructionSize
        || sizeof(std::int32_t) > instructionSize - displacementOffset
        || !hasBytes(image->size(), instructionRva, instructionSize)
        || !hasBytes(
               image->size(),
               instructionRva + displacementOffset,
               sizeof(std::int32_t))
        || targetRva > static_cast<std::size_t>(
               std::numeric_limits<std::int64_t>::max())) {
        return false;
    }
    const std::int64_t displacement =
        static_cast<std::int64_t>(targetRva)
        - static_cast<std::int64_t>(instructionRva + instructionSize);
    if (displacement < std::numeric_limits<std::int32_t>::min()
        || displacement > std::numeric_limits<std::int32_t>::max()) {
        return false;
    }
    const auto encoded = static_cast<std::int32_t>(displacement);
    return writeObject(image, instructionRva + displacementOffset, encoded);
}

bool expectAccepted(
    const std::vector<std::uint8_t> &extensionLayer,
    const std::vector<std::uint8_t> &core,
    const std::vector<std::uint8_t> &skia,
    const char *scenario)
{
    std::string failure;
    CavalryTimelineFontContractEvidence evidence;
    const void *expectedMeasureExport = nullptr;
    const void *expectedDrawExport = nullptr;
    if (!verifyCavalryTimelineFontContract(
            extensionLayer,
            core,
            skia,
            &failure)
        || !verifyCavalryTimelineFontContract(
            extensionLayer.data(),
            extensionLayer.size(),
            core.data(),
            core.size(),
            skia.data(),
            skia.size(),
            &evidence,
            &failure)
        || evidence.extensionLayerBase != extensionLayer.data()
        || evidence.extensionLayerImageSize != extensionLayer.size()
        || evidence.skiaBase != skia.data()
        || evidence.skiaImageSize != skia.size()
        || evidence.measureTextIatRva != 0x01B32030U
        || evidence.drawSimpleTextIatRva != 0x01B32018U
        || evidence.measureTextExportRva != 0x000561C0U
        || evidence.drawSimpleTextExportRva != 0x00035750U
        || evidence.measureTextReturnRva != 0x0086F4A4U
        || evidence.drawSimpleTextReturnRva != 0x0086F9ACU
        || evidence.helperBeginRva != 0x0086F300U
        || evidence.helperEndRva != 0x0086FA1BU
        || evidence.measureTextExportRva >= evidence.skiaImageSize
        || evidence.drawSimpleTextExportRva >= evidence.skiaImageSize) {
        std::fprintf(
            stderr,
            "%s: no-copy runtime evidence rejected the vendor image: %s\n",
            scenario,
            failure.c_str());
        return false;
    }
    expectedMeasureExport = evidence.skiaBase + evidence.measureTextExportRva;
    expectedDrawExport = evidence.skiaBase + evidence.drawSimpleTextExportRva;
    if (!verifyCavalryTimelineFontResolvedSkiaTargets(
            evidence,
            expectedMeasureExport,
            expectedDrawExport,
            &failure)) {
        std::fprintf(
            stderr,
            "%s: resolved skia export pointers were rejected: %s\n",
            scenario,
            failure.c_str());
        return false;
    }
    const void *wrongMeasureExport =
        static_cast<const void *>(
            static_cast<const std::uint8_t *>(expectedMeasureExport) + 1);
    if (verifyCavalryTimelineFontResolvedSkiaTargets(
            evidence,
            wrongMeasureExport,
            expectedDrawExport,
            &failure)) {
        std::fprintf(
            stderr,
            "%s: resolved skia export pointer drift was accepted\n",
            scenario);
        return false;
    }
    return true;
}

bool expectRejected(
    const std::vector<std::uint8_t> &extensionLayer,
    const std::vector<std::uint8_t> &core,
    const std::vector<std::uint8_t> &skia,
    const char *scenario)
{
    std::string failure;
    if (!verifyCavalryTimelineFontContract(
            extensionLayer,
            core,
            skia,
            &failure)
        && !failure.empty()) {
        return true;
    }
    std::fprintf(
        stderr,
        "%s: expected fail-closed rejection.\n",
        scenario);
    return false;
}

bool runNegativeContracts(
    const std::vector<std::uint8_t> &extensionLayer,
    const std::vector<std::uint8_t> &core,
    const std::vector<std::uint8_t> &skia)
{
    std::size_t timestampOffset = 0;
    std::size_t imageSizeOffset = 0;
    if (!readPeHeaderOffsets(
            extensionLayer,
            &timestampOffset,
            &imageSizeOffset)) {
        std::fprintf(stderr, "Cannot locate ExtensionLayer identity fields.\n");
        return false;
    }

    auto driftedExtension = extensionLayer;
    std::uint32_t timestamp = 0;
    if (!readObject(extensionLayer, timestampOffset, &timestamp)
        || !writeObject(
               &driftedExtension,
               timestampOffset,
               timestamp ^ static_cast<std::uint32_t>(1))) {
        return false;
    }
    if (!expectRejected(
            driftedExtension,
            core,
            skia,
            "ExtensionLayer timestamp drift")) {
        return false;
    }

    driftedExtension = extensionLayer;
    std::uint32_t imageSize = 0;
    if (!readObject(extensionLayer, imageSizeOffset, &imageSize)
        || imageSize < 0x1000U
        || !writeObject(&driftedExtension, imageSizeOffset, imageSize - 0x1000U)
        || !expectRejected(
               driftedExtension,
               core,
               skia,
               "ExtensionLayer SizeOfImage drift")) {
        return false;
    }

    driftedExtension = extensionLayer;
    if (!writeRelativeTarget(
            &driftedExtension,
            0x00013700,
            5,
            1,
            0x0086D201)
        || !expectRejected(
               driftedExtension,
               core,
               skia,
               "paintNodeText export thunk retarget")) {
        return false;
    }

    driftedExtension = extensionLayer;
    driftedExtension[0x0086F320] ^= 0x01U;
    if (!expectRejected(
            driftedExtension,
            core,
            skia,
            "SkTimeEditorView helper byte drift")) {
        return false;
    }

    driftedExtension = extensionLayer;
    driftedExtension[0x0087006E] ^= 0x01U;
    if (!expectRejected(
            driftedExtension,
            core,
            skia,
            "SkFont layout writer drift")) {
        return false;
    }

    driftedExtension = extensionLayer;
    if (!writeRelativeTarget(
            &driftedExtension,
            0x0086F49E,
            6,
            2,
            0x01B32038)
        || !expectRejected(
               driftedExtension,
               core,
               skia,
               "measureText callsite retarget")) {
        return false;
    }

    driftedExtension = extensionLayer;
    if (!writeRelativeTarget(
            &driftedExtension,
            0x0086F9A6,
            6,
            2,
            0x01B32030)
        || !expectRejected(
               driftedExtension,
               core,
               skia,
               "drawSimpleText callsite retarget")) {
        return false;
    }

    auto driftedCore = core;
    if (!readPeHeaderOffsets(core, &timestampOffset, &imageSizeOffset)
        || !readObject(core, timestampOffset, &timestamp)
        || !writeObject(&driftedCore, timestampOffset, timestamp ^ 1U)
        || !expectRejected(
               extensionLayer,
               driftedCore,
               skia,
               "Core identity drift")) {
        return false;
    }

    auto driftedSkia = skia;
    if (!readPeHeaderOffsets(skia, &timestampOffset, &imageSizeOffset)
        || !readObject(skia, timestampOffset, &timestamp)
        || !writeObject(&driftedSkia, timestampOffset, timestamp ^ 1U)
        || !expectRejected(
               extensionLayer,
               core,
               driftedSkia,
               "skia identity drift")) {
        return false;
    }

    driftedSkia = skia;
    driftedSkia[0x000561C0U] ^= 0x01U;
    if (!expectRejected(
            extensionLayer,
            core,
            driftedSkia,
            "skia measureText body drift")) {
        return false;
    }

    driftedSkia = skia;
    driftedSkia[0x00035750U] ^= 0x01U;
    if (!expectRejected(
            extensionLayer,
            core,
            driftedSkia,
            "skia drawSimpleText body drift")) {
        return false;
    }
    return true;
}

void fail(const std::string &message)
{
    std::fprintf(stderr, "%s\n", message.c_str());
}

} // namespace

int main(int argc, char *argv[])
{
    if (argc != 4) {
        fail(
            "Usage: cavalryi18n_timeline_font_contract_test "
            "<ExtensionLayer.dll> <Core.dll> <skia.dll>");
        return 1;
    }

    std::vector<std::uint8_t> extensionLayer;
    std::vector<std::uint8_t> core;
    std::vector<std::uint8_t> skia;
    std::string failure;
    if (!mapRawPeImage(argv[1], &extensionLayer, &failure)
        || !mapRawPeImage(argv[2], &core, &failure)
        || !mapRawPeImage(argv[3], &skia, &failure)) {
        fail(failure);
        return 1;
    }
    if (!expectAccepted(
            extensionLayer,
            core,
            skia,
            "Cavalry 2.7.2 timeline font vendor image")) {
        return 1;
    }
    if (!runNegativeContracts(extensionLayer, core, skia)) {
        return 1;
    }
    std::puts(
        "Timeline font vendor contract and fail-closed negative cases passed.");
    return 0;
}
