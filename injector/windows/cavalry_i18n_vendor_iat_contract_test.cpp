/**
 * [INPUT]: 依赖指定 Cavalry 安装根的 ExtensionLayer.dll/CavalryUI.dll/Core.dll/skia.dll 只读 PE 文件、PE/IAT 解析器与 text-path 静态合同分片
 * [OUTPUT]: 对外验证 Cavalry 2.7.2 的 helper IAT、CavalryUI 导出、placeholder setter 链、ExtensionLayer 调用点及 Core/Skia CJK Path ABI
 * [POS]: injector/windows 的 vendor 静态 ABI/import 合同；不加载、执行、修改或复制厂商 DLL，只把原始 PE 文件映射到测试内存
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_pe_iat.h"
#include "cavalry_i18n_extension_layer_sources.h"
#include "cavalry_i18n_vendor_skia_text_path_contract.h"
#include "cavalry_i18n_vendor_text_path_contract.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <algorithm>
#include <array>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <limits>
#include <string>
#include <string_view>
#include <vector>

namespace {

constexpr char kCavalryUiImportName[] = "CavalryUI.dll";
constexpr char kTextAtWidgetCentreSymbol[] =
    "?textAtWidgetCentre@ui@@YAXPEAVQWidget@@AEBVQString@@AEBVQColor@@PEBVQPixmap@@@Z";
constexpr char kSetPlaceholderSymbol[] =
    "?setPlaceholder@CustomListWidget@cavalry@@QEAAXAEBVQString@@@Z";
constexpr std::size_t kExpectedTextAtWidgetCentreIatRva = 0x01B26D68;
constexpr std::size_t kExpectedQStringAssignmentIatRva = 0x01B2C860;
constexpr std::uintptr_t kExpectedQStringAssignmentNameRva = 0x01B7CBD2;
constexpr std::size_t kSetPlaceholderThunkRva = 0x00015A87;
constexpr std::size_t kSetPlaceholderSetterRva = 0x002759F0;
constexpr std::size_t kSnippetPlaceholderCallRva = 0x010E118A;
constexpr std::size_t kExpectedSetPlaceholderDirectCallCount = 20;
constexpr std::size_t kMaximumMappedImageSize = 256U * 1024U * 1024U;
constexpr std::array<std::uint8_t, 15> kSetPlaceholderSetterPrologue {{
    0xB8, 0xA8, 0x00, 0x00, 0x00,
    0x48, 0x03, 0x81, 0x90, 0x01, 0x00, 0x00,
    0x48, 0x89, 0xC1,
}};

bool hasBytes(std::size_t size, std::size_t offset, std::size_t length)
{
    return offset <= size && length <= size - offset;
}

bool addSize(std::size_t left, std::size_t right, std::size_t *result)
{
    if (result == nullptr || left > std::numeric_limits<std::size_t>::max() - right) {
        return false;
    }
    *result = left + right;
    return true;
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

bool readU16(
    const std::vector<std::uint8_t> &image,
    std::size_t offset,
    std::uint16_t *value)
{
    if (value == nullptr || !hasBytes(image.size(), offset, sizeof(std::uint16_t))) {
        return false;
    }
    *value = static_cast<std::uint16_t>(image[offset])
        | (static_cast<std::uint16_t>(image[offset + 1]) << 8U);
    return true;
}

bool readU32(
    const std::vector<std::uint8_t> &image,
    std::size_t offset,
    std::uint32_t *value)
{
    if (value == nullptr || !hasBytes(image.size(), offset, sizeof(std::uint32_t))) {
        return false;
    }
    *value = static_cast<std::uint32_t>(image[offset])
        | (static_cast<std::uint32_t>(image[offset + 1]) << 8U)
        | (static_cast<std::uint32_t>(image[offset + 2]) << 16U)
        | (static_cast<std::uint32_t>(image[offset + 3]) << 24U);
    return true;
}

bool readI32(
    const std::vector<std::uint8_t> &image,
    std::size_t offset,
    std::int32_t *value)
{
    if (value == nullptr || !hasBytes(image.size(), offset, sizeof(std::int32_t))) {
        return false;
    }
    std::memcpy(value, image.data() + offset, sizeof(*value));
    return true;
}

bool asciiEquals(
    const std::vector<std::uint8_t> &image,
    std::size_t offset,
    std::string_view expected)
{
    if (!hasBytes(image.size(), offset, expected.size() + 1)) {
        return false;
    }
    for (std::size_t index = 0; index < expected.size(); ++index) {
        if (image[offset + index]
            != static_cast<std::uint8_t>(expected[index])) {
            return false;
        }
    }
    return image[offset + expected.size()] == '\0';
}

bool hasNulTerminatedAsciiLiteral(
    const std::vector<std::uint8_t> &image,
    std::string_view expected)
{
    if (expected.empty() || image.size() <= expected.size()) {
        return false;
    }

    const auto found = std::search(
        image.begin(),
        image.end(),
        expected.begin(),
        expected.end());
    return found != image.end()
        && static_cast<std::size_t>(image.end() - found) > expected.size()
        && *(found + expected.size()) == '\0';
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
        *failure = "Cannot open vendor binary.";
        return false;
    }
    const std::streamsize length = input.tellg();
    if (length <= 0) {
        *failure = "Vendor binary is empty or unreadable.";
        return false;
    }
    if (static_cast<unsigned long long>(length) > kMaximumMappedImageSize) {
        *failure = "Vendor binary exceeds the static-contract size limit.";
        return false;
    }

    raw->resize(static_cast<std::size_t>(length));
    input.seekg(0, std::ios::beg);
    if (!input.read(
            reinterpret_cast<char *>(raw->data()),
            static_cast<std::streamsize>(raw->size()))) {
        *failure = "Cannot read vendor binary.";
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
    if (!readRawFile(path, &raw, failure)) {
        return false;
    }

    IMAGE_DOS_HEADER dosHeader {};
    if (!readObject(raw, 0, &dosHeader)
        || dosHeader.e_magic != IMAGE_DOS_SIGNATURE || dosHeader.e_lfanew < 0) {
        *failure = "Vendor binary has an invalid DOS header.";
        return false;
    }

    const std::size_t ntOffset = static_cast<std::size_t>(dosHeader.e_lfanew);
    std::uint32_t ntSignature = 0;
    IMAGE_FILE_HEADER fileHeader {};
    if (!readU32(raw, ntOffset, &ntSignature)
        || ntSignature != IMAGE_NT_SIGNATURE
        || !readObject(raw, ntOffset + sizeof(ntSignature), &fileHeader)
        || fileHeader.Machine != IMAGE_FILE_MACHINE_AMD64
        || fileHeader.SizeOfOptionalHeader < sizeof(IMAGE_OPTIONAL_HEADER64)) {
        *failure = "Vendor binary is not a supported PE64 image.";
        return false;
    }

    std::size_t optionalHeaderOffset = 0;
    if (!addSize(ntOffset, sizeof(ntSignature) + sizeof(fileHeader), &optionalHeaderOffset)) {
        *failure = "Vendor binary header offset overflows.";
        return false;
    }
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    if (!readObject(raw, optionalHeaderOffset, &optionalHeader)
        || optionalHeader.Magic != IMAGE_NT_OPTIONAL_HDR64_MAGIC
        || optionalHeader.SizeOfImage == 0
        || optionalHeader.SizeOfImage > kMaximumMappedImageSize
        || optionalHeader.SizeOfHeaders == 0
        || optionalHeader.SizeOfHeaders > optionalHeader.SizeOfImage
        || !hasBytes(raw.size(), 0, optionalHeader.SizeOfHeaders)) {
        *failure = "Vendor binary has invalid PE64 image/header sizes.";
        return false;
    }

    std::size_t sectionTableOffset = 0;
    if (!addSize(
            optionalHeaderOffset,
            static_cast<std::size_t>(fileHeader.SizeOfOptionalHeader),
            &sectionTableOffset)
        || !hasBytes(
            raw.size(),
            sectionTableOffset,
            static_cast<std::size_t>(fileHeader.NumberOfSections)
                * sizeof(IMAGE_SECTION_HEADER))) {
        *failure = "Vendor binary has an invalid PE section table.";
        return false;
    }

    mapped->assign(optionalHeader.SizeOfImage, 0);
    std::copy_n(
        raw.data(),
        optionalHeader.SizeOfHeaders,
        mapped->data());

    for (std::size_t index = 0; index < fileHeader.NumberOfSections; ++index) {
        IMAGE_SECTION_HEADER section {};
        const std::size_t sectionOffset =
            sectionTableOffset + index * sizeof(IMAGE_SECTION_HEADER);
        if (!readObject(raw, sectionOffset, &section)) {
            *failure = "Vendor binary section header is truncated.";
            return false;
        }

        const std::size_t virtualAddress = section.VirtualAddress;
        const std::size_t virtualSize = section.Misc.VirtualSize;
        const std::size_t rawSize = section.SizeOfRawData;
        const std::size_t rawOffset = section.PointerToRawData;
        const std::size_t sectionSpan = std::max(virtualSize, rawSize);
        if (!hasBytes(mapped->size(), virtualAddress, sectionSpan)
            || (rawSize != 0 && !hasBytes(raw.size(), rawOffset, rawSize))
            || (rawSize != 0 && !hasBytes(mapped->size(), virtualAddress, rawSize))) {
            *failure = "Vendor binary section range is invalid.";
            return false;
        }
        if (rawSize != 0) {
            std::copy_n(
                raw.data() + rawOffset,
                rawSize,
                mapped->data() + virtualAddress);
        }
    }

    return true;
}

bool hasNamedExport(
    const std::vector<std::uint8_t> &image,
    std::string_view expectedName,
    std::string *failure)
{
    IMAGE_DOS_HEADER dosHeader {};
    if (!readObject(image, 0, &dosHeader) || dosHeader.e_lfanew < 0) {
        *failure = "Mapped vendor image has an invalid DOS header.";
        return false;
    }
    const std::size_t ntOffset = static_cast<std::size_t>(dosHeader.e_lfanew);
    std::size_t optionalHeaderOffset = 0;
    if (!addSize(
            ntOffset,
            sizeof(std::uint32_t) + sizeof(IMAGE_FILE_HEADER),
            &optionalHeaderOffset)) {
        *failure = "Mapped vendor image header offset overflows.";
        return false;
    }

    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    if (!readObject(image, optionalHeaderOffset, &optionalHeader)
        || optionalHeader.NumberOfRvaAndSizes <= IMAGE_DIRECTORY_ENTRY_EXPORT) {
        *failure = "Mapped vendor image has no export directory.";
        return false;
    }
    const IMAGE_DATA_DIRECTORY exportDirectory =
        optionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
    if (exportDirectory.VirtualAddress == 0
        || exportDirectory.Size < sizeof(IMAGE_EXPORT_DIRECTORY)
        || !hasBytes(
            image.size(),
            exportDirectory.VirtualAddress,
            sizeof(IMAGE_EXPORT_DIRECTORY))) {
        *failure = "Mapped vendor image export directory is invalid.";
        return false;
    }

    IMAGE_EXPORT_DIRECTORY exports {};
    if (!readObject(image, exportDirectory.VirtualAddress, &exports)
        || exports.NumberOfNames == 0 || exports.NumberOfFunctions == 0
        || !hasBytes(
            image.size(),
            exports.AddressOfNames,
            static_cast<std::size_t>(exports.NumberOfNames) * sizeof(std::uint32_t))
        || !hasBytes(
            image.size(),
            exports.AddressOfNameOrdinals,
            static_cast<std::size_t>(exports.NumberOfNames) * sizeof(std::uint16_t))
        || !hasBytes(
            image.size(),
            exports.AddressOfFunctions,
            static_cast<std::size_t>(exports.NumberOfFunctions) * sizeof(std::uint32_t))) {
        *failure = "Mapped vendor image export table is invalid.";
        return false;
    }

    for (std::size_t index = 0; index < exports.NumberOfNames; ++index) {
        std::uint32_t nameRva = 0;
        std::uint16_t ordinal = 0;
        if (!readU32(
                image,
                exports.AddressOfNames + index * sizeof(nameRva),
                &nameRva)
            || !readU16(
                image,
                exports.AddressOfNameOrdinals + index * sizeof(ordinal),
                &ordinal)
            || ordinal >= exports.NumberOfFunctions) {
            *failure = "Mapped vendor image export name entry is invalid.";
            return false;
        }
        if (!asciiEquals(image, nameRva, expectedName)) {
            continue;
        }

        std::uint32_t functionRva = 0;
        if (!readU32(
                image,
                exports.AddressOfFunctions
                    + static_cast<std::size_t>(ordinal) * sizeof(functionRva),
                &functionRva)
            || functionRva == 0) {
            *failure = "Expected vendor export has no function RVA.";
            return false;
        }
        return true;
    }

    *failure = "Expected decorated export is absent.";
    return false;
}

bool imageSectionTable(
    const std::vector<std::uint8_t> &image,
    std::size_t *sectionTableOffset,
    std::uint16_t *sectionCount,
    std::string *failure)
{
    if (sectionTableOffset == nullptr || sectionCount == nullptr || failure == nullptr) {
        return false;
    }

    IMAGE_DOS_HEADER dosHeader {};
    if (!readObject(image, 0, &dosHeader)
        || dosHeader.e_magic != IMAGE_DOS_SIGNATURE || dosHeader.e_lfanew < 0) {
        *failure = "Mapped vendor image has an invalid DOS header.";
        return false;
    }
    const std::size_t ntOffset = static_cast<std::size_t>(dosHeader.e_lfanew);
    std::uint32_t signature = 0;
    IMAGE_FILE_HEADER fileHeader {};
    if (!readU32(image, ntOffset, &signature)
        || signature != IMAGE_NT_SIGNATURE
        || !readObject(image, ntOffset + sizeof(signature), &fileHeader)) {
        *failure = "Mapped vendor image has an invalid NT header.";
        return false;
    }

    std::size_t optionalHeaderOffset = 0;
    if (!addSize(
            ntOffset,
            sizeof(signature) + sizeof(fileHeader),
            &optionalHeaderOffset)
        || !addSize(
            optionalHeaderOffset,
            static_cast<std::size_t>(fileHeader.SizeOfOptionalHeader),
            sectionTableOffset)
        || !hasBytes(
            image.size(),
            *sectionTableOffset,
            static_cast<std::size_t>(fileHeader.NumberOfSections)
                * sizeof(IMAGE_SECTION_HEADER))) {
        *failure = "Mapped vendor image has an invalid section table.";
        return false;
    }

    *sectionCount = fileHeader.NumberOfSections;
    return true;
}

bool directNearCallTargetsRva(
    const std::vector<std::uint8_t> &image,
    std::size_t callRva,
    std::size_t expectedTargetRva)
{
    if (!hasBytes(image.size(), callRva, 5) || image[callRva] != 0xE8) {
        return false;
    }

    std::int32_t displacement = 0;
    if (!readI32(image, callRva + 1, &displacement)) {
        return false;
    }
    const std::int64_t target =
        static_cast<std::int64_t>(callRva) + 5 + displacement;
    return target == static_cast<std::int64_t>(expectedTargetRva);
}

bool nearJumpTargetsRva(
    const std::vector<std::uint8_t> &image,
    std::size_t jumpRva,
    std::size_t expectedTargetRva)
{
    if (!hasBytes(image.size(), jumpRva, 5) || image[jumpRva] != 0xE9) {
        return false;
    }

    std::int32_t displacement = 0;
    if (!readI32(image, jumpRva + 1, &displacement)) {
        return false;
    }
    const std::int64_t target =
        static_cast<std::int64_t>(jumpRva) + 5 + displacement;
    return target == static_cast<std::int64_t>(expectedTargetRva);
}

bool countDirectNearCallsToRva(
    const std::vector<std::uint8_t> &image,
    std::size_t expectedTargetRva,
    std::size_t *count,
    std::string *failure)
{
    if (count == nullptr || failure == nullptr) {
        return false;
    }

    std::size_t sectionTableOffset = 0;
    std::uint16_t sectionCount = 0;
    if (!imageSectionTable(image, &sectionTableOffset, &sectionCount, failure)) {
        return false;
    }

    std::size_t result = 0;
    for (std::size_t index = 0; index < sectionCount; ++index) {
        IMAGE_SECTION_HEADER section {};
        const std::size_t sectionOffset =
            sectionTableOffset + index * sizeof(IMAGE_SECTION_HEADER);
        if (!readObject(image, sectionOffset, &section)) {
            *failure = "Mapped vendor image executable section is truncated.";
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
            *failure = "Mapped vendor executable section range is invalid.";
            return false;
        }

        for (std::size_t offset = 0; offset + 5 <= sectionSize; ++offset) {
            if (directNearCallTargetsRva(
                    image,
                    sectionRva + offset,
                    expectedTargetRva)) {
                ++result;
            }
        }
    }

    *count = result;
    return true;
}

bool verifySetPlaceholderContract(
    const std::vector<std::uint8_t> &image,
    std::string *failure)
{
    if (!nearJumpTargetsRva(
            image,
            kSetPlaceholderThunkRva,
            kSetPlaceholderSetterRva)) {
        *failure = "setPlaceholder export thunk is not the canonical direct jump.";
        return false;
    }
    if (!hasBytes(
            image.size(),
            kSetPlaceholderSetterRva,
            kSetPlaceholderSetterPrologue.size() + 7)
        || std::memcmp(
               image.data() + kSetPlaceholderSetterRva,
               kSetPlaceholderSetterPrologue.data(),
               kSetPlaceholderSetterPrologue.size())
            != 0) {
        *failure = "setPlaceholder setter prologue differs from the Cavalry 2.7.2 ABI contract.";
        return false;
    }

    const std::size_t tailJumpRva =
        kSetPlaceholderSetterRva + kSetPlaceholderSetterPrologue.size();
    if (image[tailJumpRva] != 0x48 || image[tailJumpRva + 1] != 0xFF
        || image[tailJumpRva + 2] != 0x25) {
        *failure = "setPlaceholder setter does not tail-jump through the canonical assignment slot.";
        return false;
    }
    std::int32_t slotDisplacement = 0;
    if (!readI32(image, tailJumpRva + 3, &slotDisplacement)) {
        *failure = "setPlaceholder setter tail jump is truncated.";
        return false;
    }
    const std::int64_t slotRva =
        static_cast<std::int64_t>(tailJumpRva) + 7 + slotDisplacement;
    if (slotRva != static_cast<std::int64_t>(kExpectedQStringAssignmentIatRva)) {
        *failure = "setPlaceholder setter does not resolve to the canonical QString assignment slot RVA.";
        return false;
    }
    if (!hasBytes(
            image.size(),
            kExpectedQStringAssignmentIatRva,
            sizeof(kExpectedQStringAssignmentNameRva))) {
        *failure = "setPlaceholder QString assignment slot is truncated.";
        return false;
    }
    std::uintptr_t assignmentNameRva = 0;
    std::memcpy(
        &assignmentNameRva,
        image.data() + kExpectedQStringAssignmentIatRva,
        sizeof(assignmentNameRva));
    if (assignmentNameRva != kExpectedQStringAssignmentNameRva) {
        *failure = "setPlaceholder QString assignment slot does not start as the canonical import-by-name RVA.";
        return false;
    }

    std::size_t directCallCount = 0;
    if (!countDirectNearCallsToRva(
            image,
            kSetPlaceholderThunkRva,
            &directCallCount,
            failure)) {
        return false;
    }
    if (directCallCount != kExpectedSetPlaceholderDirectCallCount) {
        *failure = "setPlaceholder direct-call count differs from the Cavalry 2.7.2 contract.";
        return false;
    }
    if (!directNearCallTargetsRva(
            image,
            kSnippetPlaceholderCallRva,
            kSetPlaceholderThunkRva)) {
        *failure = "Snippet source no longer reaches the canonical setPlaceholder export by a direct call.";
        return false;
    }
    return true;
}

bool verifyPlaceholderSourceLiterals(
    const std::vector<std::uint8_t> &image,
    std::string *failure)
{
    for (const char *source
         : cavalry_i18n::extension_layer_contract::kStaticPlaceholderSources) {
        if (!hasNulTerminatedAsciiLiteral(image, source)) {
            *failure = std::string("ExtensionLayer is missing an approved placeholder literal: ")
                + source;
            return false;
        }
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
    if (argc != 5) {
        fail("Usage: cavalryi18n_vendor_iat_contract_test <ExtensionLayer.dll> <CavalryUI.dll> <Core.dll> <skia.dll>");
        return 1;
    }

    const std::filesystem::path extensionLayerPath = argv[1];
    const std::filesystem::path cavalryUiPath = argv[2];
    const std::filesystem::path corePath = argv[3];
    const std::filesystem::path skiaPath = argv[4];
    std::string failure;
    std::vector<std::uint8_t> extensionLayerImage;
    if (!mapRawPeImage(extensionLayerPath, &extensionLayerImage, &failure)) {
        fail("ExtensionLayer vendor contract: " + failure);
        return 1;
    }
    if (!hasNamedExport(extensionLayerImage, kSetPlaceholderSymbol, &failure)) {
        fail("ExtensionLayer placeholder export contract: " + failure);
        return 1;
    }
    if (!verifySetPlaceholderContract(extensionLayerImage, &failure)) {
        fail("ExtensionLayer placeholder ABI contract: " + failure);
        return 1;
    }
    if (!verifyPlaceholderSourceLiterals(extensionLayerImage, &failure)) {
        fail("ExtensionLayer placeholder source contract: " + failure);
        return 1;
    }
    if (!verifyCavalryExtensionLayerTextPathContract(
            extensionLayerImage,
            &failure)) {
        fail("ExtensionLayer text-path contract: " + failure);
        return 1;
    }

    const CavalryPeIatLookupResult lookup = findCavalryPe64IatSlot(
        extensionLayerImage.data(),
        extensionLayerImage.size(),
        kCavalryUiImportName,
        kTextAtWidgetCentreSymbol);
    if (lookup.status != CavalryPeIatLookupStatus::Found) {
        fail(
            std::string("ExtensionLayer import contract: expected one exact IAT slot, got ")
            + cavalryPeIatLookupStatusName(lookup.status)
            + ".");
        return 1;
    }
    if (lookup.iatSlotOffset != kExpectedTextAtWidgetCentreIatRva) {
        char message[256] {};
        std::snprintf(
            message,
            sizeof(message),
            "ExtensionLayer import contract: expected IAT RVA 0x%zx, got 0x%zx.",
            kExpectedTextAtWidgetCentreIatRva,
            lookup.iatSlotOffset);
        fail(message);
        return 1;
    }

    std::vector<std::uint8_t> cavalryUiImage;
    if (!mapRawPeImage(cavalryUiPath, &cavalryUiImage, &failure)) {
        fail("CavalryUI vendor contract: " + failure);
        return 1;
    }
    if (!hasNamedExport(cavalryUiImage, kTextAtWidgetCentreSymbol, &failure)) {
        fail("CavalryUI export contract: " + failure);
        return 1;
    }

    std::vector<std::uint8_t> coreImage;
    std::vector<std::uint8_t> skiaImage;
    if (!mapRawPeImage(corePath, &coreImage, &failure)) {
        fail("Core vendor contract: " + failure);
        return 1;
    }
    if (!mapRawPeImage(skiaPath, &skiaImage, &failure)) {
        fail("Skia vendor contract: " + failure);
        return 1;
    }
    if (!verifyCavalryCoreSkiaTextPathContract(
            coreImage,
            skiaImage,
            &failure)) {
        fail("Core/Skia CJK text-path contract: " + failure);
        return 1;
    }

    std::puts("Cavalry vendor helper, placeholder, ExtensionLayer, and Core/Skia CJK text-path contracts passed.");
    return 0;
}
