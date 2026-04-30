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
```

补充说明：

- `Anti-Patterns.md` 继续保存 invalidated 历史，但按反模式组织
- 当前 workflow 不再把版本号当作规范名
- README / 普通说明文案先不改；只处理 active full-ui / Tauri gate、脚本与实际 CI 执行入口
- 构建与发布只按 `doc/LOCAL_BUILD_SOP.md` 的 Tauri 路径执行；Electron 专属路径只作为历史残留，不作为本 workflow 修复目标
- `Acceptance.md` 的勾选状态与本文件任务状态必须同步，不允许各写各的

---

## Current Implementation Truth

以下条目描述“代码当前还没跟上”的事实，不是规范：

- [ ] runtime chain 仍未形成完整 session-scoped isolation
- [ ] workflow 顺序已调整为先 G-P / §P5 / G-CAPTURE，再 G-X；代码实现仍未完全跟上
- [ ] extraction inventory freeze 尚未形成 JSON / compiled / runtime 统一分母
- [ ] Cavalry 2.7.1 app bundle 的 `appStrings.json` 比仓库 English baseline 多 6 条 GPU 文案；当前 JSON 100 只能算旧仓库分母 PASS，不是 2.7.1 current PASS
- [ ] 当前 live English AX capture 仅导出 `widgetTexts = 7`，低于 A9B11073 runtime 基线，runtime denominator 仍被 `WEAK-CAPTURE` 阻塞
- [ ] runtime provenance 字段仍未在整条链路闭环
- [ ] target version drift 规则已写入 workflow，但代码仍未把 `RUN_RECORD.target` / `EXTRACTION.target` / `SOURCE_MAP.target` 全链路硬化
- [ ] AX menu 递归抓取已有实现路径，但仍缺 `menuDepthMax` 与 submenu path samples 的机器字段
- [ ] runtime detector 已补 FP-1/FP-2/FP-3，但仍未完全达到 §P5 / freshness / blocked 口径
- [ ] JSON validator / full-ui gate 已去掉弱阈值，但仍缺 frozen denominator 与 exact-English contract 闭环
- [ ] compiled extractor / source-map contract 已覆盖 `libExtensionLayer.dylib`，但 raw extraction / provenance 口径仍未完全对齐
- [ ] active full-ui / Tauri gate 已完成 W-AUDIT 脚本硬化，但实际 CI / session-dir / provenance 对齐仍未完成

### workflow 外 implementation gap inventory

- [ ] `package.json` 仍使用 root-cache inventory 路径；`--threshold 99` 已移除，`check:full-ui` 已前置 `tools/verify_gate_inputs.js`
- [ ] `tools/check_runtime_ui_coverage.js` 已补 runtime FP-1/FP-2/FP-3 拦截，但仍未达到当前 runtime detector / provenance / blocked 口径
- [ ] `tools/check_full_ui_coverage.js` 仍未把 JSON `coveragePct == 100` 与 `exact_english_translate_leaves == 0` 设为硬条件
- [ ] `tools/check_full_ui_matrix.js` 仍未成为 `--session-dir` 驱动的 matrix reader / session-run-record owner
- [ ] `tools/validate_translations.py` 已升到 `1.00`，但 G1 下游 hard gate 仍未与 frozen denominator 对齐
- [ ] `desktop-patcher/injector/CavalryTranslatorInjector.mm` 已改为 session-scoped inventory 路径，但缺 live artifact 证明
- [ ] `tools/launch_cavalry_with_injector.sh` 已携带 `sessionDir/sessionUuid/cacheRoot`，但本轮仍未证明 injector constructor 执行
- [ ] live injector English probe 已有 dump-only 分支，但 session `21B1048E-963E-43B1-975B-0C506902E0EB` 没有产出 `en-injector-inventory.json`
- [ ] `tools/merge_runtime_inventory.js` / `tools/run_live_full_ui_matrix.js` 已存在，但 matrix 当前使用 `--no-resign` 且不能产出合格 `live-merged`
- [ ] `.github/workflows/build.yml` 若接入 full-ui matrix，必须使用 session-dir / provenance / blocked 语义，且不得引用旧 `doc/...` artifact 路径
- [ ] `.github/workflows/build.yml` 的实际打包步骤必须使用 `npm run build:tauri`，而不是裸 `npm run build`
- [ ] Electron 专属 test/build/harness 仍有历史残留；本 workflow 只迁移仍有价值的断言，不修旧 Electron 壳

### Deferred Documentation Cleanup

- [ ] `README.md` 中的 `>=99%`、root-cache runtime、旧 build 入口文案最终收尾时统一更新
- [ ] 归档文档、历史 run note、聊天记录中的旧数字不参与当前 gate

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

- [ ] 固定 6 类 forbidden patterns
- [ ] 让 preflight / runtime / JSON gate 共用同一 detector 语义
- [ ] `RUN_RECORD` 输出 `forbiddenPatterns`

### W-CAPTURE

**FAIL**: live runtime denominator not established in the current worktree.
See runs/2026-04-30-G-CAPTURE-WORKTREE-STATE-CORRECTION.md.

Technical status:
- [x] App code signing: flags=0x2(adhoc), no hardened runtime
- [x] Dylib code signing: flags=0x2(adhoc), no linker-signed
- [x] Dylib @rpath entries: correctly configured for Qt framework resolution
- [x] Injector code has English dump-only branch and session-scoped output path
- [x] Launch script passes `sessionDir/sessionUuid/cacheRoot`
- [x] `merge_runtime_inventory.js` exists and rejects non-live sources
- [x] `run_live_full_ui_matrix.js` exists
- [ ] Dylib constructor execution: not proven by current session artifact
- [ ] Runtime inventory: absent in session `21B1048E-963E-43B1-975B-0C506902E0EB`
- [ ] Matrix launcher discipline: current `run_live_full_ui_matrix.js` uses `--no-resign`; must be removed
- [ ] Runtime lower bound: candidates >= 613 and menuLeaves >= 666 not met

Remaining tasks:
- [ ] 重新实跑 launcher，禁止 `--no-resign`，保留 codesign evidence
- [ ] 若仍无 injector inventory，检查 `lipo` / `otool -L` / `otool -l` / `codesign -dv` / amfid log
- [ ] `merge_runtime_inventory.js` 用真实 injector + AX inventory 合并出 `capture.source = live-merged`
- [ ] `run_live_full_ui_matrix.js` 统一创建 session、抓取、合并、写 run record，且不绕过重签
- [ ] `RUN_RECORD.target` 记录 Cavalry version / Qt version / bundle hash / app path
- [ ] AX audit 输出 `menuDepthMax` 与 submenu path samples，证明二级/三级菜单实际被抓到
- [ ] runtime lower bound 使用 A9B11073 provenance：`candidates >= 613`、`menuLeaves >= 666`

### W-X

- [ ] 产出 `SESSION_DIR/extraction-inventory.json`
- [ ] version drift 后重新抽取 compiled source-map、runtime capture 与 extraction inventory，不复用旧分母
- [ ] 固定 JSON lower bounds：10 / 6320 / 34 / 51 / total 6415
- [ ] 固定 compiled source-map lower bound：entries >= 4743
- [ ] 固定 runtime lower bounds：candidates >= 613、menuLeaves >= 666
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
