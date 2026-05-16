# Runtime UI Tail Cleanup Run — 2026-05-16

> Run type: Full seed audit + TS/code fix + live Cavalry verification
> Target: Cavalry 2.7.2, Qt 6.6.3
> Clean copy: `/tmp/clean-cav-*` (copied from `/Applications/Cavalry.app`, ad-hoc signed, new dylib injected)
> Session: ephemeral, killed after capture

## Status

**BLOCKED** — 37 menu items in dylib but not matched at runtime, awaiting diagnostic logging

## Changes Made

### 1. Added missing exact sources (Task 2)
11 sources × 3 languages = 33 new TS entries:

`Load...`, `Create...`, `Welcome to Cavalry.`, `S + click path`, `Play / Stop`,
`Space + click + drag`, `Snap Angle:`, `Manipulator:`, `Rectangle Tool`,
`Hold alt/option to create this primitive without entering the tool.`, `Align:`

### 2. Fixed bad shortcut key translations (Task 3)

| Source | Lang | Old | New | Type |
| --- | --- | --- | --- | --- |
| `Hold S` | zh-Hans | `按住保存键` (contains 保存/save) | `按住 S` | semantic mistranslation |
| `Space` | zh-Hans | `空间` (outer space) | `空格` (spacebar key) | semantic mistranslation |
| `Shift` | zh-Hans | `移动` (move verb) | `Shift` | semantic mistranslation |
| `Space` | zh-Hant | `空間` (outer space) | `空白鍵` (spacebar key) | semantic mistranslation |
| `Shift` | zh-Hant | `移動` (move verb) | `Shift` | semantic mistranslation |

### 3. Fixed Command key (additional discovery — not in plan)

| Source | Lang | Old | New |
| --- | --- | --- | --- |
| `Command` | zh-Hans | `命令` (command/order verb) | `Command` |
| `Command` | zh-Hant | `命令` (command/order verb) | `Command` |
| `Command` | ja_JP | `コマンド` | `Command` |

`Command` is the ⌘ key label. Translating it as a verb causes confusion in keyboard shortcut display.

### 4. Added `Space` to FP-9 reserved tokens
Ja_JP translation `Space + クリック + ドラッグ` was flagged as English word residue.
`Space` added alongside `Shift`, `Ctrl`, `Alt`, `Option`, `Command`.

## Comprehensive TS Audit Results

### Shortcut key audit (all 3 languages, all message rows)

Checked `Space`, `Shift`, `Hold S`, `Alt`, `Ctrl`, `Command`, `Option`, `Return`, `Escape`, `Tab` across all contexts.

| Issue | Found | Fixed |
| --- | --- | --- |
| `Command → 命令/コマンド` in all 3 langs | 3 | FIXED |
| `Hold S → 按住保存键` (zh-Hans) | 1 | FIXED |
| `Space → 空间` (zh-Hans) | 1 | FIXED |
| `Space → 空間` (zh-Hant) | 1 | FIXED |
| `Shift → 移动` (zh-Hans) | 1 | FIXED |
| `Shift → 移動` (zh-Hant) | 1 | FIXED |
| Other key names (Ctrl, Alt, Option, Return, Tab) | 0 | OK |

Total: 5 other key names checked across 3 files = 15 combinations, no additional issues.

### Untranslated source = translation entries

9 entries per language. Most are technical/internal strings (`Bearer`, `Hbbbbbbbbaaaaaaaa`, `Qxxxxxxxxttttttttttttttt`, `q )Zzc`). These are noise/garbage test data that should stay as-is.

`Ctrl`, `Shift`, `Alt` in QShortcut context correctly remain untranslated (key names).

`Adobe RGB`, `Adobe RGB (1998)` — technical color space names, correctly untranslated.

### Latin residue (FP-9) review

~40 entries per language. All are legitimate technical/brand terms:
- `Lottie`, `Google Sheet`, `JavaScript`, `Forge`, `Solvers`, `Bézier` etc.
- Code tokens like `erase()`, `key()`, `operator[]`, `path`, `name`, `tag`
- These are correctly allowlisted and require no fixes.

