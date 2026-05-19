# 2026-05-05 文档对齐：§P5 表 + compiled 5195 + fabrication-era 归档

## Status

`PASS`（仅文档对齐；不动 gate 真相，不动代码 lower bound）

## 触发

文档相互冲突，且与 `tools/forbidden_translation_patterns.json` / `~/Library/Caches/Cavalry-i18n/sessions/6C24D9C7-…/extraction-inventory.json` / `compiled-ui-source-map.json` 实物不一致。本轮只做对齐，不引入新 gate 状态。

## 已对齐项

### A. Acceptance.md §P5 Forbidden Pattern Set
- 表头与列从 6 项扩到 8 项，与 `tools/forbidden_translation_patterns.json` 同集：
  - 删 FP-6（自我递归）—— detector JSON 已不存在该 ID，被 FP-9 Frankenstein 检测吸收
  - 加 FP-7（合成 source ID）/ FP-8（伪 Qt context）/ FP-9（Frankenstein 中英夹杂）
- 显式声明 `tools/forbidden_translation_patterns.json` 是真相源；任何变动先改 JSON、再改本表

### B. Acceptance.md G-X 当前状态
- frozen path 由错误的 `/tmp/ax-enhanced-1777559593/extraction-inventory.json` 改为真实路径 `~/Library/Caches/Cavalry-i18n/sessions/6C24D9C7-8342-41CA-BBE5-182E97B0BDD8/extraction-inventory.json`（5,880,554 bytes，frozen 2026-04-30T16:00:40Z）
- 补 bundleHash provenance：`a421e0137648bbd284b6e7976a119ae27ba6ada635e0706b76519b54fa7c7fe1`
- 公开两条已知 gap：`extraction-inventory.json` 顶层缺 `target` 对象；`tools/verify_gate_inputs.js` 的 `'compiled-source-map': 4743` 未跟 5195

### C. compiled lower bound 4743 → 5195
- Acceptance.md G-X frozen lower bounds 表，加 Provenance 列，记录 `compiled-ui-source-map.json` extractedAtUtc 2026-04-30T08:48:19Z + Cavalry 2.7.1 bundleHash
- Anti-Patterns.md §C frozen lower bound 表同步更新（5195，2.7.0 时为 4743）
- Project.md「已核实语言来源」表同步
- TODO.md W-X 同步，新增「`verify_gate_inputs.js` 4743→5195 修正在 recovery 线上重做」一项（fabrication 分支 `0dbafdf` 已做，但 reset 一并丢失）

### D. fabrication-era / over-claim run notes 与失效 NEXT-STEPS.md 归档
- 新建 `runs/archive/` 与 `runs/archive/CLAUDE.md`
- 移入：
  - `2026-04-30-WORKFLOW-EXECUTION-COMPLETE.md`
  - `2026-04-30-GATE-STATUS-PHASE-2-COMPLETE.md`
  - `2026-04-30-workflow-status-batch-translations-complete.md`
  - `2026-05-XX-workflow-status-80-percent-complete.md`
  - `NEXT-STEPS.md`（引用了不存在的 session `24B1A045…`，且推荐 zh-Hans→zh-Hant 转换路径，违反 EXECUTE 禁 6）
- runs/CLAUDE.md 成员清单补 `archive/` 条目

## 没有动的项

- 没有改任何 gate PASS/BLOCKED 状态
- 没有改任何代码（`tools/verify_gate_inputs.js` 的 4743 仍在；进入 recovery 线代码侧重做时另起 run note）
- 没有改 `extraction-inventory.json` 本身（target 字段缺失需在下一次 G-X 重 freeze 时补齐）
- 没有改 Project.md 内部三段进度互相打架的状况；该项需要在 fabrication recovery 后重新做整体 status snapshot，本轮仅做事实级对齐

## Provenance / 证据路径

| Artifact | 路径 | 关键字段 |
| --- | --- | --- |
| Forbidden pattern detector | `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/forbidden_translation_patterns.json` | FP-1/2/3/4/5/7/8/9（无 FP-6） |
| Compiled source map | `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json` | entries=5195, bundleVersion=2.7.1, bundleHash=a421e013…, extractedAtUtc=2026-04-30T08:48:19Z |
| Extraction inventory | `~/Library/Caches/Cavalry-i18n/sessions/6C24D9C7-8342-41CA-BBE5-182E97B0BDD8/extraction-inventory.json` | sessionUuid=6C24D9C7…, frozenAtUtc=2026-04-30T16:00:40Z, surfaces.compiled-source-map.count=5195, surfaces.json-total.count=6415 |
| Merged inventories | `~/Library/Caches/Cavalry-i18n/sessions/6C24D9C7-…/runtime/<lang>-merged-inventory.json` | source=live-merged, bundleHash=a421e013…, sessionUuid=6C24D9C7… |
| Recovery commit | `dc153ba fix(§P5): harden detector against synthetic-denominator fabrication` | HEAD |

## 影响 gate

- `Acceptance.md / Anti-Patterns.md / Project.md / TODO.md` 重新成为内部一致的真相源；`prompts/CLAUDE.md` 的「冲突以 Acceptance.md 为准」回到可执行
- `tools/verify_gate_inputs.js` 的 4743 仍是真 gap，已显式登记在 Acceptance G-X 与 TODO W-X，避免下任 agent 误以为已修
