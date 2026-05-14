<!--
[INPUT]: 依赖 /Applications/Cavalry.app 2.7.2、tools/cavalry_qt_target.json、full-ui-100 Target Version Drift Rule、2026-05-08 2.7.1 ALL GATES PASS artifacts
[OUTPUT]: 对外提供 Cavalry 2.7.2 目标刷新与增量补译的可执行计划，明确先重冻分母、再看增量、最后全量 gate
[POS]: doc/ 方案文档，承接 Cavalry 版本升级后的 denominator drift 处理，不驱动运行时
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Cavalry 2.7.2 Target Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前支持目标从 Cavalry `2.7.1` 刷新到 `2.7.2`，只补新增/变更英文项的翻译，但用 2.7.2 新分母全量 gate 证明完成。

**Architecture:** Cavalry 版本变化按 denominator drift 处理，不把旧 2.7.1 compiled/runtime/G-X artifact 当作当前真相源。先更新目标版本合同，再重新抽取 2.7.2 compiled/runtime/G-X 分母；翻译阶段只消费 2.7.2 相对 2.7.1 的增量，最终仍跑 full-ui 全量矩阵。

**Tech Stack:** Node.js gate scripts、Tauri/injector build contracts、Qt 6.6.3 SDK、macOS `/Applications/Cavalry.app` live capture、LLM 翻译、full-ui-100 workflow artifacts。

---

## 0. 当前事实与处理原则

- 本机 `/Applications/Cavalry.app` 已确认：`CFBundleShortVersionString = 2.7.2`，`CFBundleVersion = 2.7.2`。
- 本机 Cavalry 2.7.2 仍使用 Qt `6.6.3`，所以 `qt_sdk/6.6.3/macos` 继续是正确 SDK 路径。
- 当前仓库 `tools/cavalry_qt_target.json` 仍写 `2.7.1`。
- 当前 `tools/check_app_contracts.js` 仍断言 `target.cavalryVersion === '2.7.1'`。
- `doc/workflows/cavalry-full-ui-100/Runbook.md` 已规定：任何 Cavalry version / Qt version / bundle hash 变化都触发 denominator drift。

因此本轮不是“直接补几个词并宣称通过”，而是：

```text
2.7.2 目标合同刷新
        ↓
2.7.2 compiled/runtime/G-X 重新冻结
        ↓
与 2.7.1 PASS 分母做增量 diff
        ↓
只补新增 / 变更 source
        ↓
2.7.2 全量 full-ui gate 通过
```

---

## 1. 文件边界

### 必改文件

- `tools/cavalry_qt_target.json`
  - 当前发布目标从 `2.7.1` 改为 `2.7.2`。
  - `qtVersion` 保持 `6.6.3`。
  - `sdkPath` 保持 `qt_sdk/6.6.3/macos`。

- `tools/check_app_contracts.js`
  - 把 target contract 中的 `2.7.1` 断言改为 `2.7.2`。
  - 增加一个 resolver contract，证明当 installed Cavalry 版本与 target 不一致时会失败，防止未来版本漂移静默通过。

- `tools/resolve_cavalry_qt_sdk.js`
  - 在现有 Qt 版本校验之外，增加 Cavalry app version 校验。
  - 当 probe 到的 `/Applications/Cavalry.app` 版本与 `tools/cavalry_qt_target.json` 不一致时直接 fail。

- `doc/workflows/cavalry-full-ui-100/runs/2026-05-14-cavalry-2.7.2-target-refresh.md`
  - 记录本轮目标刷新事实、旧 artifact 边界、必跑的下一步。
  - 状态写 `PASS` 只表示“目标刷新记录成立”，不表示 full-ui 完成。

### 可能改动文件

- `tools/verify_gate_inputs.js`
  - 如果 2.7.2 重新冻结后 JSON / compiled / runtime 下界上升，应只在 G-X 证据成立后更新 lower bounds。
  - 不允许在重新冻结前预先放宽阈值。

