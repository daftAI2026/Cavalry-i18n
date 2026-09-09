/**
 * [INPUT]: 依赖共享 Classic priority attachment、Cavalry.exe 同目录的 Cavalry 2.7.2 Windows x64 模块及 GetProcAddress/PE64/RTTI 公共边界
 * [OUTPUT]: 对外提供一次性验证后的 Windows Classic ListItem priority API；非法映像、路径、导出或 ElementListItem 对象全部 fail-closed
 * [POS]: injector/windows 的 Classic vendor ABI 防火墙；只适配原厂导出的 getter/setter，不读取私有 priority 字段、不触碰 Fast
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "../cavalry_i18n_classic_rank.h"

namespace cavalry_i18n {

// 验证只在首次请求 API 时发生；共享 attachment 先调用 accepts，再在同一
// 同步 model callback 中调用其余函数，因此每个候选只做一次 VirtualQuery。
ClassicQuickAddPriorityApi windowsClassicQuickAddPriorityApi() noexcept;

} // namespace cavalry_i18n
