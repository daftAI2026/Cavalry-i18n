/*
 * [INPUT]: Windows 2.8.1 PE取证的 Viewport blob caller 与嵌套栈返回位。
 * [OUTPUT]: 验证只有有序 segmented owner 可读取父栈名称，直接 caller 走已有完整输入。
 * [POS]: 无宿主的Windows 2.8.1精确栈链合同；只承认segmented caller及其后续父帧，direct caller必须拒绝。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "viewport_snapshot.h"
#include <cstdio>
int main(){
    using namespace native_windows_viewport;
    constexpr std::uintptr_t base=0x100000000ULL;
    const std::uintptr_t direct[]={base+kViewportBlobReturn};
    if(approvedProducerFrames(direct,1,base))return 1;
    const std::uintptr_t segmented[]={base+kSegmentedBlobReturn,base+kSegmentedParentReturn};
    if(!approvedProducerFrames(segmented,2,base))return 2;
    const std::uintptr_t wrongOrder[]={base+kSegmentedParentReturn,base+kSegmentedBlobReturn};
    if(approvedProducerFrames(wrongOrder,2,base))return 3;
    const std::uintptr_t noParent[]={base+kSegmentedBlobReturn};
    if(approvedProducerFrames(noParent,1,base))return 4;
    const std::uintptr_t adjacent[]={base+kViewportBlobReturn+1};
    if(approvedProducerFrames(adjacent,1,base))return 5;
    const std::uintptr_t unrelated[]={base+0x40d784,base+0x430bfe};
    if(approvedProducerFrames(unrelated,2,base))return 6;
    std::puts("Windows Viewport direct/segmented producer stack contract passed");
}
