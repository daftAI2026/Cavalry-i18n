# commands/
> L2 | 父级: ../CLAUDE.md

成员清单
apply.rs: 语言写入事务编排；从已证明的 English snapshot 构建 JSON/runtime copy pairs，以 pending marker 起始、最终语言 marker 收尾，并将结构化提交后清理告警投影为 renderer 安全文案。
context.rs: Tauri 应用路径与资源候选解析；把 repo、state、Resources 以及 `_up_` 打包布局统一为 command 可消费的路径上下文。
contract.rs: renderer 兼容 DTO 与六命令常量；集中 camelCase JSON 序列化和稳定警告码到用户文案的映射，禁止把底层临时路径泄漏到 UI。
lock.rs: 单安装根 mutation 锁；为 extract/apply/restart 提供进程内与 macOS 文件锁，避免交错事务伪装为成功。
restart.rs: 重启 command 编排；加载持久 state 后委托 platform_runtime，保持 renderer 调用路径不含平台 cfg 分支。
snapshot.rs: English 快照/provenance 闸门；仅在安装内容逐叶证明为 packaged English 后提取或刷新来源证据。
status.rs: 安装发现、状态同步与权限动作判定；display version 与 immutable revision/provenance 分离。
tests.rs: commands 基础契约 owner tests；覆盖 DTO、锁、marker、snapshot 与平台无关状态回归，并挂载运行时领域子模块。
tests/runtime.rs: 打包资源、语言 apply 与 macOS/Windows restart 边界回归；复用父级 fixture，不重建第二套测试基础设施。

法则: facade 只保留稳定命令与兼容 seam；领域逻辑按状态、快照、写入、平台运行时单向下沉。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
