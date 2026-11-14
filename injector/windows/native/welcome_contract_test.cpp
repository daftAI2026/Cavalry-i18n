/*
 * [INPUT]: Windows 2.8.1 Welcome ABI影子适配与共享三语/两节日后缀策略。
 * [OUTPUT]: 验证源消息不变、opaque字段保全、未知caller不读坏指针、用户前缀保全及原异常单次传播。
 * [POS]: 隔离Windows logger合同；不启动宿主，不将合成消息计为实屏。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "welcome_adapter.h"
#include <cstdio>
#include <stdexcept>
#include <string>
namespace {
int calls=0;bool throws=false;std::string text;const void *received=nullptr;
void original(void *logger,const void *message,bool enabled,bool traceback){
    ++calls;received=message;
    if(logger!=reinterpret_cast<void*>(0x28) || !enabled || traceback)throw std::logic_error("args");
    if(message!=reinterpret_cast<void*>(1)){
        const auto &value=*static_cast<const native_windows_welcome::Message*>(message);
        if(value.prefix[0]!=std::byte{0x28})throw std::logic_error("opaque");
        text.assign(value.payload,value.payloadSize);
    }
    if(throws)throw std::runtime_error("original");
}
}
int main(){
    using cavalry_native_font::Locale;using namespace native_windows_welcome;
    for(auto locale:{Locale::Hans,Locale::Hant,Locale::Japanese})for(const char *suffix:{""," Happy New Year!"," Happy Holidays!"}){
        const std::string source=std::string(welcome_log_it::policy::kSource)+suffix;
        Message message{};message.prefix[0]=std::byte{0x28};message.payload=source.data();message.payloadSize=source.size();calls=0;
        if(!forward(original,reinterpret_cast<void*>(0x28),&message,true,false,true,locale) || calls!=1 || received==&message || text==source || text.substr(text.size()-std::strlen(suffix))!=suffix || std::string(message.payload,message.payloadSize)!=source)return 1;
    }
    calls=0;if(forward(original,reinterpret_cast<void*>(0x28),reinterpret_cast<void*>(1),true,false,false,Locale::Hans) || calls!=1 || received!=reinterpret_cast<void*>(1))return 2;
    const std::string user="Welcome to Cavalry. User note";Message message{};message.prefix[0]=std::byte{0x28};message.payload=user.data();message.payloadSize=user.size();calls=0;
    if(forward(original,reinterpret_cast<void*>(0x28),&message,true,false,true,Locale::Hans) || calls!=1 || received!=&message || text!=user)return 3;
    throws=true;calls=0;
    try{forward(original,reinterpret_cast<void*>(0x28),&message,true,false,false,Locale::Hans);return 4;}
    catch(const std::runtime_error&){if(calls!=1)return 5;}
    std::puts("Windows Welcome ABI/source/opaque/unknown-caller/forward-once contracts passed");
}
