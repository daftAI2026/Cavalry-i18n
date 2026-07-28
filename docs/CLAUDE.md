# docs/
> L2 | 父级: ../CLAUDE.md

成员清单
cavalry-glossary.md: Cavalry 四语术语表（en/zh-Hans/zh-Hant/ja_JP），含注释列标注禁用词、Forge Dynamics 显示层例外、Cavalry 版本增量与行业对齐来源。
cavalry-runtime-injection-techniques.md: Cavalry runtime UI 抽取与翻译注入技术沉淀，记录 QTranslator 子类化 / DYLD 注入 / ad-hoc 重签 / dump-only 抽取，以及 QMenu/QLineEdit/QDialog 首次绘制前翻译、MessageBar append-time 日志替换、metadata-only 诊断与 QStatusBar 动态消息的为什么这么做。
code-review-report.md: Cavalry-i18n 代码审查报告，覆盖死代码分析、冗余逻辑、设计走弯路与优化优先级建议。
runtime-ui-live-capture-workflow.md: Runtime UI live 抓取流程，区分调试/安装包启动路径、Cavalry 窗口截图证据、`widgetAt(cursor)` 坐标反查、Qt item model dump、JSON 数据层复用、ModalDialog 诊断、闪烁根因分类、注入后中文 session、英文 dump-only 基线与 ExtensionLayer 平台精确边界，并规定全量复抓、增量修复、coverage 对比路径。
runtime-translation-noise-triage.md: Runtime 翻译噪声分诊协议，定义短 token provenance 证据等级、quarantine 决策、live capture 对准步骤与 Time Editor niceName 保护线。
translation-guidelines.md: 翻译规范，约束语言风格、保留词、Forge Dynamics 显示层/模型层分流与界面一致性。
user-story-status.xlsx: canonical 用户故事状态表，按代码反推 Cavalry-i18n 功能、预期行为、测试证据、错误与修复状态。
audits/: 审计报告与实跑记录目录，保存阶段性人工/自动检查结果；新问题先沉淀 dated report，再决定是否升格为 workflow。
roadmap/: 路线图目录，保存 proposed/active 的未来优化主题；当前含 Windows 移植与注入路线，每个主题链接对应事实依据并拆出阶段性验收标准。
workflows/: 文档化工作流，当前仅 `cavalry-full-ui-100/` 为 full-ui gate 主线；早期 `cavalry-i18n/` 已归档到 `archive/workflows-cavalry-i18n/`。
img/: 静态资源库，存放 README 截图与文档示意图。
badges/: README badge endpoint 数据源目录，保存发布 workflow 写回的 Shields JSON 投影。
archive/: 归档计划与历史方案，保留已完成或废弃决策的证据链。

依赖边界:
docs 只描述现实，不驱动运行时；按仓库策略保持本地忽略。任何架构变更必须先让代码成立，再让这里的地图同构。

分类口径:
规范留根目录，实跑与审计进 audits，未来优化路线进 roadmap，稳定流程进 workflows，失效方案进 archive；被 changelog 或当前流程引用的报告不因“已读过”而移动。

法则: 计划可执行·结果可追溯·限制不粉饰

变更日志
2026-06-04: 新增 `badges/release.json` 作为 README release badge 的 Shields endpoint 数据源，发布 workflow 成功创建 GitHub Release 后写回 main，避免 README 首屏实时依赖 Shields GitHub API token pool。
2026-07-07: 新增 `user-story-status.xlsx` 作为单一 canonical 用户故事状态表，跟踪功能预期、测试状态、错误与修复闭环。
2026-07-13: 完成 runtime 性能路线，新增真实 Cavalry 三语注入、APFS 副本增量签名与翻译等价性审计证据，并纠正 canonical 用户故事状态口径。
2026-07-14: 同步 `0.5.3` 发布候选的 dylib/生成表证据，记录三语空状态实机验证，并将维护者明确豁免的额外 full UI matrix 标为 `USER-WAIVED`，不冒充 100% coverage。
2026-07-24: 以 macOS DMG 与 Windows 2.7.2 安装内逐字节相同的 `nodeStrings.json` 核实 `smoother.smoothingSteps` 为跨平台版本节点，将四语术语、语言包与 keyed overlay 保留合同同步纳入同构边界。
2026-07-24: 新增 Windows 端口与注入路线图，明确任意安装根、JSON keyed overlay、Qt generic plugin、进程级环境、ExtensionLayer IAT 白名单和真机验收边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
