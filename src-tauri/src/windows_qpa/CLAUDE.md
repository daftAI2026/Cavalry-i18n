# windows_qpa/
> L2 | 父级: ../CLAUDE.md

成员清单
contract.rs: QPA manifest 与普通/提升写入共用的 hash-locked Activate/EnglishRestore/Noop transition schema；固定 Cavalry 2.7.2、所选 Cavalry.exe 摘要、Qt 6.6.3、x86_64、原厂 qwindows 摘要，并让主动恢复原因只能表达明确 English 选择。
identity.rs: QPA 只读身份域；统一验证 Cavalry/Qt/QPA/generic 的 x64 PE、2.7.2/6.6.3 版本与无重解析路径，供计划构建和执行复用。
preflight.rs: QPA durable 路径、固定写入表面与纯文件 rollback 表面 owner；在任何 payload 前拒绝 Program Files、重解析点、不可创建/删除的 install/recovery 目录及不可写现有 manifest/backup/qwindows，探针成功后无残留。
storage.rs: Windows 普通文件与重解析点守卫、流式 SHA-256、x64 PE/版本资源证明、durable 新文件发布及同卷 temp + `ReplaceFileW` 原子替换；失败只清理哈希已证明的固定自有临时文件。
transition.rs: QPA transition 适配器；构建显式 English 恢复或安全 Stock Noop，统一执行 Activate/EnglishRestore/Noop；厂商更新始终保留但 fail closed，不把未知 QPA 冒充可启动 English，并以独立 outcome 阻止 worker 认领外部写入。
tests.rs: tempfile Windows 安装根合同；覆盖持久激活、普通关闭不恢复、显式 English 恢复、直接写 preflight、prepared 崩溃态、计划过期、版本拒绝、manifest 严格 schema、缺失 DLL 恢复与未知厂商更新保留后拒绝成功。

依赖边界:
父级 `windows_qpa.rs` 编排持久状态机；contract/identity 不写文件，transition 只表达既有激活与显式 English 语义，preflight 只证明直接写能力，storage 不理解语言选择或 Tauri 状态，tests 不读取真实 Cavalry。Program Files 提升 worker 必须消费同一 transition 并回到父级 execute API，禁止另写截断复制或“关闭即恢复”路径。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
