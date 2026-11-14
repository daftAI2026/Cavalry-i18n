/**
 * [INPUT]: 依赖fmt two-level原符号、Extension唯一format caller和gLocale。
 * [OUTPUT]: 提供一次原调用后的Project/Scene显示投影。
 * [POS]: 同TU窄适配；先快照caller源字符串，再一次原调用后投影。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "title_format_policy.h"

namespace {
namespace title_abi = native_title_format_abi;
namespace title_contract = native_title_format_abi::contract;

NativeTitleVformat resolveTitleVformatOriginal() noexcept
{
    NativeTitleVformat original = gOriginalTitleVformat.load(std::memory_order_acquire);
    if (original != nullptr) return original;

    if (gFmtImage.header != nullptr) {
        void *target = findMachOSymbol(
            gFmtImage, title_contract::kVformatSymbol);
        if (target != nullptr) original = reinterpret_cast<NativeTitleVformat>(target);
    }
    if (original == nullptr) {
        original = reinterpret_cast<NativeTitleVformat>(&titleFormatVformatTarget);
    }

    NativeTitleVformat expected = nullptr;
    if (!gOriginalTitleVformat.compare_exchange_strong(
            expected, original, std::memory_order_release, std::memory_order_relaxed))
        return expected;
    return original;
}

bool titleFormatCallsiteMatches(
    std::uintptr_t callerPc, title_abi::FormatStringView format,
    title_abi::FormatArguments arguments) noexcept
{
    if (!gTitleFormatContractReady.load(std::memory_order_acquire) ||
        gTitleExtensionImage.header == nullptr || gFmtImage.header == nullptr ||
        callerPc != reinterpret_cast<std::uintptr_t>(imageAddress(
            gTitleExtensionImage, title_contract::kVformatReturnOffset)) ||
        format.data != reinterpret_cast<const char *>(imageAddress(
            gTitleExtensionImage, title_contract::kFormatStringOffset)) ||
        format.size != title_contract::kFormatStringLength ||
        arguments.descriptor != title_contract::kFormatDescriptor ||
        arguments.values == nullptr) return false;
    return true;
}

bool titleSuffixMatches(const title_abi::FormatValue (&values)[
                            title_contract::kFormatValueCount]) noexcept
{
    const auto *suffix = values[2].cstring.data;
    if (values[2].cstring.unused != 0 || suffix == nullptr) return false;
    return suffix == imageAddress(gTitleExtensionImage, title_contract::kEmptySuffixOffset) ||
        suffix == imageAddress(gTitleExtensionImage, title_contract::kRestrictedSuffixOffset);
}

bool readTitleSourceStringSnapshots(
    const title_abi::FormatArguments &arguments,
    title_abi::LibCppStringSnapshot *project,
    title_abi::LibCppStringSnapshot *scene) noexcept
{
    if (arguments.values == nullptr || project == nullptr || scene == nullptr) return false;
    const std::uintptr_t valuesAddress =
        reinterpret_cast<std::uintptr_t>(arguments.values);
    constexpr std::uintptr_t maxAddress = ~std::uintptr_t{0};
    constexpr std::uintptr_t objectBytes = title_contract::kLibCppStringObjectBytes;
    if (valuesAddress > maxAddress -
            title_contract::kProjectSourceObjectFromValues - objectBytes ||
        valuesAddress > maxAddress -
            title_contract::kSceneSourceObjectFromValues - objectBytes)
        return false;
    const auto *projectSource = reinterpret_cast<const void *>(
        valuesAddress + title_contract::kProjectSourceObjectFromValues);
    const auto *sceneSource = reinterpret_cast<const void *>(
        valuesAddress + title_contract::kSceneSourceObjectFromValues);
    return readSelf(projectSource, sizeof(*project), project) &&
        readSelf(sceneSource, sizeof(*scene), scene);
}

bool verifyTitleFormatContract() noexcept
{
    std::array<char, PATH_MAX> extensionPath{};
    std::array<char, PATH_MAX> fmtPath{};
    LoadedImage extension{};
    LoadedImage fmt{};
    if (!appFrameworkPath("libExtensionLayer.dylib", extensionPath.data(),
                          extensionPath.size()) ||
        !appFrameworkPath("libfmt.10.dylib", fmtPath.data(), fmtPath.size()) ||
        !findLoadedImageExactPath(extensionPath.data(), &extension) ||
        !findLoadedImageExactPath(fmtPath.data(), &fmt)) return false;

    gTitleExtensionImage = extension;
    gFmtImage = fmt;
    void *vformat = findMachOSymbol(fmt, title_contract::kVformatSymbol);
    if (vformat != imageAddress(fmt, title_contract::kVformatOffset)) return false;

    NativeTitleVformat original = reinterpret_cast<NativeTitleVformat>(vformat);
    gOriginalTitleVformat.store(original, std::memory_order_release);

    std::array<char, sizeof(title_contract::kFormatString)> formatBytes{};
    std::array<char, sizeof("- Restricted")> restrictedBytes{};
    char emptySuffix = 1;
    return imageUuidEquals(extension, title_contract::kExtensionUuid) &&
        imageUuidEquals(fmt, title_contract::kFmtUuid) &&
        findMachOSymbol(extension, title_contract::kUpdateAppTitleSymbol) ==
            imageAddress(extension, title_contract::kUpdateAppTitleOffset) &&
        matchesCode(extension, title_contract::kCallerFrameOffset,
                    title_contract::kCallerFrameBytes) &&
        matchesCode(extension, title_contract::kSourceStringGettersOffset,
                    title_contract::kSourceStringGettersBytes) &&
        matchesCode(extension, title_contract::kCallSetupOffset,
                    title_contract::kCallSetupBytes) &&
        matchesCode(fmt, title_contract::kVformatOffset,
                    title_contract::kVformatEntryBytes) &&
        matchesCode(extension, title_contract::kSourceStringWindowOffset,
                    title_contract::kSourceStringWindowBytes) &&
        matchesCode(extension, title_contract::kFallbackValueWindowOffset,
                    title_contract::kFallbackValueWindowBytes) &&
        matchesCode(extension, title_contract::kFormatValuesWindowOffset,
                    title_contract::kFormatValuesWindowBytes) &&
        readSelf(imageAddress(extension, title_contract::kFormatStringOffset),
                 formatBytes.size(), formatBytes.data()) &&
        std::memcmp(formatBytes.data(), title_contract::kFormatString,
                    formatBytes.size()) == 0 &&
        readSelf(imageAddress(extension, title_contract::kRestrictedSuffixOffset),
                 restrictedBytes.size(), restrictedBytes.data()) &&
        std::memcmp(restrictedBytes.data(), "- Restricted",
                    restrictedBytes.size()) == 0 &&
        readSelf(imageAddress(extension, title_contract::kEmptySuffixOffset),
                 sizeof(emptySuffix), &emptySuffix) &&
        emptySuffix == '\0';
}
}  // namespace

extern "C" std::string nativeTitleVformatInterpose(
    title_abi::FormatStringView format,
    title_abi::FormatArguments arguments)
{
    const std::uintptr_t callerPc = reinterpret_cast<std::uintptr_t>(
        __builtin_return_address(0));
    NativeTitleVformat original = resolveTitleVformatOriginal();
    if (original == nullptr) std::abort();

    title_abi::FormatValue values[title_contract::kFormatValueCount]{};
    const bool exactCall = titleFormatCallsiteMatches(callerPc, format, arguments);
    const bool readableValues = exactCall &&
        readSelf(arguments.values, sizeof(values), values);
    title_abi::LibCppStringSnapshot sourceStrings[2]{};
    const bool readableSourceStrings = readableValues &&
        readTitleSourceStringSnapshots(arguments, &sourceStrings[0], &sourceStrings[1]);
    const bool exactSuffix = readableValues && titleSuffixMatches(values);

    // -- 原厂vformat恰好调用一次；其异常不被本地化策略捕获 ------------------
    std::string result = original(format, arguments);
    if (!exactSuffix || !readableSourceStrings) return result;
    const title_abi::BorrowedStringArgument project = values[0].string;
    const title_abi::BorrowedStringArgument scene = values[1].string;
    const native_title_format::Inputs inputs{
        reinterpret_cast<std::uintptr_t>(arguments.values),
        {project.data, project.size},
        {scene.data, scene.size},
        sourceStrings[0],
        sourceStrings[1]
    };
    try {
        (void)native_title_format::project(result, gLocale.value(), inputs);
    } catch (...) {
        // -- 本地化分配失败时保留vformat的完整原结果 ------------------------
    }
    return result;
}
