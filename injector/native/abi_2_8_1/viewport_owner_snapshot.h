/**
 * [INPUT]: 依赖已锁定调用点、线程栈范围与只读复制器。
 * [OUTPUT]: 单次读取调用帧记录，复用线程栈关系并复制有限名称容器。
 * [POS]: 提供owner共用帧原语；不决定GetPath文本白名单。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <limits>
namespace viewport_owner {
inline constexpr std::size_t kObjectBytes=24;
inline constexpr std::size_t kTagOffset=23;
inline constexpr std::size_t kShortCapacity=22;
inline constexpr std::size_t kMaxTextBytes=16384;
#if defined(__x86_64__)
// Preserve the legacy shared-header values for the isolated x86.64 owner path.
inline constexpr std::uintptr_t kNameBelowFrame=0x150;
inline constexpr std::uintptr_t kStackBelowFrame=0x340;
#else
// 2.8.1 GraphicsViewportBase::renderFrame::$_1 stores getNiceName at sp+0x210;
// x29-to-current-sp is 0x360, so that libc++ object is exactly x29-0x150.
inline constexpr std::uintptr_t kNameBelowFrame=0x150;
inline constexpr std::uintptr_t kStackBelowFrame=0x360;
#endif
struct StackRange { std::uintptr_t low=0,high=0; };
struct CallerFrameRecord { std::uintptr_t parent=0,returnPc=0; };
inline bool contains(StackRange stack,std::uintptr_t address,std::size_t size) noexcept {
 return stack.low<stack.high && address>=stack.low && address<stack.high &&
  size<=stack.high-address;
}
inline bool measureCaller(std::uintptr_t offset) noexcept {
#if defined(__x86_64__)
 return offset==0x23f514 || offset==0x23f5a8;
#else
 return offset==0x23a230 || offset==0x23a2d0;
#endif
}
inline bool blobCaller(std::uintptr_t offset) noexcept {
#if defined(__x86_64__)
 return offset==0x23fd24;
#else
 return offset==0x23acd8;
#endif
}
inline bool admitted(std::uintptr_t offset,int encoding) noexcept {
 return encoding==0 && (measureCaller(offset)||blobCaller(offset));
}
struct Span {std::uintptr_t data=0;std::size_t size=0;};
inline bool decode(const std::array<unsigned char,kObjectBytes>&object,
 std::uintptr_t address,Span*span) noexcept {
 if(span==nullptr)return false;
 Span candidate{};const unsigned tag=object[kTagOffset];
 if((tag&0x80U)!=0){
  std::uint64_t data=0,size=0,capacity=0;
  std::memcpy(&data,object.data(),8);std::memcpy(&size,object.data()+8,8);
  std::memcpy(&capacity,object.data()+16,8);capacity&=~(std::uint64_t{1}<<63);
  if(data==0||size==0||size>kMaxTextBytes||capacity<=kShortCapacity||capacity<size||
   data>std::numeric_limits<std::uintptr_t>::max()-size)return false;
  candidate={static_cast<std::uintptr_t>(data),static_cast<std::size_t>(size)};
 }else{
  if(tag==0||tag>kShortCapacity||object[tag]!=0)return false;
  candidate={address,tag};
 }
 *span=candidate;return true;
}
template<class Read>
bool callerFrameRecord(std::uintptr_t ownFrame,StackRange stack,Read read,
 CallerFrameRecord*output) noexcept {
 if(output==nullptr||(ownFrame&15U)!=0||!contains(stack,ownFrame,16))return false;
 std::array<std::uintptr_t,2> words{};
 if(!read(ownFrame,sizeof(words),words.data()))return false;
 if(words[0]<=ownFrame||(words[0]&15U)!=0||!contains(stack,words[0],16))return false;
 *output={words[0],words[1]};return true;
}
template<class Read>
bool callerFrame(std::uintptr_t ownFrame,StackRange stack,std::uintptr_t expectedPc,Read read,
 std::uintptr_t*caller) noexcept {
 if(caller==nullptr)return false;
 CallerFrameRecord record{};
 if(!callerFrameRecord(ownFrame,stack,read,&record)||record.returnPc!=expectedPc)return false;
 *caller=record.parent;return true;
}
template<class Read>
bool snapshot(std::uintptr_t offset,int encoding,std::uintptr_t frame,
 StackRange stack,std::uintptr_t text,std::size_t length,Read read,
 unsigned char*output,std::size_t outputCapacity,std::size_t*outputLength) noexcept {
 if(outputLength!=nullptr)*outputLength=0;
 if(!admitted(offset,encoding)||output==nullptr||outputLength==nullptr||
  (frame&15U)!=0||frame<kStackBelowFrame||!contains(stack,frame,16)||
  !contains(stack,frame-kStackBelowFrame,kStackBelowFrame)||
  length==0||length>kMaxTextBytes||length>outputCapacity)return false;
 const auto objectAddress=frame-kNameBelowFrame;
 std::array<unsigned char,kObjectBytes> before{},after{};Span span{};
 if(!read(objectAddress,before.size(),before.data())||!decode(before,objectAddress,&span)||
  text!=span.data||length!=span.size||!read(span.data,span.size,output))return false;
 unsigned char terminal=1;
 if(std::memchr(output,0,span.size)!=nullptr||!read(span.data+span.size,1,&terminal)||
  terminal!=0||!read(objectAddress,after.size(),after.data())||before!=after)return false;
 *outputLength=span.size;return true;
}
} // namespace viewport_owner
