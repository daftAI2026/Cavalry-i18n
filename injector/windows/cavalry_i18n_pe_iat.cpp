/**
 * [INPUT]: 依赖 cavalry_i18n_pe_iat.h 的 PE64/IAT 查询契约与标准 C++ 字节容器
 * [OUTPUT]: 对外实现边界检查的 import descriptor、INT 与 IAT 解析，不写入目标镜像
 * [POS]: injector/windows 的可测试 PE 纯函数实现；运行时 hook 仅消费其唯一槽位结果，所有不确定性均失败闭合
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_pe_iat.h"

#include <algorithm>
#include <limits>

namespace {

constexpr std::uint16_t kDosSignature = 0x5A4D;
constexpr std::uint32_t kNtSignature = 0x00004550;
constexpr std::uint16_t kMachineAmd64 = 0x8664;
constexpr std::uint16_t kPe32PlusMagic = 0x020B;
constexpr std::size_t kDosLfanewOffset = 0x3C;
constexpr std::size_t kCoffHeaderSize = 20;
constexpr std::size_t kOptionalHeaderMagicOffset = 0x00;
constexpr std::size_t kOptionalHeaderSizeOfImageOffset = 0x38;
constexpr std::size_t kOptionalHeaderNumberOfRvaAndSizesOffset = 0x6C;
constexpr std::size_t kOptionalHeaderDataDirectoryOffset = 0x70;
constexpr std::size_t kImportDirectoryIndex = 1;
constexpr std::size_t kDataDirectorySize = 8;
constexpr std::size_t kImportDescriptorSize = 20;
constexpr std::size_t kImportDescriptorOriginalFirstThunkOffset = 0;
constexpr std::size_t kImportDescriptorNameOffset = 12;
constexpr std::size_t kImportDescriptorFirstThunkOffset = 16;
constexpr std::uint64_t kImportByOrdinalFlag = 0x8000000000000000ULL;

bool hasBytes(std::size_t imageSize, std::size_t offset, std::size_t size)
{
    return offset <= imageSize && size <= imageSize - offset;
}

bool readU16(
    const std::uint8_t *image,
    std::size_t imageSize,
    std::size_t offset,
    std::uint16_t *value)
{
    if (value == nullptr || !hasBytes(imageSize, offset, 2)) {
        return false;
    }

    *value = static_cast<std::uint16_t>(image[offset])
        | (static_cast<std::uint16_t>(image[offset + 1]) << 8U);
    return true;
}

bool readU32(
    const std::uint8_t *image,
    std::size_t imageSize,
    std::size_t offset,
    std::uint32_t *value)
{
    if (value == nullptr || !hasBytes(imageSize, offset, 4)) {
        return false;
    }

    *value = static_cast<std::uint32_t>(image[offset])
        | (static_cast<std::uint32_t>(image[offset + 1]) << 8U)
        | (static_cast<std::uint32_t>(image[offset + 2]) << 16U)
        | (static_cast<std::uint32_t>(image[offset + 3]) << 24U);
    return true;
}

bool readU64(
    const std::uint8_t *image,
    std::size_t imageSize,
    std::size_t offset,
    std::uint64_t *value)
{
    if (value == nullptr || !hasBytes(imageSize, offset, 8)) {
        return false;
    }

    std::uint64_t result = 0;
    for (std::size_t index = 0; index < 8; ++index) {
        result |= static_cast<std::uint64_t>(image[offset + index])
            << (index * 8U);
    }
    *value = result;
    return true;
}

bool addSize(std::size_t left, std::size_t right, std::size_t *sum)
{
    if (sum == nullptr || left > std::numeric_limits<std::size_t>::max() - right) {
        return false;
    }

    *sum = left + right;
    return true;
}

bool asciiEquals(
    const std::uint8_t *image,
    std::size_t imageSize,
    std::size_t offset,
    std::string_view expected,
    bool caseInsensitive)
{
    if (expected.empty() || !hasBytes(imageSize, offset, expected.size() + 1)) {
        return false;
    }

    for (std::size_t index = 0; index < expected.size(); ++index) {
        unsigned char actual = image[offset + index];
        unsigned char wanted = static_cast<unsigned char>(expected[index]);
        if (caseInsensitive) {
            if (actual >= 'A' && actual <= 'Z') {
                actual = static_cast<unsigned char>(actual - 'A' + 'a');
            }
            if (wanted >= 'A' && wanted <= 'Z') {
                wanted = static_cast<unsigned char>(wanted - 'A' + 'a');
            }
        }
        if (actual != wanted) {
            return false;
        }
    }

    return image[offset + expected.size()] == '\0';
}

bool isZeroImportDescriptor(
    const std::uint8_t *image,
    std::size_t imageSize,
    std::size_t offset)
{
    if (!hasBytes(imageSize, offset, kImportDescriptorSize)) {
        return false;
    }

    return std::all_of(
        image + offset,
        image + offset + kImportDescriptorSize,
        [](std::uint8_t value) { return value == 0; });
}

} // namespace

CavalryPeIatLookupResult findCavalryPe64IatSlot(
    const std::uint8_t *image,
    std::size_t imageSize,
    std::string_view importedDll,
    std::string_view importedSymbol)
{
    if (image == nullptr || imageSize == 0 || importedDll.empty()
        || importedSymbol.empty()) {
        return { CavalryPeIatLookupStatus::InvalidQuery, 0 };
    }

    std::uint16_t dosSignature = 0;
    std::uint32_t ntOffset32 = 0;
    if (!readU16(image, imageSize, 0, &dosSignature)
        || dosSignature != kDosSignature
        || !readU32(image, imageSize, kDosLfanewOffset, &ntOffset32)) {
        return { CavalryPeIatLookupStatus::InvalidImage, 0 };
    }

    const std::size_t ntOffset = ntOffset32;
    std::uint32_t ntSignature = 0;
    std::uint16_t machine = 0;
    std::uint16_t optionalHeaderSize = 0;
    if (!readU32(image, imageSize, ntOffset, &ntSignature)
        || ntSignature != kNtSignature
        || !readU16(image, imageSize, ntOffset + 4, &machine)
        || !readU16(image, imageSize, ntOffset + 4 + 16, &optionalHeaderSize)) {
        return { CavalryPeIatLookupStatus::InvalidImage, 0 };
    }

    if (machine != kMachineAmd64) {
        return { CavalryPeIatLookupStatus::UnsupportedImage, 0 };
    }

    std::size_t optionalHeaderOffset = 0;
    if (!addSize(ntOffset, 4 + kCoffHeaderSize, &optionalHeaderOffset)
        || optionalHeaderSize
            < kOptionalHeaderDataDirectoryOffset
                + (kImportDirectoryIndex + 1) * kDataDirectorySize
        || !hasBytes(imageSize, optionalHeaderOffset, optionalHeaderSize)) {
        return { CavalryPeIatLookupStatus::InvalidImage, 0 };
    }

    std::uint16_t optionalMagic = 0;
    std::uint32_t declaredImageSize = 0;
    std::uint32_t numberOfRvaAndSizes = 0;
    if (!readU16(
            image,
            imageSize,
            optionalHeaderOffset + kOptionalHeaderMagicOffset,
            &optionalMagic)
        || !readU32(
            image,
            imageSize,
            optionalHeaderOffset + kOptionalHeaderSizeOfImageOffset,
            &declaredImageSize)
        || !readU32(
            image,
            imageSize,
            optionalHeaderOffset + kOptionalHeaderNumberOfRvaAndSizesOffset,
            &numberOfRvaAndSizes)) {
        return { CavalryPeIatLookupStatus::InvalidImage, 0 };
    }

    if (optionalMagic != kPe32PlusMagic) {
        return { CavalryPeIatLookupStatus::UnsupportedImage, 0 };
    }
    if (declaredImageSize == 0 || declaredImageSize > imageSize) {
        return { CavalryPeIatLookupStatus::InvalidImage, 0 };
    }
    if (numberOfRvaAndSizes <= kImportDirectoryIndex) {
        return { CavalryPeIatLookupStatus::ImportDirectoryUnavailable, 0 };
    }

    const std::size_t mappedImageSize = declaredImageSize;
    const std::size_t importDirectoryOffset = optionalHeaderOffset
        + kOptionalHeaderDataDirectoryOffset
        + kImportDirectoryIndex * kDataDirectorySize;
    std::uint32_t importDirectoryRva = 0;
    std::uint32_t importDirectorySize = 0;
    if (!readU32(
            image,
            imageSize,
            importDirectoryOffset,
            &importDirectoryRva)
        || !readU32(
            image,
            imageSize,
            importDirectoryOffset + 4,
            &importDirectorySize)
        || importDirectoryRva == 0
        || importDirectorySize < kImportDescriptorSize
        || !hasBytes(
            mappedImageSize,
            importDirectoryRva,
            importDirectorySize)) {
        return { CavalryPeIatLookupStatus::ImportDirectoryUnavailable, 0 };
    }

    bool targetModuleFound = false;
    std::size_t matchingSlotCount = 0;
    std::size_t matchingSlotOffset = 0;
    const std::size_t importDirectoryEnd = static_cast<std::size_t>(importDirectoryRva)
        + importDirectorySize;

    for (
        std::size_t descriptorOffset = importDirectoryRva;
        descriptorOffset + kImportDescriptorSize <= importDirectoryEnd;
        descriptorOffset += kImportDescriptorSize) {
        if (isZeroImportDescriptor(image, mappedImageSize, descriptorOffset)) {
            if (!targetModuleFound) {
                return { CavalryPeIatLookupStatus::TargetModuleNotFound, 0 };
            }
            return matchingSlotCount == 0
                ? CavalryPeIatLookupResult {
                    CavalryPeIatLookupStatus::TargetSymbolNotFound,
                    0 }
                : matchingSlotCount == 1
                ? CavalryPeIatLookupResult {
                    CavalryPeIatLookupStatus::Found,
                    matchingSlotOffset }
                : CavalryPeIatLookupResult {
                    CavalryPeIatLookupStatus::AmbiguousTargetSymbol,
                    0 };
        }

        std::uint32_t originalFirstThunkRva = 0;
        std::uint32_t importedNameRva = 0;
        std::uint32_t firstThunkRva = 0;
        if (!readU32(
                image,
                mappedImageSize,
                descriptorOffset + kImportDescriptorOriginalFirstThunkOffset,
                &originalFirstThunkRva)
            || !readU32(
                image,
                mappedImageSize,
                descriptorOffset + kImportDescriptorNameOffset,
                &importedNameRva)
            || !readU32(
                image,
                mappedImageSize,
                descriptorOffset + kImportDescriptorFirstThunkOffset,
                &firstThunkRva)
            || originalFirstThunkRva == 0
            || firstThunkRva == 0) {
            return { CavalryPeIatLookupStatus::InvalidImage, 0 };
        }

        if (!asciiEquals(
                image,
                mappedImageSize,
                importedNameRva,
                importedDll,
                true)) {
            continue;
        }

        targetModuleFound = true;
        for (std::size_t thunkIndex = 0;; ++thunkIndex) {
            if (thunkIndex > (mappedImageSize / sizeof(std::uint64_t))) {
                return { CavalryPeIatLookupStatus::InvalidImage, 0 };
            }

            std::size_t originalThunkOffset = 0;
            std::size_t iatSlotOffset = 0;
            if (!addSize(
                    originalFirstThunkRva,
                    thunkIndex * sizeof(std::uint64_t),
                    &originalThunkOffset)
                || !addSize(
                    firstThunkRva,
                    thunkIndex * sizeof(std::uint64_t),
                    &iatSlotOffset)) {
                return { CavalryPeIatLookupStatus::InvalidImage, 0 };
            }

            std::uint64_t importNameThunk = 0;
            if (!readU64(
                    image,
                    mappedImageSize,
                    originalThunkOffset,
                    &importNameThunk)
                || !hasBytes(
                    mappedImageSize,
                    iatSlotOffset,
                    sizeof(std::uint64_t))) {
                return { CavalryPeIatLookupStatus::InvalidImage, 0 };
            }

            if (importNameThunk == 0) {
                break;
            }
            if ((importNameThunk & kImportByOrdinalFlag) != 0) {
                continue;
            }
            if (importNameThunk > std::numeric_limits<std::uint32_t>::max()) {
                return { CavalryPeIatLookupStatus::InvalidImage, 0 };
            }

            const std::size_t importByNameOffset =
                static_cast<std::uint32_t>(importNameThunk);
            if (!hasBytes(mappedImageSize, importByNameOffset, 3)) {
                return { CavalryPeIatLookupStatus::InvalidImage, 0 };
            }
            if (!asciiEquals(
                    image,
                    mappedImageSize,
                    importByNameOffset + 2,
                    importedSymbol,
                    false)) {
                continue;
            }

            ++matchingSlotCount;
            matchingSlotOffset = iatSlotOffset;
        }
    }

    return { CavalryPeIatLookupStatus::ImportDirectoryUnavailable, 0 };
}

const char *cavalryPeIatLookupStatusName(CavalryPeIatLookupStatus status)
{
    switch (status) {
    case CavalryPeIatLookupStatus::Found:
        return "found";
    case CavalryPeIatLookupStatus::InvalidQuery:
        return "invalid-query";
    case CavalryPeIatLookupStatus::InvalidImage:
        return "invalid-image";
    case CavalryPeIatLookupStatus::UnsupportedImage:
        return "unsupported-image";
    case CavalryPeIatLookupStatus::ImportDirectoryUnavailable:
        return "import-directory-unavailable";
    case CavalryPeIatLookupStatus::TargetModuleNotFound:
        return "target-module-not-found";
    case CavalryPeIatLookupStatus::TargetSymbolNotFound:
        return "target-symbol-not-found";
    case CavalryPeIatLookupStatus::AmbiguousTargetSymbol:
        return "ambiguous-target-symbol";
    }

    return "unknown";
}
