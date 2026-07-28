# tools/
> L2 | 父级: ../CLAUDE.md

成员清单
check_app_contracts.js: Tauri-only Node 合同测试，承接跨平台 Python/换行、full-ui、精确版本 CHANGELOG 发布摘要、capture-only/dirty-only injector、first-match 哈希、TS message context 归属/精确空白/三语 key 对称、裸 `{}` 占位符、Qt ABI-safe accessibility 源码边界、macOS ExtensionLayer 四处空状态定点居中翻译/其余自绘英文边界、Windows MessageBar 双 caller、TransformTool 四条长前缀、Pencil/Pen/Centre text-path、selected-count QLabel 与 Pencil HTML 尾部精确替换、Time Editor 英文保护、item-model 异步补译、aboutToShow 菜单首帧、QLabel/QLineEdit fingerprint、ModalDialog、运行时图层名、自动编号 Composition 标签分母、品牌/术语、翻译质量及 package/workflow 等非壳层断言。
check_renderer_contract.js: Renderer contract 测试，以规范化 LF 冻结 UI 三文件 hash、DOM id 锚点与 `window.cavalryI18n` API 需求面，避免 Git 换行策略制造假漂移。
check_tauri_bridge_runtime.js: Tauri bridge 运行时测试，在 fake DOM 中直接执行 bridge 和 renderer/app.js，覆盖 camelCase-only payload、平台 dataset、系统语言本土化、Apply 确认、提交后 cleanup warning、macOS openPrivacy/Windows requestElevation 权限恢复、不可写自定义根的无 UAC 错误、原地重试与自定义 select 原生 change 语义。
check_tauri_build_sop.js: Tauri 打包 SOP 与配置 contract 测试，验证跨平台 hook/Python/CRLF、PowerShell 5.1 BOM、原生库不入 Git/source artifact、Windows 构建前重生成共享翻译表、shared Qt/generic/QPA 干净构建、无重解析点发布、NSIS hooks 无 Cavalry/QPA 写入入口、源码+产物 provenance/x64 安装态及无第二 Qt runtime、四语系统语言/品牌、隔离安装/同版本更新/卸载与 TEMP 三文件哨兵、由 C++ text-path 源表顺序派生 Windows live 命中掩码、CI、exact-HWND disposable 截图、生产 QPA 启动不清 profile、跨平台发布/版本/README/bridge 契约。
check_tauri_packaged_app.js: packaged Tauri `.app` 资源测试，打包后按 runtime resource 候选检查 renderer、languages、同次平台构建 injector 的哈希同一性与 Qt ABI、ad-hoc bundle seal 及 bundle size report。
windows_nsis_provenance.js: Windows x64 NSIS 当前输入自证器；拒绝 bundle 父链 symlink/junction，仅清本版本预期 EXE/sidecar；记录安装器身份与 renderer/languages/Tauri/Rust/native C++/CMake/build/generated table/generic/QPA 的内容 fingerprint，安装前复算并拒绝源码或产物漂移。
check_windows_nsis_install.ps1: 带 UTF-8 BOM 的 Windows x64 NSIS 安装态守门器；先以 `windows_nsis_provenance.js` 复算显式 `x86_64-pc-windows-msvc` target 的唯一 EXE/sidecar，再在固定 HKCU/快捷方式冲突即失败的前提下于唯一随机 `%TEMP%` 根静默安装、以同一安装器执行 `/UPDATE`、仅通过包内卸载器静默卸载并观察零残留；三阶段都要求独立 TEMP 根中 `qwindows.dll`、vendor backup 与 manifest 的长度/SHA-256 哨兵不变，漂移时保留证据，禁止递归删除掩盖失败。
capture_windows_pid_window.ps1: 带 UTF-8 BOM 的 Windows disposable live-smoke GUI 证据 helper；先验 `%TEMP%` sentinel clone/evidence、无 reparse 路径链与精确 PID，自动截取 Viewport Quality/Transform 且 Transform 必须同时命中 action 与四条长操作前缀位图，并在一次 best-effort 前台请求后的有界 exact-HWND 等待中以 `VK_A` 触发 Edit Shape；显式 `AllowManualCogPitch` 时先拒绝预置 bit 26，再把精确前台窗口交给用户选择 Cogwheel 并拖拽，要求 revision/canonical/whitelist/CJK-success 严格增长、零 fallback/renderer failure，并保存前后诊断与 PNG，仍禁止场景脚本、Qt UIA、坐标/鼠标自动化、强杀、固定 sleep 和覆盖证据。
check_dmg_layout.sh: DMG 布局与签名守门器，挂载真实 `.dmg` 并验证 `.DS_Store`、背景图、卷宗图标、custom-icon 标记、Applications 链接、DMG 内 app 与安装态 app 的 bundle seal/codesign strict 结果。
window_contract_lib.js: 窗口回归公共库，通过明确 AX UI 查询判定辅助能力，封装窗口枚举、内容区截图与原生 `sips` 像素尺寸读取；Finder 无窗口不再导致空心 skip，也不依赖系统 Python/PIL。
check_tauri_window_regression.js: packaged Tauri 主窗口回归测试，验证冻结窗口尺寸与内容截图尺寸。
sync_project_version.js: 项目版本同步器，以 CHANGELOG 最新正式版本为真相源，规范化 CRLF/LF 后级联同步 package、package-lock、Cargo、Tauri 公共配置与 Cargo.lock。
install_git_hooks.js: 跨平台 Git hook 安装器，Windows 在 stale PATH 时继续探测 Program Files/用户级 Git，写入 hook 目录与当前 Node 绝对路径，并精确区分 Git 不可用与非工作树，供 npm postinstall 消费。
pre_commit_gate.js: 可测试的 Node pre-commit 执行层；先拒绝本次 gate 输入闭包中的未暂存/未跟踪差异，再按暂存路径运行 Rust `cargo fmt --check`、JS `node --check`、版本投影同步、语言 JSON 合同与嵌入翻译表一致性；禁止通配暂存，版本投影是唯一受控 `git add`。
check_git_hooks.js: Windows 兼容 Git hook 合同测试，模拟 stale PATH、缺失 Git、非工作树，以及 JS/Rust/版本/语言/gate 自身的 partial-staged 漂移，并冻结快速门禁触发范围。
python_command.js: Python 3 命令边界，优先尊重 `PYTHON`；Windows 先探测用户级 Python Launcher 的绝对路径，再回退 `py -3`/`python`，隔离 IDE/Codex 继承旧 PATH 与 Windows Store 假别名；其余平台使用 `python3`，供 Node 验证器与 Qt SDK 解析器复用。
release_metadata.js: GitHub Release 协议守门器，以 `release.config.json` 为真相源，校验 `cavalry-2.7.2-pN` tag 并生成 release 标题、双架构 DMG 与稳定 Windows x64 NSIS 资产名。
extract_release_changelog.js: Release notes 内容守门器，按内部 SemVer 从 `CHANGELOG.md` 精确抽取单个已发布日期区块；缺失、重复、未标日期或空正文时失败关闭，防止固定产品模板吞掉版本更新。
check_runtime_ui_coverage.js: runtime UI 覆盖率守门脚本，读取真实菜单 inventory 并按阈值阻塞未翻译文本。
check_full_ui_coverage.js: 单语言全 UI 覆盖检查，组合 runtime、compiled、JSON-backed 校验，并通过共享 Python 命令边界启动验证器。
check_full_ui_matrix.js: 多语言矩阵覆盖检查，写出稳定 runlog 便于连续追踪。
verify_gate_inputs.js: full-ui 前置输入守门器，冻结 session artifact、2.7.2 JSON lower bound、source-map 与 runtime provenance 合法性。
capture_accessibility_inventory.js: live AX runtime 抓取器，写 `RUNTIME_DIR/<lang>-ax-inventory.json` 与 menuDepthMax/submenu path audit evidence。
merge_runtime_inventory.js: runtime inventory 合并器，只接受 live-injector / live-accessibility 输入并产出 `live-merged` session 分母。
run_live_full_ui_matrix.js: G-CAPTURE 编排器，启动真实 Cavalry、解析 launcher PID、拒绝弱抓取并写 session run record，支持无副作用 `--help`。
freeze_extraction_inventory.js: G-X freeze 器，按 whitelist 噪声规则冻结 JSON/compiled/runtime 英文分母并写顶层 target identity。
extract_compiled_ui_strings.js: 从 Cavalry 二进制和 framework 提取疑似用户可见 compiled UI 字符串。
generate_embedded_translations.js: 从 `tools/*.ts` 与 `model_display_translations.json` 生成 injector 编译期翻译表，拒绝任何位于 `<context>` 外、运行时不可达的孤儿 `<message>`，并仅对显式 `xml:space="preserve"` 的 source/translation 保留首尾空白。
model_display_translations.json: display-only 模型名词典，保存 JSON niceName 英文化前的三语显示译名，只供 injector 翻译 Qt 浮动标题等显示层，不回写模型数据，并保持简繁中文 Latin/CJK 间距。
runtime-noise-quarantine.json: Runtime 翻译噪声隔离清单，记录无资源/live-capture provenance 的短 token，并让生成器跳过这些项以保持英文。
resolve_cavalry_qt_sdk.js: 从单一 Cavalry/Qt 版本真相解析宿主默认或显式 macOS/Windows SDK 投影；macOS 校验 Cavalry.app，clean CI 缺 SDK 时通过共享 Python 命令边界下载 `clang_64` 或 `msvc2019_64`。
stamp_dmg_icon.sh: DMG 卷宗图标盖章器，用 hdiutil 写入 `.VolumeIcon.icns` 与 custom-icon 标记，再用 Rez/SetFile best-effort 写本机 Finder 文件图标。
cavalry_qt_target.json: 发布目标映射，唯一声明 Cavalry 2.7.2 与 Qt 6.6.3，并为 macOS `clang_64`、Windows `msvc2019_64` 提供 repo-local SDK 路径和 aqt 参数。
build_translator_injector.sh: 从当前翻译源重生成共享 C++ 表后以 `-O2` 构建不纳入 Git 的 universal injector，校验 Qt minor，使用 `@loader_path` 绑定所选 Cavalry 的同目录 Qt，并禁止把构建 SDK 留作运行时 fallback。
launch_cavalry_with_injector.sh: 手动调试启动器，复用 embedded injector runtime flow。
validate_translations.py: JSON/TS/injector 翻译质量检查脚本，保留 source/context/translation 三相并输出 §P5 占位符（含裸 `{}`）及 FP-1..12 报告与摘要；FP-12 只对契约中逐 source 列明的拼写/标点变体放行同义译文。
forbidden_translation_patterns.py: Python 共享 forbidden-pattern detector，检测 FP-1/2/3/4/5/7/8/9/10/11 单条翻译反模式。
forbidden_translation_patterns.js: Node 共享 forbidden-pattern detector，供 runtime/full-ui gate 与契约测试复用 FP-1/2/3/4/5/7/8/9/10/11。
forbidden_translation_patterns.json: §P5 detector 配置，集中声明正则、source/context denylist、latin residue、transliteration 与 pangram 规则。
translation-whitelist.json: JSON 翻译检测契约，定义 translate/no_translate/locale_sync 字段边界、模型 niceName 与 Time Editor 复用动态属性英文保留、FP-10/11/12 whitelist 契约与 G-X denominator filter；颜色拖放的英美拼写/末尾句号变体以 exact source 集合共享同一简中微文案，禁止扩大为通用 FP-12 豁免。
ja_JP.ts: 日文 compiled UI 翻译源。
zh-Hans.ts: 简体中文 compiled UI 翻译源。
zh-Hant.ts: 繁体中文 compiled UI 翻译源。
runtime_ui_allowlist.json: runtime UI 覆盖率允许保留英文/快捷键/格式标签/样本值的 exact、contains、regex 与 stripRegex 清单；可翻译的自动编号 Composition 标签不得进入噪声豁免。
fixtures/: 测试 fixture 工厂，生成 fake Cavalry.app 而不提交真实应用包。
git-hooks/: Git Hook bootstrap 目录，承载提交前 Node 路径解析与快速门禁入口（详见 git-hooks/CLAUDE.md）。

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
2026-05-21: `check_app_contracts.js` 增加注入库 Qt ABI 守门，禁止 checked-in dylib 引入 Cavalry Qt 6.6.3 缺失的 `QWidget::accessibleName/accessibleDescription` 符号。
2026-05-21: `check_app_contracts.js` 增加懒加载 QMenu 首次绘制前翻译合同，锁定 `ActionAdded/Show` 同步处理，避免菜单先显示英文再被后置刷新覆盖。
2026-05-21: `CavalryTranslatorInjector.mm` 增加离线重认证倒计时动态翻译，保留剩余天数；`tools/zh-Hant.ts` 与 `tools/ja_JP.ts` 补齐 Tips 面板 `<i>Click to see next message</i>` 富文本源。
2026-05-21: `CavalryTranslatorInjector.mm` 将 `QMenu::aboutToShow` 收敛到同步首次绘制前菜单翻译链路，避免 Composition 菜单中运行时重置的 QAction 先显示英文再翻译；`check_app_contracts.js` 锁定该合同。
2026-05-21: `tools/*.ts` 修正 Canva 登录态三语文案，保留 Canva/Cavalry 品牌词并清理 Sign-in/Signing out 误译；`check_app_contracts.js` 增加品牌词合同，`generated_translations.inc` 同步再生成。
2026-05-21: `CavalryTranslatorInjector.mm` 将 QLineEdit 纳入 `QEvent::Paint` 首次绘制前同步翻译链路，覆盖 SceneTree `EditableNodeName` 行名英文先画再翻译的问题；`check_app_contracts.js` 锁定该合同。
2026-05-21: `CavalryTranslatorInjector.mm` 增加点编号与括号编号动态图层名正则，红框 Qt/Scene View 显示 `Matches.0`、`String Generator 2 [2.Match String]` 等翻译并保留数字，黄框 Time Editor item view 用同一解析器反向恢复英文；`check_app_contracts.js` 锁定该边界。
2026-05-22: `CavalryTranslatorInjector.mm` 将 Time Editor 保护扩展到通用 `QAbstractItemView` 的 `DisplayRole/EditRole`，覆盖右侧自绘条不走 QListWidgetItem/QTreeWidgetItem 包装时的动态括号名英文恢复；`check_app_contracts.js` 锁定 model role 写回边界。
2026-05-22: `languages/*/nodeStrings.json` 将 Apply Character Spacing 的 `pairs*` 动态属性恢复为英文数据层，避免 Time Editor 自绘条读取 CJK 后显示方框；`tools/*.ts` 继续承担红框 Qt 显示层翻译，`translation-whitelist.json` 与合同测试锁定该分层。
2026-05-22: `CavalryTranslatorInjector.mm` 增加 `QTextEdit::append` 在 dyld 符号解析失败时的安全写入兜底，用直接 cursor 插入避免吞没日志消息；`check_app_contracts.js` 增加对应安全断言。
2026-05-22: `CavalryTranslatorInjector.mm` 增加 `Copied <object>` 动态消息模板翻译，固定谓词按语言本地化、对象名复用现有词典，并同时覆盖 MessageBar 弹窗与底部 QLabel/QStatusBar 状态文本；`check_app_contracts.js` 锁定三语模板、对象名查表与通用 widget 入口。
2026-05-22: `CavalryTranslatorInjector.mm` 移除 MessageBar QTextEdit 的 Paint/Show 文档扫描，只保留 `QTextEdit::append(QString)` 追加时正文替换，避免注入逻辑进入原生弹窗动画路径；`check_app_contracts.js` 锁定该性能边界。
2026-05-22: `CavalryTranslatorInjector.mm` 增加 `Undo/Redo (<operation>)` 动态消息模板翻译，谓词按语言本地化、括号内操作名复用现有词典，并同时覆盖 MessageBar 弹窗与底部状态文本；`check_app_contracts.js` 锁定该入口。
2026-06-04: `check_tauri_build_sop.js` 增加 README release badge endpoint 合同，要求四语 README 不再使用 Shields GitHub Release badge，并要求 tag release workflow 成功创建 Release 后写回 `docs/badges/release.json`。
2026-07-13: 修正 `window_contract_lib.js` 的 AX 前置检查，不再用无关窗口数量判断权限；截图尺寸改由 `sips` 读取，真实 packaged Tauri 窗口回归已执行而非空心 skip。
2026-07-07: `check_tauri_bridge_runtime.js` 增加自定义语言 select 的 change 事件合同，要求自定义弹层选择与原生 select 语义一致。
2026-07-13: injector 合同锁定 capture-only inventory、dirty/direct-child 局部补译、QHash 语义、Paint fingerprint、item-model 异步更新、`-O2` 与 `@loader_path`；真实 Cavalry 验证禁止构建 SDK 作为 runtime RPATH，避免双 Qt SIGABRT。
2026-07-14: `CavalryTranslatorInjector.mm` 定点拦截 `QPainter::drawText(QPointF, QString)`，只翻译 Assets、Attribute Editor、Scene Tree 三处由 `ui::textAtWidgetCentre` 绘制的空状态提示；`zh-Hans.ts`、`zh-Hant.ts`、`ja_JP.ts` 将三条统一收敛为无句号的 UI 微文案，合同锁定三语标点一致性、CJK font fallback、新旧字宽中心补偿、纵向基线不变、Qt 6.6.3 等价四参数重载的不可吞字回退及 `__cstring` 补丁禁令。
2026-07-14: 新增 `extract_release_changelog.js` 与失败关闭合同，GitHub Release 只接受 `INTERNAL_APP_VERSION` 对应的单个非空、已标日期 CHANGELOG 区块，并继续保留产品介绍与下载模板。
2026-07-23: 新增 `install_git_hooks.js` 与 `python_command.js`，修复 Windows npm postinstall/Python 入口；版本、renderer hash、生成表及 C++ 源合同统一跨 CRLF/LF，打包合同同步冻结公共/macOS/Windows Tauri 配置和 Windows CI 可执行构建基线。
2026-07-24: `release_metadata.js` 与打包合同把 Windows x64 NSIS 稳定资产名纳入 `release.config.json` 真相源，要求 tag release 同时上传一个 EXE 与两个 DMG。
2026-07-24: pre-commit 拆为最小 shell bootstrap 与 `pre_commit_gate.js`；按暂存路径执行 Rust 格式、JS 语法、语言 JSON 合同和嵌入翻译表一致性，版本同步仍只显式暂存受控投影，并用 Windows Git resolver 合同覆盖 stale PATH。
2026-07-24: pre-commit 在运行任何读取工作区的子进程 gate 前，拒绝 Rust、JS/package、翻译/语言合同与 gate 自身输入闭包的未暂存或未跟踪差异，防止工作区修正掩盖旧 index；source artifact 同步携带 hook bootstrap 与 Node gate 闭包。
2026-07-24: ExtensionLayer 空状态、拖放提示与 CustomListWidget placeholder 的简中、繁中、日语显示文案统一移除末尾句号；英文 source 与精确 hook 白名单保持不变，完整状态通知仍保留句子标点。
2026-07-24: 新增 `check_windows_nsis_install.ps1`，把 Windows x64 NSIS 从构建产物提升为 CI 隔离安装/卸载合同；随机 TEMP 根、固定用户状态碰撞拒绝、PE/资源/哈希/注册表验证与无破坏性 fallback 的零残留观察共同守住安装态发布面。
2026-07-28: macOS dylib 与 Windows 双 DLL 统一为对应平台 Runner 现场产物；合同要求 source artifact 排除原生库、Windows 构建先重生成共享翻译表，并由 packaged app 以哈希和 Mach-O ABI 证明嵌入的是同次 macOS 构建物。
2026-07-28: runtime UI allowlist 移除自动编号 `Composition <n>` 豁免；合同要求英文 `Composition 1` 阻断 100% coverage，而简中、繁中与日语本地化编号标签正常通过。
2026-07-27: Windows NSIS 安装态守门只解析显式 `x86_64-pc-windows-msvc` target 产物目录，与构建脚本及 CI artifact 上传同构，杜绝脏工作区里旧 `target/release` EXE 被误验。
2026-07-27: `cavalry_qt_target.json` 从 macOS 单投影升级为共享版本加双平台 SDK 投影；resolver 默认跟随宿主并支持 `--platform windows`，Windows CI 与本地 `prepare:qt-sdk:windows` 复用同一路径和 Qt 6.6.3 `msvc2019_64` 校验。
2026-07-27: Windows NSIS 以 `windows_nsis_provenance.js` 形成构建前精确旧输出清理、构建后输入/安装器哈希记录、安装前复算的闭环；sidecar 与 EXE 成对上传，拒绝版本变更留下的未知 EXE 或 orphan sidecar，禁止用 Git HEAD 或 mtime 伪造当前包来源。
2026-07-28: Windows NSIS 安装态 gate 增加 hooks 无 Cavalry/QPA 写入入口合同、同一安装器 `/UPDATE` 重入与独立 TEMP QPA 三文件哨兵；安装、同版本更新、卸载后均要求哨兵长度/SHA-256 不变，漂移时保留证据，同时明确该合同不替代任意真实 Cavalry 根或跨版本升级验收。
2026-07-24: 新增 `capture_windows_pid_window.ps1` 与 ignored Windows live-clone 合同；三语真实 PID 窗口证据必须等待 ExtensionLayer installed 和 DWM 完成，helper 独立调用也先拒绝非 `%TEMP%` sentinel clone，只能优雅关闭 outstanding 精确进程；三张主窗不等于全表面覆盖，逐类追加截图后才进入人工通过。
2026-07-27: `generate_embedded_translations.js` 对 `<context>` 外、不会进入 injector 表的 TS 孤儿消息失败关闭；繁中与日语目录清除 11 条已有 canonical 同源项的历史重复，避免审计把无效备份误判为运行时翻译。
2026-07-27: 三份 compiled/runtime TS 以 `(context, source)` 集合保持严格对称，补齐 `MenuBarManager / ToolBox` 的繁中与日语窗口标题，并为二进制实证的 File 菜单 `Exit` 动作增加三语翻译，阻止普通 Qt runtime 词条静默回退英文。
2026-07-27: Windows MessageBar 仅在 history/live 两个真实 `QTextEdit::append` return 处理最后一个 `<br>` 后的精确 Pencil 警告，明确排除命名 `js_logger`；三语文案统一无句号，Node/合成 callback/只读 vendor PE 合同共同锁定边界。
2026-07-27: 三语 TS 补齐二进制实证的调色板/命名、场景/渲染与工具设置普通 Qt 表面；生成器以 `xml:space="preserve"` 保留 `QMetaObject::tr` 实际 source 的尾随空格，Finder 作为 macOS 产品名进入集中 Latin 保留词；`Pitch Radius:` 暂留到独立绘制链采证完成后处理。
2026-07-27: `CogTool` 的 `Pitch Radius: <integer>` 经 ExtensionLayer 生产、optional vector、PrimitiveToolBase 消费与两处 Core text-path caller 全链采证后加入三语 TS；Windows dispatch 仅在两个批准 caller 接受固定前缀和 MSVC `int` 会生成的 canonical 32-bit 十进制文本，生成表与 Node/C++/vendor 合同共同锁定。
2026-07-27: 繁中 compiled TS 将 Pen/Pencil 状态消息中的简体“钢笔/铅笔”统一为“鋼筆/鉛筆”；共享 FP-4 词表与整份 zh-Hant TS 扫描合同共同阻止同类简体工具名回流。
2026-07-27: Windows NSIS 固定内置 English/SimpChinese/TradChinese/Japanese，直接跟随系统 UI 语言并以 English 兜底；安装器复用现有 ico，明确不把尺寸/格式不匹配的 DMG 背景伪装成 header/sidebar 品牌资产。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