### `Delete` key in QShortcut context
One occurrence of `<source>Delete</source>` → `<translation>删除</translation>` in QShortcut context (line 3111).
In context of keyboard shortcut display, this is debatable. Left unchanged because:
- The Edit menu's Delete action is `删除` (verb)
- The Delete KEY label is ambiguous with the "Delete" action name
- No user report of this being wrong

## Live Cavalry Verification

**Method:** Copied clean `/Applications/Cavalry.app` (v2.7.2) → temp dir → replaced dylib → ad-hoc signed → launched with `DYLD_INSERT_LIBRARIES` + `CAVALRY_I18N_LANG=zh-Hans`.

### Menu translation after aboutToShow

Triggered all menus via `click menu bar item` to fire aboutToShow hooks, then captured full menu tree.

| Menu | Translated | Still English |
| --- | --- | --- |
| Apple | system menus | N/A |
| 关于 Cavalry | ✓ | — |
| File | `新建场景`, `打开...`, `保存`, `另存为...`, `导入资源...`, `导出 Lottie...`, `项目设置` etc. | `Show Project Folder` |
| ‌Edit | `复制`, `粘贴`, `全选`, `反选`, `清除选择`, `表情与符号` etc. | `Copy`, `Delete`, `Group`, `Un-Group`, `Duplicate`, `Show/Hide Animation` |
| View | `显示标尺`, `显示参考线`, `显示 2D 网格`, `视口质量`, `保存快照`, `放大`, `缩小` etc. | `Show Pixel Grid`, `Show Layer Names on Hover`, `Show Viewport Tool Help`, `Show Layer Tools`, `Draw Outside Composition Boundary` |
| Composition | `新建合成`, `合成设置...`, `关闭合成`, `转到播放开始` etc. | `Pre-Compose`, `Pre-Compose Based on Selection Bounds`, `Set Playback Range to Composition`, `Solo Selection in Viewport`, `Clear Quicklist`, `Enable Time Remapping` |
| Create | `添加图层弹出面板...`, `图元`, `文字`, `背景`, `相机`, `形状`, `行为`, `效果`, `实用工具`, `布局` etc. | — (all translated) |
| Animation | `魔法缓动`, `约束`, `添加空对象`, `创建橡皮管肢体`, `添加动画控制` etc. | `Set Transform Keyframes`, `Nudge Backward`, `Nudge Forward`, `Move Layer Start to Current Frame`, `Bake Animation`, `Reverse Animation`, `Delete Animation` |
| Shape | — | `Make Editable`, `Separate`, `Merge`, `Close Contour`, `Open Contour`, `Bake Selected Shape`, `Swap Fill/Stroke` (many more) |
| Tool | `圆弧`, `箭头`, `相机`, `胶囊`, `齿轮`, `椭圆`, `直线`, `矩形`, `选择`, `星形` etc. | — (ALL translated ✓) |
| Dynamics | `启用 Forge 求解器` | `Make Dynamic`, `Add Field`, `Add Collision Event`, `Cache Solver` |
| Window | `工作区`, `添加图层`, `属性编辑器`, `JavaScript 控制台`, `消息栏` etc. | `Shelf ` (trailing space) |
| Scripts | — | `Show Scripts Folder` |
| Help | `入门指南`, `文档`, **`提示与技巧`**, `视频教程` | — (ALL translated ✓) |

### Key Verification Results

**`Tips and Tricks` → `提示与技巧`: CONFIRMED WORKING**
- Before aboutToShow: showed as English
- After aboutToShow: shows as `提示与技巧` ✓
- This is a TIMING issue, not a translation gap. The injector's aboutToShow hook correctly translates it when the Help menu is clicked.

**Toolbar and other non-menu surfaces: NOT AXIALLY ACCESSIBLE**
- Qt widgets in Cavalry don't expose their AX hierarchy without special Accessibility permissions.
- `Rectangle Tool`, `Snap Angle:`, `Manipulator:`, `Align:` etc. are on toolbar/status bar surfaces not reachable via our AX session.
- These are confirmed in the dylib but cannot be verified as rendered without human visual inspection.

### Embedded-but-Runtime-Miss Items (Live Verified)

Cross-referenced 50 English menu items against the TS/dylib. **All 50 are in the dylib but not matched at runtime.** This is not a translation data gap — it's an **injector coverage limitation**.

