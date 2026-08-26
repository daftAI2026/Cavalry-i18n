# privilege/windows/
## Recovery boundary (2026-08-26)

language_transaction persists entry destination/preimage/postimage/backup/permission and phase data before mutation. Program Files startup recovery is a distinct same-EXE RunAs action; QPA intermediate/final hashes are declared before first write, and rollback recreates only preimage-proven original directories. A published `journal.state` remains authoritative over an uncommitted differing `.tmp`; hash drift, reparse paths, and rollback uncertainty remain typed blocking errors.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
> L2 | 父级: ../CLAUDE.md

成员清单
mod.rs: Windows privilege 子模块边界；组合 Known Folder 验证、旧受限 copy fallback 与 same-EXE Program Files 语言事务。
admin_copy.rs: direct 权限失败后的受限 UAC retry；只接受 OS-known Program Files 内的目标，保留 UAC consent 并隐藏提升 PowerShell worker，精确映射 0/42/43/44 事务结果。
known_folders.rs: Windows Known Folder 与 reparse-point 验证；拒绝基于进程环境变量推导授权根，也拒绝目标链重解析点。
manifest.rs: hash-locked PowerShell loader、copy manifest 与 cleanup；source/manifest/script 均校验摘要并以 FileShare.None 保持复制时的来源一致性。
language_transaction/: Program Files 单次 UAC 语言事务；父进程以固定 apply/recovery transport 启动 same-EXE worker，worker 重解 OS Known Folder，并在 durable journal 内恢复或提交 JSON、generic、QPA 与 final marker。

法则: 提升授权来自 OS Known Folder，不来自调用方字符串；完整语言切换只走 same-EXE worker，旧 PowerShell copy 不得承载 QPA 或跨文件语言事务。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
