# Run Log — T3 Compile QM

- **Date**: 2026-04-20
- **Prompt**: 05-compile-qm.md
- **Status**: ~~PASS~~ → ~~INVALIDATED~~ → ~~PASS~~ → ~~INVALIDATED~~ → **PASS** (recompiled after T2 PASS)

## Re-run (current)

### Gate Check at Compile Time

- T2 Translate All Languages: PASS ✓ (validator exit 0, all B2-B12+TS gates pass)

### What Was Done

1. Compiled cavalry .qm files using `lrelease` (Qt 6.11.0):
   - `cavalry_zh-Hans.qm`: 62 translations (62 finished, 0 unfinished)
   - `cavalry_zh-Hant.qm`: 62 translations (62 finished, 0 unfinished)
   - `cavalry_ja_JP.qm`: 62 translations (62 finished, 0 unfinished)
2. qtbase .qm files already present from previous run (verified non-empty):
   - `qtbase_zh-Hans.qm`: 147222 bytes
   - `qtbase_zh-Hant.qm`: 126185 bytes
   - `qtbase_ja_JP.qm`: 129913 bytes

### Contract Verification (qm-contract.md)

| Test | Description | Result |
|------|------------|--------|
| B1 | cavalry .qm files exist and non-empty | PASS |
| B2 | qtbase .qm files exist and non-empty | PASS |
| B3 | file command recognizes as Qt Translation file | PASS (informational) |

## Artifacts

- `languages/zh-Hans/cavalry_zh-Hans.qm`
- `languages/zh-Hans/qtbase_zh-Hans.qm`
- `languages/zh-Hant/cavalry_zh-Hant.qm`
- `languages/zh-Hant/qtbase_zh-Hant.qm`
- `languages/ja_JP/cavalry_ja_JP.qm`
- `languages/ja_JP/qtbase_ja_JP.qm`

## Status

PASS
