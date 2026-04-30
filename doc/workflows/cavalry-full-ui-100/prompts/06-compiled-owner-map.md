<!--
[INPUT]: 依赖 Acceptance.md G2 + compiled-ui-source-map.json
[OUTPUT]: 对外提供 compiled owner map 完善与验证的 RED→GREEN 执行协议
[POS]: prompts 第五步，确保 compiled surface 可见且完整
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 06 — Compiled Owner Map（W2 / G2）

## Must Read

- `WORKFLOW/Acceptance.md` §G2 — Compiled Surface 100 Gate
- `WORKFLOW/tests/full-ui-contract.md` §B2.1 + §B2.2

## Must Follow

- `WORKFLOW/tests/tdd-master-contract.md`
- `WORKFLOW/EXECUTE.md` §禁2（禁止 curated owner map）

## Allowed Files

- `REPO/tools/extract_compiled_ui_strings.js`（补 target、审计 noise filter）

## 前置 Gate

01-audit PASS（libExtensionLayer 已在 targets 中）

## Task

确保 compiled source map 是完整、可信的 raw extraction 产物。01 步骤已补齐 target，本步骤重点是**验证抽取质量与 noise filter 审计**。

### 1. 重新生成 source map

```bash
node tools/extract_compiled_ui_strings.js \
  --app /Applications/Cavalry.app \
  --output ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json
```

### 2. 验证 targets 完整

`compiledUiTargets` 必须至少包含 4 个 owner：
- `Contents/MacOS/Cavalry`
- `Contents/Frameworks/libCavalryUI.dylib`
- `Contents/Frameworks/libCavalryFramework.dylib`
- `Contents/Frameworks/libExtensionLayer.dylib`

### 3. 记录抽取量（observed baseline，不是 formal gate）

- 在当前 `Cavalry 2.7.1 / Qt 6.6.3` 样本上，`libExtensionLayer.dylib` raw 抽取通常可见到约 1500+ 条
- 总 entries 常见于 4000-6000 量级（当前观测约 4743）
- 保留率与排除率应进入 audit；若明显偏离当前样本，必须在 run note 解释原因
- 这些数字只用于 drift 审计，不单独构成 PASS / FAIL gate

### 4. 验证 canary 字符串

以下真实 UI 字符串**必须**出现在 source map 中（回归检测，不能反向定义抽取范围）：
- `Scene Window`
- `Time Editor`
- `Swatches`
- `Default Keyframe Layer`
- `Enter an Asset name`
- `No Project Set`
- `Import Reference...`
- `Export Lottie...`

### 5. Noise filter 审计

检查 `extract_compiled_ui_strings.js` 中的过滤逻辑：
- 只允许声明式 noise-pattern 排除正则（HTTP header / debug log / binary gibberish / library-internal symbol）
- **不允许** known-set / curated 清单 / hand-picked corpus 作为输出门
- 排除比例（excluded / raw_total）必须可审计，并在异常偏高时解释原因
- 每条排除规则必须有注释说明匹配什么

## TDD Behaviors

| # | RED | GREEN |
|---|-----|-------|
| 1 | targets 缺 libExtensionLayer | targets 含 4 个 owner |
| 2 | `Scene Window` 不在 source map | 8 个 canary 全部可见 |
| 3 | 抽取量没有落 audit | raw / excluded / retained counts 被记录 |
| 4 | 抽取量与当前样本明显偏离却无解释 | run note 解释偏差原因 |
| 5 | noise filter 含 curated keep-list | noise filter 只含排除正则 |
| 6 | noise filter 缺少排除理由 | 每条排除规则都有可审计说明 |

## Gate Check

```bash
# 1. 生成
node tools/extract_compiled_ui_strings.js --app /Applications/Cavalry.app --output ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json

# 2. 验证
python3 -c "
import json, os
d = json.load(open(os.path.expanduser('~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json')))
targets = d.get('compiledUiTargets', [])
entries = d.get('entries', [])
canaries = ['Scene Window', 'Time Editor', 'Swatches', 'Default Keyframe Layer', 'Enter an Asset name', 'No Project Set', 'Import Reference...', 'Export Lottie...']
texts = {e.get('text','') for e in entries}
print(f'targets: {len(targets)}')
print(f'entries: {len(entries)}')
for c in canaries:
    status = '✅' if c in texts else '❌'
    print(f'  {status} {c}')
missing = [c for c in canaries if c not in texts]
assert len(targets) >= 4, f'Only {len(targets)} targets'
assert not missing, f'Missing canaries: {missing}'
print('G2 PASS')
"
```

## Run Note

写到 `runs/YYYY-MM-DD-W2-compiled-owner-map.md`
