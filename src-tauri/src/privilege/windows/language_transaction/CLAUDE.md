# language_transaction/
> L2 | 父级: ../CLAUDE.md

成员清单
mod.rs: Windows Program Files 语言事务模块根；组织共享合同、父进程、same-EXE launcher、编译期来源证明、提权 worker 与 durable journal，不暴露任意复制目标。
contract.rs: 提权 plan v1 与固定退出码真相源；绑定安装根、语言、worker/payload/QPA 摘要，并拒绝未知字段、非规范路径与错误 marker 连续 preimage。
contract_tests.rs: plan/transport 纯合同测试；覆盖四语言 wire value、payload/QPA 绑定、有界输入与 reserved argv fail-closed。
transport.rs: 单一 ASCII-safe opaque token 编解码；以 UTF-16LE 路径、plan hash、nonce 和 worker EXE hash 绑定同一事务。
launcher.rs: 父进程唯一 RunAs 边界；通过 ShellExecuteExW 启动当前 EXE、隐藏窗口，区分确定未启动与已启动但结果未知，并结构化返回取消或 worker 退出码。
parent.rs: 非提权父进程编排；在旧 close/copy 前识别 OS-known Program Files，严格 staging 固定 payload；全量目标与 QPA Noop 只读证明一致时零 UAC 提交，否则只调用一次 launcher，已启动后结果未知则保留绑定 staging。
parent_mapping.rs: 父进程 JSON 目标授权；只接受 CORE_MAP、当前存在的 PLUGIN_DEFINITION_MAP 与实时普通 plugin strings 对应的 assets-relative ID。
parent_storage.rs: 父进程 staging/哈希与保守清理；来源以独占句柄复制并同步摘要，UAC 后只删除固定 plan、数字 payload、已绑定 overlay 与已知空目录。
parent_tests.rs: 父进程隔离合同；覆盖 NotApplicable、取消、零 UAC Noop、启动前清理、启动后 staging 保留、0/42/43/44/未知、严格映射与连续 marker preimage。
source_provenance.rs: worker 写入前的只读来源证明；从当前 EXE 有界上溯近邻包根，以编译期四语/runtime 摘要验证普通文件，重建 current→anchored English→target exact overlay 与 QPA action。
source_provenance_tests.rs: 来源证明对抗合同；覆盖自洽恶意 x64 DLL、字符串/marker 篡改、正确 overlay、四语 catalog 与缺失/重解析 package root。
source_provenance_parent_tests.rs: patch/parent/verifier 端到端合同；覆盖 zh-Hans→ja、Windows canonical English、真实数字 staging 与 prepare 后篡改拒绝。
storage.rs: worker durable journal；只认领本事务 payload postimage，QPA 固定 preimage 仅用于漂移检测；正向和回滚均通过目标独占句柄完成 CAS 与变更，全部确定后才恢复 marker，未知当前内容永不被旧备份覆盖。
destination_io.rs: 正向写入与回滚共用的目标文件 I/O 原语；以 FileShare.None 在同一句柄内完成 hash CAS、覆盖/handle-bound 删除与 postcondition，禁止校验后按路径重开。
journal_cleanup.rs: durable journal 精确清理内核；只枚举并非递归删除固定 `journal.state` 与有界数字 preimage，未知成员、目录、重解析点或越界路径全部保留。
storage_tests.rs: durable journal tempfile 合同；覆盖连续 marker、目标漂移、未知 QPA postimage、marker-last fail-closed、未知 journal 成员保留与 clean commit。
worker.rs: 同一 EXE 的提权 headless worker；重解 Known Folder/固定目标并在关闭 Cavalry 前验证固定 package provenance，再执行 pending→payload→QPA→pre-final proof→final，绝不写 state、重启或获取外层 operation lock。

法则: UAC 只授予固定 Program Files 语言事务；父进程不关闭/写安装根，worker 不接受 CopyPair/任意 destination，不启动提升态 Cavalry；只有 0/42 可由父进程验证后提交应用 state。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