- `doc/workflows/cavalry-full-ui-100/Project.md`
- `doc/workflows/cavalry-full-ui-100/TODO.md`
- `doc/workflows/cavalry-full-ui-100/Acceptance.md`
  - 如果执行者同步 active workflow 状态，应把 current target 从 2.7.1 改为 2.7.2，并把旧 ALL GATES PASS 降级为历史证据。
  - 这些文档更新必须跟实际 2.7.2 artifact 一起发生，不得提前写成通过。

### 翻译源文件

- `tools/zh-Hans.ts`
- `tools/zh-Hant.ts`
- `tools/ja_JP.ts`
- `languages/zh-Hans/**.json`
- `languages/zh-Hant/**.json`
- `languages/ja_JP/**.json`

这些文件只有在 2.7.2 G-X 完成并确认新增/变更 source 后才允许改。

---

## 2. Task 1: 刷新目标版本合同

**Files:**

- Modify: `tools/check_app_contracts.js`
- Modify: `tools/cavalry_qt_target.json`
- Modify: `tools/resolve_cavalry_qt_sdk.js`

- [ ] **Step 1: 写 RED test，证明 target contract 期望 2.7.2**

修改 `tools/check_app_contracts.js` 中现有 `injector build script can fall back to Qt frameworks when Cavalry app frameworks are unavailable` 测试，把版本断言改成：

```js
  assert.equal(target.qtVersion, '6.6.3');
  assert.equal(target.cavalryVersion, '2.7.2');
  assert.equal(target.sdkPath, 'qt_sdk/6.6.3/macos');
```

- [ ] **Step 2: 运行 test，确认当前失败**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected:

```text
FAIL
Expected values to be strictly equal:
'2.7.1' !== '2.7.2'
```

- [ ] **Step 3: 最小实现，把目标版本改成 2.7.2**

修改 `tools/cavalry_qt_target.json`：

```json
{
  "cavalryVersion": "2.7.2",
  "qtVersion": "6.6.3",
  "sdkPath": "qt_sdk/6.6.3/macos",
  "aqt": {
    "host": "mac",
    "target": "desktop",
    "arch": "clang_64",
    "outputDir": "qt_sdk",
    "archives": ["qtbase"]
  }
}
```

- [ ] **Step 4: 运行 test，确认 target contract 变绿**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected:

```text
PASS
```

- [ ] **Step 5: 写 RED test，证明 resolver 会拒绝 Cavalry version drift**

在 `tools/check_app_contracts.js` 增加一个 `node:test`，直接调用 `resolve_cavalry_qt_sdk.js` exported API。测试目标：构造 fake target/probe 太重，所以先用源码合同守住行为，要求 resolver 中存在 `probe.cavalryVersion !== target.cavalryVersion` 的失败分支。

Add near the existing resolver contract test:

```js
test('Qt SDK resolver rejects installed Cavalry version drift', () => {
  const resolverPath = path.join(repoRoot, 'tools', 'resolve_cavalry_qt_sdk.js');
  const resolver = fs.readFileSync(resolverPath, 'utf8');

  assert.match(
    resolver,
    /probe\.cavalryVersion[\s\S]*!==[\s\S]*target\.cavalryVersion/,
    'resolver should reject an installed Cavalry.app whose version does not match tools/cavalry_qt_target.json'
  );
  assert.match(
    resolver,
    /Unsupported Cavalry version/,
    'resolver failure should name Cavalry version drift explicitly'
  );
});
```

- [ ] **Step 6: 运行 test，确认当前失败**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected:

```text
FAIL
resolver should reject an installed Cavalry.app whose version does not match tools/cavalry_qt_target.json
```

- [ ] **Step 7: 最小实现，在 resolver 中校验 Cavalry app version**

修改 `tools/resolve_cavalry_qt_sdk.js` 的 `validateCavalryProbe(target, probe)`，在 Qt 校验前加入：

```js
  if (!probe.cavalryVersion) {
    fail(`Could not read Cavalry version from ${probe.appPath}.`);
  }
  if (probe.cavalryVersion !== target.cavalryVersion) {
    fail(
      `Unsupported Cavalry version ${probe.cavalryVersion} at ${probe.appPath}. ` +
        `This release targets Cavalry ${target.cavalryVersion} / Qt ${target.qtVersion}.`
    );
  }
```

