# workflows/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/.github/CLAUDE.md

成员清单
build.yml: 主 CI/CD 工作流，跑 Node/Rust 合同测试并在 macOS 上构建 Tauri DMG 与 `.app` artifact。

依赖边界:
workflow 只调用仓库里已经存在的脚本与构建入口；默认 build 变更时这里必须同构更新。

法则: 脚本唯一·产物可追踪·release 不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
