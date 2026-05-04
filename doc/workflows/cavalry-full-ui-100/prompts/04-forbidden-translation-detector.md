<!--
[INPUT]: 依赖 Acceptance.md §P5、Anti-Patterns.md Counterfeit Form、tests/forbidden-translation-contract.md
[OUTPUT]: 对外提供 §P5 detector 的 RED→GREEN 执行协议
[POS]: prompts §P5 阶段（在 provenance contract 固定后接线）
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 04 — Forbidden-Translation Detector（W-P5）

## Must Read

- `WORKFLOW/Acceptance.md` §P5
- `WORKFLOW/tests/forbidden-translation-contract.md`
- `WORKFLOW/Runbook.md` §Anti-Bypass Rule

## Allowed Files

- `REPO/tools/forbidden_translation_patterns.js`
- `REPO/tools/forbidden_translation_patterns.py`
- `REPO/tools/forbidden_translation_patterns.json`
- `REPO/tools/check_runtime_ui_coverage.js`
- `REPO/tools/validate_translations.py`
- `REPO/tools/verify_gate_inputs.js`
- `REPO/tools/check_full_ui_coverage.js`
- `REPO/tools/check_full_ui_matrix.js`

## Task

把 FP-1/2/3/4/5/7/8/9 作为统一语义接到：

1. runtime detector
2. JSON / `.ts` / `.inc` validator
3. preflight
4. `RUN_RECORD`

命中任一项即 hard-fail，不允许 warn-only。

### 共享实现要求

- FP-1/2/3/4/5/7/8/9 的规则必须沉到 `forbidden_translation_patterns.*`，gate 文件只能调用，不能各自复制一份正则
- JS / Python 双运行时必须共用同一组规则 ID、样本名与报告字段
- 任一规则变更必须同时更新共享规则文件、契约样本与 `RUN_RECORD.forbiddenPatterns`

## 必须覆盖

- FP-1 占位标记
- FP-2 全角拉丁
- FP-3 错位填词
- FP-4 zh-Hant 简体污染
- FP-5 zh-Hans 繁体污染
- FP-7 合成 source ID
- FP-8 伪 Qt context
- FP-9 Frankenstein 中英夹杂残留
- 旧自我递归模式已弃用；不得在 prompt / detector / run record 中重新引用

## Prompt Contract Fixes

- 先完成 `03-provenance-gate`，再把 detector 接进 preflight / runtime / JSON / matrix
- 如需改 `RUN_RECORD` schema，可同步修改 `check_full_ui_coverage.js` / `check_full_ui_matrix.js`
- preflight 读取的 runtime 样本必须来自 `sessions/<uuid>/runtime/`
- cache 根目录 runtime inventory 不是合法输入

## Gate Check

```bash
npm run test:desktop
python3 tools/validate_translations.py --root . --json-report /tmp/r.json --markdown-summary /tmp/r.md
node tools/verify_gate_inputs.js --section P5 --session-dir ~/Library/Caches/Cavalry-i18n/sessions/<uuid>
```

## Run Note

写到 `runs/YYYY-MM-DD-W-P5-forbidden-detector.md`
