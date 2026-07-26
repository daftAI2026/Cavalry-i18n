/**
 * [INPUT]: 依赖 cavalry_i18n_skia_runtime_abi.h、VirtualQuery/GetModuleInformation、GetModuleHandleExW 与独立抄录的 Cavalry 2.7.2 ABI 证据
 * [OUTPUT]: 对外实现逐范围可读检查、PE64 身份/精确导出 RVA/关键机器码验证、普通引用稳态检查及 process-lifetime PIN
 * [POS]: injector/windows 的运行时 ABI 守门实现；任何私有 Core/skia C++ 调用都必须在本文件完整放行之后发生
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_skia_runtime_abi.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <psapi.h>

#include <array>
#include <cstring>
#include <cwchar>
#include <limits>
#include <string_view>
#include <utility>

namespace {

constexpr wchar_t kCoreModuleName[] = L"Core.dll";
constexpr wchar_t kSkiaModuleName[] = L"skia.dll";
constexpr std::uint32_t kCoreTimestamp = 0x6A0300B4;
constexpr std::uint32_t kSkiaTimestamp = 0x69495BF5;
constexpr std::size_t kCoreImageSize = 0x01A13000;
constexpr std::size_t kSkiaImageSize = 0x00852000;

constexpr char kMakeScalableFontSymbol[] =
    "?MakeScalableFont@cavalry@@YA?AVSkFont@@V?$sk_sp@VSkTypeface@@@@M@Z";
constexpr char kMakePathFromTextSymbol[] =
    "?MakePathFromText@cavalry@@YA?AVPath@1@AEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@N@Z";
constexpr char kMakeTypefaceFromNameSymbol[] =
    "?MakeFromName@SkTypeface@@SA?AV?$sk_sp@VSkTypeface@@@@QEBDVSkFontStyle@@@Z";
constexpr char kTypefaceUnicharToGlyphSymbol[] =
    "?unicharToGlyph@SkTypeface@@QEBAGH@Z";
constexpr char kSkTextGetPathSymbol[] =
    "?GetPath@SkTextUtils@@SAXPEBX_KW4SkTextEncoding@@MMAEBVSkFont@@PEAVSkPath@@@Z";
constexpr char kSkPathConstructorSymbol[] = "??0SkPath@@QEAA@XZ";
constexpr char kSkPathCopyConstructorSymbol[] =
    "??0SkPath@@QEAA@AEBV0@@Z";
constexpr char kSkPathDestructorSymbol[] = "??1SkPath@@QEAA@XZ";
constexpr char kSkPathIsEmptySymbol[] = "?isEmpty@SkPath@@QEBA_NXZ";
constexpr char kSkMatrixSetScaleSymbol[] =
    "?setScale@SkMatrix@@QEAAAEAV1@MM@Z";
constexpr char kSkPathTransformSymbol[] =
    "?transform@SkPath@@QEBAXAEBVSkMatrix@@PEAV1@W4SkApplyPerspectiveClip@@@Z";

constexpr std::size_t kMakeScalableFontThunkRva = 0x00001695;
constexpr std::size_t kMakeScalableFontBodyRva = 0x0011BE40;
constexpr std::size_t kMakePathFromTextThunkRva = 0x000038E6;
constexpr std::size_t kMakePathFromTextBodyRva = 0x000CDE40;
constexpr std::size_t kMakeScalableFontMoveNullRva = 0x0011BE57;
constexpr std::array<std::uint8_t, 14> kMakeScalableFontMoveNull {{
    0x48, 0x8B, 0x02, 0x48, 0x89, 0x55, 0xE8,
    0x48, 0xC7, 0x02, 0x00, 0x00, 0x00, 0x00,
}};

struct RequiredExport {
    const char *symbol;
    std::size_t rva;
};

constexpr std::array<RequiredExport, 9> kSkiaExports {{
    { kMakeTypefaceFromNameSymbol, 0x0011B320 },
    { kTypefaceUnicharToGlyphSymbol, 0x0011C230 },
    { kSkTextGetPathSymbol, 0x00181A40 },
    { kSkPathConstructorSymbol, 0x000AE100 },
    { kSkPathCopyConstructorSymbol, 0x000AE1F0 },
    { kSkPathDestructorSymbol, 0x000AE280 },
    { kSkPathIsEmptySymbol, 0x000AF1D0 },
    { kSkMatrixSetScaleSymbol, 0x000787E0 },
    { kSkPathTransformSymbol, 0x000B41B0 },
}};

constexpr std::array<std::uint8_t, 16> kMakeFromNameAbiPreamble {{
    0x56, 0x57, 0x53, 0x48, 0x83, 0xEC, 0x30, 0x44,
    0x89, 0xC7, 0x48, 0x89, 0xD3, 0x48, 0x89, 0xCE,
}};
constexpr std::array<std::uint8_t, 4> kMakeFromNameRefIncrement {{
    0xF0, 0xFF, 0x40, 0x08,
}};
constexpr std::array<std::uint8_t, 16> kSkPathCopyConstructorPrefix {{
    0x48, 0x89, 0xC8, 0x48, 0x8B, 0x0A, 0xF0, 0xFF,
    0x01, 0x48, 0x89, 0x08, 0x66, 0xC7, 0x40, 0x0C,
}};

struct ModuleReference final {
    HMODULE module = nullptr;

    ~ModuleReference()
    {
        if (module != nullptr) {
            FreeLibrary(module);
        }
    }

    ModuleReference() = default;
    ModuleReference(const ModuleReference &) = delete;
    ModuleReference &operator=(const ModuleReference &) = delete;
};

struct MappedModule final {
    HMODULE module = nullptr;
    const std::uint8_t *base = nullptr;
    std::size_t size = 0;
    IMAGE_FILE_HEADER fileHeader {};
    IMAGE_OPTIONAL_HEADER64 optionalHeader {};
};

bool hasReadableProtection(DWORD protection)
{
    if ((protection & (PAGE_GUARD | PAGE_NOACCESS)) != 0) {
        return false;
    }
    switch (protection & 0xFFU) {
    case PAGE_READONLY:
    case PAGE_READWRITE:
    case PAGE_WRITECOPY:
    case PAGE_EXECUTE_READ:
    case PAGE_EXECUTE_READWRITE:
    case PAGE_EXECUTE_WRITECOPY:
        return true;
    default:
        return false;
    }
}

bool isReadableRange(const void *address, std::size_t size)
{
    if (address == nullptr || size == 0) {
        return false;
    }
    const std::uintptr_t start =
        reinterpret_cast<std::uintptr_t>(address);
    if (start > std::numeric_limits<std::uintptr_t>::max() - size) {
        return false;
    }
    const std::uintptr_t end = start + size;
    std::uintptr_t cursor = start;
    while (cursor < end) {
        MEMORY_BASIC_INFORMATION information {};
        if (VirtualQuery(
                reinterpret_cast<const void *>(cursor),
                &information,
                sizeof(information))
                != sizeof(information)
            || information.State != MEM_COMMIT
            || !hasReadableProtection(information.Protect)) {
            return false;
        }
        const std::uintptr_t regionStart =
            reinterpret_cast<std::uintptr_t>(information.BaseAddress);
        if (regionStart > cursor
            || regionStart
                > std::numeric_limits<std::uintptr_t>::max()
                    - information.RegionSize) {
            return false;
        }
        const std::uintptr_t regionEnd =
            regionStart + information.RegionSize;
        if (regionEnd <= cursor) {
            return false;
        }
        cursor = regionEnd < end ? regionEnd : end;
    }
    return true;
}

bool hasMappedRange(
    const MappedModule &image,
    std::size_t rva,
    std::size_t size)
{
    return size != 0 && rva <= image.size
        && size <= image.size - rva
        && isReadableRange(image.base + rva, size);
}

template <typename Value>
bool readMapped(
    const MappedModule &image,
    std::size_t rva,
    Value *value)
{
    if (value == nullptr || !hasMappedRange(image, rva, sizeof(Value))) {
        return false;
    }
    std::memcpy(value, image.base + rva, sizeof(Value));
    return true;
}

bool hasExpectedModuleName(HMODULE module, const wchar_t *expectedName)
{
    std::array<wchar_t, 32768> path {};
    const DWORD length = GetModuleFileNameW(
        module,
        path.data(),
        static_cast<DWORD>(path.size()));
    if (length == 0 || length >= path.size() - 1) {
        return false;
    }
    const wchar_t *fileName = std::wcsrchr(path.data(), L'\\');
    fileName = fileName == nullptr ? path.data() : fileName + 1;
    return _wcsicmp(fileName, expectedName) == 0;
}

bool identityMatches(
    bool coreImage,
    std::uint16_t machine,
    std::uint16_t optionalMagic,
    std::uint32_t timestamp,
    std::size_t sizeOfImage)
{
    return machine == IMAGE_FILE_MACHINE_AMD64
        && optionalMagic == IMAGE_NT_OPTIONAL_HDR64_MAGIC
        && timestamp == (coreImage ? kCoreTimestamp : kSkiaTimestamp)
        && sizeOfImage == (coreImage ? kCoreImageSize : kSkiaImageSize);
}

bool inspectMappedModule(
    HMODULE module,
    const wchar_t *expectedName,
    bool coreImage,
    MappedModule *result,
    QString *failure)
{
    if (module == nullptr || result == nullptr
        || !hasExpectedModuleName(module, expectedName)) {
        if (failure != nullptr) {
            *failure = QStringLiteral(
                "Loaded Core/skia module basename is unavailable or unexpected.");
        }
        return false;
    }

    MODULEINFO information {};
    if (!GetModuleInformation(
            GetCurrentProcess(),
            module,
            &information,
            sizeof(information))
        || information.lpBaseOfDll != module
        || information.SizeOfImage == 0) {
        if (failure != nullptr) {
            *failure = QStringLiteral(
                "GetModuleInformation could not inspect the loaded Core/skia image.");
        }
        return false;
    }

    MappedModule image;
    image.module = module;
    image.base = static_cast<const std::uint8_t *>(information.lpBaseOfDll);
    image.size = information.SizeOfImage;
    IMAGE_DOS_HEADER dos {};
    if (!isReadableRange(image.base, sizeof(dos))) {
        if (failure != nullptr) {
            *failure = QStringLiteral(
                "Loaded Core/skia DOS header is not safely readable.");
        }
        return false;
    }
    std::memcpy(&dos, image.base, sizeof(dos));
    if (dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0) {
        if (failure != nullptr) {
            *failure = QStringLiteral("Loaded Core/skia DOS header is invalid.");
        }
        return false;
    }
    const std::size_t ntRva = static_cast<std::size_t>(dos.e_lfanew);
    std::uint32_t signature = 0;
    if (!readMapped(image, ntRva, &signature)
        || signature != IMAGE_NT_SIGNATURE
        || !readMapped(
            image,
            ntRva + sizeof(signature),
            &image.fileHeader)
        || image.fileHeader.SizeOfOptionalHeader
            < sizeof(IMAGE_OPTIONAL_HEADER64)
        || !readMapped(
            image,
            ntRva + sizeof(signature) + sizeof(image.fileHeader),
            &image.optionalHeader)
        || !identityMatches(
            coreImage,
            image.fileHeader.Machine,
            image.optionalHeader.Magic,
            image.fileHeader.TimeDateStamp,
            image.optionalHeader.SizeOfImage)
        || image.size != image.optionalHeader.SizeOfImage) {
        if (failure != nullptr) {
            *failure = QStringLiteral(
                "Loaded Core/skia PE64 timestamp or SizeOfImage does not match Cavalry 2.7.2.");
        }
        return false;
    }
    *result = image;
    return true;
}

bool asciiEquals(
    const MappedModule &image,
    std::size_t rva,
    std::string_view expected)
{
    return hasMappedRange(image, rva, expected.size() + 1)
        && std::memcmp(
            image.base + rva,
            expected.data(),
            expected.size())
            == 0
        && image.base[rva + expected.size()] == 0;
}

bool namedExportRva(
    const MappedModule &image,
    std::string_view expectedName,
    std::size_t *rva)
{
    if (rva == nullptr
        || image.optionalHeader.NumberOfRvaAndSizes
            <= IMAGE_DIRECTORY_ENTRY_EXPORT) {
        return false;
    }
    const IMAGE_DATA_DIRECTORY &directory =
        image.optionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
    IMAGE_EXPORT_DIRECTORY exports {};
    if (directory.VirtualAddress == 0
        || directory.Size < sizeof(exports)
        || !hasMappedRange(
            image,
            directory.VirtualAddress,
            directory.Size)
        || !readMapped(image, directory.VirtualAddress, &exports)
        || !hasMappedRange(
            image,
            exports.AddressOfNames,
            static_cast<std::size_t>(exports.NumberOfNames)
                * sizeof(std::uint32_t))
        || !hasMappedRange(
            image,
            exports.AddressOfNameOrdinals,
            static_cast<std::size_t>(exports.NumberOfNames)
                * sizeof(std::uint16_t))
        || !hasMappedRange(
            image,
            exports.AddressOfFunctions,
            static_cast<std::size_t>(exports.NumberOfFunctions)
                * sizeof(std::uint32_t))) {
        return false;
    }
    for (std::size_t index = 0; index < exports.NumberOfNames; ++index) {
        std::uint32_t nameRva = 0;
        std::uint16_t ordinal = 0;
        const std::uint64_t exportDirectoryEnd =
            static_cast<std::uint64_t>(directory.VirtualAddress)
            + directory.Size;
        if (!readMapped(
                image,
                exports.AddressOfNames + index * sizeof(nameRva),
                &nameRva)
            || !readMapped(
                image,
                exports.AddressOfNameOrdinals + index * sizeof(ordinal),
                &ordinal)
            || ordinal >= exports.NumberOfFunctions) {
            return false;
        }
        if (!asciiEquals(image, nameRva, expectedName)) {
            continue;
        }
        std::uint32_t functionRva = 0;
        if (!readMapped(
                image,
                exports.AddressOfFunctions
                    + static_cast<std::size_t>(ordinal)
                        * sizeof(functionRva),
                &functionRva)
            || functionRva == 0
            || (static_cast<std::uint64_t>(functionRva)
                    >= directory.VirtualAddress
                && static_cast<std::uint64_t>(functionRva)
                    < exportDirectoryEnd)) {
            return false;
        }
        *rva = functionRva;
        return true;
    }
    return false;
}

template <std::size_t Count>
bool hasExactBytes(
    const MappedModule &image,
    std::size_t rva,
    const std::array<std::uint8_t, Count> &expected)
{
    return hasMappedRange(image, rva, expected.size())
        && std::memcmp(
            image.base + rva,
            expected.data(),
            expected.size())
            == 0;
}

bool nearJumpTargets(
    const MappedModule &image,
    std::size_t instructionRva,
    std::size_t expectedTargetRva)
{
    if (!hasMappedRange(image, instructionRva, 5)
        || image.base[instructionRva] != 0xE9) {
        return false;
    }
    std::int32_t displacement = 0;
    std::memcpy(
        &displacement,
        image.base + instructionRva + 1,
        sizeof(displacement));
    const std::int64_t target =
        static_cast<std::int64_t>(instructionRva + 5) + displacement;
    return target == static_cast<std::int64_t>(expectedTargetRva);
}

bool exactExport(
    const MappedModule &image,
    const RequiredExport &required)
{
    std::size_t rva = 0;
    return namedExportRva(image, required.symbol, &rva)
        && rva == required.rva
        && GetProcAddress(image.module, required.symbol)
            == reinterpret_cast<FARPROC>(
                const_cast<std::uint8_t *>(image.base) + required.rva);
}

bool verifyCore(
    const MappedModule &core,
    QString *failure)
{
    const RequiredExport scalable {
        kMakeScalableFontSymbol,
        kMakeScalableFontThunkRva,
    };
    const RequiredExport makePath {
        kMakePathFromTextSymbol,
        kMakePathFromTextThunkRva,
    };
    if (!exactExport(core, makePath)
        || !nearJumpTargets(
            core,
            kMakePathFromTextThunkRva,
            kMakePathFromTextBodyRva)
        || !exactExport(core, scalable)
        || !nearJumpTargets(
            core,
            kMakeScalableFontThunkRva,
            kMakeScalableFontBodyRva)
        || !hasExactBytes(
            core,
            kMakeScalableFontMoveNullRva,
            kMakeScalableFontMoveNull)) {
        if (failure != nullptr) {
            *failure = QStringLiteral(
                "Core.dll MakeScalableFont export, thunk, or move/null ownership bytes changed.");
        }
        return false;
    }
    return true;
}

bool verifySkia(
    const MappedModule &skia,
    QString *failure)
{
    for (const RequiredExport &required : kSkiaExports) {
        if (!exactExport(skia, required)) {
            if (failure != nullptr) {
                *failure = QStringLiteral(
                    "skia.dll required CJK text-path export RVA changed.");
            }
            return false;
        }
    }
    if (!hasExactBytes(
            skia,
            0x0011B320,
            kMakeFromNameAbiPreamble)
        || !hasExactBytes(
            skia,
            0x0011B394,
            kMakeFromNameRefIncrement)
        || !hasExactBytes(
            skia,
            0x000AE1F0,
            kSkPathCopyConstructorPrefix)) {
        if (failure != nullptr) {
            *failure = QStringLiteral(
                "skia.dll hidden-sret/refcount or SkPath copy-constructor ABI bytes changed.");
        }
        return false;
    }
    return true;
}

bool pinVerifiedModule(
    HMODULE expected,
    QString *failure)
{
    HMODULE pinned = nullptr;
    if (!GetModuleHandleExW(
            GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS
                | GET_MODULE_HANDLE_EX_FLAG_PIN,
            reinterpret_cast<LPCWSTR>(expected),
            &pinned)
        || pinned != expected) {
        if (failure != nullptr) {
            *failure = QStringLiteral(
                "GetModuleHandleExW could not PIN the verified module for process lifetime (Win32 error %1).")
                .arg(GetLastError());
        }
        return false;
    }
    return true;
}

template <typename Function>
Function resolveExact(
    const MappedModule &image,
    const char *symbol,
    std::size_t rva)
{
    const FARPROC address = GetProcAddress(image.module, symbol);
    if (address
        != reinterpret_cast<FARPROC>(
            const_cast<std::uint8_t *>(image.base) + rva)) {
        return nullptr;
    }
    return reinterpret_cast<Function>(address);
}

} // namespace

bool CavalrySkiaRuntimeApi::isComplete() const
{
    return makePathFromText != nullptr
        && makeScalableFont != nullptr
        && makeTypefaceFromName != nullptr
        && unicharToGlyph != nullptr && getPath != nullptr
        && constructPath != nullptr && copyPath != nullptr
        && destroyPath != nullptr && isPathEmpty != nullptr
        && setScale != nullptr && transformPath != nullptr;
}

CavalrySkiaRuntimeAbi::CavalrySkiaRuntimeAbi(CavalrySkiaRuntimeApi api)
    : api_(std::move(api))
{
}

std::shared_ptr<const CavalrySkiaRuntimeAbi>
CavalrySkiaRuntimeAbi::verifyAndPin(QString *detail)
{
    if (detail != nullptr) {
        detail->clear();
    }
    ModuleReference coreReference;
    ModuleReference skiaReference;
    if (!GetModuleHandleExW(
            0,
            kCoreModuleName,
            &coreReference.module)
        || !GetModuleHandleExW(
            0,
            kSkiaModuleName,
            &skiaReference.module)) {
        if (detail != nullptr) {
            *detail = QStringLiteral(
                "Core.dll/skia.dll is not loaded; no private ABI call was attempted.");
        }
        return {};
    }

    MappedModule core;
    MappedModule skia;
    if (!inspectMappedModule(
            coreReference.module,
            kCoreModuleName,
            true,
            &core,
            detail)
        || !inspectMappedModule(
            skiaReference.module,
            kSkiaModuleName,
            false,
            &skia,
            detail)
        || !verifyCore(core, detail)
        || !verifySkia(skia, detail)) {
        return {};
    }

    CavalrySkiaRuntimeApi api;
    api.makePathFromText =
        reinterpret_cast<void *>(
            GetProcAddress(core.module, kMakePathFromTextSymbol));
    api.makeScalableFont =
        resolveExact<CavalrySkiaRuntimeApi::MakeScalableFontFunction>(
            core,
            kMakeScalableFontSymbol,
            kMakeScalableFontThunkRva);
    api.makeTypefaceFromName =
        resolveExact<CavalrySkiaRuntimeApi::MakeTypefaceFromNameFunction>(
            skia,
            kMakeTypefaceFromNameSymbol,
            0x0011B320);
    api.unicharToGlyph =
        resolveExact<CavalrySkiaRuntimeApi::TypefaceUnicharToGlyphFunction>(
            skia,
            kTypefaceUnicharToGlyphSymbol,
            0x0011C230);
    api.getPath =
        resolveExact<CavalrySkiaRuntimeApi::SkTextGetPathFunction>(
            skia,
            kSkTextGetPathSymbol,
            0x00181A40);
    api.constructPath =
        resolveExact<CavalrySkiaRuntimeApi::SkPathConstructorFunction>(
            skia,
            kSkPathConstructorSymbol,
            0x000AE100);
    api.copyPath =
        resolveExact<CavalrySkiaRuntimeApi::SkPathCopyConstructorFunction>(
            skia,
            kSkPathCopyConstructorSymbol,
            0x000AE1F0);
    api.destroyPath =
        resolveExact<CavalrySkiaRuntimeApi::SkPathDestructorFunction>(
            skia,
            kSkPathDestructorSymbol,
            0x000AE280);
    api.isPathEmpty =
        resolveExact<CavalrySkiaRuntimeApi::SkPathIsEmptyFunction>(
            skia,
            kSkPathIsEmptySymbol,
            0x000AF1D0);
    api.setScale =
        resolveExact<CavalrySkiaRuntimeApi::SkMatrixSetScaleFunction>(
            skia,
            kSkMatrixSetScaleSymbol,
            0x000787E0);
    api.transformPath =
        resolveExact<CavalrySkiaRuntimeApi::SkPathTransformFunction>(
            skia,
            kSkPathTransformSymbol,
            0x000B41B0);
    if (!api.isComplete()) {
        if (detail != nullptr) {
            *detail = QStringLiteral(
                "Verified Core/skia export table could not produce a complete exact function table.");
        }
        return {};
    }

    // 只有两个映像均完整通过，才接受永久 PIN；普通引用随后由 RAII 释放。
    if (!pinVerifiedModule(core.module, detail)
        || !pinVerifiedModule(skia.module, detail)) {
        return {};
    }
    if (detail != nullptr) {
        *detail = QStringLiteral(
            "Verified and process-lifetime PINned Cavalry 2.7.2 Core.dll/skia.dll before any private C++ ABI call.");
    }
    return std::shared_ptr<const CavalrySkiaRuntimeAbi>(
        new CavalrySkiaRuntimeAbi(std::move(api)));
}

const CavalrySkiaRuntimeApi &CavalrySkiaRuntimeAbi::api() const
{
    return api_;
}

bool pinCavalryI18nModuleForProcessLifetime(
    const void *addressInsidePlugin,
    QString *failureDetail)
{
    if (addressInsidePlugin == nullptr) {
        if (failureDetail != nullptr) {
            *failureDetail =
                QStringLiteral("Cannot PIN the plugin from a null address.");
        }
        return false;
    }
    HMODULE pinned = nullptr;
    if (!GetModuleHandleExW(
            GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS
                | GET_MODULE_HANDLE_EX_FLAG_PIN,
            reinterpret_cast<LPCWSTR>(addressInsidePlugin),
            &pinned)
        || pinned == nullptr) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "GetModuleHandleExW could not PIN cavalryi18n for process lifetime (Win32 error %1).")
                .arg(GetLastError());
        }
        return false;
    }
    return true;
}

#ifdef CAVALRY_I18N_TESTING
bool matchesCavalrySkiaRuntimeIdentityForTesting(
    bool coreImage,
    std::uint16_t machine,
    std::uint16_t optionalMagic,
    std::uint32_t timestamp,
    std::size_t sizeOfImage)
{
    return identityMatches(
        coreImage,
        machine,
        optionalMagic,
        timestamp,
        sizeOfImage);
}
#endif
