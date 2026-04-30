<!--
[INPUT]: 依赖 Project.md 的目标与当前实现真相、Anti-Patterns.md 的绕过证据、Runbook.md 的执行纪律
[OUTPUT]: 对外提供 Full UI 100% workflow 的规范性验收标准
[POS]: full-ui-100 工作流的 gate 真相源
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Acceptance — Cavalry Full UI 100% 验收标准

> **本文件只写规范，不写“当前代码已经做到哪里”。**
> 当前实现真相、缺口、过时外部入口统一写在 `Project.md` 与 `TODO.md`，不再与规范混写。
> README / 普通说明文案不参与本阶段 gate，最终收尾时再统一更新。
> CI 只在实际执行 gate / 打包 / artifact 绑定时属于本 workflow 工作面。

> **复选框是 live acceptance checklist，不是摆设。**
> 每当某个通过条件在当前分支/当前证据下已经成立，执行者就必须把对应项从 `- [ ]` 改成 `- [x]`；
> 若后续发现该条件失效、证据过期或被 invalidate，则必须改回 `- [ ]`。
> 打钩不能单独发生：**每次更新本文件复选框时，必须同步更新 `Project.md` / `TODO.md` 的当前状态描述，并在当轮 run note 记录本次状态变化与证据。**

> **阈值单位固定：**
> Full UI / runtime / compiled 一律使用百分数 CLI，唯一完成值是 `100`；
> JSON validator 一律使用小数比例，唯一完成值是 `1.00`。
> `100` 的含义不是“粗暴翻译所有英文”，而是：先按 `tools/translation-whitelist.json`、glossary 与 no-translate 规则排除允许保留项，再要求剩余必须翻译 surface 全部通过。
> 在 active full-ui / Tauri gate 中，任何 `< 100` / `< 1.00` 的完成口径都是失败态；旧 `--threshold 99`、`0.99`、`0.90` 只作为 legacy weak-threshold 红灯样本出现，不是目标语义。
> README / 归档文档 / 历史聊天记录里的旧数字只作为后续文档收尾项，不阻塞当前实现阶段。

---

## Artifact Contract（唯一口径）

```text
CACHE_ROOT   = ~/Library/Caches/Cavalry-i18n
SESSION_DIR  = $CACHE_ROOT/sessions/<session-uuid>
RUNTIME_DIR  = $SESSION_DIR/runtime
AUDIT_DIR    = $SESSION_DIR/audit
RUN_RECORD   = $SESSION_DIR/full-ui-run-record.json
SOURCE_MAP   = $CACHE_ROOT/compiled-ui-source-map.json
EXTRACTION   = $SESSION_DIR/extraction-inventory.json
WHITELIST    = REPO/tools/translation-whitelist.json
```

- `RUN_RECORD` = machine-readable JSON session artifact
- `run note` = human-authored markdown note at `REPO/doc/workflows/cavalry-full-ui-100/runs/YYYY-MM-DD-{gate-or-task}.md`
- `EXTRACTION` = frozen denominator artifact; G1/G2/G3/G4 只能使用其中列出的 English surface

### Target identity

每个 current gate artifact 必须绑定同一个目标身份：

- `target.cavalryVersion`
- `target.qtVersion`
- `target.bundleHash`
- `target.appPath`

`target.cavalryVersion` 必须等于当前 `/Applications/Cavalry.app/Contents/Info.plist` 的 `CFBundleShortVersionString`；
`target.qtVersion` 必须等于 `tools/cavalry_qt_target.json` 的 Qt 版本；
`target.bundleHash` 必须来自当前 app executable。
目标身份不一致时，旧 artifact 只能作为历史 run note，不能作为 current denominator 或 PASS 证据。

### Runtime artifacts

- `RUNTIME_DIR/<lang>-injector-inventory.json`
- `RUNTIME_DIR/<lang>-ax-inventory.json`
- `RUNTIME_DIR/<lang>-merged-inventory.json`

### Audit artifacts

- `AUDIT_DIR/<lang>-injector-capture.json`
- `AUDIT_DIR/<lang>-ax-capture.json`
- `AUDIT_DIR/<lang>-merge.json`

### Reader rules

- matrix / runtime gate **只允许**读取 `SESSION_DIR` 下的 runtime artifacts
- `CACHE_ROOT` 根目录下的 `*-inventory.json` / `*-merged*.json` / `full-ui-run-record.json` 一律视为 **stale / illegal input**
- `SOURCE_MAP` 是当前唯一允许留在 `CACHE_ROOT` 根目录的 gate 输入，但必须通过显式参数或 preflight 绑定，并在 `RUN_RECORD` 中记录 hash / mtime / path
- 任何“自动扫描 cache 根目录然后挑一个 inventory 来读”的 reader 都视为不合规

