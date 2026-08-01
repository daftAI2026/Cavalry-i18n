# tests/
> L2 | 父级: ../CLAUDE.md

成员清单
tauri_version_contract.rs: 断言 npm 与 Cargo Tauri 依赖 exact pin 到同一个 v2 minor。
tauri_config_contract.rs: 以宿主无关方式断言公共 renderer/窗口/capabilities，以及 macOS dylib/签名资源与 Windows NSIS/languages/generic/QPA 双 DLL 严格隔离；Windows 配置必须声明平台生成命令与双资源映射且不得捆绑第二套 Qt runtime，真实 DLL 字节留给构建 provenance/安装态 smoke，安装器固定四语自动跟随系统、不弹选择器并复用品牌图标。
command_contract.rs: 断言 6 个 command 注册名、旧权限字段、`platform`/`permissionAction`、稳定 `errorCode`、成功后 cleanup warning 与 renderer 兼容 camelCase JSON shape。
bridge_webview_contract.rs: 断言 bridge 预注入到 Tauri builder，并暴露 `window.cavalryI18n` 兼容 API 与 Privacy & Security 入口。
detect_contract.rs: 断言保存路径优先、任意 Windows 安装根规范化、展示版本不伪造，并验证非 MSI 安装的不可变二进制 mutation 必然改变 revision。
patch_contract.rs: 断言 English 提取、插件/copy pair/snapshot、packaged-English 逐叶内容证明与 revision provenance 失效，验证 keyed overlay 保留 smoother/未来节点，并锁定 smoother 属性的英简繁日四语同构。
mac_runtime_contract.rs: 断言 wrapper、Info.plist 改写和 runtime pair 目标路径。
privilege_contract.rs: 断言复制回退、Keychain/签名，以及 Windows UAC allowlist 只来自 Known Folder API、不读取可伪造 Program Files 环境变量、custom root 拒绝提权、same-EXE worker 先于 headless/WebView 分流、SHA-256 锁定 manifest、同 handle `FileShare.None` 源复制与脚本复核 reparse point、0/42/43/44 事务状态及 45 可重试关闭阻塞；restart 以两个不同根的同名 MainWindowHandle=0 进程锁定“仅收尾绝对路径目标、decoy 存活”，再用 MainWindowHandle=0 但拥有 exact-PID 可见 owned window 的不可激活屏幕外夹具证明不得强杀，并守住当前 Session、同一 SafeHandle 跨越复核/关闭、窗口 oracle fail closed、cwd/env 与 PID 链路。
state_contract.rs: 断言 Tauri state.json 的当前 revision/快照 provenance schema、normalize、读写与旧 state serde-default 迁移。
manual_macos_smoke.rs: 真实 macOS ignored smoke test，在 APFS 副本跑三语 apply、重复 apply、strict codesign 与 English 恢复，并将候选 injector 外加载到真实 Cavalry 进程，要求每种语言的三个菜单哨兵全部出现，输出日志/inventory 哈希，并核验 provenance、进程存活及原安装关键文件零变化。
manual_windows_smoke.rs: 默认 ignored 的 Windows 克隆验收，只接受显式 `%TEMP%` disposable 安装；逐级守卫 JSON/plugin/marker/qwindows/recovery 写入链，依次验证简繁日全部资源、smoother、QPA ACTIVE，以及显式 English 对 38 JSON 与 vendor qwindows 的原始字节恢复；RecordingRunner 只允许一次 exact-path graceful close，禁止 UAC。
manual_windows_live_smoke.rs: 默认 ignored 的 Windows disposable live-clone 三门薄入口，公共实现按 capture/Adjacent/orchestration/tests 四个 support 分片收敛；full-surface 保留隔离 AppData 与 Transform/Viewport/Edit Shape/可选 Cog Pitch；Onboarding/Adjacent 由 acceptance-only plugin 在 driver 创建前启用 sentinel-owned Qt test profile，不复制或伪造登录态。Onboarding 等 MainDock 稳定后 manager-first 触发 firstLaunch，前四步只点击唯一 localized Next 且由下一页唯一标题/正文确认转场，第 5 步只 ACK，工作区重置框出现即失败；Adjacent 真实点击 `TagHeader`、真实 Drop 双 nonce fixture、向 exact Assets receiver 投递 ContextMenu，并以 producer QWidget grab + 同 PID HWND 锚点封存 3 张 PNG。三门都要求 write-once 身份、English 恢复和零进程；逻辑证据完成后以 exact HWND `WM_CLOSE` 清理，超时只对复核后的同 EXE/PID ForceStop，清理方式不参与翻译 PASS。
support/: ignored Windows smoke 的路径安全支撑；见 `support/CLAUDE.md`。

依赖边界:
默认测试只读配置、临时安装 fixture 或通过 fake runner 调用 Rust API，不访问真实 Cavalry 安装、不启动 GUI/UAC；例外是显式 `--ignored` 的 macOS/Windows disposable clone smoke。Windows live smoke 要求 clone/evidence 两个显式 `%TEMP%` 根与 sentinel 双重证明，所有写目标逐级拒绝 reparse/越界，并把无 OCR 的 PNG 结果停在人工 gate；Onboarding/Adjacent 的 qttest/Cavalry 目录还要求独立固定 magic sentinel 与 reparse 拒绝。acceptance-only DLL 只在测试进程前写入 disposable `generic/`，退出后删除，发布 generic 目录仍只有产品 DLL；Ctrl+C/强制终止不承诺 cleanup。

法则: 合同先行·配置可证·无真实副作用

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
