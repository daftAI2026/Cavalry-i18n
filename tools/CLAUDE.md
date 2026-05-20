# tools/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
check_app_contracts.js: Tauri-only Node 合同测试，承接 full-ui、injector、ExtensionLayer 保留英文且不注册空补丁、动态 QLabel 浮动标题、运行时生成图层名、冒号与 No-prefix 标签兜底、Forge 动力学术语、ModelDisplay 中英间距、翻译质量、package/workflow 等非壳层断言。
check_renderer_contract.js: Renderer contract 测试，冻结 UI 三文件 hash、DOM id 锚点与 `window.cavalryI18n` API 需求面。
check_tauri_bridge_runtime.js: Tauri bridge 运行时测试，在 fake DOM 中直接执行 bridge 和 renderer/app.js，覆盖 camelCase-only payload、系统语言本土化、Apply 确认、App Management 授权预检、权限等待与原地重试。
check_tauri_build_sop.js: Tauri 打包 SOP 与配置 contract 测试，验证默认发布文档、资源声明、窗口尺寸与 bridge 能力。
check_tauri_packaged_app.js: packaged Tauri `.app` 资源测试，打包后按 runtime resource 候选检查 renderer、languages、injector、ad-hoc bundle seal 与 bundle size report。
check_dmg_layout.sh: DMG 布局与签名守门器，挂载真实 `.dmg` 并验证 `.DS_Store`、背景图、卷宗图标、custom-icon 标记、Applications 链接、DMG 内 app 与安装态 app 的 bundle seal/codesign strict 结果。
window_contract_lib.js: 窗口回归公共库，封装 macOS 窗口探测、内容区截图与像素 diff。
check_tauri_window_regression.js: packaged Tauri 主窗口回归测试，验证冻结窗口尺寸与内容截图尺寸。
sync_project_version.js: 项目版本同步器，以 CHANGELOG 最新正式版本为真相源，级联同步 package、package-lock、Cargo、Tauri 配置与 Cargo.lock。
release_metadata.js: GitHub Release 协议守门器，以 `release.config.json` 为真相源，校验 `cavalry-2.7.2-pN` tag 并生成 release 标题与 DMG 资产名。
check_runtime_ui_coverage.js: runtime UI 覆盖率守门脚本，读取真实菜单 inventory 并按阈值阻塞未翻译文本。
check_full_ui_coverage.js: 单语言全 UI 覆盖检查，组合 runtime、compiled、JSON-backed 校验。
check_full_ui_matrix.js: 多语言矩阵覆盖检查，写出稳定 runlog 便于连续追踪。
verify_gate_inputs.js: full-ui 前置输入守门器，冻结 session artifact、2.7.2 JSON lower bound、source-map 与 runtime provenance 合法性。
capture_accessibility_inventory.js: live AX runtime 抓取器，写 `RUNTIME_DIR/<lang>-ax-inventory.json` 与 menuDepthMax/submenu path audit evidence。
merge_runtime_inventory.js: runtime inventory 合并器，只接受 live-injector / live-accessibility 输入并产出 `live-merged` session 分母。
run_live_full_ui_matrix.js: G-CAPTURE 编排器，启动真实 Cavalry、解析 launcher PID、拒绝弱抓取并写 session run record，支持无副作用 `--help`。
freeze_extraction_inventory.js: G-X freeze 器，按 whitelist 噪声规则冻结 JSON/compiled/runtime 英文分母并写顶层 target identity。
extract_compiled_ui_strings.js: 从 Cavalry 二进制和 framework 提取疑似用户可见 compiled UI 字符串。
generate_embedded_translations.js: 从 `tools/*.ts` 与 `model_display_translations.json` 生成 injector 编译期翻译表。
model_display_translations.json: display-only 模型名词典，保存 JSON niceName 英文化前的三语显示译名，只供 injector 翻译 Qt 浮动标题等显示层，不回写模型数据，并保持简繁中文 Latin/CJK 间距。
runtime-noise-quarantine.json: Runtime 翻译噪声隔离清单，记录无资源/live-capture provenance 的短 token，并让生成器跳过这些项以保持英文。
resolve_cavalry_qt_sdk.js: 解析当前发布目标 Qt SDK，本机校验 Cavalry.app，CI 缺 SDK 时按配置下载。
stamp_dmg_icon.sh: DMG 卷宗图标盖章器，用 hdiutil 写入 `.VolumeIcon.icns` 与 custom-icon 标记，再用 Rez/SetFile best-effort 写本机 Finder 文件图标。
cavalry_qt_target.json: 发布目标映射，声明 Cavalry 2.7.2、Qt 6.6.3、repo-local SDK 路径和 aqt 下载参数。
build_translator_injector.sh: 构建 `libCavalryTranslatorInjector.dylib`，校验 Qt minor 与目标 Cavalry 匹配。
launch_cavalry_with_injector.sh: 手动调试启动器，复用 embedded injector runtime flow。
validate_translations.py: JSON/TS/injector 翻译质量检查脚本，保留 source/context/translation 三相并输出 §P5 FP-1..12 报告与摘要。
forbidden_translation_patterns.py: Python 共享 forbidden-pattern detector，检测 FP-1/2/3/4/5/7/8/9/10/11 单条翻译反模式。
forbidden_translation_patterns.js: Node 共享 forbidden-pattern detector，供 runtime/full-ui gate 与契约测试复用 FP-1/2/3/4/5/7/8/9/10/11。
forbidden_translation_patterns.json: §P5 detector 配置，集中声明正则、source/context denylist、latin residue、transliteration 与 pangram 规则。
translation-whitelist.json: JSON 翻译检测契约，定义 translate/no_translate/locale_sync 字段边界、模型 niceName 英文保留、FP-10/11/12 whitelist 契约与 G-X denominator filter，含颜色名与 Unicode script 交集剔除 provenance。
ja_JP.ts: 日文 compiled UI 翻译源。
zh-Hans.ts: 简体中文 compiled UI 翻译源。
zh-Hant.ts: 繁体中文 compiled UI 翻译源。
runtime_ui_allowlist.json: runtime UI 覆盖率允许保留英文/快捷键/格式标签/样本值的 exact、contains、regex 与 stripRegex 清单。
fixtures/: 测试 fixture 工厂，生成 fake Cavalry.app 而不提交真实应用包。
git-hooks/: Git Hook 模块目录，承载提交前版本同步闸门（详见 git-hooks/CLAUDE.md）。

