/**
 * [INPUT]: 依赖五个已审TransformTool helper返回点、精确英文源与native locale。
 * [OUTPUT]: 只为现有五条批准显示译文提供三语投影。
 * [POS]: Vendor-free窄策略；不改变QAction身份、菜单结构或模型数据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "dg_context_menu_abi_contract.h"
#include "native_locale_snapshot.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <string_view>
#include <utility>

namespace native_dg_context_menu {
struct Row {
    std::string_view identity;
    std::uintptr_t helperReturnOffset;
    std::string_view source;
    std::string_view zhHans;
    std::string_view zhHant;
    std::string_view japanese;
};

template <typename Rows>
bool hasHelperCaller(std::uintptr_t helperReturnOffset, const Rows &rows) noexcept
{
    for (const Row &row : rows) {
        if (row.helperReturnOffset == helperReturnOffset) return true;
    }
    return false;
}

template <typename Rows>
const Row *sourceRow(std::uintptr_t helperReturnOffset,
                     std::string_view source,
                     const Rows &rows) noexcept
{
    if (helperReturnOffset == 0 || source.empty()) return nullptr;
    const Row *found = nullptr;
    for (const Row &row : rows) {
        if (row.helperReturnOffset != helperReturnOffset || row.source != source)
            continue;
        if (found != nullptr || row.identity.empty()) return nullptr;
        found = &row;
    }
    return found;
}

inline std::string_view translation(
    const Row &row, cavalry_native_font::Locale locale) noexcept
{
    using cavalry_native_font::Locale;
    switch (locale) {
        case Locale::Hans: return row.zhHans;
        case Locale::Hant: return row.zhHant;
        case Locale::Japanese: return row.japanese;
        case Locale::Unset:
        case Locale::English:
        case Locale::Unknown: return {};
    }
    return {};
}

template <typename ForwardOriginal, typename ReadLocale, typename ReadSource,
          typename SetDisplayText, typename Rows>
void forwardProjectedAction(
    ForwardOriginal &&forwardOriginal,
    bool contractReady,
    std::uintptr_t observedToolMenuReturnPc,
    std::uintptr_t expectedToolMenuReturnPc,
    std::uintptr_t helperReturnOffset,
    ReadLocale &&readLocale,
    ReadSource &&readSource,
    SetDisplayText &&setDisplayText,
    const Rows &rows)
{
    if (!contractReady || expectedToolMenuReturnPc == 0 ||
        observedToolMenuReturnPc != expectedToolMenuReturnPc ||
        !hasHelperCaller(helperReturnOffset, rows)) {
        std::forward<ForwardOriginal>(forwardOriginal)();
        return;
    }

    const std::string_view source = std::forward<ReadSource>(readSource)();
    const Row *row = sourceRow(helperReturnOffset, source, rows);
    if (row == nullptr) {
        std::forward<ForwardOriginal>(forwardOriginal)();
        return;
    }

    const std::string_view projection = translation(
        *row, std::forward<ReadLocale>(readLocale)());
    if (!projection.empty())
        std::forward<SetDisplayText>(setDisplayText)(projection);
    std::forward<ForwardOriginal>(forwardOriginal)();
}
}  // namespace native_dg_context_menu
