<!--
[INPUT]: 依赖用户要求的“带阻塞 TDD / 红绿 / 检测 / 目标”
[OUTPUT]: 对外提供 full-ui-100 的 TDD 总纪律
[POS]: tests 层的总 TDD 契约
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# TDD Master Contract

## Iron Law

没有失败 gate / 失败测试，不写实现。

固定顺序：

```text
RED
→ VERIFY RED
→ GREEN
→ VERIFY GREEN
→ REFACTOR
→ REGRESSION
→ RUN LOG
→ RERUN MATRIX
```

## Atomic Loop

原子单位是**一个 blocker 行为**，不是整个 surface。

正确例子：

```text
写“package.json 必须存在 check:full-ui”失败测试
→ 跑出 RED
→ 最小接线
→ 绿

写“compiled source map 必须包含 libExtensionLayer.dylib”失败测试
→ 跑出 RED
→ 最小修复 extractor
→ 绿
```

错误例子：

```text
一次性改完整套 detector + 所有翻译内容 + 所有语言
→ 最后再看 matrix
```

## No Batch RED

任意时刻最多一个未修复 RED。

## Valid RED

有效 RED 必须满足：

1. 失败原因是能力缺失或目标未达标
2. 不是语法错误
3. 不是环境没装好
4. 不是输入文件选错

## Minimal GREEN

GREEN 只做让当前 blocker 通过的最小实现。

禁止：

- 顺手放宽 threshold
- 顺手扩 allowlist 掩盖真实 UI 问题
- 顺手改无关语言

## Regression Rule

每轮至少回归两层：

1. 当前 gate 的局部验证
2. `node tools/check_full_ui_matrix.js --threshold 100 --session-dir ~/Library/Caches/Cavalry-i18n/sessions/<uuid> --compiled-source-map ~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json`

回归 matrix 时，禁止：

- 省略 `--session-dir`
- 让 matrix 隐式回退到 cache 根目录 runtime inventory
- 只检查百分比，不检查 session run record 的 provenance / forbiddenPatterns / blocked 字段

## Done Definition

单轮 TDD 完成必须有：

1. 失败前提
2. 验证输出
3. 最小实现
4. 回归结果
5. 新 session run record / run note
