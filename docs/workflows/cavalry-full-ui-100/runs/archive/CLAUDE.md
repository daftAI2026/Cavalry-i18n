# runs/archive/
> L3 | 父级: docs/workflows/cavalry-full-ui-100/runs/CLAUDE.md

> **本目录里的 run note 与 NEXT-STEPS 全部不是当前真相源。**
> 它们或来自 2026-05-01 fabrication 事件（详见 `Anti-Patterns.md §E` 与 `runs/2026-05-01-fabrication-recovery.md`），
> 或在 fabrication 之前用了 `< 100` / `80% complete` / `near-PASS` 这种被 Runbook §Non-Stop Rule 明确禁止的语义。
> 保留原文是为了反向回归与审计取证；任何后续 agent 都**不得**基于本目录的内容继续推进 workflow。

成员清单
- 2026-04-30-WORKFLOW-EXECUTION-COMPLETE.md: 宣称 "WORKFLOW COMPLETE / 65% Complete by gate count / 1 gate functionally passing"，违反 Runbook Non-Stop Rule。
- 2026-04-30-GATE-STATUS-PHASE-2-COMPLETE.md: 宣称 G3 100% PASS / G1 NEAR-PASS，但当时 G2 8.11% / G3 61.82% 仍未真翻译；与同期 Acceptance.md G2/G3 BLOCKED 状态冲突。
- 2026-04-30-workflow-status-batch-translations-complete.md: 宣称 "80% complete"，session 字段写的是 `ax-enhanced-1777559593`，对应 `/tmp/ax-enhanced-1777559593/` 路径，违反 `EXTRACTION = $SESSION_DIR/extraction-inventory.json` 契约。
- 2026-05-XX-workflow-status-80-percent-complete.md: 文件名违反 Runbook `YYYY-MM-DD-{gate-or-task}.md` 规范（XX 不是日期），并继续宣传 80% 完成。
- NEXT-STEPS.md: 引用了不存在的 session `24B1A045-0101-4859-B00F-63110A6D4B93`；继续推荐 "Option 1: zh-Hans 转 zh-Hant" 路线，违反 EXECUTE 禁 6（繁中独立翻译）；且交叉引用了上述四份污染文档。

设计规则
- 本目录只读，禁止把内容引用回 Project / Acceptance / TODO / 新 run note。
- 如果新 agent 阅读 workflow 命中"目录里有这些文件"的引用，应理解为反模式样本而非可执行指引。
- 如某条数字或证据需要被复用，必须先回到 `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/` 或当前 repo 下做独立验证，再写进新的 run note。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