`validateCavalryProbe` 完整形态应保持：

```js
function validateCavalryProbe(target, probe) {
  if (!probe) {
    return;
  }
  if (!probe.cavalryVersion) {
    fail(`Could not read Cavalry version from ${probe.appPath}.`);
  }
  if (probe.cavalryVersion !== target.cavalryVersion) {
    fail(
      `Unsupported Cavalry version ${probe.cavalryVersion} at ${probe.appPath}. ` +
        `This release targets Cavalry ${target.cavalryVersion} / Qt ${target.qtVersion}.`
    );
  }
  if (!probe.qtVersion) {
    fail(`Could not read QtCore version from ${probe.appPath}.`);
  }
  if (probe.qtVersion !== target.qtVersion) {
    fail(
      `Unsupported Cavalry Qt ${probe.qtVersion} at ${probe.appPath}. ` +
        `This release targets Cavalry ${target.cavalryVersion} / Qt ${target.qtVersion}.`
    );
  }
}
```

- [ ] **Step 8: 运行合同测试与 resolver 实测**

Run:

```bash
node --test tools/check_app_contracts.js
node tools/resolve_cavalry_qt_sdk.js --print-env
```

Expected:

```text
PASS
export CAVALRY_QT_PREFIX='.../qt_sdk/6.6.3/macos'
export CAVALRY_QT_VERSION='6.6.3'
```

- [ ] **Step 9: Commit**

Run:

```bash
git add tools/cavalry_qt_target.json tools/check_app_contracts.js tools/resolve_cavalry_qt_sdk.js
git commit -m "chore: refresh Cavalry target to 2.7.2"
```

---

## 3. Task 2: 记录 2.7.2 target refresh run note

**Files:**

- Create: `doc/workflows/cavalry-full-ui-100/runs/2026-05-14-cavalry-2.7.2-target-refresh.md`

- [ ] **Step 1: 写 run note**

Create `doc/workflows/cavalry-full-ui-100/runs/2026-05-14-cavalry-2.7.2-target-refresh.md`:

```markdown
<!--
[INPUT]: 依赖 /Applications/Cavalry.app Info.plist、QtCore.framework 版本探测、tools/cavalry_qt_target.json
[OUTPUT]: 对外提供 Cavalry 2.7.2 目标确认、旧 2.7.1 分母作废边界与下一轮重新冻结要求
[POS]: runs 的版本目标切换记录，连接本机软件现实与 full-ui 分母生命周期
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Cavalry 2.7.2 Target Refresh

## Status

PASS

## Verified Target

- `/Applications/Cavalry.app` `CFBundleShortVersionString`: `2.7.2`
- `/Applications/Cavalry.app` `CFBundleVersion`: `2.7.2`
- Qt runtime: `6.6.3`
- `tools/cavalry_qt_target.json`: `Cavalry 2.7.2 / Qt 6.6.3`

## Decision

Current workflow target is now Cavalry `2.7.2`.
This is a direct current-target replacement, not a second active target.
Qt did not change, so `qt_sdk/6.6.3/macos` remains the correct SDK path.

## Artifact Boundary

Artifacts created from Cavalry `2.7.1` remain historical tracking evidence only:

- `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json`
- `SESSION_DIR/extraction-inventory.json`
- `SESSION_DIR/full-ui-run-record.json`
- runtime captures under old 2.7.1 sessions

They must not be used as the current 2.7.2 denominator or gate state.

## Required Next Steps

1. Re-run compiled source extraction against `/Applications/Cavalry.app` 2.7.2.
2. Re-run live runtime capture for the workflow languages.
3. Re-run G-X to freeze a new 2.7.2 `extraction-inventory.json`.
4. Diff the new 2.7.2 frozen denominator against the last trusted 2.7.1 PASS denominator.
5. Translate only new or changed source strings, using LLM translation only.
6. Use only the new official 2.7.2 `RUN_RECORD` to choose the next failing gate.
7. Continue the full workflow from the 2.7.2 frozen denominator until G0-G4 pass.

Workflow state remains `NOT COMPLETE` until G0-G4 pass on the 2.7.2 artifacts.
```

