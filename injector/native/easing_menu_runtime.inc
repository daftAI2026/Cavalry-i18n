/**
 * [INPUT]: 依赖 Qt 6.9.2 QAction/QWidget、唯一 gLocale、冻结显示行与 ABI 合同。
 * [OUTPUT]: 为精确 Magic Easing addAction caller 投影文字并单次转发原方法。
 * [POS]: 同 TU 窄 interpose；未知caller不读取文本或locale，不改动作身份。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#ifndef NATIVE_EASING_DISPLAY_TABLE
#error "必须由构建入口提供冻结的 Easing 显示表。"
#endif

#include <array>
#include <string_view>

#include <QtCore/QByteArray>
#include <QtCore/QString>
#include <QtCore/qglobal.h>
#include <QtGui/QAction>
#include <QtWidgets/QWidget>

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits.h>
#include <tuple>

#include NATIVE_EASING_DISPLAY_TABLE

#include "easing_menu_abi_contract.h"
#include "easing_menu_policy.h"
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
#ifndef NATIVE_DG_CONTEXT_MENU_TABLE
#error "281 arm64必须由source-bound builder提供DG/TransformTool显示表。"
#endif
#include "dg_context_menu_abi_contract.h"
#include "dg_context_menu_policy.h"
#include NATIVE_DG_CONTEXT_MENU_TABLE
static_assert(std::tuple_size<decltype(native_dg_context_menu::kRows)>::value == 5);
#endif

static_assert(QT_VERSION == QT_VERSION_CHECK(6, 9, 2));
static_assert(std::tuple_size<decltype(native_easing_display::kRows)>::value ==
              native_easing_menu::contract::kPresetSourceCount);

extern "C" void easingMenuAddActionTarget(QWidget *, QAction *)
    __asm__("__ZN7QWidget9addActionEP7QAction");
extern "C" void nativeEasingMenuAddActionInterpose(QWidget *, QAction *);

namespace {
namespace easing_contract = native_easing_menu::contract;
using EasingMenuAddAction = void (*)(QWidget *, QAction *);

std::atomic<EasingMenuAddAction> gOriginalEasingMenuAddAction{nullptr};
std::atomic<bool> gEasingMenuContractReady{false};
std::atomic<std::uintptr_t> gEasingMenuExpectedReturnPc{0};
LoadedImage gEasingMenuExtensionImage{};
LoadedImage gEasingMenuQtWidgetsImage{};
LoadedImage gEasingMenuQtGuiImage{};
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
std::atomic<bool> gDgContextMenuContractReady{false};
std::atomic<std::uintptr_t> gDgContextMenuExpectedReturnPc{0};
#endif

EasingMenuAddAction requireEasingMenuOriginal() noexcept
{
    EasingMenuAddAction original =
        gOriginalEasingMenuAddAction.load(std::memory_order_acquire);
    return original != nullptr ? original : &easingMenuAddActionTarget;
}

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
bool verifyDgContextMenuContract() noexcept
{
    using namespace native_dg_context_menu::contract;
    gDgContextMenuContractReady.store(false, std::memory_order_release);
    gDgContextMenuExpectedReturnPc.store(0, std::memory_order_release);

    const bool symbolsMatch =
        imageUuidEquals(gEasingMenuExtensionImage, kExtensionUuid) &&
        findMachOSymbol(gEasingMenuExtensionImage, kToolMenuAddMenuItemSymbol) ==
            imageAddress(gEasingMenuExtensionImage, kToolMenuAddMenuItemOffset) &&
        findMachOSymbol(gEasingMenuExtensionImage, kAddDuplicatorActionsSymbol) ==
            imageAddress(gEasingMenuExtensionImage, kAddDuplicatorActionsOffset) &&
        findMachOSymbol(gEasingMenuExtensionImage, kAddGroupActionSymbol) ==
            imageAddress(gEasingMenuExtensionImage, kAddGroupActionOffset) &&
        findMachOSymbol(gEasingMenuExtensionImage, kAddLockActionSymbol) ==
            imageAddress(gEasingMenuExtensionImage, kAddLockActionOffset) &&
        findMachOSymbol(gEasingMenuExtensionImage, kAddShowInWindowActionsSymbol) ==
            imageAddress(gEasingMenuExtensionImage, kAddShowInWindowActionsOffset);
    const bool codeMatches =
        matchesCode(gEasingMenuExtensionImage, kToolMenuFrameWindowOffset,
                    kToolMenuFrameWindowBytes) &&
        matchesCode(gEasingMenuExtensionImage, kToolMenuAddActionWindowOffset,
                    kToolMenuAddActionWindowBytes) &&
        matchesCode(gEasingMenuExtensionImage, kAddDuplicatorActionsFrameWindowOffset,
                    kAddDuplicatorActionsFrameWindowBytes) &&
        matchesCode(gEasingMenuExtensionImage, kAddGroupActionFrameWindowOffset,
                    kAddGroupActionFrameWindowBytes) &&
        matchesCode(gEasingMenuExtensionImage, kAddLockActionFrameWindowOffset,
                    kAddLockActionFrameWindowBytes) &&
        matchesCode(gEasingMenuExtensionImage, kAddShowInWindowActionsFrameWindowOffset,
                    kAddShowInWindowActionsFrameWindowBytes) &&
        matchesCode(gEasingMenuExtensionImage, kAddDuplicatorActionsCallOffset,
                    kAddDuplicatorActionsBranchBytes) &&
        matchesCode(gEasingMenuExtensionImage, kAddGroupActionCallOffset,
                    kAddGroupActionBranchBytes) &&
        matchesCode(gEasingMenuExtensionImage, kAddLockActionCallOffset,
                    kAddLockActionBranchBytes) &&
        matchesCode(gEasingMenuExtensionImage, kAddShowAttributeEditorCallOffset,
                    kAddShowAttributeEditorBranchBytes) &&
        matchesCode(gEasingMenuExtensionImage, kAddShowSceneWindowCallOffset,
                    kAddShowSceneWindowBranchBytes);
    const bool ready = symbolsMatch && codeMatches;
    gDgContextMenuExpectedReturnPc.store(ready ? reinterpret_cast<std::uintptr_t>(
        imageAddress(gEasingMenuExtensionImage, kToolMenuAddActionReturnOffset)) : 0,
        std::memory_order_release);
    gDgContextMenuContractReady.store(ready, std::memory_order_release);
    return ready;
}
#else
bool verifyDgContextMenuContract() noexcept { return false; }
#endif

bool verifyEasingMenuContract() noexcept
{
    // -- 原addAction先绑定；任一门失败只关闭文字投影 -----------------------
    gOriginalEasingMenuAddAction.store(
        &easingMenuAddActionTarget, std::memory_order_release);

    std::array<char, PATH_MAX> extensionPath{};
    std::array<char, PATH_MAX> qtWidgetsFrameworkPath{};
    std::array<char, PATH_MAX> qtWidgetsPath{};
    std::array<char, PATH_MAX> qtGuiFrameworkPath{};
    std::array<char, PATH_MAX> qtGuiPath{};
    std::array<char, PATH_MAX> canonicalExtensionPath{};
    std::array<char, PATH_MAX> canonicalQtWidgetsPath{};
    std::array<char, PATH_MAX> canonicalQtGuiPath{};
    if (!appFrameworkPath("libExtensionLayer.dylib", extensionPath.data(),
                          extensionPath.size()) ||
        !appFrameworkPath("QtWidgets.framework", qtWidgetsFrameworkPath.data(),
                          qtWidgetsFrameworkPath.size()) ||
        !appFrameworkPath("QtGui.framework", qtGuiFrameworkPath.data(),
                          qtGuiFrameworkPath.size())) return false;

    const int widgetsLength = std::snprintf(
        qtWidgetsPath.data(), qtWidgetsPath.size(), "%s/Versions/A/QtWidgets",
        qtWidgetsFrameworkPath.data());
    const int guiLength = std::snprintf(
        qtGuiPath.data(), qtGuiPath.size(), "%s/Versions/A/QtGui",
        qtGuiFrameworkPath.data());
    if (widgetsLength <= 0 ||
        static_cast<std::size_t>(widgetsLength) >= qtWidgetsPath.size() ||
        guiLength <= 0 || static_cast<std::size_t>(guiLength) >= qtGuiPath.size() ||
        ::realpath(extensionPath.data(), canonicalExtensionPath.data()) == nullptr ||
        ::realpath(qtWidgetsPath.data(), canonicalQtWidgetsPath.data()) == nullptr ||
        ::realpath(qtGuiPath.data(), canonicalQtGuiPath.data()) == nullptr ||
        !findLoadedImageExactPath(canonicalExtensionPath.data(),
                                  &gEasingMenuExtensionImage) ||
        !findLoadedImageExactPath(canonicalQtWidgetsPath.data(),
                                  &gEasingMenuQtWidgetsImage) ||
        !findLoadedImageExactPath(canonicalQtGuiPath.data(), &gEasingMenuQtGuiImage))
        return false;

    // -- 281 DG/TransformTool uses the same one QWidget interpose, but its own
    // -- ABI gate. Easing readiness and its legacy behavior stay independent.
    (void)verifyDgContextMenuContract();

    const void *addAction = findMachOSymbol(
        gEasingMenuQtWidgetsImage, easing_contract::kAddActionSymbol);
    if (addAction == nullptr) return false;
    gOriginalEasingMenuAddAction.store(
        reinterpret_cast<EasingMenuAddAction>(const_cast<void *>(addAction)),
        std::memory_order_release);

    const void *actionText = findMachOSymbol(
        gEasingMenuQtGuiImage, easing_contract::kActionTextSymbol);
    const void *actionSetText = findMachOSymbol(
        gEasingMenuQtGuiImage, easing_contract::kActionSetTextSymbol);
    const char *runtimeVersion = qVersion();
    const bool ready = runtimeVersion != nullptr &&
        std::strcmp(runtimeVersion, easing_contract::kQtVersion) == 0 &&
        imageUuidEquals(gEasingMenuExtensionImage, easing_contract::kExtensionUuid) &&
        imageUuidEquals(gEasingMenuQtWidgetsImage, easing_contract::kQtWidgetsUuid) &&
        imageUuidEquals(gEasingMenuQtGuiImage, easing_contract::kQtGuiUuid) &&
        addAction == imageAddress(gEasingMenuQtWidgetsImage,
                                  easing_contract::kAddActionExportOffset) &&
        actionText == imageAddress(gEasingMenuQtGuiImage,
                                   easing_contract::kActionTextExportOffset) &&
        actionSetText == imageAddress(gEasingMenuQtGuiImage,
                                      easing_contract::kActionSetTextExportOffset) &&
        matchesCode(gEasingMenuExtensionImage,
                    easing_contract::kAddActionCallWindowOffset,
                    easing_contract::kAddActionCallWindowBytes);
    gEasingMenuExpectedReturnPc.store(ready ? reinterpret_cast<std::uintptr_t>(
        imageAddress(gEasingMenuExtensionImage,
                     easing_contract::kAddActionReturnOffset)) : 0,
        std::memory_order_release);
    gEasingMenuContractReady.store(ready, std::memory_order_release);
    return ready;
}

__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} easingMenuAddActionInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(nativeEasingMenuAddActionInterpose),
    reinterpret_cast<const void *>(easingMenuAddActionTarget),
};
}  // namespace

extern "C" __attribute__((noinline)) void nativeEasingMenuAddActionInterpose(
    QWidget *widget, QAction *action)
{
    const EasingMenuAddAction original = requireEasingMenuOriginal();
    const std::uintptr_t callerReturnPc = reinterpret_cast<std::uintptr_t>(
        __builtin_return_address(0));
    const bool ready =
        gEasingMenuContractReady.load(std::memory_order_acquire);
    const std::uintptr_t expectedReturnPc = ready ?
        gEasingMenuExpectedReturnPc.load(std::memory_order_acquire) : 0;

    if (callerReturnPc == expectedReturnPc && expectedReturnPc != 0) {
        QByteArray sourceUtf8;
        native_easing_menu::forwardProjectedAction(
            [&]() { original(widget, action); }, ready, callerReturnPc,
            expectedReturnPc,
            []() { return gLocale.value(); },
            [&]() -> std::string_view {
                if (action == nullptr) return {};
                sourceUtf8 = action->text().toUtf8();
                return std::string_view(sourceUtf8.constData(),
                                        static_cast<std::size_t>(sourceUtf8.size()));
            },
            [&](std::string_view projection) {
                action->setText(QString::fromUtf8(
                    projection.data(), static_cast<qsizetype>(projection.size())));
            },
            native_easing_display::kRows);
        return;
    }

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
    std::uintptr_t helperReturnOffset = 0;
    const bool dgContractReady =
        gDgContextMenuContractReady.load(std::memory_order_acquire);
    const std::uintptr_t dgExpectedReturnPc = dgContractReady ?
        gDgContextMenuExpectedReturnPc.load(std::memory_order_acquire) : 0;
    if (dgContractReady && dgExpectedReturnPc != 0 &&
        callerReturnPc == dgExpectedReturnPc && action != nullptr) {
        const std::uintptr_t ownFrame = reinterpret_cast<std::uintptr_t>(
            __builtin_frame_address(0));
        const auto stack = currentThreadStack();
        const auto read = [](std::uintptr_t address, std::size_t size,
                             void *destination) noexcept {
            return readSelf(reinterpret_cast<const void *>(address), size, destination);
        };
        viewport_owner::CallerFrameRecord toolMenuFrame{};
        viewport_owner::CallerFrameRecord helperFrame{};
        if (viewport_owner::callerFrameRecord(ownFrame, stack, read, &toolMenuFrame) &&
            toolMenuFrame.returnPc == dgExpectedReturnPc &&
            viewport_owner::callerFrameRecord(toolMenuFrame.parent, stack, read,
                                               &helperFrame)) {
            const std::uintptr_t extensionBase = reinterpret_cast<std::uintptr_t>(
                imageAddress(gEasingMenuExtensionImage, 0));
            if (extensionBase != 0 && helperFrame.returnPc >= extensionBase)
                helperReturnOffset = helperFrame.returnPc - extensionBase;
        }
    }
    if (dgContractReady && dgExpectedReturnPc != 0 &&
        callerReturnPc == dgExpectedReturnPc && action != nullptr) {
        QByteArray sourceUtf8;
        native_dg_context_menu::forwardProjectedAction(
            [&]() { original(widget, action); }, dgContractReady,
            callerReturnPc, dgExpectedReturnPc, helperReturnOffset,
            []() { return gLocale.value(); },
            [&]() -> std::string_view {
                sourceUtf8 = action->text().toUtf8();
                return std::string_view(sourceUtf8.constData(),
                                        static_cast<std::size_t>(sourceUtf8.size()));
            },
            [&](std::string_view projection) {
                action->setText(QString::fromUtf8(
                    projection.data(), static_cast<qsizetype>(projection.size())));
            },
            native_dg_context_menu::kRows);
        return;
    }
#endif

    original(widget, action);
}
