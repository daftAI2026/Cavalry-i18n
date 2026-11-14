/*
 * [INPUT]: 官方Windows ScriptDocumentation四个MSVC string及vector布局、共享审批查询和384/17生成表。
 * [OUTPUT]: main/def精确caller分别选表，仅shadow description后单次调用原厂consumer。
 * [POS]: Windows 2.8.1 文档投影边界；formatForCompleter 导出 thunk 指向 def caller 0xc49ebf，root caller 为 0x13bfd2f；未知调用者原样透传。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include "../../native/help_description_lookup.h"
#include <array>
#include <string>
#include <vector>
#include <cstddef>
#include <cstdint>

namespace native_windows_help {
inline constexpr std::uintptr_t kRootReturn=0x13bfd2f;
inline constexpr std::uintptr_t kDefReturn=0xc49ebf;
struct Documentation {
    std::string description;
    std::array<std::string,3> opaqueStrings;
    std::vector<std::string> opaqueVector;
};
static_assert(sizeof(std::string)==0x20 && sizeof(std::vector<std::string>)==0x18);
static_assert(offsetof(Documentation,description)==0 && offsetof(Documentation,opaqueStrings)==0x20 && offsetof(Documentation,opaqueVector)==0x80 && sizeof(Documentation)==0x98);
using Original=void(*)(void*,const std::string&,const Documentation&);
inline bool forward(Original original,void *owner,const std::string &key,
                    const Documentation &documentation,std::uintptr_t caller,std::uintptr_t extension,
                    cavalry_native_font::Locale locale,
                    native_help_description::HelpDescriptionTableView main,
                    native_help_description::HelpDescriptionTableView def)
{
    native_help_description::HelpDescriptionTableView table;
    if(caller==extension+kRootReturn)table=main;
    else if(caller==extension+kDefReturn)table=def;
    const auto text=native_help_description::approvedDescription(table.entries,table.count,key,documentation.description,locale);
    if(text.empty()){original(owner,key,documentation);return false;}
    auto shadow=documentation;
    shadow.description.assign(text.data(),text.size());
    original(owner,key,shadow);
    return true;
}
} // namespace native_windows_help
