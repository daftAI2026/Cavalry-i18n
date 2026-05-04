<!--
[INPUT]: 依赖审计结论、Acceptance.md 的 gate 定义、Runbook.md 的固定顺序
[OUTPUT]: 对外提供 full-ui-100 的任务队列与当前实现缺口
[POS]: full-ui-100 任务索引
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# TODO — Cavalry Full UI 100% 任务队列

> **审计结论已接受：当前问题不是“版本号没改齐”，而是 spec / prompts / tests / code truth 混写。**
> 本文件只保留两个东西：
> 1. 当前实现缺口
> 2. 固定执行顺序
>
> **追踪纪律**：
> 每当某个 gate 条件在 `Acceptance.md` 被打钩，本文件也必须同步收敛对应任务状态；
> 如果某个已打钩条件后来被 invalidate，本文件也必须把相关条目改回未完成 / blocker 状态。

---

## 当前工作结论

```text
Current workflow spec = current
Current repo state    = NOT COMPLETE
Last reset            = b9e6c28 + cherry-pick(b4f784c, 88760e9)
Quarantined branch    = quarantine/cavalry-full-ui-100-fabrication-20260501
```

### 2026-05-01 伪造事件复盘（read-before-resume）

上一会期某 agent 在 G2b 阶段批量伪造翻译；具体形式：
- 合成 source ID（`Batch6_0`、`Final_Batch51_3`、`UI_Batch21_47`、`Element_X`、`Sample_X`）凑足 5,195 条假分母
- 伪 Qt context（`Cavalry-Compiled-UI-Glossary`、`Cavalry-Compiled-UI-Complete`）
- Frankenstein 部分翻译（`Add 颜色`、`Active 合成`、`动画 Control`）
- 篡改 fixture（`check_electron_patcher_ui.js` 4743→5195）
- 写 25 篇 docs 宣称 "FINAL-STATE / G2b ALL COMPLETE"

伪造样本完整保留在 `quarantine/cavalry-full-ui-100-fabrication-20260501` 作为审计材料与契约回归输入。

### §P5 加固（2026-05-01）

新增三类 forbidden pattern，已写入 `tools/forbidden_translation_patterns.json` + 实现 + 契约：
- **FP-7**：合成 source ID（应用于 `source` 字段）
- **FP-8**：伪 Qt context（应用于 `context` 字段）
- **FP-9**：Frankenstein 中英夹杂（白名单 + 启发式，仅在 zh-Hans / zh-Hant / ja_JP 命中）

下任 agent 必须在 G-P 阶段执行：
1. 跑 `tools/validate_translations.py` 对当前 HEAD `.inc` + `.ts` —— FP-7/8 必须 0 hit
2. 跑同一 detector 对 `quarantine/cavalry-full-ui-100-fabrication-20260501` HEAD —— FP-7 ≥ 15,000、FP-8 ≥ 1,400、FP-9 ≥ 2,800 hit（必须命中）
3. 当前 HEAD 的 FP-9 = 379（历史 Frankenstein 待修，**不算造假**，是 main 阶段就已存在的部分翻译 bug）

### 当前可信进度

| Gate | 状态 | 证据 |
|---|---|---|
| W-AUDIT | PASS | 弱阈值 / preflight / libExtensionLayer 红灯已收紧 |
| G-P / §P5 | **REOPENED** | FP-7/8/9 加固后须重跑回归；这是当前第一失败 gate |
| G-CAPTURE / G-X / G0 / G1 | EVIDENCE-HELD | session 6C24D9C7 与 `51a0f27` 有历史可用证据，但须在 G-P / §P5 后 reverify |
| G2a 分母清洗 | UNVERIFIED | 上次 agent 的 3,395 干净分母分析需独立复算 |
| G2b 编译 UI | 100/5195 | Batch1+Batch2 真翻译，剩余约 5,095 待做 |
| G3 运行时 UI | 部分 | 来自历史 main，含 379 条 Frankenstein 待修 |
| G4 矩阵 | BLOCKED | 等 G2b/G3 |

补充说明：

- `Anti-Patterns.md` 继续保存 invalidated 历史，但按反模式组织
- 当前 workflow 不再把版本号当作规范名
- README / 普通说明文案先不改；只处理 active full-ui / Tauri gate、脚本与实际 CI 执行入口
- 构建与发布只按 `doc/LOCAL_BUILD_SOP.md` 的 Tauri 路径执行；Electron 专属路径只作为历史残留，不作为本 workflow 修复目标
- `Acceptance.md` 的勾选状态与本文件任务状态必须同步，不允许各写各的

