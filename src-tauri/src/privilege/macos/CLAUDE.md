# privilege/macos/
> L2 | 父级: ../CLAUDE.md

成员清单
mod.rs: macOS privilege 子模块边界；仅向上暴露 bundle 系统操作与 exact-PID 进程控制。
apply_transaction.rs: macOS apply 的 durable transaction owner；以单次打开并经 F_GETPATH 绑定的 root、已固定的目录/节点 fd 执行 nofollow 备份、原子发布、CAS 恢复与 quarantine xattr 遍历；strict begin 统一验证 preimage，准备/发布前扫描 exact PID，首次安装按 wrapper→Info 发布 journal-aware gate；journal 依靠 0700 state root、schema/path/phase/plan、backup hash、nofollow 与 CAS 校验恢复，不访问 Keychain，旧 schema-6 `authenticationTag` 只为无提示迁移而读取后忽略；bundle create/rename 的 errno 权限类别跨安全回滚保留；Signing phase 精确覆盖 `CodeDirectory`、`CodeSignature`、`CodeRequirements` 三个外置组件，使 codesign 中断和后续失败都能 CAS 回滚完整签名副作用；成功 postimage 仍必须显式 verifier 证明。
bundle.rs: Cavalry.app 签名与 quarantine 操作；只执行当前用户已获授权的直接命令，拒绝管理员 shell fallback；集中定义三个旧 Switcher 外置签名组件，按自有 regular-file 路径识别兼容残留，目录内无关成员既不会被删除，也不会阻止清理自有副作用。
process.rs: 通过 libproc 绑定 canonical executable/PID；Switch/Restore 与 recovery 共用只读运行探针并要求用户自行保存退出，显式 restart 才用固定 JXA 请求 NSRunningApplication graceful terminate 后有界等待。

法则: macOS JXA/系统调用只能存在于此目录；调用方只依赖 typed command runner 与结果；禁止临时 shell 提权。

变更日志
- 2026-08-09: 消除 codesign mutation→postimage 的恢复空窗；首次安装先发布 wrapper/Info gate 再第三次 exact-PID 扫描；filtered JSON 作为 observe-only generation postcondition；Committed/Restored canonical journal 原子退役后才清理，startup busy 不再永久 latch。
- 2026-08-09: strict apply 增加 exact preimage、双重进程扫描、显式签名 postimage、deferred replacement-before-removal 顺序、state 目录 fsync 门与真实子进程 phase matrix；uninspectable live PID、签名白名单外 drift、非 regular mode 与不确定 durability 均 fail closed。
- 2026-08-09: 登记 single-open root、fd-relative/CAS apply transaction、当时使用 HMAC 的 journal、quarantine preimage 与启动恢复职责；补齐 symlink/hardlink/TOCTOU fail-closed 边界。2026-09-02 因 ad-hoc 更新身份会触发 Keychain 密码框，保留 durable journal 与结构/CAS 校验，移除 HMAC/Keychain 依赖。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
