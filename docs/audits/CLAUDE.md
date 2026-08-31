# audits/
> L2 | 父级: ../CLAUDE.md

成员清单
add-layer-localized-search-2026-05-21.md: Add Layer 本地化搜索审计报告，记录中文显示与英文过滤索引断开的代码证据、不可触碰数据层与后续 query bridge 路线。
add-layers-runtime-model-capture-2026-05-20.md: Add Layers 空白卡片与标签空白审计报告，记录 QuickAddWindow item model dump、空 DisplayRole 根因、tag source token 边界与 Time Editor niceName 保护线。
audit_report.md: Runtime UI Tail Cleanup 深度代码审查，覆盖 TS 数据层验证、injector 根因分析与 aboutToShow 竞态修复路径。
codex-thread-handoff-runtime-i18n-2026-05-20.md: 本轮 Codex 长对话交接压缩，记录 Time Editor 英文保护、ExtensionLayer CJK 边界、runtime-generated 属性标签补译、Add Layers 空白卡片、噪声隔离、验证结果与安装态同步阻塞。
composition-menu-lazy-action-flicker-2026-05-21.md: Composition 菜单 lazy QAction 闪烁审计报告，记录打开前 Qt 占位状态、英文 AX 打开后状态、误判修正、aboutToShow 同步 pre-paint 修复与后续 QAction::changed guard。
macos-native-app-management-implementation-2026-08-31.md: macOS App Management handoff 原生实施边界审计，冻结 Rust/Objective-C++ 最短路径、九命令、CSS→AppKit 坐标、per-screen NSPanel、NSDraggingSession、真实 apply reverse/cleanup、Reduce Motion 与 Info.plist；未知私有行为不写成事实。
macos-app-management-lifecycle-lessons-2026-08-31.md: macOS App Management 生命周期经验复盘；以具体 TCC service、本机 Quit & Reopen 资源/符号、p5 与当前源码区分需要重开和可同进程验证的权限，并冻结 fresh-session、不持久化旧任务、Later 显示重开提示而非继续 Retry 的决策与调研方法。
runtime-refresh-performance-2026-05-21.md: Runtime 刷新性能审计报告，记录点击闪烁根因、交互全局刷新证据、dirty-object 算法方案、inventory gate 与后续 roadmap 入口。
runtime-performance-implementation-2026-07-13.md: Runtime 性能实施闭环报告，记录 dirty-only/capture gate、哈希翻译、可搬移 Qt RPATH、异步增量签名、真实 Cavalry 三语 inventory 与 APFS 副本 apply/codesign 证据。
runtime-translation-noise-triage-2026-05-19.md: 2026-05-19 运行时翻译噪声分诊审计报告，覆盖 20 个可疑 token（如 Rhu、Rfr）的排查结论与证据链。
runtime-ui-tail-cleanup-run-2026-05-16.md: Runtime UI 收尾清理实跑记录，记录 zh-Hans live capture、FIX1/FIX2 对比、根因修复与残留分类。状态 BLOCKED。
switcher-ui-final-build-2026-08-28.md: Switcher 最终 UI 跨平台规格，冻结 400×484、20px 主网格、排印/间距、无描边彩色 Badge、Select、三轨 Activity、必要 AlertDialog、Base UI 对齐的 16px inset Toast、原生 About 与平台窗口所有权；UI Review 外壳必须跟随 fixture platform，视觉/静态/真机证据分层，native/package 证据由事件簿单独判定。
switcher-auto-baseline-and-restore-decision-2026-08-29.md: Switcher 恢复与主动作语义决策证据，沿 renderer→apply→snapshot→平台事务证明首次 Switch 自动建立基线、Managed Legacy 受管英文恢复及 packaged-content/local-mode 权威分层、已发布未关联 generation 的可重入拓扑、四态版本只读门禁、运行中 fail-before-mutation、无确认直达与完成后打开 Cavalry，冻结单一 Restore English 的证据分级映射与验收合同。
switcher-feedback-copy-catalog-2026-08-29.md: Switcher 四语反馈语义目录，区分生产 Event、必要 AlertDialog、已接入的 About/外链 Toast 与后端事件阻塞；冻结安装验证失败的重开优先/官方重装兜底、Managed Legacy 的非官方承诺、旧/新/未知版本提示，以及更新可用和持续阻塞不重复 Toast。
pr3-macos-release-hardening-session-handoff-2026-07-30.md: PR #3 macOS 发布加固复盘与维护交接，压缩八条表面、Onboarding、Transform、验收器假绿、生成物同步、PR/tag 顺序与 Windows live 决策，并固化 macOS producer 源码进 Git、运行证据留 session 的边界。
windows-onboarding-live-validation-session-handoff-2026-07-30.md: Windows Onboarding live 验证复盘，记录 Qt test profile 登录/工作区隔离、MainDock settle、真实 Next 页面确认、exact-PID/HWND helper、step 5 ACK-only、证据封存边界，以及同 PR 已落地的 macOS driver/helper 对应实现。
windows-adjacent-producer-live-validation-session-handoff-2026-07-31.md: Windows Tag/Assets 三语真实 producer 验证交接，记录 Qt test profile、独立 acceptance plugin、Drop/ContextMenu 语义 driver、producer-side PNG、PID/HWND 锚点、exact child cleanup、证据哈希与发布隔离边界。
windows-port-session-handoff-2026-07-29.md: Windows x64 适配与发布验收复盘，记录最终 generic/QPA/UAC 架构、PR #28/#29/#30 根因、Node/npm 入口、临时目录所有权、PASS-15-OF-15 证据分级及原始 session 到 Mac 发布的生命周期边界。
windows-state-reconciliation-uninstall-session-handoff-2026-08-01.md: Windows 英文状态对账与卸载语义修复复盘，记录 stale marker 真相模型、控制面/数据面分离、所有权清理、NSIS 两页职责、工作区隔离、被证伪路线与四语实机证据。

依赖边界:
audits 保存阶段性检查结果与实跑记录；不驱动运行时，不决定 gate 通过。

法则: 事实即记录·状态不粉饰·阻塞不隐瞒

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
