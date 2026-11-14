/*
 * [INPUT]: Cavalry 2.8.1 Windows log_msg ABI、Api精确producer/logger调用点、纯catalog策略及调用方提供的包证明。
 * [OUTPUT]: 仅在完整消息和实际批准包同时命中时省略预期warning；其它消息与参数原样单次转发。
 * [POS]: Api 2.8.1限域警告；producer return 0x37508继续到logger IAT return 0x3b1e4，其他分支原样转发。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include "catalog_warning_policy.h"
#include "welcome_adapter.h"
#include <cstddef>
#include <cstdint>
namespace native_windows_catalog_warning {
using Message=native_windows_welcome::Message;
using Original=native_windows_welcome::Original;
inline constexpr std::uintptr_t kWarningProducerReturn=0x37508;
inline constexpr std::uintptr_t kLoggerCallReturn=0x3b1e4;
inline bool approvedWarningCaller(std::uintptr_t loggerCaller,const std::uintptr_t *frames,
                                  std::size_t count,std::uintptr_t api) noexcept {
    if(loggerCaller!=api+kLoggerCallReturn || !frames)return false;
    for(std::size_t i=0;i<count;++i)
        if(frames[i]==api+kWarningProducerReturn)return true;
    return false;
}
template<class VerifyPack>
bool forward(Original original,void *logger,const void *message,bool enabled,bool traceback,
             bool exactCaller,std::string_view root,const PackProof &proof,
             const std::string_view *catalogs,std::size_t count,VerifyPack verifyPack){
    bool quiet=false;
    if(exactCaller && enabled && !traceback && message){
        try{
            Message value{};std::memcpy(&value,message,sizeof(value));
            std::int32_t level=-1;std::memcpy(&level,value.prefix+0x10,sizeof(level));
            if(level==3 && value.payload && value.payloadSize>0 && value.payloadSize<=32768 &&
               expectedWarning({value.payload,value.payloadSize},root,proof,catalogs,count))quiet=verifyPack();
        }catch(...){quiet=false;}
    }
    if(!quiet)original(logger,message,enabled,traceback);
    return quiet;
}
}
