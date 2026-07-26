# privilege/macos/
> L2 | 父级: ../CLAUDE.md

成员清单
mod.rs: macOS privilege 子模块边界；仅向上暴露 admin copy 与 bundle 系统操作。
admin_copy.rs: osascript 管理员复制适配器；保持 pair 清单受控、返回 typed copy 结果，不让 command 层拼接 shell。
bundle.rs: Cavalry.app 签名、quarantine 与 Privacy & Security 操作；仅消费 CommandRunner，将 codesign 修复策略集中于此。

法则: macOS shell/AppleScript 只能存在于此目录；调用方只依赖 typed command runner 与结果。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
