# cavalry-i18n/
> L2 | 父级: doc/CLAUDE.md

成员清单
- Project.md: 项目宪法，定义范围、真相源、约束
- Acceptance.md: 验收闸门，定义 M1/M2/M3/M_manual 的通过/失败条件
- Runbook.md: 执行纪律，Non-Stop Rule、分段执行、Run Log 格式
- Flow.md: 流程图，mermaid 可视化 + Gate Ownership
- EXECUTE.md: Agent 冷启动执行入口
- TODO.md: 任务队列，按里程碑组织的 checkbox
- tests/: 测试契约文档目录
- runs/: 执行记录目录
- prompts/: 分步执行指令目录

设计规则
- workflows/ 保存跨多轮执行的自包含工程化文档，不承载产品源码。
- 每个 workflow 必须有 Project.md、Acceptance.md、TODO.md，并能独立指导执行者。
- 审查/收口类 workflow 必须区分 **DELIVERY COMPLETE**（M1+M2+M3）与 **ALL GATES PASS**（含 M_manual）。
- workflow 中若使用人类可读语言别名，必须显式记录与 repo/runtime 代码的映射。
- 变更任何文件时同步更新本 CLAUDE.md。

[PROTOCOL]: 变更时更新此头部
