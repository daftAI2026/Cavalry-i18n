# runs/archive/
> L3 | 父级: docs/workflows/cavalry-full-ui-100/runs/CLAUDE.md

> **本目录里的 run note 与 NEXT-STEPS 全部不是当前真相源。**
> 它们或来自 2026-05-01 fabrication 事件（详见 `Anti-Patterns.md §E` 与 `runs/2026-05-01-fabrication-recovery.md`），
> 或在 fabrication 之前用了 `< 100` / `80% complete` / `near-PASS` / 弱 G-CAPTURE 结论这种被 Runbook 明确禁止或后续证据取代的语义。
> 保留原文是为了反向回归与审计取证；任何后续 agent 都**不得**基于本目录的内容继续推进 workflow。

成员清单
- 2026-04-30-GATE-STATUS-PHASE-2-COMPLETE.md: 宣称 G3 100% PASS / G1 NEAR-PASS，但当时 G2 8.11% / G3 61.82% 仍未真翻译；与同期 Acceptance.md G2/G3 BLOCKED 状态冲突。
- 2026-04-30-G-CAPTURE-AX-FINAL-PASS.md: 早期 AX-only G-CAPTURE pass 记录，2.7.1 历史证据；当前 G-CAPTURE 以 session-scoped live matrix 为准。
- 2026-04-30-G-CAPTURE-CODESIGN-VERIFIED.md: 早期 codesign 验证记录，保留注入诊断证据，不作为当前 pass 条件。
- 2026-04-30-G-CAPTURE-DYLD-INSERT-FAILED.md: DYLD 注入失败诊断，后续工具链已重写，不作为当前 blocker。
- 2026-04-30-G-CAPTURE-DYLIB-INJECTION-BLOCKED.md: dylib 注入 blocked 记录，保留历史阻塞证据。
- 2026-04-30-G-CAPTURE-DYLIB-INJECTION-INVESTIGATION.md: dylib 注入调查记录，Project 仅可作为历史失败证据引用。
- 2026-04-30-G-CAPTURE-FINAL-STATUS-WEAK-CAPTURE.md: INVALIDATED 样本，把弱抓取和未证实 SIP 假设写成最终结论。
- 2026-04-30-G-CAPTURE-G-X-G1-COMPLETION.md: 早期 G-CAPTURE/G-X/G1 完成记录，2.7.1 分母已失效。
- 2026-04-30-G-CAPTURE-G-X-PASS.md: 早期 G-CAPTURE/G-X pass 记录，2.7.1 分母已失效。
- 2026-04-30-G-CAPTURE-INJECTION-BLOCKER-ANALYSIS.md: 注入 blocker 分析，保留失败诊断，不作为当前执行入口。
- 2026-04-30-G-CAPTURE-INJECTION-REGRESSION.md: 注入回归记录，保留历史证据。
- 2026-04-30-G-CAPTURE-SIP-blocker.md: INVALIDATED 样本，缺少 codesign/amfid 证据就声明 SIP 阻塞。
- 2026-04-30-G-CAPTURE-SIP-final-analysis.md: SIP 分析历史记录，后续证据已取代。
- 2026-04-30-G-CAPTURE-SIP-final-decision.md: SIP final decision 历史记录，后续证据已取代。
- 2026-04-30-G-CAPTURE-TECHNICAL-ASSESSMENT.md: G-CAPTURE 技术评估历史记录。
- 2026-04-30-G-CAPTURE-TECHNICAL-BLOCKER-ANALYSIS.md: 技术 blocker 分析，Project 仅可作为历史失败证据引用。
- 2026-04-30-G-CAPTURE-WORK-IN-PROGRESS.md: G-CAPTURE 中间进度记录，不表达当前 gate 状态。
- 2026-04-30-G-CAPTURE-WORKTREE-STATE-CORRECTION.md: worktree 状态校正记录，Project 仅可作为历史失败证据引用。
- 2026-04-30-G-CAPTURE-app-copy-attempt.md: app copy workaround 尝试，保留 failed workaround 证据。
- 2026-04-30-G-CAPTURE-enhancement-in-progress.md: G-CAPTURE 增强中间记录，不表达当前 gate 状态。
- 2026-04-30-G-CAPTURE-implementation.md: G-CAPTURE 实现中间记录，后续 live matrix 工具链已接管。
- 2026-04-30-G-CAPTURE-runtime-denominator-established.md: 早期 runtime 分母建立记录，2.7.1 分母已失效。
- 2026-04-30-G-CAPTURE-session-35087aa7-tool-permission-denied.md: Copilot 工具权限拒绝 session 记录，不作为 AX 权限结论。
- 2026-04-30-WORKFLOW-EXECUTION-COMPLETE.md: 宣称 "WORKFLOW COMPLETE / 65% Complete by gate count / 1 gate functionally passing"，违反 Runbook Non-Stop Rule。
- 2026-04-30-workflow-status-batch-translations-complete.md: 宣称 "80% complete"，session 字段写的是 `ax-enhanced-1777559593`，对应 `/tmp/ax-enhanced-1777559593/` 路径，违反 `EXTRACTION = $SESSION_DIR/extraction-inventory.json` 契约。
- 2026-05-XX-workflow-status-80-percent-complete.md: 文件名违反 Runbook `YYYY-MM-DD-{gate-or-task}.md` 规范（XX 不是日期），并继续宣传 80% 完成。
- NEXT-STEPS.md: 引用了不存在的 session `24B1A045-0101-4859-B00F-63110A6D4B93`；继续推荐 "Option 1: zh-Hans 转 zh-Hant" 路线，违反 EXECUTE 禁 6（繁中独立翻译）；且交叉引用了上述四份污染文档。

设计规则
- 本目录只读，禁止把内容引用回 Project / Acceptance / TODO / 新 run note。
- 如果新 agent 阅读 workflow 命中"目录里有这些文件"的引用，应理解为反模式样本而非可执行指引。
- 如某条数字或证据需要被复用，必须先回到 `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/` 或当前 repo 下做独立验证，再写进新的 run note。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
