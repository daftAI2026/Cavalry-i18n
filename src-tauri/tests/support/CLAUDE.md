# support/
> L2 | 父级: ../CLAUDE.md

成员清单
windows_disposable.rs: Windows ignored smoke 的共享路径安全边界；只接受显式环境变量指向的 `%TEMP%` 严格子目录和 disposable sentinel，把 drive/verbatim/8.3 拼写统一为规范路径身份，并对安装根、证据根、JSON/plugin/marker 及 QPA root/recovery/固定临时目标执行 canonical containment 与逐级 reparse 拒绝；另以固定 magic sentinel 排他准备/清理 Qt test profile 的 Local/Roaming `qttest/Cavalry`。
windows_live_capture.inc.rs: Windows live smoke 的公共捕获分片；定义 exact-PID helper 协议、Onboarding 五步 ready/ack、主窗截图封存与共享证据数据结构；cleanup 先投递 WM_CLOSE，超时只对再次复核的同 executable/PID ForceStop。
windows_live_adjacent.inc.rs: Adjacent 消费者协议分片；独立复核 Tag/Assets 三语 oracle、write-once ready/ack/done、双动态 stem、producer PNG 与两逻辑点完整性。
windows_live_orchestration.inc.rs: live-clone 事务编排分片；管理语言 apply、Qt test profile、acceptance-only plugin 临时安装、exact-PID/HWND 进程清理、English 字节恢复与失败回环，并把 `tools/macos-acceptance/fixtures` 的两枚最小 PNG 作为双平台 Assets producer 输入冻结到每语唯一 stem。
windows_live_tests.inc.rs: Windows live 门入口分片；冻结 helper/driver 禁用原语、Qt profile/Next 转场/清理顺序，在每个 disposable gate 前后逐字节证明真实 `%LOCALAPPDATA%/Cavalry/workspace.json` 未变化，并暴露 full-surface、Onboarding、Adjacent 三个 ignored 人工像素复核门。

依赖边界:
support 只服务 ignored integration smoke；`windows_disposable.rs` 不启动进程，四个 `windows_live_*.inc.rs` 只作为父测试模块的职责分片编译，可调用既有 apply/runner，并只读消费 `tools/macos-acceptance/fixtures` 两枚跨平台最小 Assets PNG；所有写入、插件临时部署和 PID 清理都必须经过显式 `%TEMP%` sentinel 与精确身份守卫。

法则: 显式目标·双重证明·逐目标守卫·破坏性兜底只限 exact disposable PID

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
