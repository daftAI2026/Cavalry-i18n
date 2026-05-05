<!--
[INPUT]: 依赖当前 HEAD、quarantine/cavalry-full-ui-100-fabrication-20260501、§P5 detector、package full-ui scripts 与 test:desktop 输出
[OUTPUT]: 对外提供 G-P / §P5 reverify 证据、代码修复记录与剩余失败 gate
[POS]: runs 的 G-P / §P5 复核记录，证明本轮只修第一失败 gate 内的输入与 detector 断裂
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-05-05 G-P / §P5 reverify

## Status

PASS

## Changes

- `package.json` 的 runtime/full-ui scripts 不再读取 root-cache runtime inventory，统一绑定 `SESSION_DIR/runtime/*-merged-inventory.json`。
- `check:full-ui` 默认 preflight 已显式传入 `--cache-root "$HOME/Library/Caches/Cavalry-i18n"`，root-cache 污染拒绝不再是可选路径。
- `tools/check_electron_patcher_ui.js` 新增 executable contract，拒绝 package scripts 回退到 root-cache runtime inventory，并验证 validator 不丢 TS/generated context。
- `tools/validate_translations.py` 保留 `.ts` context 与 `generated_translations.inc` context，传入 shared detector 后能命中 FP-8 fake Qt context。
- `tools/CLAUDE.md` 与根 `CLAUDE.md` 已同步 validator / script contract 变化。

## Verification

```text
npm run test:desktop
PASS: 85/85 after G-CAPTURE/G-X contract hardening

node --test doc/workflows/cavalry-full-ui-100/tests/extraction-inventory-contract.test.js doc/workflows/cavalry-full-ui-100/tests/capture-accessibility-contract.test.js
PASS: 4/4

npm run extract:compiled-ui
PASS: generated ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json
compiled source-map entries: 5195
compiled targets include libExtensionLayer.dylib

node tools/verify_gate_inputs.js --repo-root . --cache-root "$HOME/Library/Caches/Cavalry-i18n" --compiled-source-map "$HOME/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json" --section P5
PASS: no static G-P violations
```

## §P5 Results

Before cleanup, Current HEAD:

```text
tools/*.ts only:
  FP-7 = 0
  FP-8 = 0
  FP-9 = 379

full JSON/TS/generated validator:
  FP-7 = 0
  FP-8 = 0
  FP-9 = 933
  B13 = FAIL
```

After cleanup, Current HEAD:

```text
full JSON/TS/generated validator:
  FP-7 = 0
  FP-8 = 0
  FP-9 = 0
  B13 = PASS
```

Quarantine branch:

```text
quarantine/cavalry-full-ui-100-fabrication-20260501:
  FP-7 = 30270
  FP-8 = 2978
  FP-9 = 5833
  validator_status = 1
```

## Remaining Blocker

§P5 is no longer the first failing gate. The remaining blockers are real G2 compiled UI and G3 runtime UI translation gaps; G4 remains FAIL until the same three-language matrix passes at 100%.
