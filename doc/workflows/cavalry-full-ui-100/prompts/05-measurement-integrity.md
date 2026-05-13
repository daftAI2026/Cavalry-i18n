<!--
[INPUT]: 依赖 Acceptance.md G0、tests/full-ui-contract.md、Runbook.md
[OUTPUT]: 对外提供 G0 Measurement Integrity 的 RED→GREEN 协议
[POS]: prompts 第四步
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 05 — Measurement Integrity（W0 / G0）

## Must Read

- `WORKFLOW/Acceptance.md` §G0
- `WORKFLOW/tests/full-ui-contract.md` §G0
- `WORKFLOW/Runbook.md` §Artifact Hygiene Rule
- `REPO/doc/LOCAL_BUILD_SOP.md`

## Allowed Files

- `REPO/.github/workflows/build.yml`
- `REPO/tools/check_full_ui_matrix.js`
- `REPO/tools/check_runtime_ui_coverage.js`
- `REPO/package.json`

## Task

确保检测链自身可信：

1. threshold 固定为 `100` / `1.00`
2. runtime gate 校验 language / freshness / provenance
3. matrix 绑定 `SESSION_DIR`
4. CI 无 live Cavalry 时输出 `BLOCKED-NO-LIVE-CAVALRY`
5. CI 打包遵守仓库 SOP：使用 `npm run build:tauri`，而不是裸 `npm run build`
6. 不恢复旧 build、builder 或 harness；旧断言只迁移到 Tauri / full-ui gate
7. README / 普通说明文案里的旧数字不在本 prompt 处理

## Gate Check

```bash
npm run test:contracts
rg -n 'BLOCKED-NO-LIVE-CAVALRY' .github/workflows/build.yml tools/check_full_ui_matrix.js
rg -n 'run: npm run build:tauri$' .github/workflows/build.yml
! rg -n 'run: npm run build$|doc/compiled-ui-source-map.json|doc/translation-whitelist.json' .github/workflows/build.yml
! rg -n -- '--threshold 99|coverage_threshold.*0\.90|coverage >= 0\.90' package.json tools/check_full_ui_matrix.js tools/check_full_ui_coverage.js tools/check_runtime_ui_coverage.js tools/validate_translations.py
rg -n 'threshold.*100|coverage_threshold.*1\.00' package.json tools
rg -n 'session-dir|SESSION_DIR|sessions/' tools/check_full_ui_matrix.js tools/check_runtime_ui_coverage.js
```

说明：`npm run build`、旧 `doc/...` artifact 路径、`99`、`0.90` 都是 fail-on-match；不能用“同时存在新旧写法”冒充通过。
上述检查只针对实际执行入口；README、归档文档、注释性文案不作为本阶段 blocker。
若失败点只来自已删除旧壳层 build / harness，不恢复旧壳；迁移仍有价值的断言，CI 打包只收敛到 Tauri SOP。

## Run Note

写到 `runs/YYYY-MM-DD-W0-measurement-integrity.md`
