/**
 * [INPUT]: 依赖Windows x64 ToolMenu/Qt栈返回位、共享source-bound菜单表与native locale。
 * [OUTPUT]: 只把五个精确helper返回与批准source交给共享三语投影策略。
 * [POS]: QWidget::addAction IAT hook到纯菜单策略的薄适配；无界面扫描且原调用只转发一次。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "dg_menu_abi_contract.h"
#include "../../native/dg_context_menu_policy.h"

#include <cstdint>
#include <limits>
#include <string_view>
#include <utility>

namespace native_windows_dg_menu {
template <typename ForwardOriginal, typename ReadLocale, typename ReadSource,
          typename SetDisplayText, typename Rows>
void forwardMenuAction(
    ForwardOriginal &&forwardOriginal,
    bool contractReady,
    std::uintptr_t observedAddActionReturnPc,
    std::uintptr_t helperReturnPc,
    std::uintptr_t extensionBase,
    ReadLocale &&readLocale,
    ReadSource &&readSource,
    SetDisplayText &&setDisplayText,
    const Rows &rows)
{
    const auto actionReturnOffset =
        native_dg_context_menu::contract::kToolMenuAddActionReturnOffset;
    const bool baseFits = extensionBase != 0 &&
        extensionBase <= std::numeric_limits<std::uintptr_t>::max() - actionReturnOffset;
    const bool helperFrameValid = extensionBase != 0 && helperReturnPc >= extensionBase;
    const std::uintptr_t expectedAddActionReturnPc = baseFits
        ? extensionBase + actionReturnOffset : 0;
    const std::uintptr_t helperReturnOffset = helperFrameValid
        ? helperReturnPc - extensionBase : 0;

    native_dg_context_menu::forwardProjectedAction(
        std::forward<ForwardOriginal>(forwardOriginal),
        contractReady && baseFits && helperFrameValid,
        observedAddActionReturnPc, expectedAddActionReturnPc, helperReturnOffset,
        std::forward<ReadLocale>(readLocale),
        std::forward<ReadSource>(readSource),
        std::forward<SetDisplayText>(setDisplayText), rows);
}
}  // namespace native_windows_dg_menu
