# Cavalry Runtime UI Tail Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last visible English UI tails and broken translated labels in Cavalry without restarting the completed full-UI translation project.

**Architecture:** Treat every residual or broken UI string as evidence and route it through one classifier: extracted and embedded, extracted but untranslated, extracted but mistranslated, missing exact source, JSON-backed asset, runtime miss, or broken glyph/rendering output. Fix only the proven class, then regenerate the embedded injector or JSON assets and verify with a focused live inventory before running the broader matrix.

**Tech Stack:** Node.js audit scripts, Qt TS files (`tools/*.ts`), generated C++ translation table (`injector/generated_translations.inc`), Objective-C++ injector dylib, Tauri JSON copy map, live Cavalry runtime inventory.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

---

## Operator Intent

The user already completed most of the Cavalry localization work. The remaining problem is not a new full translation pass. The problem is tail cleanup: real UI still shows English in menus, panels, message bars, viewport helper hints, hover tooltips, and timeline/status controls. Some labels may also render as missing glyph boxes after translation. Screenshots in the chat were examples, not a complete source list.

Do not treat every visible English string as the same bug. The same symptom has different causes:

- Missing exact source in `tools/*.ts`.
- Source exists in extraction but has no translated value.
- Bad translation of shortcut tokens, such as `Space` translated as `空间`.
- Source and translation exist in TS/inc/dylib, but the runtime widget does not use the Qt property currently translated by the injector.
- Dynamic text is composed at runtime, such as `Space` plus `Play / Stop`.
- JSON-backed assets are translated and copied by `src-tauri/src/patch.rs`, not embedded in the injector table.
- Translation uses characters not rendered by the active UI font, or the wrong text was inserted and appears as square boxes.

The correct output is a small, evidence-backed patch set and a residual report. Do not redo the whole workflow unless the focused verification proves the denominator is stale.

## Screenshot Evidence From User Chat

The original images are only present in the conversation, not as repo files. Use the visible text below as the seed list.

| Evidence | Surface | Visible English | Initial classification |
|---|---|---|---|
| Screenshot 1 | Project dropdown/menu | `No Project Set...`, `Load...`, `Create...` | `No Project Set...` exists and is embedded; `Load...` and `Create...` were not found as exact TS/inc sources. |
| Screenshot 2 | Message/log panel | `Welcome to Cavalry.` | `Welcome to Cavalry` exists; dotted `Welcome to Cavalry.` was not found as an exact source. |
| Screenshot 3 | Viewport helper overlay | `S + click path`, `Insert Keyframe`, `Hold S`, `Direct Layer Selection`, `Space`, `Play / Stop`, `Space + click + drag`, `Pan`, `Shift`, `Enable Snapping`, `Viewport Quality: High` | Several component tokens exist; exact compound strings like `Play / Stop`, `S + click path`, `Space + click + drag` were not found. `Space`/`Hold S` need shortcut-token quality review. |
| Screenshot 4 | Hover tooltip over tool button | `Create a Forge Dynamics Solver`, `Any selected shapes will automatically be added as input shapes.` | Both strings exist in TS/inc/dylib; if still English live, classify as runtime miss or hover surface not using translated Qt property. |
| Screenshot 5 | Main Cavalry workspace, toolbar, asset panel, viewport overlay, timeline, message bar | `Snap Angle:`, `Manipulator:`, `Composition 1`, `Double click here to import Assets.`, `Rectangle Tool`, `Hold alt/option to create this primitive without entering the tool.`, `S + click path`, `Insert Keyframe`, `Hold S`, `Direct Layer Selection`, `Space`, `Play / Stop`, `Space + click + drag`, `Pan`, `Shift`, `Enable Snapping`, `Viewport Quality: High`, `Welcome to Cavalry.`, `Default Keyframe Layer`, `Align:`, `Tips and Tricks` | This screenshot proves the tail is mixed: menu bar is mostly translated, while toolbar/status/helper/tooltip surfaces still leak English. Treat this as focused live-capture scope, not as a complete denominator. |
| Screenshot 5 | Timeline/layer rows | visible square-box labels on green rows, likely translated text rendered as missing glyph boxes or invalid characters | Classify as `broken-rendered-translation` until live inventory proves the actual source/translation bytes and widget font. Do not assume it is only an untranslated English residual. |

