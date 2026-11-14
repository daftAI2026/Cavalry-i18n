/*
 * [INPUT]: Windows 2.8.1 Core的MSVC optional<string> ABI与Extension两个官方Presets JavaScript reader caller。
 * [OUTPUT]: 提供同ABI函数类型及共享单次转发薄适配；源/路径投影仍由共享策略和运行边界裁决。
 * [POS]: 覆盖Create > Demo Scenes的Run Preset reader return 0xca5187与OnboardingChoiceView的loadDemoScene return 0x87f0b2；下游runGuiScript return 0xca51e9/0x87f117及Import Preset .cvp return 0x4b59d4均拒绝，运行时还需canonical Presets根与文件SHA匹配。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include "../../native/demo_reader_policy.h"
#include <type_traits>
namespace native_windows_demo {
using Result=std::optional<std::string>;
using Original=Result(*)(const std::string&);
inline constexpr std::uintptr_t kOnboardingDemoReturn=0x87f0b2;
inline constexpr std::uintptr_t kMenuPresetReaderReturn=0xca5187;
static_assert(sizeof(std::string)==0x20 && sizeof(Result)==0x28 && alignof(Result)==8);
static_assert(!std::is_trivially_destructible_v<Result>);
inline constexpr bool approvedCaller(std::uintptr_t caller,std::uintptr_t extension) noexcept {
    return caller==extension+kOnboardingDemoReturn || caller==extension+kMenuPresetReaderReturn;
}
template<typename LocaleGetter,typename Projector>
Result forward(Original original,const std::string &path,std::uintptr_t caller,std::uintptr_t extension,
               LocaleGetter &&locale,Projector &&project){
    return native_demo_reader::forwardOnce([&]{return original(path);},approvedCaller(caller,extension),true,
        std::forward<LocaleGetter>(locale),std::forward<Projector>(project));
}
}
