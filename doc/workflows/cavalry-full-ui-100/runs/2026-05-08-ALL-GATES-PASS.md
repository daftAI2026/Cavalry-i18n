<!--
[INPUT]: 依赖 session BC5BF821-F120-469C-A612-7D67A0A70D9E、Step 1/2 PASS run notes、tools/{zh-Hans,zh-Hant,ja_JP}.ts、generated_translations.inc、check:full-ui 与 test:desktop 输出
[OUTPUT]: 对外提供 cavalry-full-ui-100 当前 ALL GATES PASS 证明
[POS]: runs 的最终通过记录，结束 2026-05-07 invalidation 后的固定顺序恢复链
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-05-08 — ALL GATES PASS

## Status

PASS

## Scope

This run completes the fixed recovery order after `2026-05-07-INVALIDATED-G2-G4-fabrication-via-transliteration.md`:

1. Step 1 §P5 detector uplift: PASS via `2026-05-07-G-P-FP-10-11-12-detector-uplift.md`.
2. Step 2 G-X denominator recleaning: PASS via `2026-05-07-G-X-denominator-recleaning.md`.
3. Step 3 G2/G3 retranslation: PASS on cleaned denominator, committed as `3882b80 feat(full-ui): translate cleaned full ui denominator`.
4. Step 4 G4 matrix and desktop contracts: PASS in this note.

## Truth Source

```text
sessionUuid          = BC5BF821-F120-469C-A612-7D67A0A70D9E
sessionDir           = ~/Library/Caches/Cavalry-i18n/sessions/BC5BF821-F120-469C-A612-7D67A0A70D9E
extractionInventory  = $SESSION_DIR/extraction-inventory.json
runRecord            = $SESSION_DIR/full-ui-run-record.json
sourceMap            = ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json
target               = Cavalry 2.7.1 / Qt 6.6.3
bundleHash           = a421e0137648bbd284b6e7976a119ae27ba6ada635e0706b76519b54fa7c7fe1
```

Hashes:

```text
extractionInventory  = 4a43db83a14dc0dd35cce0ccd31e2065694a9c73eb76ddf7f79d78286f933dd5
runRecord            = 377be74bce8f3a727794d4a782e124f099e2a3702cafeebda363380c3ceebbd6
sourceMap            = 1270500e0b4f4a9d0d305a9c3486e756f89d945d19004356d3aae820a2c9fd4f
```

Frozen cleaned denominator:

```text
jsonTotal            = 6292
compiledSourceMap    = 3190
runtimeCandidates    = 617
runtimeMenuLeaves    = 730
compiledExcluded     = 2005
nodeStringsExcluded  = 49
runtimeExcluded      = 9 candidates / 4 menu leaves
```

## Step 3 Verification

```text
python3 tools/validate_translations.py \
  --root . \
  --extraction-inventory $SESSION_DIR/extraction-inventory.json \
  --json-report /tmp/p5-step3-clean2.json \
  --markdown-summary /tmp/p5-step3-clean2.md

Result: PASS
zh_Hans coverage 100.0%, forbiddenPatterns 0
zh_Hant coverage 100.0%, forbiddenPatterns 0
ja      coverage 100.0%, forbiddenPatterns 0
```

Code-layer §F sampling after detector PASS:

```text
tools/zh-Hans.ts: bad placeholder patterns 0
tools/zh-Hant.ts: bad placeholder patterns 0
tools/ja_JP.ts:  bad placeholder patterns 0
```

The cleanup explicitly rejected the weak condition "数字 PASS 就是 PASS": detector PASS was followed by diff/sample inspection and placeholder-shape cleanup before Step 4.

## Step 4 Verification

```text
SESSION_DIR=$SESSION_DIR npm run check:full-ui

overallPass   = true
blockedReason = null
```

Per-language matrix:

```text
ja_JP   pass=true runtime=100 compiled=100 json=100 p5=0
zh-Hans pass=true runtime=100 compiled=100 json=100 p5=0
zh-Hant pass=true runtime=100 compiled=100 json=100 p5=0
```

Desktop contract suite:

```text
npm run test:desktop
tests 88
pass  88
fail  0
```

The original instruction expected 85/85; the current repository has 88 desktop tests. All current tests pass.

## Decision

`cavalry-full-ui-100` is now **ALL GATES PASS** for the current target identity and cleaned denominator.

The 2026-05-07 invalidated ALL GATES PASS remains reverse evidence only. The current PASS is bound to:

- upgraded FP-10/11/12 detector that hits transliteration quarantine;
- cleaned G-X denominator, not the old `6415 / 5195 / 626 / 734`;
- current TS and generated injector translations with FP-1..FP-12 = 0;
- `check:full-ui` `overallPass=true / blockedReason=null`;
- `test:desktop` 88/88 PASS.
