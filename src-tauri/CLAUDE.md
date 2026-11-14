# src-tauri/
> L2 | 父级: ../CLAUDE.md

成员清单
Cargo.toml: Rust crate 与 Tauri v2 依赖声明；dev只保留调试行表，test继承dev，release默认不变；`tauri`/`tauri-build` 保持精确版本线；macOS 交通灯交给 Tauri 原生窗口配置而不引入直接 AppKit 控件依赖，固定 `cc` build dependency 编译独立 AppKit handoff owner；`sha2` 同时服务 build-time 发布资源 trust anchor、流式安装 revision 与 hash-locked manifest，Windows API crate 仅启用 QPA durable/atomic 文件事务所需 feature。
Cargo.lock: Rust依赖锁；rustls固定0.23.46，维持519项闭包，不增加依赖。
build.rs: 固化BuildMode/native manifest；Mac校验dylib；Windows native绑定2.8编译profile与窄runtime SHA，legacy四语provenance独立。
tauri.conf.json: Tauri 公共配置，以显式 `./index.html` 进入 renderer、关闭 `withGlobalTauri`、设置本地 CSP，固定 updater 公钥与 GitHub `latest.json` endpoint，并注册 `main`/`about` 两个 capability；主窗固定 400×504（40px标题栏+434px内容+30px单行关注footer）、创建时隐藏，由受限 window show/focus 权限在 DOM/CSS 首帧后显露，并以 PageLoad Finished 作为仅在仍隐藏时生效的失败兜底，避免 macOS 回放旧窗口表面或等待完整状态裁决；内容宽 360px 由 20px 双侧留白推导，两个动作轨道为 170px + 20px + 170px，macOS 使用 decorations + Overlay + hiddenTitle + 创建时的 `trafficLightPosition` 保留并定位系统原生交通灯，renderer 只承担拖拽区与标题内容。
tauri.macos.conf.json: macOS 合并配置，在 dev/build 前生成 injector，只映射四个 runtime `languages/{en,zh-Hans,zh-Hant,ja_JP}` 子目录到同名资源路径，不打包 `languages/native` 构建期审批数据；独占 dylib 与 DMG；800×476 Finder 安装窗采用本机成熟参考安装盘实测的固定左上角原点 400×655，只复刻首次打开位置而不改自身尺寸/图标布局，也不把开发机坐标伪装成动态居中；通过 schema 支持的 `bundle.macOS.files` 把四个 `InfoPlist.strings` 映射到 `Contents/Resources/*.lproj`；不硬编码 signing identity，本地、workflow dispatch 与当前 tag 均由显式 `APPLE_SIGNING_IDENTITY="-"` 走 ad-hoc，Tauri updater 签名另由受保护 Ed25519 密钥承担。
Info.plist: macOS app bundle 的自定义 plist 覆盖层；由 Tauri 在配置目录自动发现并合并 `NSAppBundlesUsageDescription` 默认英文用途说明，不承载权限逻辑。
en.lproj/InfoPlist.strings: macOS App Management 英文用途说明；通过 `bundle.macOS.files` 进入最终 app bundle 的 `Contents/Resources/en.lproj`。
zh-Hans.lproj/InfoPlist.strings: macOS App Management 简体中文用途说明；通过 `bundle.macOS.files` 进入最终 app bundle 的 `Contents/Resources/zh-Hans.lproj`。
zh-Hant.lproj/InfoPlist.strings: macOS App Management 繁体中文用途说明；通过 `bundle.macOS.files` 进入最终 app bundle 的 `Contents/Resources/zh-Hant.lproj`。
ja.lproj/InfoPlist.strings: macOS App Management 日文用途说明；通过 `bundle.macOS.files` 进入最终 app bundle 的 `Contents/Resources/ja.lproj`。
tauri.windows.conf.json: Windows 合并配置，以完整 main-window override 关闭系统 caption/native shadow，启用 transparent compositor 表面并继承共享首帧显露/页面完成兜底；Rust 初始化脚本在 DOMContentLoaded 同步平台态后请求首帧 show/focus；产品本体保持共享400×504/360px内容几何（末尾40px为footer，内部404px控件布局不变）；420×524 仅为其四侧各附加 10px alpha 阴影画布且不参与视觉对齐，最大化时由 renderer 状态机归零留白/圆角/阴影；在 dev/bundle 前构建 generic + QPA；resources 只映射四个 runtime `languages/{en,zh-Hans,zh-Hant,ja_JP}` 子目录到原有 `languages/<locale>` 路径，不打包 `languages/native` 构建期数据；绑定四语双语义卸载 hook 与 NSIS 消息表，独占 ico/双 DLL，禁止携带 macOS dylib。
tauri.native-preview.conf.json: macOS未发布开发预览覆盖；独立identifier/productName，关闭旧injector前置命令，数组替换resources仅带当前2.8.1 target/native-language-packs，编译由显式环境开关启用；仅显式ARM候选支持release优化；预览identifier/state与后端updater禁用保持。
tauri.native-production-2.8.conf.json: 当前2.8.1 macOS生产资源覆盖；正式identifier，取消旧injector构建钩子，仅带native语言包。单独加载时禁用更新；必须后叠release-2.8覆盖才能启用统一latest.json。
tauri.native-windows-2.8.conf.json: 在production覆盖后映射native包及2.8窄generic/QPA到固定相对资源路径；安装根仍动态发现，不带第二套Qt。
tauri.updater-artifacts.conf.json: updater 产物覆盖；仅打开 Tauri v2 `createUpdaterArtifacts`，必须叠加已含最终 updater 公钥/endpoint 的共享配置并由受保护私钥环境执行，只允许 tag 发布或受保护的无发布 signing smoke 加载，普通本地/PR 构建不得加载。
tauri.release-2.8.conf.json: 2.8生产统一latest.json endpoint覆盖，继承updater公钥。ARM本地production与tag共用配置；三平台tag仍受implementation-not-ready阻断，本地构建不授发布。
nsis-hooks.nsh: Windows NSIS 生命周期 hook；交互卸载明确选择“仅移除 Switcher 并保留翻译”或“先恢复 English 并移除自有运行时”，更新/静默/被动卸载默认保留，恢复失败则中止；收尾只清安装元数据。
nsis-languages/: Tauri NSIS 四语消息表；保持上游消息键同构，并在原生确认页把应用数据明确限定为 Switcher 自身设置。
capabilities/: Tauri v2 capability 配置，限定 main window 的 core 权限，并为独立 About window 只开放版本读取与共享标题栏拖动；About renderer 不获得任意窗口位置、尺寸、装饰或其他窗口管理权限。
icons/: Tauri 图标集，`icon.png` 是开发态 runtime 与 `npx tauri icon` 的 512px RGBA 源，透明圆角必须与正式包 `icon.icns` 的同尺寸表示保持像素同构；icns/ico/各尺寸 PNG + iOS/Android 是平台投影，`background.png` 为不受图标生成器管理的 1600×856 DMG 背景。
native/: macOS App Management 的 Objective-C AppKit owner；只在真实写事务返回 typed PermissionDenied 后呈现每屏 nonactivating visual replicant、真实 app file-URL drag 与 helper 生命周期，不读取或修改 TCC，也不参与首次事务 admission。
src/: 2.8语言切换与启动不扫描整树；备份与恢复只消费固定槽； Rust command；native预览由approved/staged sourceSHA判定自有runtime更新，复用原NRT旧owner前像，0755 dylib与0700暂存父目录分立；InstallLayout、Windows 自动发现/Qt runtime/QPA 与 uninstall restore；commands/ 按状态、安装真相、写入和重启拆分，windows_qpa/ 隔离 hash-locked manifest、含 generic 的 rollback 与显式 English 清理，privilege/ 管理单次 UAC 事务。
tests/: Rust contract tests，守住展示版本/内容 revision 分离、九命令 DTO/固定项目外链、App Management handoff 的固定 permission/viewport/Channel 与无自动授权边界、`main`/`about` 能力、脱敏 Updater 状态、clean-English 采集、Windows restart；macOS真实门分为只读status与单次ignored原生profile Apply动作，Windows另有disposable clone现场门。
examples/: 显式人工CLI烟测；build-only真实AppHandle复用生产只读status，不运行GUI事件循环、不创建窗口/WebView；首装Absent前置与当前target/partial资源分账，不代验renderer或语言切换。

依赖边界:
Tauri 是唯一桌面壳；renderer 文件仍是 UI 真相源。Rust command 返回 renderer 兼容 JSON shape；Tauri-only 权限与 updater command 必须保持可选消费，不把 Tauri/plugin 类型泄漏到 `app.js`。

法则: 版本精确·桥先注入·命令等价·副作用可测

非English同源profile在canonical回执校验后报告真实恢复阶段，再进入首次receipt写入；不加IO或动画延时。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
