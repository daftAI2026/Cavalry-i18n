# drivers/
> L2 | 父级: ../CLAUDE.md

成员清单

macos_main_acceptance_driver.mm: 普通 Qt 表面的唯一编译入口，按职责聚合 main 场景分片。
macos_main_common.inc: 主场景共享的语言 oracle、严格拓扑、身份校验与异步 ready→capture→ack 事务。
macos_main_entry.inc: 等待真实 MainDock 稳定后按 scenario 分派主场景状态机。
macos_main_save.inc: 从 ColorWindow 当前语言 Generator 页打开 owner-scoped 菜单并证明 Save。
macos_main_save_replace.inc: 用冻结双 stem fixture 驱动 Assets Drop、Replace 与 Create 动态模板。
macos_main_search_tag.inc: 以目标控件有界就绪驱动 Search、Add Layer、Scene Statistics、Add Tag 与 Assign Tag 的真实 owner 表面，并以同窗 GroupButton 内唯一可见 Update 标签阻断相邻翻译回归。
macos_main_tracking.inc: 从唯一新增 MP4 素材行推进 Scene、Tracking 设置与向前跟踪对话框。
macos_supplemental_acceptance_driver.mm: Onboarding 五步与 Transform 五条自绘 action 的补充语义驱动和终态编排。
macos_supplemental_capture.inc: supplemental 场景不阻塞产品主线程的 write-once ready/ack 截图事务。
macos_supplemental_onboarding_trigger.inc: 通过真实 Guide QAction、OnboardingChoiceView 与 firstLaunch signal 打开产品引导。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