---

## Gate Overview

| Gate | 名称 | 目标 |
| --- | --- | --- |
| **W-AUDIT** | Reviewer Red Flags | 把已知弱口径先变成 RED→GREEN |
| **G-P** | Provenance Integrity | 确认 gate 输入来自 live capture / raw extraction |
| **§P5** | Forbidden-Translation Patterns | 拒绝伪翻译形态 |
| **G-CAPTURE** | Capture Toolchain Readiness | 先建立能抓全 runtime 的真机工具链 |
| **G-X** | Extraction Inventory Freeze | 再证明完整英文分母已经抽出并冻结 |
| **G0** | Measurement Integrity | 确认阈值、reader、run record、自检链路可信 |
| **G1** | JSON Surface 100 | JSON 资产真 100 |
| **G2** | Compiled Surface 100 | compiled owner map 完整且非 curated |
| **G3** | Runtime Surface 100 | live runtime 真 100 |
| **G4** | Three-Language Matrix 100 | 三语同一次矩阵全绿 |

完成定义：`W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0 + G2 + G3 + G1 + G4 = PASS`。
任意一项不通过 = `NOT COMPLETE`。

---

## W-AUDIT — Reviewer Red Flags Gate

### 通过条件

- [x] active full-ui / Tauri gate 已实现 whitelist-filtered 100；legacy weak threshold（如 `--threshold 99`）不再被接受
- [x] `tools/validate_translations.py` 不再以 `0.90` 放行
- [x] `check:full-ui` 在 matrix 前显式调用 `tools/verify_gate_inputs.js`
- [x] runtime detector 把 §P5 命中视为 fail，而不是只看 `/[A-Za-z]/`
- [x] compiled extractor contract 覆盖 `libExtensionLayer.dylib`
- [x] Electron 专属 test/build/harness 不作为本 workflow 的修复目标；仍有价值的断言已迁移到 full-ui / Tauri gate

### 失败条件

- active full-ui / Tauri gate 仍把弱阈值冻结成正确行为
- 仍允许 preflight 缺失时继续跑 matrix
- 仍把白名单外未达 100 的结果当作“暂时可接受”
- 为满足本 workflow 而新增、修复或扩展 Electron 专属路径

---

## G-CAPTURE — Capture Toolchain Readiness Gate

### 目的

先让 runtime 抓取能力成立，再冻结分母。`G-X` 依赖 live runtime denominator；因此 capture / injector / merge 工具链必须前置，否则会把“抓不全”误判为外部阻塞。


### 当前状态

**`BLOCKED-SIP`** (2026-04-30)

macOS System Integrity Protection (SIP) 启用状态下，`DYLD_INSERT_LIBRARIES` 无法向代码签名的应用注入 dylib。

见：`runs/2026-04-30-G-CAPTURE-SIP-blocker.md`

### 通过条件

- [ ] injector 支持 English dump-only 模式：`CAVALRY_I18N_LANG=en` 只导出英文 runtime，不要求翻译表存在
- [ ] `tools/launch_cavalry_with_injector.sh` 显式传递 `sessionDir/sessionUuid/cacheRoot`
- [ ] `tools/capture_accessibility_inventory.js` 写入 `RUNTIME_DIR/<lang>-ax-inventory.json`
- [ ] `tools/merge_runtime_inventory.js` 存在，只接受 `live-injector` / `live-accessibility`
- [ ] `tools/run_live_full_ui_matrix.js` 存在，统一创建 `SESSION_DIR` 并写 `RUN_RECORD`
- [ ] runtime walk 主动覆盖 Library / Inspector / Timeline / Render Queue / Preferences
- [ ] `RUN_RECORD.target` 与所有 runtime capture 的 `capture.bundleHash/sessionUuid` 一致
- [ ] AX menu capture 记录递归证据：
  - [ ] `menuDepthMax >= 2`
  - [ ] 至少保留 5 条含 submenu 的路径样本
  - [ ] audit log 能从样本路径回溯到 `RUNTIME_DIR/<lang>-ax-inventory.json`
- [ ] A9B11073 合格基线可被用作 lower-bound provenance：
  - [ ] `runtime.candidates >= 613`
  - [ ] `runtime.menuLeaves >= 666`
  - [ ] `capture.source = live-merged`
  - [ ] `capture.bundleHash = ec5ab60c4cc33fd1f57364e7e7660dd44bd7fcc979d0417e1451114f2b9e48f9`

