<!--
[INPUT]: 依赖 Acceptance.md §G-P、Anti-Patterns.md、tests/full-ui-contract.md
[OUTPUT]: 对外提供 provenance guard 的 RED→GREEN 执行协议
[POS]: prompts provenance 阶段（先于 §P5 detector wiring）
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 03 — Provenance Gate（W-P）

## Must Read

- `WORKFLOW/Acceptance.md` §G-P
- `WORKFLOW/Runbook.md` §Artifact Hygiene Rule
- `WORKFLOW/tests/full-ui-contract.md` §G-P

## Allowed Files

- `REPO/tools/verify_gate_inputs.js`
- `REPO/tools/check_full_ui_matrix.js`
- `REPO/tools/check_runtime_ui_coverage.js`
- `REPO/tools/launch_cavalry_with_injector.sh`
- `REPO/injector/CavalryTranslatorInjector.mm`

## Task

创建 / 收紧 `tools/verify_gate_inputs.js`，让 matrix 只信任：

- 当前 `SESSION_DIR/runtime/*`
- 显式绑定的 `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json`

本 prompt 先固定输入来源与 session contract，再进入 `04-forbidden-translation-detector` 做 §P5 接线。

## 必须 hard-fail

1. fixture / curated 残留
2. `prepare:full-ui-gate`
3. runtime inventory 缺 `capture.pid` / `bundleHash` / `sessionUuid` / `wallclockUtc` / `source`
4. `capture.source` 非 `live-*`
5. runtime input 位于 cache 根目录而不是 `SESSION_DIR/runtime/`
6. session UUID 与 artifact 不一致

## 说明

- cache 根目录如果还残留 runtime inventory，不是 warn-only，而是需要显式清理或隔离；workflow 不再给它“可读但不 fail”的地位
- `compiled-ui-source-map.json` 是唯一允许位于 cache 根目录的 gate 输入

## Gate Check

```bash
node tools/verify_gate_inputs.js \
  --repo-root . \
  --cache-root ~/Library/Caches/Cavalry-i18n \
  --session-dir ~/Library/Caches/Cavalry-i18n/sessions/<uuid>
```

## Run Note

写到 `runs/YYYY-MM-DD-W-P-provenance-gate.md`
