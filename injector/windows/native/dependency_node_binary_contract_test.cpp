/*
 * [INPUT]: 显式官方Windows2.8.1 ExtensionLayer PE、共享只读PE合同与节点图ABI常量。
 * [OUTPUT]: 核验映像摘要、RTTI虚表/paint跳板、直属header成员与真实Skia导入调用窗。
 * [POS]: NodeView平台地址的二进制回归门；不加载或执行vendor DLL，不依赖第三方反汇编包。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "dependency_node_adapter.h"
#include "vendor_pe_contract.h"

#include <cstdio>
#include <string_view>

namespace abi = native_windows_dependency::abi;
using native_windows_pe_contract::Image;
using native_windows_pe_contract::checkCount;
using native_windows_pe_contract::require;

int wmain(int argc, wchar_t **argv)
{
    require(argc == 2, "one explicit vendor DLL argument required");
    Image image(argv[1], abi::kExtensionSha256);
    image.type(abi::kTextViewVtable, ".?AVTextView@lina@@");
    image.type(abi::kNodeViewVtable, ".?AVNodeView@cavalry@@");
    require(image.relative(image.read<std::uint64_t>(abi::kTextViewVtable + abi::kPaintSlot * 8)) ==
                abi::kPaintThunk,
            "exact TextView virtual paint slot");
    require(image.read<unsigned char>(abi::kPaintThunk) == 0xe9 &&
                std::int64_t(abi::kPaintThunk + 5) +
                    image.read<std::int32_t>(abi::kPaintThunk + 1) == abi::kPaintFunction,
            "paint thunk reaches actual TextView::paint");
    image.field(abi::kNameMemberStore, {0x49, 0x89, 0x86}, abi::kNameHeaderOffset);
    image.field(abi::kHeaderParentStore, {0x4c, 0x89, 0xb0}, abi::kParentOffset);
    image.field(abi::kChildrenBeginAddress, {0x49, 0x8d, 0x8e}, abi::kChildrenOffset);
    image.field(abi::kChildrenEndLoad, {0x49, 0x8b, 0x96}, abi::kChildrenOffset + 8);
    image.field(abi::kChildrenCapacityCompare, {0x49, 0x3b, 0x96}, abi::kChildrenOffset + 16);
    constexpr std::string_view measure =
        "?measureText@SkFont@@QEBAMPEBX_KW4SkTextEncoding@@PEAUSkRect@@PEBVSkPaint@@@Z";
    constexpr std::string_view draw =
        "?drawSimpleText@SkCanvas@@QEAAXPEBX_KW4SkTextEncoding@@MMAEBVSkFont@@AEBVSkPaint@@@Z";
    for (const auto rva : {abi::kFullMeasureReturn, abi::kDotsMeasureReturn,
                           abi::kPrefixMeasureReturn})
        image.call(rva, measure);
    for (const auto rva : {abi::kFillDrawReturn, abi::kStrokeDrawReturn})
        image.call(rva, draw);
    std::printf("PASS: %u real Windows NodeView ABI checks\n", checkCount());
}
