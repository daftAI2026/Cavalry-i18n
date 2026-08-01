# commands/
> L2 | 父级: ../CLAUDE.md

成员清单
apply.rs: 语言写入事务编排；以长度、只读位、Unix mode 与内容筛除未变化 pair，Windows 从已证明的 English snapshot 为四语言统一生成 canonical pretty overlay，使 Program Files source provenance 可精确重建，并把任意安装根写入前 Cavalry 仍运行统一投影为稳定 errorCode；自定义可写根仍以 pending→QPA→final 顺序直写，macOS English 继续复制原始 snapshot。
context.rs: Tauri 应用路径与资源候选解析；复用 root 级 runtime_paths，把 repo、state、Resources 以及 `_up_` 打包布局统一为 command 可消费的路径上下文。
contract.rs: renderer 兼容 DTO 与六命令常量；集中 camelCase JSON 序列化、稳定 errorCode 与警告码到用户文案的映射，禁止把底层临时路径泄漏到 UI。
restart.rs: 重启 command 编排；同步持久 state 后用安装真相只读投影 stale Windows marker，再委托 platform_runtime，生产路径只认真实 QPA 检查。
snapshot.rs: English 安装真相与快照/provenance 闸门；Windows 以 38 份 JSON + 精确原厂 QPA 识别厂商重装造成的 stale marker/runtime，状态轮询只读，刷新则在采集后复用 English 事务收敛。
status.rs: 安装发现、状态同步与权限动作判定；display version 与 immutable revision/provenance 分离，已证明 stale English 仅投影 UI/state 消费值而不写安装根。
tests.rs: commands 基础契约 owner tests；覆盖 DTO、锁、marker、snapshot 与平台无关状态回归，并挂载运行时领域子模块。
tests/runtime.rs: 打包资源、语言 apply 与 macOS/Windows restart 边界回归；Windows 断言 QPA ACTIVE 且子进程环境只含诊断 marker，复用父级 fixture，不在磁盘写魔法 ACTIVE sentinel。

法则: facade 只保留稳定命令与兼容 seam；领域逻辑按状态、快照、写入、平台运行时单向下沉。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
