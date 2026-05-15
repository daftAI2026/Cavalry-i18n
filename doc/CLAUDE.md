# doc/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
keychain-login-persistence-plan.md: Keychain 登录态持久化修复方案，记录根因、Tauri-only 执行清单、冒烟结果与已知限制。
tauri-migration-tdd-plan.md: Tauri 迁移 TDD 总方案，记录阶段拆分、合同测试与迁移边界。
cavalry-glossary*.md: Cavalry 术语表，稳定英文到中文的领域翻译。
cavalry-runtime-injection-techniques.md: Cavalry runtime UI 抽取与翻译注入技术沉淀，记录 QTranslator 子类化 / DYLD 注入 / ad-hoc 重签 / dump-only 抽取的为什么这么做。
runtime-ui-event-filter-performance-fix.md: Runtime UI event filter 卡死问题修复方案，记录 100% CPU 根因、dirty object queue 替代 full refresh 的 TDD 步骤。
runtime-ui-injection-coverage-plan.md: Runtime UI 注入覆盖修复方案，记录菜单/UI 英文残留根因、aboutToShow hook / event filter / widget surface 扩展。
runtime-ui-tail-cleanup-plan.md: Runtime UI 收尾清理独立执行计划，面向真实截图残留英文、错译快捷键、已嵌入未命中与方块缺字标签分类修复。
cavalry-2.7.2-target-refresh-plan.md: Cavalry 2.7.2 目标刷新与增量补译执行计划，记录 denominator drift、重新冻结分母、只补增量与最终全量 gate 路径。
translation-guidelines.md: 翻译规范，约束语言风格、保留词与界面一致性。
workflows/: 文档化工作流，当前 `cavalry-full-ui-100/` 为 full-ui gate 主线，`cavalry-i18n/` 为早期历史路线。
archive/: 归档计划与历史方案，保留已完成或废弃决策的证据链（含骑兵 Script UI 方案 plan-v3、Electron 精简改造 refactor-plan、Kumo UI 迁移草案、Scripting API 知识库）。

依赖边界:
doc 只描述现实，不驱动运行时；按仓库策略保持本地忽略。任何架构变更必须先让代码成立，再让这里的地图同构。

法则: 计划可执行·结果可追溯·限制不粉饰

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