### 失败条件

- English runtime dump 仍因 `unsupported language: en` 提前退出
- runtime 产物仍写入 cache 根目录
- AX-only 弱抓取低于已知 A9B11073 基线却继续进入 G-X
- 用 fixture / curated 数据补足 runtime 数量
- 只证明脚本里存在递归代码，却没有在本轮 capture artifact 中留下 submenu 深度与路径证据

---

## G-X — Extraction Inventory Freeze Gate

### 目的

翻译动作必须等完整英文分母冻结后才能开始。否则执行者可以通过 merge 丢项、source-map 子集、runtime 弱抓取或临时 allowlist 把 100% 做成分母缩水。

### Artifact schema

`EXTRACTION` 必须记录每个 surface：

- [ ] `source.path`
- [ ] `source.sha256`
- [ ] `source.mtime`
- [ ] `target.cavalryVersion`
- [ ] `target.qtVersion`
- [ ] `target.bundleHash`
- [ ] `surface`
- [ ] `count`
- [ ] `englishLeaves[]`
- [ ] `extractor.name`
- [ ] `extractor.version`
- [ ] `frozenAtUtc`

### Frozen lower bounds

| Surface | 通过下界 |
| --- | ---: |
| `languages/en/appStrings.json` | >= 10 leaves |
| `languages/en/nodeStrings.json` | >= 6320 leaves |
| `languages/en/onboarding.json` | >= 34 leaves |
| `languages/en/tips.json` | >= 51 leaves |
| JSON total | >= 6415 leaves |
| `SOURCE_MAP.entries` | >= 4743 entries |
| runtime candidates | >= 613 |
| runtime menuLeaves | >= 666 |

> `runtime candidates >= 613` / `runtime menuLeaves >= 666` 是 A9B11073 的 anti-regression floor，不是完整 UI 完成线。G-X 还必须冻结 JSON 6415、compiled source-map 4743，并记录 compiled raw audit。compiled raw `767 / 1580 / 407 / 34046` 未在当前脚本口径下复现，不能作为 gate 常量，除非补上对应 artifact provenance。

### Runtime walk scope

runtime 抽取必须主动覆盖：

- [ ] Library
- [ ] Inspector
- [ ] Timeline
- [ ] Render Queue
- [ ] Preferences
- [ ] menu / submenu / panel title / tab / placeholder / tooltip / status / empty-state

### 通过条件

- [ ] `EXTRACTION` 存在于当前 `SESSION_DIR`
- [ ] JSON、compiled、runtime 三类 surface 全部写入 `EXTRACTION`
- [ ] 每个 surface 的 `count` 达到 frozen lower bounds
- [ ] runtime lower bound 使用 `candidates/menuLeaves`，不再使用 `menuBars/widgetTexts` 这种结构字段
- [ ] `RUN_RECORD.extractionInventory.path/hash/mtime` 已记录
- [ ] `RUN_RECORD.target`、`SOURCE_MAP.target`、`EXTRACTION.target`、runtime `capture.bundleHash` 全部指向同一当前 app
- [ ] G1/G2/G3/G4 读取的分母等于 `EXTRACTION.englishLeaves`
- [ ] `EXTRACTION` 写入后 hash 不再变化，后续 gate 只读不写
- [ ] 翻译 prompt 启动前必须验证 `EXTRACTION` 已 PASS

### 失败条件

- 任一 surface 低于 frozen lower bound
- `EXTRACTION` hash 在 G1/G2/G3/G4 期间变化
- G1/G2/G3 使用 merge 残留、source-map 子集或 runtime 当前可见子集作为分母
- 抽取失败后继续进入翻译 prompt
- Cavalry target version / bundle hash 变化后继续复用旧 `EXTRACTION`

---

## G-P — Provenance Integrity Gate

### 通过条件

- [ ] 仓库内不存在 `tools/full_ui_inventory_fixtures/`
- [ ] 仓库内不存在 `doc/libExtensionLayer-curated-ui.txt`
- [ ] `package.json` 中不存在 `prepare:full-ui-gate`
- [ ] `tools/verify_gate_inputs.js` 存在，并由 `check:full-ui` / matrix 前置调用
- [ ] `SOURCE_MAP.kind` 不为 `curated` / `whitelisted` / `gated`
- [ ] 每份 merged runtime inventory 都包含：
  - [ ] `capture.pid`
  - [ ] `capture.bundleHash`
  - [ ] `capture.sessionUuid`
  - [ ] `capture.wallclockUtc`
  - [ ] `capture.source`
