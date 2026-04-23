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
.gitignore - 忽略本地文档、Node/Rust 构建产物、dist 与 SDK 缓存
.github/workflows/build.yml - macOS release 构建与 injector 预构建流水线
</config>

架构决策:
Electron `main.js` 只装配窗口和真实依赖；`desktop-patcher/i18n-handlers.js` 承载 5 个 renderer API，允许测试注入 fake dialog、userData、command runner 与资源路径。
Tauri v2 现已接管默认打包路径；窗口配置按 macOS titlebar 高度补偿到 `480x528`，以保持与 Electron `useContentSize` 下 `480x500` 内容区一致。

开发规范:
UI 真相源只在 `desktop-patcher/renderer/` 三文件；迁移不得改 DOM、class、文案、布局。外部命令必须经可替换 runner 或 handler 依赖注入，测试不得触发真实 `osascript`、`codesign`、`xattr`、`open`。

变更日志:
2026-04-23 - 为 Tauri 迁移 Phase -1/1 播种 L1，记录 Electron 壳层与 handler 分离，并新增 `src-tauri/` 迁移壳。
2026-04-24 - 完成 Tauri 默认构建切换；更新全套高清图标资产并播种 resources L2 文档。
