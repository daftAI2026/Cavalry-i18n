<!--
[INPUT]: 依赖 Tauri 平台配置、release.config、Qt injector 构建入口、Windows NSIS provenance/安装态守门、disposable live-clone 截图门与打包检查脚本
[OUTPUT]: 对外提供 macOS DMG、Windows NSIS 带当前输入 provenance 的构建/隔离安装卸载验证、Windows clone 基础截图/逐类人工证据采集及真机验收边界
[POS]: 仓库唯一桌面打包操作合同；区分开发机依赖、无真实 Cavalry 的安装态 gate、仅隔离安装根的临时 clone 证据门与最终用户发布验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Cavalry Language Switcher 本地打包 SOP - Tauri

本文档记录唯一发布路径：Tauri。旧壳层和 fallback 打包链路已移除，不再作为本地或 CI 发布入口。

## 1. 核心依赖

- Node 依赖：`@tauri-apps/cli`、`@tauri-apps/api` 固定在 `2.10.1`。
- Rust 依赖：`tauri` 固定在 `2.10.3`，`tauri-build` 固定在 `2.5.6`。
- Injector 依赖：当前发布目标与 macOS/Windows SDK 投影统一写在 `tools/cavalry_qt_target.json`；本机有 Cavalry.app 时校验其 Qt 版本，clean CI 按同一份配置分别准备 Qt `6.6.3` `clang_64` 或 `msvc2019_64` SDK。

准备 Qt SDK；原命令在 macOS 保持兼容，Windows 构建使用显式平台入口：

```bash
npm run prepare:qt-sdk          # macOS
npm run prepare:qt-sdk:windows  # Windows x64
```

## 2. Agent 本地构建话术

如果开发者不想使用 GitHub Release 下载包，可以让本机 agent 按本 SOP 构建。推荐提示词：

```text
请从源码本地构建 Cavalry Language Switcher：

1. 打开仓库 /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n。
2. 严格按照 LOCAL_BUILD_SOP.md 执行。
3. 运行标准 Tauri build、执行 DMG 卷宗图标盖章，并运行 SOP 里的 packaged checks。
4. 完成后告诉我最终 DMG 路径。
```

本地构建产物不是浏览器下载文件，默认不会携带 Chrome/GitHub 下载写入的 `com.apple.quarantine` 标记。

## 3. Release 版本协议

发布版本分两层，不能混用：

- Internal app version: SemVer，写在 `CHANGELOG.md`、`package.json`、`src-tauri/Cargo.toml` 与 `src-tauri/tauri.conf.json`，由 `npm run sync:version` 同步。
- Release tag: `cavalry-2.7.2-pN`，表示“面向 Cavalry 2.7.2 的第 N 个补丁发布”，触发 GitHub Windows/macOS runner 打包与 GitHub Release。
- 三种发布资产：
  - Apple Silicon: `Cavalry.Language.Switcher_Cavalry-2.7.2-pN_aarch64.dmg`
  - Intel: `Cavalry.Language.Switcher_Cavalry-2.7.2-pN_x64.dmg`
- Windows x64 NSIS asset: `Cavalry.Language.Switcher_Cavalry-2.7.2-pN_windows-x64-setup.exe`
  三种发布资产名都由 `tools/release_metadata.js` 从 `release.config.json` 生成，workflow 不允许手写漂移；release job 会下载 Windows build artifact，将 Tauri 原始 EXE 名规范化后，与两个 DMG 一次性上传。

打标前先跑：

```bash
npm run check:version
npm run check:release
npm run test:contracts
```

发布新补丁时只需要创建并推送新 tag；workflow 已固定读取 `release.config.json`，不需要每次改 `.github/workflows/build.yml`：

```bash
git tag -a cavalry-2.7.2-p12 -m "Cavalry Language Switcher for Cavalry 2.7.2 patch 12"
git push origin cavalry-2.7.2-p12
```

## 4. macOS 标准打包流程

```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
export APPLE_SIGNING_IDENTITY="-"

rm -rf src-tauri/target/release/bundle
npm run tauri:build
```

Tauri 配置按“公共合同 + 平台覆盖”拆分：

