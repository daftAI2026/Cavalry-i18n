# runs/
> L2 | 父级: docs/workflows/cavalry-full-ui-100/CLAUDE.md

成员清单
.gitkeep: 保持运行记录目录存在，本身不表达 gate 状态。
2026-04-29-bootstrap-context.md: 冷启动上下文记录，标记 workflow 初始执行面与当前 NOT COMPLETE 状态。
2026-04-29-W-AUDIT.md: W-AUDIT 通过记录，证明弱阈值、preflight、§P5 与 compiled target 红灯已收紧。
2026-04-29-W-X-extraction-inventory.md: G-X 阶段阻塞记录，证明弱 AX 抓取不能冻结 extraction inventory。
2026-04-30-NOT-COMPLETE-json-pass-compiled-runtime-fail.md: JSON 100% 但 compiled/runtime/G4 未通过的 session 收口记录。
2026-04-30-EXECUTION-CHECKPOINT.md: Phase 1 lower-bound 完成、Phase 2 进行中的执行 checkpoint，分离局部覆盖成果与整体未完成状态。
2026-04-30-FP4-investigation.md: 已作废的 FP-4 调查记录，保留诊断漂移证据，不作为 workflow 状态来源。
2026-04-30-FP4-investigation.json: 已作废 session 的机器记录拷贝，保留证据，不替代 `SESSION_DIR/full-ui-run-record.json`。
2026-04-30-FP4-diagnostic-drift.md: e5e1ad01 session 审计记录，定义 OpenCC commit quarantine、可信恢复点与下一轮话术。
2026-04-30-G-X-extraction-freeze.md: G-X freeze 实现记录，说明 extraction inventory 生成器与冻结输入边界。
2026-04-30-G-X-extraction-inventory-frozen.md: runtime 受限条件下的部分 extraction inventory 冻结记录，不能替代完整 G-X PASS。
2026-04-30-GATE-VERIFICATION-MATRIX.md: 当时 10 gate 的逐项验证矩阵，记录 5/10 局部完成而非最终通过。
2026-04-30-TRANSLATION-PHASE-SCOPE.md: extraction freeze 后的翻译规模、批次边界与执行顺序说明。
2026-04-30-cavalry-2.7.1-target-refresh.md: Cavalry 2.7.1/Qt 6.6.3 目标确认记录，要求重新抽取 compiled、runtime 与 G-X 分母。
2026-04-30-target-drift-capture-contract.md: target drift 与 AX submenu capture evidence 规则硬化，阻止旧分母和弱抓取继续证明当前版本。
2026-04-30-infrastructure-phase-complete.md: session 目录、capture/freeze 工具与 gate 基础设施完成记录，明确不等于 workflow 完成。
2026-04-30-partial-progress-g-capture-blocked.md: W-AUDIT/G-P 局部通过但 G-CAPTURE 被 SIP 阻塞的运行记录。
2026-04-30-workflow-start.md: 首轮执行入口与 G-CAPTURE 首个失败点记录。
2026-04-30-main-misapplied-infra-reverted.md: 89db6c1a session 误在 main 提交 full-ui infrastructure 的 INVALIDATED 记录，保存 quarantine 分支并用 revert 清理 main。
2026-04-30-worktree-progress-reconciled.md: 第二次错投 main 后的恢复记录，保存 backup branch、确认 useful work 已迁入 wip，并固定当前 G-X / G2 blocker。
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
2026-05-07-G-X-denominator-recleaning.md: Step 2 G-X 分母清洗 PASS 记录，冻结新 truth source 为 JSON 6292、compiled 3190、runtime candidates 617、menuLeaves 730，并登记 §F 噪声剔除 provenance。
2026-05-07-G2-G3-llm-batch-diagnostic-drift.md: Step 3 G2/G3 LLM 批译 BLOCKED 记录，证明同一 LLM batch blocker 两次修复仍复现并固定停止点。
2026-05-08-ALL-GATES-PASS.md: Step 3/4 最终 PASS 记录，绑定 session BC5BF821、cleaned denominator、三语 FP-1..12=0、check:full-ui overallPass=true / blockedReason=null 与 test:desktop 88/88。
2026-05-14-2.7.2-full-ui-result.md: Cavalry 2.7.2 目标刷新后的 full-ui 结果与同步修复记录。
2026-05-14-2.7.2-reverification.md: Cavalry 2.7.2 目标身份、session 数据与 gate 的独立复验记录。
2026-05-14-cavalry-2.7.2-target-refresh.md: 当前目标切换到 Cavalry 2.7.2 时的版本、Qt 与旧 artifact 隔离决策。
2026-07-29-macos-eight-surface-investigation.md: macOS p4 定向验收谱系；保留 F6B7C533 假绿失效与 d0d7cf38 日语 `Update -> ニュース` 人工拒绝，以 5bbc2099 的 21/21 runs、48/48 points、54/54 exact OS screenshots 封存当前候选，并追加 Cache producer 从任务日志恢复入 Git 的 hashes、编译与证据边界。
2026-07-30-windows-onboarding-live-validation.md: PR #3 Windows Onboarding 定向 release gate；2026-07-31 当前候选以 sentinel-owned Qt test profile、真实页面转场确认、三语 15/15 exact-PID/HWND PNG hash、step5-ack-only、English restore 与 exact-PID cleanup 重验证，并链接已独立关闭的邻接 producer 结论。
archive/: 反模式与污染 run note 取证目录，含 fabrication-era over-claim、失效 NEXT-STEPS.md 与 2026-04-30 G-CAPTURE 历史诊断，仅供反向回归，不参与当前 gate。

规则
- 每个 run log 必须包含 `## Status`，状态只允许 `PASS` / `FAIL` / `INVALIDATED` / `BLOCKED`。
- `ALL GATES PASS` 只能在 W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0-G4 全部通过后出现。
- 复审红灯成立但尚未修代码时，状态写 `FAIL`，不得写 `PASS`。
- run log 必须与候选代码一起存在于将被合并的 tracked branch/worktree；实验 worktree 忽略 `docs/` 时，应把同一记录同步到候选 tracked worktree，Copilot plan、session events、`RUN_RECORD` 都不能替代 markdown run log。
- 若同一 blocker 经两次修复仍复现，必须停止实现并写 diagnostic drift note；不得继续换 session、换检查口径或猜 latest artifact。
- Cavalry/Qt/executable/injector 身份变化后，旧截图、source-map、extraction 与 matrix 只作历史证据；当前候选必须使用新 session 重新验收。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
