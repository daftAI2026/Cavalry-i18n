<!--
[INPUT]: 依赖 2026-05-07 INVALIDATED run note、Anti-Patterns.md §F、quarantine transliteration/fabrication 反向样本与当前 wip HEAD
[OUTPUT]: 对外提供 Step 1 §P5 FP-10/11/12 detector 升级 PASS 记录与三向验收数字
[POS]: runs 的 G-P detector uplift 记录，证明重译前 forbidden-pattern gate 已先补盲区
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-05-07 G-P — FP-10/11/12 detector uplift

## Status

PASS

## Scope

- `tools/forbidden_translation_patterns.py` / `.js` 新增 FP-10 transliteration 与 FP-11 pangram noise 单条检测。
- `tools/validate_translations.py` 新增 FP-12 translation-reuse cap 聚合检测，并把 B13 detail 扩展为 FP-1..12。
- `tools/translation-whitelist.json` 注册 transliteration ban / pangram skip / translation-reuse cap 三条契约。
- `doc/workflows/cavalry-full-ui-100/tests/forbidden-translation-contract.md` 与 `tools/CLAUDE.md` 同步 detector 语义。

## Verification

```text
node --test tools/check_electron_patcher_ui.js --test-name-pattern 'transliteration and pangram|translation whitelist registers|generic translation reuse'
PASS: 73/73
```

```text
python3 tools/validate_translations.py --root . --json-report /tmp/head-p5.json --markdown-summary /tmp/head-p5.md
overall_status = PASS
FP counts      = {}
```

```text
git switch quarantine/cavalry-full-ui-100-transliteration-20260507
python3 tools/validate_translations.py --root . --json-report /tmp/q.json --markdown-summary /tmp/q.md
overall_status = FAIL
FP-10          = 56
FP-11          = 398
FP-12          = 10
```

```text
quarantine/cavalry-full-ui-100-fabrication-20260501 checked through a temporary read-only worktree with the upgraded validator
overall_status = FAIL
FP-7           = 30270
FP-8           = 2978
FP-9           = 5833
```

## Decision

Step 1 is complete. The 2026-05-07 ALL GATES PASS invalidation is now executable: the detector hits the transliteration quarantine, stays silent on current HEAD, and preserves the older fabrication regression floor.

Next step remains fixed-order G-X denominator recleaning and refreeze; old `6415 / 5195 / 626 / 734` values are historical only.
