/**
 * [INPUT]: 依赖Windows菜单ABI、构建期共享五行审批表与native locale策略。
 * [OUTPUT]: 验证五行source/helper映射、三语投影门与原调用单次透传。
 * [POS]: 不加载vendor代码的策略合同；译文仍只来自共享生成表。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "dg_menu_adapter.h"

#ifndef NATIVE_DG_CONTEXT_MENU_TABLE
#error "DG contract requires the shared generated menu table"
#endif
#include NATIVE_DG_CONTEXT_MENU_TABLE

#include <array>
#include <cstddef>
#include <cstdint>
#include <initializer_list>
#include <string_view>

namespace {
using native_dg_context_menu::Row;
using cavalry_native_font::Locale;
constexpr std::uintptr_t kExtensionBase = 0x180000000;

bool uniqueRows() noexcept
{
    if (native_dg_context_menu::kRows.size() != 5) return false;
    for (std::size_t i = 0; i < native_dg_context_menu::kRows.size(); ++i) {
        const Row &row = native_dg_context_menu::kRows[i];
        if (row.identity.empty() || row.helperReturnOffset == 0 || row.source.empty() ||
            row.zhHans.empty() || row.zhHant.empty() || row.japanese.empty()) return false;
        for (std::size_t j = i + 1; j < native_dg_context_menu::kRows.size(); ++j) {
            const Row &other = native_dg_context_menu::kRows[j];
            if (row.identity == other.identity ||
                row.helperReturnOffset == other.helperReturnOffset ||
                row.source == other.source) return false;
        }
    }
    return true;
}

struct Run {
    std::uintptr_t actionReturnPc = kExtensionBase +
        native_dg_context_menu::contract::kToolMenuAddActionReturnOffset;
    std::uintptr_t helperReturnPc = kExtensionBase +
        native_dg_context_menu::contract::kAddGroupActionReturnOffset;
    bool ready = true;
    Locale locale = Locale::Hans;
    std::string_view source = "Group Selected";
    std::string_view projected;
    int sourceReads = 0;
    int localeReads = 0;
    int writes = 0;
    int forwards = 0;
};

void run(Run &state)
{
    native_windows_dg_menu::forwardMenuAction(
        [&]() { ++state.forwards; }, state.ready,
        state.actionReturnPc, state.helperReturnPc, kExtensionBase,
        [&]() { ++state.localeReads; return state.locale; },
        [&]() { ++state.sourceReads; return state.source; },
        [&](std::string_view text) { ++state.writes; state.projected = text; },
        native_dg_context_menu::kRows);
}
}  // namespace

int main()
{
    using namespace native_dg_context_menu;
    using namespace native_dg_context_menu::contract;
    if (!uniqueRows()) return 1;

    struct Expected { std::uintptr_t helper; std::string_view identity; std::string_view source; };
    constexpr std::array<Expected, 5> expected = {{
        {kAddDuplicatorActionsReturnOffset, "transformTool.addDuplicator", "Add to Duplicator"},
        {kAddGroupActionReturnOffset, "transformTool.groupSelected", "Group Selected"},
        {kAddLockActionReturnOffset, "transformTool.lockSelected", "Lock Selected"},
        {kAddShowAttributeEditorReturnOffset, "transformTool.showInAttributeEditor", "Show in Attribute Editor"},
        {kAddShowSceneWindowReturnOffset, "transformTool.showInSceneWindow", "Show in Scene Window"},
    }};
    for (const auto &entry : expected) {
        const Row *row = sourceRow(entry.helper, entry.source, kRows);
        if (row == nullptr || row->identity != entry.identity ||
            !hasHelperCaller(entry.helper, kRows)) return 2;
        if (sourceRow(entry.helper, "different source", kRows) != nullptr ||
            sourceRow(entry.helper + 1, entry.source, kRows) != nullptr) return 3;
    }
    if (hasHelperCaller(kToolMenuAddActionReturnOffset, kRows) ||
        !translation(kRows[0], Locale::Unset).empty() ||
        !translation(kRows[0], Locale::English).empty() ||
        !translation(kRows[0], Locale::Unknown).empty()) return 4;

    for (const auto locale : {Locale::Hans, Locale::Hant, Locale::Japanese}) {
        for (const auto &entry : expected) {
            Run exact;
            exact.helperReturnPc = kExtensionBase + entry.helper;
            exact.locale = locale;
            exact.source = entry.source;
            run(exact);
            const Row *row = sourceRow(entry.helper, entry.source, kRows);
            if (row == nullptr || exact.sourceReads != 1 || exact.localeReads != 1 ||
                exact.writes != 1 || exact.forwards != 1 ||
                exact.projected != translation(*row, locale)) return 5;
        }
    }

    Run wrongActionCall;
    wrongActionCall.actionReturnPc += 1;
    run(wrongActionCall);
    if (wrongActionCall.sourceReads != 0 || wrongActionCall.localeReads != 0 ||
        wrongActionCall.writes != 0 || wrongActionCall.forwards != 1) return 6;

    Run unknownHelper;
    unknownHelper.helperReturnPc = kExtensionBase + 0x155555;
    run(unknownHelper);
    if (unknownHelper.sourceReads != 0 || unknownHelper.localeReads != 0 ||
        unknownHelper.writes != 0 || unknownHelper.forwards != 1) return 7;

    Run missingHelperFrame;
    missingHelperFrame.helperReturnPc = 0;
    run(missingHelperFrame);
    if (missingHelperFrame.sourceReads != 0 || missingHelperFrame.localeReads != 0 ||
        missingHelperFrame.writes != 0 || missingHelperFrame.forwards != 1) return 8;

    Run unavailableContract;
    unavailableContract.ready = false;
    run(unavailableContract);
    if (unavailableContract.sourceReads != 0 || unavailableContract.localeReads != 0 ||
        unavailableContract.writes != 0 || unavailableContract.forwards != 1) return 9;

    Run alternateLockLabel;
    alternateLockLabel.helperReturnPc = kExtensionBase + kAddLockActionReturnOffset;
    alternateLockLabel.source = "Unlock Selected";
    run(alternateLockLabel);
    if (alternateLockLabel.sourceReads != 1 || alternateLockLabel.localeReads != 0 ||
        alternateLockLabel.writes != 0 || alternateLockLabel.forwards != 1) return 10;

    Run english;
    english.locale = Locale::English;
    run(english);
    if (english.sourceReads != 1 || english.localeReads != 1 ||
        english.writes != 0 || english.forwards != 1) return 11;

    return 0;
}
