# src/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/src-tauri/CLAUDE.md

成员清单
main.rs: 二进制入口，只调用 `cavalry_i18n_tauri::run()`。
lib.rs: Tauri Builder 装配层，注入 bridge 初始化脚本并注册 6 个 command。
bridge.rs: pre-page-load JS bridge，创建 `window.cavalryI18n` 并映射到 Tauri invoke。
commands.rs: renderer API 等价层，固定 6 个 command/camelCase payload；extract/apply 以 `spawn_blocking` 执行，extract/apply/restart 通过 AtomicBool + state-dir `flock` 实现进程内快拒绝和跨进程单飞，内容变化驱动增量签名。
detect.rs: Cavalry.app 探测模块，读取候选路径、Info.plist 版本、语言目录和 bundle 诊断。
patch.rs: JSON 资产映射模块，提取 English、发现插件、构建 copy pairs、staging 文件并判断 38 面 English snapshot 完整性。
mac_runtime.rs: macOS runtime patch 模块，生成 launcher wrapper、Info.plist rewrite、lang marker 与 injector copy pairs。
keychain_patch.rs: Mach-O Keychain query callsite 补丁模块，解析 fat/thin slice 并将 5 个函数的 accessGroup/synchronizable 写入调用替换为 NOP；production 入口消费 owned Vec，避免大 dylib 二次复制。
privilege.rs: 系统命令边界，负责权限复制、Keychain 补丁和 codesign；快路径只签实际修改 nested code + outer app，无变化则只验签；deep/strict 失败才按 canonical/inode 去重全量修复并二次验证。
state.rs: Tauri state.json schema、normalize、读写函数。

依赖边界:
commands.rs 面向 renderer；detect/patch/mac_runtime/keychain_patch/state 是纯数据与文件系统逻辑；privilege.rs 是唯一系统命令边界。

法则: command 薄·模块职责单一·副作用集中

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
