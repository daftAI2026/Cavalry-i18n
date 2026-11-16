/**
 * [INPUT]: 共享标题策略与Intel标题栈中的正向fallback地址。
 * [OUTPUT]: 核对双向地址证明、用户同名保全与三语空标题显示。
 * [POS]: Intel标题回归合同；不加载或修改Cavalry。
 * [PROTOCOL]: 随标题ABI及父级CLAUDE.md更新。
 */
#include "title_format_policy.h"
#include <cassert>
#include <limits>

int main()
{
    using namespace native_title_format;
    const auto values = std::uintptr_t{0x10000};
    const BorrowedText project{reinterpret_cast<const char *>(values + 0x131), 4};
    const BorrowedText scene{reinterpret_cast<const char *>(values + 0xf1), 8};
    assert(isFallbackAt(values, project, -0x131, 4));
    assert(isFallbackAt(values, scene, -0xf1, 8));
    assert(!isFallbackAt(values, project, -0xf1, 4));
    assert(!isFallbackAt(values, project, 0x131, 4));
    assert(!isFallbackAt(values, {nullptr, 4}, -0x131, 4));
    assert(!isFallbackAt(1, {reinterpret_cast<const char *>(0x100), 4}, 2, 4));
    const BorrowedText old{reinterpret_cast<const char *>(values - 0xe0), 4};
    assert(isFallbackAt(values, old, 0xe0, 4));
#if defined(CAVALRY_NATIVE_TARGET_281)
    static_assert(sizeof(std::string) == sizeof(native_title_format_abi::LibCppStringSnapshot));
    std::string empty;
    std::string userProject = "None";
    std::string userScene = "Untitled";
    native_title_format_abi::LibCppStringSnapshot snapshot{};
    std::memcpy(&snapshot, &empty, sizeof(snapshot));
    assert(native_title_format_abi::isEmptyShortString(snapshot));
    std::memcpy(&snapshot, &userProject, sizeof(snapshot));
    assert(!native_title_format_abi::isEmptyShortString(snapshot));
    std::memcpy(&snapshot, &userScene, sizeof(snapshot));
    assert(!native_title_format_abi::isEmptyShortString(snapshot));
#endif
    for (auto language : {cavalry_native_font::Locale::Hans,
                          cavalry_native_font::Locale::Hant,
                          cavalry_native_font::Locale::Japanese}) {
        std::string title = "Project: None - Scene: Untitled ";
        assert(projectValues(title, language, {"None", 4}, {"Untitled", 8}, true, true));
        assert(title.find("None") == std::string::npos);
        assert(title.find("Untitled") == std::string::npos);
        std::string named = "Project: None - Scene: Untitled ";
        assert(projectValues(named, language, {"None", 4}, {"Untitled", 8}, false, false));
        assert(named.find("None") != std::string::npos);
        assert(named.find("Untitled") != std::string::npos);
    }
}
