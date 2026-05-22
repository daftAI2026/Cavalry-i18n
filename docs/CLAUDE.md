# docs/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
cavalry-glossary.md: Cavalry 四语术语表（en/zh-Hans/zh-Hant/ja_JP），含注释列标注禁用词、Forge Dynamics 显示层例外与行业对齐来源。
cavalry-runtime-injection-techniques.md: Cavalry runtime UI 抽取与翻译注入技术沉淀，记录 QTranslator 子类化 / DYLD 注入 / ad-hoc 重签 / dump-only 抽取，以及 QMenu/QLineEdit/QDialog/QTextEdit MessageBar 首次绘制前翻译的为什么这么做。
cavalry-2.7.2-target-refresh-plan.md: Cavalry 2.7.2 目标刷新与增量补译执行计划，记录 denominator drift、重新冻结分母、只补增量与最终全量 gate 路径。
code-review-report.md: Cavalry-i18n 代码审查报告，覆盖死代码分析、冗余逻辑、设计走弯路与优化优先级建议。
runtime-ui-live-capture-workflow.md: Runtime UI live 抓取流程，区分调试/安装包启动路径、Cavalry 窗口截图证据、`widgetAt(cursor)` 坐标反查、Qt item model dump、JSON 数据层复用、ModalDialog 诊断、闪烁根因分类、注入后中文 session、英文 dump-only 基线与 ExtensionLayer 自绘提示盲区，并规定全量复抓、增量修复、coverage 对比路径。
runtime-translation-noise-triage.md: Runtime 翻译噪声分诊协议，定义短 token provenance 证据等级、quarantine 决策、live capture 对准步骤与 Time Editor niceName 保护线。
translation-guidelines.md: 翻译规范，约束语言风格、保留词、Forge Dynamics 显示层/模型层分流与界面一致性。
audits/: 审计报告与实跑记录目录，保存阶段性人工/自动检查结果；新问题先沉淀 dated report，再决定是否升格为 workflow。
roadmap/: 路线图目录，保存 proposed/active 的未来优化主题，每个主题链接对应 audit 事实报告并拆出阶段性验收标准。
workflows/: 文档化工作流，当前 `cavalry-full-ui-100/` 为 full-ui gate 主线，`cavalry-i18n/` 为早期历史路线。
img/: 静态资源库，存放 README 截图与文档示意图。
archive/: 归档计划与历史方案，保留已完成或废弃决策的证据链。

依赖边界:
docs 只描述现实，不驱动运行时；按仓库策略保持本地忽略。任何架构变更必须先让代码成立，再让这里的地图同构。

分类口径:
规范留根目录，实跑与审计进 audits，未来优化路线进 roadmap，稳定流程进 workflows，失效方案进 archive；被 changelog 或当前流程引用的报告不因“已读过”而移动。

法则: 计划可执行·结果可追溯·限制不粉饰

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