- `src-tauri/tauri.conf.json` 保存产品标识、版本、renderer、窗口与 capability 等跨平台公共合同。
- `src-tauri/tauri.macos.conf.json` 执行 `npm run build:injector`，声明 DMG/`.app`、`languages`、macOS injector 与 DMG 布局。
- `src-tauri/tauri.windows.conf.json` 先执行 `npm run build:injector:windows`，再声明 NSIS、`icon.ico`、`languages` 与 `injector/windows/generic/cavalryi18n.dll`；它不继承 macOS injector、签名或 DMG 行为。
- `app.withGlobalTauri = true`，供 vanilla bridge 在页面加载前拿到 `window.__TAURI__.core.invoke`。
- main window 外框固定 `480x528`，最小 `420x528`，对应 `480x500` 内容区。
- macOS 的 `bundle.macOS.signingIdentity = "-"` 与 `APPLE_SIGNING_IDENTITY="-"` 都指向同一个 Tauri ad-hoc pseudo-identity，不是 Developer ID；它让 Tauri 在生成 DMG 前对 `.app` 执行显式 bundle signing，写入 `_CodeSignature/CodeResources`，否则浏览器下载后的 quarantine 检查会把缺少 bundle seal 的 app 判定为 damaged。

## 5. Windows NSIS 安装包

Windows CI 和本地开发使用同一个显式平台构建入口：

```powershell
npm run build:tauri:windows
npm run test:tauri:windows-nsis
```

