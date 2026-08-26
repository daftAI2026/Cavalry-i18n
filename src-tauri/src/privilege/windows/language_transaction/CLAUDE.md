# language_transaction/
> L2 | 父级: ../CLAUDE.md

成员清单
mod.rs: Windows Program Files 语言事务模块根；组织共享合同、父进程、same-EXE launcher、编译期来源证明、提权 worker 与 durable journal，不暴露任意复制目标。
contract.rs: 提权 plan v1 与固定退出码真相源；分别绑定 apply 的 plan/nonce 摘要与 recovery 的已验证安装根，两者都绑定 worker EXE hash，并拒绝未知字段、非规范路径与错误 marker 连续 preimage。
contract_tests.rs: plan/transport 纯合同测试；覆盖四语言 wire value、payload/QPA 绑定、apply/recovery reserved argv、有界输入与 fail-closed。
transport.rs: 两类 ASCII-safe opaque token 编解码；apply 绑定 UTF-16LE plan path/hash/nonce/worker，recovery 只绑定 UTF-16LE install root/worker hash。
launcher.rs: 父进程唯一 RunAs 边界；为 apply/recovery 构造各自固定单参数，通过 ShellExecuteExW 启动当前 EXE并结构化返回取消或 worker 退出码。
parent.rs: 非提权父进程编排；在旧 close/copy 前识别 OS-known Program Files，严格 staging 固定 payload；仅当无 pending journal、全量目标与 QPA Noop 只读证明同时一致时零 UAC 提交，否则只调用一次 launcher 先恢复再应用，并把 45 投影为可重试 StillRunning，已启动后结果未知则保留绑定 staging。
parent_mapping.rs: 父进程 JSON 目标授权；只接受 CORE_MAP、当前存在的 PLUGIN_DEFINITION_MAP 与实时普通 plugin strings 对应的 assets-relative ID。
parent_storage.rs: 父进程 staging/哈希与保守清理；来源以独占句柄复制并同步摘要，UAC 后只删除固定 plan、数字 payload、已绑定 overlay 与已知空目录。
parent_tests.rs: 父进程隔离合同；覆盖 NotApplicable、取消、无 journal 的零 UAC Noop、pending journal 强制 worker、启动前清理、启动后 staging 保留、0/42/43/44/45/未知、严格映射与连续 marker preimage。
source_provenance.rs: worker 写入前的只读来源证明；从当前 EXE 有界上溯近邻包根，以编译期四语/runtime 摘要验证普通文件，重建 current→anchored English→target exact overlay 与 QPA action。
source_provenance_tests.rs: 来源证明对抗合同；覆盖自洽恶意 x64 DLL、字符串/marker 篡改、正确 overlay、四语 catalog 与缺失/重解析 package root。
source_provenance_parent_tests.rs: patch/parent/verifier 端到端合同；覆盖 zh-Hans→ja、Windows canonical English、真实数字 staging 与 prepare 后篡改拒绝。
path_validation.rs: live apply 与 recovery 共用的路径/摘要准入；将 install root containment、root/self 与 dot traversal 拒绝、逐组件 reparse 检查及 lowercase SHA-256 格式收敛为单一 fail-closed 合同。
journal_manifest.rs: 版本化 `journal.state`/`.tmp` 崩溃恢复真相；manifest 以 no-share + OPEN_REPARSE_POINT 句柄读取/写入并严格验证每个 entry 的路径、pre/postimage、backup、权限与 phase，只接受单一 durable generation 或内容一致的双代，并决定下次启动的 commit/rollback/cleanup。
storage.rs: worker durable journal 与 handle-bound CAS 编排；只消费写前声明的精确 postimage，文件回滚前恢复由 preimage 证明的原始父目录，全部确定后才恢复 marker，未知当前内容永不覆盖。
postimage_ownership.rs: 外部 QPA 状态机的 journal 所有权适配；逐路径验证预期摘要/absence 并在首次写入前一次落盘，写后只校验、不认领新值。
rollback_directories.rs: rollback 目录 preimage 恢复；仅重建真实文件 preimage 证明曾存在的父目录，拒绝与事务新建目录冲突并逐层 fsync。
destination_io.rs: 正向写入与回滚共用的 handle-bound I/O 原语；普通源/备份以 FileShare.None + OPEN_REPARSE_POINT 打开并复核文件类型，目标在同一句柄内完成 hash CAS、覆盖/handle-bound 删除与 postcondition，禁止校验后按路径重开或跟随重解析点。
journal_cleanup.rs: durable journal 精确清理内核；只枚举双代 manifest 与有界数字 preimage，并通过已复核普通文件句柄非递归删除，每次删除后同步目录，未知成员、目录、重解析点或越界路径全部保留。
storage_tests.rs: durable recovery tempfile 合同；覆盖 prepare、apply-N、marker commit、rollback、cleanup、缺失 existing target 不创建空文件、双代 manifest 与路径/摘要/目录篡改阻断，且不接触真实安装。
qpa_journal_tests.rs: QPA 崩溃窗口回归合同；证明写前 postimage、原始 recovery 目录重建与未知写入不被事后认领。
worker.rs: 同一 EXE 的 apply/recovery 提权 headless worker；重解 Known Folder/固定目标，QPA 首写前落盘全部精确中间态，并复用 durable startup recovery，绝不写 state、重启或获取外层 operation lock。
worker_tests.rs: worker 纯合同测试；覆盖固定 core surface、执行顺序、退出码、Stock Noop、路径规范化与无 restart/state/lock 副作用。

法则: UAC 只授予固定 Program Files 语言事务；父进程不关闭/写安装根，worker 不接受 CopyPair/任意 destination，不启动提升态 Cavalry；只有 0/42 可由父进程验证后提交应用 state。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
