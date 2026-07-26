# roadmap/
> L2 | 父级: ../CLAUDE.md

成员清单
localized-search-index.md: 本地化搜索索引路线图，链接 Add Layer 中文搜索调研报告，并把 QuickAdd 现场抓取、反向翻译索引、scoped query bridge 与 live canary 拆成阶段验收。
README.md: Roadmap 总索引，定义状态口径、当前路线入口与归档规则。
runtime-refresh-performance.md: 已完成的 Runtime 刷新性能路线，连接 2026-05-21 根因与 2026-07-13 实施证据，闭环交互局部刷新、capture gate、重复写回规避、增量签名和真实 Cavalry 验证。
windows-port-and-injection-roadmap.md: Active 的 Windows 移植路线，规定任意安装根 JSON keyed overlay、Qt generic plugin 子进程环境、受限 ExtensionLayer IAT hook、权限边界、marker 事务与真机验收。

依赖边界:
roadmap 记录 proposed/active/completed 路线与验收条件；不替代 audits 的事实报告，不替代 workflows 的稳定操作流程，也不驱动运行时。

法则: 一题一文档·链接证据·阶段可验收·状态不粉饰

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
