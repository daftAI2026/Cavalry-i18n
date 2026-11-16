/**
 * [INPUT]: 依赖官方2.8.1 x86_64 GetPath caller链和只读帧读取器。
 * [OUTPUT]: 提供共享GetPath缓存链所需线程栈与caller-frame原语。
 * [POS]: x86 target专用共享头；Viewport名称由x86 TextBlob专用owner合同读取。
 * [PROTOCOL]: ABI变化时更新profile快照。
 */
#pragma once
#include <cstddef>
#include <cstdint>
namespace viewport_owner {
struct StackRange { std::uintptr_t low=0, high=0; };
struct CallerFrameRecord { std::uintptr_t parent=0, returnPc=0; };
inline bool contains(StackRange stack, std::uintptr_t address, std::size_t size) noexcept {
 return stack.low < stack.high && address >= stack.low && address < stack.high && size <= stack.high-address;
}
inline bool measureCaller(std::uintptr_t) noexcept { return false; }
inline bool blobCaller(std::uintptr_t) noexcept { return false; }
inline bool admitted(std::uintptr_t, int) noexcept { return false; }
template<class Read> bool callerFrameRecord(std::uintptr_t frame, StackRange stack, Read read, CallerFrameRecord *out) noexcept {
 if(out==nullptr || (frame&15U)!=0 || !contains(stack,frame,16)) return false;
 std::uintptr_t words[2]{}; if(!read(frame,sizeof(words),words)) return false;
 if(words[0]<=frame || (words[0]&15U)!=0 || !contains(stack,words[0],16)) return false;
 *out={words[0],words[1]}; return true;
}
template<class Read> bool callerFrame(std::uintptr_t frame, StackRange stack, std::uintptr_t expectedPc, Read read, std::uintptr_t *caller) noexcept {
 if(caller==nullptr) return false; CallerFrameRecord record{}; if(!callerFrameRecord(frame,stack,read,&record) || record.returnPc!=expectedPc) return false; *caller=record.parent; return true;
}
}
