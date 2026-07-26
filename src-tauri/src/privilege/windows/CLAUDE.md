# privilege/windows/
> L2 | 父级: ../CLAUDE.md

成员清单
mod.rs: Windows privilege 子模块边界；组合 Known Folder 验证、UAC copy 与 manifest/script 工具。
admin_copy.rs: direct 权限失败后的受限 UAC retry；只接受 OS-known Program Files 内的目标，保留 UAC consent 并隐藏提升 PowerShell worker，精确映射 0/42/43/44 事务结果。
known_folders.rs: Windows Known Folder 与 reparse-point 验证；拒绝基于进程环境变量推导授权根，也拒绝目标链重解析点。
manifest.rs: hash-locked PowerShell loader、copy manifest 与 cleanup；source/manifest/script 均校验摘要并以 FileShare.None 保持复制时的来源一致性。

法则: 提升授权来自 OS Known Folder，不来自调用方字符串；脚本输出仅传回受限状态，绝不向用户 TEMP 写入诊断报告。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