- [ ] `capture.source ∈ { live-injector, live-accessibility, live-merged }`
- [ ] `capture.sessionUuid` 与 `SESSION_DIR` 目录名一致
- [ ] matrix 输入的 runtime inventory 全部位于 `RUNTIME_DIR/`
- [ ] `RUN_RECORD` 记录 `SOURCE_MAP` 的 `path/hash/mtime`
- [ ] `RUN_RECORD` 记录 `EXTRACTION` 的 `path/hash/mtime`
- [ ] `RUN_RECORD.frozenBaselines` 记录 whitelist / allowlist 的 `path/hash/mtime`

### 失败条件

- runtime gate 读取 `CACHE_ROOT` 根目录 runtime inventory
- inventory 缺少 provenance 字段仍能过
- `capture.source` 命中 `repo-fixture` / `ci-workflow-fixture` / 其他非 live 来源
- 通过“自动扫 cache 根目录”发现输入，而不是绑定当前 `SESSION_DIR`

### BLOCKED 语义

- 无 live Cavalry 时，允许输出 `BLOCKED-NO-LIVE-CAVALRY`
- `BLOCKED` 不是 `PASS`
- 不允许为了让 CI 或本机变绿而造 fixture

---

## §P5 — Forbidden-Translation Patterns

### 适用范围

- runtime inventory
- compiled source-map / audit result
- `tools/{zh-Hans,zh-Hant,ja_JP}.ts`
- derived injector translation output `desktop-patcher/injector/generated_translations.inc`
- `languages/<lang>/**.json`

### Forbidden Pattern Set

| ID | 模式 | 说明 |
| --- | --- | --- |
| FP-1 | `（译）` / `（訳）` / `（譯）` | 占位标记 |
| FP-2 | `[\uFF21-\uFF3A\uFF41-\uFF5A]` | 全角拉丁字母 |
| FP-3 | `^(?:页|頁|ページ):?\d+$` | 错位填词 |
| FP-4 | zh-Hant 中出现典型简体字符 | 简繁串味 |
| FP-5 | zh-Hans 中出现典型繁体字符 | 繁简串味 |
| FP-6 | source 与 translation 构成自我递归伪条目 | 伪翻译 |

### 通过条件

- [ ] detector 作为独立模块存在，并被 preflight / runtime / JSON gate 共同调用
- [ ] 命中任一 FP 时，gate hard-fail
- [ ] `RUN_RECORD` 为每语保留 `forbiddenPatterns.total`、`byPattern`、`samples`
- [ ] archive 污染样本全部命中 fail，干净 main 样本零误报

### 失败条件

- §P5 仅 warn 不 fail
- detector 被上游 reader 旁路
- root cache inventory 命中 FP 但仍被当作有效输入

---

## Whitelist Charter

### 合法来源

`tools/translation-whitelist.json` 与 `tools/runtime_ui_allowlist.json` 只允许表达 glossary / no-translate 事实：

- [ ] 品牌名
- [ ] 标准缩写
- [ ] 变量名 / 文件格式 / API 名
- [ ] Cavalry 专有术语
- [ ] glossary 明确声明保留英文的条目

### 修改流程

- [ ] 先修改 `doc/cavalry-glossary.md` 或 `doc/cavalry-glossary-en-zh.md`
- [ ] 再由 derive 脚本生成 whitelist / allowlist
- [ ] diff 必须经独立审阅
- [ ] `RUN_RECORD.frozenBaselines` 记录 whitelist / allowlist 的 path/hash/mtime

### 污染定义

- 无 glossary 出处的 whitelist 条目 = 污染
- 临时加入正则掩盖真实漏翻 = 污染
- 为当前 run 通过而直接手改 whitelist JSON = 污染

---

## G0 — Measurement Integrity Gate

### 通过条件

- [ ] `npm run test:desktop` 通过
- [ ] full-ui 相关阈值全部为 `100`
- [ ] JSON validator threshold 为 `1.00`
- [ ] `check:full-ui` 显式绑定当前 `SESSION_DIR`
- [ ] runtime gate 拒绝语言不匹配、过期、空 capture、空 widget/panel 输入
- [ ] gate 定义文件视为 frozen-by-default：
  - [ ] `tools/verify_gate_inputs.js`
  - [ ] `tools/check_full_ui_coverage.js`
  - [ ] `tools/check_runtime_ui_coverage.js`
  - [ ] `tools/check_full_ui_matrix.js`
  - [ ] `tools/extract_compiled_ui_strings.js`
  - [ ] `tools/validate_translations.py`
  - [ ] `tools/merge_runtime_inventory.js`

