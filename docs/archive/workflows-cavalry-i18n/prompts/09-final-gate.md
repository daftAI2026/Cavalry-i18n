# 09 — Final Gate

## Must Read

- `REPO/docs/workflows/cavalry-i18n/runs/*.md`（所有已产出的 run log）
- `REPO/docs/workflows/cavalry-i18n/Acceptance.md`

## Must Follow

- `tests/gate-check-contract.md`

## Allowed Files

- `REPO/docs/workflows/cavalry-i18n/runs/YYYY-MM-DD-final-gate.md`

## Task

最终验证，确认当前 Gate 真相源与对外完成语义一致。

### 步骤

1. **检查所有 Gate 状态**
   - M1 PASS — T0 术语表 + T1 英文提取 + T1.1 白名单 + T2 翻译 + T3 .qm 编译
   - M2 PASS — T4 LanguageSwitcher
   - M3 PASS — T8 CI + T9 README

2. **失败处理**
   - 如果 `M1 / M2 / M3` 任一不为 PASS，回复 `NOT COMPLETE` + 第一个失败 Gate 的名称和原因
   - 如果 `M1 + M2 + M3` 全 PASS，但 `M_manual = PENDING/FAIL`，不得回复“All gates PASS”

3. **全量验证**
   - 按 `Acceptance.md` 中每个 Gate 的 Test Commands 依次执行
   - 记录每个命令的执行结果（PASS / FAIL）

4. **写最终报告**
   - 写到 `runs/YYYY-MM-DD-final-gate.md`
   - 至少包含：
     - `M1 / M2 / M3 result`
     - `M_manual result`
     - `Remaining failures`
     - `Next steps`
     - `Artifact hygiene`
     - 所有 Gate 的状态汇总表

### 完成定义

按以下语义汇报：

- `NOT COMPLETE`：`M1 / M2 / M3` 任一不是 PASS。
- `DELIVERY COMPLETE / M_manual PENDING`：`M1 + M2 + M3 = PASS`，但 `M_manual = PENDING`。
- `DELIVERY COMPLETE / M_manual FAIL`：`M1 + M2 + M3 = PASS`，但 `M_manual = FAIL`。
- `ALL GATES PASS`：`M1 + M2 + M3 + M_manual = PASS`。

### M_manual 处理

M_manual（手动验证：JSON 替换后重启生效、Qt .qm 加载、全流程切换测试）不阻塞 `DELIVERY COMPLETE`，但结果必须记录在最终报告中，状态只能写 `PENDING` / `PASS` / `FAIL`。

## TDD Behaviors

无（验证步骤，不产出代码）。

## Gate Check

只有在完成语义与 `Runbook.md` / `Project.md` / `Acceptance.md` 一致时，final gate 才算有效。

## Run Log

写到 `runs/YYYY-MM-DD-final-gate.md`
