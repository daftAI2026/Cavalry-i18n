/**
 * [INPUT]: 依赖x86 DocumentationPopup、QtWidgets导入和精确返回PC合同。
 * [OUTPUT]: 验证x86符号身份、调用窗、stub指向和未知caller透传。
 * [POS]: Rosetta vendor-free合同；不加载Cavalry或Qt运行库。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "help_popup_layout_abi_contract.h"

#include <cstdint>
#include <cstdio>

namespace abi = native_help_popup_layout::abi;
namespace x86 = native_help_popup_layout::abi::x86_64;

namespace {
template<class Apply, class Forward>
bool invokeFromCaller(std::uintptr_t caller, std::uintptr_t expected,
                      Apply apply, Forward forward)
{
    if (!abi::isExactActivationCaller(caller, expected)) {
        forward();
        return false;
    }
    apply();
    forward();
    return true;
}

bool exactCallerAppliesOnceAndForwardsOnce()
{
    unsigned applies = 0;
    unsigned forwards = 0;
    const bool adapted = invokeFromCaller(
        x86::kActivateReturnOffset, x86::kActivateReturnOffset,
        [&] { ++applies; }, [&] { ++forwards; });
    if (!adapted || applies != 1U || forwards != 1U) return false;

    applies = 0;
    forwards = 0;
    const bool unknown = invokeFromCaller(
        x86::kActivateReturnOffset + 1U, x86::kActivateReturnOffset,
        [&] { ++applies; }, [&] { ++forwards; });
    return !unknown && applies == 0U && forwards == 1U;
}
}  // namespace

int main()
{
    if (!abi::isExactActivationCaller(x86::kActivateReturnOffset,
                                      x86::kActivateReturnOffset) ||
        abi::isExactActivationCaller(x86::kActivateReturnOffset + 1U,
                                     x86::kActivateReturnOffset) ||
        abi::isExactActivationCaller(x86::kActivateReturnOffset, 0U)) return 1;
    if (x86::kActivateCallOffset + 5U != x86::kActivateReturnOffset ||
        x86::kActivateCallWindowOffset + 8U != x86::kActivateCallOffset ||
        x86::kDocumentationSetContentOffset != 0x96ad0U ||
        x86::kQtLayoutActivateOffset != 0x42fb0U) return 2;
    if (x86::kActivateImportStubOffset + x86::kActivateImportStubBytes.size() +
            0x285acU != x86::kActivateGotOffset ||
        x86::kActivateImportStubBytes[0] != 0xffU ||
        x86::kActivateImportStubBytes[1] != 0x25U) return 3;
    if (x86::kActivateCallWindowBytes[8] != 0xe8U ||
        x86::kActivateCallWindowBytes[9] != 0x5bU ||
        x86::kActivateCallWindowBytes[10] != 0x76U) return 4;
    if (!exactCallerAppliesOnceAndForwardsOnce()) return 5;
    std::puts("GREEN: x86 DocumentationPopup activates only at the exact setContent return PC");
    std::puts("GREEN: unknown x86 callers preserve layout and forward once");
    std::puts("GREEN: the QLayout stub targets the approved QtWidgets GOT slot");
    return 0;
}
