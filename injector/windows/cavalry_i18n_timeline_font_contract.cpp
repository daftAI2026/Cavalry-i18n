/**
 * [INPUT]: cavalry_i18n_pe_iat 的只读 IAT 查询、SkiaRuntimeAbi 的已锁定
 *          Core/skia identity，以及映射后的 Cavalry 2.7.2 PE64 映像。
 * [OUTPUT]: 实现时间轴字体 fallback 的最窄 vendor 合同，覆盖精确 IAT、
 *           paintNodeText 导出、helper 全哈希和 SkFont/SkRect ABI 边界。
 * [POS]: injector/windows 的静态 vendor 闸门；不加载、不执行、不写入厂商 DLL，
 *        未命中的调用者保持在 hook 合同之外。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_timeline_font_contract.h"

#include "cavalry_i18n_pe_iat.h"
#include "cavalry_i18n_skia_runtime_abi.h"
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <QtCore/QByteArray>
#include <QtCore/QCryptographicHash>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <limits>
#include <string_view>
namespace {
struct ImageView final {
    const std::uint8_t *base = nullptr;
    std::size_t length = 0;
    const std::uint8_t *data() const
    {
        return base;
    }

    std::size_t size() const
    {
        return length;
    }
};
constexpr std::uint32_t kExtensionLayerTimestamp = 0x6A0300E0U;
constexpr std::size_t kExtensionLayerImageSize = 0x001BBE000U;
constexpr char kSkiaImportName[] = "skia.dll";
constexpr char kMeasureTextSymbol[] =
    "?measureText@SkFont@@QEBAMPEBX_KW4SkTextEncoding@@PEAUSkRect@@PEBVSkPaint@@@Z";
constexpr char kDrawSimpleTextSymbol[] =
    "?drawSimpleText@SkCanvas@@QEAAXPEBX_KW4SkTextEncoding@@MMAEBVSkFont@@AEBVSkPaint@@@Z";
constexpr std::size_t kSkiaMeasureTextBodyRva = 0x000561C0U;
constexpr std::size_t kSkiaDrawSimpleTextBodyRva = 0x00035750U;
constexpr std::array<std::uint8_t, 16> kSkiaMeasureTextBodyPrefix {{
    0x41, 0x57, 0x41, 0x56, 0x56, 0x57, 0x53, 0x48,
    0x81, 0xEC, 0x30, 0x02, 0x00, 0x00, 0x0F, 0x29,
}};
constexpr std::array<std::uint8_t, 16> kSkiaDrawSimpleTextBodyPrefix {{
    0x41, 0x57, 0x41, 0x56, 0x56, 0x57, 0x55, 0x53,
    0x48, 0x83, 0xEC, 0x78, 0x44, 0x89, 0xCD, 0x4C,
}};
constexpr char kPaintNodeTextSymbol[] =
    "?paintNodeText@SkTimeEditorView@cavalry@@AEAAXPEAVSkCanvas@@NV?$num2@N@@1AEBVRectangle@2@@Z";
constexpr std::size_t kPaintNodeTextExportThunkRva = 0x00013700U;
constexpr std::size_t kPaintNodeTextBodyRva = 0x0086D200U;
constexpr char kGetFontSymbol[] =
    "?getFont@SkTimeEditorView@cavalry@@KA?AVSkFont@@XZ";
constexpr std::size_t kGetFontExportThunkRva = 0x000086A2U;
constexpr std::size_t kGetFontBodyRva = 0x00870010U;
constexpr std::size_t kTimelineFontHelperBeginRva = 0x0086F300U;
constexpr std::size_t kTimelineFontHelperEndRva = 0x0086FA1BU;
constexpr char kTimelineFontHelperSha256[] =
    "5681e7bd57b767f38cd653e894ad014d6de273fc2fc90cfa822c25c989ac7e4b";
constexpr std::size_t kMeasureTextIatRva = 0x01B32030U;
constexpr std::size_t kDrawSimpleTextIatRva = 0x01B32018U;
constexpr std::size_t kMeasureTextCallRva = 0x0086F49EU;
constexpr std::size_t kMeasureTextReturnRva = 0x0086F4A4U;
constexpr std::size_t kDrawSimpleTextCallRva = 0x0086F9A6U;
constexpr std::size_t kDrawSimpleTextReturnRva = 0x0086F9ACU;

constexpr std::array<std::size_t, 3> kPaintNodeTextHelperCalls {{
    0x0086D685U,
    0x0086DE15U,
    0x0086DE31U,
}};
constexpr std::size_t kSkFontSize = 0x18U;
constexpr std::size_t kSkFontLocalOffset = 0xD8U;
constexpr std::size_t kSkRectLocalOffset = 0xF0U;
constexpr std::array<std::uint8_t, 8> kZeroSkRectBytes {{
    0x66, 0x0F, 0x29, 0x85, 0xF0, 0x00, 0x00, 0x00,
}};
constexpr std::array<std::uint8_t, 7> kSkFontLocalAddressBytes {{
    0x48, 0x8D, 0x8D, 0xD8, 0x00, 0x00, 0x00,
}};
constexpr std::array<std::uint8_t, 9> kMeasureBoundsHighReadBytes {{
    0xF3, 0x44, 0x0F, 0x10, 0x85, 0xF8, 0x00, 0x00, 0x00,
}};
constexpr std::array<std::uint8_t, 9> kMeasureBoundsLowReadBytes {{
    0xF3, 0x44, 0x0F, 0x5C, 0x85, 0xF0, 0x00, 0x00, 0x00,
}};
constexpr std::array<std::uint8_t, 3> kGetFontFaceWriteBytes {{
    0x48, 0x89, 0x3E,
}};
constexpr std::array<std::uint8_t, 4> kGetFontSecondFieldWriteBytes {{
    0x48, 0x89, 0x46, 0x08,
}};
constexpr std::array<std::uint8_t, 7> kGetFontTailLoadBytes {{
    0x48, 0x8B, 0x05, 0xFA, 0x75, 0x1C, 0x01,
}};
constexpr std::array<std::uint8_t, 4> kGetFontTailWriteBytes {{
    0x48, 0x89, 0x46, 0x0F,
}};
template <typename Image>
bool hasRange(
    const Image &image,
    std::size_t offset,
    std::size_t size)
{
    return offset <= image.size() && size <= image.size() - offset;
}
template <typename Image, typename Value>
bool readValue(
    const Image &image,
    std::size_t offset,
    Value *value)
{
    if (value == nullptr || !hasRange(image, offset, sizeof(Value))) {
        return false;
    }
    std::memcpy(value, image.data() + offset, sizeof(Value));
    return true;
}
template <typename Image>
bool peHeaders(
    const Image &image,
    IMAGE_FILE_HEADER *fileHeader,
    IMAGE_OPTIONAL_HEADER64 *optionalHeader,
    std::size_t *sectionTableRva)
{
    IMAGE_DOS_HEADER dos {};
    if (fileHeader == nullptr || optionalHeader == nullptr
        || sectionTableRva == nullptr
        || !readValue(image, 0, &dos)
        || dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0) {
        return false;
    }
    const std::size_t ntRva = static_cast<std::size_t>(dos.e_lfanew);
    std::uint32_t signature = 0;
    if (!readValue(image, ntRva, &signature)
        || signature != IMAGE_NT_SIGNATURE
        || !readValue(image, ntRva + sizeof(signature), fileHeader)
        || fileHeader->Machine != IMAGE_FILE_MACHINE_AMD64
        || fileHeader->SizeOfOptionalHeader
            < sizeof(IMAGE_OPTIONAL_HEADER64)) {
        return false;
    }

    const std::size_t optionalRva =
        ntRva + sizeof(signature) + sizeof(*fileHeader);
    if (!readValue(image, optionalRva, optionalHeader)
        || optionalHeader->Magic != IMAGE_NT_OPTIONAL_HDR64_MAGIC
        || optionalHeader->SizeOfImage == 0
        || optionalHeader->SizeOfImage != image.size()
        || optionalHeader->SizeOfHeaders > image.size()) {
        return false;
    }
    *sectionTableRva = optionalRva + fileHeader->SizeOfOptionalHeader;
    return hasRange(
        image,
        *sectionTableRva,
        static_cast<std::size_t>(fileHeader->NumberOfSections)
            * sizeof(IMAGE_SECTION_HEADER));
}
void failWith(std::string *failure, std::string_view detail)
{
    if (failure != nullptr) {
        failure->assign(detail.data(), detail.size());
    }
}
bool matchesPinnedSkiaRuntimeIdentity(
    bool coreImage,
    std::uint16_t machine,
    std::uint16_t optionalMagic,
    std::uint32_t timestamp,
    std::size_t sizeOfImage)
{
#ifdef CAVALRY_I18N_TESTING
    return matchesCavalrySkiaRuntimeIdentityForTesting(
        coreImage,
        machine,
        optionalMagic,
        timestamp,
        sizeOfImage);
#else
    // 生产 hook 不依赖 TESTING-only 符号；Core/skia 的运行时 PIN gate
    // 仍由 CavalrySkiaRuntimeAbi::verifyAndPin 在调用前完成。
    constexpr std::uint32_t kCoreTimestamp = 0x6A0300B4U;
    constexpr std::uint32_t kSkiaTimestamp = 0x69495BF5U;
    constexpr std::size_t kCoreImageSize = 0x01A13000U;
    constexpr std::size_t kSkiaImageSize = 0x00852000U;
    return machine == IMAGE_FILE_MACHINE_AMD64
        && optionalMagic == IMAGE_NT_OPTIONAL_HDR64_MAGIC
        && timestamp == (coreImage ? kCoreTimestamp : kSkiaTimestamp)
        && sizeOfImage == (coreImage ? kCoreImageSize : kSkiaImageSize);
#endif
}
template <typename Image>
bool asciiEquals(
    const Image &image,
    std::size_t rva,
    std::string_view expected)
{
    return !expected.empty()
        && hasRange(image, rva, expected.size() + 1)
        && std::memcmp(image.data() + rva, expected.data(), expected.size()) == 0
        && image.data()[rva + expected.size()] == 0;
}
template <typename Image>
bool namedExportRva(
    const Image &image,
    std::string_view expectedName,
    std::size_t *rva)
{
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    std::size_t sectionTableRva = 0;
    if (rva == nullptr
        || !peHeaders(
               image,
               &fileHeader,
               &optionalHeader,
               &sectionTableRva)
        || optionalHeader.NumberOfRvaAndSizes <= IMAGE_DIRECTORY_ENTRY_EXPORT) {
        return false;
    }
    const IMAGE_DATA_DIRECTORY directory =
        optionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
    IMAGE_EXPORT_DIRECTORY exports {};
    if (directory.VirtualAddress == 0
        || directory.Size < sizeof(exports)
        || !hasRange(image, directory.VirtualAddress, directory.Size)
        || !readValue(image, directory.VirtualAddress, &exports)) {
        return false;
    }

    const auto namesBytes = static_cast<std::size_t>(exports.NumberOfNames)
        * sizeof(std::uint32_t);
    const auto ordinalBytes = static_cast<std::size_t>(exports.NumberOfNames)
        * sizeof(std::uint16_t);
    const auto functionBytes = static_cast<std::size_t>(exports.NumberOfFunctions)
        * sizeof(std::uint32_t);
    if (!hasRange(image, exports.AddressOfNames, namesBytes)
        || !hasRange(image, exports.AddressOfNameOrdinals, ordinalBytes)
        || !hasRange(image, exports.AddressOfFunctions, functionBytes)) {
        return false;
    }
    const std::uint64_t directoryEnd =
        static_cast<std::uint64_t>(directory.VirtualAddress) + directory.Size;
    for (std::size_t index = 0; index < exports.NumberOfNames; ++index) {
        std::uint32_t nameRva = 0;
        std::uint16_t ordinal = 0;
        if (!readValue(
                image,
                exports.AddressOfNames + index * sizeof(nameRva),
                &nameRva)
            || !readValue(
                image,
                exports.AddressOfNameOrdinals + index * sizeof(ordinal),
                &ordinal)
            || ordinal >= exports.NumberOfFunctions
            || !asciiEquals(image, nameRva, expectedName)) {
            continue;
        }
        std::uint32_t functionRva = 0;
        if (!readValue(
                image,
                exports.AddressOfFunctions
                    + static_cast<std::size_t>(ordinal)
                        * sizeof(functionRva),
                &functionRva)
            || functionRva == 0
            || (static_cast<std::uint64_t>(functionRva) >= directory.VirtualAddress
                && static_cast<std::uint64_t>(functionRva) < directoryEnd)) {
            return false;
        }
        *rva = functionRva;
        return true;
    }
    return false;
}
template <typename Image>
bool relativeTarget(
    const Image &image,
    std::size_t instructionRva,
    std::size_t instructionSize,
    std::size_t displacementOffset,
    std::size_t *targetRva)
{
    std::int32_t displacement = 0;
    if (targetRva == nullptr
        || displacementOffset > instructionSize
        || sizeof(displacement) > instructionSize - displacementOffset
        || !hasRange(image, instructionRva, instructionSize)
        || !readValue(
               image,
               instructionRva + displacementOffset,
               &displacement)) {
        return false;
    }
    const std::int64_t target =
        static_cast<std::int64_t>(instructionRva + instructionSize)
        + displacement;
    if (target < 0 || static_cast<std::uint64_t>(target) >= image.size()) {
        return false;
    }
    *targetRva = static_cast<std::size_t>(target);
    return true;
}
template <typename Image>
bool nearJumpTargets(
    const Image &image,
    std::size_t instructionRva,
    std::size_t expectedTargetRva)
{
    std::size_t targetRva = 0;
    return hasRange(image, instructionRva, 5)
        && image.data()[instructionRva] == 0xE9
        && relativeTarget(image, instructionRva, 5, 1, &targetRva)
        && targetRva == expectedTargetRva;
}
template <typename Image>
bool directCallTargets(
    const Image &image,
    std::size_t instructionRva,
    std::size_t expectedTargetRva)
{
    std::size_t targetRva = 0;
    return hasRange(image, instructionRva, 5)
        && image.data()[instructionRva] == 0xE8
        && relativeTarget(image, instructionRva, 5, 1, &targetRva)
        && targetRva == expectedTargetRva;
}

template <typename Image>
bool indirectCallTargets(
    const Image &image,
    std::size_t instructionRva,
    std::size_t expectedIatRva)
{
    std::size_t targetRva = 0;
    return hasRange(image, instructionRva, 6)
        && image.data()[instructionRva] == 0xFF
        && image.data()[instructionRva + 1] == 0x15
        && relativeTarget(image, instructionRva, 6, 2, &targetRva)
        && targetRva == expectedIatRva;
}
template <typename Image, std::size_t Size>
bool bytesAt(
    const Image &image,
    std::size_t rva,
    const std::array<std::uint8_t, Size> &expected)
{
    return hasRange(image, rva, expected.size())
        && std::memcmp(image.data() + rva, expected.data(), expected.size()) == 0;
}
template <typename Image>
bool verifyExtensionIdentity(
    const Image &image,
    std::string *failure)
{
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    std::size_t sectionTableRva = 0;
    if (!peHeaders(
            image,
            &fileHeader,
            &optionalHeader,
            &sectionTableRva)
        || fileHeader.TimeDateStamp != kExtensionLayerTimestamp
        || optionalHeader.SizeOfImage != kExtensionLayerImageSize) {
        failWith(failure, "ExtensionLayer PE64 timestamp or SizeOfImage changed.");
        return false;
    }
    return true;
}
template <typename Image>
bool verifyCoreOrSkiaIdentity(
    const Image &image,
    bool coreImage,
    std::string *failure)
{
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    std::size_t sectionTableRva = 0;
    if (!peHeaders(
            image,
            &fileHeader,
            &optionalHeader,
            &sectionTableRva)
        || !matchesPinnedSkiaRuntimeIdentity(
               coreImage,
               fileHeader.Machine,
               optionalHeader.Magic,
               fileHeader.TimeDateStamp,
               optionalHeader.SizeOfImage)) {
        failWith(
            failure,
            coreImage
                ? "Core.dll identity does not match the pinned SkiaRuntimeAbi."
                : "skia.dll identity does not match the pinned SkiaRuntimeAbi.");
        return false;
    }
    return true;
}
template <typename Image>
bool verifyIatSlots(
    const Image &image,
    std::string *failure)
{
    const CavalryPeIatLookupResult measure = findCavalryPe64IatSlot(
        image.data(),
        image.size(),
        kSkiaImportName,
        kMeasureTextSymbol);
    const CavalryPeIatLookupResult draw = findCavalryPe64IatSlot(
        image.data(),
        image.size(),
        kSkiaImportName,
        kDrawSimpleTextSymbol);
    if (measure.status != CavalryPeIatLookupStatus::Found
        || measure.iatSlotOffset != kMeasureTextIatRva
        || draw.status != CavalryPeIatLookupStatus::Found
        || draw.iatSlotOffset != kDrawSimpleTextIatRva) {
        failWith(
            failure,
            "ExtensionLayer Skia IAT slots differ from the two pinned text seams.");
        return false;
    }
    return true;
}
template <typename Image>
bool verifySkiaTextExports(
    const Image &image,
    std::string *failure)
{
    std::size_t measureRva = 0;
    std::size_t drawRva = 0;
    if (!namedExportRva(image, kMeasureTextSymbol, &measureRva)
        || measureRva != kSkiaMeasureTextBodyRva
        || !bytesAt(image, measureRva, kSkiaMeasureTextBodyPrefix)
        || !namedExportRva(image, kDrawSimpleTextSymbol, &drawRva)
        || drawRva != kSkiaDrawSimpleTextBodyRva) {
        failWith(
            failure,
            "skia.dll measureText/drawSimpleText export targets changed.");
        return false;
    }
    if (!bytesAt(image, drawRva, kSkiaDrawSimpleTextBodyPrefix)) {
        failWith(
            failure,
            "skia.dll drawSimpleText export body prefix changed.");
        return false;
    }
    return true;
}
template <typename Image>
bool verifyExports(
    const Image &image,
    std::string *failure)
{
    std::size_t paintExportRva = 0;
    std::size_t getFontExportRva = 0;
    if (!namedExportRva(image, kPaintNodeTextSymbol, &paintExportRva)
        || paintExportRva != kPaintNodeTextExportThunkRva
        || !nearJumpTargets(
               image,
               kPaintNodeTextExportThunkRva,
               kPaintNodeTextBodyRva)
        || !namedExportRva(image, kGetFontSymbol, &getFontExportRva)
        || getFontExportRva != kGetFontExportThunkRva
        || !nearJumpTargets(image, kGetFontExportThunkRva, kGetFontBodyRva)) {
        failWith(
            failure,
            "SkTimeEditorView export thunk or target body changed.");
        return false;
    }
    return true;
}

template <typename Image>
bool verifyNoHelperRelocations(
    const Image &image,
    std::string *failure)
{
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    std::size_t sectionTableRva = 0;
    if (!peHeaders(
            image,
            &fileHeader,
            &optionalHeader,
            &sectionTableRva)
        || optionalHeader.NumberOfRvaAndSizes
            <= IMAGE_DIRECTORY_ENTRY_BASERELOC) {
        failWith(failure, "ExtensionLayer base-relocation directory is unavailable.");
        return false;
    }
    const IMAGE_DATA_DIRECTORY directory =
        optionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_BASERELOC];
    if (directory.VirtualAddress == 0
        || directory.Size < sizeof(IMAGE_BASE_RELOCATION)
        || !hasRange(image, directory.VirtualAddress, directory.Size)) {
        failWith(failure, "ExtensionLayer base-relocation directory is malformed.");
        return false;
    }
    std::size_t blockOffset = directory.VirtualAddress;
    const std::size_t directoryEnd =
        directory.VirtualAddress + directory.Size;
    while (blockOffset < directoryEnd) {
        IMAGE_BASE_RELOCATION block {};
        if (!readValue(image, blockOffset, &block)
            || block.SizeOfBlock < sizeof(IMAGE_BASE_RELOCATION)
            || block.SizeOfBlock > directoryEnd - blockOffset
            || (block.SizeOfBlock - sizeof(IMAGE_BASE_RELOCATION)) % sizeof(std::uint16_t)
                != 0) {
            failWith(failure, "ExtensionLayer base-relocation block is malformed.");
            return false;
        }
        const std::size_t entryCount =
            (block.SizeOfBlock - sizeof(IMAGE_BASE_RELOCATION))
            / sizeof(std::uint16_t);
        for (std::size_t index = 0; index < entryCount; ++index) {
            std::uint16_t encoded = 0;
            if (!readValue(
                    image,
                    blockOffset + sizeof(IMAGE_BASE_RELOCATION)
                        + index * sizeof(encoded),
                    &encoded)) {
                failWith(failure, "ExtensionLayer base-relocation entry is unreadable.");
                return false;
            }
            if ((encoded >> 12U) != IMAGE_REL_BASED_DIR64) {
                continue;
            }
            const std::size_t relocationRva =
                static_cast<std::size_t>(block.VirtualAddress)
                + (encoded & 0x0FFFU);
            const bool overlaps =
                relocationRva < kTimelineFontHelperEndRva
                && relocationRva + sizeof(std::uint64_t)
                    > kTimelineFontHelperBeginRva;
            if (overlaps) {
                failWith(
                    failure,
                    "Timeline font helper contains a relocatable absolute pointer; its raw SHA-256 is not load-stable.");
                return false;
            }
        }
        blockOffset += block.SizeOfBlock;
    }
    return true;
}
template <typename Image>
bool verifyHelperAndCallers(
    const Image &image,
    bool verifyRelocations,
    std::string *failure)
{
    if (!hasRange(
            image,
            kTimelineFontHelperBeginRva,
            kTimelineFontHelperEndRva - kTimelineFontHelperBeginRva)) {
        failWith(failure, "SkTimeEditorView timeline font helper range is unavailable.");
        return false;
    }
    if (verifyRelocations && !verifyNoHelperRelocations(image, failure)) {
        return false;
    }
    const QByteArray helperHash = QCryptographicHash::hash(
        QByteArray(
            reinterpret_cast<const char *>(
                image.data() + kTimelineFontHelperBeginRva),
            static_cast<int>(
                kTimelineFontHelperEndRva - kTimelineFontHelperBeginRva)),
        QCryptographicHash::Sha256).toHex();
    if (helperHash != QByteArray(kTimelineFontHelperSha256)) {
        failWith(failure, "SkTimeEditorView timeline font helper SHA-256 changed.");
        return false;
    }
    for (const std::size_t callRva : kPaintNodeTextHelperCalls) {
        if (!directCallTargets(image, callRva, kTimelineFontHelperBeginRva)) {
            failWith(
                failure,
                "paintNodeText helper parent call chain changed.");
            return false;
        }
    }
    return true;
}

template <typename Image>
bool verifyFontLayout(
    const Image &image,
    std::string *failure)
{
    static_assert(kSkFontLocalOffset + kSkFontSize == kSkRectLocalOffset);
    if (!bytesAt(image, 0x0086F437U, kZeroSkRectBytes)
        || !bytesAt(image, 0x0086F43FU, kSkFontLocalAddressBytes)
        || !bytesAt(image, 0x0086F4CBU, kMeasureBoundsHighReadBytes)
        || !bytesAt(image, 0x0086F4D4U, kMeasureBoundsLowReadBytes)
        || !bytesAt(image, 0x00870060U, kGetFontFaceWriteBytes)
        || !bytesAt(image, 0x0087006AU, kGetFontSecondFieldWriteBytes)
        || !bytesAt(image, 0x0087006EU, kGetFontTailLoadBytes)
        || !bytesAt(image, 0x00870075U, kGetFontTailWriteBytes)
        || !hasRange(
               image,
               0x00870075U,
               kGetFontTailWriteBytes.size())
        || 0x00870075U + kGetFontTailWriteBytes.size()
            > kGetFontBodyRva + 0x70U) {
        failWith(
            failure,
            "SkFont 24-byte fields, SkRect bounds, or original tail/flags envelope changed.");
        return false;
    }
    return true;
}
template <typename Image>
bool verifyTextSeams(
    const Image &image,
    std::string *failure)
{
    if (!indirectCallTargets(
            image,
            kMeasureTextCallRva,
            kMeasureTextIatRva)
        || kMeasureTextReturnRva != kMeasureTextCallRva + 6U
        || !indirectCallTargets(
               image,
               kDrawSimpleTextCallRva,
               kDrawSimpleTextIatRva)
        || kDrawSimpleTextReturnRva != kDrawSimpleTextCallRva + 6U) {
        failWith(
            failure,
            "Timeline measureText/drawSimpleText callsite or return address changed.");
        return false;
    }
    // The sibling paintNodeText calls at 0x86da40/0x86dc1c deliberately stay
    // outside this contract. Their return addresses are 0x86da46/0x86dc22;
    // neither callsite is the helper's proven measure/draw seam.
    return true;
}
bool verifyContractImages(
    const ImageView &extensionLayer,
    const ImageView &core,
    const ImageView &skia,
    bool verifyRelocations,
    CavalryTimelineFontContractEvidence *evidence,
    std::string *failure)
{
    if (!verifyExtensionIdentity(extensionLayer, failure)
        || !verifyCoreOrSkiaIdentity(core, true, failure)
        || !verifyCoreOrSkiaIdentity(skia, false, failure)
        || !verifySkiaTextExports(skia, failure)
        || !verifyIatSlots(extensionLayer, failure)
        || !verifyExports(extensionLayer, failure)
        || !verifyHelperAndCallers(
               extensionLayer,
               verifyRelocations,
               failure)
        || !verifyFontLayout(extensionLayer, failure)
        || !verifyTextSeams(extensionLayer, failure)) {
        return false;
    }
    if (evidence != nullptr) {
        evidence->extensionLayerBase = extensionLayer.base;
        evidence->extensionLayerImageSize = extensionLayer.length;
        evidence->skiaBase = skia.base;
        evidence->skiaImageSize = skia.length;
        evidence->measureTextIatRva = kMeasureTextIatRva;
        evidence->drawSimpleTextIatRva = kDrawSimpleTextIatRva;
        evidence->measureTextExportRva = kSkiaMeasureTextBodyRva;
        evidence->drawSimpleTextExportRva = kSkiaDrawSimpleTextBodyRva;
        evidence->measureTextCallRva = kMeasureTextCallRva;
        evidence->measureTextReturnRva = kMeasureTextReturnRva;
        evidence->drawSimpleTextCallRva = kDrawSimpleTextCallRva;
        evidence->drawSimpleTextReturnRva = kDrawSimpleTextReturnRva;
        evidence->helperBeginRva = kTimelineFontHelperBeginRva;
        evidence->helperEndRva = kTimelineFontHelperEndRva;
    }
    return true;
}
} // namespace
bool verifyCavalryTimelineFontContract(
    const std::uint8_t *extensionLayerBase,
    std::size_t extensionLayerImageSize,
    const std::uint8_t *coreBase,
    std::size_t coreImageSize,
    const std::uint8_t *skiaBase,
    std::size_t skiaImageSize,
    CavalryTimelineFontContractEvidence *evidence,
    std::string *failure)
{
    if (failure != nullptr) {
        failure->clear();
    }
    if (evidence != nullptr) {
        *evidence = {};
    }
    if (extensionLayerBase == nullptr
        || extensionLayerImageSize == 0
        || coreBase == nullptr
        || coreImageSize == 0
        || skiaBase == nullptr
        || skiaImageSize == 0) {
        failWith(failure, "Timeline font vendor contract received an empty PE image.");
        return false;
    }
    return verifyContractImages(
        ImageView { extensionLayerBase, extensionLayerImageSize },
        ImageView { coreBase, coreImageSize },
        ImageView { skiaBase, skiaImageSize },
        false,
        evidence,
        failure);
}
bool verifyCavalryTimelineFontContract(
    const std::vector<std::uint8_t> &extensionLayerImage,
    const std::vector<std::uint8_t> &coreImage,
    const std::vector<std::uint8_t> &skiaImage,
    std::string *failure)
{
    if (failure != nullptr) {
        failure->clear();
    }
    const ImageView extensionLayer {
        extensionLayerImage.data(),
        extensionLayerImage.size(),
    };
    const ImageView core { coreImage.data(), coreImage.size() };
    const ImageView skia { skiaImage.data(), skiaImage.size() };
    if (extensionLayer.base == nullptr || extensionLayer.length == 0
        || core.base == nullptr || core.length == 0
        || skia.base == nullptr || skia.length == 0) {
        failWith(failure, "Timeline font vendor contract received an empty PE image.");
        return false;
    }
    return verifyContractImages(
        extensionLayer,
        core,
        skia,
        true,
        nullptr,
        failure);
}
bool verifyCavalryTimelineFontResolvedSkiaTargets(
    const CavalryTimelineFontContractEvidence &evidence,
    const void *measureTextExport,
    const void *drawSimpleTextExport,
    std::string *failure)
{
    if (failure != nullptr) {
        failure->clear();
    }
    if (evidence.skiaBase == nullptr
        || evidence.skiaImageSize == 0
        || evidence.measureTextExportRva != kSkiaMeasureTextBodyRva
        || evidence.drawSimpleTextExportRva != kSkiaDrawSimpleTextBodyRva
        || measureTextExport == nullptr
        || drawSimpleTextExport == nullptr) {
        failWith(
            failure,
            "Resolved skia.dll text targets received incomplete contract evidence.");
        return false;
    }
    const auto base = reinterpret_cast<std::uintptr_t>(evidence.skiaBase);
    const auto maxAddress = std::numeric_limits<std::uintptr_t>::max();
    const auto resolveRva = [&](std::size_t rva, const void **resolved) {
        if (resolved == nullptr || rva >= evidence.skiaImageSize
            || rva > maxAddress - base) {
            return false;
        }
        *resolved = reinterpret_cast<const void *>(base + rva);
        return true;
    };
    const void *expectedMeasure = nullptr;
    const void *expectedDraw = nullptr;
    if (!resolveRva(evidence.measureTextExportRva, &expectedMeasure)
        || !resolveRva(evidence.drawSimpleTextExportRva, &expectedDraw)
        || measureTextExport != expectedMeasure
        || drawSimpleTextExport != expectedDraw) {
        failWith(
            failure,
            "Resolved skia.dll measureText/drawSimpleText pointers do not match the pinned export RVAs.");
        return false;
    }
    return true;
}