- [ ] **Step 2: 校验 run note 状态格式**

Run:

```bash
rg -n "^## Status$|^PASS$|2\.7\.2|2\.7\.1" doc/workflows/cavalry-full-ui-100/runs/2026-05-14-cavalry-2.7.2-target-refresh.md
```

Expected includes:

```text
## Status
PASS
Current workflow target is now Cavalry `2.7.2`.
Artifacts created from Cavalry `2.7.1` remain historical tracking evidence only:
```

- [ ] **Step 3: Commit**

Run:

```bash
git add doc/workflows/cavalry-full-ui-100/runs/2026-05-14-cavalry-2.7.2-target-refresh.md
git commit -m "docs: record Cavalry 2.7.2 target refresh"
```

---

## 4. Task 3: 重新生成 2.7.2 compiled/runtime/G-X 分母

**Files / artifacts:**

- Generate: `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json`
- Generate: `~/Library/Caches/Cavalry-i18n/<SESSION_UUID>/runtime/*.json`
- Generate: `~/Library/Caches/Cavalry-i18n/<SESSION_UUID>/extraction-inventory.json`
- Generate/update: `~/Library/Caches/Cavalry-i18n/<SESSION_UUID>/full-ui-run-record.json`

- [ ] **Step 1: 清理 root-cache 非法 runtime artifact**

Run:

```bash
find "$HOME/Library/Caches/Cavalry-i18n" -maxdepth 1 \
  \( -name '*-inventory.json' -o -name '*-merged*.json' -o -name 'full-ui-run-record.json' \) \
  -print
```

Expected:

```text
<no output>
```

If output is not empty, move those files to a dated quarantine directory outside the cache root before continuing. Do not feed them into any gate.

- [ ] **Step 2: 抽取 2.7.2 compiled source map**

Run:

```bash
npm run extract:compiled-ui
```

Expected:

```text
compiled-ui-source-map.json written under ~/Library/Caches/Cavalry-i18n/
```

- [ ] **Step 3: 确认 source map target 是 2.7.2**

Run:

```bash
node -e 'const fs=require("fs"); const p=process.env.HOME+"/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json"; const j=JSON.parse(fs.readFileSync(p,"utf8")); console.log(JSON.stringify({bundleVersion:j.bundleVersion,target:j.target,entries:(j.entries||[]).length},null,2)); if (String(j.bundleVersion||j.target?.cavalryVersion)!=="2.7.2") process.exit(1);'
```

Expected:

```text
{
  "bundleVersion": "2.7.2",
  ...
}
```

- [ ] **Step 4: 运行 live full-ui runtime capture**

Run:

```bash
node tools/run_live_full_ui_matrix.js --app /Applications/Cavalry.app
```

Expected:

```text
SESSION_DIR=.../Library/Caches/Cavalry-i18n/<SESSION_UUID>
runtime artifacts written under SESSION_DIR/runtime/
full-ui-run-record.json written under SESSION_DIR/
```

- [ ] **Step 5: 导出本轮 SESSION_DIR**

Run:

```bash
export SESSION_DIR="$HOME/Library/Caches/Cavalry-i18n/<SESSION_UUID_FROM_STEP_4>"
test -d "$SESSION_DIR/runtime"
```

Expected:

```text
<exit 0>
```

- [ ] **Step 6: 冻结 2.7.2 G-X extraction inventory**

Run:

```bash
node tools/freeze_extraction_inventory.js --session-dir "$SESSION_DIR"
```

Expected:

```text
SESSION_DIR/extraction-inventory.json written
SESSION_DIR/full-ui-run-record.json updated with extraction provenance
```

- [ ] **Step 7: 运行 full-ui gate，拿到真实失败面**

Run:

```bash
npm run check:full-ui
```

Expected:

```text
Either PASS, or FAIL with a concrete first failing gate in SESSION_DIR/full-ui-run-record.json.
```