## Current Proven Facts

- `tools/zh-Hans.ts` has 3610 message rows.
- `injector/generated_translations.inc` has 3610 rows for zh-Hans. There is no TS-to-inc missing row.
- zh-Hans has 3526 unique `(context, source, translation)` triples because 84 rows are exact duplicates.
- `injector/libCavalryTranslatorInjector.dylib` contains all checked `.inc` source and translation bytes.
- JSON language packs have 38 files per language. `src-tauri/src/patch.rs` maps all 38 files: 26 static file pairs plus 12 plugin `strings.json` files discovered dynamically.
- The known problem is not proven to be large-scale "translated but not embedded". The known tail includes missing exact runtime sources, possibly extracted-but-untranslated strings, mistranslated shortcut tokens, possible runtime misses, and at least one visual symptom where translated text may render as square boxes.

## Files

- Modify: `tools/zh-Hans.ts`
- Modify: `tools/zh-Hant.ts`
- Modify: `tools/ja_JP.ts`
- Modify: `injector/generated_translations.inc` by running `node tools/generate_embedded_translations.js`
- Modify: `injector/libCavalryTranslatorInjector.dylib` by running `tools/build_translator_injector.sh`
- Consider Modify: `tools/forbidden_translation_patterns.json`
- Consider Modify: `tools/forbidden_translation_patterns.js`
- Consider Modify: `tools/forbidden_translation_patterns.py`
- Consider Modify: `tools/check_app_contracts.js`
- Consider Modify: `tools/check_full_ui_coverage.js`
- Consider Modify: `tools/capture_accessibility_inventory.js`
- Read: `injector/CavalryTranslatorInjector.mm`
- Read: `src-tauri/src/patch.rs`
- Read: `tools/runtime_ui_allowlist.json`

## Task 1: Build The Tail Seed Audit

- [ ] **Step 1: Run the current exact-source probe**

Run:

```bash
node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const probes = [
  'No Project Set...',
  'Load...',
  'Create...',
  'Welcome to Cavalry.',
  'Welcome to Cavalry',
  'S + click path',
  'Insert Keyframe',
  'Hold S',
  'Direct Layer Selection',
  'Space',
  'Play / Stop',
  'Space + click + drag',
  'Pan',
  'Shift',
  'Enable Snapping',
  'Viewport Quality: High',
  'Create a Forge Dynamics Solver',
  'Any selected shapes will automatically be added as input shapes.',
  'Snap Angle:',
  'Manipulator:',
  'Composition 1',
  'Double click here to import Assets.',
  'Rectangle Tool',
  'Hold alt/option to create this primitive without entering the tool.',
  'Default Keyframe Layer',
  'Align:',
  'Tips and Tricks'
];

function parseTs(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const out = new Map();
  for (const message of xml.matchAll(/<message>([\s\S]*?)<\/message>/g)) {
    const block = message[1];
    const source = (block.match(/<source>([\s\S]*?)<\/source>/) || [])[1];
    const translation = (block.match(/<translation>([\s\S]*?)<\/translation>/) || [])[1];
    if (source && translation) out.set(source.trim(), translation.trim());
  }
  return out;
}

const zhHans = parseTs(path.join(root, 'tools/zh-Hans.ts'));
const inc = fs.readFileSync(path.join(root, 'injector/generated_translations.inc'), 'utf8');
const dylib = fs.readFileSync(path.join(root, 'injector/libCavalryTranslatorInjector.dylib'));

for (const source of probes) {
  console.log(JSON.stringify({
    source,
    zhHansTs: zhHans.get(source) || null,
    inInc: inc.includes(`"${source.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`),
    inDylib: dylib.includes(Buffer.from(source, 'utf8'))
  }));
}
NODE
```

Expected:

- `Load...`, `Create...`, `Welcome to Cavalry.`, `Play / Stop`, `S + click path`, `Space + click + drag`, and some new screenshot 5 strings may report missing from TS/inc/dylib.
- Existing entries such as `Create a Forge Dynamics Solver` report present.

- [ ] **Step 2: Save the command output in the run note**

Create a run note under `doc/` named `runtime-ui-tail-cleanup-run-YYYY-MM-DD.md`. It must include `## Status` and use `FAIL` until fixes and focused live verification pass.