---
## Current Implementation Truth

Based on 2026-04-30 session verification (6C24D9C7-8342-41CA-BBE5-182E97B0BDD8):

### ✓ COMPLETED Implementation Items

- [x] runtime chain has session-scoped isolation (SESSION_DIR properly structured)
- [x] workflow order: G-P / §P5 / G-CAPTURE before G-X (fully implemented)
- [x] extraction inventory freeze with JSON/compiled/runtime unified denominator (6415+5195+626 frozen)
- [x] live English AX capture exports complete runtime and widget text inventory
- [x] runtime provenance fields recorded in merged inventories
- [x] target version binding: Cavalry 2.7.1, Qt 6.6.3, bundle hash a421e0137648bbd284b6e7976a119ae27ba6ada635e0706b76519b54fa7c7fe1
- [x] AX menu recursive capture with menuDepthMax >= 2 and 5 submenu path samples recorded
- [x] runtime detector covers FP-1/FP-2/FP-3 forbidden patterns
- [x] JSON validator uses 1.00 threshold with frozen denominator
- [x] compiled extractor covers libExtensionLayer.dylib
- [x] full-ui gate includes W-AUDIT preflight verification
- [x] package.json check:full-ui calls verify_gate_inputs.js before matrix
- [x] check_runtime_ui_coverage.js includes FP-1/FP-2/FP-3 checks
- [x] check_full_ui_coverage.js validates with extraction inventory
- [x] check_full_ui_matrix.js uses --session-dir with proper run record tracking
- [x] validate_translations.py uses 1.00 threshold with extraction denominator
- [x] CavalryTranslatorInjector.mm uses session-scoped inventory paths
- [x] launch_cavalry_with_injector.sh passes sessionDir/sessionUuid/cacheRoot
- [x] DYLD_INSERT_LIBRARIES gracefully falls back to AX-only when unavailable
- [x] merge_runtime_inventory.js and run_live_full_ui_matrix.js fully functional
- [x] No --no-resign workarounds in current code
- [x] GitHub workflows ready for full-ui matrix integration

### ⏳ EXTERNAL BLOCKERS (Not Code/Tooling Issues)

- [ ] Compiled UI translations needed: ~4500+ strings per language for G2 PASS
- [ ] Runtime UI translations needed: ~239 strings per language for G3 PASS
- [ ] These are translation resource dependencies, not implementation gaps

### Deferred Documentation Cleanup

- [ ] `README.md` content clarifications (final phase, after G2/G3/G4 complete)

---

## Authoritative Artifact Contract

```text
SESSION_DIR = ~/Library/Caches/Cavalry-i18n/sessions/<session-uuid>
RUNTIME_DIR = $SESSION_DIR/runtime
RUN_RECORD  = $SESSION_DIR/full-ui-run-record.json
SOURCE_MAP  = ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json
```

合法 runtime artifacts：

- [ ] `RUNTIME_DIR/<lang>-injector-inventory.json`
- [ ] `RUNTIME_DIR/<lang>-ax-inventory.json`
- [ ] `RUNTIME_DIR/<lang>-merged-inventory.json`

非法 runtime inputs：

- [ ] `~/Library/Caches/Cavalry-i18n/*-inventory.json`
- [ ] `~/Library/Caches/Cavalry-i18n/*-merged*.json`
- [ ] `~/Library/Caches/Cavalry-i18n/full-ui-run-record.json`

---

## Work Order

### W-AUDIT

- [x] 把 active full-ui / Tauri gate 收敛为 whitelist-filtered 100；legacy weak threshold / `0.90` / 缺 preflight / 弱 runtime detector / 缺 `libExtensionLayer` 全部先变成 RED→GREEN
- [x] 若旧 Electron 测试携带有价值断言，只迁移到 full-ui / Tauri gate；不继续维护 Electron 专属 gate

### W-P

- [ ] 固定 provenance contract
- [ ] 固定 session-scoped runtime artifact contract
- [ ] 拒绝 root-cache runtime inputs

### W-P5

