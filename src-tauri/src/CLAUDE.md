# src/
> L2 | 父级: ../CLAUDE.md

成员清单
main.rs: 二进制入口；Windows 依次消费 same-EXE 提升事务、`--uninstall-restore-english` 与 `--launch-cavalry` 精确参数并返回明确退出码，其余进入 Tauri runtime。
lib.rs: Tauri Builder 装配层，注册官方 updater plugin、Updater State 与 8 个 command，公开 Windows 提升事务/uninstall restore/headless launch/QPA/runtime 早期分流与跨平台纯模块。
bridge.rs: pre-page-load JS bridge 的 Rust include 真相源，创建 `window.cavalryI18n` 并映射到 Tauri invoke；合同执行 Builder 实际消费的脚本，保留 Windows residue typed 检测但不提供更新检查或独立 reconcile API，不冒充 packaged WebView/CSP 现场门。
commands.rs: renderer API facade；保留八条稳定 Tauri command、camelCase DTO 和兼容测试 seam；`extract_english` 只生成 English snapshot并标记 Windows runtime residue，`apply_language` 持有单一 operation lock 完成写入及重启，`check_update/install_update` 只消费 Rust State 中签名验证后的 pending Update；内部 warning prose 与 updater 错误均在出界前收敛为稳定 code。
commands/: command 领域模块图；apply/context/contract/restart/snapshot/status/update 各自只承担一个变化理由，snapshot_legacy 负责旧快照可信识别与 apply-only generation 迁移，tests/ 按基础契约与运行时领域拆分。
install.rs: 跨平台安装模型，将 Cavalry.app、Cavalry.exe 或任意安装目录统一为 root/executable/assets/marker；兼容发现保留宽松入口，verified 入口先 canonicalize 并拒绝 symlink bundle/关键文件，并提供逐组件 lstat 的相对路径安全 helper。
headless_launch.rs: Windows `--launch-cavalry` 原生快速入口；持有共享 operation lock，读取 state，校验 revision/marker/QPA ACTIVE/plugin 后以空参数启动 vendor EXE。
uninstall_restore.rs: Windows `--uninstall-restore-english` 无 WebView 卸载入口；只消费保存的安装根，在共享 operation lock 内按 snapshot provenance 选择 refresh/apply English，刷新返回 typed reconciliationRequired 时必须继续完成显式 English 事务，并将 UAC 取消、未知运行时或未提交修复投影为非零退出码以阻止 NSIS 删除控制面。
windows_install.rs: Windows 只读发现边界，按无控制台运行进程查询、MSI advertised shortcut 与有限常见目录收集候选；非 MSI 克隆以有界流式扫描证明 Cavalry.exe 中唯一 NUL 分隔 `2.7.2` token，不扫描磁盘、不写安装目录，也不调用任何 MSI repair API。
windows_runtime.rs: 仅在 Windows target 编译的 Qt generic plugin/QPA 资源装配，优先解析 Tauri 打包 DLL、回退开发资源并生成受控 copy pair；非 English 重启先流式比较安装 plugin 与当前可信源 SHA-256，再要求 QPA ACTIVE 和安装根语言 marker 一致，随后只准备诊断 marker 环境并以 deadline 校验 plugin、语言、PID、Qt、`embedded-generated-table` 来源和嵌入翻译表就绪；原生入口不依赖 `QT_PLUGIN_PATH`、`QT_QPA_GENERIC_PLUGINS` 或 `CAVALRY_I18N_LANG`。
windows_qpa.rs: Windows 持久注入状态机；锁定 Cavalry/Qt/架构/原厂 qwindows，以 durable manifest 识别历史发行版所有权，并向外层 journal 投影写前精确 postimage；未知 generic/QPA 或厂商更新一律保留并 fail closed。
windows_qpa/: QPA 数据合同、身份验证、Windows 文件适配器、普通/提升共用 transition 与 tempfile 合同测试；可写自定义根直接执行，Program Files same-EXE worker 消费同一 hash-locked plan；qwindows 禁止进入截断 CopyPair。
operation_lock.rs: bundle operation 单飞边界；GUI extract/apply/restart、Windows uninstall restore 与 headless launch 共享进程内及跨进程锁，避免 English 恢复、卸载和启动交错；macOS startup 仅在确有 canonical pending journal 时等待，busy timeout 作为瞬态交给动态状态门而不写入进程生命周期错误。
runtime_paths.rs: repo/state 路径真相源；GUI command 与无 WebView 启动/恢复入口不得各自推导同一 state 路径，测试仍可用 `CAVALRY_I18N_STATE_DIR` 隔离。
detect.rs: 安装探测编排，按保存路径→运行进程→MSI→常见目录选择有效安装根；严格 macOS identity 通过 typed XML/binary plist 锁定 canonical root、com.scenegroup.cavalry、2.7.2 short/build、Mach-O 架构、Cavalry 与 libExtensionLayer SHA-256，official immutable revision fingerprint 排除受控 ExtensionLayer patch；签名 Team ID/designated requirement 以 typed unavailable 留给 privilege runner；Windows revision read/write 均流式计算真实 SHA，拒绝以可碰撞的 NTFS metadata 代替内容身份。
patch.rs: JSON 资产映射模块，提取 English、发现插件、构建 copy pairs；插件以精确 Cavalry-relative identity 写入 manifest/hash，camel-case 兼容路径发生重复目的地时 fail closed；English manifest 还绑定 macOS 原始 Unix mode，current/prev/legacy snapshot 逐组件 lstat，Windows 以可写 handle 刷新 snapshot 文件，`build_mac_english_restore_pairs`/`build_mac_overlay_pairs_exact` 以 trusted manifest digest 复原 mode；同一递归 string-only keyed overlay 只替换文本，保留 vendor 数字/布尔/null 元数据与当前/未来 Cavalry 版本增量，并证明安装或旧快照的已知文本叶子确属 packaged English，且只把已证明的无 manifest legacy 快照提升为 immutable generation。
mac_official.rs: macOS vendor baseline 真相层；从严格 identity、vendor codesign、English JSON 与 Info/main/CodeResources/Extension preimages 建立同一 immutable generation，managed apply 只能从该 baseline 推导 wrapper/Keychain postimage，官方还原逐项复核 bytes/mode/absence/signature。
mac_runtime.rs: macOS runtime patch 模块，生成 launcher wrapper、trusted bytes/path 驱动的 typed Info.plist rewrite、语言 marker/injector copy pairs，并以 wrapper→Info 顺序提供首次 journal-aware launch gate；集中解析 Resources、`_up_`、repo 三层 injector 来源；wrapper 仅拥有项目语言变量与 injector DYLD 项，保留调用者其它注入，并在 exec 前始终检查默认及 override state 下的 `macos-apply-transaction` journal，存在即以 75 拒绝运行。
platform_runtime.rs: 私有平台运行时编排 facade；Windows Program Files 已由 commands 提前分流，剩余自定义可写根在 payload 前拒绝 drift、以 typed 结果精确关闭 Cavalry 并验证直接写权限，在 pending JSON/generic 后执行 QPA ACTIVE 或显式 English 恢复，最后才允许 final marker；restart 只交付诊断子进程环境。
keychain_patch.rs: Mach-O Keychain query callsite 补丁模块，解析 fat/thin slice 并将 5 个函数的 accessGroup/synchronizable 写入调用替换为 NOP；production 入口消费 owned Vec，避免大 dylib 二次复制。
privilege.rs: 唯一系统命令 facade；保持既有 public API，公开 typed graceful-close 与 Windows Program Files apply outcome，并让 startup recovery 先以不跟随 reparse 的保存根只读探针确认 journal，再持锁通过独立 same-EXE RunAs action 恢复受保护 journal。
privilege/: 系统命令领域模块图；copy_transaction 保持 direct rollback/typed warning，runner 隔离进程副作用，windows/language_transaction 以 same-EXE worker 和 durable journal 守住单次 UAC 完整语言事务。
startup_recovery.rs: Tauri 启动期跨平台 transaction recovery 协调层；无 pending 时走快路，确有 journal 才等待共享 operation lock；Windows 从保存状态解析已验证安装根，自定义可写根直接恢复，Program Files 委托 privilege 的 same-EXE RunAs recovery，且不确定状态一律 fail closed。
state.rs: Tauri state.json schema、normalize 与读写函数；StateDocument 以 schemaVersion/generation/operationId/lastKnownGood 保存控制面元数据，同目录 temp+fsync+atomic rename+目录 fsync，并保留 state.json.prev；Windows 普通文件 fsync 使用可写 handle 以满足 FlushFileBuffers，rename 后 directory warning 由不重写 generation 的显式 durability reconfirm 重试；严格读取提供 typed error/recovery report，`read_state_for_control_report` 暴露 recovery diagnostic 与 `StateCommitOutcome` warning，cavalryRevision 描述当前安装，EnglishSnapshotProvenance 只在成功采集或安全验证旧快照后更新。

依赖边界:
commands.rs 面向 renderer；commands/ 承担状态、快照、写入和重启领域逻辑；operation_lock/runtime_paths 提供 GUI 与 headless 共用基础契约；platform_runtime.rs 集中 apply/restart 的平台差异；install/detect/patch/mac_official/mac_runtime/keychain_patch/state 保持布局与纯文件系统职责；startup_recovery 只协调已认证 transaction 的启动恢复；windows_install 只读系统线索；privilege.rs facade 与 privilege/ 管理通用系统命令，windows_qpa 仅拥有 qwindows 的 durable/原子部署边界。

法则: command 薄·模块职责单一·副作用集中

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
