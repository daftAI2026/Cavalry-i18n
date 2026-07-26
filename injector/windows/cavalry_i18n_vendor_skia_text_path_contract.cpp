/**
 * [INPUT]: 依赖 cavalry_i18n_vendor_skia_text_path_contract.h、PE/IAT 解析器及已采证的 Core.dll/skia.dll RVAs/机器码
 * [OUTPUT]: 对外锁定固定 Lato 根因、UTF-8 GetPath、CJK API、SkFont move/null、SkPath copy prefix 与 refcount +8 析构合同
 * [POS]: injector/windows 的 Cavalry 2.7.2 CJK Path 静态兼容证明；只读映射字节，不以共享常量掩盖运行时代码的 ABI 漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_vendor_skia_text_path_contract.h"

#include "cavalry_i18n_pe_iat.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <array>
#include <cstddef>
#include <cstring>
#include <string_view>

namespace {

constexpr char kSkiaImportName[] = "skia.dll";
constexpr std::uint32_t kCoreTimestamp = 0x6A0300B4;
constexpr std::uint32_t kSkiaTimestamp = 0x69495BF5;
constexpr std::size_t kCoreImageSize = 0x01A13000;
constexpr std::size_t kSkiaImageSize = 0x00852000;

constexpr char kMakePathFromTextSymbol[] =
    "?MakePathFromText@cavalry@@YA?AVPath@1@AEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@N@Z";
constexpr char kLatoTypefaceSymbol[] =
    "?SameOldSameOldTypefaceWhichByTheWayIsLatoRegular@cavalry@@YA?AV?$sk_sp@VSkTypeface@@@@XZ";
constexpr char kMakeScalableFontSymbol[] =
    "?MakeScalableFont@cavalry@@YA?AVSkFont@@V?$sk_sp@VSkTypeface@@@@M@Z";
constexpr std::size_t kMakePathThunkRva = 0x000038E6;
constexpr std::size_t kMakePathBodyRva = 0x000CDE40;
constexpr std::size_t kLatoThunkRva = 0x0000B474;
constexpr std::size_t kLatoBodyRva = 0x0011BBA0;
constexpr std::size_t kMakeScalableFontThunkRva = 0x00001695;
constexpr std::size_t kMakeScalableFontBodyRva = 0x0011BE40;

struct ImportedFunction {
    const char *symbol;
    std::size_t slotRva;
};

constexpr std::array<ImportedFunction, 9> kCoreSkiaImports {{
    {
        "?GetPath@SkTextUtils@@SAXPEBX_KW4SkTextEncoding@@MMAEBVSkFont@@PEAVSkPath@@@Z",
        0x019C9358,
    },
    {
        "?transform@SkPath@@QEBAXAEBVSkMatrix@@PEAV1@W4SkApplyPerspectiveClip@@@Z",
        0x019C93B8,
    },
    {
        "?setScale@SkMatrix@@QEAAAEAV1@MM@Z",
        0x019C9508,
    },
    { "??1SkPath@@QEAA@XZ", 0x019C95D0 },
    { "??0SkPath@@QEAA@XZ", 0x019C95E0 },
    { "??0SkPath@@QEAA@AEBV0@@Z", 0x019C9650 },
    {
        "??0SkFont@@QEAA@V?$sk_sp@VSkTypeface@@@@M@Z",
        0x019C9080,
    },
    {
        "?setHinting@SkFont@@QEAAXW4SkFontHinting@@@Z",
        0x019C9078,
    },
    {
        "?setEdging@SkFont@@QEAAXW4Edging@1@@Z",
        0x019C9058,
    },
}};

struct RequiredExport {
    const char *symbol;
    std::size_t rva;
};

constexpr std::array<RequiredExport, 9> kSkiaExports {{
    {
        "?MakeFromName@SkTypeface@@SA?AV?$sk_sp@VSkTypeface@@@@QEBDVSkFontStyle@@@Z",
        0x0011B320,
    },
    {
        "?unicharToGlyph@SkTypeface@@QEBAGH@Z",
        0x0011C230,
    },
    {
        "?GetPath@SkTextUtils@@SAXPEBX_KW4SkTextEncoding@@MMAEBVSkFont@@PEAVSkPath@@@Z",
        0x00181A40,
    },
    { "??0SkPath@@QEAA@XZ", 0x000AE100 },
    { "??0SkPath@@QEAA@AEBV0@@Z", 0x000AE1F0 },
    { "??1SkPath@@QEAA@XZ", 0x000AE280 },
    { "?isEmpty@SkPath@@QEBA_NXZ", 0x000AF1D0 },
    { "?setScale@SkMatrix@@QEAAAEAV1@MM@Z", 0x000787E0 },
    {
        "?transform@SkPath@@QEBAXAEBVSkMatrix@@PEAV1@W4SkApplyPerspectiveClip@@@Z",
        0x000B41B0,
    },
}};

constexpr std::array<std::uint8_t, 16> kMakeFromNameAbiPreamble {{
    0x56, 0x57, 0x53, 0x48, 0x83, 0xEC, 0x30, 0x44,
    0x89, 0xC7, 0x48, 0x89, 0xD3, 0x48, 0x89, 0xCE,
}};
constexpr std::array<std::uint8_t, 32> kTypefaceReleaseSequence {{
    0x48, 0x8B, 0x7D, 0xC0, 0x48, 0x85, 0xFF, 0x74,
    0x38, 0x48, 0x8D, 0x4F, 0x08, 0xE8, 0x30, 0xBB,
    0xF3, 0xFF, 0xF0, 0xFF, 0x08, 0x75, 0x2A, 0x48,
    0x8B, 0x07, 0x48, 0x89, 0xF9, 0xFF, 0x50, 0x08,
}};
constexpr std::array<std::uint8_t, 14> kMakeScalableFontMoveNullSequence {{
    0x48, 0x8B, 0x02, 0x48, 0x89, 0x55, 0xE8,
    0x48, 0xC7, 0x02, 0x00, 0x00, 0x00, 0x00,
}};
constexpr std::array<std::uint8_t, 16> kSkPathCopyConstructorPrefix {{
    0x48, 0x89, 0xC8, 0x48, 0x8B, 0x0A, 0xF0, 0xFF,
    0x01, 0x48, 0x89, 0x08, 0x66, 0xC7, 0x40, 0x0C,
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
    IMAGE_OPTIONAL_HEADER64 *optionalHeader)
{
    IMAGE_DOS_HEADER dos {};
    if (fileHeader == nullptr || optionalHeader == nullptr
        || !readValue(image, 0, &dos)
        || dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0) {
        return false;
    }
    const std::size_t ntRva = static_cast<std::size_t>(dos.e_lfanew);
    std::uint32_t signature = 0;
    return readValue(image, ntRva, &signature)
        && signature == IMAGE_NT_SIGNATURE
        && readValue(
            image,
            ntRva + sizeof(signature),
            fileHeader)
        && readValue(
            image,
            ntRva + sizeof(signature) + sizeof(*fileHeader),
            optionalHeader)
        && fileHeader->Machine == IMAGE_FILE_MACHINE_AMD64
        && optionalHeader->Magic == IMAGE_NT_OPTIONAL_HDR64_MAGIC;
}

bool namedExportRva(
    const std::vector<std::uint8_t> &image,
    std::string_view expectedName,
    std::size_t *rva)
{
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    if (rva == nullptr
        || !peHeaders(image, &fileHeader, &optionalHeader)) {
        return false;
    }
    const IMAGE_DATA_DIRECTORY &directory =
        optionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
    IMAGE_EXPORT_DIRECTORY exports {};
    if (directory.VirtualAddress == 0
        || !readValue(image, directory.VirtualAddress, &exports)
        || !hasRange(
            image,
            exports.AddressOfNames,
            static_cast<std::size_t>(exports.NumberOfNames)
                * sizeof(std::uint32_t))
        || !hasRange(
            image,
            exports.AddressOfNameOrdinals,
            static_cast<std::size_t>(exports.NumberOfNames)
                * sizeof(std::uint16_t))
        || !hasRange(
            image,
            exports.AddressOfFunctions,
            static_cast<std::size_t>(exports.NumberOfFunctions)
                * sizeof(std::uint32_t))) {
        return false;
    }

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
            || !hasRange(image, nameRva, expectedName.size() + 1)
            || std::memcmp(
                   image.data() + nameRva,
                   expectedName.data(),
                   expectedName.size())
                != 0
            || image[nameRva + expectedName.size()] != '\0') {
            continue;
        }
        std::uint32_t functionRva = 0;
        if (!readValue(
                image,
                exports.AddressOfFunctions
                    + static_cast<std::size_t>(ordinal)
                        * sizeof(functionRva),
                &functionRva)) {
            return false;
        }
        *rva = functionRva;
        return true;
    }
    return false;
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

bool nearTransferTargets(
    const std::vector<std::uint8_t> &image,
    std::size_t instructionRva,
    std::uint8_t opcode,
    std::size_t expectedTargetRva)
{
    std::size_t targetRva = 0;
    return hasRange(image, instructionRva, 5)
        && image[instructionRva] == opcode
        && relativeTarget(
            image,
            instructionRva,
            5,
            1,
            &targetRva)
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

bool hasExactBytes(
    const std::vector<std::uint8_t> &image,
    std::size_t rva,
    const std::uint8_t *expected,
    std::size_t size)
{
    return expected != nullptr && hasRange(image, rva, size)
        && std::memcmp(image.data() + rva, expected, size) == 0;
}

bool verifyImageIdentity(
    const std::vector<std::uint8_t> &image,
    std::uint32_t timestamp,
    std::size_t imageSize)
{
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
    return peHeaders(image, &fileHeader, &optionalHeader)
        && fileHeader.TimeDateStamp == timestamp
        && optionalHeader.SizeOfImage == imageSize
        && image.size() == imageSize;
}

bool verifyCoreContract(
    const std::vector<std::uint8_t> &core,
    std::string *failure)
{
    std::size_t exportRva = 0;
    if (!verifyImageIdentity(core, kCoreTimestamp, kCoreImageSize)
        || !namedExportRva(core, kMakePathFromTextSymbol, &exportRva)
        || exportRva != kMakePathThunkRva
        || !nearTransferTargets(
            core,
            kMakePathThunkRva,
            0xE9,
            kMakePathBodyRva)
        || !namedExportRva(core, kLatoTypefaceSymbol, &exportRva)
        || exportRva != kLatoThunkRva
        || !nearTransferTargets(
            core,
            kLatoThunkRva,
            0xE9,
            kLatoBodyRva)
        || !namedExportRva(core, kMakeScalableFontSymbol, &exportRva)
        || exportRva != kMakeScalableFontThunkRva
        || !nearTransferTargets(
            core,
            kMakeScalableFontThunkRva,
            0xE9,
            kMakeScalableFontBodyRva)) {
        *failure =
            "Core.dll identity or exported MakePath/Lato/MakeScalableFont thunk changed.";
        return false;
    }

    for (const ImportedFunction &imported : kCoreSkiaImports) {
        const CavalryPeIatLookupResult lookup = findCavalryPe64IatSlot(
            core.data(),
            core.size(),
            kSkiaImportName,
            imported.symbol);
        if (lookup.status != CavalryPeIatLookupStatus::Found
            || lookup.iatSlotOffset != imported.slotRva) {
            *failure =
                "Core.dll Skia import slot contract changed.";
            return false;
        }
    }

    constexpr std::array<std::uint8_t, 4> outputFlag {{
        0xC6, 0x46, 0x38, 0x00,
    }};
    if (!nearTransferTargets(core, 0x000CDE80, 0xE8, kLatoThunkRva)
        || !nearTransferTargets(
            core,
            0x000CDE92,
            0xE8,
            kMakeScalableFontThunkRva)
        || !indirectCallTargets(core, 0x000CDE9E, 0x019C95E0)
        || !indirectCallTargets(core, 0x000CDECD, 0x019C9358)
        || !indirectCallTargets(core, 0x000CDF05, 0x019C9508)
        || !indirectCallTargets(core, 0x000CDF1C, 0x019C93B8)
        || !indirectCallTargets(core, 0x000CDF29, 0x019C9650)
        || !hasExactBytes(
            core,
            0x000CDF2F,
            outputFlag.data(),
            outputFlag.size())
        || !indirectCallTargets(core, 0x000CDF37, 0x019C95D0)
        || !hasExactBytes(
            core,
            0x000CDF3D,
            kTypefaceReleaseSequence.data(),
            kTypefaceReleaseSequence.size())
        || !indirectCallTargets(core, 0x0011BE6D, 0x019C9080)
        || !hasExactBytes(
            core,
            0x0011BE57,
            kMakeScalableFontMoveNullSequence.data(),
            kMakeScalableFontMoveNullSequence.size())
        || !indirectCallTargets(core, 0x0011BE7C, 0x019C9078)
        || !indirectCallTargets(core, 0x0011BEAF, 0x019C9058)) {
        *failure =
            "Core.dll fixed-Lato UTF-8 Path construction or typeface ownership envelope changed.";
        return false;
    }
    return true;
}

bool verifySkiaContract(
    const std::vector<std::uint8_t> &skia,
    std::string *failure)
{
    if (!verifyImageIdentity(skia, kSkiaTimestamp, kSkiaImageSize)) {
        *failure = "skia.dll image identity changed.";
        return false;
    }
    for (const RequiredExport &required : kSkiaExports) {
        std::size_t actualRva = 0;
        if (!namedExportRva(skia, required.symbol, &actualRva)
            || actualRva != required.rva) {
            *failure = "skia.dll CJK text-path export contract changed.";
            return false;
        }
    }
    constexpr std::array<std::uint8_t, 4> makeFromNameRef {{
        0xF0, 0xFF, 0x40, 0x08,
    }};
    if (!hasExactBytes(
            skia,
            0x0011B320,
            kMakeFromNameAbiPreamble.data(),
            kMakeFromNameAbiPreamble.size())
        || !hasExactBytes(
            skia,
            0x0011B394,
            makeFromNameRef.data(),
            makeFromNameRef.size())
        || !hasExactBytes(
            skia,
            0x000AE1F0,
            kSkPathCopyConstructorPrefix.data(),
            kSkPathCopyConstructorPrefix.size())) {
        *failure =
            "SkTypeface::MakeFromName hidden-sret/style or refcount +8 ABI changed.";
        return false;
    }
    return true;
}

} // namespace

bool verifyCavalryCoreSkiaTextPathContract(
    const std::vector<std::uint8_t> &coreImage,
    const std::vector<std::uint8_t> &skiaImage,
    std::string *failure)
{
    if (failure == nullptr || coreImage.empty() || skiaImage.empty()) {
        return false;
    }
    return verifyCoreContract(coreImage, failure)
        && verifySkiaContract(skiaImage, failure);
}
