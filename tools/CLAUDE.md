# tools/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
check_app_contracts.js: Tauri-only Node 合同测试，承接 full-ui、injector、翻译质量、package/workflow 等非壳层断言。
check_renderer_contract.js: Renderer contract 测试，冻结 UI 三文件 hash、DOM id 锚点与 `window.cavalryI18n` API 需求面。
check_tauri_bridge_runtime.js: Tauri bridge 运行时测试，在 fake DOM 中直接执行 bridge.rs 和 renderer/app.js，覆盖系统语言本土化、Apply 确认、App Management 授权预检、权限等待与原地重试。
check_tauri_build_sop.js: Tauri 打包 SOP 与配置 contract 测试，验证默认发布文档、资源声明、窗口尺寸与 bridge 能力。
check_tauri_packaged_app.js: packaged Tauri `.app` 资源测试，打包后检查 renderer、languages、injector 与 bundle size report。
window_contract_lib.js: 窗口回归公共库，封装 macOS 窗口探测、内容区截图与像素 diff。
check_tauri_window_regression.js: packaged Tauri 主窗口回归测试，验证冻结窗口尺寸与内容截图尺寸。
sync_project_version.js: 项目版本同步器，以 CHANGELOG 最新正式版本为真相源，级联同步 package、package-lock、Cargo、Tauri 配置与 Cargo.lock。
check_runtime_ui_coverage.js: runtime UI 覆盖率守门脚本，读取真实菜单 inventory 并按阈值阻塞未翻译文本。
check_full_ui_coverage.js: 单语言全 UI 覆盖检查，组合 runtime、compiled、JSON-backed 校验。
check_full_ui_matrix.js: 多语言矩阵覆盖检查，写出稳定 runlog 便于连续追踪。
verify_gate_inputs.js: full-ui 前置输入守门器，冻结 session artifact、2.7.2 JSON lower bound、source-map 与 runtime provenance 合法性。
capture_accessibility_inventory.js: live AX runtime 抓取器，写 `RUNTIME_DIR/<lang>-ax-inventory.json` 与 menuDepthMax/submenu path audit evidence。
merge_runtime_inventory.js: runtime inventory 合并器，只接受 live-injector / live-accessibility 输入并产出 `live-merged` session 分母。
run_live_full_ui_matrix.js: G-CAPTURE 编排器，启动真实 Cavalry、解析 launcher PID、拒绝弱抓取并写 session run record。
freeze_extraction_inventory.js: G-X freeze 器，按 whitelist 噪声规则冻结 JSON/compiled/runtime 英文分母并写顶层 target identity。
extract_compiled_ui_strings.js: 从 Cavalry 二进制和 framework 提取疑似用户可见 compiled UI 字符串。
generate_embedded_translations.js: 从 `tools/*.ts` 生成 injector 编译期翻译表。
resolve_cavalry_qt_sdk.js: 解析当前发布目标 Qt SDK，本机校验 Cavalry.app，CI 缺 SDK 时按配置下载。
stamp_dmg_icon.sh: DMG Finder 文件图标盖章器，用 Rez/SetFile 写资源分叉，并用 ditto 产出保留图标元数据的 `.dmg.zip` 发布载体。
cavalry_qt_target.json: 发布目标映射，声明 Cavalry 2.7.2、Qt 6.6.3、repo-local SDK 路径和 aqt 下载参数。
build_translator_injector.sh: 构建 `libCavalryTranslatorInjector.dylib`，校验 Qt minor 与目标 Cavalry 匹配。
launch_cavalry_with_injector.sh: 手动调试启动器，复用 embedded injector runtime flow。
validate_translations.py: JSON/TS/injector 翻译质量检查脚本，保留 source/context/translation 三相并输出 §P5 FP-1..12 报告与摘要。
forbidden_translation_patterns.py: Python 共享 forbidden-pattern detector，检测 FP-1/2/3/4/5/7/8/9/10/11 单条翻译反模式。
forbidden_translation_patterns.js: Node 共享 forbidden-pattern detector，供 runtime/full-ui gate 与契约测试复用 FP-1/2/3/4/5/7/8/9/10/11。
forbidden_translation_patterns.json: §P5 detector 配置，集中声明正则、source/context denylist、latin residue、transliteration 与 pangram 规则。
translation-whitelist.json: JSON 翻译检测契约，定义 translate/no_translate/locale_sync 字段边界、FP-10/11/12 whitelist 契约与 G-X denominator filter，含颜色名与 Unicode script 交集剔除 provenance。
ja_JP.ts: 日文 compiled UI 翻译源。
zh-Hans.ts: 简体中文 compiled UI 翻译源。
zh-Hant.ts: 繁体中文 compiled UI 翻译源。
runtime_ui_allowlist.json: runtime UI 覆盖率允许保留英文的显式清单。
fixtures/: 测试 fixture 工厂，生成 fake Cavalry.app 而不提交真实应用包。
git-hooks/: Git Hook 模块目录，承载提交前版本同步闸门（详见 git-hooks/CLAUDE.md）。

依赖边界:
tools 可以读取仓库与本地 Cavalry 安装，但测试型脚本不得修改真实应用；会产生副作用的脚本必须由 npm script 或手动命令显式触发。

法则: 守门清晰·runlog 稳定·真实副作用显式

变更日志
2026-05-14: 新增 `sync_project_version.js` 与 `git-hooks/pre-commit`，将版本真相源收敛为 CHANGELOG 最新正式版本，并同步 npm、Cargo 与 Tauri 元数据。
2026-05-15: `stamp_dmg_icon.sh` 明确区分裸 DMG data fork 与 Finder 图标资源分叉，新增 `.dmg.zip` 作为 GitHub 下载链路的图标保真产物。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
