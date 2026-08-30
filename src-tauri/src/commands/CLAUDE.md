# commands/
> L2 | 父级: ../CLAUDE.md

成员清单
apply.rs: 语言写入事务编排；保持 `apply_language_inner` 公开测试 seam 并用 NoopReporter 包装 reporter 版本；在真实验证、English 基线、跨平台事务提交三个边界使用 RAII phase guard，English 快速返回仅接受无 pending journal 的精确 Clean disposition，stale marker 或未完成 Windows transaction 必须继续 pending→runtime→final 事务；Windows 的生产/测试共用 pair 构造；macOS 官方路径继续使用完整 vendor baseline，而严格证明的 Managed Legacy 只复用 immutable English JSON 与已发布 runtime postimage、仅更新 final marker，绝不从缺失的 vendor preimage 伪造官方恢复。
context.rs: Tauri 应用路径与资源候选解析；复用 root 级 runtime_paths，把 repo、state、Resources 以及 `_up_` 打包布局统一为 command 可消费的路径上下文，并只发布固定四语 manifest。
contract.rs: renderer 兼容 DTO、九命令常量与操作事件合同；集中 camelCase JSON 序列化、稳定 errorCode/可组合 warningCodes，以及 Status 的 `managedLegacy`、`officialRecoveryAvailable`、四态 `versionCompatibility`、`supportedVersion` 与 Windows residue/UAC 投影；`OperationReporter` 是不绑定传输层的报告 trait，固定四阶段真实事件，Channel 关闭或发送失败只丢弃进度通知，不改变已提交事务；facade 返回前清空原文，禁止把底层临时路径泄漏到 UI。
restart.rs: 重启 command 编排；同步持久 state 后用安装真相只读投影 stale Windows marker，再委托 platform_runtime；`apply_language` 在同一 operation guard 内复用它，避免 renderer 竞态。
snapshot.rs: English 安装真相与快照/provenance 闸门；macOS 只从 clean vendor identity/signature 建 unified baseline generation，状态轮询只读；state durability warning 锁定 renderer mutation，内部显式 refresh seam 即使 snapshot state no-op 也重新 fsync state 目录，成功后才解除；Windows 以 38 份 JSON + 精确原厂 QPA 识别厂商重装造成的 stale marker/runtime，单次 snapshot gate 同时返回分类；renderer 不直接调用 snapshot mutation，首次 Apply 在写入前自动建立基线。
snapshot_legacy.rs: 兼容旧 `state_dir/en` 快照与不完整 provenance；macOS 只接受 p1-p5 精确 wrapper、三组已发布 injector 代码身份、匹配 marker、完整 Keychain postimage、历史 state/revision 与 packaged-English keyed overlay，证明为 Managed Legacy 而不声称拥有 vendor preimage；首次 Apply/Restore 将旧 English 提升为 mode-bound JSON-only immutable generation，后续仍以同一 generation + postimage 复证，绝不把它升级成虚假的 official baseline。Windows 继续要求 QPA/vendor 证据。
snapshot_tests.rs: snapshot.rs 的隔离测试合同；覆盖 state durability、refresh 零写入、Windows residue/recovery fail-closed 与 pending recovery 所有权，不进入生产 command surface。
status.rs: 安装发现、只读状态投影、显式 control-state recovery 与权限动作判定；display version 与 immutable revision/provenance 分离，Cavalry 版本按 supported/older/newer/unknown 四态投影且非支持版本永不进入 mutation 准备；安装选择写入必须确认 state 目录耐久性；macOS official 模式要求 vendor signature，Managed Legacy 要求已发布 postimage 与旧/已迁移 English generation 双重证明，并独立报告 official recovery 能力；Windows status 继续从安装现实重算 residue。
tests.rs: commands 基础契约 owner tests；覆盖 DTO、锁、marker、snapshot、四阶段真实 apply/clean-English no-op 边界、稳定 manifest、RAII 未完成阶段收口与 Tauri Channel rejection 隔离，并挂载运行时领域子模块。
tests/runtime.rs: 打包资源、语言 apply 与 macOS/Windows restart 边界回归；Windows 断言 QPA ACTIVE 且子进程环境只含诊断 marker，复用父级 fixture，不在磁盘写魔法 ACTIVE sentinel。
update.rs: Switcher 自更新领域边界；通过官方 updater plugin 检查版本并把待验证的 `Update` 仅保存在 Rust State，renderer 只取得脱敏 camelCase DTO；安装命令拒绝外部 URL/签名/版本输入，与语言写入共用全局 operation lock，并以 camelCase Channel 只发送 downloading、verifying/installing、restarting 三个真实边界，其中下载结束回调先于签名验证，故绝不虚构独立 verified 事件，Channel 失效也不改变更新事务。

法则: facade 只保留稳定命令与兼容 seam；领域逻辑按状态、快照、写入、平台运行时单向下沉。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
