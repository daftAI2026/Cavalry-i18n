<!--
[INPUT]: 依赖本次审计结论、Acceptance.md 的规范口径、Anti-Patterns.md 的历史绕过证据
[OUTPUT]: 对外提供 Cavalry Full UI 100% workflow 的项目宪法与当前实现真相
[POS]: full-ui-100 工作流总协议
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Project — Cavalry Full UI 100% 项目宪法

---

## Goal

本 workflow 的唯一目标是：

> **让 Cavalry 在 `zh-Hans` / `zh-Hant` / `ja_JP` 三个目标语言下，达到 provenance-verified, whitelist-based Full UI 100%。**

这里的 Full UI 包含三类 surface：

1. JSON 资产
2. compiled UI owner map
3. live runtime UI

---

## Current Workflow Rule

本 workflow 是当前唯一执行口径，不再用历史编号命名当前方案。

解释：

- 当前规范以 `Acceptance.md` 为准
- 当前执行纪律以 `Runbook.md` 为准
- 当前任务与实现缺口以 `TODO.md` 为准
- 当前 gate 勾选状态必须回写到 `Acceptance.md`
- 历史事故只在 `Anti-Patterns.md` 中按反模式归档

不再允许以下混写：

- 规范与当前代码真相混写
- repo 代码状态与本机 cache 产物混写
- root-cache 与 session-scoped artifact contract 混写

补充追踪纪律：

- `Acceptance.md` 负责记录“哪些规范条件已在当前分支成立”
- 本文件负责记录“代码现在实际上做到哪里、还差什么”
- 二者必须同步维护，不能一个更新另一个不动

---

## Authoritative Artifact Model

规范口径见 `Acceptance.md`，这里仅总结唯一 contract：

```text
runtime truth source  = SESSION_DIR/runtime/*
session run record truth source = SESSION_DIR/full-ui-run-record.json
run note truth source = REPO/docs/workflows/cavalry-full-ui-100/runs/*.md
source-map truth source = ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json
extraction truth source = SESSION_DIR/extraction-inventory.json
```

补充规则：

- root cache 下的 runtime inventory / merged inventory / session run record **不是**真相源
- compiled source map 目前仍位于 cache root，但必须显式绑定并记录 provenance
- `tools/translation-whitelist.json` 是唯一 whitelist 契约路径
- `extraction-inventory.json` 是 G1/G2/G3/G4 的唯一分母来源
- target identity 是分母的一部分：Cavalry version / Qt version / bundle hash 变化时，旧 denominator 立即失效

---

## Build / Shell Boundary

本 workflow 遵守 `docs/LOCAL_BUILD_SOP.md`：

- 默认发布路径是 **Tauri**。
- 标准打包入口是 `npm run build:tauri`；不得用裸 `npm run build` 或任何旧壳层 build 入口替代。
- 旧壳层发布流程只作为历史证据；不再作为 fallback 或 baseline。
- 本 workflow 不新增、不修复、不扩展旧壳层、builder 或 harness。

允许触碰的边界：

- `renderer/`：Tauri 仍复用的 UI 真相源。
- `injector/`：Cavalry runtime 翻译注入链路。
- active contract 已使用 Tauri-only 命名；若历史断言仍有 full-ui 价值，只能迁移到 Tauri / full-ui gate。

---

## Current Code Truth / Implementation Gap

> **这一章描述“代码今天实际上是什么样”，不是规范。**

当前仓库应被描述为：

```text
Baseline is rerunnable and reachable.
Current repo state: ALL GATES PASS (2026-05-14, reverified).
First next gate: none for current target identity; version drift requires a new capture/freeze/matrix cycle.

Historical verified evidence retained:
  - W-AUDIT / G-P / G-CAPTURE / G-X / G0 / G1 / G2 / G3 / G4 have current evidence from session 85495ECF-FE09-4BA5-8877-0DD9579B7D7A.
  - Target identity is Cavalry 2.7.2 / Qt 6.6.3 / bundleHash 5a9860b96d398922f49e90d73819a02027c4862960b118d56619229b7810eb5d.
  - Cleaned frozen denominator is JSON 6286 + compiled 3141 + runtime candidates 617 / menuLeaves 730 from session 85495ECF.
  - 2.7.1 session BC5BF821 evidence is historical only.

Current blockers:
  - None.
  - The current PASS is runs/2026-05-14-2.7.2-reverification.md.
```

### 当前 worktree 真相

