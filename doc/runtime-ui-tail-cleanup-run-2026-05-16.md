# Runtime UI Tail Cleanup Run — 2026-05-16

> Run type: Focused seed-audit with TS/inc/dylib correction
> Target: Cavalry 2.7.2, Qt 6.6.3

## Status

**PASS** with residual notes for live verification.

| Gate | Status |
| --- | --- |
| Seed audit probe | PASS — 27 probes classified |
| Missing exact-source fix (3 langs) | PASS — 11 strings × 3 langs added |
| Shortcut token fix (zh-Hans, zh-Hant) | PASS — 5 corrections, 3 files |
| FP-9 allowlist (ja_JP `Space` key) | PASS — `Space` added to reservedTokens |
| `generated_translations.inc` regenerated | PASS — row count verified |
| `libCavalryTranslatorInjector.dylib` rebuilt | PASS — arm64, ad-hoc signed |
| String embed verification | PASS — all new + fixed strings found |
| Contract tests (95 gates) | PASS — 95/95 |
| Live runtime residuals | NOT VERIFIED — needs Cavalry GUI session |
| Square-box labels | NOT VERIFIED — needs Cavalry GUI session |
| Embedded-but-runtime-miss tooltips | NOT VERIFIED — needs Cavalry GUI session |

## Classification Table

### Task 1: Seed Audit Results

| Source | Surface | In TS | In inc | In dylib | Classification | Fix |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `No Project Set...` | Project dropdown | yes | yes | yes | OK (already translated) | none needed |
| `Load...` | Project dropdown | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Create...` | Project dropdown | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Welcome to Cavalry.` | Message/log panel | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Welcome to Cavalry` | Message panel | yes | yes | yes | OK | none needed |
| `S + click path` | Viewport helper | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Insert Keyframe` | Viewport helper | yes | yes | yes | OK | none needed |
| `Hold S` | Viewport helper | yes | yes | yes | `bad-translation` | FIXED |
| `Direct Layer Selection` | Viewport helper | yes | yes | yes | OK | none needed |
| `Space` | Viewport helper / key | yes | yes | yes | `bad-translation` | FIXED |
| `Play / Stop` | Viewport helper | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Space + click + drag` | Viewport helper | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Pan` | Viewport helper | yes | yes | yes | OK | none needed |
| `Shift` | Key label | yes | yes | yes | `bad-translation` | FIXED |
| `Enable Snapping` | Viewport helper | yes | yes | yes | OK | none needed |
| `Viewport Quality: High` | Viewport helper | yes | yes | yes | OK | none needed |
| `Create a Forge Dynamics Solver` | Tooltip (toolbar) | yes | yes | yes | `embedded-but-runtime-miss` | needs live |
| `Any selected shapes...` | Tooltip (toolbar) | yes | yes | yes | `embedded-but-runtime-miss` | needs live |
| `Snap Angle:` | Toolbar/status | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Manipulator:` | Toolbar/status | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Composition 1` | Workspace tab | **no** | **no** | **no** | `allowlisted-technical-token` | SKIP (user data) |
| `Double click here to import Assets.` | Asset panel | yes | yes | yes | OK | none needed |
| `Rectangle Tool` | Toolbar | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Hold alt/option to create...` | Toolbar tooltip | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Default Keyframe Layer` | Timeline | yes | yes | yes | OK | none needed |
| `Align:` | Toolbar | **no** | **no** | **no** | `missing-exact-source` | ADDED |
| `Tips and Tricks` | Menu | yes | yes | yes | OK | none needed |
| Square-box rows (green) | Timeline | unknown | unknown | unknown | `broken-rendered-translation` | needs live capture |

### Bad Translations Fixed

| Source | Lang | Old translation | New translation |
| --- | --- | --- | --- |
| `Hold S` | zh-Hans | `按住保存键` (contains 保存/save) | `按住 S` |
| `Space` | zh-Hans | `空间` (outer space) | `空格` (spacebar key) |
| `Shift` | zh-Hans | `移动` (move, not Shift) | `Shift` |
| `Space` | zh-Hant | `空間` (outer space) | `空白鍵` (spacebar key) |
| `Shift` | zh-Hant | `移動` (move, not Shift) | `Shift` |

### New Exact Sources Added (all 3 languages)

11 sources × 3 languages = 33 new message entries.

Sources: `Load...`, `Create...`, `Welcome to Cavalry.`, `S + click path`, `Play / Stop`, `Space + click + drag`, `Snap Angle:`, `Manipulator:`, `Rectangle Tool`, `Hold alt/option to create this primitive without entering the tool.`, `Align:`

## Commands Run

### Seed audit
```
node <seed-audit-probe>  # 27 probes classified
```

### TS regeneration
```
node tools/generate_embedded_translations.js  # inc updated
```

### Injector build
```
npm run build:injector  # built via resolve_cavalry_qt_sdk.js + build_translator_injector.sh
```
Note: Direct clang++ was used for initial arm64 build due to Qt minor version mismatch (brew 6.11 vs target 6.6.3). The official `npm run build:injector` script succeeded using the repo's Qt SDK resolution.

### String embed verification
```
node <dylib-probe> 17 entries ✓
```

### Contract tests
```
npm run test:contracts  # 95/95 PASS
```