如果失败原因是 lower bounds 比 2.7.1 上升，应记录实际 2.7.2 数字后进入 Task 4，而不是降低阈值绕过。

---

## 5. Task 4: 生成 2.7.2 vs 2.7.1 增量补译清单

**Files / artifacts:**

- Read: current `SESSION_DIR/extraction-inventory.json`
- Read: last trusted 2.7.1 PASS `extraction-inventory.json`
- Generate: `SESSION_DIR/translation-delta-2.7.2.json`
- Generate: `SESSION_DIR/translation-delta-2.7.2.md`

- [ ] **Step 1: 定位 2.7.1 最后可信 PASS session**

Read `doc/workflows/cavalry-full-ui-100/runs/2026-05-08-ALL-GATES-PASS.md`，找到其中记录的 `SESSION_DIR`。

Run:

```bash
rg -n "SESSION_DIR|target|extraction|full-ui-run-record" doc/workflows/cavalry-full-ui-100/runs/2026-05-08-ALL-GATES-PASS.md
```

Expected:

```text
The note identifies a 2.7.1 PASS session and its artifacts.
```

- [ ] **Step 2: 导出 old/new extraction 路径**

Run:

```bash
export OLD_EXTRACTION="<2.7.1_PASS_SESSION_DIR>/extraction-inventory.json"
export NEW_EXTRACTION="$SESSION_DIR/extraction-inventory.json"
test -f "$OLD_EXTRACTION"
test -f "$NEW_EXTRACTION"
```

Expected:

```text
<exit 0>
```

- [ ] **Step 3: 生成增量 JSON**

Run:

```bash
node - <<'NODE' > "$SESSION_DIR/translation-delta-2.7.2.json"
const fs = require('fs');
const oldPath = process.env.OLD_EXTRACTION;
const newPath = process.env.NEW_EXTRACTION;
const oldInv = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
const newInv = JSON.parse(fs.readFileSync(newPath, 'utf8'));

function walk(value, visit, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, path.concat(index)));
    return;
  }
  if (value && typeof value === 'object') {
    visit(value, path);
    for (const [key, child] of Object.entries(value)) {
      walk(child, visit, path.concat(key));
    }
  }
}

function collect(inv) {
  const map = new Map();
  walk(inv, (node, path) => {
    const source = node.source || node.text || node.english || node.value;
    if (typeof source !== 'string' || !source.trim()) return;
    const surface = node.surface || node.group || node.kind || path.slice(0, 4).join('/');
    const key = `${surface}\u0000${source}`;
    if (!map.has(key)) {
      map.set(key, { surface, source, paths: [] });
    }
    map.get(key).paths.push(path.join('.'));
  });
  return map;
}

const oldMap = collect(oldInv);
const newMap = collect(newInv);
const added = [];
for (const [key, entry] of newMap) {
  if (!oldMap.has(key)) added.push(entry);
}
added.sort((a, b) => a.surface.localeCompare(b.surface) || a.source.localeCompare(b.source));

console.log(JSON.stringify({
  oldTarget: oldInv.target || oldInv.runRecord?.target || null,
  newTarget: newInv.target || newInv.runRecord?.target || null,
  addedCount: added.length,
  added,
}, null, 2));
NODE
```

Expected:

```text
SESSION_DIR/translation-delta-2.7.2.json exists and contains addedCount plus added entries.
```

- [ ] **Step 4: 生成增量 Markdown 给翻译使用**

Run:

