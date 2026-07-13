# tests/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/src-tauri/CLAUDE.md

成员清单
tauri_version_contract.rs: 断言 npm 与 Cargo Tauri 依赖 exact pin 到同一个 v2 minor。
tauri_config_contract.rs: 断言 renderer 路径、withGlobalTauri、窗口尺寸、bundle resources、capabilities。
command_contract.rs: 断言 6 个 command 注册名、权限提示字段、App Management 预检字段、packaged resource 语言包回退和 renderer 兼容 camelCase JSON shape。
bridge_webview_contract.rs: 断言 bridge 预注入到 Tauri builder，并暴露 `window.cavalryI18n` 兼容 API 与 Privacy & Security 入口。
detect_contract.rs: 断言默认路径、Info.plist 版本读取与 bundle-local 语言 marker 恢复。
patch_contract.rs: 断言 English 提取、插件 camelCase、copy pair、38 面 snapshot 完整性与 staging mode 保留。
mac_runtime_contract.rs: 断言 wrapper、Info.plist 改写和 runtime pair 目标路径。
privilege_contract.rs: 断言复制回退、5 函数 Keychain callsite owned-buffer/双架构幂等补丁、增量签名、同内容只验签、验签失败全量修复、quarantine 与 restart 命令顺序。
state_contract.rs: 断言 Tauri state.json schema 的 normalize 与读写。
manual_macos_smoke.rs: 真实 macOS ignored smoke test，在 APFS 副本跑三语 apply、重复 apply、strict codesign 与 English 恢复，并将候选 injector 外加载到真实 Cavalry 进程，要求每种语言的三个菜单哨兵全部出现，输出日志/inventory 哈希，并核验 provenance、进程存活及原安装关键文件零变化。

依赖边界:
默认测试只读配置或通过 fake runner 调用 Rust API，不启动真实 GUI/提权命令；唯一例外是显式 `--ignored` 触发的 `manual_macos_smoke.rs`，它只写 APFS 副本，并以外置 dylib 启动真实 Cavalry 二进制、核验安装源关键字节前后不变。

法则: 合同先行·配置可证·无真实副作用

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
