/**
 * [INPUT]: 依赖共享 ClassicQuickAddPriorityApi，以及当前进程已加载的 Cavalry 2.7.2 Qt 6.6.3 映像
 * [OUTPUT]: 对外提供 macClassicQuickAddPriorityApi；仅返回通过双架构 UUID、导出 RVA 与 ElementListItem vtable 证明的评分函数
 * [POS]: macOS Classic 排序 ABI 防火墙；不读取私有字段、不做 IO，未知版本或类型立即返回空 API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "cavalry_i18n_classic_rank.h"

namespace cavalry_i18n {

// 只在已加载且完整匹配 Cavalry 2.7.2 的 macOS runtime 时返回非空 API。
ClassicQuickAddPriorityApi macClassicQuickAddPriorityApi() noexcept;

} // namespace cavalry_i18n
