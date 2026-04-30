<!--
[INPUT]: 依赖 EXECUTE.md 冷启动命令 + Acceptance.md W-AUDIT 条件
[OUTPUT]: 对外提供 W-AUDIT gate 的 RED→GREEN 执行协议
[POS]: prompts 第一个实际工作步骤
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 01 — Audit & Gate Hardening（W-AUDIT）

## Must Read

- `WORKFLOW/Acceptance.md` §W-AUDIT
- `WORKFLOW/tests/full-ui-contract.md` §W-AUDIT
- `WORKFLOW/Runbook.md` §Execution Order
- `REPO/doc/LOCAL_BUILD_SOP.md`

## Allowed Files

- `REPO/tools/check_full_ui_matrix.js`
- `REPO/tools/check_full_ui_coverage.js`
- `REPO/tools/check_runtime_ui_coverage.js`
- `REPO/tools/extract_compiled_ui_strings.js`
- `REPO/tools/validate_translations.py`
- `REPO/tools/verify_gate_inputs.js`
- `REPO/package.json`

## Task

把所有“旧弱口径仍被测试或脚本冻结为正确行为”的问题先变成 RED→GREEN。

本步骤只处理 active full-ui / Tauri 路径。Electron 专属测试、Electron harness、electron-builder 配置不属于本 workflow 修复目标；若旧 Electron 测试里有仍有价值的断言，迁移到 full-ui / Tauri gate。

### 必做项

1. active full-ui / Tauri gate 实现 whitelist-filtered 100；legacy `--threshold 99` 只作为拒绝样本
2. `coverage >= 0.90` → `1.00`
3. `check:full-ui` 前置 `tools/verify_gate_inputs.js`
4. runtime detector 不再只依赖 `/[A-Za-z]/`
5. compiled target contract 覆盖 `libExtensionLayer.dylib`

### 禁止项

- 不允许用 exit-0 占位 preflight 伪装“已接线”
- 不允许把“先接脚本、后补语义”写成通过

## Gate Check

```bash
npm run test:desktop
! rg -n -- '--threshold 99' package.json tools/check_full_ui_matrix.js tools/check_full_ui_coverage.js tools/check_runtime_ui_coverage.js
! rg -n 'coverage >= 0\.90|coverage_threshold.*0\.90' tools/validate_translations.py
rg -n 'verify_gate_inputs' package.json
node -e "const {getCompiledUiTargets}=require('./tools/extract_compiled_ui_strings.js'); const t=getCompiledUiTargets('/Applications/Cavalry.app'); if(!t.some(x=>x.includes('libExtensionLayer'))) process.exit(1)"
```

说明：带 `! rg` 的检查必须**无命中才算通过**；命中旧弱口径就是 RED，不能继续写 PASS。
若 `npm run test:desktop` 只因 Electron 专属测试失败，本 prompt 不修 Electron；记录为 legacy residual，并把仍有价值的断言迁移到 full-ui / Tauri gate。

## Run Note

写到 `runs/YYYY-MM-DD-W-AUDIT.md`