## Task 2: Fix Missing Exact Compiled Sources

- [ ] **Step 1: Add exact source entries to all three TS files**

Add missing exact source messages in the `MenuBarManager` context of:

- `tools/zh-Hans.ts`
- `tools/zh-Hant.ts`
- `tools/ja_JP.ts`

Use these translations:

| Source | zh-Hans | zh-Hant | ja_JP |
|---|---|---|---|
| `Load...` | `加载...` | `載入...` | `読み込み...` |
| `Create...` | `创建...` | `建立...` | `作成...` |
| `Welcome to Cavalry.` | `欢迎使用 Cavalry。` | `歡迎使用 Cavalry。` | `Cavalry へようこそ。` |
| `Play / Stop` | `播放 / 停止` | `播放 / 停止` | `再生 / 停止` |
| `S + click path` | `S + 单击路径` | `S + 按一下路徑` | `S + パスをクリック` |
| `Space + click + drag` | `空格 + 单击 + 拖动` | `空白鍵 + 按一下 + 拖曳` | `Space + クリック + ドラッグ` |
| `Snap Angle:` | `吸附角度:` | `吸附角度:` | `スナップ角度:` |
| `Manipulator:` | `操纵器:` | `操控器:` | `マニピュレータ:` |
| `Double click here to import Assets.` | `双击此处导入素材。` | `按兩下此處匯入素材。` | `ここをダブルクリックしてアセットを読み込みます。` |
| `Rectangle Tool` | `矩形工具` | `矩形工具` | `矩形ツール` |
| `Hold alt/option to create this primitive without entering the tool.` | `按住 Alt/Option 可直接创建此图元，而不进入该工具。` | `按住 Alt/Option 可直接建立此圖元，而不進入該工具。` | `Alt/Option を押したままにすると、このプリミティブをツールに入らず作成できます。` |
| `Default Keyframe Layer` | `默认关键帧图层` | `預設關鍵幀圖層` | `デフォルトキーフレームレイヤー` |
| `Align:` | `对齐:` | `對齊:` | `整列:` |
| `Tips and Tricks` | `提示与技巧` | `提示與技巧` | `ヒントとコツ` |

Keep shortcut key names stable. Do not translate `S` as save, and do not translate the key token `Space` when it is visibly a keyboard key unless local UI convention already uses a key label such as `空格` or `空白鍵`.

- [ ] **Step 2: Regenerate the embedded table**

Run:

```bash
node tools/generate_embedded_translations.js
```

Expected: `injector/generated_translations.inc` changes and contains the six new source strings for all three target languages.

- [ ] **Step 3: Rebuild the injector dylib**

Run:

```bash
tools/build_translator_injector.sh
```

Expected: `injector/libCavalryTranslatorInjector.dylib` has a newer timestamp than `injector/generated_translations.inc`.

- [ ] **Step 4: Verify the new strings are embedded in the dylib**

Run:

```bash
node <<'NODE'
const fs = require('fs');
const bin = fs.readFileSync('injector/libCavalryTranslatorInjector.dylib');
for (const text of ['Load...', '加载...', 'Create...', '创建...', 'Play / Stop', '播放 / 停止']) {
  console.log(`${text}: ${bin.includes(Buffer.from(text, 'utf8'))}`);
}
NODE
```

Expected: every line ends with `true`.

