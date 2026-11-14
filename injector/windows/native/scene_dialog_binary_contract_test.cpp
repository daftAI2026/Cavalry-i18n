/**
 * [INPUT]: 依赖显式官方2.8.1 ExtensionLayer PE、Windows PE结构与scene dialog ABI常量。
 * [OUTPUT]: 只读验证SHA、Qt QFileDialog IAT、scene wrapper及Load .cv尾跳调用窗。
 * [POS]: 供应商二进制合同；不加载vendor代码、不访问用户安装或profile。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "scene_dialog_abi_contract.h"
#include "vendor_pe_contract.h"

#include <array>
#include <cstdio>
#include <string_view>

namespace abi = native_windows_scene_dialog::contract;
using native_windows_pe_contract::Image;
using native_windows_pe_contract::checkCount;
using native_windows_pe_contract::require;

int wmain(int argc, wchar_t **argv)
{
    require(argc == 2, "one explicit official ExtensionLayer path required");
    const Image image(argv[1], abi::kExtensionSha256);
    constexpr std::string_view kSaveName =
        "?getSaveFileName@QFileDialog@@SA?AVQString@@PEAVQWidget@@AEBV2@11PEAV2@V?$QFlags@W4Option@QFileDialog@@@@@Z";
    constexpr std::string_view kOpenName =
        "?getOpenFileName@QFileDialog@@SA?AVQString@@PEAVQWidget@@AEBV2@11PEAV2@V?$QFlags@W4Option@QFileDialog@@@@@Z";
    const auto saveSlot = image.importSlot("Qt6Widgets.dll", kSaveName);
    const auto openSlot = image.importSlot("Qt6Widgets.dll", kOpenName);
    require(saveSlot == abi::kGetSaveFileNameIatRva, "getSaveFileName IAT RVA is frozen");
    require(openSlot == abi::kGetOpenFileNameIatRva, "getOpenFileName IAT RVA is frozen");

    image.importCall(abi::kSceneSaveFileDialogReturnRva, saveSlot);
    image.importCall(abi::kSceneOpenFileDialogReturnRva, openSlot);
    image.importCall(abi::kPresetExportFileDialogReturnRva, saveSlot);
    image.importCall(abi::kSnippetExportFileDialogReturnRva, saveSlot);
    image.importCall(abi::kPresetOpenFileDialogReturnRva, openSlot);
    image.importCall(abi::kSnippetImportFileDialogReturnRva, openSlot);

    constexpr std::array<unsigned char, 10> kLoadCaptionConstructor = {
        0x48, 0xb8, 'L', 'o', 'a', 'd', ' ', '.', 'c', 'v'};
    image.bytes(abi::kLoadCaptionImmediateRva, kLoadCaptionConstructor.data(),
                kLoadCaptionConstructor.size());
    image.directCall(abi::kSceneOpenThunkReturnRva, abi::kSceneOpenThunkRva);
    image.directJump(abi::kSceneOpenThunkRva, abi::kSceneOpenFileDialogWrapperRva);
    std::printf("PASS: %u official Windows scene-dialog ABI checks\n", checkCount());
}
