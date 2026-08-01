# src/
> L2 | 父级: ../CLAUDE.md

成员清单
main.rs: 二进制入口；Windows 先消费保留的 same-EXE Program Files 提升事务参数，再消费 `--launch-cavalry` 原生快速路径并返回明确退出码，其余调用进入 `cavalry_i18n_tauri::run()`。
lib.rs: Tauri Builder 装配层，注入 bridge 初始化脚本、注册 6 个 command、公开 Windows cfg 内的提升事务/headless launch/QPA/runtime 早期分流与跨平台纯模块，并私有挂接 `platform_runtime` 以保持命令 facade 不泄漏平台 cfg 编排。
bridge.rs: pre-page-load JS bridge，创建 `window.cavalryI18n` 并映射到 Tauri invoke。
commands.rs: renderer API facade；仅保留六条稳定 Tauri command、camelCase DTO 和兼容测试 seam；状态、快照、锁、写入与重启业务下沉至 `commands/`。
commands/: command 领域模块图；apply/context/contract/restart/snapshot/status 各自只承担一个变化理由，tests/ 按基础契约与运行时领域拆分。
install.rs: 跨平台安装模型，将 Cavalry.app、Cavalry.exe 或任意安装目录统一为 root/executable/assets/marker，并以两个核心 JSON 校验真实安装。
headless_launch.rs: Windows `--launch-cavalry` 原生快速入口；持有共享 operation lock，读取当前用户 state，校验任意安装根 revision/语言 marker/QPA ACTIVE/plugin 完整性，并以空参数启动 vendor EXE；子进程环境仅含可选诊断 marker，非 English 必须等待同 PID ready marker。
windows_install.rs: Windows 只读发现边界，按无控制台运行进程查询、MSI advertised shortcut 与有限常见目录收集候选；非 MSI 克隆以有界流式扫描证明 Cavalry.exe 中唯一 NUL 分隔 `2.7.2` token，不扫描磁盘、不写安装目录，也不调用任何 MSI repair API。
windows_runtime.rs: 仅在 Windows target 编译的 Qt generic plugin/QPA 资源装配，优先解析 Tauri 打包 DLL、回退开发资源并生成受控 copy pair；非 English 重启先流式比较安装 plugin 与当前可信源 SHA-256，再要求 QPA ACTIVE 和安装根语言 marker 一致，随后只准备诊断 marker 环境并以 deadline 校验 plugin、语言、PID、Qt、`embedded-generated-table` 来源和嵌入翻译表就绪；原生入口不依赖 `QT_PLUGIN_PATH`、`QT_QPA_GENERIC_PLUGINS` 或 `CAVALRY_I18N_LANG`。
windows_qpa.rs: Windows 原生入口持久注入状态机；严格锁定 Cavalry 2.7.2/所选 Cavalry.exe 摘要/Qt 6.6.3/x64/原厂 qwindows 摘要，以安装根 durable backup、prepared/active/restoring manifest 与同卷原子替换识别 STOCK/ACTIVE/DRIFTED/RECOVER；普通关闭不恢复，只有明确选择 English 可恢复，Cavalry.exe 或厂商 qwindows 漂移时保留现状并拒绝 ACTIVE/成功 English，避免把未知 DLL 冒充可启动 QPA；直接写 preflight 在 payload 前验证安装根、现有 recovery 与被替换文件的权限。
windows_qpa/: QPA 数据合同、身份验证、Windows 文件适配器、普通/提升共用 transition 与 tempfile 合同测试；可写自定义根直接执行，Program Files same-EXE worker 消费同一 hash-locked plan；qwindows 禁止进入截断 CopyPair。
operation_lock.rs: bundle operation 单飞边界；GUI extract/apply/restart 与 Windows headless launch 共享进程内及跨进程锁，避免写入事务、显式 English 恢复与启动交错。
runtime_paths.rs: repo/state 路径真相源；GUI command 与无 WebView 启动/恢复入口不得各自推导同一 state 路径，测试仍可用 `CAVALRY_I18N_STATE_DIR` 隔离。
detect.rs: 安装探测编排，按保存路径→运行进程→MSI→常见目录选择有效安装根；展示版本来自 Info.plist/MSI，快照 revision 则来自 macOS bundle version 或 Windows 固定不可变二进制的流式 SHA-256。
patch.rs: JSON 资产映射模块，提取 English、发现插件、构建 copy pairs；同一递归 string-only keyed overlay 只替换文本，保留 vendor 数字/布尔/null 元数据与当前/未来 Cavalry 版本增量，并证明安装或旧快照的已知文本叶子确属 packaged English。
mac_runtime.rs: macOS runtime patch 模块，生成 launcher wrapper、Info.plist rewrite、语言 marker/injector copy pairs，并集中解析 Resources、`_up_`、repo 三层 injector 来源。
platform_runtime.rs: 私有平台运行时编排 facade；Windows Program Files 已由 commands 提前分流，剩余自定义可写根在 payload 前拒绝 drift、以 typed 结果精确关闭 Cavalry 并验证直接写权限，在 pending JSON/generic 后执行 QPA ACTIVE 或显式 English 恢复，最后才允许 final marker；restart 只交付诊断子进程环境。
keychain_patch.rs: Mach-O Keychain query callsite 补丁模块，解析 fat/thin slice 并将 5 个函数的 accessGroup/synchronizable 写入调用替换为 NOP；production 入口消费 owned Vec，避免大 dylib 二次复制。
privilege.rs: 唯一系统命令 facade；保持既有 public API，公开 typed Cavalry graceful-close 结果，并向 commands 暴露 Windows Program Files typed parent outcome；事务、runner、Keychain、restart 与 macOS/Windows 适配器下沉至 `privilege/`。
privilege/: 系统命令领域模块图；copy_transaction 保持 direct rollback/typed warning，runner 隔离进程副作用，windows/language_transaction 以 same-EXE worker 和 durable journal 守住单次 UAC 完整语言事务。
state.rs: Tauri state.json schema、normalize 与读写函数；`cavalryRevision` 描述当前安装，`EnglishSnapshotProvenance` 只在成功采集或安全验证旧快照后更新。

依赖边界:
commands.rs 面向 renderer；commands/ 承担状态、快照、写入和重启领域逻辑；operation_lock/runtime_paths 提供 GUI 与 headless 共用基础契约；platform_runtime.rs 集中 apply/restart 的平台差异；install/detect/patch/mac_runtime/keychain_patch/state 保持布局与纯文件系统职责；windows_install 只读系统线索；privilege.rs facade 与 privilege/ 管理通用系统命令，windows_qpa 仅拥有 qwindows 的 durable/原子部署边界。

法则: command 薄·模块职责单一·副作用集中

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