依赖边界:
tools 可以读取仓库与本地 Cavalry 安装，但测试型脚本不得修改真实应用；会产生副作用的脚本必须由 npm script 或手动命令显式触发。

法则: 守门清晰·runlog 稳定·真实副作用显式

变更日志
2026-05-14: 新增 `sync_project_version.js` 与 `git-hooks/pre-commit`，将版本真相源收敛为 CHANGELOG 最新正式版本，并同步 npm、Cargo 与 Tauri 元数据。
2026-05-15: 新增 `check_dmg_layout.sh`，把 DMG 背景图、窗口布局元数据与安装链接纳入真实挂载验证；`stamp_dmg_icon.sh` 改为先写 DMG 内部卷宗图标，再 best-effort 写本机 Finder 文件图标。
2026-05-15: `check_tauri_packaged_app.js` 增加 macOS bundle seal 验证，要求 packaged `.app` 含 `_CodeSignature/CodeResources` 并通过 `codesign --verify --deep --strict`，防止浏览器下载后被 Gatekeeper 判定 damaged。
2026-05-15: `check_dmg_layout.sh` 增加 DMG 内与安装态 `.app` 签名验证，确保 GitHub 上传的最终安装镜像本身也携带有效 bundle seal。
2026-05-15: 新增 `release_metadata.js`，把 GitHub Release tag、标题与 DMG 资产名收敛到 `release.config.json`，避免内部 SemVer 与 Cavalry 目标补丁号混用。
2026-05-17: `run_live_full_ui_matrix.js` 增加无副作用 `--help`/`-h`，避免误触发默认 `en` 抓取。
2026-05-17: `runtime_ui_allowlist.json` 扩展 regex/stripRegex 过滤，剔除快捷键、HTML 标签、颜色样本与 AX chrome 噪声，让 live coverage 聚焦真实残留。
2026-05-17: `check_app_contracts.js` 增加 ExtensionLayer 自绘字面量补丁 contract，要求 injector 通过 dyld/Mach-O `__cstring` copy-on-write 命中 Qt 属性抓不到的空状态与视口提示。
2026-05-18: `check_app_contracts.js` 将 ExtensionLayer 合同改为自绘层保持英文，防止 Latin-only overlay renderer 把 CJK glyph 显示为 `?`，并要求 compact sentinel 在 `strcmp` 前被跳过。
2026-05-18: `check_app_contracts.js` 增加 Time Editor niceName 合同，要求 node/plugin 模型 niceName 与英文基线一致，并要求 injector 在 item `setText()` 前跳过这些模型词汇。
2026-05-18: `check_app_contracts.js` 增加 QLineEdit 动态文本合同，要求 injector 监听后续 `textChanged`、保留自动编号后缀，并用 signal-blocked 写回做显示层翻译，避免属性编辑器名称位漏翻或反向污染模型名。
2026-05-18: `generate_embedded_translations.js` 接入 `model_display_translations.json`，把模型 niceName 的中文/日文显示译名移到 injector 显示层，保护 Time Editor 英文模型名同时恢复属性编辑器浮动标题翻译。
2026-05-19: `check_app_contracts.js` 增加对新增动画/时序翻译项与动态帧关键帧菜单的断言测试；`ja_JP.ts`、`zh-Hans.ts`、`zh-Hant.ts` 补充相关翻译条目；`CavalryTranslatorInjector.mm` 支持 Time Editor 在特定帧添加关键帧动作（Add Keyframe on frame <n>）的正则拦截翻译。
2026-05-19: 新增 `runtime-noise-quarantine.json`，`generate_embedded_translations.js` 在生成表时跳过无 provenance 的 runtime 短 token，防止 `Rhu -> 鲁/ログイン` 一类批量污染进入 injector。
2026-05-19: `nodeStrings.json` 补齐 Forge Dynamics 生成属性 label，`tools/*.ts` 修正 `Un-Parent` 与地面/迭代/场术语，`CavalryTranslatorInjector.mm` 增加 `N selected` 状态栏动态翻译。
2026-05-20: `tools/*.ts` 补齐 Add Layer/属性面板生成词，`check_app_contracts.js` 锁定 Add Layer 空标题行修剪、tag token 与 Time Editor niceName 保护边界。
2026-05-20: `zh-Hans.ts` 修正 `unsaved scene` 误译，`CavalryTranslatorInjector.mm` 增加冒号后缀标签兜底，让 `Looping:` 复用 `Looping` 的翻译。
2026-05-20: 修复 `check_tauri_window_regression.js` 在 Retina 屏下由于 physical pixels 物理像素 2 倍缩放导致的截图断言失败，支持自适应 backing scale factor 归一化校验。
2026-05-20: `tools/*.ts` 补齐 `Click to see next message` 裸文本，避免只翻译 HTML 版本而漏掉 Tips 面板渲染后的 QLabel 文本。
2026-05-20: `check_app_contracts.js` 增加 Voronoi Shader `loopLength` 属性与合同断言，确保运行时循环长度标签在四语语言包中同构存在。
2026-05-20: `tauri-bridge.js` 移除 snake_case 回退与未消费 debug 字段，`check_tauri_bridge_runtime.js` 锁定 camelCase-only payload；`check_app_contracts.js` 要求 ExtensionLayer 自绘层不注册空 literal patch 回调。
2026-05-20: `tools/*.ts` 补齐截图审计中暴露的运行时生成属性标签（如 Color Mode、Blend Mode、Gradient Mode、Capture Force、No Mask），`check_app_contracts.js` 锁定这些 TS 兜底翻译，同时继续由 Time Editor niceName 合同保护右侧模型名英文。
2026-05-20: `forbidden_translation_patterns.json` 将 Excel 纳入保留品牌词，配合翻译规范允许 `Excel 工作表` / `Excel シート` 这类术语表声明过的品牌组合。
2026-05-20: `tools/*.ts` 补齐第四批运行时生成属性标签（如 Controllers、Gradient、Dash, Gap、Particles Per Pixel、Emitter Velocity、Speed Limit、Blind Color等），同步更新 `check_app_contracts.js` 合同断言、`generated_translations.inc` 嵌入表并重编译 dylib。
2026-05-20: `CavalryTranslatorInjector.mm` 增加 No-prefix 混合文本兜底翻译，`tools/*.ts` 补齐第五批运行时生成属性标签（如 Override Mass、Direction Type、Cycles），修正 Lottie 及 Force Velocity 物理与波形术语，同步更新 `check_app_contracts.js` 合同断言、`generated_translations.inc` 并重新编译 dylib。
2026-05-21: `CavalryTranslatorInjector.mm` 收窄 Time Editor item view 保护，避免父级 `Scene Window (Time Editor)` 误伤左侧图层列表；新增 `X Shape` 运行时生成图层名显示层派生翻译，并锁定 `No Third Shaders` 等 No-prefix 兜底合同。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
