# runs/
> L2 | 父级: doc/workflows/cavalry-full-ui-100/CLAUDE.md

成员清单
.gitkeep: 保持运行记录目录存在，本身不表达 gate 状态。
2026-04-29-bootstrap-context.md: 冷启动上下文记录，标记 workflow 初始执行面与当前 NOT COMPLETE 状态。
2026-04-29-W-AUDIT.md: W-AUDIT 通过记录，证明弱阈值、preflight、§P5 与 compiled target 红灯已收紧。
2026-04-29-W-X-extraction-inventory.md: G-X 阶段阻塞记录，证明弱 AX 抓取不能冻结 extraction inventory。
2026-04-30-NOT-COMPLETE-json-pass-compiled-runtime-fail.md: JSON 100% 但 compiled/runtime/G4 未通过的 session 收口记录。
2026-04-30-FP4-investigation.md: 已作废的 FP-4 调查记录，保留诊断漂移证据，不作为 workflow 状态来源。
2026-04-30-FP4-investigation.json: 已作废 session 的机器记录拷贝，保留证据，不替代 `SESSION_DIR/full-ui-run-record.json`。
2026-04-30-FP4-diagnostic-drift.md: e5e1ad01 session 审计记录，定义 OpenCC commit quarantine、可信恢复点与下一轮话术。
2026-04-30-cavalry-2.7.1-target-refresh.md: Cavalry 2.7.1/Qt 6.6.3 目标确认记录，要求重新抽取 compiled、runtime 与 G-X 分母。
2026-04-30-target-drift-capture-contract.md: target drift 与 AX submenu capture evidence 规则硬化，阻止旧分母和弱抓取继续证明当前版本。
2026-04-30-main-misapplied-infra-reverted.md: 89db6c1a session 误在 main 提交 full-ui infrastructure 的 INVALIDATED 记录，保存 quarantine 分支并用 revert 清理 main。
2026-04-30-G-CAPTURE-session-35087aa7-tool-permission-denied.md: 35087aa7 session 未完成 G-CAPTURE，Copilot 工具权限拒绝导致未创建 session artifacts / run note；不作为 AX 权限结论。
2026-04-30-worktree-progress-reconciled.md: 第二次错投 main 后的恢复记录，保存 backup branch、确认 useful work 已迁入 wip，并固定当前 G-X / G2 blocker。
2026-04-30-G-CAPTURE-SIP-blocker.md: INVALIDATED 样本，没有出示 `codesign-evidence.txt` 就声明 SIP 内核阻塞；保留作为 `Anti-Patterns.md` §D SIP-Blame Misdiagnosis 的反向回归证据，不作为 G-CAPTURE 真相源。
2026-04-30-G-CAPTURE-FINAL-STATUS-WEAK-CAPTURE.md: INVALIDATED 样本，把 9-candidate AX 弱抓取 + 未验证的 SIP 假设当作 G-CAPTURE 最终结论；保留作为 `Anti-Patterns.md` §D 的反向回归证据，不作为 G-CAPTURE 真相源。
2026-04-30-G-CAPTURE-WORKTREE-STATE-CORRECTION.md: 69d6bfc worktree 状态校正记录，撤销 active 文档中的 SIP 结论，固定当前第一失败 gate 为 G-CAPTURE runtime live denominator 未成立。
2026-05-01-G2b-batch-1-complete.md: G2b Batch 1 真翻译记录（50 条 compiled UI），cherry-pick 自 b4f784c。
2026-05-01-CHECKPOINT-Batch1-Done.md: G2b Batch 1 完成 checkpoint，配合 batch-1-complete 阅读。
2026-05-01-G2b-batch-2-complete.md: G2b Batch 2 真翻译记录（50 条 compiled UI），cherry-pick 自 88760e9。
2026-05-01-fabrication-recovery.md: 2026-05-01 伪造事件复盘 + reset/cherry-pick 恢复 + §P5 加固总览，是后续 agent 的入口 run note。
2026-05-05-doc-alignment-fp-set-and-5195-and-archive.md: 文档对齐记录，把 §P5 表与 detector JSON 同集、compiled lower bound 4743→5195 加 provenance、fabrication-era 与 NEXT-STEPS.md 归档；不动 gate 状态与代码。
2026-05-05-review-finding-fixes.md: Review finding 修复记录，收敛当前状态口径、5195 gate、§P5 detector 集合与 executable contract；保留 G-P / G-X / G2 / G3 剩余 blocker。
2026-05-05-G-P-P5-reverify.md: G-P / §P5 复核记录，证明 root-cache runtime 旁路已封堵、FP-8 context 检测已接通、FP-9 已清零。
2026-05-05-P5-GX-matrix-reverify.md: 本轮 P5/G-CAPTURE/G-X/G0/G1/G3 复核记录，证明 FP-9 清零、top-level target 已冻结、G2/G4 仍因真实 compiled 翻译缺口 FAIL。
2026-05-07-INVALIDATED-G2-G4-fabrication-via-transliteration.md: 2026-05-07 G2/G4 ALL GATES PASS 声明的 INVALIDATED 取证，定义 FP-10 transliteration / FP-11 font-sample pangram / FP-12 placeholder reuse 三类反模式，绑定 quarantine/cavalry-full-ui-100-transliteration-20260507 @ 2db74b7 与 detector 升级清单。
2026-05-07-G-P-FP-10-11-12-detector-uplift.md: Step 1 §P5 detector 升级 PASS 记录，证明 FP-10/11/12 命中 transliteration quarantine、当前 HEAD 零误报、fabrication quarantine FP-7/8/9 下界未退化。
2026-05-07-G-X-denominator-recleaning.md: Step 2 G-X 分母清洗 PASS 记录，冻结新 truth source 为 JSON 6301、compiled 3309、runtime candidates 620、menuLeaves 734，并登记 §F 噪声剔除 provenance。
archive/: 反模式与污染 run note 取证目录，含 fabrication-era over-claim 报告与失效的 NEXT-STEPS.md，仅供反向回归，不参与当前 gate。

规则
- 每个 run log 必须包含 `## Status`，状态只允许 `PASS` / `FAIL` / `INVALIDATED` / `BLOCKED`。
- `ALL GATES PASS` 只能在 W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0-G4 全部通过后出现。
- 复审红灯成立但尚未修代码时，状态写 `FAIL`，不得写 `PASS`。
- 执行 worktree 忽略 `doc/` 时，run log 仍必须写回主仓库 `doc/workflows/cavalry-full-ui-100/runs/`；Copilot plan、session events、`RUN_RECORD` 都不能替代 markdown run log。
- 若同一 blocker 经两次修复仍复现，必须停止实现并写 diagnostic drift note；不得继续换 session、换检查口径或猜 latest artifact。
- Cavalry 目标版本变化后，旧 `compiled-ui-source-map.json`、`extraction-inventory.json`、`full-ui-run-record.json` 只作历史证据；当前 gate 必须重新抽取、捕获、冻结。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
