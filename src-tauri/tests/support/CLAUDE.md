# support/
> L2 | 父级: ../CLAUDE.md

成员清单
windows_disposable.rs: Windows ignored smoke 的共享路径安全边界；只接受显式环境变量指向的 `%TEMP%` 严格子目录和 disposable sentinel，把 drive/verbatim/8.3 拼写统一为规范路径身份，并对安装根、证据根、JSON/plugin/marker 及 QPA root/recovery/固定临时目标执行 canonical containment 与逐级 reparse 拒绝；另以固定 magic sentinel 排他准备/清理仅供 Onboarding/Adjacent 使用的 Local/Roaming `qttest/Cavalry`，FullSurfaces 的 owned profile 由编排分片直接创建于 run-root。
windows_clone_guard.rs: Windows live clone 的关键资源安全边界；启动前检查 `assets/Icons/sign-in-bg.png`、`cavByCanva.png`、`tool_search.png` 为非空普通文件并把字节哈希写入 evidence；不读取、不写入真实用户 profile。
windows_live_capture.inc.rs: Windows live smoke 的公共捕获分片；定义 exact-PID helper 协议、Onboarding 五步 ready/ack、主窗截图封存与共享证据数据结构（含 PID/HWND）；cleanup 先投递 WM_CLOSE，超时只对再次复核的同 executable/PID ForceStop。
windows_live_adjacent.inc.rs: Adjacent 消费者协议分片；独立复核 Tag/Assets 三语 oracle、write-once ready/ack/done、双动态 stem、producer PNG 与两逻辑点完整性。
windows_live_orchestration.inc.rs: live-clone 事务编排分片；管理语言 apply、FullSurfaces 的 TEMP-owned profile、仅 Onboarding/Adjacent 使用的 Qt test profile、可在 English 清理移除空目录后安全重建 `generic/` 并仅回收本次创建目录的 acceptance-only plugin 临时事务、exact-PID/HWND 进程清理、English 字节恢复，并把 `tools/macos-acceptance/fixtures` 的两枚最小 PNG 作为双平台 Assets producer 输入冻结到每语唯一 stem。
windows_live_toolchain.inc.rs: release machine record 的 Windows 工具链命令边界；优先以活动 Node 执行 `npm_execpath`，仅在缺失时用固定 `cmd.exe` 命令解析 PATH shim，兼容 MSI、Volta 等安装布局并提供红绿回归门。
windows_live_tests.inc.rs: Windows live 门入口分片；冻结 helper/driver 禁用原语、profile/Next 转场/清理顺序，在每个 disposable gate 前调用 clone 关键资源 hash guard，并暴露 FullSurfaces、Onboarding、Adjacent 三个 ignored 人工像素复核门；显式 release 环境下只在清理成功后调用 toolchain 分片写入 machine record/inventory，绝不写人工 PASS。

依赖边界:
support 只服务 ignored integration smoke；`windows_disposable.rs` 不启动进程，五个 `windows_live_*.inc.rs` 只作为父测试模块的职责分片编译，可调用既有 apply/runner，并只读消费 `tools/macos-acceptance/fixtures` 两枚跨平台最小 Assets PNG；所有写入、插件临时部署和 PID 清理都必须经过显式 `%TEMP%` sentinel 与精确身份守卫。

法则: 显式目标·双重证明·逐目标守卫·破坏性兜底只限 exact disposable PID

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
