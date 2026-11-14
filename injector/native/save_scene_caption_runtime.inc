/**
 * [INPUT]: 依赖同bundle QtWidgets、精确Extension调用窗与既有gLocale。
 * [OUTPUT]: 替换精确Save captions；281另处理固定Load .cv并原样转发对话框。
 * [POS]: Qt导入窄interpose；不更改路径、过滤器、按钮、用户名称或其它caller。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include <array>
#include <atomic>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits.h>

#include <QtCore/QString>
#include <QtCore/qglobal.h>
#include <QtWidgets/QFileDialog>

#include "save_scene_caption_abi_contract.h"
#include "save_scene_caption_policy.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wreturn-type-c-linkage"
extern "C" QString saveSceneDialogTarget(
    QWidget *, const QString &, const QString &, const QString &, QString *,
    QFileDialog::Options)
    __asm__("__ZN11QFileDialog15getSaveFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE");
extern "C" QString nativeSaveSceneDialogInterpose(
    QWidget *, const QString &, const QString &, const QString &, QString *,
    QFileDialog::Options);
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
extern "C" QString openSceneDialogTarget(
    QWidget *, const QString &, const QString &, const QString &, QString *,
    QFileDialog::Options)
    __asm__("__ZN11QFileDialog15getOpenFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE");
extern "C" QString nativeOpenSceneDialogInterpose(
    QWidget *, const QString &, const QString &, const QString &, QString *,
    QFileDialog::Options);
#endif
#pragma clang diagnostic pop

namespace {
namespace save_caption_contract = native_save_scene_caption::contract;
using SaveSceneDialogOriginal = QString (*)(
    QWidget *, const QString &, const QString &, const QString &, QString *,
    QFileDialog::Options);

std::atomic<SaveSceneDialogOriginal> gOriginalSaveSceneDialog{nullptr};
std::atomic<bool> gSaveSceneCaptionContractReady{false};
std::atomic<std::uintptr_t> gSaveSceneCaptionExpectedReturnPc{0};
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
using OpenSceneDialogOriginal = QString (*)(
    QWidget *, const QString &, const QString &, const QString &, QString *,
    QFileDialog::Options);
std::atomic<OpenSceneDialogOriginal> gOriginalOpenSceneDialog{nullptr};
std::atomic<bool> gOpenSceneCaptionContractReady{false};
std::atomic<std::uintptr_t> gOpenSceneCaptionExpectedReturnPc{0};
#endif

bool verifySaveSceneCaptionContract() noexcept
{
    LoadedImage extension{};
    LoadedImage widgets{};
    std::array<char, PATH_MAX> extensionPath{};
    std::array<char, PATH_MAX> widgetsFrameworkPath{};
    std::array<char, PATH_MAX> widgetsPath{};
    if (!appFrameworkPath("libExtensionLayer.dylib",
                          extensionPath.data(), extensionPath.size()) ||
        !appFrameworkPath("QtWidgets.framework", widgetsFrameworkPath.data(),
                          widgetsFrameworkPath.size())) return false;

    const int widgetsLength = std::snprintf(
        widgetsPath.data(), widgetsPath.size(), "%s/Versions/A/QtWidgets",
        widgetsFrameworkPath.data());
    std::array<char, PATH_MAX> canonicalExtensionPath{};
    std::array<char, PATH_MAX> canonicalWidgetsPath{};
    if (widgetsLength <= 0 ||
        static_cast<std::size_t>(widgetsLength) >= widgetsPath.size() ||
        ::realpath(extensionPath.data(), canonicalExtensionPath.data()) == nullptr ||
        ::realpath(widgetsPath.data(), canonicalWidgetsPath.data()) == nullptr ||
        !findLoadedImageExactPath(canonicalExtensionPath.data(), &extension) ||
        !findLoadedImageExactPath(canonicalWidgetsPath.data(), &widgets)) return false;

    const void *exported = findMachOSymbol(
        widgets, save_caption_contract::kGetSaveFileNameSymbol);
    if (exported != nullptr) {
        gOriginalSaveSceneDialog.store(
            reinterpret_cast<SaveSceneDialogOriginal>(
                const_cast<void *>(exported)),
            std::memory_order_release);
    }

    const char *runtimeVersion = qVersion();
    const bool sharedImagesReady = runtimeVersion != nullptr &&
        std::strcmp(runtimeVersion, save_caption_contract::kQtVersion) == 0 &&
        imageUuidEquals(extension, save_caption_contract::kExtensionUuid) &&
        imageUuidEquals(widgets, save_caption_contract::kQtWidgetsUuid);
    const bool saveReady = sharedImagesReady &&
        exported == imageAddress(widgets,
                                 save_caption_contract::kQtWidgetsExportOffset) &&
        matchesCode(extension, save_caption_contract::kCallWindowOffset,
                    save_caption_contract::kCallWindowBytes);
    gSaveSceneCaptionExpectedReturnPc.store(
        saveReady ? reinterpret_cast<std::uintptr_t>(imageAddress(
                    extension, save_caption_contract::kReturnOffset)) : 0,
        std::memory_order_release);
    gSaveSceneCaptionContractReady.store(saveReady, std::memory_order_release);

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
    const void *openExport = findMachOSymbol(
        widgets, save_caption_contract::kGetOpenFileNameSymbol);
    if (openExport != nullptr) {
        gOriginalOpenSceneDialog.store(
            reinterpret_cast<OpenSceneDialogOriginal>(
                const_cast<void *>(openExport)),
            std::memory_order_release);
    }
    const bool openReady = sharedImagesReady &&
        openExport == imageAddress(
            widgets, save_caption_contract::kOpenFileNameQtWidgetsExportOffset) &&
        findMachOSymbol(extension, save_caption_contract::kChooseSceneOpenSymbol) ==
            imageAddress(extension, save_caption_contract::kChooseSceneOpenOffset) &&
        findMachOSymbol(extension, save_caption_contract::kPresentOpenFileSymbol) ==
            imageAddress(extension, save_caption_contract::kPresentOpenFileOffset) &&
        matchesCode(extension, save_caption_contract::kLoadCvSourceWindowOffset,
                    save_caption_contract::kLoadCvSourceWindowBytes) &&
        matchesCode(extension, save_caption_contract::kOpenFileNameCallWindowOffset,
                    save_caption_contract::kOpenFileNameCallWindowBytes);
    gOpenSceneCaptionExpectedReturnPc.store(
        openReady ? reinterpret_cast<std::uintptr_t>(imageAddress(
                        extension, save_caption_contract::kOpenFileNameReturnOffset)) : 0,
        std::memory_order_release);
    gOpenSceneCaptionContractReady.store(openReady, std::memory_order_release);
#endif
    return saveReady;
}

SaveSceneDialogOriginal requireSaveSceneDialogOriginal() noexcept
{
    SaveSceneDialogOriginal original =
        gOriginalSaveSceneDialog.load(std::memory_order_acquire);
    if (original == nullptr) original = &saveSceneDialogTarget;
    if (original == nullptr) std::abort();
    return original;
}

__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} saveSceneDialogInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(nativeSaveSceneDialogInterpose),
    reinterpret_cast<const void *>(saveSceneDialogTarget),
};
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
OpenSceneDialogOriginal requireOpenSceneDialogOriginal() noexcept
{
    OpenSceneDialogOriginal original =
        gOriginalOpenSceneDialog.load(std::memory_order_acquire);
    if (original == nullptr) original = &openSceneDialogTarget;
    if (original == nullptr) std::abort();
    return original;
}

__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} openSceneDialogInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(nativeOpenSceneDialogInterpose),
    reinterpret_cast<const void *>(openSceneDialogTarget),
};
#endif
}  // namespace

extern "C" __attribute__((noinline)) QString nativeSaveSceneDialogInterpose(
    QWidget *parent, const QString &caption, const QString &directory,
    const QString &filter, QString *selectedFilter,
    QFileDialog::Options options)
{
    const std::uintptr_t callerReturnPc = reinterpret_cast<std::uintptr_t>(
        __builtin_return_address(0));
    const bool ready =
        gSaveSceneCaptionContractReady.load(std::memory_order_acquire);
    const std::uintptr_t expectedReturnPc = ready ?
        gSaveSceneCaptionExpectedReturnPc.load(std::memory_order_acquire) : 0;
    return native_save_scene_caption::forwardSaveCaption(
        requireSaveSceneDialogOriginal(), ready, callerReturnPc,
        expectedReturnPc, parent, caption, directory, filter, selectedFilter,
        options, []() noexcept { return gLocale.value(); });
}

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
extern "C" __attribute__((noinline)) QString nativeOpenSceneDialogInterpose(
    QWidget *parent, const QString &caption, const QString &directory,
    const QString &filter, QString *selectedFilter,
    QFileDialog::Options options)
{
    const std::uintptr_t callerReturnPc = reinterpret_cast<std::uintptr_t>(
        __builtin_return_address(0));
    const bool ready =
        gOpenSceneCaptionContractReady.load(std::memory_order_acquire);
    const std::uintptr_t expectedReturnPc = ready ?
        gOpenSceneCaptionExpectedReturnPc.load(std::memory_order_acquire) : 0;
    return native_save_scene_caption::forwardOpenCaption(
        requireOpenSceneDialogOriginal(), ready, callerReturnPc,
        expectedReturnPc, parent, caption, directory, filter, selectedFilter,
        options, []() noexcept { return gLocale.value(); });
}
#endif