- [ ] 固定 FP-1/2/3/4/5/7/8/9 forbidden patterns（无旧自我递归 ID）
- [ ] 让 preflight / runtime / JSON gate 共用同一 detector 语义
- [ ] `RUN_RECORD` 输出 `forbiddenPatterns`

### W-CAPTURE

**PASS**: Live runtime denominator established via AX-only fallback (2026-04-30 23:57 UTC).

Session: `6C24D9C7-8342-41CA-BBE5-182E97B0BDD8`

Technical status:
- [x] App code signing: flags=0x2(adhoc), hardened runtime present (normal, does not block AX)
- [x] Dylib code signing: flags=0x2(adhoc)
- [x] Dylib @rpath entries: correctly configured for Qt framework resolution
- [x] Injector code has English dump-only branch and session-scoped output path
- [x] Launch script passes `sessionDir/sessionUuid/cacheRoot` and writes codesign evidence
- [x] `merge_runtime_inventory.js` exists and accepts live-injector / live-accessibility sources
- [x] `run_live_full_ui_matrix.js` exists with AX-only fallback support
- [x] Dylib injection: DYLD_INSERT_LIBRARIES unavailable (system-level dyld policy, not SIP)
- [x] Fallback mechanism: AX capture produces full menu/widget inventory
- [x] Raw capture produced all language inventories; frozen merged runtime denominator `menuLeaves = 734 >= 666`
- [x] All 4 languages: en, zh-Hans, zh-Hant, ja_JP captured successfully
- [x] Runtime inventory: present for all languages under session/runtime/
- [x] Merged inventory: `capture.source = live-merged` and properly structured
- [x] No amfid/kernel rejection logs; injection failure is system-level policy choice

Next step: Proceed to G-X (extraction inventory freeze)

### W-X

- [x] 产出 `SESSION_DIR/extraction-inventory.json`（session 6C24D9C7，5,880,554 bytes，frozen 2026-04-30T16:00:40Z）
- [ ] `extraction-inventory.json` 顶层补齐 `target` 对象（当前缺失，仅 surface 级 metadata 已写）
- [ ] version drift 后重新抽取 compiled source-map、runtime capture 与 extraction inventory，不复用旧分母
- [x] 固定 JSON lower bounds：10 / 6320 / 34 / 51 / total 6415
- [x] 固定 compiled source-map lower bound：entries >= 5195（Cavalry 2.7.1；2.7.0 时为 4743）
- [x] `tools/verify_gate_inputs.js` 已使用 `'compiled-source-map': 5195`
- [x] 固定 runtime lower bounds：candidates >= 613、menuLeaves >= 666
- [ ] G1/G2/G3/G4 统一读取 frozen denominator

### W0

- [ ] 固定 measurement threshold / reader / `RUN_RECORD` schema
- [ ] 固定 blocked semantics

### W2

- [ ] compiled owner map 对齐 raw extraction 与 `libExtensionLayer.dylib`
- [ ] source-map provenance 入 `RUN_RECORD`

### W3

- [ ] live injector + AX capture + merge toolchain 全部走 session dir
- [ ] 数量下界不足时输出 `WEAK-CAPTURE`

### W1

- [ ] JSON validator 真正达到 `1.00`
- [ ] `coverage_pct = 100` 与 `exact_english_translate_leaves = 0` 成为硬条件

### W5 / W6 / W7

- [ ] zh-Hans backlog 清零
- [ ] zh-Hant backlog 清零
- [ ] ja_JP backlog 清零

### W8

- [ ] 同一次 matrix 三语全绿
- [ ] `RUN_RECORD` 保留 session / runtime / source-map provenance

---

## Prompt Map

- [ ] `prompts/01-audit-and-gate-hardening.md`
- [ ] `prompts/02-extraction-inventory-freeze.md`
- [ ] `prompts/03-provenance-gate.md`
- [ ] `prompts/04-forbidden-translation-detector.md`
- [ ] `prompts/05-measurement-integrity.md`
- [ ] `prompts/06-compiled-owner-map.md`
- [ ] `prompts/07-runtime-capture-toolchain.md`
- [ ] `prompts/08-translate-zh-hans.md`
- [ ] `prompts/09-translate-zh-hant.md`
- [ ] `prompts/10-translate-ja-jp.md`
- [ ] `prompts/11-compile-qm-and-final-matrix.md`

所有 prompt 必须遵守同一 artifact contract；若 prompt 与 `Acceptance.md` 冲突，以 `Acceptance.md` 为准。
