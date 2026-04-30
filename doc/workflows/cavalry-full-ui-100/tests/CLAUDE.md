# tests/
> L2 | 父级: doc/workflows/cavalry-full-ui-100/CLAUDE.md

成员清单
- tdd-master-contract.md: RED → GREEN → REFACTOR 总纪律
- gate-check-contract.md: W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0-G4 的状态、依赖关系与完成语义
- full-ui-contract.md: W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0-G4 的详细验证契约
- forbidden-translation-contract.md: §P5 Forbidden-Translation Patterns 的反伪翻译契约

规则
- tests/ 保存契约文档，不保存实现代码。
- 契约必须能把“目标、检测、检测结果、完成语义”固定下来。
- 契约一旦升级为更严格口径，不允许在执行中私自放松阈值。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
