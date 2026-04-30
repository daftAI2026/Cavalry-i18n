<!--
[INPUT]: 依赖 Acceptance.md §G-X、Project.md 的 artifact model、Anti-Patterns.md Denominator Shrink
[OUTPUT]: 对外提供 extraction inventory freeze 的 RED→GREEN 执行协议
[POS]: prompts 的分母冻结步骤，阻断未抽全即翻译
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 02 — Extraction Inventory Freeze（W-X / G-X）

## Must Read

- `WORKFLOW/Acceptance.md` §G-X
- `WORKFLOW/Anti-Patterns.md` §C Denominator Shrink
- `WORKFLOW/TODO.md` §W-X

## Allowed Files

- `REPO/tools/extract_compiled_ui_strings.js`
- `REPO/tools/check_full_ui_matrix.js`
- `REPO/tools/check_runtime_ui_coverage.js`
- `REPO/tools/verify_gate_inputs.js`
- `REPO/tools/run_live_full_ui_matrix.js`
- `REPO/tools/capture_accessibility_inventory.js`
- `REPO/tools/merge_runtime_inventory.js`
- `WORKFLOW/tests/*`
- `WORKFLOW/runs/YYYY-MM-DD-W-X-extraction-inventory.md`

## Task

先冻结完整英文分母，再允许任何翻译动作。`SESSION_DIR/extraction-inventory.json` 是 G1/G2/G3/G4 的唯一 denominator source。
Cavalry version、Qt version、bundle hash 是 denominator 的组成部分；任一变化都必须重新抽取、重新 capture、重新 freeze。

### Required surfaces

| Surface | Lower bound |
| --- | ---: |
| `languages/en/appStrings.json` | >= 10 leaves |
| `languages/en/nodeStrings.json` | >= 6320 leaves |
| `languages/en/onboarding.json` | >= 34 leaves |
| `languages/en/tips.json` | >= 51 leaves |
| JSON total | >= 6415 leaves |
| `SOURCE_MAP.entries` | >= 4743 entries |
| runtime candidates | >= 613 |
| runtime menuLeaves | >= 666 |

Runtime 下界来自本机合格基线 session `A9B11073-A9E6-4E1C-A6B2-59BBEA94D38B`，不是拍脑袋数字。旧 `menuBars >= 500` / `widgetTexts >= 200` 废弃。

`EXTRACTION` 必须记录 target identity：`target.cavalryVersion`、`target.qtVersion`、`target.bundleHash`、`target.appPath`。这些字段必须与 `RUN_RECORD.target`、`SOURCE_MAP.target`、runtime `capture.bundleHash` 一致。

### Required runtime walk

必须主动展开或访问：

- Library
- Inspector
- Timeline
- Render Queue
- Preferences
- menu / submenu / panel title / tab / placeholder / tooltip / status / empty-state

## TDD Behaviors

1. 缺 `extraction-inventory.json` 时，translation prompt preflight 必须 fail。
2. 任一 JSON lower bound 不足时，G-X 必须 fail。
3. `SOURCE_MAP.entries < 4743` 时，G-X 必须 fail。
4. runtime candidates/menuLeaves 下界不足时，G-X 必须输出 `WEAK-CAPTURE` 并 fail。
5. G1/G2/G3/G4 若使用非 frozen denominator，必须 fail。
6. `extraction-inventory.json` hash 在后续 gate 中变化，必须 invalidate 当前 run。
7. Cavalry target version / bundle hash 与 current app 不一致时，G-X 必须 fail。

## Gate Check

```bash
test -f "$SESSION_DIR/extraction-inventory.json"
node tools/verify_gate_inputs.js \
  --session-dir "$SESSION_DIR" \
  --compiled-source-map "$SOURCE_MAP" \
  --extraction-inventory "$SESSION_DIR/extraction-inventory.json"
```

## Run Note

写到 `runs/YYYY-MM-DD-W-X-extraction-inventory.md`。
