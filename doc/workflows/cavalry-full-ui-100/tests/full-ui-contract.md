<!--
[INPUT]: 依赖本次对话中已经明确的目标、检测、检测结果，以及现有 repo 中的脚本名与 session run record 名
[OUTPUT]: 对外提供 W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0-G4 的详细验证契约与命令
[POS]: tests 层的 full-ui 详细 contract
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Full UI Contract

## Goal

把以下四件事同时锁死：

1. 检测链真实可信
2. 当前检测结果被完整记录
3. 最终目标是 provenance-verified whitelist-based 100%
4. 三语必须同一次 matrix 全绿

---

## W-AUDIT — Reviewer Red Flags Must Become Tests

PASS 条件：

- active full-ui / Tauri gate 实现 whitelist-filtered 100，并拒绝 legacy weak threshold（如 `--threshold 99`）；不要把 Electron 专属测试当作本 workflow 的修复目标
- `package.json` 的 `check:full-ui` 在 matrix 前调用 `tools/verify_gate_inputs.js`
- `tools/validate_translations.py` 在 coverage < `1.00` 时 exit 非 `0`
- `tools/check_runtime_ui_coverage.js` 把 `（译）` / 全角拉丁 / `页:1` 计入 forbidden pattern
- `tools/extract_compiled_ui_strings.js` 的 target contract 覆盖 `libExtensionLayer.dylib`

Electron 边界：

- `tools/check_electron_patcher_ui.js`、`tools/electron_harness.js`、`tools/capture_electron_*` 只可作为历史断言来源。
- 若其中仍有 full-ui 价值，迁移断言到 full-ui / Tauri gate。
- 不新增、不修复、不扩展 Electron 专属测试来满足本 workflow。

---

## G-X — Extraction Inventory Freeze Behaviors

### BX.1 frozen denominator must exist before translation

```bash
test -f "$SESSION_DIR/extraction-inventory.json"
```

PASS 条件：

- JSON / compiled / runtime 三类 surface 全部存在
- JSON lower bounds 达到 `10 / 6320 / 34 / 51 / total 6415`
- compiled source-map entries `>= 4743`
- runtime candidates `>= 613` 且 menu leaves `>= 666`，下界来自 A9B11073 合格基线
- `RUN_RECORD.extractionInventory.path/hash/mtime` 已记录

### BX.2 downstream gates must use frozen denominator

PASS 条件：

- G1 JSON 分母来自 `extraction-inventory.json`
- G2 compiled 分母来自 `extraction-inventory.json`
- G3 runtime 分母来自 `extraction-inventory.json`
- G4 matrix 记录同一个 extraction hash

失败条件：

- 任一 gate 使用 merge 后残留、source-map 子集或 runtime 当前可见子集作为分母
- extraction hash 在同一 run 中变化

---

## G-P — Provenance + Forbidden-Translation Behaviors

### BP.1 gate inputs must not come from fixtures or curated corpora

PASS 条件：

- 仓库内不存在 `tools/full_ui_inventory_fixtures/`
- 仓库内不存在 `doc/libExtensionLayer-curated-ui.txt`
- `package.json` 不含 `prepare:full-ui-gate`
- `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json.kind` 不为 `curated` / `whitelisted` / `gated`

### BP.2 runtime inventory must carry live capture provenance

PASS 条件：

- 每份 `sessions/<uuid>/runtime/<lang>-merged-inventory.json` 包含 `capture.pid`
- 每份 `sessions/<uuid>/runtime/<lang>-merged-inventory.json` 包含 `capture.bundleHash`
- 每份 `sessions/<uuid>/runtime/<lang>-merged-inventory.json` 包含 `capture.sessionUuid`
- 每份 `sessions/<uuid>/runtime/<lang>-merged-inventory.json` 包含 `capture.wallclockUtc`
- `capture.source` 只能是 `live-injector` / `live-accessibility` / `live-merged`

### BP.3 §P5 forbidden patterns must hard-fail

PASS 条件：