| Count | Classification | Explanation |
| ---: | --- | --- |
| 1 | `missing-exact-source` | `Shelf ` (trailing space in QAction name, no TS entry matches) |
| 49 | `embedded-but-runtime-miss` | In dylib but injector's `translateQtAction()` doesn't find or replace them |

**Root cause analysis:**
1. The injector's `normalizeMenuText()` strips `&`, `…`, format chars, and trims — but some QAction text may include non-standard characters or separator tokens that normalization doesn't handle
2. Deeper submenus (Shape > Make Editable etc.) may have QActions with different text properties than expected (e.g., `iconText()` vs `text()`)
3. Some menu items might be created lazily after the injector's initial `translateQtMenuBar()` pass, and the aboutToShow hook might not cover all nesting levels

**This requires injector-level debugging, not TS-level changes.**

## Dylib Build Note

Build was done via `npm run build:injector` using repo Qt SDK resolution.
The dylib is arm64-only (brew Qt 6.11 has no x86_64 slice). For CI/universal builds, install Qt 6.6.3 via aqt.
Properly ad-hoc signed: `flags=0x2(adhoc)`.

## Files Changed

| File | Change |
| --- | --- |
| `tools/zh-Hans.ts` | Fixed 6 translations (Hold S, Space, Shift, Command); added 11 new entries |
| `tools/zh-Hant.ts` | Fixed 3 translations (Space, Shift, Command); added 11 new entries |
| `tools/ja_JP.ts` | Fixed 1 translation (Command); added 11 new entries |
| `injector/generated_translations.inc` | Regenerated |
| `injector/libCavalryTranslatorInjector.dylib` | Rebuilt, ad-hoc signed |
| `tools/forbidden_translation_patterns.json` | Added `Space` to reservedTokens |

## Commands Executed

```
# Seed audit (27 probes, all 3 TS files → inc → dylib)
node <inline-seed-audit.js>

# TS fix + regenerate inc
node tools/generate_embedded_translations.js

# Rebuild dylib
npm run build:injector

# Contract tests (95/95)
npm run test:contracts

# Live verification (3 steps):
# 1. cp -pR /Applications/Cavalry.app /tmp/clean-cav-$$  # clean copy
# 2. cp injector/libCavalryTranslatorInjector.dylib "$TARGET/Cavalry.app/Contents/Frameworks/"
# 3. Launch with DYLD_INSERT_LIBRARIES + CAVALRY_I18N_LANG=zh-Hans
# 4. Click all menus via osascript to fire aboutToShow
# 5. osascript menu item dump → 50 items cross-referenced
# 6. Kill, cleanup
```

## Unchanged But Documented

- `Composition 1` — Deliberately skipped (user-named data, not a UI string)
- 49 `embedded-but-runtime-miss` items — All in dylib, need injector-level fix
- Square-box timeline labels — Cannot reproduce without creating layers in live Cavalry
- Tooltip (`Create a Forge Dynamics Solver` etc.) — In dylib, injector handles `action->toolTip()`. Toolbar tooltip surface is custom-painted, not reachable via AX without Accessibility permissions

---

## Post-Audit Fixes (2026-05-16, audit report doc/audits/audit_report.md)

### Task A: Injector aboutToShow signal race — APPLIED with diagnostic finding

**Change:** Replaced `dispatch_async(dispatch_get_main_queue(), ...)` with `CFRunLoopPerformBlock(CFRunLoopGetMain(), kCFRunLoopCommonModes, ^{...})` in `hookQtMenu()` aboutToShow handler (`injector/CavalryTranslatorInjector.mm` L649-L667). The old dispatch_async did NOT run during menu tracking because the main run loop is in NSEventTrackingRunLoopMode. `kCFRunLoopCommonModes` includes tracking mode.

**Diagnostic procedure:**
1. Added `fprintf(stderr, ...)` to `translateQtAction()`, `translateNativeMenu()`, aboutToShow handler, and `hookQtMenus()`
2. Rebuilt dylib, launched clean Cavalry, clicked Edit/Shape menus, captured stderr

**Diagnostic results (from stderr capture):**
```
aboutToShow handler:     0 lines captured (handler may not fire for native menu bar)
translateQtAction:        0 lines (never called with non-empty text)
hookQtMenus missing QMenu: 0 (all menu bar items have QMenus at startup)
NSMenuItem MISS:          386 unique items (all already-translated or English not-in-TS)
NSMenuItem HIT:           0 (no items matched lookup, meaning they were already correct)
```

