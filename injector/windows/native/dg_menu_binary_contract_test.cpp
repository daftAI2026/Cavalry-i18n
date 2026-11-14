/**
 * [INPUT]: 依赖显式官方2.8.1 ExtensionLayer PE与共享只读PE解析器。
 * [OUTPUT]: 核验ToolMenu导出、五个source caller、Qt addAction IAT与真实代码字节。
 * [POS]: 只读供应商binary合同；不加载vendor代码、不访问用户安装或profile。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "dg_menu_abi_contract.h"
#include "vendor_pe_contract.h"

#include <array>
#include <cstdio>
#include <initializer_list>
#include <string_view>

namespace abi = native_dg_context_menu::contract;
using native_windows_pe_contract::Image;
using native_windows_pe_contract::checkCount;
using native_windows_pe_contract::require;

void requireBytes(const Image &image, std::uintptr_t rva,
                  std::initializer_list<unsigned char> expected)
{
    image.bytes(rva, expected.begin(), expected.size());
}

int wmain(int argc, wchar_t **argv)
{
    require(argc == 2, "one explicit official ExtensionLayer path required");
    const Image image(argv[1], abi::kExtensionSha256);

    require(image.exportRva(abi::kToolMenuAddMenuItemSymbol) ==
                abi::kToolMenuAddMenuItemThunkOffset,
            "ToolMenu::addMenuItem export resolves to the frozen thunk");
    image.directJump(abi::kToolMenuAddMenuItemThunkOffset,
                     abi::kToolMenuAddMenuItemOffset);

    const auto addActionSlot = image.importSlot("Qt6Widgets.dll", abi::kQWidgetAddActionSymbol);
    require(addActionSlot == abi::kAddActionImportRva,
            "QWidget::addAction IAT slot is frozen");
    image.importCall(abi::kToolMenuAddActionReturnOffset, addActionSlot);

    image.directCall(abi::kAddDuplicatorActionsReturnOffset,
                     abi::kToolMenuAddMenuItemThunkOffset);
    image.directCall(abi::kAddGroupActionReturnOffset,
                     abi::kToolMenuAddMenuItemThunkOffset);
    image.directCall(abi::kAddLockActionReturnOffset,
                     abi::kToolMenuAddMenuItemThunkOffset);
    image.directCall(abi::kAddShowAttributeEditorReturnOffset,
                     abi::kToolMenuAddMenuItemThunkOffset);
    image.directCall(abi::kAddShowSceneWindowReturnOffset,
                     abi::kToolMenuAddMenuItemThunkOffset);

    image.text(abi::kAddDuplicatorSourceRva, "Add to Duplicator");
    requireBytes(image, 0x015deff1, {0x0f, 0x10, 0x05});
    require(image.ripRelativeTarget(0x015deff1, 7, 3) == abi::kAddDuplicatorSourceRva,
            "Add to Duplicator menu source is passed from the official literal");

    constexpr std::array<unsigned char, 26> kAddDuplicatorArguments = {
        0x48, 0x8d, 0x55, 0x30, 0x48, 0x8d, 0x7d, 0xa8,
        0x48, 0x8d, 0x75, 0xe8, 0x48, 0x89, 0xd9, 0x49,
        0x89, 0xf8, 0x49, 0x89, 0xf1, 0xe8, 0xad, 0x9c,
        0xa3, 0xfe,
    };
    image.bytes(0x015df001, kAddDuplicatorArguments.data(), kAddDuplicatorArguments.size());

    constexpr std::array<unsigned char, 28> kGroupSourceConstruction = {
        0x48, 0xb9, 'G', 'r', 'o', 'u', 'p', ' ', 'S', 'e',
        0x48, 0x89, 0x4d, 0x38,
        0x48, 0xb9, 'S', 'e', 'l', 'e', 'c', 't', 'e', 'd',
        0x48, 0x89, 0x4d, 0x3e,
    };
    image.bytes(0x015dd41e, kGroupSourceConstruction.data(), kGroupSourceConstruction.size());
    constexpr std::array<unsigned char, 16> kGroupArguments = {
        0x48, 0x8d, 0x55, 0x38, 0x4c, 0x8d, 0x4d, 0xb0,
        0x48, 0x89, 0xc1, 0xe8, 0x7e, 0xb8, 0xa3, 0xfe,
    };
    image.bytes(0x015dd43a, kGroupArguments.data(), kGroupArguments.size());

    image.text(abi::kLockSelectedSourceRva, "Lock Selected");
    image.text(abi::kUnlockSelectedSourceRva, "Unlock Selected");
    requireBytes(image, 0x015dd761, {0x48, 0x8d, 0x05});
    requireBytes(image, 0x015dd768, {0x48, 0x8d, 0x15});
    require(image.ripRelativeTarget(0x015dd761, 7, 3) == abi::kUnlockSelectedSourceRva &&
                image.ripRelativeTarget(0x015dd768, 7, 3) == abi::kLockSelectedSourceRva,
            "Lock/Unlock labels are selected by the helper state");
    requireBytes(image, 0x015dd76f, {0x45, 0x84, 0xe4, 0x48, 0x0f, 0x45, 0xd0});
    constexpr std::array<unsigned char, 18> kLockArguments = {
        0x4c, 0x8d, 0x4d, 0x10, 0x48, 0x89, 0xd9, 0x48,
        0x89, 0xfa, 0x4d, 0x89, 0xf0, 0xe8, 0x16, 0xb5,
        0xa3, 0xfe,
    };
    image.bytes(0x015dd7a0, kLockArguments.data(), kLockArguments.size());

    image.text(abi::kShowAttributeSourceRva, "Show in Attribute Editor");
    requireBytes(image, 0x015dd02c, {0x0f, 0x10, 0x05});
    require(image.ripRelativeTarget(0x015dd02c, 7, 3) == abi::kShowAttributeSourceRva,
            "Attribute Editor menu source is loaded from the official literal");
    constexpr std::array<unsigned char, 26> kAttributeArguments = {
        0x48, 0x8d, 0x55, 0x38, 0x4c, 0x8d, 0x75, 0xf8,
        0x48, 0x8d, 0x5d, 0xb0, 0x48, 0x89, 0xf1, 0x4d,
        0x89, 0xf0, 0x49, 0x89, 0xd9, 0xe8, 0x66, 0xbc,
        0xa3, 0xfe,
    };
    image.bytes(0x015dd048, kAttributeArguments.data(), kAttributeArguments.size());

    image.text(abi::kShowSceneSourceRva, "Show in Scene Window");
    requireBytes(image, 0x015dd10e, {0x0f, 0x10, 0x05});
    require(image.ripRelativeTarget(0x015dd10e, 7, 3) == abi::kShowSceneSourceRva,
            "Scene Window menu source is loaded from the official literal");
    constexpr std::array<unsigned char, 26> kSceneArguments = {
        0x48, 0x8d, 0x55, 0x38, 0x48, 0x8d, 0x5d, 0xf8,
        0x48, 0x8d, 0x7d, 0xb0, 0x48, 0x89, 0xf1, 0x49,
        0x89, 0xd8, 0x49, 0x89, 0xf9, 0xe8, 0x8b, 0xbb,
        0xa3, 0xfe,
    };
    image.bytes(0x015dd123, kSceneArguments.data(), kSceneArguments.size());

    std::printf("PASS: %u real Windows TransformTool DG menu ABI checks\n", checkCount());
}
