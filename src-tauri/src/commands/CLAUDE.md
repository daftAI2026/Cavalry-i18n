# commands/
> L2 | 父级: ../CLAUDE.md

成员清单
apply.rs: 语言写入事务编排；保持 `apply_language_inner` 公开测试 seam；Switch/Restore 在共享 operation lock 内按当前选择静默收敛本工具 journal，再执行完整身份、English 基线与写入证明；macOS 共用只读 exact-PID admission，不替用户关闭 Cavalry，并在首个 mutation 前复核；Windows 生产/测试共用 pair 构造，Program Files 恢复继续走 same-EXE RunAs；macOS stock runtime 中任一旧 Switcher 外置签名组件均按自有路径进入 durable cleanup；已由 snapshot/runtime postimage 证明的 Managed 安装即使 strict codesign 漂移也可进入正常事务重签；单一 Restore 意图由后端按已验证 official baseline 或 Managed Legacy 快照选择真实恢复路径；App Management 只由事务层 typed PermissionDenied 进入 renderer。
context.rs: Tauri 应用路径与资源候选解析；复用 root 级 runtime_paths，把 repo、state、Resources 以及 `_up_` 打包布局统一为 command 可消费的路径上下文，并只发布固定四语 manifest。
contract.rs: renderer 兼容 DTO、九命令常量与操作事件合同；集中 camelCase JSON、稳定 error/warning codes，以及携带有限 CSS forward/return rect 的 App Management handoff、四态版本兼容和保留为固定中性值的旧状态字段；启动 DTO 不证明 official/managed、snapshot、权限或 journal，旧 Switcher 签名副作用只属后端兼容事务；Channel 失败不改变已提交事务，facade 返回前清空原文。
restart.rs: 重启 command 编排；同步持久 state 后用安装真相只读投影 stale Windows marker，再委托 platform_runtime；`apply_language` 在同一 operation guard 内复用它，避免 renderer 竞态；独立 Restart 不探测或恢复语言事务 journal。
snapshot.rs: English 安装真相与快照/provenance 闸门；macOS 只从 clean vendor identity/signature 建 unified baseline generation，但首次 Apply 会直接复用 snapshot_legacy 严格证明的 JSON-only Managed Legacy generation，绝不从当前翻译安装重复捕获；所有 snapshot/runtime 证明只在用户语言动作内执行；state durability warning 锁定 renderer mutation，内部显式 refresh seam 即使 snapshot state no-op 也重新 fsync state 目录，成功后才解除；Windows 以 38 份 JSON + 精确原厂 QPA 识别厂商重装造成的 stale marker/runtime；renderer 不直接调用 snapshot mutation。
snapshot_legacy.rs: 兼容旧 `state_dir/en` 快照与不完整 provenance；macOS 只接受 p1-p5 精确 wrapper、三组已发布 injector 代码身份、匹配 marker、完整 Keychain postimage、历史 state/revision 与 packaged-English keyed overlay，证明为 Managed Legacy 而不声称拥有 vendor preimage，并以无路径 reason code 报告快照/runtime 首个失败门；首次 Apply/Restore 将旧 English 提升为 mode-bound JSON-only immutable generation；权限阻断若发生在 generation 发布后、provenance 提交前，下一次事务严格复证并关联同一 generation，后续仍以该 generation + postimage 复证，绝不把它升级成虚假的 official baseline。Windows 继续要求 QPA/vendor 证据。
snapshot_tests.rs: snapshot.rs 的隔离测试合同；覆盖 state durability、Managed Legacy 基线复用边界、refresh 零写入、Windows residue/recovery fail-closed 与 pending recovery 所有权，不进入生产 command surface。
status.rs: 启动只读观察与安装选择 owner；只读取保存选择、发现安装、展示版本和当前语言 marker，并纯函数投影版本兼容性；不探测 journal、签名、runtime、English snapshot、Cavalry 进程或写权限，不制造 Reinstall/Official/Managed 分类；旧 DTO 证明字段固定中性值，真实准入、恢复路径、权限和 Windows residue 均由用户触发的语言事务裁决。
tests.rs: commands 基础契约 owner tests；覆盖 DTO、锁、marker、snapshot、四阶段真实 apply/clean-English no-op 边界、稳定 manifest、RAII 未完成阶段收口与 Tauri Channel rejection 隔离，并挂载运行时领域子模块。
tests/runtime.rs: 打包资源、语言 apply 与 macOS/Windows restart 边界回归；Windows 断言 QPA ACTIVE 且子进程环境只含诊断 marker，复用父级 fixture，不在磁盘写魔法 ACTIVE sentinel。
update.rs: Switcher 自更新领域边界；通过官方 updater plugin 检查版本并把待验证的 `Update` 仅保存在 Rust State，renderer 只取得脱敏 camelCase DTO；安装命令拒绝外部 URL/签名/版本输入，与语言写入共用全局 operation lock，并以 camelCase Channel 只发送 downloading、verifying/installing、restarting 三个真实边界，其中下载结束回调先于签名验证，故绝不虚构独立 verified 事件，Channel 失效也不改变更新事务。

法则: facade 只保留稳定命令与兼容 seam；领域逻辑按状态、快照、写入、平台运行时单向下沉。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
