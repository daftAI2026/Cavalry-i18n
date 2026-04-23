# tests/
> L3 | 父级: doc/workflows/cavalry-i18n/CLAUDE.md

成员清单
- tdd-master-contract.md: TDD 总纪律（RED→GREEN→REFACTOR 原子循环）
- gate-check-contract.md: Gate 前置检查（run log 格式、stage 依赖）
- glossary-contract.md: 术语表验证契约（T0）
- extraction-contract.md: 英文提取验证契约（T1）
- whitelist-contract.md: 翻译字段白名单验证契约（T1.1）
- translation-contract.md: 翻译质量验证契约（T2）
- qm-contract.md: .qm 编译验证契约（T3）
- switcher-contract.md: LanguageSwitcher.js 验证契约（T4）
- ci-contract.md: CI 验证契约（T8）
- readme-contract.md: README 验证契约（T9）

规则
- tests/ 保存契约文档，定义测试纪律和各 gate 的验证规则。
- 契约不是可执行脚本，而是定义行为和验证命令的规范文档。
- 实际的验证脚本在执行时按契约要求编写并运行。

[PROTOCOL]: 变更时更新此头部
