# Cavalry Language Switcher 本地打包 SOP - Tauri

本文档记录唯一发布路径：Tauri。旧壳层和 fallback 打包链路已移除，不再作为本地或 CI 发布入口。

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

`src-tauri/tauri.conf.json` 是唯一发布配置：

- `build.frontendDist` 指向 `../renderer`，Tauri 直接加载原 HTML/CSS/JS。
- `build.beforeBuildCommand` 执行 `npm run build:injector`，作为唯一 injector 构建入口。
- `app.withGlobalTauri = true`，供 vanilla bridge 在页面加载前拿到 `window.__TAURI__.core.invoke`。
- main window 外框固定 `480x528`，最小 `420x528`，对应 `480x500` 内容区。
- `bundle.resources` 打包 `../languages` 与 `../injector/libCavalryTranslatorInjector.dylib`。

## 3. DMG 增强修饰 (卷宗图标盖章)

Tauri 原生 DMG 配置（`tauri.conf.json > bundle > macOS > dmg`）已处理背景图、窗口尺寸与图标坐标，无需手动干预。

`src-tauri/icons/icon.png` 是 Tauri 图标源图 contract，必须保持 `1024x1024`、8-bit、RGBA；`32x32.png`、`128x128.png`、`icon.icns`、`icon.ico`、`ios/*` 与 `android/*` 是由 `npx tauri icon` 从源图生成的派生图标。若验证发现尺寸不一致，应恢复 `icon.png` 源图，不得把 `tools/check_tauri_build_sop.js` 改成迁就派生尺寸。

盖章脚本补充 Tauri 不稳定覆盖的 **卷宗图标嵌入**：

```bash
bash tools/stamp_dmg_icon.sh src-tauri/target/release/bundle/dmg
```

该脚本会把 DMG 转为临时可写镜像，挂载后复制 `src-tauri/icons/icon.icns` 为卷宗根目录 `.VolumeIcon.icns`，对挂载卷宗执行 `SetFile -a C`，再压回发布用 UDZO 镜像。这个图标写进 DMG 内部文件系统，裸 `.dmg` 经 GitHub Release 下载后仍可在挂载时生效。

脚本最后仍会 best-effort 对本机 DMG 文件自身写入 Rez/SetFile resource fork。该外壳图标只对当前 macOS 文件系统可靠，GitHub 上传/下载链路会丢弃 `com.apple.ResourceFork`，不作为发布阻塞项。

## 4. 产物验证

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

打包后检查：

- `.app` 位于 `src-tauri/target/release/bundle/macos/`。
- DMG 位于 `src-tauri/target/release/bundle/dmg/`。
- DMG 挂载后必须包含 `.DS_Store`、`.background/background.png`、`.VolumeIcon.icns`、卷宗 custom-icon 标记、`Applications` 链接与 `.app`。
- `.app/Contents/Resources/` 内包含 `languages` 与 `libCavalryTranslatorInjector.dylib`。
- 主窗口截图、字体加载状态、核心控件 bounding box、按钮顺序与状态文本必须满足冻结的 Tauri window contract。

## 5. 当前边界

Tauri 是唯一默认壳与唯一发布路径；bridge、配置、资源声明、Rust contract tests、packaged 资源检查、窗口回归和真实 macOS 三语冒烟都已具备可重跑守门。旧壳层脚本、handler、harness、builder 配置与 fallback 打包入口不得恢复。