## Task 3: Fix Shortcut Token Translation Quality

- [ ] **Step 1: Audit known shortcut-token entries**

Run:

```bash
rg -n '<source>(S|Space|Shift|Hold S|Command|Option|Alt|Ctrl|Control)</source>|<source>Hold S</source>|<source>Space</source>' tools/zh-Hans.ts tools/zh-Hant.ts tools/ja_JP.ts
```

Expected: `tools/zh-Hans.ts` currently includes bad candidates such as `Space` translated as `空间` and `Hold S` translated as `按住保存键`.

- [ ] **Step 2: Correct key-token translations**

Use this policy:

- `S` remains `S`.
- `Space` as a keyboard key becomes `空格` in zh-Hans, `空白鍵` in zh-Hant, and `Space` in ja_JP unless the surrounding Japanese phrase requires `スペースキー`.
- `Shift` remains `Shift`.
- `Hold S` becomes `按住 S`, `按住 S`, `S キーを押したまま`.

Do not globally replace ordinary words named `Space` inside non-shortcut domain strings without checking context.

- [ ] **Step 3: Add a detector contract**

Modify `tools/check_app_contracts.js` to assert that shortcut-token source strings do not receive semantic mistranslations. The test must fail if:

- `Hold S` translates to a phrase containing `保存`.
- standalone `Space` translates to `空间` in zh-Hans.
- standalone `Shift` translates to `上档键` in contexts where the visible UI uses `Shift`.

Run:

```bash
npm run test:desktop
```

Expected: the new contract passes after TS corrections.

## Task 4: Classify Live Runtime Residuals

- [ ] **Step 1: Run a focused live capture**

Use the existing live workflow rather than inventing a new capture path. Prefer the project scripts documented in:

- `doc/workflows/cavalry-full-ui-100/prompts/07-runtime-capture-toolchain.md`
- `tools/run_live_full_ui_matrix.js` if present in the current checkout
- `tools/capture_accessibility_inventory.js`
- `tools/check_full_ui_matrix.js`

The focused session must open or hover the surfaces represented by the screenshots:

- Project dropdown/menu.
- Message/log panel.
- Viewport helper overlay.
- Toolbar hover tooltip for the Forge Dynamics Solver button.
- Main workspace toolbar and left-side tool palette.
- Asset panel empty-state text.
- Timeline bottom bar and keyframe layer controls.
- Any row showing square boxes instead of readable translated text.

- [ ] **Step 2: Produce a residual classification table**

For every live English residual, write one row in the run note:

| Source | Surface | In TS | In inc | In dylib | In JSON | Classification | Fix |
|---|---|---:|---:|---:|---:|---|---|
| `example` | `tooltip` | yes | yes | yes | no | runtime miss | inspect Qt property path |

Allowed classifications:

- `missing-exact-source`
- `bad-translation`
- `embedded-but-runtime-miss`
- `extracted-but-untranslated`
- `broken-rendered-translation`
- `json-backed`
- `allowlisted-technical-token`
- `needs-human-screenshot-repro`

Do not mark a string fixed unless the next focused live capture no longer shows it in English.

## Task 4A: Classify Square-Box Or Missing-Glyph Labels

- [ ] **Step 1: Capture the actual text behind square-box rows**

Use the live inventory and accessibility capture to record the string value behind every visually broken label. If the visual row shows boxes but AX/runtime reports readable Chinese/Japanese text, classify as `broken-rendered-translation`. If AX/runtime reports literal square characters such as `□□`, classify as `bad-translation`.

- [ ] **Step 2: Verify whether the string exists in TS or JSON**

Run a source probe for the captured readable source and rendered value:

```bash
rg -n 'CAPTURED_SOURCE_OR_BOX_VALUE' tools/zh-Hans.ts tools/zh-Hant.ts tools/ja_JP.ts languages output injector/generated_translations.inc
```

Expected: each broken row maps to exactly one source system. If it appears in JSON, inspect `src-tauri/src/patch.rs`; if it appears in TS/inc, inspect the injector path.

