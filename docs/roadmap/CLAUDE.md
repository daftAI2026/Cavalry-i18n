# roadmap/
> L2 | 父级: ../CLAUDE.md

成员清单
localized-search-index.md: 本地化搜索索引路线图，链接 Add Layer 中文搜索调研报告，并把 QuickAdd 现场抓取、反向翻译索引、scoped query bridge 与 live canary 拆成阶段验收。
macos-app-management-handoff-animation.md: macOS App Management 真实拒绝后授权引导的实施账本；冻结直接安全事务→typed 拒绝→设置定位→每屏快照 handoff→532×112 的“箭头 + 单行 Drag 指令 / Back + 单行 App row”helper→不含容器背景的整条 App row snapshot 真实 file-URL 拖拽→同进程 oracle，并区分系统“退出并重新打开”的待实机新会话与“稍后”的明确重开阻断；记录 motion surface/箭头 overscan 不得改变静止 screen-space 坐标、九命令内 renderer/Rust/AppKit 生产实现、本机有界脱敏诊断流，以及共享工作台与当前 macOS 包的视觉、状态机和生命周期验证边界。
README.md: Roadmap 总索引，定义状态口径、当前路线入口与归档规则。
runtime-refresh-performance.md: 已完成的 Runtime 刷新性能路线，连接 2026-05-21 根因与 2026-07-13 实施证据，闭环交互局部刷新、capture gate、重复写回规避、增量签名和真实 Cavalry 验证。
switcher-update-and-trusted-distribution-roadmap.md: Switcher 更新提示、自更新与可信分发路线，记录已落地的 R0 UI、R1 Rust/bridge/renderer、最终公钥/endpoint、受保护 updater Secrets、deterministic manifest 与 schema v6/v4 九资产 ad-hoc tag 发布闭包；区分尚未完成的真实 tag、Apple Developer ID/notarization、Windows Authenticode、SemVer bootstrap 与跨版本实机验收；完整自动更新仍未验收。
switcher-update-release-event-ledger.md: 本轮 Switcher UI、组件/Toast 源码审计、Updater、双平台实机证据、release/tag 与清理执行事件簿；以状态、证据和下一动作防止待办遗失。
windows-port-and-injection-roadmap.md: Active 的 Windows 移植路线，规定任意安装根 JSON keyed overlay、Qt generic translator + QPA delegate 原生入口汇合、交互卸载保留翻译或显式事务恢复 English 的双语义、silent/passive/update 默认保留、含动态 Pitch caller/source 门的受限 ExtensionLayer IAT hook、权限边界、marker 事务与真机验收。

依赖边界:
roadmap 记录 proposed/active/completed 路线与验收条件；不替代 audits 的事实报告，不替代 workflows 的稳定操作流程，也不驱动运行时。

法则: 一题一文档·链接证据·阶段可验收·状态不粉饰

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
