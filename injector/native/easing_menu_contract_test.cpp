/**
 * [INPUT]: 依赖 Easing caller合同、纯投影策略与native locale枚举。
 * [OUTPUT]: 验证20项精确源映射、未知输入短路、单次原调用与异常透传。
 * [POS]: Vendor-free策略测试；合成译文不证明真实表或App消费。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "easing_menu_abi_contract.h"
#include "easing_menu_policy.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <string_view>

namespace {
struct Row {
    std::string_view identity;
    std::string_view source;
    std::string_view zhHans;
    std::string_view zhHant;
    std::string_view japanese;
};

constexpr std::array<Row, 20> kSyntheticRows = {{
    {"test.none", "None", "H:none", "T:none", "J:none"},
    {"test.slow_in", "Slow In", "H:slow-in", "T:slow-in", "J:slow-in"},
    {"test.slow_out", "Slow Out", "H:slow-out", "T:slow-out", "J:slow-out"},
    {"test.slow_in_out", "Slow In, Slow Out", "H:slow-pair", "T:slow-pair", "J:slow-pair"},
    {"test.very_slow_in", "Very Slow In", "H:vslow-in", "T:vslow-in", "J:vslow-in"},
    {"test.very_slow_out", "Very Slow Out", "H:vslow-out", "T:vslow-out", "J:vslow-out"},
    {"test.very_slow_in_out", "Very Slow In, Very Slow Out", "H:vslow-pair", "T:vslow-pair", "J:vslow-pair"},
    {"test.spring_in", "Spring In", "H:spring-in", "T:spring-in", "J:spring-in"},
    {"test.spring_out", "Spring Out", "H:spring-out", "T:spring-out", "J:spring-out"},
    {"test.spring_in_out", "Spring In, Spring Out", "H:spring-pair", "T:spring-pair", "J:spring-pair"},
    {"test.small_spring_in", "Small Spring In", "H:small-in", "T:small-in", "J:small-in"},
    {"test.small_spring_out", "Small Spring Out", "H:small-out", "T:small-out", "J:small-out"},
    {"test.small_spring_in_out", "Small Spring In, Small Spring Out", "H:small-pair", "T:small-pair", "J:small-pair"},
    {"test.anticipate_in", "Anticipate In", "H:anticipate", "T:anticipate", "J:anticipate"},
    {"test.overshoot_out", "Overshoot Out", "H:overshoot", "T:overshoot", "J:overshoot"},
    {"test.anticipate_overshoot", "Anticipate In, Overshoot Out", "H:anticipate-overshoot", "T:anticipate-overshoot", "J:anticipate-overshoot"},
    {"test.bounce_in", "Bounce In", "H:bounce-in", "T:bounce-in", "J:bounce-in"},
    {"test.bounce_out", "Bounce Out", "H:bounce-out", "T:bounce-out", "J:bounce-out"},
    {"test.bounce_in_out", "Bounce In, Bounce Out", "H:bounce-pair", "T:bounce-pair", "J:bounce-pair"},
    {"test.custom", "Custom", "H:custom", "T:custom", "J:custom"},
}};

bool uniqueRows() noexcept
{
    for (std::size_t i = 0; i < kSyntheticRows.size(); ++i) {
        if (kSyntheticRows[i].identity.empty() || kSyntheticRows[i].source.empty())
            return false;
        for (std::size_t j = i + 1; j < kSyntheticRows.size(); ++j) {
            if (kSyntheticRows[i].source == kSyntheticRows[j].source ||
                kSyntheticRows[i].identity == kSyntheticRows[j].identity) return false;
        }
    }
    return true;
}
}  // namespace

int main()
{
    using cavalry_native_font::Locale;
    using native_easing_menu::contract::kAddActionCallerOffset;
    using native_easing_menu::contract::kAddActionImportStubOffset;
    using native_easing_menu::contract::kAddActionReturnOffset;
    using native_easing_menu::contract::kPresetSourceCount;

    static_assert(kPresetSourceCount == 20);
    static_assert(kAddActionReturnOffset == 0x006a9128);
    static_assert(kAddActionImportStubOffset == 0x00dbf834);
    if (kAddActionCallerOffset != 0x006a9124 || !uniqueRows()) return 1;

    if (native_easing_menu::sourceProjection("Bounce Out", Locale::Hans,
                                             kSyntheticRows) != "H:bounce-out" ||
        native_easing_menu::sourceProjection("Bounce Out", Locale::Hant,
                                             kSyntheticRows) != "T:bounce-out" ||
        native_easing_menu::sourceProjection("Bounce Out", Locale::Japanese,
                                             kSyntheticRows) != "J:bounce-out") return 2;
    if (!native_easing_menu::sourceProjection("Bounce Out", Locale::English,
                                              kSyntheticRows).empty() ||
        !native_easing_menu::sourceProjection("Bounce out", Locale::Hans,
                                              kSyntheticRows).empty() ||
        !native_easing_menu::sourceProjection("", Locale::Hans,
                                              kSyntheticRows).empty()) return 3;

    constexpr std::array<Row, 2> duplicateSourceRows = {{
        {"test.one", "Same", "H:one", "T:one", "J:one"},
        {"test.two", "Same", "H:two", "T:two", "J:two"},
    }};
    constexpr std::array<Row, 1> emptyIdentityRows = {{
        {"", "Bounce Out", "H:bad", "T:bad", "J:bad"},
    }};
    if (!native_easing_menu::sourceProjection("Same", Locale::Hans,
                                               duplicateSourceRows).empty() ||
        !native_easing_menu::sourceProjection("Bounce Out", Locale::Hans,
                                               emptyIdentityRows).empty()) return 14;

    struct Counters {
        int localeReads = 0;
        int sourceReads = 0;
        int textWrites = 0;
        int forwards = 0;
        Locale locale = Locale::Hans;
        std::string_view source = "Bounce Out";
        std::string_view written;
    };
    const auto run = [&](Counters &state, bool ready, std::uintptr_t caller,
                         std::uintptr_t expected) {
        native_easing_menu::forwardProjectedAction(
            [&]() { ++state.forwards; }, ready, caller, expected,
            [&]() { ++state.localeReads; return state.locale; },
            [&]() { ++state.sourceReads; return state.source; },
            [&](std::string_view text) {
                ++state.textWrites;
                state.written = text;
            },
            kSyntheticRows);
    };

    Counters unknownCaller;
    run(unknownCaller, true, kAddActionReturnOffset + 4,
        kAddActionReturnOffset);
    if (unknownCaller.localeReads != 0 || unknownCaller.sourceReads != 0 ||
        unknownCaller.textWrites != 0 || unknownCaller.forwards != 1) return 4;

    Counters unavailableContract;
    run(unavailableContract, false, kAddActionReturnOffset,
        kAddActionReturnOffset);
    if (unavailableContract.localeReads != 0 || unavailableContract.sourceReads != 0 ||
        unavailableContract.textWrites != 0 || unavailableContract.forwards != 1) return 5;

    Counters zeroExpectedPc;
    run(zeroExpectedPc, true, 0, 0);
    if (zeroExpectedPc.localeReads != 0 || zeroExpectedPc.sourceReads != 0 ||
        zeroExpectedPc.forwards != 1) return 6;

    Counters english;
    english.locale = Locale::English;
    run(english, true, kAddActionReturnOffset, kAddActionReturnOffset);
    if (english.localeReads != 1 || english.sourceReads != 0 ||
        english.textWrites != 0 || english.forwards != 1) return 7;

    Counters unknownSource;
    unknownSource.source = "Bounce out";
    run(unknownSource, true, kAddActionReturnOffset, kAddActionReturnOffset);
    if (unknownSource.localeReads != 1 || unknownSource.sourceReads != 1 ||
        unknownSource.textWrites != 0 || unknownSource.forwards != 1) return 8;

    Counters exactSource;
    exactSource.locale = Locale::Hant;
    run(exactSource, true, kAddActionReturnOffset, kAddActionReturnOffset);
    if (exactSource.localeReads != 1 || exactSource.sourceReads != 1 ||
        exactSource.textWrites != 1 || exactSource.forwards != 1 ||
        exactSource.written != "T:bounce-out") return 9;

    struct ForwardFailure {};
    Counters forwardingThrows;
    try {
        native_easing_menu::forwardProjectedAction(
            [&]() { ++forwardingThrows.forwards; throw ForwardFailure{}; },
            true, kAddActionReturnOffset, kAddActionReturnOffset,
            [&]() { ++forwardingThrows.localeReads; return Locale::Hans; },
            [&]() { ++forwardingThrows.sourceReads; return std::string_view("unknown"); },
            [&](std::string_view) { ++forwardingThrows.textWrites; },
            kSyntheticRows);
        return 10;
    } catch (const ForwardFailure &) {
        if (forwardingThrows.forwards != 1 || forwardingThrows.textWrites != 0)
            return 11;
    }

    struct SetterFailure {};
    Counters setterThrows;
    try {
        native_easing_menu::forwardProjectedAction(
            [&]() { ++setterThrows.forwards; }, true, kAddActionReturnOffset,
            kAddActionReturnOffset,
            [&]() { ++setterThrows.localeReads; return Locale::Hans; },
            [&]() { ++setterThrows.sourceReads; return std::string_view("Bounce Out"); },
            [&](std::string_view) { ++setterThrows.textWrites; throw SetterFailure{}; },
            kSyntheticRows);
        return 12;
    } catch (const SetterFailure &) {
        if (setterThrows.textWrites != 1 || setterThrows.forwards != 0) return 13;
    }
    return 0;
}