**执行工作树**
- 路径：`/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n`
- 分支：`wip/cavalry-full-ui-100-g-capture`
- 关键代码提交：`3882b80 feat(full-ui): translate cleaned full ui denominator`（最终文档提交在其后）
- 主仓库只承载 workflow 文档与 run note；代码改动不得漏回 main。

**已落地的 G-CAPTURE 工具链片段**
- `tools/build_translator_injector.sh` 已加入 `@rpath`、ad-hoc 重签与 `linker-signed` 检查。
- `tools/launch_cavalry_with_injector.sh` 已支持 `sessionDir/sessionUuid/cacheRoot`，并生成 `audit/codesign-evidence.txt`。
- `injector/CavalryTranslatorInjector.mm` 已支持 `CAVALRY_I18N_LANG=en` dump-only，并写 `SESSION_DIR/runtime/<lang>-injector-inventory.json`。
- `tools/capture_accessibility_inventory.js`、`tools/merge_runtime_inventory.js`、`tools/run_live_full_ui_matrix.js` 已存在。
- `package.json` 的 full-ui/runtime npm scripts 已收敛到 `SESSION_DIR/runtime/*-merged-inventory.json`，不再读取 root-cache runtime inventory。
- `tools/validate_translations.py` 在 `.ts` 与 `generated_translations.inc` 扫描中保留 context，FP-8 fake Qt context 不再被解析层丢弃。

**历史失败证据（仅作反向回归，不再描述当前状态）**
- session `21B1048E-963E-43B1-975B-0C506902E0EB` 只有 codesign evidence，没有 `runtime/en-injector-inventory.json`。
- `audit/en-injector-launch.log` 为空，未看到 injector bootstrap。
- 没有 amfid / kernel 拒绝证据；不得写 `BLOCKED-SIP`，不得建议 `csrutil disable`。
- 这些记录说明弱 capture 不能冻结分母；当前可引用的 capture/freeze/matrix 证据以 session `DD7733E9-C414-4760-83A3-BC8EC8DEF8D3` 为准。

详见：
- `runs/2026-04-30-G-CAPTURE-DYLIB-INJECTION-INVESTIGATION.md`
- `runs/2026-04-30-G-CAPTURE-TECHNICAL-BLOCKER-ANALYSIS.md`
- `runs/2026-04-30-G-CAPTURE-WORKTREE-STATE-CORRECTION.md`

### 已确认的实现缺口

0. **workflow 顺序存在依赖倒置，已改为先 capture 后 freeze**
   - 正确原则仍是“完整抓取英文分母后才允许翻译”
   - 原顺序把 G-X 放在 runtime capture toolchain 前，导致 `WEAK-CAPTURE` 被误当成外部阻塞
   - 新顺序为 `W-AUDIT -> G-P -> §P5 -> G-CAPTURE -> G-X -> G0 -> G2 -> G3 -> G1 -> 翻译 backlog -> G4`

1. **provenance / §P5 recovery 已重跑**
   - 2026-05-01 之后 detector 集合升级为 FP-1/2/3/4/5/7/8/9
   - 2026-05-05 已证明 current HEAD FP-7/8/9 = 0，quarantine 伪造样本必命中 FP-7/8/9
   - 历史 Frankenstein FP-9 残留已在 JSON / TS / generated assets 中清零，不是 2026-05-01 伪造分母回流

2. **extraction inventory schema 已补齐，后续只剩版本漂移重抽纪律**
    - `SESSION_DIR/extraction-inventory.json` 已冻结 JSON / compiled / runtime 分母
    - 当前 artifact 顶层已有 `target.cavalryVersion` / `target.qtVersion` / `target.bundleHash` / `target.appPath`
    - Cavalry 2.7.1 目标已确认，2.7.0 的 source-map / extraction / runtime run record 只能作为历史证据

3. **runtime capture 弱输入已硬失败**
   - active runtime gate 已不再只依赖 `/[A-Za-z]/`；`（译）/（訳）/（譯）`、全角拉丁与 `页:1/頁:1/ページ:1` 现在会进入 blocker
   - `run_live_full_ui_matrix.js` 会解析 launcher `PID=<number>`，缺 PID 或 candidates/menuLeaves 低于下界时 hard-fail `WEAK-CAPTURE`
   - AX 菜单抓取 audit 已记录 `menuDepthMax` 与 submenu path samples 的机器化证据

4. **JSON / full-ui gate 当前无 blocker**
   - active threshold 已冻结到 full-ui `100` / JSON `1.00`
   - G1 JSON validator PASS，G2 compiled PASS，G3 runtime PASS，G4 matrix PASS

