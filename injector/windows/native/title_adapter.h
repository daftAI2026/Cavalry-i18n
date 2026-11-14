/*
 * [INPUT]: 官方Cavalry 2.8.1 ExtensionLayer updateAppTitle fmt11 descriptor/栈帧、MSVC x64 string ABI及共享标题策略。
 * [OUTPUT]: 在原厂format完成后投影标题标签与已证真实空值，用户同名None/Untitled及后缀保持原字节。
 * [POS]: Windows 2.8.1标题ABI薄适配；仅接受descriptor 0xcdd、return 0x1f295a及同帧参数关系，任一不符即透传。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include "../../native/title_format_policy.h"
#include <array>
#include <cstddef>
#include <cstdint>
#include <type_traits>

namespace native_windows_title {
// Windows fmt11的参数影子由ExtensionLayer updateAppTitle调用帧直接证明。
struct View { const char *data; std::size_t size; };
struct StringArgument { const char *data; std::size_t size; };
struct CStringArgument { const char *data; std::uintptr_t unused; };
union FormatValue {
    StringArgument string;
    CStringArgument cstring;
    std::uintptr_t words[2];
};
struct Arguments { std::uint64_t descriptor; const FormatValue *values; };

inline constexpr std::uintptr_t kFormatReturn=0x1f295a;
inline constexpr std::uint64_t kFormatDescriptor=0xcdd;
inline constexpr std::size_t kValuesFrameOffset=0x98;
inline constexpr std::size_t kArgumentsFrameOffset=0x190;
inline constexpr std::size_t kViewFrameOffset=0x1a0;
inline constexpr std::size_t kOutputFrameOffset=0x1d0;

static_assert(sizeof(View)==16 && std::is_trivially_copyable_v<View>);
static_assert(sizeof(StringArgument)==16 && std::is_trivially_copyable_v<StringArgument>);
static_assert(sizeof(CStringArgument)==16 && std::is_trivially_copyable_v<CStringArgument>);
static_assert(sizeof(FormatValue)==16 && std::is_trivially_copyable_v<FormatValue>);
static_assert(sizeof(Arguments)==16 && std::is_trivially_copyable_v<Arguments>);

struct Inputs {
    native_title_format::BorrowedText project{}, scene{};
    bool projectFallback=false, sceneFallback=false, valid=false;
};
static_assert(sizeof(std::string)==32, "Requires verified MSVC release string ABI");
inline Inputs capture(std::string *output,const View *format,const Arguments *arguments) noexcept {
    Inputs result;
    constexpr std::string_view expected="Project: {} - Scene: {} {}";
    if(!output || !format || !arguments || arguments->descriptor!=kFormatDescriptor ||
       !format->data || format->size!=expected.size() ||
       std::memcmp(format->data,expected.data(),expected.size())!=0 || !arguments->values)return result;
    const auto values=reinterpret_cast<std::uintptr_t>(arguments->values);
    // updateAppTitle(rbp)中fmt值位于+98；三个参数和源对象必须属于同一已证帧。
    if(values<kValuesFrameOffset)return result;
    const auto frame=values-kValuesFrameOffset;
    if(reinterpret_cast<std::uintptr_t>(arguments)!=frame+kArgumentsFrameOffset ||
       reinterpret_cast<std::uintptr_t>(format)!=frame+kViewFrameOffset ||
       reinterpret_cast<std::uintptr_t>(output)!=frame+kOutputFrameOffset)return result;
    result.project={arguments->values[0].string.data,arguments->values[0].string.size};
    result.scene={arguments->values[1].string.data,arguments->values[1].string.size};
    std::array<std::uintptr_t,4> project{},scene{};
    std::memcpy(project.data(),reinterpret_cast<const void*>(frame+0x1b0),32);
    std::memcpy(scene.data(),reinterpret_cast<const void*>(frame+0x1f0),32);
    if(project[3]<15 || project[2]>project[3] || scene[3]<15 || scene[2]>scene[3])return {};
    result.projectFallback=project[2]==0 && result.project.size==4 &&
        reinterpret_cast<std::uintptr_t>(result.project.data)==frame+0x210;
    result.sceneFallback=scene[2]==0 && result.scene.size==8 &&
        reinterpret_cast<std::uintptr_t>(result.scene.data)==frame+0x230;
    result.valid=true;
    return result;
}
inline bool project(std::string &output,cavalry_native_font::Locale locale,const Inputs &inputs) {
    return inputs.valid && native_title_format::projectValues(output,locale,inputs.project,
        inputs.scene,inputs.projectFallback,inputs.sceneFallback);
}
}
