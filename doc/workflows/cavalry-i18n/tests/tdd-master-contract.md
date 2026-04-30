<!--
[INPUT]: 依赖 test-driven-development skill 原则与本 workflow Acceptance.md
[OUTPUT]: 对外提供 cavalry-i18n 的完整 TDD 主协议
[POS]: tests 层的总测试纪律，所有 prompt 必须引用
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# TDD Master Contract

## Iron Law

没有失败测试，不写实现。

顺序固定：

```text
RED: 写一个失败测试
VERIFY RED: 运行并确认因目标缺失而失败
GREEN: 写最小实现
VERIFY GREEN: 运行并确认通过
REFACTOR: 只清理当前边界
REGRESSION: 跑更大范围测试
DOC SYNC: 更新 L3/L2/L1 文档
RUN LOG: 写 runs 记录
```

## Atomic Loop

TDD loop 的原子单位是一个行为，不是一个文件，也不是一个 milestone。

正确：

```text
写一个术语表四列检查 -> RED -> 填充四列 -> GREEN -> refactor
写一个 JSON key 一致性测试 -> RED -> 翻译 JSON -> GREEN -> refactor
写一个 API 调用检查 -> RED -> 编写 LanguageSwitcher.js -> GREEN -> refactor
```

错误：

```text
一次性写所有 T0~T9 测试 -> 一次性实现整个项目 -> 全部 GREEN
```

## No Batch RED

每个 prompt 最多只能保持一个未修复 RED。

如果一个 prompt 需要覆盖多个行为，必须在 prompt 内重复以下循环：

```text
1. 添加一个测试。
2. 运行这个测试并确认有效 RED。
3. 只改实现文件让这个测试 GREEN。
4. 运行同一个测试确认 GREEN。
5. 运行已通过的局部回归。
6. 才进入下一个测试。
```

GREEN 阶段禁止修改测试文件。若测试错误，停止 GREEN，回到 RED 阶段修测试并重新观察失败。

## Valid RED

有效 RED 必须满足：

- 失败原因是目标能力缺失（如文件不存在、字段缺失、结构不匹配）。
- 不是 import typo。
- 不是测试环境配置错误。
- 不是依赖未安装造成的假失败。
- 测试名描述一个行为，不写 vague 名称。

## Invalid RED

无效 RED：

- 测试一写就通过。
- 测试因语法错误失败。
- 测试依赖未定义 mock。
- 测试实现细节而不是行为。
- 测试同时覆盖多个行为。

## Minimal GREEN

GREEN 只能做让当前测试通过的最小实现。

禁止：

- 顺手翻译其他语言。
- 顺手大重构 JSON 结构。
- 顺手引入新工具链。
- 顺手修 unrelated 文件。

## Regression Levels

局部（单个 task）：

执行对应 contract 中的 Behavior 片段（如 glossary-contract B1-B5）。

里程碑（M1 全部）：

依次执行 glossary-contract、extraction-contract、whitelist-contract、translation-contract、qm-contract 的全部 Behavior。

全量：

依次执行所有 contract（glossary → extraction → whitelist → translation → qm → switcher → ci → readme）的全部 Behavior。

## Failure Handling

测试失败时：

1. 先判断是 RED 预期失败还是错误失败。
2. 错误失败先修测试或环境。
3. GREEN 后如果其他测试失败，必须先修回归。
4. 不允许扩大 scope 掩盖失败。

## Done Definition

一个 TDD task 结束必须有：

- 验证脚本输出。
- 实现产物。
- 回归命令输出。
- 文档同步说明。
- run log。
