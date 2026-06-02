# tests/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/archive/workflows-cavalry-i18n/CLAUDE.md

成员清单
tdd-master-contract.md: 早期 TDD 总纪律。
gate-check-contract.md: 早期 gate 状态与完成语义契约。
glossary-contract.md: 术语表扩展契约。
extraction-contract.md: 英文字符串抽取契约。
whitelist-contract.md: 翻译 whitelist 契约。
translation-contract.md: 三语翻译契约。
qm-contract.md: QM 编译契约。
switcher-contract.md: 语言切换器契约。
ci-contract.md: CI 构建契约。
readme-contract.md: README 输出契约。

依赖边界:
tests 是历史文档化契约；当前 executable contract 位于 `tools/`、`src-tauri/tests/` 与 `cavalry-full-ui-100/tests/`。

法则: 契约可追溯·执行需迁移·当前测试优先

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
