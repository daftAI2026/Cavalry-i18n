<!--
[INPUT]: 依赖 review findings、Project.md / Acceptance.md / TODO.md 当前状态、tools/verify_gate_inputs.js 与 forbidden detector 实现
[OUTPUT]: 对外提供本轮 review finding 修复记录、验证命令与剩余 blocker
[POS]: full-ui-100 runs 的 review-fix 语义证据，证明状态口径与 gate 实现已重新对齐
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-05-05 review finding fixes

## Status

PASS

## Changes

- `Project.md` 收敛当前状态：默认 `NOT COMPLETE`，第一失败 gate 为 G-P / §P5 reverify，不再混写 82% / 50% / G-X next 等旧口径。
- `Acceptance.md` 修正 G-CAPTURE / G-X 表述：删除 `638 >= 666` 假判断，G-X 改为 evidence-held，并显式保留顶层 `EXTRACTION.target` blocker。
- `tools/verify_gate_inputs.js` 将 current compiled source-map lower bound 固定为 `5195`，并新增 executable contract 防止回退到 4743。
- §P5 当前集合统一为 FP-1/2/3/4/5/7/8/9；旧自我递归 ID 从 JS / Python detector、JSON config、prompt 与 contract 中移除。
- `tests/CLAUDE.md` 补齐 executable contract 成员；`capture-accessibility-contract.test.js` 补 L3 头部。

## Verification

```text
node --test doc/workflows/cavalry-full-ui-100/tests/extraction-inventory-contract.test.js doc/workflows/cavalry-full-ui-100/tests/capture-accessibility-contract.test.js
PASS: 4/4

npm run test:desktop
PASS: 82/82

stale active-surface scan
PASS: no old 4743 current lower bound, no 638>=666, no 82%/50% progress, no active FP-6 requirement
```

## Remaining Blocker

- G-P / §P5 must still be rerun against current HEAD and `quarantine/cavalry-full-ui-100-fabrication-20260501`.
- Next G-X freeze must write top-level `EXTRACTION.target`.
- G2 / G3 translation backlog still blocks G4.
