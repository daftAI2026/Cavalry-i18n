# doc/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
LOCAL_BUILD_SOP.md: Tauri 默认本地打包 SOP，记录 Qt 6.6.3 injector、Tauri build、资源与产物验证。
archive/: 历史打包流程归档，保留 Electron SOP 作为回退期参考。
tauri-migration-tdd-plan.md: Tauri 迁移 TDD 总方案，定义 UI 不变、功能等价、红绿阻塞门。
compiled-ui-source-map.json: compiled UI 字符串来源地图，区分 JSON 资产与二进制 UI 文本。
cavalry-glossary.md: Cavalry 术语表。
cavalry-glossary-en-zh.md: 英中术语映射。
cavalry-scripting-api-digest.md: Cavalry scripting API 摘要。
cavalry-scripting-knowledge-base.md: Cavalry scripting 知识库。
kumo-ui-migration-plan.md: Kumo UI 迁移方案。
plan-v3.md: 历史计划文档。
refactor-plan.md: 历史重构计划。
translation-guidelines.md: 翻译规范。
translation-whitelist.json: 翻译校验白名单。
workflows/: 历史/专项工作流文档。

依赖边界:
doc 是语义相，描述代码和流程现实；打包路径切换和窗口契约修正时 SOP 必须同步，不能让 Electron 旧路径继续伪装默认流程。

法则: 默认路径唯一·历史流程归档·阻塞门写清

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