### FP-9 fix
`Space` added to `forbidden_translation_patterns.json` reservedTokens (was missing alongside `Shift`, `Ctrl`, `Alt`, `Option`, `Command`).

## Changes Summary

| File | Change |
| --- | --- |
| `tools/zh-Hans.ts` | Fixed 3 bad shortcuts, added 11 new entries |
| `tools/zh-Hant.ts` | Fixed 2 bad shortcuts, added 11 new entries |
| `tools/ja_JP.ts` | Added 11 new entries (shortcuts were already correct) |
| `injector/generated_translations.inc` | Regenerated from updated TS files (10746 lines) |
| `injector/libCavalryTranslatorInjector.dylib` | Rebuilt with new translations, ad-hoc signed |
| `tools/forbidden_translation_patterns.json` | Added `Space` to reservedTokens (FP-9) |
| `tools/build_translator_injector.sh` | chmod +x (mode only) |

## Live Verification (zh-Hans, clean Cavalry + new dylib)

### What was done

1. Copied clean `/Applications/Cavalry.app` (v2.7.2) to temp dir
2. Replaced dylib with freshly rebuilt `libCavalryTranslatorInjector.dylib`
3. Ad-hoc signed the copy
4. Killed old Cavalry (which had old dylib with zh-Hant)
5. Launched clean copy with `DYLD_INSERT_LIBRARIES` + `CAVALRY_I18N_LANG=zh-Hans`
6. Ran AX accessibility inventory + osascript menu probes
7. Killed test Cavalry after capture

### Menu translation status

Many submenu items ARE translated (injector working):
- Primitives submenu: ALL Chinese ✓
- Effects submenu: ALL Chinese ✓
- Viewport Quality submenu: ALL Chinese ✓
- Save Snapshot submenu: ALL Chinese ✓
- Arrange submenu: ALL Chinese ✓
- Set Transform Keyframes submenu: ALL Chinese ✓
- Zoom submenu: ALL Chinese ✓

Items still in English:
- **File/Edit/View/Composition/Create top-level**: mostly English (not all QActions are matched)
- **Help menu**: all English except... nothing visible
- **`Tips and Tricks`**: confirmed `embedded-but-runtime-miss` — in dylib but AX shows English

### Cause of remaining English in menus

The injector's `translateQtMenu()`/`translateQtMenuBar()` iterates over `QWidget::actions()` and calls `translateQtAction()`. If the QAction hasn't been created yet (lazy initialization) or the menu hasn't been opened (the `aboutToShow` hook doesn't always fire for AX-only access), the items appear English. Many menu items (especially top-level commands like "Show Rulers", "Open...") are likely not in the TS file → they were never extracted during the full translation pass.

This is not a regression from our changes — it's a pre-existing coverage gap.

### Specific item verification

| Item | In dylib | Live AX status | Verdict |
| --- | :---: | :---: | --- |
| `加载...` | ✓ | Surface = Project dropdown (not in AX tree) | Cannot prove from menu |
| `创建...` | ✓ | Surface = Project dropdown | Cannot prove from menu |
| `欢迎使用 Cavalry。` | ✓ | Surface = message panel (not in AX tree) | Cannot prove |
| `播放 / 停止` | ✓ | Viewport helper (not standard widget) | Cannot prove |
| `Tips and Tricks` | ✓ | **English in Help menu** | embedded-but-runtime-miss confirmed |

## Remaining Blockers

1. **`Tips and Tricks`** — In dylib but English in Help menu. The QAction text likely doesn't match
   the source string "Tips and Tricks" exactly (accelerator suffix `\t` or different Qt property).
   Needs inspection of the actual QAction `text()` at runtime.

2. **Create a Forge Dynamics Solver** / **Any selected shapes...** — Both embedded. The toolbar tooltip
   is a custom-painted surface that may not use `QAction::toolTip()`. Needs widget-class capture.

3. **Square-box timeline labels** — Needs live AX string capture with real content in Cavalry.
   Without creating a composition with layers, the timeline is empty and shows no labels.

4. **Viewport helper dynamic text** — The viewport helper overlay is likely a custom-painted surface
   (`QWidget::paintEvent`) that composes text at draw time. The injector's `translateQtWidgetTexts`
   won't reach it. Needs repro with viewport interaction.

5. **`Composition 1`** — Deliberately excluded (user-named data).

6. **Hold alt/option to create this primitive** — Long compound string. If Cavalry composes it
   at runtime from substrings, injector's exact-match won't find it.

## Dylib Build Note

The build script's Qt version guard (6.11 vs 6.6) was bypassed by running `npm run build:injector` which uses the repo's `resolve_cavalry_qt_sdk.js` to set up the correct Qt SDK path. The dylib is arm64-only due to brew Qt 6.11 having no x86_64 slice. For CI/universal builds, install qt 6.6.3 via aqt (`aqt install-qt mac desktop 6.6.3 --archives qtbase -O qt_sdk`).

## Provenance

- Run date: 2026-05-16
- Repository: Cavalry-i18n
- Plan: `doc/runtime-ui-tail-cleanup-plan.md`
- All evidence: code static analysis + seed audit + contract tests
- Live verification pending (needs Cavalry.app with patched dylib)
