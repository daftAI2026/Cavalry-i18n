# src/
> L2 | 父级: ../CLAUDE.md

成员清单
main.rs: 二进制入口；Windows 先消费 `--launch-cavalry` 无 WebView 快速路径，其余调用进入 `cavalry_i18n_tauri::run()`。
lib.rs: Tauri Builder 装配层，注入 bridge 初始化脚本、注册 6 个 command、公开跨平台纯模块与 Windows headless launch，并私有挂接 `platform_runtime` 以保持命令 facade 不泄漏平台 cfg 编排。
bridge.rs: pre-page-load JS bridge，创建 `window.cavalryI18n` 并映射到 Tauri invoke。
commands.rs: renderer API facade；仅保留六条稳定 Tauri command、camelCase DTO 和兼容测试 seam；状态、快照、锁、写入与重启业务下沉至 `commands/`。
commands/: command 领域模块图；apply/context/contract/restart/snapshot/status 各自只承担一个变化理由，tests/ 按基础契约与运行时领域拆分。
install.rs: 跨平台安装模型，将 Cavalry.app、Cavalry.exe 或任意安装目录统一为 root/executable/assets/marker，并以两个核心 JSON 校验真实安装。
headless_launch.rs: Windows `--launch-cavalry` 原生快速入口；持有共享 operation lock，读取当前用户 state，校验任意安装根 revision/语言 marker/plugin 完整性，并以空参数和仅子进程环境启动 vendor EXE，非 English 必须等待同 PID ready marker。
windows_install.rs: Windows 只读发现边界，按无控制台运行进程查询、MSI advertised shortcut 与有限常见目录收集候选；不扫描磁盘、不写安装目录，也不向用户闪出 PowerShell。
windows_runtime.rs: Windows Qt generic plugin 运行时装配，优先解析 Tauri 打包 DLL、回退开发资源并生成到选中安装根 `generic/` 的受控 copy pair；非 English 重启先流式比较安装 plugin 与当前可信包/开发源的 SHA-256，不一致或源缺失即拒绝 spawn 并要求重新应用，English 不依赖该插件；其后才准备 plugin/语言/诊断环境，清理 stale marker 后以 deadline 校验 plugin、语言、PID、Qt、`embedded-generated-table` 来源和嵌入翻译表就绪；这不是签名或 TOCTOU 消除，ExtensionLayer hook 状态只随 marker 报告，不阻塞就绪。
operation_lock.rs: bundle operation 单飞边界；GUI extract/apply/restart 与 Windows headless launch 从 state 读取到 runtime marker 就绪共享进程内及跨进程锁，避免写入事务与启动交错。
runtime_paths.rs: repo/state 路径真相源；Windows GUI 与 headless 统一消费 APPDATA/identifier，测试仍可用 `CAVALRY_I18N_STATE_DIR` 隔离。
detect.rs: 安装探测编排，按保存路径→运行进程→MSI→常见目录选择有效安装根；展示版本来自 Info.plist/MSI，快照 revision 则来自 macOS bundle version 或 Windows 固定不可变二进制的流式 SHA-256。
patch.rs: JSON 资产映射模块，提取 English、发现插件、构建 copy pairs；同一递归 string-only keyed overlay 只替换文本，保留 vendor 数字/布尔/null 元数据与当前/未来 Cavalry 版本增量，并证明安装或旧快照的已知文本叶子确属 packaged English。
mac_runtime.rs: macOS runtime patch 模块，生成 launcher wrapper、Info.plist rewrite、语言 marker/injector copy pairs，并集中解析 Resources、`_up_`、repo 三层 injector 来源。
platform_runtime.rs: 私有平台运行时编排 facade；为 apply 生成 runtime plan、在 copy 后执行 macOS 收尾，并为 restart 选择 Windows child-only 环境或 macOS 重启路径。
keychain_patch.rs: Mach-O Keychain query callsite 补丁模块，解析 fat/thin slice 并将 5 个函数的 accessGroup/synchronizable 写入调用替换为 NOP；production 入口消费 owned Vec，避免大 dylib 二次复制。
privilege.rs: 唯一系统命令 facade；保持既有 public API，并向 crate 内集中提供 Windows 无控制台 captured command，事务、runner、Keychain、restart 与 macOS/Windows 适配器下沉至 `privilege/`。
privilege/: 系统命令领域模块图；copy_transaction 保持 rollback/typed warning，runner 隔离进程副作用，macos/windows 子目录守住各自授权与脚本边界。
state.rs: Tauri state.json schema、normalize 与读写函数；`cavalryRevision` 描述当前安装，`EnglishSnapshotProvenance` 只在成功采集或安全验证旧快照后更新。

依赖边界:
commands.rs 面向 renderer；commands/ 承担状态、快照、写入和重启领域逻辑；operation_lock/runtime_paths 提供 GUI 与 headless 共用基础契约；platform_runtime.rs 集中 apply/restart 的平台差异；install/detect/patch/mac_runtime/keychain_patch/state 保持布局与纯文件系统职责；windows_install 只读系统线索；privilege.rs facade 与 privilege/ 是唯一可写系统命令边界。

法则: command 薄·模块职责单一·副作用集中

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
