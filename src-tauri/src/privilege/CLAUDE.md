# privilege/
> L2 | 父级: ../CLAUDE.md

成员清单
copy_transaction.rs: 跨平台 direct copy 事务核心；以 typed CopyFailure、CopyDiagnostic 与 PostCommitWarning 记录回滚、恢复残留和提交后清理，不靠错误字符串反向解析控制流。
keychain.rs: Keychain query patch 的受控 privilege 编排；只暴露已拥有字节缓冲与补丁报告。
restart.rs: 受控进程关闭/重启边界；macOS 使用 open/osascript，Windows 精确匹配 executable、保留 cwd/env 并返回真实 PID。
runner.rs: CommandRunner 抽象及真实/记录实现；将系统进程副作用隔离为可审计、可替换的命令端口，Windows captured helper 统一附加 `CREATE_NO_WINDOW`。
tests.rs: privilege owner unit tests；验证 direct rollback、typed cleanup warning、legacy CopyOutcome 投影和 Windows 0/42/43/44 事务状态。
macos/: macOS admin copy 与 bundle 维护适配器；承担授权复制、codesign、quarantine 与 Privacy & Security 入口。
windows/: Windows Known Folder/UAC 适配器；在可验证 Program Files 边界内生成 hash-locked manifest/script，并保留 reparse/TOCTOU 防线。

法则: facade 不包含平台业务；事务失败优先恢复，已提交后的清理残留只能以稳定结构化诊断向上报告。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
