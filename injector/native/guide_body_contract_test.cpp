/**
 * [INPUT]: 依赖Guide正文纯策略、固定ABI合同与native locale枚举。
 * [OUTPUT]: 验证caller/source/locale门、单次调用与异常传播。
 * [POS]: 无Qt与vendor依赖的合同测试；不证明候选加载或实屏消费。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "guide_body_abi_contract.h"
#include "guide_body_policy.h"

#include <cstdint>
#include <string_view>

int main()
{
    using cavalry_native_font::Locale;
    using native_guide_body::contract::kCallerOffset;
    using native_guide_body::contract::kReturnOffset;
    using native_guide_body::kSourceText;

    static_assert(kCallerOffset == 0x004b9e44);
    static_assert(kReturnOffset == 0x004b9e48);
    static_assert(kSourceText == "Keep going...");

    struct Case {
        std::uintptr_t caller;
        std::uintptr_t expectedCaller;
        std::string_view source;
        Locale locale;
        std::string_view expected;
    };
    constexpr Case cases[] = {
        {kReturnOffset, kReturnOffset, kSourceText, Locale::Hans, "继续…"},
        {kReturnOffset, kReturnOffset, kSourceText, Locale::Hant, "繼續…"},
        {kReturnOffset, kReturnOffset, kSourceText, Locale::Japanese, "続けてください…"},
        {kReturnOffset, kReturnOffset, kSourceText, Locale::English, {}},
        {kReturnOffset, kReturnOffset, kSourceText, Locale::Unset, {}},
        {kReturnOffset, kReturnOffset, kSourceText, Locale::Unknown, {}},
        {kReturnOffset, 0, kSourceText, Locale::Hans, {}},
        {0, 0, kSourceText, Locale::Hans, {}},
        {kReturnOffset + 4, kReturnOffset, kSourceText, Locale::Hans, {}},
        {kReturnOffset, kReturnOffset, "Keep going!", Locale::Hans, {}},
    };

    for (const Case &test : cases) {
        const auto actual = native_guide_body::approvedBody(
            test.caller, test.expectedCaller, test.source, test.locale);
        if (actual != test.expected) return 1;

        int calls = 0;
        std::string_view forwarded;
        native_guide_body::forwardBodyText(
            [&](std::string_view projection) {
                ++calls;
                forwarded = projection;
            },
            test.caller, test.expectedCaller, test.source, test.locale);
        if (calls != 1 || forwarded != test.expected) return 2;
    }

    struct ForwardingFailure {};
    int calls = 0;
    try {
        native_guide_body::forwardBodyText(
            [&](std::string_view) {
                ++calls;
                throw ForwardingFailure{};
            },
            kReturnOffset, kReturnOffset, kSourceText, Locale::Hant);
        return 3;
    } catch (const ForwardingFailure &) {
        if (calls != 1) return 4;
    }
    return 0;
}
