# Cavalry Language Switcher 本地打包 SOP - Tauri

本文档记录 Tauri 默认打包路径。Electron 发布流程已归档到 `doc/archive/LOCAL_BUILD_ELECTRON_SOP.md`，只作为回退期参考。

## 1. 核心依赖

- Node 依赖：`@tauri-apps/cli`、`@tauri-apps/api` 固定在 `2.10.1`。
- Rust 依赖：`tauri` 固定在 `2.10.3`，`tauri-build` 固定在 `2.5.6`。
- Injector 依赖：当前发布目标写在 `tools/cavalry_qt_target.json`，本机有 Cavalry.app 时校验其 Qt 版本，CI 无 Cavalry.app 时按配置准备 Qt `6.6.3` SDK。

准备 Qt SDK：

```bash
npm run prepare:qt-sdk
```

## 2. 标准打包流程

```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false

rm -rf src-tauri/target/release/bundle
npm run tauri:build
```

`src-tauri/tauri.conf.json` 是默认发布配置：

- `build.frontendDist` 指向 `../desktop-patcher/renderer`，Tauri 直接加载原 HTML/CSS/JS。
- `build.beforeBuildCommand` 执行 `npm run build:injector`，作为唯一 injector 构建入口。
- `app.withGlobalTauri = true`，供 vanilla bridge 在页面加载前拿到 `window.__TAURI__.core.invoke`。
- main window 外框固定 `480x528`，最小 `420x528`，对应 Electron `useContentSize` 下的 `480x500` 内容区。
- `bundle.resources` 打包 `../languages` 与 `../desktop-patcher/injector/libCavalryTranslatorInjector.dylib`。

## 3. DMG 增强修饰 (卷宗图标盖章)

Tauri 原生 DMG 配置（`tauri.conf.json > bundle > macOS > dmg`）已处理背景图、窗口尺寸与图标坐标，无需手动干预。

盖章脚本仅补充 Tauri 不支持的 **卷宗磁盘图标嵌入**（Finder 中 DMG 文件自身的图标）：

```bash
bash tools/stamp_dmg_icon.sh src-tauri/target/release/bundle/dmg
```

该脚本将 `desktop-patcher/resources/icon.icns` 通过 Rez/SetFile 嵌入 DMG 文件的资源分叉，使 DMG 在 Finder 中显示自定义图标。

## 4. 产物验证

```bash
npm run check:desktop
npm run test:desktop
npm run check:tauri
npm run test:tauri
npm run capture:electron:window-baseline
npm run test:tauri:ui
npm run test:tauri:packaged
npm run test:tauri:manual-smoke
```

打包后检查：

- `.app` 位于 `src-tauri/target/release/bundle/macos/`。
- DMG 位于 `src-tauri/target/release/bundle/dmg/`。
- `.app/Contents/Resources/` 内包含 `languages` 与 `libCavalryTranslatorInjector.dylib`。
- 主窗口截图、字体加载状态、核心控件 bounding box、按钮顺序、状态文本必须与 Electron baseline 对比通过后，才能宣称 UI 100% 迁移完成。

## 4. 当前边界

Tauri 已成为默认打包路径；bridge、配置、资源声明、Rust contract tests、packaged 资源检查、窗口回归和真实 macOS 三语冒烟都已具备可重跑守门。Electron 只保留在显式 fallback 脚本与归档 SOP 中。