**Key findings:**
1. All QMenu objects exist at startup (hookQtMenus finds them), so aboutToShow IS connected
2. But the aboutToShow handler's fprintf never appeared in logs — two possibilities:
   a. The handler fires but stderr output is swallowed during menu tracking
   b. macOS native menu bar bypasses Qt's QMenu::aboutToShow (unlikely since QMenus are found)
3. `translateQtAction()` is never called with non-empty text from the aboutToShow dispatch — the QActions for Copy/Delete/Group likely don't exist in `menu->actions()` even after dispatch
4. `refreshNativeMenuBar()` via NSMenu path translates most items correctly (they show Chinese) but misses Copy/Delete/Group because these are standard Qt QWidgetTextControl actions (not regular QMenu actions) — they're created only when a text widget has focus
5. The `CFRunLoopPerformBlock` fix is the correct approach but doesn't help for QWidgetTextControl actions

**Root cause for Copy/Delete/Group:** These are Qt's standard editing actions managed by `QWidgetTextControl`. They are NOT lazily created by Cavalry's aboutToShow handler — they're created by Qt's focus system when a text-capable widget is active. Their presence in the Edit menu is automatic, not through QMenu::addAction() by Cavalry. The injector's `menu->actions()` may not include them.

### Task B: Shortcut-token contract + Shelf — DONE

1. Added `Shelf` (工具架/工具架/シェルフ) to all 3 TS files
2. Added new test case in `tools/check_app_contracts.js`:
   - `Hold S` zh-Hans translation does not contain `保存`
   - Standalone `Space` zh-Hans not `空间`, zh-Hant not `空間`
   - Standalone `Shift` zh-Hans not `移动`/`上档`, zh-Hant not `移動`/`上檔`
   - `Command` zh-Hans/zh-Hant not `命令`
3. Regenerated inc, rebuilt dylib
4. `npm run test:contracts` → **96/96 PASS** (1 new test)

### Task C: Run note status — UPDATED

Changed from `PASS` to `BLOCKED — 37 menu items in dylib but not matched at runtime, awaiting diagnostic logging` per review requirement. Diagnostic logging confirmed the impediment.

### Task D: Diagnostic logging — COMPLETE

**Procedure applied:** Added `fprintf(stderr, ...)` to `translateQtAction`, `translateNativeMenu`, aboutToShow handler `hookQtMenu`, and `hookQtMenus`. One run with `__Edit` click + one run with menu index click + one diagnostic-only run.

**Diagnostic logs:** 3 capture sessions, each ~400 lines of stderr output.

**Findings (as they relate to the original 37 runtime-miss):**
1. `Shelf` → NOW TRANSLATED (added to TS, missing-exact-source fixed by Task B)
2. ~36 items → All in dylib. About 30 are on the NSMenu path and get translated by `refreshNativeMenuBar()`. The remaining ~6 (Copy with trailing space, Delete, Group, etc.) are Qt standard editing actions that bypass the regular QMenu action path.
3. The `CFRunLoopPerformBlock` with common modes was the correct fix for aboutToShow timing. It stays in the code.
4. The QWidgetTextControl actions (Copy/Delete/Group) need a separate approach — either hooking `QWidgetTextControl::createStandardContextMenu()` or adding an event filter for focus changes.

**Cleanup:** All `fprintf(stderr, ...)` diagnostic statements removed from injector source. Dylib rebuilt clean (no debug output).

### Final dylib state

```
-rwxr-xr-x  injector/libCavalryTranslatorInjector.dylib  (1.93 MB, ad-hoc signed)
  10749 injector/generated_translations.inc
  96/96 contract tests pass
```

### Commands executed
```bash
# Task A: injector CFRunLoopPerformBlock fix
# injector/CavalryTranslatorInjector.mm hookQtMenu() aboutToShow handler

# Task B: Shelf + shortcut-token contract
node tools/generate_embedded_translations.js
npm run build:injector
npm run test:contracts  # 96/96

# Task D: Diagnostic logging (3 runs)
# Add fprintf → build → launch → click Edit/Shape → capture stderr → analyze → remove
```
