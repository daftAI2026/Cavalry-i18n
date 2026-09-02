# Cavalry-i18n - Cavalry 的 macOS / Windows Tauri 桌面语言补丁器
HTML + Javascript + Rust (Tauri) + Objective-C++ / C++ (Qt Injector / Windows generic translator + QPA delegate)

<directory>
.baoyu-skills/ - 项目本地 Agent 技能扩展配置，约束翻译偏好与术语来源 (Markdown)
.github/ - GitHub Actions 自动化入口，以 main-contained tag preflight 阻断旁支发布，运行合同/原生/漏洞/acceptance 门；tag 以 ad-hoc macOS 包配合独立 Tauri updater 签名，汇合三项人工安装与六项 updater manifest/archive/signature 资产，经 schema v6 seal/private-draft exact readback 后发布 (YAML)
release-seals/ - release tag 前置的真实 macOS acceptance evidence 与独立签名 attestation 约定；仅提交按 tag 命名、由受控 session 派生的两份 JSON，不保存私钥或现场缓存 (Markdown, JSON)
desktop-patcher/ - 旧桌面补丁器产物镜像，仅保留 injector 生成物与预编译 dylib (C++, dylib)
docs/ - 公开项目必须的翻译规范、可重复维护 SOP 与 README/Badge 资产；研究、事件簿、实跑记录和历史方案不进入公开仓 (Markdown, JSON, PNG)
injector/ - macOS DYLD 注入器、Cavalry 2.7.2 TransformTool Mach-O/Skia ABI 防火墙与 Windows Qt generic translator/QPA delegate；共享 policy 区分 8 条跨平台 exact-only 表面和双平台 owner-scoped 邻接 key，Windows 另构建不发布的 acceptance-only generic plugin，以 Qt test profile 隔离登录/工作区并驱动 Onboarding/Tag/Assets 真机证据，各平台 Runner 现场生成不入库的原生库 (C++, Objective-C++)
languages/ - 运行时 JSON 语言包，保存 English 基线与三语同构翻译资产 (JSON)
renderer/ - Tauri 前端 UI，以单一 token、共享 Button primitive、系统字体和离线 HTML/CSS/JS 提供无描边彩色 Badge、保留但禁用当前语言的显式占位 Select/Tooltip、直接 Switch/单一 Restore English、真实 Channel 驱动的三轨 Activity、带恢复路径的验证失败、必要 AlertDialog，以及 Base UI 对齐的外围失败 Toast；Select Trigger 保持独立 combobox 状态机，Windows caption 仅替换视觉而由系统窗口 API 执行动作，持久事实不叠 Toast，About/固定外链失败不污染任务流 (HTML, CSS, JS)
src-tauri/ - Tauri 后端；分离 renderer 契约、安装真相、受控系统命令与平台运行时，macOS 直接尝试安全写事务，仅在真实 typed PermissionDenied 后进入 App Management handoff，并把脚本入口重签的三个自有外置组件纳入不暴露给用户的路径级兼容清理、回滚和 English 恢复；已证明的受管 runtime 不再以 strict codesign 纯洁性作为语言切换准入，最终签名仍是事务提交门，Windows 以无系统 caption + DWM 外框承载右侧 renderer 控件；语言事务通过四阶段 Channel 投影真实边界，Updater 只从 Rust State 消费已检查 Update；immutable snapshot、durable manifest/backup、原子 English 清理、same-EXE UAC 与 NSIS 生命周期统一控制面和数据面 (Rust, NSIS)
tools/ - 自动化工具链，涵盖翻译提取、校验、SDK 解析、DMG `产品 + SemVer + 架构` 卷标/布局 producer-verifier、真实 renderer + fixture bridge 的 UI Review 及权限工作流/视觉转场双状态原型、Windows NSIS 安装态、exact PID/HWND/受限 cleanup 与 producer-side PNG 证据，以及 tracked macOS Objective-C++/CGWindow 21-run/48-point 定向验收器；原生库和 live session 现场生成而不入库 (Node.js, PowerShell, Bash, Objective-C++, Swift)
output/ - 派生审计产物，保存截图、JSON surface 抓取与翻译草稿 (JSON, PNG)
</directory>

<config>
AGENTS.md - 根级 Agent 行动地图，按 Kumo knowledge base 结构固化查找入口、约定、反模式、命令、流水线、工具链与安全边界
CHANGELOG.md - SemVer 发布历史与 Unreleased 用户可见变更真相源；tag 正文由 workflow 按版本抽取，不保留会漂移的根目录 release body 快照
LOCAL_BUILD_SOP.md - 唯一桌面打包与发布操作合同，区分本地验证、ad-hoc tag、Tauri updater 签名和未具备的平台身份，并固定 macOS DMG 文件名与挂载卷标的不同职责
README.md - 英文主入口，链接三语本地化 README 并描述当前构建、运行与验证路径
README.zh-Hans.md - 简体中文 README，本地化主文档并保持命令、路径与版本不漂移
README.zh-Hant.md - 繁体中文 README，本地化主文档并保持命令、路径与版本不漂移
README.ja_JP.md - 日文 README，本地化主文档并保持命令、路径与版本不漂移
package.json - 项目元数据与核心构建/测试指令
package-lock.json - npm 依赖锁定文件，冻结 Tauri CLI 与运行时 API 版本
release.config.json - GitHub Release 协议真相源，声明 Cavalry 目标版本、tag/标题、三种人工安装资产及 updater manifest/download/archive 的唯一命名；线上更新仍由共享 Tauri 配置中的最终公钥/endpoint 独立启用
SECURITY.md - 支持渠道、私密漏洞上报、平台签名边界与 supply-chain 控制说明
rust-toolchain.toml - CI/本地 Rust channel 固定入口，禁止 tag 构建漂移到浮动 stable
requirements-ci.in / requirements-ci.txt - Qt SDK bootstrap 的 Python 顶层声明与完整 `--require-hashes` 锁定闭包；固定 CPython 3.12.6/Linux active set 另由漏洞策略精确绑定
requirements-audit.in / requirements-audit.txt - `pip-audit==2.10.1` 自身的独立顶层声明与 universal hash-locked 工具闭包，避免漏洞扫描器通过未锁定安装进入 CI
src-tauri/Cargo.toml - Rust crate、Tauri v2 与后端依赖声明
src-tauri/Cargo.lock - Rust 依赖锁定文件，保证本地与 CI 构建同构
src-tauri/tauri.conf.json - Tauri 共享运行配置，固定本地 CSP/updater 信任根、`main`/`about` capability 与 400×484 无滚动 macOS Overlay 主窗口边界
src-tauri/tauri.macos.conf.json - macOS 覆盖配置，声明 DMG/bundle、dylib 与四语 App Management 用途说明资源，并把 800×476 Finder 安装窗首次打开原点锁定为实测参考位置 400×655
src-tauri/tauri.windows.conf.json - Windows 覆盖配置，以完整窗口 override 关闭系统 caption、保留 DWM shadow，并声明 NSIS/x64 与 generic translator/QPA delegate 资源
src-tauri/tauri.updater-artifacts.conf.json - updater 产物覆盖，仅启用签名 archive/sidecar 生成；与共享配置中已固定的最终公钥/endpoint 合并，并只由 tag 或受保护的无发布签名 smoke 使用
injector/generated_translations.inc - 编译期嵌入的翻译静态表
injector/cavalry_i18n_macos_tool_help_text_path.{h,cpp} - macOS TransformTool 五条自绘 action 的双 slice Mach-O/caller/Skia ABI 适配边界
</config>

法则: 极简·稳定·导航·版本精确
