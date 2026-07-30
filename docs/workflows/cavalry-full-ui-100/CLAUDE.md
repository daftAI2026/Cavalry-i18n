# cavalry-full-ui-100/
> L2 | 父级: docs/CLAUDE.md

成员清单
- Project.md: 目标、当前 workflow 口径、当前实现真相、完成语义
- Acceptance.md: W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0-G4 的规范性通过/失败条件
- Runbook.md: 执行纪律、artifact hygiene、固定顺序、run log 规范，以及 8 条跨平台 exact-only 普通 Qt 文本的 macOS owner-backfill 交接、tracked 21-run/48-point producer 入口、当前候选完成勾选与 target drift 重开边界
- Flow.md: 端到端流程图与 gate ownership
- EXECUTE.md: 冷启动执行入口、完整抽取前置条件与绝对禁止清单
- TODO.md: 当前实现缺口与任务顺序
- Anti-Patterns.md: fixture/curated、伪翻译、分母缩水三类反绕过档案
- translation-backlog-template.csv: 翻译积压工作模板，为三语翻译项梳理提供结构化表格。
- tests/: 契约文档目录
- runs/: 运行记录目录
- prompts/: 分步执行指令目录

设计规则
- 本 workflow 只保留当前规范口径；历史版本号仅出现在 archive / run note / 案例出处中。
- 规范 (`Acceptance.md`) 与当前代码真相 (`Project.md` / `TODO.md`) 必须分开写。
- 翻译动作必须等 G-CAPTURE 抓取链路可信、G-X `extraction-inventory.json` 冻结 JSON / compiled / runtime 完整英文分母后才能开始。
- runtime truth source 只允许来自 `SESSION_DIR/runtime/*`；cache 根目录 runtime inventory / merged inventory / runlog 一律非法。
- `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json` 是当前唯一允许位于 cache 根目录的 gate 输入，但必须显式绑定并记录 provenance。
- Cavalry version / Qt version / bundle hash 是 denominator 的一部分；目标变化后旧 JSON 100、compiled coverage、runtime capture 只能作为历史证据。
- AX 菜单抓取必须留下递归证据：`menuDepthMax` 与 submenu path samples；只证明脚本会递归不等于本轮抓取合格。
- 翻译引擎只允许 LLM；禁止 fixture / curated / 本地词表 / 全角化 / 占位标记 / 自我递归伪翻译。
- 构建与发布遵守 `docs/LOCAL_BUILD_SOP.md` 的 Tauri-only 路径；旧壳层路径已删除，不作为本 workflow 修复目标。
- `Anti-Patterns.md` 只保留历史证据；若与 `Project.md` / `Acceptance.md` / `Runbook.md` 冲突，以后三者为准。旧 `ChatlogRef.md` 已归档到 `docs/archive/full-ui-100-chatlog-ref.md`。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
