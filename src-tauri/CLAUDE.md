# src-tauri/
> L2 | 父级: ../CLAUDE.md

成员清单
Cargo.toml: Rust crate 与 Tauri v2 依赖声明，`tauri`/`tauri-build` 保持精确版本线；macOS 的 `objc2-app-kit` 只服务交通灯，固定 `cc` build dependency 编译独立 AppKit handoff owner；`sha2` 同时服务 build-time 发布资源 trust anchor、流式安装 revision 与 hash-locked manifest，Windows API crate 仅启用 QPA durable/atomic 文件事务所需 feature。
Cargo.lock: Rust 依赖锁定文件，冻结 Tauri、serde、chrono、libc、sha2 与 Windows API 等后端依赖版本。
build.rs: Tauri build script 入口；macOS 用 ARC/modules 编译 `native/macos_permission_handoff.m` 并显式链接 AppKit/CoreGraphics/QuartzCore，Windows 枚举四语 JSON 与已构建 generic/QPA DLL，把固定 SHA-256 catalog 写入 `OUT_DIR` 供提权 worker 嵌入，release 缺 runtime 时 fail closed。
tauri.conf.json: Tauri 公共配置，以显式 `./index.html` 进入 renderer、关闭 `withGlobalTauri`、设置本地 CSP，固定 updater 公钥与 GitHub `latest.json` endpoint，并注册 `main`/`about` 两个 capability；主窗固定 400×484，内容宽 360px 由 20px 双侧留白推导，两个动作轨道为 170px + 20px + 170px，macOS 使用 decorations + Overlay + hiddenTitle 保留系统原生交通灯，renderer 只承担拖拽区与标题内容。
tauri.macos.conf.json: macOS 合并配置，在 dev/build 前生成 injector，独占 dylib/languages 资源与 DMG；800×476 Finder 安装窗采用成熟 DMG 工具通行的跨屏安全固定原点 200×120，避免把开发机尺寸伪装成动态居中，图标仍在窗内按独立坐标布局；通过 schema 支持的 `bundle.macOS.files` 把四个 `InfoPlist.strings` 映射到 `Contents/Resources/*.lproj`；不硬编码 signing identity，本地、workflow dispatch 与当前 tag 均由显式 `APPLE_SIGNING_IDENTITY="-"` 走 ad-hoc，Tauri updater 签名另由受保护 Ed25519 密钥承担。
Info.plist: macOS app bundle 的自定义 plist 覆盖层；由 Tauri 在配置目录自动发现并合并 `NSAppBundlesUsageDescription` 默认英文用途说明，不承载权限逻辑。
en.lproj/InfoPlist.strings: macOS App Management 英文用途说明；通过 `bundle.macOS.files` 进入最终 app bundle 的 `Contents/Resources/en.lproj`。
zh-Hans.lproj/InfoPlist.strings: macOS App Management 简体中文用途说明；通过 `bundle.macOS.files` 进入最终 app bundle 的 `Contents/Resources/zh-Hans.lproj`。
zh-Hant.lproj/InfoPlist.strings: macOS App Management 繁体中文用途说明；通过 `bundle.macOS.files` 进入最终 app bundle 的 `Contents/Resources/zh-Hant.lproj`。
ja.lproj/InfoPlist.strings: macOS App Management 日文用途说明；通过 `bundle.macOS.files` 进入最终 app bundle 的 `Contents/Resources/ja.lproj`。
tauri.windows.conf.json: Windows 合并配置，以完整 main-window override 将系统 caption 关闭、保留 DWM shadow，并维持共享 400×484 固定最小几何与 360px 内容宽度；在 dev/bundle 前构建 generic + QPA，绑定四语双语义卸载 hook 与 NSIS 消息表，独占 ico/languages/双 DLL，禁止携带 macOS dylib。
tauri.updater-artifacts.conf.json: updater 产物覆盖；仅打开 Tauri v2 `createUpdaterArtifacts`，必须叠加已含最终 updater 公钥/endpoint 的共享配置并由受保护私钥环境执行，只允许 tag 发布或受保护的无发布 signing smoke 加载，普通本地/PR 构建不得加载。
nsis-hooks.nsh: Windows NSIS 生命周期 hook；交互卸载明确选择“仅移除 Switcher 并保留翻译”或“先恢复 English 并移除自有运行时”，更新/静默/被动卸载默认保留，恢复失败则中止；收尾只清安装元数据。
nsis-languages/: Tauri NSIS 四语消息表；保持上游消息键同构，并在原生确认页把应用数据明确限定为 Switcher 自身设置。
capabilities/: Tauri v2 capability 配置，限定 main window 的 core 权限，并为独立 About window 只开放版本读取与共享标题栏拖动；About renderer 不获得任意窗口位置、尺寸、装饰或其他窗口管理权限。
icons/: Tauri 图标集，`icon.png` 是开发态 runtime 与 `npx tauri icon` 的 512px RGBA 源，透明圆角必须与正式包 `icon.icns` 的同尺寸表示保持像素同构；icns/ico/各尺寸 PNG + iOS/Android 是平台投影，`background.png` 为不受图标生成器管理的 1600×856 DMG 背景。
native/: macOS App Management 的 Objective-C AppKit owner；每屏 nonactivating visual replicant、真实 app file-URL drag 与 helper 生命周期都停在该边界，不读取或修改 TCC。
src/: Rust command、InstallLayout、Windows 自动发现/Qt runtime/QPA 与 uninstall restore；commands/ 按状态、安装真相、写入和重启拆分，windows_qpa/ 隔离 hash-locked manifest、含 generic 的 rollback 与显式 English 清理，privilege/ 管理单次 UAC 事务。
tests/: Rust contract tests，守住展示版本/内容 revision 分离、九命令 DTO/固定项目外链、App Management handoff 的固定 permission/viewport/Channel 与无自动授权边界、`main`/`about` 能力、脱敏 Updater 状态、clean-English 采集、Windows restart，以及 macOS 真实冒烟和 Windows disposable clone 的现场门。

依赖边界:
Tauri 是唯一桌面壳；renderer 文件仍是 UI 真相源。Rust command 返回 renderer 兼容 JSON shape；Tauri-only 权限与 updater command 必须保持可选消费，不把 Tauri/plugin 类型泄漏到 `app.js`。

法则: 版本精确·桥先注入·命令等价·副作用可测

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
