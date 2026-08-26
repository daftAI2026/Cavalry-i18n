# windows_qpa/
> L2 | 父级: ../CLAUDE.md

成员清单
contract.rs: QPA manifest 与普通/提升写入共用的 hash-locked Activate/EnglishRestore/Noop schema；manifest 字节只从对应 plan 投影，固定 Cavalry/Qt/架构与原厂 qwindows 身份。
identity.rs: QPA 只读身份域；统一验证 Cavalry/Qt/QPA/generic 的 x64 PE、2.7.2/6.6.3 版本与无重解析路径，供计划构建和执行复用。
postimages.rs: QPA 写入所有权投影；按 transition 逐路径列出 vendor/proxy、Prepared/Active/Restoring manifest、原子替换临时态与 cleanup absence，供外层 journal 在首次写入前持久化。
preflight.rs: QPA durable 路径、固定写入表面与纯文件 rollback 表面 owner；在任何 payload 前拒绝 Program Files、重解析点、不可创建/删除的 install/recovery 目录及不可写现有 manifest/backup/qwindows，探针成功后无残留。
restore.rs: 显式 English 收敛域；复用 contract 唯一 restoring manifest 投影，恢复原厂 qwindows 并仅删除哈希自有 runtime/recovery，未知文件与厂商更新 fail closed。
storage.rs: Windows 普通文件与重解析点守卫、流式 SHA-256、x64 PE/版本资源证明、durable 新文件发布及同卷 temp + `ReplaceFileW` 原子替换；失败只清理哈希已证明的固定自有临时文件。
transition.rs: QPA transition 适配器；构建显式 English 恢复或安全 Stock Noop，统一执行 Activate/EnglishRestore/Noop；厂商更新始终保留但 fail closed，不把未知 QPA 冒充可启动 English，并以独立 outcome 阻止 worker 认领外部写入。
tests.rs: tempfile Windows 安装根合同；覆盖持久激活、普通关闭不恢复、显式 English 恢复、直接写 preflight、prepared 崩溃态、计划过期、版本拒绝、manifest 严格 schema、缺失 DLL 恢复与未知厂商更新保留后拒绝成功。

依赖边界:
父级 `windows_qpa.rs` 编排持久状态机；contract/identity/postimages 不写文件，postimages 是外层 journal 唯一可接受的写前所有权投影；transition/restore 执行同一 plan，storage 不理解语言选择或 Tauri 状态。Program Files worker 禁止另写截断复制或事后采样认领。

恢复判定: `manifest.json` 仅在真实缺失时允许无 manifest fallback；存在但解析或校验失败必须在任何写入前 fail closed。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
