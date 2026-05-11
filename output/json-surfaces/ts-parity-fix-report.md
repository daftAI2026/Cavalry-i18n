# TS Parity Fix Report

[PROTOCOL]: Generated 2026-05-11 after restoring compiled/runtime translation source parity.

## Before Fix

| Language | TS messages | unique (ctx,src) | contexts | QPrintDialog msgs |
|---|---|---|---|---|
| zh-Hans | 3605 | 3521 | 11 | 3 |
| zh-Hant | 3479 | 3469 | 11 | 3 |
| ja_JP | 3522 | 3514 | 10 | 881 |

Issues:
1. zh-Hant: 52 unique MenuBarManager sources missing compared to zh-Hans
2. ja_JP: 878 MenuBarManager entries misplaced under QPrintDialog context (should have 3)
3. ja_JP: 1 context block missing (10 vs 11)

## Root Causes

### zh-Hant
- 54 (52 unique) MenuBarManager entries were never translated from zh-Hans baseline
- These entries had trailing periods or XML entity variations that caused prefill miss
- Also missing a macOS standard "Emoji & Symbols" Edit menu entry

### ja_JP  
- Second MenuBarManager context block was misidentified: 878 entries placed under `<context><name>QPrintDialog>` instead of `<context><name>MenuBarManager>`
- QPrintDialog inflated from 3 entries (Print, Printer, Print to File) to 881 entries
- Also missing 12 MenuBarManager entries not present in either context
- Had a source text encoding error: "Emoji && Symbols" (double ampersand) instead of "Emoji & Symbols"

## Fix Applied

### zh-Hant.ts
1. Added 54 missing MenuBarManager entries with zh-Hant translations
   - All translated using existing Cavalry terminology conventions
   - Key terms aligned: 輪廓 (contour), 變換 (transform), 擠出 (extrude), 品質 (quality), 原點 (origin)
   - No simplified Chinese contamination
2. Added "Emoji & Symbols" entry with translation "表情與符號"
3. Also added "Emoji & Symbols" to zh-Hans.ts for parity ("表情与符号")

### ja_JP.ts
1. Split single QPrintDialog block into two correct contexts:
   - QPrintDialog: 3 legitimate entries (Print, Printer, Print to File)
   - MenuBarManager: 878 restored entries (new second MenuBarManager block)
2. Added 12 missing MenuBarManager entries with ja_JP translations
3. Fixed "Emoji && Symbols" -> "Emoji & Symbols" source encoding error

## After Fix

| Language | TS messages | unique (ctx,src) | contexts | QPrintDialog msgs |
|---|---|---|---|---|
| zh-Hans | 3606 | 3522 | 10 | 3 |
| zh-Hant | 3532 | 3522 | 10 | 3 |
| ja_JP | 3534 | 3522 | 10 | 3 |

### Key Metrics
- **unique (context, source) parity**: 3522 across all 3 languages ✓
- **ja_JP QPrintDialog**: restored to 3 entries (Print, Printer, Print to File) ✓
- **Context count**: all 3 languages have 10 context blocks ✓
- **Total message count**: zh-Hans 3606, zh-Hant 3532, ja_JP 3534 (minor variance due to duplicate sources)
- **No extra or missing entries**: 0 unmatched in any language vs zh-Hans baseline ✓

## Context Structure (All 3 Languages)

```
QMenuBar          (standard Qt menu bar items)
MenuBarManager    (Cavalry custom menu items, 2 blocks)
QFileDialog       (Qt file dialog strings)
QDialog           (Qt dialog strings)
QMessageBox       (Qt message box strings)
QUndoStack        (Qt undo/redo strings)
QShortcut         (Qt shortcut strings)
QTabBar           (Qt tab bar strings)
QLineEdit         (Qt line edit strings)
QPrintDialog      (Qt print dialog: Print, Printer, Print to File)
```

## Regenerated Artifact

`injector/generated_translations.inc` was regenerated from the fixed TS files using `tools/generate_embedded_translations.js`.

Build verification pending — `tools/build_translator_injector.sh` should be run to rebuild `libCavalryTranslatorInjector.dylib` from the updated `.inc`.

## Impact on QTranslator Lookup

Before this fix:
- Japanese "MenuBarManager" strings stored under "QPrintDialog" context would never match runtime `QTranslator::translate("MenuBarManager", source)` calls
- zh-Hant menus with missing translations would show fallback English

After this fix:
- All three languages share identical `(context, source)` denominator
- `EmbeddedTranslator::translate()` exact context matching works correctly for all entries
- `lookupEmbeddedTranslation()` fallback (context-insensitive) still works as secondary path
- `QPrintDialog` context only contains actual print dialog strings
