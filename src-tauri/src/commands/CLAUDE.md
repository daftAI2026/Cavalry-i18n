# commands/
> L2 | 父级: ../CLAUDE.md

成员清单
apply.rs: 语言写入事务编排；从已证明的 English snapshot 构建 JSON/runtime copy pairs；Windows 先完成资源/版本只读准备，再执行 fail-before-mutation preflight，以 pending marker 起始、QPA ACTIVE/显式 English 恢复后强制提交 final marker；macOS 保持 marker 在 codesign 前的同事务顺序。
context.rs: Tauri 应用路径与资源候选解析；复用 root 级 runtime_paths，把 repo、state、Resources 以及 `_up_` 打包布局统一为 command 可消费的路径上下文。
contract.rs: renderer 兼容 DTO 与六命令常量；集中 camelCase JSON 序列化和稳定警告码到用户文案的映射，禁止把底层临时路径泄漏到 UI。
restart.rs: 重启 command 编排；加载持久 state 后委托 platform_runtime，生产路径只认真实 QPA 检查，测试以显式 inspector seam 覆盖 ACTIVE，保持 renderer 调用路径不含平台 cfg 分支。
snapshot.rs: English 快照/provenance 闸门；仅在安装内容逐叶证明为 packaged English 后提取或刷新来源证据。
status.rs: 安装发现、状态同步与权限动作判定；display version 与 immutable revision/provenance 分离。
tests.rs: commands 基础契约 owner tests；覆盖 DTO、锁、marker、snapshot 与平台无关状态回归，并挂载运行时领域子模块。
tests/runtime.rs: 打包资源、语言 apply 与 macOS/Windows restart 边界回归；Windows 断言 QPA ACTIVE 且子进程环境只含诊断 marker，复用父级 fixture，不在磁盘写魔法 ACTIVE sentinel。

法则: facade 只保留稳定命令与兼容 seam；领域逻辑按状态、快照、写入、平台运行时单向下沉。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
