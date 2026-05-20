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
| [`runtime-refresh-performance.md`](runtime-refresh-performance.md) | Proposed | [`runtime-refresh-performance-2026-05-21.md`](../audits/runtime-refresh-performance-2026-05-21.md) | 执行 R1/R2：收敛合同测试，移除普通交互全局刷新 |

## 归档规则

当一个 roadmap 进入 `Done` 或被判定失效时，再创建 `docs/roadmap/archive/` 并移动该文档。归档时必须：

1. 在原 roadmap 顶部把状态改为 `Archived`。
2. 在本索引中把条目移到“历史路线”。
3. 更新 `docs/roadmap/CLAUDE.md` 的成员清单。
4. 若该路线已经固化为稳定流程，再在 `docs/workflows/` 建立或更新对应 workflow。

当前没有已归档 roadmap，因此暂不创建空的 `archive/` 目录。
