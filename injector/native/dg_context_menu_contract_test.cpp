/**
 * [INPUT]: 依赖281 arm64菜单ABI偏移、source-bound表、Qt QAction与locale策略。
 * [OUTPUT]: 验证helper/source双门、三语投影、单次转发及QAction身份/数据/信号保留。
 * [POS]: Vendor-free合同；不证明真实二进制加载或实屏菜单显示。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "dg_context_menu_policy.h"
#ifndef NATIVE_DG_CONTEXT_MENU_TABLE
#error "合同测试必须消费source-bound DG/TransformTool表。"
#endif
#include NATIVE_DG_CONTEXT_MENU_TABLE

#include <array>
#include <cstddef>
#include <cstdint>
#include <string_view>

#include <QtCore/QByteArray>
#include <QtCore/QCoreApplication>
#include <QtCore/QString>
#include <QtCore/QVariant>
#include <QtGui/QAction>
#include <QtGui/QGuiApplication>

namespace {
using native_dg_context_menu::Row;
using cavalry_native_font::Locale;

bool uniqueRows() noexcept
{
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
}  // namespace

int main(int argc, char **argv)
{
    using namespace native_dg_context_menu;
    using namespace native_dg_context_menu::contract;
    QGuiApplication application(argc, argv);
    (void)application;
    static_assert(kRows.size() == 5);
    static_assert(arm64BranchTarget(kAddGroupActionCallOffset,
                                    kAddGroupActionBranchBytes) ==
                  kToolMenuAddMenuItemOffset);
    if (!uniqueRows()) return 1;

    struct Expected {
        std::uintptr_t helper;
        std::string_view source;
        std::string_view hans;
        std::string_view hant;
        std::string_view japanese;
    };
    constexpr std::array<Expected, 5> expected = {{
        {kAddDuplicatorActionsReturnOffset, "Add to Duplicator", "添加到复制器",
         "新增至複製器", "デュプリケーターに追加"},
        {kAddGroupActionReturnOffset, "Group Selected", "将所选项编组",
         "將所選項目群組", "選択項目をグループ化"},
        {kAddLockActionReturnOffset, "Lock Selected", "锁定所选图层",
         "鎖定所選圖層", "選択項目をロック"},
        {kAddShowAttributeEditorReturnOffset, "Show in Attribute Editor",
         "在属性编辑器中显示", "在屬性編輯器中顯示", "属性エディターで表示"},
        {kAddShowSceneWindowReturnOffset, "Show in Scene Window",
         "在场景窗口中显示", "在場景視窗中顯示", "シーンウィンドウで表示"},
    }};
    for (const Expected &row : expected) {
        const Row *matched = sourceRow(row.helper, row.source, kRows);
        if (matched == nullptr || translation(*matched, Locale::Hans) != row.hans ||
            translation(*matched, Locale::Hant) != row.hant ||
            translation(*matched, Locale::Japanese) != row.japanese) return 2;
        if (sourceRow(row.helper, "different source", kRows) != nullptr ||
            sourceRow(row.helper + 4, row.source, kRows) != nullptr) return 3;
    }

    if (sourceRow(kAddDuplicatorActionsReturnOffset, "Add to Duplicator",
                  kRows) == nullptr ||
        sourceRow(kAddDuplicatorActionsReturnOffset, "Add to Duplicator ",
                  kRows) != nullptr ||
        !translation(kRows[0], Locale::Unset).empty() ||
        !translation(kRows[0], Locale::English).empty() ||
        !translation(kRows[0], Locale::Unknown).empty() ||
        hasHelperCaller(kToolMenuAddActionReturnOffset, kRows)) return 4;

    constexpr std::array<Row, 2> duplicateRows = {{
        {"one", kAddGroupActionReturnOffset, "Group Selected", "H1", "T1", "J1"},
        {"two", kAddGroupActionReturnOffset, "Group Selected", "H2", "T2", "J2"},
    }};
    if (sourceRow(kAddGroupActionReturnOffset, "Group Selected", duplicateRows) != nullptr)
        return 5;

    struct Counters {
        int sourceReads = 0;
        int localeReads = 0;
        int writes = 0;
        int forwards = 0;
        bool ready = true;
        std::uintptr_t observedToolMenuPc = 0x1000;
        std::uintptr_t expectedToolMenuPc = 0x1000;
        std::uintptr_t helper = kAddGroupActionReturnOffset;
        Locale locale = Locale::Hans;
        std::string_view source = "Group Selected";
        std::string_view written;
    };
    const auto run = [](Counters &state) {
        forwardProjectedAction(
            [&]() { ++state.forwards; }, state.ready,
            state.observedToolMenuPc, state.expectedToolMenuPc, state.helper,
            [&]() { ++state.localeReads; return state.locale; },
            [&]() { ++state.sourceReads; return state.source; },
            [&](std::string_view display) { ++state.writes; state.written = display; },
            kRows);
    };

    Counters unknownCaller;
    unknownCaller.observedToolMenuPc = 0x2000;
    run(unknownCaller);
    if (unknownCaller.sourceReads != 0 || unknownCaller.localeReads != 0 ||
        unknownCaller.writes != 0 || unknownCaller.forwards != 1) return 6;

    Counters unknownHelper;
    unknownHelper.helper = 0x9000;
    run(unknownHelper);
    if (unknownHelper.sourceReads != 0 || unknownHelper.localeReads != 0 ||
        unknownHelper.writes != 0 || unknownHelper.forwards != 1) return 7;

    Counters unavailableContract;
    unavailableContract.ready = false;
    run(unavailableContract);
    if (unavailableContract.sourceReads != 0 || unavailableContract.localeReads != 0 ||
        unavailableContract.writes != 0 || unavailableContract.forwards != 1) return 8;

    Counters wrongSource;
    wrongSource.source = "Group selected";
    run(wrongSource);
    if (wrongSource.sourceReads != 1 || wrongSource.localeReads != 0 ||
        wrongSource.writes != 0 || wrongSource.forwards != 1) return 9;

    Counters exactSource;
    exactSource.locale = Locale::Hant;
    run(exactSource);
    if (exactSource.sourceReads != 1 || exactSource.localeReads != 1 ||
        exactSource.writes != 1 || exactSource.forwards != 1 ||
        exactSource.written != "將所選項目群組") return 10;

    Counters english;
    english.locale = Locale::English;
    run(english);
    if (english.sourceReads != 1 || english.localeReads != 1 ||
        english.writes != 0 || english.forwards != 1) return 11;

    struct SetterFailure {};
    Counters setterThrows;
    try {
        forwardProjectedAction(
            [&]() { ++setterThrows.forwards; }, true,
            setterThrows.observedToolMenuPc, setterThrows.expectedToolMenuPc,
            setterThrows.helper,
            [&]() { ++setterThrows.localeReads; return Locale::Hans; },
            [&]() { ++setterThrows.sourceReads; return std::string_view("Group Selected"); },
            [&](std::string_view) { ++setterThrows.writes; throw SetterFailure{}; },
            kRows);
        return 12;
    } catch (const SetterFailure &) {
        if (setterThrows.forwards != 0 || setterThrows.writes != 1) return 13;
    }

    QAction action(QStringLiteral("Group Selected"));
    const QVariant actionData = QVariant::fromValue(QByteArray("kept-action-data"));
    action.setData(actionData);
    QAction *const originalIdentity = &action;
    bool triggered = false;
    QObject::connect(&action, &QAction::triggered,
                     [&](bool) { triggered = true; });
    QByteArray actionSourceUtf8;
    int widgetForwards = 0;
    bool actionIdentityAndDataPreserved = false;
    forwardProjectedAction(
        [&]() {
            ++widgetForwards;
            actionIdentityAndDataPreserved = &action == originalIdentity &&
                action.data() == actionData;
        },
        true, 0x1118, 0x1118, kAddGroupActionReturnOffset,
        []() { return Locale::Hans; },
        [&]() -> std::string_view {
            actionSourceUtf8 = action.text().toUtf8();
            return std::string_view(actionSourceUtf8.constData(),
                                    static_cast<std::size_t>(actionSourceUtf8.size()));
        },
        [&](std::string_view display) {
            action.setText(QString::fromUtf8(
                display.data(), static_cast<qsizetype>(display.size())));
        },
        kRows);
    action.trigger();
    if (widgetForwards != 1 || !actionIdentityAndDataPreserved || !triggered ||
        action.text() != QStringLiteral("将所选项编组") || action.data() != actionData)
        return 14;

    return 0;
}
