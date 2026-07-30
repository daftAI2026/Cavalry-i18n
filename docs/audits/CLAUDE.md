# audits/
> L2 | 父级: ../CLAUDE.md

成员清单
add-layer-localized-search-2026-05-21.md: Add Layer 本地化搜索审计报告，记录中文显示与英文过滤索引断开的代码证据、不可触碰数据层与后续 query bridge 路线。
add-layers-runtime-model-capture-2026-05-20.md: Add Layers 空白卡片与标签空白审计报告，记录 QuickAddWindow item model dump、空 DisplayRole 根因、tag source token 边界与 Time Editor niceName 保护线。
audit_report.md: Runtime UI Tail Cleanup 深度代码审查，覆盖 TS 数据层验证、injector 根因分析与 aboutToShow 竞态修复路径。
codex-thread-handoff-runtime-i18n-2026-05-20.md: 本轮 Codex 长对话交接压缩，记录 Time Editor 英文保护、ExtensionLayer CJK 边界、runtime-generated 属性标签补译、Add Layers 空白卡片、噪声隔离、验证结果与安装态同步阻塞。
composition-menu-lazy-action-flicker-2026-05-21.md: Composition 菜单 lazy QAction 闪烁审计报告，记录打开前 Qt 占位状态、英文 AX 打开后状态、误判修正、aboutToShow 同步 pre-paint 修复与后续 QAction::changed guard。
runtime-refresh-performance-2026-05-21.md: Runtime 刷新性能审计报告，记录点击闪烁根因、交互全局刷新证据、dirty-object 算法方案、inventory gate 与后续 roadmap 入口。
runtime-performance-implementation-2026-07-13.md: Runtime 性能实施闭环报告，记录 dirty-only/capture gate、哈希翻译、可搬移 Qt RPATH、异步增量签名、真实 Cavalry 三语 inventory 与 APFS 副本 apply/codesign 证据。
runtime-translation-noise-triage-2026-05-19.md: 2026-05-19 运行时翻译噪声分诊审计报告，覆盖 20 个可疑 token（如 Rhu、Rfr）的排查结论与证据链。
runtime-ui-tail-cleanup-run-2026-05-16.md: Runtime UI 收尾清理实跑记录，记录 zh-Hans live capture、FIX1/FIX2 对比、根因修复与残留分类。状态 BLOCKED。
pr3-macos-release-hardening-session-handoff-2026-07-30.md: PR #3 macOS 发布加固复盘与维护交接，压缩八条表面、Onboarding、Transform、验收器假绿、生成物同步、PR/tag 顺序及 Windows live 原始 pending 的决策与避坑经验，并以后续补记链接到 Windows 15/15 独立真相源。
windows-port-session-handoff-2026-07-29.md: Windows x64 适配实施复盘与维护交接，记录最终 generic/QPA/UAC 架构、被证伪路线、翻译表面边界、构建与发布经验、证据分级及后续验证债。

依赖边界:
audits 保存阶段性检查结果与实跑记录；不驱动运行时，不决定 gate 通过。

法则: 事实即记录·状态不粉饰·阻塞不隐瞒

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
