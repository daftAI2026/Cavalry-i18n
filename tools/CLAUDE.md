# tools/
> L2 | 父级: ../CLAUDE.md

成员清单
test_temp_dir.js: 合同测试 fixture 的临时目录所有权边界；仅创建并清理本进程在 os.tmpdir 直接子级、固定前缀且无 symlink/reparse 的注册目录
windows-acceptance/: Windows x64 Cavalry 2.7.2 release acceptance contract/producer; Rust live tests emit the TEMP machine record only after the runtime source DLL bytes match the final NSIS inputs, the interactive reviewer only confirms existing screenshots and derives review/final records, and the producer verifies final NSIS/provenance, generic/QPA DLL identities, live inventory, exact PID/HWND matrix, tag/source/session bindings before deriving a portable release summary.
check_app_contracts.js: Tauri-only Node 合同测试；在既有跨平台/翻译/打包边界上，定向锁定 macOS/Windows Assets 瞬态 owner、Tag/Tracking 负边界、Add Layer 具体快捷键隔离、Scene Statistics 同窗 Update 三语值、Transform 五 action ABI 防火墙与 Guide 固定 `en` 加载槽位，不承载现场证据编排。
check_renderer_contract.js: Renderer 静态合同，冻结 token 单向依赖、平台 chrome、Grid/Flex、Activity、Trigger/popup 双占位且开启后不漂移的 Select、Tooltip/AlertDialog/Toast、无描边彩色 Badge、Phosphor 图标、固定外链与 400×484 capability；权限审查页另冻结视觉参数、HTML drag/fixture 边界，并阻止 DOM 单屏替身冒充原生 drop、授权、多屏或 backing-scale 证据。
check_operation_log_runtime.js: 任务反馈专属运行时合同，以最小 DOM/时钟执行真实 icons/operation-log 源，隔离验证 Marker 稳定原位更新、下一帧真实行高收敛后的 live-edge、首尾固定轨道改变中段高度后的溢出与起止边缘回算、快事件可读串行、结果排队和错误立即抢占，不重复 bridge 业务 fixture。
check_tauri_bridge_runtime.js: Tauri bridge fake-DOM 运行合同，执行真实组件和 app 源；覆盖手动安装入口、Select Trigger/popup 占位与显式选择、Managed Legacy 受管英文恢复、旧/新/未知版本只读门禁、只读权限未知的 idle 投影、主任务/Updater/About/窗口控件，并证明 About/外链失败进入局部 Toast 而不覆盖 Activity。
ui_review_workspace.js: localhost UI Review 的纯导航壳；侧栏切换真实主窗口/About、反馈/图标/徽章总览及权限交接页，只拥有 fixture/locale 路由与审查窗口外框，并兼容转发独立 handoff renderer。
ui_review_permission_handoff.js: clean-room macOS App Management 权限 handoff 的结构/样式层；以内嵌真实 `permissionMac` renderer iframe 为源、匿名 DOM mock 为系统设置目标，复用生产 tokens/Button/语义图标/应用标识，并在底部并列不入库的本机截图、仅供核对提示箭头的私有 Raster 与项目自绘候选；落稳后的 App 权限项与有状态已有行开关只审查 HTML 视觉连续性，不复制生产 Dialog、第三方私有资产或冒充原生 AppKit 实现。
ui_review_permission_handoff_runtime.js: 权限 handoff 原型的浏览器行为层；将 typed 拒绝→打开/定位设置→单次 50pt 弧线与双图交叉→实时 helper 接管/项目自绘箭头提示→App 图标 drag image 向整个 System Settings 区域发起 file URL copy drop→系统行视觉更新→fixture 经真实 renderer 自动重试→成功或其他错误驱动 reverse/cleanup 分开建模，并允许审查者一步触发完整结果回环而不必理解内部重试门禁；正向开始后冻结 source，source 缺失与系统 Reduce Motion 走静态 helper，renderer 变化与舞台重排只刷新 target，避免原动作消失时破坏反向收口；仍拒绝时保留 helper，所有 DOM 视觉、单屏 CSS 几何、HTML 拖放与 fixture 结果仅是 UI Review 证据，不冒充 NSImage/NSPanel/NSDraggingSession、多屏 backing-scale 或 native 授权。
ui_review_server.js: localhost UI Review 编排入口；每次请求直接读取真实 renderer 并失效工作台/handoff/catalogs 模块缓存，600ms revision 同时覆盖生产 renderer 与四个审查模块以自动刷新当前 iframe；只在 frozen bridge 前注入 fake API，以场景 fixture 驱动未找到/官方/翻译/Managed Legacy/旧新版本/重装/恢复失败、更新 Tooltip、AlertDialog、Toast 及 Switch/Restore English/Update 流程，并以固定同源消息让 handoff 审查页把三种注入结论跑进同一真实 Activity；`/handoff` 只提供匿名 clean-room 原型，两个固定 `/local-reference/` 路由从临时目录或显式 `CAVALRY_UI_REVIEW_REFERENCE_ROOT` 只读取图且缺失即 404，不伪造 native/package 证据。
ui_review_catalogs.js: UI Review 三类动态总览；从生产 tokens/styles/ui-text/icons 读取并投影四语反馈文案、语义图标和 Badge 状态，不维护第二套产品视觉资产。
check_tauri_build_sop.js: Tauri 打包 SOP 与配置 contract 测试；除跨平台发布、updater 资产、tag preflight、macOS/Windows 打包门外，冻结 SOP/配置同构的 400×484 固定最小窗口、主窗口无滚动而 Select/任务事件视窗可内部滚动、macOS decorations/Overlay/hiddenTitle 原生窗口合同与显式标题拖动 capability，并验证 `NSAppBundlesUsageDescription` 四语源文件、`bundle.macOS.files` 目标和可选最终 `.app` readback。
check_tauri_packaged_app.js: packaged Tauri `.app` 资源测试，打包后按 runtime resource 候选检查 renderer 关键 shell/语义图标/任务事件/Updater 投影，并以权限 handoff 源文件→Brotli codegen asset→最终可执行文件的字节闭包拒绝旧 WebView 资源；同时验证 languages、同次平台构建 injector 的哈希同一性与 Qt ABI、ad-hoc bundle seal及 bundle size report。
windows_nsis_provenance.js: Windows x64 NSIS 当前输入自证器；schema v2 intent 区分普通构建与 tag updater 构建，前者拒绝任意 `.exe.sig`，后者要求并绑定 exact base64 signature；只清本版本受控 EXE/provenance/signature，拒绝外国输出，并对 renderer/languages/Tauri/updater overlay/Rust/native/shared policy/generated table/generic/QPA 复算 fingerprint。
check_windows_nsis_install.ps1: 带 UTF-8 BOM 的 Windows x64 NSIS 安装态守门器；先以 `windows_nsis_provenance.js` 复算显式 `x86_64-pc-windows-msvc` target 的唯一 EXE/sidecar，再在固定 HKCU/快捷方式冲突即失败的前提下于唯一随机 `%TEMP%` 根静默安装、以同一安装器执行 `/UPDATE`、仅通过包内卸载器静默卸载并观察零残留；三阶段都要求独立 TEMP 根中 `qwindows.dll`、vendor backup 与 manifest 的长度/SHA-256 哨兵不变，漂移时保留证据，禁止递归删除掩盖失败。
capture_windows_pid_window.ps1: 带 UTF-8 BOM 的 Windows disposable live-smoke GUI 证据 helper；先验 `%TEMP%` sentinel clone/evidence、无 reparse 路径链与精确 PID，自动截取 Viewport Quality/Transform 且 Transform 必须同时命中 action 与三条长操作前缀的 64 位位图，并在有界 exact-HWND 前台获取重试中以 `VK_A` 触发 Edit Shape，键投递前由 helper 再复核 HWND/PID；Onboarding 只接受 runtime 发布的非零十进制 HWND，复核可见、未 cloaked 且属于 exact PID 后直接截图；Adjacent 正式 gate 由 producer-side Qt grab 封存瞬态 PNG，本 helper 的 exact-HWND screen-copy 只保留为诊断回退；Close 向 exact PID 全部顶层 HWND 投递 WM_CLOSE，ForceStop 只在超时且再次复核同 executable/PID 后用于 disposable child 清理，不参与 PASS；按键后的同 PID 子窗/模态窗焦点变化不再被误判为失败，禁止盲键确认、场景脚本、Qt UIA、坐标/鼠标自动化、固定 sleep 和覆盖证据。
check_dmg_layout.sh: DMG 布局与签名守门器，挂载真实 `.dmg` 并验证 `.DS_Store`、背景图、卷宗图标、custom-icon 标记、Applications 链接、DMG 内 app 与安装态 app 的 bundle seal/codesign strict 结果。
window_contract_lib.js: 窗口回归公共库，封装 AX 能力、窗口枚举、400×484 Overlay 内容截图与 `sips` 像素尺寸归一，不依赖 Python/PIL。
check_tauri_window_regression.js: packaged Tauri 主窗口回归测试，截图前后复核 AX 坐标稳定，验证 400×484 Overlay 窗口外形、完整内容截图与 backing scale，拒绝启动居中位移造成的裁切假象。
sync_project_version.js: 项目版本同步器，以 CHANGELOG 最新正式版本为真相源，规范化 CRLF/LF 后级联同步 package、package-lock、Cargo、Tauri 公共配置与 Cargo.lock。
install_git_hooks.js: 跨平台 Git hook 安装器，Windows 在 stale PATH 时继续探测 Program Files/用户级 Git，写入 hook 目录与当前 Node 绝对路径，并精确区分 Git 不可用与非工作树，供 npm postinstall 消费。
pre_commit_gate.js: 可测试的 Node pre-commit 执行层；先拒绝本次 gate 输入闭包中的未暂存/未跟踪差异，再按暂存路径运行 Rust `cargo fmt --check`、JS `node --check`、版本投影同步、语言 JSON 合同与嵌入翻译表一致性；禁止通配暂存，版本投影是唯一受控 `git add`。
check_git_hooks.js: Windows 兼容 Git hook 合同测试，模拟 stale PATH、缺失 Git、非工作树，以及 JS/Rust/版本/语言/gate 自身的 partial-staged 漂移，并冻结快速门禁触发范围。
python_command.js: Python 3 命令边界，优先尊重 `PYTHON`；Windows 先探测用户级 Python Launcher 的绝对路径，再回退 `py -3`/`python`，隔离 IDE/Codex 继承旧 PATH 与 Windows Store 假别名；其余平台使用 `python3`，供 Node 验证器与 Qt SDK 解析器复用。
npm_command.js: npm 工具链身份命令边界，优先以当前 Node 执行 `npm_execpath` 保持无 shell；仅在缺少 CLI 路径的 Windows 宿主为固定 `npm --version` 使用 shell fallback，供漏洞门与 toolchain evidence recorder 复用。
powershell_command.js: Windows 开发脚本宿主边界；优先单次启动 `pwsh.exe`，仅在宿主不存在时清除继承的 `PSModulePath` 并回退 `powershell.exe`，脚本非零或启动拒绝原样失败，供 injector 构建与 NSIS 安装态守门复用。
release_metadata.js: GitHub Release 协议守门器，以 `release.config.json` 为真相源，校验 `cavalry-2.7.2-pN` tag，生成双架构 DMG、Windows x64 NSIS、macOS updater archive、三份签名 sidecar 与 `latest.json` 的唯一名称，并向 manifest producer 共享同一解析函数。
create_updater_manifest.js: 静态 Tauri updater manifest producer；从当前 package SemVer、已审阅 notes、三个 exact-name artifact 及对应 base64 `.sig` 确定性生成 `latest.json`，只允许两个 macOS 架构与 Windows x64，不持有密钥也不上传。
create_updater_manifest.test.js: updater manifest 离线对抗测试；以临时伪 artifact/signature 验证三平台映射、稳定 URL/时间归一化，以及命名、签名格式和 symlink 输入失败关闭。
release_publish.js: 幂等 GitHub Release 发布器；私有 draft 先补全并逐项回读三项人工安装资产、六项 updater manifest/archive/signature 与强制 sidecar，最后一步才公开；本地生成 SHA256SUMS/ReleaseAssetProvenance，并以 verifier 复核 signed seal、manifest 语义、SBOM 与 toolchain，冲突 fail-closed。
create_release_acceptance_evidence.js / create_release_acceptance_attestation.js / verify_release_acceptance_evidence.js / verify_release_acceptance_attestation.js: tag 前置 live macOS acceptance evidence 与独立 Ed25519 protected-attestation；evidence 生成器只接受 `--windows-session-dir` 原始 Windows session 并从复验结果派生 summary，verifier 在显式提供原始 session 时重新验证并比较 summary，两者均拒绝可手写的 summary 路径；tag/publish 无原始 session 时由 protected attestation 绑定 evidence 精确字节，再由 release seal 绑定实际 Windows installer；一旦 release 声明 Windows artifact，`--require-windows` 会强制 evidence 内 summary 的 tag/source/installer/generic/QPA/session 结构，候选代码只在 repo 外 prepare canonical payload、接收 detached signature/public DER 后 assemble，长期私钥只存在于不运行候选代码的外部 signer；tag 只接受 evidence+attestation 两文件提交并以外部固定 fingerprint fail-closed 校验（commit/tag/Cavalry/Qt/OS/语言矩阵）。
create_release_acceptance_seal.js / verify_release_acceptance_seal.js / release_seal_signature.js / verify_release_trust_anchors.js: 将 evidence、macOS notarization、三主资产、CycloneDX SBOM、toolchain evidence 与完整 Windows acceptance summary 绑定为受保护 Ed25519 密钥签名的 ReleaseAcceptanceSeal；Windows installer SHA-256/长度必须等于 acceptance summary，release 与 acceptance 使用不同 fingerprint，缺失或同键复用均 fail-closed。
create_sbom.js / verify_release_provenance.js: 从 npm/Cargo lockfiles 生成确定性 CycloneDX 1.5 SBOM，并复核公开 ReleaseAssetProvenance 对 schema v5 seal、SBOM、toolchain、九项人工安装/updater 分发字节及 manifest 三平台语义的精确绑定。
create_source_artifact.js / verify_source_artifact.js / source_artifact_manifest.json + schemas/: 用 mode-preserving tar 输出 repo 外 source artifact；verifier 独立生成同 commit 的 `git archive`，逐 entry 拒绝 link/special/traversal/duplicate/secret 并精确比对路径、bytes、type 与 mode，marker 不能替代 tree 校验。
verify_ci_action_pins.js + ci_action_pins.json: 以 strict unique-key YAML AST 枚举 job/step 全部 `uses`（含 unnamed、`if`-first、flow mapping 与 quoted key），执行 GitHub Actions 全量 40 位 SHA allowlist、Node/Python/aqt/Rust 精确 pin，并拒绝 cargo-audit 绕过 channel qualifier 触发项目组件调和。
record_toolchain_evidence.js / create_toolchain_evidence_bundle.js: 前者在 source-contract/macOS 真实 producer 上 fail-closed 捕获无 secret 的版本与 runner 证据；后者要求 source-contracts、macOS aarch64/x64 三 scope 与 release commit/target 精确一致，聚合为 seal 绑定的 `toolchain-evidence.json`；Windows producer evidence 由 `record_windows_toolchain_evidence.js` 单独上传，待 #16 绑定 release 聚合。
extract_release_changelog.js: Release notes 内容守门器，按内部 SemVer 从 `CHANGELOG.md` 精确抽取单个已发布日期区块；缺失、重复、未标日期或空正文时失败关闭，防止固定产品模板吞掉版本更新。
check_runtime_ui_coverage.js: runtime UI 覆盖率守门脚本，读取真实菜单 inventory 并按阈值阻塞未翻译文本。
check_full_ui_coverage.js: 单语言全 UI 覆盖检查，组合 runtime、compiled、JSON-backed 校验，并通过共享 Python 命令边界启动验证器。
check_full_ui_matrix.js: 多语言矩阵覆盖检查，写出稳定 runlog 便于连续追踪。
verify_gate_inputs.js: full-ui 前置输入守门器，冻结 session artifact、2.7.2 JSON lower bound、source-map 与 runtime provenance 合法性。
capture_accessibility_inventory.js: live AX runtime 抓取器，写 `RUNTIME_DIR/<lang>-ax-inventory.json` 与 menuDepthMax/submenu path audit evidence。
merge_runtime_inventory.js: runtime inventory 合并器，只接受 live-injector / live-accessibility 输入并产出 `live-merged` session 分母。
run_live_full_ui_matrix.js: G-CAPTURE 编排器，启动真实 Cavalry、解析 launcher PID、拒绝弱抓取并写 session run record，支持无副作用 `--help`。
macos-acceptance/: 可复用 macOS 定向 release-gate 工具；以 `source_contract.js` 为 producer/verifier 共用的完整源码与 fixture closure，结合 tracked Objective-C++ driver、exact CGWindow helper、冻结媒体、现场 `sw_vers` host product/build identity 与 target/stage 身份闭合的 Node matrix/v6 执行三语 21-run/48-point 验收，静态合同和无 vendor app 原生 compile 进入 CI，运行产物严格留在 repo/clone 外 session。
macos-handoff-acceptance/: packaged App Management handoff 的只读人工证据工具；冻结精确 Switcher、Cavalry launcher/runtime 与宿主身份，按固定阶段记录 point/backing-scale、Reduce Motion 和仅 Switcher 自有窗口截图，System Settings 只留无标题几何，禁止自动改权限或把 drop 当授权事实。
freeze_extraction_inventory.js: G-X freeze 器，按 whitelist 噪声规则冻结 JSON/compiled/runtime 英文分母并写顶层 target identity。
extract_compiled_ui_strings.js: 从 Cavalry 二进制和 framework 提取疑似用户可见 compiled UI 字符串。
generate_embedded_translations.js: 从 `tools/*.ts` 与 `model_display_translations.json` 生成带 GEB L3 契约的 injector 编译期翻译表，拒绝任何位于 `<context>` 外、运行时不可达的孤儿 `<message>`，并仅对显式 `xml:space="preserve"` 的 source/translation 保留首尾空白。
model_display_translations.json: display-only 模型名词典，保存 JSON niceName 英文化前的三语显示译名，只供 injector 翻译 Qt 浮动标题等显示层，不回写模型数据，并保持简繁中文 Latin/CJK 间距。
runtime-noise-quarantine.json: Runtime 翻译噪声隔离清单，记录无资源/live-capture provenance 的短 token，并让生成器跳过这些项以保持英文。
resolve_cavalry_qt_sdk.js: 从单一 Cavalry/Qt 版本真相解析宿主默认或显式 macOS/Windows SDK 投影；无论本地是否已有全局 aqt，都以 repo-local venv 和 `requirements-ci.txt` 完整 hash-lock bootstrap `aqtinstall==3.3.0`；stdout 只输出 shell env/JSON，venv/pip/aqt 诊断统一转 stderr，避免污染 `eval`；macOS 除版本还校验 `cavalry_qt_target.json` 固定的完整 SDK tree SHA-256（所有目录、普通文件内容和 symlink target 的 canonical projection），不匹配即拒绝。
resolve_windows_cmake.js: 从 `ci_action_pins.json` 的官方 Kitware/CMake v4.2.0 Windows x64 zip pin 下载并校验 archive SHA-256，重新解包受控缓存，执行 `cmake --version` 并验证 CTest 同包布局；stdout 只输出机器可解析路径或 identity JSON，拒绝 runner PATH、低版本、floating URL、缺摘要和 archive 漂移。
record_windows_toolchain_evidence.js: 读取已验证 Windows CMake identity，复核 archive/可执行文件摘要与实际 `cmake --version`，并 fail-closed 记录 Windows x64 producer 的 CMake 来源、版本、SHA-256、Node/npm/Rust/Python 与 runner identity；不涉及 Authenticode。
dependency_vulnerability_gate.json / dependency_vulnerability_gate.js / dependency_vulnerability_gate.test.js: 三生态依赖漏洞门；通过共享 npm 命令边界固定 Node/npm 与 registry，hash-lock `pip-audit==2.10.1` 并要求报告精确等于 CPython 3.12.6/Linux 的 24 项 canonical active lock（拒绝截断/增项/重复/漏洞），Cargo 固定 cargo-audit 与 immutable RustSec commit/timestamp，并要求 30 天内重审 snapshot。
verify_runner_image.js: 规范化 GitHub `ImageOS`/`ImageVersion` 及 runner OS/arch；PR/main 记录，tag 在受保护 environment 的 allowlist 缺失或不匹配时 fail-closed。
stamp_dmg_icon.sh: DMG 卷宗图标盖章器，用 hdiutil 写入 `.VolumeIcon.icns` 与 custom-icon 标记，再用 Rez/SetFile best-effort 写本机 Finder 文件图标。
cavalry_qt_target.json: 发布目标映射，唯一声明 Cavalry 2.7.2 与 Qt 6.6.3，并为 macOS `clang_64`、Windows `msvc2019_64` 提供 repo-local SDK 路径和 aqt 参数；macOS qtbase 安装身份是可复核的完整 SDK tree SHA-256，而非仅版本号。
build_translator_injector.sh: 重生成共享翻译表后，以 `-O2/-fno-omit-frame-pointer` 合编 macOS injector 与 TransformTool ABI 适配器；真实运行绑定 `@rpath/libskia.dylib`，无 vendor app 的 CI 只使用不入包的临时链接桩。
launch_cavalry_with_injector.sh: 手动调试启动器，复用 embedded injector runtime flow。
validate_translations.py: JSON/TS/injector 翻译质量检查脚本；Guide catalog 纳入真实分母并固定 `en` loader slot，可见文本先解码 HTML entity，再执行既有占位符与 FP-1..12 审查。
forbidden_translation_patterns.py: Python 共享 forbidden-pattern detector，检测 FP-1/2/3/4/5/7/8/9/10/11 单条翻译反模式。
forbidden_translation_patterns.js: Node 共享 forbidden-pattern detector，供 runtime/full-ui gate 与契约测试复用 FP-1/2/3/4/5/7/8/9/10/11。
forbidden_translation_patterns.json: §P5 detector 配置，集中声明正则、source/context denylist、latin residue、受保护品牌/格式词、transliteration 与 pangram 规则。
translation-whitelist.json: JSON 翻译检测契约；Guide `value` 可翻译而 `type/language` 保持 loader 身份，其他模型 niceName、Time Editor 与 FP-10/11/12 边界不变。
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
2026-07-28: `LineToolSettings` 的 `Stroke Width: ` 与 `Cap Style: ` 按 Cavalry 2.7.2 `ExtensionLayer.dll` 唯一真实字面量改为精确冒号/尾随空格源，三语 TS、生成表及 Windows 显示/translator 合同共同拒绝旧的无冒号假表面。
2026-07-28: Windows 2.7.2 二进制调用链确认的普通 Qt 残留按现有 translator/display 边界补入三语：`Bookmark %1`、`Boundary Color`、两条绑定占位符、Velocity Preset 动作/过滤器及上下文动作；动态值保留 `%1`，无需扩大 ExtensionLayer 自绘 hook。
2026-07-28: Windows 2.7.2 二进制确认 `Automatic (%1)` 经 Color Settings QComboBox DisplayRole、四条 Mesh Explorer 整数模板经 QLabel factory、`Enter an index, e.g: 0` 经 `acrStringSingleIndex` 的 QPlainTextEdit 占位属性；三语 TS 与 exact-context 策略之外，运行时还要求 `Color Settings` 对话框、`MeshExplorerRowWidget` 或 `AttributeEditorWindow` 父系，编辑器正文、模型角色、近似文本及无关同文控件保持原值。
2026-07-29: Windows NSIS provenance 将 Windows 编译单元直接依赖的共享 `cavalry_i18n_translation_policy.h` 纳入输入 fingerprint；合同要求安装包记录完成后单独修改该头文件必须使 verify 失败，防止共享策略漂移被已构建 DLL 掩盖。
2026-07-29: macOS 定向合同锁定 parentless Assets ContextMenu 的单事件循环 owner 承接、Tag/Tracking owner 负边界、具体 Add Layer 快捷键隔离，以及 TransformTool 五 action 的双 slice caller/Skia ABI 防火墙。
2026-07-29: Guide catalog 纳入 translation validator，固定 Cavalry 2.7.2 实际读取的 `en` slot、98-key 同构与引用完备性；生成翻译表同时保留 GEB L3 契约。
2026-07-29: Windows NSIS provenance 比较 canonical file identity，修复 macOS `/var` 与 `/private/var` 指向同一安装器却被误拒绝的本地合同假阴性；bundle 边界与内容 fingerprint 不变。
2026-07-30: 将 2026-07-29 现场使用的 macOS 21-run/48-point acceptance driver、exact-window helper、媒体输入和 harness 从可清理 Cache 恢复到 `macos-acceptance/`；CI 运行静态合同与无 vendor app compile，live PASS 仍只由显式 session 证据产生。
2026-07-31: Windows Adjacent gate 将 Tag/Assets producer driver、双素材与 exact-HWND 证据握手收进 tracked Rust/C++/PowerShell 边界；正式瞬态 PNG 改由 producer-side Qt grab，helper 只封存/诊断，三语动态 stem 带 run nonce 防止还原工作区污染。
2026-08-09: 新增 release acceptance evidence/seal、detached offline acceptance signer 与独立双 trust anchor、exact-commit/mode source tar、strict-YAML Actions SHA pin、toolchain evidence、三生态漏洞门与 private-draft 最后公开的幂等 release_publish；合同测试锁定 tag Developer ID fail-closed 与 badge PR 路径。