- `tools/verify_gate_inputs.js --section P5` 在干净 main 上通过
- `archive/cavalry-full-ui-100-v2-invalidated-20260428` 污染样本全部失败
- runtime / compiled / `.ts` / `.inc` / JSON 任意命中 `（译）`、全角拉丁、`页:N`、简繁串味、source==translation 自我递归时，gate exit 非 `0`

---

## G0 — Measurement Integrity Behaviors

### B0.1 package workflow scripts must exist

```bash
npm run test:desktop
```

PASS 条件：

- exit `0`

### B0.2 full-ui thresholds must be strict

检查：

- `check_full_ui_matrix.js`
- `check_full_ui_coverage.js`
- `check_runtime_ui_coverage.js`
- `validate_translations.py`

PASS 条件：

- full-ui threshold = `100`
- JSON threshold = `1.00`

---

## G1 — JSON Surface Behaviors

### B1.1 validator must reject any exact-English translate leaf

```bash
python3 tools/validate_translations.py \
  --root . \
  --json-report /tmp/cavalry-i18n-report.json \
  --markdown-summary /tmp/cavalry-i18n-summary.md
```

PASS 条件：

- exit `0`
- `coverage_threshold = 1.00`
- all target languages:
  - `exact_english_translate_leaves = 0`
  - `english_residue_count = 0`
  - `purity_issue_count = 0`

---

## G2 — Compiled Surface Behaviors

### B2.1 compiled source map must include real owner binaries

```bash
node tools/extract_compiled_ui_strings.js \
  --app /Applications/Cavalry.app \
  --output ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json
```

PASS 条件：

- `compiledUiTargets` includes `libExtensionLayer.dylib`

### B2.2 compiled source map must include known real UI strings

PASS 条件：

- `Scene Window`
- `Time Editor`
- `Swatches`
- `Default Keyframe Layer`
- `Enter an Asset name`
- `No Project Set`
- `Import Reference...`
- `Export Lottie...`

都能在 source map 中出现。

---

## G3 — Runtime Surface Behaviors

### B3.1 runtime gate must not trust a stale translated snapshot

PASS 条件：

- inventory 带 language metadata
- inventory 带 freshness metadata
- gate 会拒绝 language 不匹配或 stale inventory

### B3.2 runtime gate must see real visible UI

PASS 条件：

- merged inventory 同时覆盖 injector Qt inventory 和 AX inventory
- screenshot / AX 已知英文样本全部进入 blocker

---

## G4 — Matrix Behaviors

### B4.1 matrix must run all languages together

```bash
node tools/check_full_ui_matrix.js \
  --threshold 100 \
  --session-dir ~/Library/Caches/Cavalry-i18n/sessions/<uuid> \
  --compiled-source-map ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json
```

PASS 条件：

- exit `0`
- session run record `overallPass = true`
- `ja_JP` / `zh-Hans` / `zh-Hant` 全部 `pass = true`

### B4.2 matrix session run record must preserve surface detail

PASS 条件：

- 每语种保留：
  - `runtime`
  - `compiled`
  - `jsonValidation`
  - `forbiddenPatterns`
  - `provenance`

- session run record 顶层保留：
  - `sessionUuid`
  - `runtimeDir`
  - `sourceMap.path`
  - `sourceMap.hash`
  - `sourceMap.mtime`
  - `blockedReason`（若 blocked）

- session run record 不能只剩百分比，必须保留 blocker 明细

只有在以下条件同时满足时，才允许写：

```text
ALL GATES PASS
```

必要条件：

1. `W-AUDIT Reviewer Red Flags = PASS`
2. `G-P Provenance = PASS`
3. `§P5 Forbidden-Translation Patterns = PASS`
4. `G0 Measurement Integrity = PASS`
5. `G1 JSON Surface = PASS`
6. `G2 Compiled Surface = PASS`
7. `G3 Runtime Surface = PASS`
8. `G4 Three-Language Matrix = PASS`

只要任意一项不满足：

```text
NOT COMPLETE
```
