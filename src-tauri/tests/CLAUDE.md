# tests/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/src-tauri/CLAUDE.md

成员清单
tauri_version_contract.rs: 断言 npm 与 Cargo Tauri 依赖 exact pin 到同一个 v2 minor。
tauri_config_contract.rs: 断言 renderer 路径、withGlobalTauri、窗口尺寸、bundle resources、capabilities。
command_contract.rs: 断言 6 个 command 注册名、权限提示字段和 Electron 兼容 camelCase JSON shape。
bridge_webview_contract.rs: 断言 bridge 预注入到 Tauri builder，并暴露 `window.cavalryI18n` 兼容 API 与 Privacy & Security 入口。
detect_contract.rs: 断言默认路径、Info.plist 版本读取与 bundle-local 语言 marker 恢复。
patch_contract.rs: 断言 English 提取、插件 camelCase、copy pair 与 staging mode 保留。
mac_runtime_contract.rs: 断言 wrapper、Info.plist 改写和 runtime pair 目标路径。
privilege_contract.rs: 断言复制回退、5 函数 Keychain query attribute callsite 直写/提权补丁、双架构幂等、per-function 报告、重签、quarantine 与 restart 命令顺序。
state_contract.rs: 断言 Electron 兼容 state.json schema 的 normalize 与读写。
manual_macos_smoke.rs: 真实 macOS ignored smoke test，跑三语 apply/restart 与 English 恢复。

依赖边界:
tests 只读配置与调用纯 Rust API；不得启动真实 Tauri 窗口或执行 macOS 提权命令。

法则: 合同先行·配置可证·无真实副作用

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
