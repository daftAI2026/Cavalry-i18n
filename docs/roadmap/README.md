<!--
[INPUT]: 依赖 docs/roadmap 下各主题路线图与 docs/audits 的事实报告
[OUTPUT]: 对外提供 roadmap 总索引、状态口径、归档规则与当前主题入口
[POS]: docs/roadmap 的目录入口，帮助后续 Agent 先看总览再进入单个 roadmap 文档
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Roadmap Index

## 定位

`docs/roadmap/` 记录“已经讨论清楚、但尚未执行或尚未完成”的工程路线。它不是事实报告，也不是稳定工作流：事实先进入 `docs/audits/`，执行步骤成熟后才升格进 `docs/workflows/`。

## 状态口径

- `Proposed`: 已有问题报告和推荐方向，但尚未开始实现。
- `Active`: 正在执行，允许阶段状态逐项更新。
- `Blocked`: 当前无法推进，必须写明阻塞条件。
- `Done`: 已完成并通过验收，准备归档。
- `Archived`: 已移动到 `docs/roadmap/archive/`，只保留历史参考。

## 当前路线

| Roadmap | 状态 | 依据 | 下一步 |
| --- | --- | --- | --- |
| [`localized-search-index.md`](localized-search-index.md) | Proposed | [`add-layer-localized-search-2026-05-21.md`](../audits/add-layer-localized-search-2026-05-21.md) | 执行 R1：抓取 QuickAdd 搜索框、列表模型与中英文 query 行为 |
| [`macos-app-management-handoff-animation.md`](macos-app-management-handoff-animation.md) | Active / Native implemented | 单一 App Management typed denial、UI Review、Rust/AppKit owner、真实 file-URL drag、reverse/cleanup 与 packaged shell 已落地；首次拒绝账户的 live 路径仍待验收 | 重打当前 HEAD，并在真实首次拒绝/`Quit & Reopen`/`Later` 路径验证新会话与重开提示 |
| [`runtime-refresh-performance.md`](runtime-refresh-performance.md) | Completed | [`runtime-performance-implementation-2026-07-13.md`](../audits/runtime-performance-implementation-2026-07-13.md) | 保持回归门；不重新引入普通交互全局刷新 |
| [`switcher-update-and-trusted-distribution-roadmap.md`](switcher-update-and-trusted-distribution-roadmap.md) | Active | R0 UI、R1 Rust/bridge/renderer、最终公钥/endpoint、受保护 updater Secrets、deterministic manifest 与 schema v6/v4 九资产发布闭包已实现；macOS 双架构无 tag 签名 smoke 已通过，真实 tag 与跨版本更新证据仍未满足 | 重打当前 macOS HEAD，并执行 Windows updater 与双平台跨版本验收 |
| [`windows-port-and-injection-roadmap.md`](windows-port-and-injection-roadmap.md) | Active | Windows Qt generic plugin、NSIS 与跨平台安装根合同 | 以真实 Windows Cavalry 完成安装、切换、重启、升级与卸载闭环 |

## 执行事件簿

- [`switcher-update-release-event-ledger.md`](switcher-update-release-event-ledger.md)：跟踪本轮 UI、组件状态机、Updater、实机证据、release/tag 与清理事项。它是临时执行控制面，不是新的发布 SOP。

## 归档规则

当一个 roadmap 进入 `Done` 或被判定失效时，再创建 `docs/roadmap/archive/` 并移动该文档。归档时必须：

1. 在原 roadmap 顶部把状态改为 `Archived`。
2. 在本索引中把条目移到“历史路线”。
3. 更新 `docs/roadmap/CLAUDE.md` 的成员清单。
4. 若该路线已经固化为稳定流程，再在 `docs/workflows/` 建立或更新对应 workflow。

当前没有已归档 roadmap，因此暂不创建空的 `archive/` 目录。
