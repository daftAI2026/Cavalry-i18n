<!--
[INPUT]: 依赖 Acceptance.md G-X + G1 + G4 + 当前 workflow 的 artifact contract
[OUTPUT]: 对外提供 .qm 编译 + final matrix 闭环协议（前提：G-X/G1 已先达成）
[POS]: prompts 最终步骤
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 11 — Compile QM & Final Matrix（W8 / G4，复核 G-X / G1 已达成）

## Must Read

- `WORKFLOW/Acceptance.md` §G1 + §G4
- `WORKFLOW/Acceptance.md` §G-X
- `WORKFLOW/Acceptance.md` §Artifact Contract
- `WORKFLOW/tests/full-ui-contract.md`

## Allowed Files

- `REPO/languages/*/cavalry_*.qm`
- `REPO/languages/*/qtbase_*.qm`

## Required Inputs

- `SESSION_DIR = ~/Library/Caches/Cavalry-i18n/sessions/<uuid>`
- `RUN_RECORD = $SESSION_DIR/full-ui-run-record.json`
- `SOURCE_MAP = ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json`
- `EXTRACTION = $SESSION_DIR/extraction-inventory.json`

## Final Conditions

1. `validate_translations.py` 已先达到 `1.00`
2. `extraction-inventory.json` 已冻结且 hash 写入 `RUN_RECORD`
3. 三语 runtime / compiled / json 全 PASS
4. `forbiddenPatterns.total = 0`
5. `RUN_RECORD` 记录 `sessionUuid`、source-map provenance 与 frozen denominator
6. 最终结论只允许写 `ALL GATES PASS` 或 `NOT COMPLETE`

## Gate Check

```bash
python3 tools/validate_translations.py --root . --json-report /tmp/r.json --markdown-summary /tmp/s.md
node tools/check_full_ui_matrix.js --threshold 100 --session-dir ~/Library/Caches/Cavalry-i18n/sessions/<uuid> --compiled-source-map ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json
```

## Run Note

写到 `runs/YYYY-MM-DD-W8-final-matrix.md`
