# windows_qpa/
> L2 | 父级: ../CLAUDE.md

成员清单
contract.rs: QPA manifest 与普通/提升写入共用的 hash-locked Activate/EnglishRestore/Noop schema；manifest 字节只从对应 plan 投影，native profile固定Cavalry 2.8.1/Qt 6.9.2/x64及官方qwindows摘要。
identity.rs: QPA只读身份域；按编译profile验证Cavalry/Qt/QPA/generic的x64身份；native仅接受官方2.8.1 EXE SHA，并在无版本资源时以同一精确SHA回退版本，Qt为6.9.2且拒绝重解析路径。
postimages.rs: QPA 写入所有权投影；按 transition 逐路径列出 vendor/proxy、Prepared/Active/Restoring manifest、原子替换临时态与 cleanup absence，供外层 journal 在首次写入前持久化。
preflight.rs: QPA durable 路径、固定写入表面与纯文件 rollback 表面 owner；在任何 payload 前拒绝 Program Files、重解析点及不可写目录/文件，仅对现有文件的 Windows 共享冲突每 100ms 重试、最多 2 秒，权限拒绝立即失败，探针成功后无残留。
restore.rs: 显式 English 收敛域；复用 contract 唯一 restoring manifest 投影，恢复原厂 qwindows 并仅删除哈希自有 runtime/recovery，未知文件与厂商更新 fail closed。
storage.rs: Windows 普通文件与重解析点守卫、流式 SHA-256、x64 PE/版本资源证明、durable 新文件发布及同卷 temp + `ReplaceFileW` 原子替换；失败只清理哈希已证明的固定自有临时文件。
transition.rs: QPA transition 适配器；构建显式 English 恢复或安全 Stock Noop，统一执行 Activate/EnglishRestore/Noop；厂商更新始终保留但 fail closed，不把未知 QPA 冒充可启动 English，并以独立 outcome 阻止 worker 认领外部写入。
tests.rs: tempfile Windows 安装根合同；覆盖持久激活/English恢复、preflight冲突、prepared崩溃、过期计划、严格manifest与未知厂商漂移；验证FileShare.Read观察者阻断qwindows原子替换、保留Restoring记录并在释放句柄后安全重试；正例绑定编译profile的Cavalry/Qt身份，native负例拒绝旧2.8.0。identity.rs另测官方2.8.1精确EXE SHA回退及旧版/漂移拒绝。

native状态比较：父模块复用严格inspect及manifest读取，对编译期generic/proxy摘要和当前语言marker只读比较；Stock提示更新，Recover/Drifted要求协调，不授予事务写权。
依赖边界:
父级 `windows_qpa.rs` 编排持久状态机；contract/identity/postimages 不写文件，postimages 是外层 journal 唯一可接受的写前所有权投影；transition/restore 执行同一 plan，storage 不理解语言选择或 Tauri 状态。Program Files worker 禁止另写截断复制或事后采样认领。

恢复判定: `manifest.json` 仅在真实缺失时允许无 manifest fallback；存在但解析或校验失败必须在任何写入前 fail closed。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
