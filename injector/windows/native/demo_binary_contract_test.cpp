/**
 * [INPUT]: 依赖显式官方2.8.1 ExtensionLayer PE、锁定SHA与共享只读PE解析器。
 * [OUTPUT]: 核验两个独立Presets脚本reader、runGuiScript下游，以及Import Preset .cvp对照分支。
 * [POS]: 只读供应商二进制合同；不加载vendor代码、不访问用户安装或profile。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "vendor_pe_contract.h"

#include <array>
#include <cstdio>
#include <string_view>

using native_windows_pe_contract::Image;
using native_windows_pe_contract::checkCount;
using native_windows_pe_contract::require;

namespace {
constexpr std::string_view kExtensionSha256 =
    "c2f0fcf5323f90fbd3b1d9d0375bc603e18dc070eae8ff3df72090d8ac858954";
constexpr std::string_view kTextFromFile =
    "?textFromFile@cavalry@@YA?AV?$optional@V?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@@std@@AEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@3@@Z";
constexpr std::string_view kRunGuiScript =
    "?runGuiScript@cavalry@@YAXPEAVApi@@AEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@V?$function@$$A6AXPEAVIsolate@v8@@AEAV?$Local@VContext@v8@@@2@@Z@4@_N3@Z";
constexpr std::string_view kLoadDemoScene =
    "?loadDemoScene@OnboardingManager@onboarding@@AEAAXAEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@@Z";

constexpr std::uintptr_t kTextFromFileIat = 0x1fc1a10;
constexpr std::uintptr_t kRunGuiScriptThunk = 0x17364;
constexpr std::uintptr_t kLoadDemoSceneThunk = 0x250a4;
constexpr std::uintptr_t kLoadDemoSceneBody = 0x87efd0;
constexpr std::uintptr_t kOnboardingReaderReturn = 0x87f0b2;
constexpr std::uintptr_t kOnboardingRunReturn = 0x87f117;
constexpr std::uintptr_t kMenuPresetReaderReturn = 0xca5187;
constexpr std::uintptr_t kMenuPresetRunReturn = 0xca51e9;
constexpr std::uintptr_t kImportPresetReaderReturn = 0x4b59d4;

template <std::size_t N>
void bytes(const Image &image, std::uintptr_t rva,
           const std::array<unsigned char, N> &expected)
{
    image.bytes(rva, expected.data(), expected.size());
}
}  // namespace

int wmain(int argc, wchar_t **argv)
{
    require(argc == 2, "one explicit official ExtensionLayer path required");
    const Image image(argv[1], kExtensionSha256);

    const auto textFromFileIat = image.importSlot("Core.dll", kTextFromFile);
    require(textFromFileIat == kTextFromFileIat, "Core::textFromFile IAT slot is frozen");
    image.importCall(kOnboardingReaderReturn, textFromFileIat);
    image.importCall(kMenuPresetReaderReturn, textFromFileIat);
    image.importCall(kImportPresetReaderReturn, textFromFileIat);

    constexpr std::array<unsigned char, 13> kOnboardingReaderArguments = {
        0x48, 0x8d, 0x4d, 0x70, 0x4c, 0x89, 0xf2,
        0xff, 0x15, 0x5e, 0x29, 0x74, 0x01,
    };
    bytes(image, 0x87f0a5, kOnboardingReaderArguments);
    constexpr std::array<unsigned char, 17> kImportPresetReaderArguments = {
        0x48, 0x8d, 0x7d, 0x10, 0x48, 0x8d, 0x55, 0xf0,
        0x48, 0x89, 0xf9, 0xff, 0x15, 0x3c, 0xc0, 0xb0, 0x01,
    };
    bytes(image, 0x4b59c3, kImportPresetReaderArguments);

    require(image.exportRva(kLoadDemoScene) == kLoadDemoSceneThunk,
            "OnboardingManager::loadDemoScene export is frozen");
    image.directJump(kLoadDemoSceneThunk, kLoadDemoSceneBody);
    require(image.exportRva(kRunGuiScript) == kRunGuiScriptThunk,
            "cavalry::runGuiScript export is frozen");
    image.directCall(kOnboardingRunReturn, kRunGuiScriptThunk);
    image.directCall(kMenuPresetRunReturn, kRunGuiScriptThunk);

    constexpr std::array<unsigned char, 25> kOnboardingScriptArguments = {
        0x48, 0x8b, 0x4e, 0x10, 0xc6, 0x44, 0x24, 0x20, 0x00,
        0x48, 0x8d, 0x55, 0x70, 0x4c, 0x8d, 0x45, 0xb0, 0x41,
        0xb1, 0x01, 0xe8, 0x4d, 0x82, 0x79, 0xff,
    };
    bytes(image, 0x87f0fe, kOnboardingScriptArguments);

    constexpr std::array<unsigned char, 14> kMenuReaderArguments = {
        0x48, 0x8d, 0x56, 0x18, 0x48, 0x8d, 0x4d, 0xe8,
        0xff, 0x15, 0x89, 0xc8, 0x31, 0x01,
    };
    bytes(image, 0xca5179, kMenuReaderArguments);
    constexpr std::array<unsigned char, 25> kMenuScriptArguments = {
        0x48, 0x8b, 0x4e, 0x10, 0xc6, 0x44, 0x24, 0x20, 0x00,
        0x48, 0x8d, 0x55, 0xe8, 0x4c, 0x8d, 0x45, 0xa8, 0x41,
        0xb1, 0x01, 0xe8, 0x7b, 0x21, 0x37, 0xff,
    };
    bytes(image, 0xca51d0, kMenuScriptArguments);
    image.text(0x18d22e7, "Run Preset");

    image.text(0x186a528, "Cavalry Preset (*.cvp)");
    constexpr std::array<unsigned char, 28> kImportPresetTitle = {
        0x48, 0xb8, 'I', 'm', 'p', 'o', 'r', 't', ' ', 'P',
        0x48, 0x89, 0x45, 0x38,
        0x48, 0xb8, 't', ' ', 'P', 'r', 'e', 's', 'e', 't',
        0x48, 0x89, 0x45, 0x3d,
    };
    bytes(image, 0x4b5909, kImportPresetTitle);
    constexpr std::array<unsigned char, 21> kImportPresetCommand = {
        0x48, 0xb8, 'i', 'm', 'p', 'o', 'r', 't', 'P', 'r',
        0x48, 0x89, 0x45, 0x38,
        0xc7, 0x45, 0x40, 'e', 's', 'e', 't',
    };
    bytes(image, 0x4b59f6, kImportPresetCommand);
    image.directCall(0x4b5a27, 0x233bc);

    std::printf("PASS: %u official Windows Demo reader/import ABI checks\n", checkCount());
}
