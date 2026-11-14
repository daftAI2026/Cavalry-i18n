/*
 * [INPUT]: Windows 2.8.1 ScriptDocumentation ABI薄适配与main/def隔离表、原对象及模拟consumer。
 * [OUTPUT]: 验证双caller/三语投影、同名异源隔离、所有opaque成员/原像保全及异常单次传播。
 * [POS]: Windows 2.8.1文档布局合同；检查main/def真实caller边界，不加载宿主或创建UI。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "help_adapter.h"
#include <cstdio>
#include <stdexcept>
namespace {
using namespace native_windows_help;
int calls=0;const Documentation *received=nullptr;Documentation copy;bool throws=false;
void target(void *owner,const std::string &key,const Documentation &document){
    if(owner!=reinterpret_cast<void*>(0x28) || key!="sameName")throw std::logic_error("original arguments changed");
    ++calls;received=&document;copy=document;
    if(throws)throw std::runtime_error("original exception");
}
}
int main(){
    using cavalry_native_font::Locale;using native_help_description::HelpDescriptionEntry;
    const HelpDescriptionEntry roots[]={{"sameName","main source","主说明","主說明","主説明"}};
    const HelpDescriptionEntry defs[]={{"sameName","def source","定义说明","定義說明","定義説明"}};
    Documentation source{"main source",{"opaque-one","opaque-two","opaque-three"},{"arg0","arg1"}};
    constexpr std::uintptr_t base=0x100000000ULL;
    const Locale locales[]={Locale::Hans,Locale::Hant,Locale::Japanese};
    for(unsigned i=0;i<3;++i){
        source.description="main source";calls=0;
        if(!forward(target,reinterpret_cast<void*>(0x28),"sameName",source,base+kRootReturn,base,locales[i],{roots,1},{defs,1}) || calls!=1 || received==&source)return 1;
        const auto expected=i==0?roots[0].zhHans:i==1?roots[0].zhHant:roots[0].jaJp;
        if(copy.description!=expected || source.description!="main source" || copy.opaqueStrings!=source.opaqueStrings || copy.opaqueVector!=source.opaqueVector)return 2;
        source.description="def source";calls=0;
        if(!forward(target,reinterpret_cast<void*>(0x28),"sameName",source,base+kDefReturn,base,locales[i],{roots,1},{defs,1}) || calls!=1)return 3;
        const auto def=i==0?defs[0].zhHans:i==1?defs[0].zhHant:defs[0].jaJp;
        if(copy.description!=def || source.description!="def source")return 4;
    }
    for(auto caller:{base+kRootReturn+1,base+kDefReturn+1,base+0x10}){
        source.description="main source";calls=0;
        if(forward(target,reinterpret_cast<void*>(0x28),"sameName",source,caller,base,Locale::Hans,{roots,1},{defs,1}) || calls!=1 || received!=&source)return 5;
    }
    for(auto locale:{Locale::Unset,Locale::English,Locale::Unknown}){
        calls=0;if(forward(target,reinterpret_cast<void*>(0x28),"sameName",source,base+kRootReturn,base,locale,{roots,1},{defs,1}) || calls!=1 || received!=&source)return 6;
    }
    calls=0;throws=true;
    try{forward(target,reinterpret_cast<void*>(0x28),"sameName",source,base+kRootReturn,base,Locale::Hans,{roots,1},{defs,1});return 7;}
    catch(const std::runtime_error&){if(calls!=1 || source.description!="main source")return 8;}
    std::puts("PASS: Windows document ABI, main/def three-locale isolation, original members and exception preserved");
}
