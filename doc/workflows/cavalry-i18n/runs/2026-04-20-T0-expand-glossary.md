# Run Log: T0 — Expand Glossary

**Date**: 2026-04-20
**Prompt**: 01-expand-glossary
**Task ID**: T0

## Task

Expand glossary from en→zh-Hans (78 terms) to four-language (en / zh-Hans / zh-Hant / ja_JP).

## TDD Cycles

| # | Behavior | RED | GREEN |
|---|----------|-----|-------|
| B1 | File exists with 4-column header | FAIL: file not found | Created doc/cavalry-glossary.md |
| B2 | >= 78 data rows | (tested together) | 94 data rows |
| B3 | No empty cells | (tested together) | All cells filled |
| B4 | zh-Hant difference pairs | (tested together) | 儲存/檔案/預設/影片/程式/資訊 all present |
| B5 | No-translate items stay English | (tested together) | Cavalry/RGB/JSON/FPS/GPU etc. in all 4 cols |

## Verification Output

```
PASS: B1
PASS: B2 (94 rows)
PASS: B3
PASS: B4
PASS: B5
```

## Artifacts

- `doc/cavalry-glossary.md` — 94-row four-language glossary

## Status

PASS
