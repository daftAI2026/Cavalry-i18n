# src/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/src-tauri/CLAUDE.md

成员清单
main.rs: 二进制入口，只调用 `cavalry_i18n_tauri::run()`。
lib.rs: Tauri Builder 装配层，注入 bridge 初始化脚本并注册 5 个 command。
bridge.rs: pre-page-load JS bridge，创建 `window.cavalryI18n` 并映射到 Tauri invoke。
commands.rs: renderer API 等价层，定义 5 个 command、payload shape、唯一 staging 根和 apply 流程编排。
detect.rs: Cavalry.app 探测模块，读取候选路径、Info.plist 版本、语言目录和 bundle 诊断。
patch.rs: JSON 资产映射模块，提取 English、发现插件、构建 copy pairs、staging 文件。
mac_runtime.rs: macOS runtime patch 模块，生成 launcher wrapper、Info.plist rewrite、lang marker 与 injector copy pairs。
privilege.rs: 系统命令边界，定义 command runner、Keychain access group 二进制补丁、重签与 restart 命令顺序。
state.rs: Electron 兼容 state.json schema、normalize、读写函数。

依赖边界:
commands.rs 面向 renderer；detect/patch/mac_runtime/state 是纯数据与文件系统逻辑；privilege.rs 是唯一系统命令边界。

法则: command 薄·模块职责单一·副作用集中

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
