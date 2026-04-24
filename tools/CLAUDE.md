# tools/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
check_electron_patcher_ui.js: Node baseline 测试，冻结 Electron patcher 文件存在性、renderer/preload 契约、macOS patch 约束、UI 覆盖脚本入口。
check_renderer_contract.js: Renderer contract 测试，冻结 UI 三文件 hash、DOM id 锚点与 `window.cavalryI18n` API 需求面。
electron_harness.js: 无副作用 Electron handler harness，注入 fake app、dialog、userData、resourcesPath、spawn/spawnSync 与路径归一化。
capture_electron_contract.js: Electron 行为 snapshot 捕获器，通过 harness 跑完 5 个 IPC 并输出规范化 JSON。
check_electron_contract_snapshots.js: Electron 行为 snapshot 回归测试，对比 `fixtures/electron_contract_snapshot.json`。
check_tauri_bridge_runtime.js: Tauri bridge 运行时测试，在 fake DOM 中直接执行 bridge.rs 和 renderer/app.js。
check_tauri_build_sop.js: Tauri 打包 SOP 与配置 contract 测试，验证默认发布文档、资源声明、窗口尺寸与 bridge 能力。
check_tauri_packaged_app.js: packaged Tauri `.app` 资源测试，打包后检查 renderer、languages、injector 与 bundle size report。
window_contract_lib.js: 窗口回归公共库，封装 macOS 窗口探测、内容区截图与像素 diff。
capture_electron_window_baseline.js: Electron 主窗口 baseline 捕获器，写入冻结 fixture。
check_tauri_window_regression.js: packaged Tauri 主窗口回归测试，比较 Electron baseline 的窗口尺寸与内容截图。
check_runtime_ui_coverage.js: runtime UI 覆盖率守门脚本，读取真实菜单 inventory 并按阈值阻塞未翻译文本。
check_full_ui_coverage.js: 单语言全 UI 覆盖检查，组合 runtime、compiled、JSON-backed 校验。
check_full_ui_matrix.js: 多语言矩阵覆盖检查，写出稳定 runlog 便于连续追踪。
extract_compiled_ui_strings.js: 从 Cavalry 二进制和 framework 提取疑似用户可见 compiled UI 字符串。
generate_embedded_translations.js: 从 `tools/*.ts` 生成 injector 编译期翻译表。
resolve_cavalry_qt_sdk.js: 解析当前发布目标 Qt SDK，本机校验 Cavalry.app，CI 缺 SDK 时按配置下载。
cavalry_qt_target.json: 发布目标映射，声明 Cavalry 2.7.0、Qt 6.6.3、repo-local SDK 路径和 aqt 下载参数。
build_translator_injector.sh: 构建 `libCavalryTranslatorInjector.dylib`，校验 Qt minor 与目标 Cavalry 匹配。
launch_cavalry_with_injector.sh: 手动调试启动器，复用 embedded injector runtime flow。
validate_translations.py: JSON 翻译质量检查脚本，输出报告与摘要。
ja_JP.ts: 日文 compiled UI 翻译源。
zh-Hans.ts: 简体中文 compiled UI 翻译源。
zh-Hant.ts: 繁体中文 compiled UI 翻译源。
runtime_ui_allowlist.json: runtime UI 覆盖率允许保留英文的显式清单。
fixtures/: 测试 fixture 工厂与 Electron contract snapshot，生成 fake Cavalry.app 而不提交真实应用包。

依赖边界:
tools 可以读取仓库与本地 Cavalry 安装，但测试型脚本不得修改真实应用；会产生副作用的脚本必须由 npm script 或手动命令显式触发。

法则: 守门清晰·runlog 稳定·真实副作用显式

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
