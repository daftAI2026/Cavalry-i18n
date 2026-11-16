/**
 * [INPUT]: 依赖官方UUID表、当前Intel ABI头与语言快照策略。
 * [OUTPUT]: 编译实际Intel ABI头，并验证owner返回PC门与单次原getter快照发布。
 * [POS]: vendor-free x86 ABI边界合同；不伪称厂商映像已准入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "native_candidate_architecture.h"
#include "native_locale_x86_64_abi_contract.h"
#include "native_locale_snapshot.h"
#include "native_locale_abi_contract.h"
#include "help_popup_layout_abi_contract.h"
#include "title_format_abi_contract.h"
#include "dependency_node_font_abi_contract.h"
#include "demo_reader_abi_contract.h"
#include "save_scene_caption_abi_contract.h"
#include "welcome_log_it_abi_contract.h"
#include "dg_context_menu_abi_contract.h"

#include <cstdio>
#include <cstring>
#include <limits>

using native_candidate_architecture::Architecture;
using native_candidate_architecture::ImageRole;
namespace getter_contract = native_locale_interpose::x86_64_contract;

static_assert(native_candidate_architecture::kBuildArchitecture ==
              Architecture::X86_64);
static_assert(getter_contract::kGetterEntryOffset == 0x21570);
static_assert(getter_contract::kRegisterNodesSetupReturnOffset == 0xd10085);
static_assert(getter_contract::kGotOffset == 0x1128528);
static_assert(getter_contract::kGetterEntryBytes.size() == 15);
static_assert(getter_contract::kActiveLocaleStubBytes.size() == 6);

namespace {
int gFailures = 0;

void expectUuid(ImageRole role, const char *expected, const char *name)
{
    const char *actual = native_candidate_architecture::expectedUuid(
        role, Architecture::X86_64);
    if (actual == nullptr || std::strcmp(actual, expected) != 0) {
        std::fprintf(stderr, "FAIL: x86_64 %s UUID selection\n", name);
        ++gFailures;
    }
}

bool exactOwnerReturnPcIsRequired()
{
    constexpr std::uintptr_t extensionBase = 0x10000000;
    constexpr std::uintptr_t ownerReturn = extensionBase +
        getter_contract::kRegisterNodesSetupReturnOffset;
    constexpr std::uintptr_t unrelatedReturn = extensionBase +
        (getter_contract::kRegisterNodesSetupReturnOffset + 0x10);
    return getter_contract::isRegisterNodesSetupOwnerReturn(
               true, extensionBase, ownerReturn) &&
        !getter_contract::isRegisterNodesSetupOwnerReturn(
               false, extensionBase, ownerReturn) &&
        !getter_contract::isRegisterNodesSetupOwnerReturn(
               true, extensionBase, ownerReturn + 1) &&
        !getter_contract::isRegisterNodesSetupOwnerReturn(
               true, extensionBase, unrelatedReturn) &&
        !getter_contract::isRegisterNodesSetupOwnerReturn(
               true, 0, ownerReturn) &&
        !getter_contract::isRegisterNodesSetupOwnerReturn(
               true, std::numeric_limits<std::uintptr_t>::max() -
                   getter_contract::kRegisterNodesSetupReturnOffset + 1,
               ownerReturn);
}

bool ownerForwardsOnceAndPublishesOnlyItsLocale()
{
    constexpr std::uintptr_t extensionBase = 0x20000000;
    constexpr std::uintptr_t ownerReturn = extensionBase +
        getter_contract::kRegisterNodesSetupReturnOffset;
    int calls = 0;
    cavalry_native_font::LocaleSnapshot snapshot{};
    const auto getter = [&calls](int *) {
        ++calls;
        return std::string("zh-Hant");
    };
    const bool exactOwner = getter_contract::isRegisterNodesSetupOwnerReturn(
        true, extensionBase, ownerReturn);
    const std::string result = cavalry_native_font::forwardNativeLocale(
        static_cast<int *>(nullptr), getter, exactOwner, snapshot);
    if (calls != 1 || result != "zh-Hant" ||
        snapshot.value() != cavalry_native_font::Locale::Hant) return false;

    const auto unrelatedGetter = [&calls](int *) {
        ++calls;
        return std::string("ja");
    };
    const bool unrelatedOwner = getter_contract::isRegisterNodesSetupOwnerReturn(
        true, extensionBase, extensionBase +
            (getter_contract::kRegisterNodesSetupReturnOffset + 0x10));
    const std::string unrelated = cavalry_native_font::forwardNativeLocale(
        static_cast<int *>(nullptr), unrelatedGetter, unrelatedOwner, snapshot);
    return calls == 2 && unrelated == "ja" &&
        snapshot.value() == cavalry_native_font::Locale::Hant;
}
}  // namespace

int main()
{
    expectUuid(ImageRole::Core, "23B9AC22-F909-3455-BD02-4E90796E35B5", "Core");
    expectUuid(ImageRole::Extension, "AEAD00DA-F97D-3DD0-9602-D5668F1341A2", "Extension");
    expectUuid(ImageRole::Skia, "86ACD2F2-91F5-308C-BBAE-23183E8D218D", "Skia");
    expectUuid(ImageRole::Api, "8A40A6FC-DE65-3845-8EA1-F1E80A2F0CCD", "API");
    expectUuid(ImageRole::Fmt, "0C65A571-5BBA-3F94-BC62-B9F37A629184", "fmt");
    expectUuid(ImageRole::Spdlog, "B2A4829C-F4AE-30AE-A15A-DB00BB634B61", "spdlog");
    expectUuid(ImageRole::CavalryUi, "3CC166C8-F163-3F2D-8AEC-B19A8EBCDE71", "CavalryUI");
    expectUuid(ImageRole::QtCore, "3A22E432-F63B-344F-8555-EFFC3A9E92AB", "QtCore");
    expectUuid(ImageRole::QtGui, "C5244FEA-136F-3ED0-8F82-85A535F14F2B", "QtGui");
    expectUuid(ImageRole::QtWidgets, "0C194E6E-1E76-3FD4-83A3-9263616E2F3F", "QtWidgets");
    if (!exactOwnerReturnPcIsRequired()) {
        std::fprintf(stderr, "FAIL: x86 locale snapshot requires exact ready owner return PC\n");
        ++gFailures;
    }
    if (!ownerForwardsOnceAndPublishesOnlyItsLocale()) {
        std::fprintf(stderr, "FAIL: x86 locale owner forwards once and preserves nonowner state\n");
        ++gFailures;
    }
    if (gFailures != 0) return 1;
    std::puts("PASS: x86_64 UUIDs, exact getter owner, and single-forward locale snapshot");
    return 0;
}
