# src-tauri/
> L2 | 父级: ../CLAUDE.md

成员清单
Cargo.toml: Rust crate 与 Tauri v2 依赖声明，`tauri`/`tauri-build` 保持精确版本线；`sha2` 同时服务 build-time 发布资源 trust anchor、流式安装 revision 与 hash-locked manifest，Windows API crate 仅启用 QPA durable/atomic 文件事务所需 feature。
Cargo.lock: Rust 依赖锁定文件，冻结 Tauri、serde、chrono、libc、sha2 与 Windows API 等后端依赖版本。
build.rs: Tauri build script 入口；生成 runtime context，并在 Windows 编译时枚举四语 JSON 与已构建 generic/QPA DLL，把固定 SHA-256 catalog 写入 `OUT_DIR` 供提权 worker 嵌入，release 缺 runtime 时 fail closed。
tauri.conf.json: Tauri 公共配置，指向 renderer、关闭 `withGlobalTauri`、设置本地 CSP，并固定窗口尺寸与 capability 边界。
tauri.macos.conf.json: macOS 合并配置，在 dev/build 前生成 injector，独占 dylib/languages 资源与 DMG；不硬编码 signing identity，本地 ad-hoc 与 tag Developer ID 由显式环境分流。
tauri.windows.conf.json: Windows 合并配置，在 dev/bundle 前构建 generic + QPA，绑定四语双语义卸载 hook 与四份 NSIS 消息表，独占系统语言 NSIS、品牌 ico、languages 与双 DLL 资源；禁止携带 macOS dylib。
nsis-hooks.nsh: Windows NSIS 生命周期 hook；交互卸载明确选择“仅移除 Switcher 并保留翻译”或“先恢复 English 并移除自有运行时”，更新/静默/被动卸载默认保留，恢复失败则中止；收尾只清安装元数据。
nsis-languages/: Tauri NSIS 四语消息表；保持上游消息键同构，并在原生确认页把应用数据明确限定为 Switcher 自身设置。
capabilities/: Tauri v2 capability 配置，限定 main window 的 core 权限。
icons/: Tauri 图标集，由 `npx tauri icon` 从源图生成全平台图标（icns/ico/各尺寸 PNG + iOS/Android），`icon.png` 保持 1024x1024 8-bit RGBA 避免 `generate_context!()` 启动崩溃；`background.png` 为 DMG 安装器背景（1600x856），不受 `tauri icon` 管理。
src/: Rust command、InstallLayout、Windows 自动发现/Qt runtime/QPA 与 uninstall restore；commands/ 按状态、安装真相、写入和重启拆分，windows_qpa/ 隔离 hash-locked manifest、含 generic 的 rollback 与显式 English 清理，privilege/ 管理单次 UAC 事务。
tests/: Rust contract tests，守住展示版本/内容 revision 分离、六命令 DTO、clean-English 采集、未知 JSON 数据保留、Windows restart，以及 macOS 真实冒烟和 Windows disposable clone 的非 GUI/基础截图加逐类人工证据双现场门。

依赖边界:
Tauri 是唯一桌面壳；renderer 三文件仍是 UI 真相源。Rust command 返回 renderer 兼容 JSON shape；Tauri-only 权限命令必须保持可选消费，不把 Tauri 类型泄漏到 `app.js`。

法则: 版本精确·桥先注入·命令等价·副作用可测

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