- [ ] **Step 3: Check font/glyph versus data corruption**

If the translation value is readable in the file but square in UI, inspect the widget font or Cavalry rendering surface. If the translation value in the file is already square boxes, fix the translation source and add a detector that rejects box characters in translated UI strings.

## Task 5: Investigate Embedded-But-Runtime-Miss Tooltips

- [ ] **Step 1: Confirm whether the live tooltip text exists in the embedded table**

Run:

```bash
rg -n 'Create a Forge Dynamics Solver|Any selected shapes will automatically be added as input shapes' tools/zh-Hans.ts injector/generated_translations.inc
```

Expected: both strings are present.

- [ ] **Step 2: Inspect injector surface coverage**

Read:

- `injector/CavalryTranslatorInjector.mm`

Confirm these paths exist:

- `translateQtAction()` handles `action->toolTip()`, `action->statusTip()`, and `action->whatsThis()`.
- `translateQtWidgetTexts()` handles `widget->toolTip()`, `widget->statusTip()`, and `widget->whatsThis()`.
- `translateQtWidgetTexts()` calls `translateQtAction(toolButton->defaultAction(), lang)` for `QToolButton`.

- [ ] **Step 3: If the tooltip remains English live, capture its owner**

Extend runtime inventory only if current artifacts cannot identify owner class/object/action text. The evidence needed is:

- Widget class name.
- Object name if present.
- Default action text if present.
- `toolTip`, `statusTip`, `whatsThis` values before and after translation.
- Whether the hover popup is a Qt tooltip, custom widget, or accessibility-only label.

Do not patch blindly. If source exists and injector handles the property, the problem is probably object timing, custom painting, or a different property.

## Task 6: Final Gates

- [ ] **Step 1: Regenerate and rebuild after every TS change**

Run:

```bash
node tools/generate_embedded_translations.js
tools/build_translator_injector.sh
```

- [ ] **Step 2: Run translation quality checks**

Run:

```bash
npm run test:desktop
```

Expected: all contract tests pass.

- [ ] **Step 3: Run focused live verification**

Run the same focused live capture from Task 4. Expected:

- Project dropdown no longer shows `Load...` / `Create...` in English when the translated language is active.
- Message panel no longer shows `Welcome to Cavalry.` in English if that text is Qt/runtime translated.
- Viewport helper overlay no longer shows the fixed exact compound strings in English if those strings are exposed through the injector path.
- Shortcut keys are not semantically mistranslated.
- Timeline/layer labels do not show square boxes unless the same boxes are intentional technical glyphs and are explicitly allowlisted.

- [ ] **Step 4: Run the broader full UI matrix only after focused verification passes**

Run:

```bash
npm run check:full-ui
```

Expected: no regression in existing full-ui coverage. If this command is not available in the current package scripts, run the equivalent project command listed in `package.json` and record the exact command in the run note.

## Stop Conditions

Stop and write `BLOCKED` if any of these happen:

- A live residual exists in TS/inc/dylib but cannot be tied to a Qt widget/action/property.
- A tooltip appears to be custom painted and no Qt property contains its text.
- A broken square-box label cannot be mapped to either a source string or rendered translation value.
- Focused capture cannot reproduce the screenshot surfaces.
- Two attempted fixes leave the same English residual unchanged.

## Completion Criteria

The task is complete only when:

- Every screenshot-seeded residual is classified.
- Every `missing-exact-source` and `bad-translation` item is fixed in all three target languages.
- Every square-box visual label is classified as bad data, font/glyph rendering, intentional technical glyph, or unresolved blocker.
- `generated_translations.inc` and `libCavalryTranslatorInjector.dylib` are regenerated.
- Focused live verification proves the target surfaces improved, or the run note records a concrete `embedded-but-runtime-miss` blocker with owner evidence.
- The run note in `doc/` contains command outputs, classification table, screenshot evidence summary, and final `PASS`, `FAIL`, or `BLOCKED` status.