5. **compiled owner map contract 当前下界已重新验证并清洗**
   - `libExtensionLayer.dylib` 已并入 compiled target contract
   - 当前 Cavalry 2.7.1 cleaned compiled denominator 是 3190；旧 5195 raw extraction 仅作历史

6. **active gate / CI 执行路径仍有后续 gap**
    - `check:full-ui` 已前置 `tools/verify_gate_inputs.js`，W-AUDIT 红旗已转为脚本/测试约束
    - workflow 已改为当前单一规范
    - README / 普通说明文案推迟到最终收尾统一更新，不阻塞当前实现阶段
    - `.github/workflows/build.yml` 只有实际执行 gate / 打包 / artifact 绑定时才属于本 workflow 工作面

### workflow 外 implementation gap（点名到文件）

以下是当前已知、仍停在旧口径的 workflow 外实现缺口：

1. **脚本入口**
   - `package.json` 的 active full-ui/runtime coverage scripts 已使用 `SESSION_DIR/runtime/*`
   - `package.json` 已移除 `--threshold 99`，并让 `check:full-ui` 前置 `tools/verify_gate_inputs.js`

2. **runtime / full-ui gate**
   - `tools/check_runtime_ui_coverage.js` 已拦截 FP-1/FP-2/FP-3，但 provenance / freshness / blocked 语义仍未闭环
   - `tools/check_full_ui_coverage.js` 仍未把 `coveragePct == 100` 与 `exact_english_translate_leaves == 0` 变成硬条件
   - `tools/check_full_ui_matrix.js` 仍是 root-cache reader / 弱 session-run-record schema

3. **JSON validator**
   - `tools/validate_translations.py` 已升到 `1.00`；G1 当前以 frozen denominator / exact-English / forbiddenPatterns=0 通过

4. **injector / launch chain**
    - `injector/CavalryTranslatorInjector.mm` 已写 session-scoped `<lang>-injector-inventory.json`，但本轮 launch 没产出该文件
    - `tools/launch_cavalry_with_injector.sh` 已传递 `sessionDir/sessionUuid/cacheRoot`，但仍需证明 injector constructor 实际执行
    - `tools/run_live_full_ui_matrix.js` 通过 launcher 捕获真实 PID，缺 PID 或弱抓取会失败
    - live injector English probe 代码上已有 dump-only 分支，但还没有被本轮 artifact 证明

5. **runtime merge / matrix 工具**
   - `tools/merge_runtime_inventory.js` 已存在，但只有 injector 与 AX 两份 live inventory 都存在时才可形成 `live-merged`
   - `tools/run_live_full_ui_matrix.js` 已存在，run record 由 G-X freeze 补齐 target / extraction provenance

6. **CI 执行入口**
    - `.github/workflows/build.yml` 若接入 full-ui gate，必须使用 session-dir / provenance / blocked 语义
    - `.github/workflows/build.yml` 的实际打包步骤必须使用 `npm run build:tauri`，而不是裸 `npm run build`
    - `.github/workflows/build.yml` 若绑定 full-ui artifacts，不得引用不存在的 `docs/compiled-ui-source-map.json` 与 `docs/translation-whitelist.json`
    - 旧壳层 build / harness 已删除；只允许收敛到 Tauri SOP 或迁移其仍有价值的断言

### 已核实语言来源

以下数字由 2026-05-14 在本机重新核实。它们是当前 cleaned denominator 来源地图。

| Surface | Evidence | Count |
| --- | --- | ---: |
| JSON `languages/en/appStrings.json` | Cavalry 2.7.2 app bundle lower bound | 10 |
| JSON `languages/en/nodeStrings.json` | cleaned repo English baseline | 6191 |
| JSON `languages/en/onboarding.json` | repo English baseline | 34 |
| JSON `languages/en/tips.json` | repo English baseline | 51 |
| JSON total | cleaned frozen denominator | 6286 |
| compiled source map | cleaned frozen denominator from `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json` | 3136 |
| compiled excluded leaves | §F extraction filters | 2052 |
| runtime observed candidates | session DD7733E9 merged inventories | 625 |
| runtime denominator candidates | session DD7733E9 extraction inventory | 616 |
| runtime menuLeaves | session DD7733E9 extraction inventory | 730 |
| current `.ts` translation container | `tools/{zh-Hans,zh-Hant,ja_JP}.ts` in main branch | 5989 translate leaves per language |

规则：每轮仍必须重新 live capture、写 provenance、再冻结 `extraction-inventory.json`。当前完整分母必须同时包含 JSON 6286、compiled 3136 与 runtime live surface 616 / 730。

### Deferred Documentation Cleanup

以下内容不阻塞当前阶段：

