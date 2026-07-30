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
manual_windows_live_smoke.rs: 默认 ignored 的 Windows disposable live-clone 双门；full-surface 与 Onboarding 共享 TEMP sentinel、语言 apply、exact PID 清理和 English 恢复骨架但独立启动，可用语言过滤器跑单语或默认三语；full-surface 保留证据根内的隔离 AppData 与 Transform/Viewport/Edit Shape/可选 Cog Pitch，只有 Onboarding 继承当前 Windows 用户 profile/登录态且禁止把账号缓存复制进证据，以 Transform exact-HWND 前台证据进入受控 ready/ack，语义触发 `showGuides → guideSelected("firstLaunch") → 前四步 nextClicked`，并硬断言 Cavalry 2.7.2 的真实 `std::string` meta-object 参数；逐步要求安装 catalog 的 exact 标题命中唯一可见 QLabel、HTML 正文转纯文本后命中唯一可见 QTextBrowser，并由 helper 复核 Guide native HWND 归属 exact PID 后捕获 5 张 PNG；第五步 ACK 后不触发完成/取消语义，登录欢迎窗口即使并存也不被关闭或误截；outstanding PID 只向 owned clone 的全部顶层 HWND 投递 WM_CLOSE，禁止盲键确认/强杀、场景脚本、Qt UIA 与坐标假 gate。
support/: ignored Windows smoke 的路径安全支撑；见 `support/CLAUDE.md`。

依赖边界:
默认测试只读配置、临时安装 fixture 或通过 fake runner 调用 Rust API，不访问真实 Cavalry 安装、不启动 GUI/UAC；例外是显式 `--ignored` 的 macOS/Windows disposable clone smoke。Windows live smoke 还要求 clone/evidence 两个显式 `%TEMP%` 根与 sentinel 双重证明，所有写目标逐级拒绝 reparse/越界，并把无 OCR 的 PNG 结果停在人工 gate；full-surface 额外隔离 AppData，Onboarding 为复用真实登录态只隔离安装根，重复校验降低但不宣称消除同用户恶意 TOCTOU，Ctrl+C/强制终止也不承诺 cleanup。

法则: 合同先行·配置可证·无真实副作用

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
