# doc/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
LOCAL_BUILD_SOP.md: 本地构建与打包 SOP，约束 Qt SDK、Tauri/Electron 构建入口与验证顺序。
keychain-login-persistence-plan.md: Keychain 登录态持久化修复方案，记录根因、Tauri-only 执行清单、冒烟结果与已知限制。
tauri-migration-tdd-plan.md: Tauri 迁移 TDD 总方案，记录阶段拆分、合同测试与迁移边界。
cavalry-glossary*.md: Cavalry 术语表，稳定英文到中文的领域翻译。
cavalry-scripting-*.md: Cavalry scripting API 摘要与知识库，沉淀脚本侧上下文。
cavalry-runtime-injection-techniques.md: Cavalry runtime UI 抽取与翻译注入技术沉淀，记录 QTranslator 子类化 / DYLD 注入 / ad-hoc 重签 / dump-only 抽取的为什么这么做。
translation-guidelines.md: 翻译规范，约束语言风格、保留词与界面一致性。
workflows/: 文档化工作流，承载构建、验证、发布的操作路径。
archive/: 归档计划与历史方案，保留已完成或废弃决策的证据链。

依赖边界:
doc 只描述现实，不驱动运行时；按仓库策略保持本地忽略。任何架构变更必须先让代码成立，再让这里的地图同构。

法则: 计划可执行·结果可追溯·限制不粉饰

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
