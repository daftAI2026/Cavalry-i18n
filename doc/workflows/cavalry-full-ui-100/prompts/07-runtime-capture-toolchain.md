<!--
[INPUT]: 依赖 Acceptance.md G-CAPTURE/G3 + G-P 的 artifact contract
[OUTPUT]: 对外提供 runtime capture 工具链的 RED→GREEN 协议
[POS]: prompts 的 runtime 抓取前置步骤
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 07 — Runtime Capture Toolchain（W-CAPTURE / G-CAPTURE，后续复核 G3）

## Must Read

- `WORKFLOW/Acceptance.md` §G-CAPTURE
- `WORKFLOW/Acceptance.md` §G3
- `WORKFLOW/Acceptance.md` §Artifact Contract
- `WORKFLOW/tests/full-ui-contract.md` §G3

## Allowed Files

- `REPO/tools/capture_accessibility_inventory.js`
- `REPO/tools/merge_runtime_inventory.js`
- `REPO/tools/run_live_full_ui_matrix.js`
- `REPO/tools/launch_cavalry_with_injector.sh`
- `REPO/desktop-patcher/injector/CavalryTranslatorInjector.mm`

## Session Artifact Contract

```text
SESSION_DIR/
  runtime/
    <lang>-injector-inventory.json
    <lang>-ax-inventory.json
    <lang>-merged-inventory.json
  audit/
    <lang>-injector-capture.json
    <lang>-ax-capture.json
    <lang>-merge.json
    codesign-evidence.txt
  full-ui-run-record.json
```

`codesign-evidence.txt` 是 G-CAPTURE 声明 "SIP 阻塞" 的硬前置：必须由 `tools/launch_cavalry_with_injector.sh` 在 ad-hoc 重签之后写入，缺失即视为 SIP 误判（见 `Anti-Patterns.md` §D）。

## CLI examples

```bash
node tools/capture_accessibility_inventory.js \
  --pid $(pgrep Cavalry) \
  --language zh-Hans \
  --output ~/Library/Caches/Cavalry-i18n/sessions/<uuid>/runtime/zh-Hans-ax-inventory.json \
  --audit-log ~/Library/Caches/Cavalry-i18n/sessions/<uuid>/audit/zh-Hans-ax-capture.json

node tools/merge_runtime_inventory.js \
  --injector ~/Library/Caches/Cavalry-i18n/sessions/<uuid>/runtime/zh-Hans-injector-inventory.json \
  --accessibility ~/Library/Caches/Cavalry-i18n/sessions/<uuid>/runtime/zh-Hans-ax-inventory.json \
  --output ~/Library/Caches/Cavalry-i18n/sessions/<uuid>/runtime/zh-Hans-merged-inventory.json \
  --audit-log ~/Library/Caches/Cavalry-i18n/sessions/<uuid>/audit/zh-Hans-merge.json
```

## Rules

- runtime 读写必须只发生在 `SESSION_DIR`
- English dump-only 是必需能力：`CAVALRY_I18N_LANG=en` 时 injector 只导出英文 runtime surface，不安装翻译表
- 合并器只接受 `live-injector` / `live-accessibility`
- merged output 固定命名为 `<lang>-merged-inventory.json`
- session run record 固定写到 `SESSION_DIR/full-ui-run-record.json`
- session run record 必须写 `target.cavalryVersion`、`target.qtVersion`、`target.bundleHash`、`target.appPath`
- AX audit 必须写 `menuDepthMax` 与至少 5 条 submenu path samples；只靠源码里有递归函数不算 G-CAPTURE 证据
- runtime lower-bound provenance 使用 A9B11073：`candidates >= 613`、`menuLeaves >= 666`
- Cavalry target version / bundle hash 变化时，旧 runtime capture 全部降级为历史证据，必须重抓
- 注入路径默认走 `desktop-patcher` 生产链路：`codesign --remove-signature` → `codesign --force --deep --sign -` ad-hoc 重签 → `DYLD_INSERT_LIBRARIES=$INJECTOR_PATH` 启动 Cavalry。该链路在 SIP=enabled 的机器上长期工作，是默认 G-CAPTURE 真相路径
- 重签后 launcher 必须立刻 `codesign -dv --entitlements - "$APP_PATH"` 并把输出写到 `SESSION_DIR/audit/codesign-evidence.txt`；输出中存在 `runtime` 或 `library-validation` flag 即 `exit 1`，不允许继续注入或声明 SIP 阻塞
- 不允许在没有 `codesign-evidence.txt` 的情况下写 `BLOCKED-SIP` / `WEAK-CAPTURE due to SIP`；不允许用 "SIP 阻塞" 当理由要求关 SIP / 降 lower bound / 改走 AX-only（详见 `Acceptance.md` §G-CAPTURE 与 `Anti-Patterns.md` §D）
- 真 SIP 阻塞必须同时附 `~/Library/Logs/DiagnosticReports` 中 amfid / kernel 的拒绝日志路径，作为 run note 引用证据

## Run Note

写到 `runs/YYYY-MM-DD-W3-runtime-capture.md`
