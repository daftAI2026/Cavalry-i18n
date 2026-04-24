# Cavalry-i18n - Cavalry 桌面语言补丁器
Electron + Node.js + Objective-C++ injector + JSON 语言资源；Tauri 迁移中保持 renderer 原件不变。

<directory>
desktop-patcher/ - 桌面补丁器主程序，Electron 壳层与可注入 i18n handler 分离 (4子目录: lib, renderer, injector, resources)
src-tauri/ - Tauri v2 壳层与 Rust command 实现，复用原 renderer 并逐步追平 Electron handler
languages/ - JSON 语言包与英文基线，按语言代码组织翻译资产
tools/ - 构建、测试、覆盖率、翻译表生成与手动调试脚本
doc/ - 迁移方案、构建 SOP、术语表与 UI 字符串来源地图
</directory>

<config>
package.json - npm 脚本、Electron 构建配置与 Tauri 迁移前置检查入口
package-lock.json - Node 依赖锁定
tools/cavalry_qt_target.json - 当前发布目标 Cavalry/Qt/SDK 映射，CI 无 Cavalry.app 时的唯一版本真相源
.gitignore - 忽略本地文档、Node/Rust 构建产物、dist 与 SDK 缓存
.github/workflows/build.yml - macOS release 构建与 injector 预构建流水线
</config>

架构决策:
Electron `main.js` 只装配窗口和真实依赖；`desktop-patcher/i18n-handlers.js` 承载 5 个 renderer API，允许测试注入 fake dialog、userData、command runner 与资源路径。
Tauri v2 现已接管默认打包路径；窗口配置按 macOS titlebar 高度补偿到 `480x528`，以保持与 Electron `useContentSize` 下 `480x500` 内容区一致。

开发规范:
UI 真相源只在 `desktop-patcher/renderer/` 三文件；迁移不得改 DOM、class、文案、布局。外部命令必须经可替换 runner 或 handler 依赖注入，测试不得触发真实 `osascript`、`codesign`、`xattr`、`open`。
打包必须使用 `npm run build:tauri`（含 DMG 卷宗图标盖章与产物验证），不要用 `npm run build` 或裸 `tauri build`，否则会漏掉盖章步骤。

变更日志:
2026-04-23 - 为 Tauri 迁移 Phase -1/1 播种 L1，记录 Electron 壳层与 handler 分离，并新增 `src-tauri/` 迁移壳。
2026-04-24 - 完成 Tauri 默认构建切换；更新高清图标资产并播种 resources L2 文档；整合打包与静默校验脚本并补齐 Tauri DMG 盖章流程。
2026-04-24 - 收敛默认 `build` 为 `npm run tauri:build`，保留 `build:tauri` 承担 DMG 盖章与 packaged 校验。
2026-04-24 - 修正 full UI 覆盖脚本入口，显式绑定 runtime inventory、compiled source map 与对应 `.ts` 翻译源。
2026-04-24 - 将 Cavalry 2.7.0 / Qt 6.6.3 目标收敛到 `tools/cavalry_qt_target.json`，由 resolver 在本机校验、在 CI 补齐 SDK。
2026-04-24 - CI macOS 打包改用 `npm run prepare:qt-sdk`，不再在 workflow 内写第二份 Qt 版本。
