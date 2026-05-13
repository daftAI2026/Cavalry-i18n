<!--
[INPUT]: 依赖 tools/freeze_extraction_inventory.js、tools/translation-whitelist.json §F extraction filters、session 1D78B1A9 runtime/compiled artifacts 与 Step 1 FP-10/11/12 detector
[OUTPUT]: 对外提供 G-X denominator recleaning PASS 记录、新 frozen denominator 数字与 provenance
[POS]: runs 的 G-X 清洗冻结记录，替代旧 6415 / 5195 / 626 / 734 污染分母
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-05-07 G-X — denominator recleaning

## Status

PASS

## Scope

- `tools/freeze_extraction_inventory.js` 在冻结前读取 `tools/translation-whitelist.json` 的 `_extraction_filters`。
- 剔除规则必须带 `glossary_source`；缺失即 hard-fail，避免无出处 allowlist。
- JSON surface 只冻结 whitelist 触达的 translate/no_translate/locale_sync leaves，再剔除 §F 噪声。
- compiled/runtime surfaces 统一剔除字体 family、Unicode glyph/script 名、颜色名、字体 pangram、AX role 噪声与已登记无义短串。
- `tools/verify_gate_inputs.js` 与 runtime capture floor 更新到新分母。

## Frozen Truth

```text
sessionUuid          = 1D78B1A9-37BE-4360-B61F-A0314766F7D6
extractionInventory = ~/Library/Caches/Cavalry-i18n/sessions/1D78B1A9-37BE-4360-B61F-A0314766F7D6/extraction-inventory.json
hash                = 08a01029a362bc130a9bdd941576f672094258d81c4dcb43e6bfdac61469c28b
jsonTotal           = 6292
compiledCandidates  = 3190
runtimeCandidates   = 617
runtimeMenuLeaves   = 730
```

JSON breakdown:

```text
appStrings   = 10
nodeStrings  = 6197
onboarding   = 34
tips         = 51
```

Exclusions:

```text
compiled-source-map        excluded 2005
languages/en/nodeStrings   excluded 49
runtime-candidates         excluded 9
runtime-menuLeaves         excluded 4
filter source              doc/workflows/cavalry-full-ui-100/Anti-Patterns.md §F
generated exact values     1701 from color-name-list@14.36.0 and Unicode PropertyValueAliases.txt intersections; runtime-visible strings preserved
generated regex values     title/CSS color-tail regex for residual Cavalry color brand names
short ASCII regex          registered meaningless short fragments, font names, and shaping-engine phase labels per Anti-Patterns.md §F
```

## Verification

```text
node --test doc/workflows/cavalry-full-ui-100/tests/extraction-inventory-contract.test.js tools/check_electron_patcher_ui.js
PASS: 79/79
```

```text
node tools/verify_gate_inputs.js \
  --cache-root ~/Library/Caches/Cavalry-i18n \
  --session-dir ~/Library/Caches/Cavalry-i18n/sessions/1D78B1A9-37BE-4360-B61F-A0314766F7D6 \
  --compiled-source-map ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json \
  --extraction-inventory ~/Library/Caches/Cavalry-i18n/sessions/1D78B1A9-37BE-4360-B61F-A0314766F7D6/extraction-inventory.json
PASS: {"pass": true, "violations": []}
```

## Decision

G-X is complete on the cleaned denominator. Old `6415 / 5195 / 626 / 734` and `6415 / 4919 / 626` are historical evidence only; Step 3 must translate against `6292 / 3190 / 617 / 730`.