2026-08-09: 本地 Qt ensure 取消裸 `pip install aqtinstall`，改用项目内 hash-locked bootstrap，并以 Qt 6.6.3 macOS 完整 SDK tree SHA-256 拒绝下载/安装漂移；新增 npm/Python/Cargo 已知漏洞、RustSec freshness 与 tag runner-image fingerprint 工具门。

2026-08-10: Qt SDK resolver 将 venv/pip/aqt bootstrap 诊断统一路由到 stderr，保留 stdout 为可 `eval` 的机器输出；CI pin 守门器要求 cargo-audit 通过 manifest 中的精确 Rust channel 安装；新增 npm 工具链身份命令边界，修复 Windows Runner 无 shell 启动 `npm` shim 失败，三者共同隔离宿主 bootstrap 差异。

2026-08-27: `test_temp_dir.js` 为合同测试注册本进程创建的有限 TEMP fixture；`check_app_contracts.js` 与 `check_tauri_build_sop.js` 在顶层 `after` 中仅清理直接位于 `os.tmpdir`、固定前缀且无 symlink/reparse 的目录，不扫描或删除历史/陌生路径。
2026-08-27: CI、action pin 与漏洞门共同升级到 Node.js 24.20.0 / npm 11.19.0；精确版本只存在于共享 policy/pin 及其 strict contract 中，开发文档统一声明 Node 24 LTS 下限。
2026-08-31: UI Review 收敛匿名 macOS 权限 handoff 原型；复用真实 `permissionMac` renderer iframe 作为源，独立模拟系统设置目标，运行时捕获/递归克隆真实权限动作与目标 row，固定 duration/response 0.72、1.0 临界阻尼公式、initialAlpha/minimumLaunchScale 与距离比例 lift，保留正反向状态机、静态 accessory takeover 和 Reduce Motion snap/crossfade；禁止固定 arc 滑杆、通用阻尼分支、手绘 proxy 内容与新增外部具体身份信息。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