```bash
node - <<'NODE' > "$SESSION_DIR/translation-delta-2.7.2.md"
const fs = require('fs');
const delta = JSON.parse(fs.readFileSync(process.env.SESSION_DIR + '/translation-delta-2.7.2.json', 'utf8'));
console.log('# Cavalry 2.7.2 Translation Delta');
console.log('');
console.log(`- Added source count: ${delta.addedCount}`);
console.log('- Translate only these new or changed source strings.');
console.log('- Do not use fixture / curated / local glossary substitution as translation output.');
console.log('');
for (const [index, item] of delta.added.entries()) {
  console.log(`## ${index + 1}. ${item.surface}`);
  console.log('');
  console.log('```text');
  console.log(item.source);
  console.log('```');
  console.log('');
}
NODE
```

Expected:

```text
SESSION_DIR/translation-delta-2.7.2.md lists only source strings absent from the trusted 2.7.1 denominator.
```

- [ ] **Step 5: 人工审查 delta 分类**

Open `SESSION_DIR/translation-delta-2.7.2.md` and classify each item:

- `new`: source did not exist in 2.7.1 and needs translation.
- `changed`: source text changed; review semantics and translate fresh.
- `noise`: source is non-user-visible or allowed English; add only to the appropriate allowlist/filter with provenance.

Expected:

```text
Only `new` and `changed` items enter translation work. `noise` items require provenance and must not shrink denominator silently.
```

---

## 6. Task 5: 只补 2.7.2 增量翻译

**Files:**

- Modify as needed: `tools/zh-Hans.ts`
- Modify as needed: `tools/zh-Hant.ts`
- Modify as needed: `tools/ja_JP.ts`
- Modify as needed: `languages/zh-Hans/**.json`
- Modify as needed: `languages/zh-Hant/**.json`
- Modify as needed: `languages/ja_JP/**.json`

- [ ] **Step 1: 为每种语言准备 LLM 翻译输入**

Use `SESSION_DIR/translation-delta-2.7.2.md` as the only translation source list.

Prompt requirements:

```text
Translate the listed Cavalry UI source strings into <language>.
Preserve product names, variable placeholders, keyboard shortcuts, file extensions, format tokens, and API identifiers.
Return a JSON object mapping exact source string to translated string.
Do not transliterate English as fake translation.
Do not output placeholder markers.
```

- [ ] **Step 2: 写入增量翻译**

For each returned mapping:

- If the source belongs to compiled/runtime UI, add it to the correct `tools/<lang>.ts` context following existing nearby source/context structure.
- If the source belongs to JSON-backed assets, update the matching path under `languages/<lang>/`.
- Do not reorder unrelated entries.
- Do not rewrite existing 2.7.1 translations unless the English source changed.

- [ ] **Step 3: 重新生成 embedded translations**

Run:

```bash
node tools/generate_embedded_translations.js
```

Expected:

```text
injector/generated_translations.inc updated if compiled/runtime translations changed.
```

- [ ] **Step 4: 跑翻译质量检查**

Run:

```bash
python3 tools/validate_translations.py
```

Expected:

```text
No FP-1..12 forbidden translation pattern violations for changed entries.
```

- [ ] **Step 5: 跑 app syntax/contracts**

Run:

```bash
npm run check:app
npm run test:contracts
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit**

Run:

```bash
git add tools/zh-Hans.ts tools/zh-Hant.ts tools/ja_JP.ts languages injector/generated_translations.inc
git commit -m "feat: add Cavalry 2.7.2 translation delta"
```

---

## 7. Task 6: 2.7.2 全量验证与收口

**Files / artifacts:**

- Read: `SESSION_DIR/full-ui-run-record.json`
- Read: `SESSION_DIR/extraction-inventory.json`
- Modify: `doc/workflows/cavalry-full-ui-100/Project.md` if gate state changes
- Modify: `doc/workflows/cavalry-full-ui-100/TODO.md` if task state changes
- Modify: `doc/workflows/cavalry-full-ui-100/Acceptance.md` only when evidence satisfies acceptance
- Create: `doc/workflows/cavalry-full-ui-100/runs/YYYY-MM-DD-2.7.2-full-ui-result.md`

- [ ] **Step 1: 重建 injector**

Run:

```bash
npm run build:injector
```

Expected:

```text
injector/libCavalryTranslatorInjector.dylib built against Qt 6.6.3
```

- [ ] **Step 2: 重新 live capture 2.7.2 三语矩阵**

Run:

```bash
node tools/run_live_full_ui_matrix.js --app /Applications/Cavalry.app
export SESSION_DIR="$HOME/Library/Caches/Cavalry-i18n/<NEW_SESSION_UUID>"
node tools/freeze_extraction_inventory.js --session-dir "$SESSION_DIR"
```

Expected:

```text
New 2.7.2 SESSION_DIR contains runtime artifacts, extraction-inventory.json, and full-ui-run-record.json.
```

- [ ] **Step 3: 跑 full-ui gate**

Run:

```bash
npm run check:full-ui
```

Expected:

```text
PASS only if W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0-G4 pass for 2.7.2.
```

- [ ] **Step 4: 如果失败，按第一个失败 gate 继续，不改口径**

Run:

```bash
node -e 'const fs=require("fs"); const p=process.env.SESSION_DIR+"/full-ui-run-record.json"; const r=JSON.parse(fs.readFileSync(p,"utf8")); console.log(JSON.stringify({overallPass:r.overallPass,blockedReason:r.blockedReason,firstFailure:r.firstFailure||r.firstFailingGate||null,target:r.target},null,2));'
```

Expected when failing:

```text
overallPass is false, and the first failing gate is explicit.
```

Use that first failing gate to create the next focused task. Do not declare 2.7.2 complete.

- [ ] **Step 5: 如果通过，写最终 run note**

Create `doc/workflows/cavalry-full-ui-100/runs/YYYY-MM-DD-2.7.2-full-ui-result.md` with:

```markdown
# Cavalry 2.7.2 Full UI Result

## Status

PASS

## Target

- Cavalry: 2.7.2
- Qt: 6.6.3
- SESSION_DIR: <absolute session path>
- RUN_RECORD: <absolute full-ui-run-record.json path>

## Gate Summary

- W-AUDIT: PASS
- G-P: PASS
- §P5: PASS
- G-CAPTURE: PASS
- G-X: PASS
- G0: PASS
- G1: PASS
- G2: PASS
- G3: PASS
- G4: PASS

## Translation Delta

- Delta source: `<SESSION_DIR>/translation-delta-2.7.2.json`
- Added/changed source count: `<count>`
- Translation policy: only 2.7.2 new/changed source strings were translated; unchanged 2.7.1 strings were reused.

## Final Wording

ALL GATES PASS for Cavalry 2.7.2.
```

- [ ] **Step 6: Commit final docs**

Run:

```bash
git add doc/workflows/cavalry-full-ui-100/Project.md doc/workflows/cavalry-full-ui-100/TODO.md doc/workflows/cavalry-full-ui-100/Acceptance.md doc/workflows/cavalry-full-ui-100/runs
git commit -m "docs: record Cavalry 2.7.2 full-ui result"
```

---

## 8. Completion Criteria

This plan is complete only when all of the following are true:

- [ ] `tools/cavalry_qt_target.json` says Cavalry `2.7.2` / Qt `6.6.3`.
- [ ] Resolver rejects installed Cavalry app version drift.
- [ ] 2.7.1 compiled/runtime/G-X artifacts are documented as historical only.
- [ ] 2.7.2 compiled source map is freshly extracted from `/Applications/Cavalry.app`.
- [ ] 2.7.2 live runtime capture exists under a new `SESSION_DIR/runtime/`.
- [ ] 2.7.2 `SESSION_DIR/extraction-inventory.json` exists and records target identity.
- [ ] Translation work is limited to new/changed 2.7.2 source strings.
- [ ] `npm run check:full-ui` passes against the 2.7.2 `SESSION_DIR`.
- [ ] The final run note says `ALL GATES PASS` only after full artifact provenance is present.

---

## 9. Self-Review

- Spec coverage: The plan covers target contract refresh, drift guard, run note, re-extraction, runtime capture, G-X freeze, delta translation, and final full-ui gate.
- Placeholder scan: No `TBD`, `TODO`, or open-ended “add tests” instructions remain; commands and expected outcomes are explicit.
- Type/path consistency: Paths match current repository structure: `tools/`, `languages/`, `injector/`, and `doc/workflows/cavalry-full-ui-100/`.
- Scope check: This is one workflow target-refresh plan, not a broad architecture rewrite.
