# commands/
> L2 | 父级: ../CLAUDE.md

成员清单
patch_receipt.rs: 已应用补丁的历史源身份；随包语言、平台 runtime、wrapper 与 Switcher 版本构成内容地址，严格绑定安装根/宿主 revision/语言，版本比较只读，不写成功状态。
patch_receipt_storage.rs: 私有补丁 generation 存储；按规范相对路径逐文件验证摘要/模式及闭合集合，拒绝 symlink 与内容漂移，发布新目录而不覆盖旧历史源。
patch_receipt_tests.rs: generation 发布/旧版本重读与源变化合同；与 status/真实 clone 升级测试分层，不将孤立 generation 当作成功回执。
apply.rs: 语言写入事务编排；macOS 受管态先判定是否存在完整 vendor/English baseline，旧 JSON-only provenance 即使沿用历史 revision 格式也返回稳定 `reinstallRequired`；只有基线完整时才比较 state/path/revision 与 marker，绑定、受管 runtime postimage 或 marker drift 均安全拒绝而不误报重装；旧 wrapper/injector 仅作为普通 0755 安全替换槽，不要求历史版本身份，非 English 每次从当前 package 重建 runtime，Official Restore 从 baseline 精确还原/删除；Windows legacy provenance 迁移不受该 macOS 门影响；候选源冻结后才写安装，成功完成时才原子提交补丁回执，原厂恢复清除回执；保持 `apply_language_inner` 公开测试 seam；Switch/Restore 在共享 operation lock 内按当前选择静默收敛本工具 journal，再执行完整身份、English 基线与写入证明；macOS 共用只读 exact-PID admission，不替用户关闭 Cavalry，并在首个 mutation 前复核；Windows 生产/测试共用 pair 构造，Program Files 恢复继续走 same-EXE RunAs；stock runtime 外置签名组件按自有路径进入 durable cleanup；已由 official baseline 验证的 managed vendor postimage 即使 strict codesign 漂移也可进入正常事务重签；App Management 只由事务层 typed PermissionDenied 进入 renderer。
context.rs: Tauri 应用路径与资源候选解析；复用 root 级 runtime_paths，把 repo、state、Resources 以及 `_up_` 打包布局统一为 command 可消费的路径上下文，并只发布固定四语 manifest。
contract.rs: 含 patchStatus 四态只读版本投影的 renderer 兼容 DTO、九命令常量与操作事件合同；集中 camelCase JSON、稳定 `reinstallRequired`/权限/其它 error-warning codes，以及携带有限 CSS forward/return rect 的 App Management handoff、四态版本兼容和保留为固定中性值的旧状态字段；启动 DTO 不证明 official/managed、snapshot、权限或 journal，旧 Switcher 签名副作用只属后端兼容事务；Channel 失败不改变已提交事务，facade 返回前清空原文。
restart.rs: 重启 command 编排；同步持久 state 后用安装真相只读投影 stale Windows marker，再委托 platform_runtime；`apply_language` 在同一 operation guard 内复用它，避免 renderer 竞态；独立 Restart 不探测或恢复语言事务 journal。
snapshot.rs: English 安装真相与快照/provenance 闸门；macOS 只从 clean vendor identity/signature 捕获包含 JSON 与原厂 runtime preimage 的 unified baseline，不从旧 JSON-only snapshot 推断管理权；所有 snapshot/runtime 证明只在用户语言动作内执行；state durability warning 锁定 renderer mutation，内部显式 refresh seam 即使 snapshot state no-op 也重新 fsync state 目录，成功后才解除；Windows 以 38 份 JSON + 精确原厂 QPA 识别厂商重装造成的 stale marker/runtime；renderer 不直接调用 snapshot mutation。
snapshot_legacy.rs: Windows legacy JSON/QPA 安装的只读可信识别与 apply-only immutable English generation 迁移；macOS 不编译该兼容子模块，不接受 JSON-only backup、历史 wrapper/injector pair 或旧回执代替完整 official vendor baseline；Windows 继续要求 QPA/vendor 证据。
snapshot_tests.rs: snapshot.rs 的隔离测试合同；覆盖 state durability、macOS official baseline capture、refresh 零写入、Windows residue/recovery fail-closed 与 pending recovery 所有权，不进入生产 command surface。
status.rs: 启动只读观察与安装选择 owner；非 English 安装按回执/root/revision/源摘要投影 current/updateAvailable/unknown，缺证据保留重应用入口且不制造成功状态；读取保存选择、发现安装、展示版本和当前语言 marker，并纯函数投影版本兼容性；English 状态以跨平台 raw marker 检查保留未提交事务的 Restore 入口，Windows 再叠加有界 QPA/generic 残留检查，pending/非法 marker 或无法证明清理时交给事务层 fail closed；不探测 journal、签名、English snapshot、Cavalry 进程或写权限，不制造 Reinstall/Official/Managed 分类，真实准入、恢复路径和权限仍由用户触发的语言事务裁决。
tests.rs: commands 基础契约 owner tests；验证缺少补丁回执的旧安装不被误判最新，覆盖 macOS P4/P5 形态的 JSON-only provenance 优先重装分类与完整基线绑定漂移拒绝、DTO、锁、marker、Windows pending marker/English runtime residue 只读投影、snapshot、四阶段真实 apply/clean-English no-op 边界、稳定 manifest、RAII 未完成阶段收口与 Tauri Channel rejection 隔离，并挂载运行时领域子模块。
tests/runtime.rs: macOS apply fixture 与 Windows DLL/语言资源解析分开验证，覆盖打包资源、语言 apply 与 macOS/Windows restart 边界回归；Windows 断言 QPA ACTIVE 且子进程环境只含诊断 marker，复用父级 fixture，不在磁盘写魔法 ACTIVE sentinel。
update.rs: Switcher 自更新领域边界；通过官方 updater plugin 检查版本并把待验证的 `Update` 仅保存在 Rust State，renderer 只取得脱敏 camelCase DTO；安装命令拒绝外部 URL/签名/版本输入，与语言写入共用全局 operation lock，并以 camelCase Channel 只发送 downloading、verifying/installing、restarting 三个真实边界，其中下载结束回调先于签名验证，故绝不虚构独立 verified 事件，Channel 失效也不改变更新事务。

法则: facade 只保留稳定命令与兼容 seam；领域逻辑按状态、快照、写入、平台运行时单向下沉。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
