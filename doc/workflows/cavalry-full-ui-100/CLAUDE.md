# cavalry-full-ui-100/
> L2 | 父级: doc/CLAUDE.md

成员清单
- Project.md: 目标、基线、真相源、完成语义
- Acceptance.md: G0-G4 的通过/失败条件
- Runbook.md: Non-Stop Rule、循环执行规则、run log 规范
- Flow.md: 端到端流程图与 gate ownership
- EXECUTE.md: 冷启动执行入口
- TODO.md: 任务队列与当前基线
- ChatlogRef.md: 本次审查/复核对话的证据留档（非当前 gate 真相源）
- tests/: 契约文档目录
- runs/: 运行记录目录

设计规则
- 本 workflow **取代旧的“只做到 M1/M2/M3 就算完成”的口径**，目标是三语 UI whitelist-based 100%。
- 本 workflow 必须同时记录：**目标、检测、检测结果、最终目标**，不能只写计划，不写当前真相。
- `runtime 100% / compiled 20.12% / json 97-98%` 这组现有结果必须保留在文档里作为基线，但**不能被当作最终通过结论**。
- 只有当 **测量方法本身可信** 且 **三语矩阵全绿** 时，才可以对外写 `ALL GATES PASS`。
- 任何允许保留英文的条目，必须同时满足：翻译标准允许 + glossary/whitelist 契约允许 + 检测 allowlist 显式允许。
- `ChatlogRef.md` 只用于保留这次审查过程中的对话证据；如果它与 `Project.md` / `Acceptance.md` / `Runbook.md` 冲突，以后三者为准。

[PROTOCOL]: 变更时更新此头部