- `README.md` 中关于 `>=99%`、root-cache runtime、旧 build 入口的说明
- 归档文档、聊天记录、历史 run note 中的旧数字
- 不参与实际 gate / 打包执行的 CI 注释或说明性文案

这些只在 `ALL GATES PASS` 前的最终收尾中统一更新，避免当前阶段把精力耗在宣传文本上。

### 关于本机 cache 的规则

- 本机 cache 产物只能作为“污染证据”或“实现现状样本”
- 不能直接写入规范章节
- 不能被描述成“当前已验证基线”

---

## Baseline Recording Rule

从本文件起，基线只允许以两种形式写入文档：

1. **规范事实**：长期有效的 contract / pass-fail 语义
2. **带出处的当前真相**：必须同时给出
   - 日期
   - commit / branch
   - artifact path
   - provenance 说明
   - run note / session run record / 审计出处

如果缺上述上下文，就不要写具体百分比、条数、语言矩阵结果。

---

## What Counts as 100%

`100` 的分母不是所有英文字符，而是 **whitelist-filtered required UI surface**：

```text
required_surface = all_detected_ui_strings - allowed_by_whitelist - allowed_by_glossary - no_translate_terms
pass = required_surface translated with zero forbidden patterns and valid provenance
```

| Surface | 完成标准 |
| --- | --- |
| runtime / compiled / matrix | `100` |
| JSON validator | `1.00` |

只有以下英文允许保留：

- glossary / whitelist 明确允许的品牌名
- 标准缩写
- no-translate 专业术语

不允许：

- 菜单英文
- 面板 / 子窗口英文
- placeholder / tooltip / status 英文
- 半翻译混合体
- 被 allowlist 掩盖的真实漏翻

---

## Completion Semantics

- 当前 workflow 当前结论：**`ALL GATES PASS`**
- 只有当 `W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0 + G2 + G3 + G1 + G4` 全 PASS 时，才允许写 **`ALL GATES PASS`**

任何“某个 surface 已明显提升”“某语已过”“CI 先 blocked”都不是完成。

## Current Gate Status

**Current workflow state: `ALL GATES PASS`**

| Gate | Current status | Why |
| --- | --- | --- |
| W-AUDIT | PASS | weak threshold / preflight / libExtensionLayer red flags have code evidence |
| G-P | PASS | session 85495ECF runtime artifacts are session-scoped and preflight rejects root-cache / fixture / curated inputs |
| §P5 | PASS | 当前 HEAD 0 hit；FP-13 sourceText fix verified |
| G-CAPTURE | PASS | session 85495ECF live merged capture, 625 observed candidates / 730 menu leaves |
| G-X | PASS | runs/2026-05-14-2.7.2-reverification.md；新分母 JSON 6286 / compiled 3141 / runtime candidates 617 / menuLeaves 730 |
| G0 | PASS | `npm run test:contracts` passes and workflow contracts pass after reverify |
| G1 | PASS | JSON validator exits 0 with 100% coverage and forbiddenPatterns total 0 for all three languages |
| G2 | PASS | compiled coverage 三语 100%，0 untranslated，FP-1..12 = 0 |
| G3 | PASS | runtime coverage 三语 100%，0 untranslated，runtime forbiddenPatterns = 0 |
| G4 | PASS | `SESSION_DIR=... npm run check:full-ui` overallPass=true / blockedReason=null |

### Verified Session Data

- **Session**: 85495ECF-FE09-4BA5-8877-0DD9579B7D7A
- **Target**: Cavalry 2.7.2, Qt 6.6.3
- **Bundle hash**: `5a9860b96d398922f49e90d73819a02027c4862960b118d56619229b7810eb5d`
- **Extraction inventory**: `bbbeb66e1e73a8308fadb23c3ba5c6392aaf312352957d0b55bf7c31e777878f`
- **Runtime capture**: live merged, 617 denominator candidates / 625 observed candidates / 730 menu leaves

### Translation Resource Gap

**Compiled UI:**
- Current matrix: ja_JP 100%, zh-Hans 100%, zh-Hant 100% compiled coverage
- Sources: Contents/MacOS/Cavalry, libCavalryUI.dylib, libCavalryFramework.dylib, libExtensionLayer.dylib

**Runtime UI (G3):**
- Current matrix: ja_JP 100%, zh-Hans 100%, zh-Hant 100% runtime coverage
- Sources: Animation nodes, shader nodes, interactive UI elements

### Next Steps for Completion

No current completion step remains. On target drift, restart from capture/freeze with a new session and treat old artifacts as history.
