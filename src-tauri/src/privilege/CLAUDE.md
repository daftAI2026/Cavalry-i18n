# privilege/
> L2 | 父级: ../CLAUDE.md

成员清单
copy_transaction.rs: 跨平台 direct copy 事务核心；以 typed CopyFailure、CopyDiagnostic 与 PostCommitWarning 记录权限拒绝、回滚、恢复残留和提交后清理，允许事务补充回滚说明但不丢失原始失败类别，不靠错误字符串反向解析控制流。
external_link.rs: 固定项目外链适配器；只把 repository/license 枚举映射为编译期 GitHub HTTPS 地址，并经 CommandRunner 调用平台默认浏览器，renderer 永远不能传入任意 URL。
keychain.rs: Keychain query patch 的受控 privilege 编排；只暴露已拥有字节缓冲与补丁报告。
restart.rs: 受控进程关闭/重启边界；macOS 使用 open/osascript，Windows 从首次复核到退出固定当前 Session 的同一 Process/SafeHandle，先精确匹配 executable 并优雅关闭，跨会话实例或 exact-PID 任意可见顶层窗口立即返回 typed StillRunning，仅在绝对路径一致且两次窗口 oracle 均证明无可见窗口时单进程收尾，拒绝 PID 复用、名称批量与进程树终止，同时保留 cwd/env 并返回真实 PID。
runner.rs: CommandRunner 抽象及真实/记录实现；将系统进程副作用隔离为可审计、可替换的命令端口，Windows captured helper 统一附加 `CREATE_NO_WINDOW`。
tests.rs: privilege owner unit tests；验证 direct rollback、typed cleanup warning、Windows apply 退出状态与 Program Files startup recovery 必经 same-EXE launcher。
macos/: macOS durable apply transaction、bundle 维护与 exact-PID 适配器；承担 fd-bound copy/restore、首次 launch gate、codesign、quarantine 与 Privacy & Security 入口；签名证据用于标签与最终可启动性复核，脚本入口重签产生的三个自有外置组件按路径进入兼容清理、签名 side-effect journal 与 English 恢复范围，不再审判整个签名目录。
windows/: Windows Known Folder/UAC 适配器；Program Files apply 与 startup recovery 都使用 same-EXE、hash-locked transport 与 durable journal，受保护根禁止未提权 fallback；旧 PowerShell manifest 仅保留兼容 copy fallback。

法则: facade 不包含平台业务；事务失败优先恢复，已提交后的清理残留只能以稳定结构化诊断向上报告。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
