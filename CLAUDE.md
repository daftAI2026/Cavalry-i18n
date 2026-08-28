# Cavalry-i18n - Cavalry 的 macOS / Windows Tauri 桌面语言补丁器
HTML + Javascript + Rust (Tauri) + Objective-C++ / C++ (Qt Injector / Windows generic translator + QPA delegate)

<directory>
.baoyu-skills/ - 项目本地 Agent 技能扩展配置，约束翻译偏好与术语来源 (Markdown)
.github/ - GitHub Actions 自动化入口，以 main-contained tag preflight 阻断旁支发布，运行合同/原生/漏洞/acceptance 门；tag 汇合三项人工安装与六项 updater manifest/archive/signature 资产，经 schema v5 seal/private-draft exact readback 后发布 (YAML)
release-seals/ - release tag 前置的真实 macOS acceptance evidence 与独立签名 attestation 约定；仅提交按 tag 命名、由受控 session 派生的两份 JSON，不保存私钥或现场缓存 (Markdown, JSON)
desktop-patcher/ - 旧桌面补丁器产物镜像，仅保留 injector 生成物与预编译 dylib (C++, dylib)
docs/ - 架构计划、翻译规范、工作流协议与历史证据链 (Markdown, JS, Shell)
injector/ - macOS DYLD 注入器、Cavalry 2.7.2 TransformTool Mach-O/Skia ABI 防火墙与 Windows Qt generic translator/QPA delegate；共享 policy 区分 8 条跨平台 exact-only 表面和双平台 owner-scoped 邻接 key，Windows 另构建不发布的 acceptance-only generic plugin，以 Qt test profile 隔离登录/工作区并驱动 Onboarding/Tag/Assets 真机证据，各平台 Runner 现场生成不入库的原生库 (C++, Objective-C++)
languages/ - 运行时 JSON 语言包，保存 English 基线与三语同构翻译资产 (JSON)
renderer/ - Tauri 前端 UI，以独立语义 token 真相源、系统字体与只消费角色的离线 HTML/CSS/JS 提供安装对象双徽章、跨平台路径中部省略、无依赖 Base UI 语义 Select/Tooltip、自动恢复基线的 Apply/平台统一 Restore 单任务流、固定项目外链 About，以及由真实 Apply/Updater Channel 驱动、组合 shadcn separator/Marker/Spinner/shimmer/scroll-fade 与内嵌 Phosphor 图标的四语任务事件视窗；持久阻塞留在视窗，只有确认/权限/风险进入 AlertDialog，主窗口禁止滚动，macOS 保留原生交通灯，Windows 使用右侧原生语义 caption 状态机且不接管系统外框 (HTML, CSS, JS)
src-tauri/ - Tauri 后端；分离 renderer 契约、安装真相、受控系统命令与平台运行时，macOS 以最小 AppKit 桥维持原生交通灯中心，Windows 以无系统 caption + DWM 外框承载右侧 renderer 控件；语言事务通过四阶段 Channel 投影真实边界，Updater 只从 Rust State 消费已检查 Update 并通过 downloading/installing/restarting 三阶段脱敏 Channel 报告进度，签名验证留在官方插件下载事务内；immutable snapshot、durable manifest/backup、原子 English 清理、same-EXE UAC 与 NSIS 生命周期统一控制面和数据面 (Rust, NSIS)
tools/ - 自动化工具链，涵盖翻译提取、校验、SDK 解析、Windows NSIS 安装态、exact PID/HWND/受限 cleanup 与 producer-side PNG 证据，以及 tracked macOS Objective-C++/CGWindow 21-run/48-point 定向验收器；原生库和 live session 现场生成而不入库 (Node.js, PowerShell, Bash, Objective-C++, Swift)
output/ - 派生审计产物，保存截图、JSON surface 抓取与翻译草稿 (JSON, PNG)
</directory>

<config>
AGENTS.md - 根级 Agent 行动地图，按 Kumo knowledge base 结构固化查找入口、约定、反模式、命令、流水线、工具链与安全边界
CHANGELOG.md - SemVer 发布历史与 Unreleased 用户可见变更真相源
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
src-tauri/tauri.conf.json - Tauri 共享运行配置，固定本地 CSP/updater 信任根、`main`/`about` capability 与 400×480 无滚动 macOS Overlay 主窗口边界
src-tauri/tauri.macos.conf.json - macOS 覆盖配置，声明 DMG/bundle 与 dylib 资源
src-tauri/tauri.windows.conf.json - Windows 覆盖配置，以完整窗口 override 关闭系统 caption、保留 DWM shadow，并声明 NSIS/x64 与 generic translator/QPA delegate 资源
src-tauri/tauri.updater-artifacts.conf.json - updater 产物覆盖，仅启用签名 archive/sidecar 生成；与共享配置中已固定的最终公钥/endpoint 合并，并只由 tag 或受保护的无发布签名 smoke 使用
injector/generated_translations.inc - 编译期嵌入的翻译静态表
injector/cavalry_i18n_macos_tool_help_text_path.{h,cpp} - macOS TransformTool 五条自绘 action 的双 slice Mach-O/caller/Skia ABI 适配边界
</config>

法则: 极简·稳定·导航·版本精确
