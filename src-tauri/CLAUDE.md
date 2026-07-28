# src-tauri/
> L2 | 父级: ../CLAUDE.md

成员清单
Cargo.toml: Rust crate 与 Tauri v2 依赖声明，`tauri`/`tauri-build` 保持精确版本线；`sha2` 同时服务 build-time 发布资源 trust anchor、流式安装 revision 与 hash-locked manifest，Windows API crate 仅启用 QPA durable/atomic 文件事务所需 feature。
Cargo.lock: Rust 依赖锁定文件，冻结 Tauri、serde、chrono、libc、sha2 与 Windows API 等后端依赖版本。
build.rs: Tauri build script 入口；生成 runtime context，并在 Windows 编译时枚举四语 JSON 与已构建 generic/QPA DLL，把固定 SHA-256 catalog 写入 `OUT_DIR` 供提权 worker 嵌入，release 缺 runtime 时 fail closed。
tauri.conf.json: Tauri 公共配置，指向 renderer、启用 `withGlobalTauri` 并固定窗口尺寸与 capability 边界。
tauri.macos.conf.json: macOS 合并配置，独占 injector 构建、dylib/languages 资源、DMG 与 ad-hoc signing。
tauri.windows.conf.json: Windows 合并配置，在 bundle 前构建 generic translator + QPA delegate 并准备 NSIS provenance，绑定仅清理安装元数据的卸载收尾 hook，独占自动跟随系统语言的四语 NSIS、品牌 ico、languages、`cavalryi18n.dll` 与 `qwindows.dll` 资源；禁止携带 macOS dylib。
nsis-hooks.nsh: Windows NSIS POSTUNINSTALL hook；只清理 Switcher 安装位置/安装器语言注册表元数据，不触碰 Cavalry qwindows、语言资源或用户应用数据。
capabilities/: Tauri v2 capability 配置，限定 main window 的 core 权限。
icons/: Tauri 图标集，由 `npx tauri icon` 从源图生成全平台图标（icns/ico/各尺寸 PNG + iOS/Android），`icon.png` 保持 1024x1024 8-bit RGBA 避免 `generate_context!()` 启动崩溃；`background.png` 为 DMG 安装器背景（1600x856），不受 `tauri icon` 管理。
src/: Rust command、InstallLayout、Windows 自动发现/Qt runtime 与持久 QPA 模块；commands/ 按状态、快照、写入、锁与重启拆分，windows_qpa/ 隔离 hash-locked manifest、同卷原子部署、direct-write preflight 和显式 English 恢复，privilege/ 按事务、runner、macOS/Windows 适配器拆分，platform_runtime.rs 统一命令到平台运行时的私有编排，同时保留跨进程单飞、English provenance、JSON overlay 与完整性边界。
tests/: Rust contract tests，守住展示版本/内容 revision 分离、六命令 DTO、clean-English 采集、未知 JSON 数据保留、Windows restart，以及 macOS 真实冒烟和 Windows disposable clone 的非 GUI/基础截图加逐类人工证据双现场门。

依赖边界:
Tauri 是唯一桌面壳；renderer 三文件仍是 UI 真相源。Rust command 返回 renderer 兼容 JSON shape；Tauri-only 权限命令必须保持可选消费，不把 Tauri 类型泄漏到 `app.js`。

法则: 版本精确·桥先注入·命令等价·副作用可测

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
