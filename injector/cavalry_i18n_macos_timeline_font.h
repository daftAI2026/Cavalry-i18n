/**
 * [INPUT]: 依赖启动期已确认的三语语言及当前 Cavalry 2.7.2 双架构映像
 * [OUTPUT]: 提供时间轴名称字体配置和只读计数快照，不改变名称、模型、搜索或工具提示
 * [POS]: macOS runtime 的独立字体接入边界，测量与绘制共用同一覆盖策略
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include <cstddef>
#include <cstdint>
namespace cavalry_i18n {
void configureMacTimelineFont(const char *language) noexcept;
struct MacTimelineFontDiagnostics {
    bool configured;
    bool verified;
    bool ready;
    std::uint64_t measureCalls;
    std::uint64_t drawCalls;
    std::uint64_t fallbackCalls;
    std::uint64_t originalCalls;
};
}
extern "C" bool cavalry_i18n_mac_timeline_font_diagnostics_v1(
    cavalry_i18n::MacTimelineFontDiagnostics *, std::size_t) noexcept;
