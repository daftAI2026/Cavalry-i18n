/*
 * [INPUT]: 官方Windows 2.8.1 Viewport分段blob的sret/borrowed SkFont、同线程栈和精确父调用。
 * [OUTPUT]: 读取父层完整MSVC名称快照；片段只参与原厂绘制，字体必须覆盖完整名称。
 * [POS]: Windows 2.8.1分段Viewport快照；只准入caller 0x430bff后续栈帧中的parent return 0x40d784；direct 0x40d7bc由runtime完整文本分支处理。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include <windows.h>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace native_windows_viewport {
inline constexpr std::uintptr_t kViewportBlobReturn=0x40d7bc;
inline constexpr std::uintptr_t kSegmentedBlobReturn=0x430bff;
inline constexpr std::uintptr_t kSegmentedParentReturn=0x40d784;
inline bool approvedProducerFrames(const std::uintptr_t *frames,std::size_t count,std::uintptr_t extension) noexcept {
    if(!frames)return false;
    for(std::size_t i=0;i<count;++i){
        if(frames[i]==extension+kSegmentedBlobReturn){
            for(std::size_t j=i+1;j<count;++j)
                if(frames[j]==extension+kSegmentedParentReturn)return true;
        }
    }
    return false;
}
struct Snapshot {std::array<std::byte,4096> bytes{};std::size_t size=0;};
inline bool read(const void *address,void *destination,std::size_t bytes) noexcept {
    SIZE_T copied=0;
    return ReadProcessMemory(GetCurrentProcess(),address,destination,bytes,&copied) && copied==bytes;
}
inline bool snapshot(const void *font,std::uintptr_t extension,Snapshot *output) noexcept {
    if(!font || !output)return false;
    void *captured[12]{};const auto count=CaptureStackBackTrace(0,12,captured,nullptr);
    std::array<std::uintptr_t,12> frames{};
    for(unsigned i=0;i<count;++i)frames[i]=reinterpret_cast<std::uintptr_t>(captured[i]);
    if(!approvedProducerFrames(frames.data(),count,extension))return false;
    ULONG_PTR low=0,high=0;GetCurrentThreadStackLimits(&low,&high);
    const auto fontAddress=reinterpret_cast<std::uintptr_t>(font);
    if(fontAddress<low || fontAddress>high || high-fontAddress<0x128)return false;
    const auto source=fontAddress+0x108;
    std::array<std::uintptr_t,4> words{};
    if(!read(reinterpret_cast<const void*>(source),words.data(),sizeof(words)))return false;
    if(words[3]<15 || words[2]==0 || words[2]>words[3] || words[2]>output->bytes.size())return false;
    const auto data=words[3]<16?source:words[0];
    if(!data || !read(reinterpret_cast<const void*>(data),output->bytes.data(),words[2]))return false;
    output->size=words[2];return true;
}
}
