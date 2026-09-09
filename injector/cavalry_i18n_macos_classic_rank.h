/**
 * [INPUT]: 依赖共享 ClassicQuickAddPriorityApi，以及当前进程已加载的 Cavalry 2.7.2 Qt 6.6.3 映像
 * [OUTPUT]: 对外提供 macClassicQuickAddPriorityApi 与同映像显示函数解析门；仅返回通过双架构 UUID、导出 RVA 与 ElementListItem vtable 证明的评分函数
 * [POS]: macOS Classic 排序 ABI 防火墙；不读取私有字段、不做 IO，未知版本或类型立即返回空 API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "cavalry_i18n_classic_rank.h"
#include <cstddef>
#include <cstdint>

namespace cavalry_i18n {

// 只在已加载且完整匹配 Cavalry 2.7.2 的 macOS runtime 时返回非空 API。
ClassicQuickAddPriorityApi macClassicQuickAddPriorityApi() noexcept;

// 显示适配器复用同一已锁定并 pin 的映像，不自行重建 UUID 或 dlsym 信任边界。
void *macVerifiedQuickAddUiFunction(const char *symbol, std::uintptr_t rva,
    const std::uint8_t *code, std::size_t size) noexcept;

} // namespace cavalry_i18n
