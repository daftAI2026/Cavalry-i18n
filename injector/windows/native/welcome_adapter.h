/*
 * [INPUT]: Cavalry 2.8.1 Windows spdlog.dll 96字节log_msg ABI、runtime caller gate及共享Welcome纯策略。
 * [OUTPUT]: 只在已准入producer影子替换payload；未知调用先透传，原logger单次调用及异常保全。
 * [POS]: Windows 2.8.1 Welcome payload薄适配；caller批准由runtime负责，未知caller透传，不扫描MessageBar或改变logger状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include "../../native/welcome_log_it_policy.h"
#include "../../native/native_locale_snapshot.h"
#include <array>
#include <cstddef>
#include <cstring>
namespace native_windows_welcome {
struct Message {std::byte prefix[0x50];const char *payload;std::size_t payloadSize;};
static_assert(offsetof(Message,payload)==0x50 && offsetof(Message,payloadSize)==0x58 && sizeof(Message)==0x60);
using Original=void(*)(void*,const void*,bool,bool);
inline bool forward(Original original,void *logger,const void *message,bool enabled,bool traceback,
                    bool exactCaller,cavalry_native_font::Locale locale){
    if(!exactCaller){original(logger,message,enabled,traceback);return false;}
    Message source{};std::memcpy(&source,message,sizeof(source));
    using Locale=welcome_log_it::policy::Locale;Locale selected=Locale::Unknown;
    switch(locale){
    case cavalry_native_font::Locale::Hans:selected=Locale::Hans;break;
    case cavalry_native_font::Locale::Hant:selected=Locale::Hant;break;
    case cavalry_native_font::Locale::Japanese:selected=Locale::Japanese;break;
    default:break;
    }
    std::array<char,welcome_log_it::policy::kMaxProjectedBytes> text{};std::size_t size=0;
    if(!welcome_log_it::policy::projectPayload(source.payload,source.payloadSize,selected,text.data(),text.size(),&size)){
        original(logger,message,enabled,traceback);return false;
    }
    auto shadow=source;shadow.payload=text.data();shadow.payloadSize=size;
    original(logger,&shadow,enabled,traceback);return true;
}
}
