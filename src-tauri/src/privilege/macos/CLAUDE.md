# privilege/macos/
> L2 | 父级: ../CLAUDE.md

成员清单
mod.rs: macOS privilege 子模块边界；仅向上暴露 bundle 系统操作与 exact-PID 进程控制。
apply_transaction.rs: macOS apply 的 durable transaction owner；以单次打开并经 F_GETPATH 绑定的 root、已固定的目录/节点 fd 执行 nofollow 备份、原子发布、CAS 恢复与 quarantine xattr 遍历；strict begin 对 changed 与 filtered/observe-only JSON 的 sha256+mode preimage 做统一认证，准备/发布前扫描 exact PID，首次安装再按 wrapper→Info 发布 journal-aware gate 后第三次扫描；Signing phase 只授权白名单文件的任意 codesign 中间像用于 CAS 回滚，成功 postimage 仍必须显式 verifier 证明；Committed/Restored journal 先原子退役为非阻断 tombstone 再递归清理，并以真实子进程 fault/kill/reopen matrix 覆盖签名和清理崩溃边界。
bundle.rs: Cavalry.app 签名与 quarantine 操作；只执行当前用户已获授权的直接命令，拒绝管理员 shell fallback。
process.rs: 通过 libproc 绑定 canonical executable/PID，并用固定 JXA 请求 NSRunningApplication graceful terminate 后有界等待退出。

法则: macOS JXA/系统调用只能存在于此目录；调用方只依赖 typed command runner 与结果；禁止临时 shell 提权。

变更日志
- 2026-08-09: 消除 codesign mutation→postimage 的恢复空窗；首次安装先发布 wrapper/Info gate 再第三次 exact-PID 扫描；filtered JSON 作为 observe-only generation postcondition；Committed/Restored canonical journal 原子退役后才清理，startup busy 不再永久 latch。
- 2026-08-09: strict apply 增加 exact preimage、双重进程扫描、显式签名 postimage、deferred replacement-before-removal 顺序、state 目录 fsync 门与真实子进程 phase matrix；uninspectable live PID、签名白名单外 drift、非 regular mode 与不确定 durability 均 fail closed。
- 2026-08-09: 登记 single-open root、fd-relative/CAS apply transaction、认证 journal、quarantine preimage 与启动恢复职责；补齐 symlink/hardlink/TOCTOU fail-closed 边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