第一条命令是唯一 Windows 用户入口：先解析/准备 Qt 6.6.3 `msvc2019_64`，再由 `tauri.windows.conf.json` 的 build hook 通过 `injector/windows/build.ps1` 完成 plugin configure/build/ctest，并在真正 bundle 前执行 provenance prepare。prepare 只删除当前 `package.json` 版本推导出的预期 EXE、同名 sidecar 和受控 intent；任意其他 EXE 或 `.exe.provenance.json` 残留都会失败，不会泛删。随后按固定 `x86_64-pc-windows-msvc` target 生成 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`，并立即写入同名 `.exe.provenance.json`：它绑定安装器 SHA-256/长度与当前 renderer、languages、Windows Tauri/Rust/config/Cargo/build 输入、package manifests 和已打包 generic DLL 的内容 fingerprint，不取 Git HEAD 或 mtime 代替输入事实。

第二条命令先用同一工具重新计算 sidecar；任何安装器字节、版本、target 或当前打包输入漂移都会在创建 `%TEMP%` 安装目录前失败。通过 provenance 后，`tools/check_windows_nsis_install.ps1` 只消费该唯一安装器：若当前用户已经存在固定卸载键、厂商产品键、桌面/开始菜单快捷方式或自启动项则立即拒绝，不覆盖任何预存安装；否则只在随机 `%TEMP%` 子目录以 `/S /NS` 安装，验证主程序与 plugin 均为 x64、四个语言目录各含 38 个 JSON、安装态 plugin 与仓库源 hash 相同、包内没有 dylib 或第二套 `Qt6*.dll`，并核对 HKCU 卸载元数据。验证成功或失败都会仅尝试包内 `uninstall.exe /S`，随后观察安装目录、固定键与快捷方式全部消失；脚本禁止用递归删除掩盖卸载失败。不得回退读取 `src-tauri/target/release/bundle/nsis`，因为显式 target 构建不会写入该目录，旧文件会造成假绿。

该 gate 会真实安装/卸载 **Cavalry Language Switcher 自身**，但不会启动或写入 Cavalry。它适合 GitHub 临时 Windows 用户；本地运行必须先确保没有已安装的 Cavalry Language Switcher。它证明公共 renderer、Windows runtime、Rust 后端、资源布局和 NSIS 安装态能够闭合，但不能替代真实 Cavalry GUI、Program Files/UAC 或版本升级验收。macOS 对应的 `npm run tauri:build` 也显式加载 `tauri.macos.conf.json`，两个平台不会依赖调用机器的隐式配置选择。

Windows **开发机**应使用 Node 22、Python 3、stable MSVC Rust、Visual Studio 2022 x64 C++ Build Tools、CMake 3.21+ 与 Qt 6.6.3 `msvc2019_64` SDK。系统自带 Windows PowerShell 5.1 已足够执行构建脚本，不要求安装 PowerShell 7。Python 命令由 `tools/python_command.js` 按 `PYTHON`、`py -3`、`python` 顺序解析，不要求额外创建 `python3` 别名。最终用户只运行 Windows x64 NSIS 安装器，无需这些开发依赖。

## 6. DMG 增强修饰 (卷宗图标盖章)

Tauri 原生 DMG 配置（`tauri.macos.conf.json > bundle > macOS > dmg`）已处理背景图、窗口尺寸与图标坐标，无需手动干预。

`src-tauri/icons/icon.png` 是 Tauri 图标源图 contract，必须保持 `1024x1024`、8-bit、RGBA；`32x32.png`、`128x128.png`、`icon.icns`、`icon.ico`、`ios/*` 与 `android/*` 是由 `npx tauri icon` 从源图生成的派生图标。若验证发现尺寸不一致，应恢复 `icon.png` 源图，不得把 `tools/check_tauri_build_sop.js` 改成迁就派生尺寸。

盖章脚本补充 Tauri 不稳定覆盖的 **卷宗图标嵌入**：

```bash
bash tools/stamp_dmg_icon.sh src-tauri/target/release/bundle/dmg
```

该脚本会把 DMG 转为临时可写镜像，挂载后复制 `src-tauri/icons/icon.icns` 为卷宗根目录 `.VolumeIcon.icns`，对挂载卷宗执行 `SetFile -a C`，再压回发布用 UDZO 镜像。这个图标写进 DMG 内部文件系统，裸 `.dmg` 经 GitHub Release 下载后仍可在挂载时生效。

脚本最后仍会 best-effort 对本机 DMG 文件自身写入 Rez/SetFile resource fork。该外壳图标只对当前 macOS 文件系统可靠，GitHub 上传/下载链路会丢弃 `com.apple.ResourceFork`，不作为发布阻塞项。

## 7. 产物验证

```bash
npm run check:app
npm run test:contracts
npm run check:tauri
npm run test:tauri
npm run test:tauri:packaged
npm run test:tauri:dmg-layout
npm run test:tauri:ui
npm run test:tauri:manual-smoke
```

Windows 基线验证：

```powershell
npm run check:version
npm run check:release
npm run check:app
npm run test:contracts
npm run check:tauri
npm run test:tauri
npm run build:tauri:windows
npm run test:tauri:windows-nsis
```

Windows 真机冒烟（不由上述构建命令替代）：在真实 Cavalry 2.7.2 上，以自动发现、当前用户可写的自定义目录和实际 Program Files 目录分别验证安装选择、语言切换、正常重启、English 恢复、安装器升级与卸载。自定义目录不得依赖 UAC；自动 UAC 只可覆盖实际 Program Files 目标。

安装态还必须直接运行 `cavalry-i18n-tauri.exe --launch-cavalry`：English 应以空翻译环境启动；简中、繁中、日语应从保存的任意安装根以空参数启动，并以同 PID ready marker 证明插件就绪。正在 apply/restart 时该入口必须报告 busy 且不 spawn；state、revision、语言 marker 或可信 plugin 缺失/漂移时必须失败关闭。此验收继承当前 Windows 登录 profile，不要求测试账号或清空登录态。

Windows disposable live-clone 截图门只允许显式临时副本，不接受自动发现或真实安装。准备两个已经存在、严格位于 `%TEMP%` 下且各自包含 `.cavalry-i18n-disposable-smoke` sentinel 的目录：clone 根必须是完整、干净 English Cavalry 2.7.2 副本；evidence 根只保存本轮 state 与 PNG。路径通过环境变量传入，代码与 npm script 不固化盘符或安装位置：

```powershell
$env:CAVALRY_I18N_WINDOWS_SMOKE_APP = '<absolute disposable %TEMP% Cavalry clone>'
$env:CAVALRY_I18N_WINDOWS_LIVE_EVIDENCE_DIR = '<absolute disposable %TEMP% evidence root>'
$env:CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH = '1'
npm run test:tauri:manual-windows-live-smoke
```

`CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH=1` 是明确的人工交互开关：每种语言的 Cavalry 窗口获得前台焦点后，helper 先记录同一 PID 的诊断基线并要求 `translatedSourceMask` bit 22 尚未置位；验收者再从“工具”菜单选择“齿轮”，在视口拖拽一次。helper 不猜快捷键、不发送鼠标坐标，也不使用 UIA；它只在真实 vendor 路径令 bit 22 置位，且 `revision`、`canonicalCalls`、`whitelistCalls`、`cjkPathSuccess` 均相对基线严格增长、`fallbackSourceMask=0`、`rendererFailure=0` 后截取 Cog Pitch PNG，并把基线与最终诊断一同写入证据 JSON。未设置该开关时仍只跑三类自动场景，不能据此声称 Pitch 已通过真机验收。

该 ignored harness 启动前发现任意 `Cavalry.exe` 即拒绝运行。它记录 38 个 English JSON 原始字节，逐轮应用简中/繁中/日语，以 `RealCommandRunner` 启动 clone，要求 runtime marker 的 PID、Qt 6.6.3、嵌入表、语言以及 `extensionLayerHookStatus=installed` 全部命中，再以 input-idle 作为可选延迟提示、以精确 PID 顶层窗口和非空像素成帧作为强制 oracle，并在 `DwmFlush` 后写 PNG。Transform 截图不要求前台；Edit Shape 的 exact-HWND `A` 键和人工 Cog Pitch 只做一次 best-effort 前台请求，随后有界等待同一 HWND 获得前台，并在按键后再次验证焦点未转移。每轮仅向仍由本轮持有、且 executable path 已再次证明为 `%TEMP%` sentinel clone 内 `Cavalry.exe` 的全部可见、无 owner 顶层窗口发送标准 `WM_CLOSE`；默认新场景的丢弃确认也只在精确前台 PID 复核后发送。成功关闭即从 outstanding PID 集合移除，cleanup 只重试未关闭 PID。普通 Rust `Result` 错误或 unwind panic 都会进入 cleanup，恢复 English、逐一比较 38 文件原始字节并要求全局 Cavalry PID 为 0；Ctrl+C、进程强制终止、断电或 panic=abort 无法承诺执行 finally。没有强杀或递归清理 fallback。

clone 只隔离 Cavalry 安装根；临时 `APPDATA`/`LOCALAPPDATA` 只维护测试文件卫生，不代表认证隔离。最终真机验收应使用正常生产启动链，以确认现有登录态与用户 profile 被继承。每轮 apply 前后都会重验 containment/reparse 链，但同一用户下的恶意并发换链仍不是被完整消除的 TOCTOU；这里保持 fail-closed 的重复校验，不为理论攻击引入复杂的 handle-relative NT 文件架构。

当前环境没有可靠的 Cavalry UI OCR oracle，因此 harness 默认生成的三类 PNG，以及 opt-in 时追加的 Cog Pitch PNG，都只是基础证据，并会明确以 `MANUAL SCREENSHOT REVIEW REQUIRED` 结束，而不是返回虚假的 GUI 翻译绿灯。人工验收还必须逐类显式展开并追加截图：菜单、属性编辑器、合成/自动编号项、所有受控下拉显示项、四条 ExtensionLayer 空状态、Snippet 提示、Viewport Quality 与左下快捷提示（helper）；只有这些表面逐类可见后才能通过。`--no-run` 编译、marker PASS 或主窗截图都不能替代这一步。

打包后检查：

- `.app` 位于 `src-tauri/target/release/bundle/macos/`。
- DMG 内 `.app` 与从 DMG 拷贝出的安装态 `.app` 都必须包含 `Contents/_CodeSignature/CodeResources`，并通过 `codesign --verify --deep --strict`。
- DMG 位于 `src-tauri/target/release/bundle/dmg/`。
- DMG 挂载后必须包含 `.DS_Store`、`.background/background.png`、`.VolumeIcon.icns`、卷宗 custom-icon 标记、`Applications` 链接与 `.app`。
- `.app/Contents/Resources/` 内包含 `languages` 与 `libCavalryTranslatorInjector.dylib`。
- 主窗口截图、字体加载状态、核心控件 bounding box、按钮顺序与状态文本必须满足冻结的 Tauri window contract。

## 8. 当前边界

Tauri 是唯一默认壳与唯一发布路径；macOS 的 bridge、平台配置、资源声明、Rust contract tests、packaged 资源检查、窗口回归和真实三语冒烟都已具备可重跑守门。Windows 当前具备独立配置、Qt runtime plugin、Node/Rust 合同、NSIS 构建、随机 TEMP 安装卸载 gate，以及只写显式 disposable clone/evidence 根的三语 PID 窗口截图门；截图仍需人工审阅，公开发布也仍必须等待真实安装路径上的三语 GUI、Program Files/UAC 与安装器升级验收闭环。旧壳层脚本、handler、harness、builder 配置与 fallback 打包入口不得恢复。