### 失败条件

- runtime gate 在没有 provenance 的情况下继续算 coverage
- matrix 默认从隐式 cache 路径读输入
- `RUN_RECORD` 缺少 blocker、artifact provenance 或 blocked reason

---

## G1 — JSON Surface 100 Gate

### 通过条件

- [ ] `python3 tools/validate_translations.py ...` exit `0`
- [ ] `coverage_threshold = 1.00`
- [ ] JSON 分母来自 `EXTRACTION` 中的 JSON `englishLeaves`
- [ ] 三语全部满足：
  - [ ] `coverage_pct = 100.00%`
  - [ ] `exact_english_translate_leaves = 0`
  - [ ] `english_residue_count = 0`
  - [ ] `placeholder_issue_count = 0`
  - [ ] `structure_issue_count = 0`
  - [ ] `no_translate_issue_count = 0`
  - [ ] `locale_sync_issue_count = 0`
  - [ ] `purity_issue_count = 0`
- [ ] §P5 命中数为 0

### 失败条件

- 仍以 `jsonValidation.pass` 代替 `coverage_pct = 100`
- 仍允许 97-98% 作为“接近完成”

---

## G2 — Compiled Surface 100 Gate

### 通过条件

- [ ] `compiledUiTargets` 至少包含：
  - [ ] `Contents/MacOS/Cavalry`
  - [ ] `Contents/Frameworks/libCavalryUI.dylib`
  - [ ] `Contents/Frameworks/libCavalryFramework.dylib`
  - [ ] `Contents/Frameworks/libExtensionLayer.dylib`
- [ ] extractor 是 raw extraction，不依赖 curated keep-list
- [ ] noise filter 仅为声明式排除规则，并记录 audit
- [ ] `SOURCE_MAP` 在 `RUN_RECORD` 中带 `path/hash/mtime`
- [ ] compiled 分母来自 `EXTRACTION` 中的 compiled `englishLeaves`
- [ ] compiled coverage 三语全部 `100`

### 失败条件

- owner map 漏掉 `libExtensionLayer.dylib`
- 通过 curated corpus 定义输出边界
- matrix 读取了不属于当前 `RUN_RECORD` 的 source-map

---

## G3 — Runtime Surface 100 Gate

### 通过条件

- [ ] runtime gate 强制先过 G-P / §P5
- [ ] merged inventory 只能是 `RUNTIME_DIR/<lang>-merged-inventory.json`
- [ ] 合法输入来自：
  - [ ] injector inventory
  - [ ] Accessibility inventory
- [ ] merged inventory 的 `capture.source = live-merged`
- [ ] AX live walking 覆盖 menu / submenu / panel title / tab / placeholder / tooltip / status / empty-state
- [ ] inventory 数量下界不足时输出 `WEAK-CAPTURE` 并 fail
- [ ] runtime 分母来自 `EXTRACTION` 中的 runtime `englishLeaves`
- [ ] `node tools/check_runtime_ui_coverage.js --inventory $RUNTIME_DIR/<lang>-merged-inventory.json --threshold 100` 三语通过

### 失败条件

- 使用根目录 runtime inventory
- 仅因为“注入后快照里没英文”就宣称 100
- 用 fixture 字段满足 widget coverage

---

## G4 — Three-Language Matrix 100 Gate

### 通过条件

- [ ] `node tools/check_full_ui_matrix.js --threshold 100 ...` exit `0`
- [ ] `RUN_RECORD.overallPass = true`
- [ ] 三语全部 `pass = true`
- [ ] 每语保留：
  - [ ] `runtime`
  - [ ] `compiled`
  - [ ] `jsonValidation`
  - [ ] `forbiddenPatterns`
  - [ ] `provenance`
- [ ] `RUN_RECORD` 记录：
  - [ ] `sessionUuid`
  - [ ] `runtimeDir`
  - [ ] `sourceMap.path/hash/mtime`
  - [ ] `extractionInventory.path/hash/mtime`
  - [ ] `frozenBaselines`
  - [ ] `blockedReason`（若 blocked）

### 失败条件

- 单语通过即宣称完成
- `RUN_RECORD` 只有百分比，没有 artifact provenance / blocker 明细
- 在无 live Cavalry 时输出 `pass=true`

---

## Final Semantics

- 任意 gate 不是 PASS → **`NOT COMPLETE`**
- 全部 gate PASS，且 `RUN_RECORD` 带完整 artifact provenance 与 frozen denominator → **`ALL GATES PASS`**
