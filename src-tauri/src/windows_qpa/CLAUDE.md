# windows_qpa/
> L2 | 父级: ../CLAUDE.md

成员清单
contract.rs: QPA manifest 与普通/未来提升写入共用的 hash-locked 计划 schema；固定 Cavalry 2.7.2、所选 Cavalry.exe 摘要、Qt 6.6.3、x86_64、原厂 qwindows 摘要，并让恢复原因只能表达明确 English 选择。
preflight.rs: QPA durable 路径与固定写入表面 owner；在任何 payload 前拒绝 Program Files、重解析点、不可创建/删除的 install/recovery 目录及不可写现有 manifest/backup/qwindows，探针成功后无残留。
storage.rs: Windows 普通文件与重解析点守卫、流式 SHA-256、x64 PE/版本资源证明、durable 新文件发布及同卷 temp + `ReplaceFileW` 原子替换；失败只清理哈希已证明的固定自有临时文件。
tests.rs: tempfile Windows 安装根合同；覆盖持久激活、普通关闭不恢复、显式 English 恢复、直接写 preflight、prepared 崩溃态、计划过期、版本拒绝、manifest 严格 schema、缺失 DLL 恢复与厂商更新漂移保留。

依赖边界:
父级 `windows_qpa.rs` 编排状态机；contract 不写文件，preflight 只证明直接写能力，storage 不理解语言选择或 Tauri 状态，tests 不读取真实 Cavalry。当前 Program Files fail-closed；后续提升 worker 必须消费 contract 的同一计划并回到父级 execute API，禁止另写截断复制路径。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
