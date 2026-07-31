# Cavalry-i18n - Cavalry 的 macOS / Windows Tauri 桌面语言补丁器
HTML + Javascript + Rust (Tauri) + Objective-C++ / C++ (Qt Injector / Windows generic translator + QPA delegate)

<directory>
.baoyu-skills/ - 项目本地 Agent 技能扩展配置，约束翻译偏好与术语来源 (Markdown)
.github/ - GitHub Actions 自动化入口，以 main-contained tag preflight 阻断旁支发布，运行合同测试、PR 级无 vendor app 的 macOS universal product injector 与 acceptance producer 编译、Windows generic/QPA + NSIS 构建、隔离安装/更新/卸载哨兵门与 tag 双架构打包，并上传三种发布资产 (YAML)
desktop-patcher/ - 旧桌面补丁器产物镜像，仅保留 injector 生成物与预编译 dylib (C++, dylib)
docs/ - 架构计划、翻译规范、工作流协议与历史证据链 (Markdown, JS, Shell)
injector/ - macOS DYLD 注入器、Cavalry 2.7.2 TransformTool Mach-O/Skia ABI 防火墙与 Windows Qt generic translator/QPA delegate；共享 policy 区分 8 条跨平台 exact-only 表面和双平台 owner-scoped 邻接 key，Windows 另构建不发布的 acceptance-only generic plugin，以 Qt test profile 隔离登录/工作区并驱动 Onboarding/Tag/Assets 真机证据，各平台 Runner 现场生成不入库的原生库 (C++, Objective-C++)
languages/ - 运行时 JSON 语言包，保存 English 基线与三语同构翻译资产 (JSON)
renderer/ - Tauri 前端 UI，提供多语言补丁的管理界面 (HTML, JS)
src-tauri/ - Tauri 后端；以 commands/、privilege/、windows_qpa/ 与 platform_runtime 私有编排模块分离 renderer 契约、受控系统命令和平台运行时差异，Windows 以 durable vendor backup、严格 manifest、同卷原子替换与 same-EXE 单次 UAC 事务统一所有 Cavalry 原生启动入口，同时保留稳定 Rust facade 与 disposable live-clone 现场合同 (Rust)
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
release.config.json - GitHub Release 协议真相源，声明 Cavalry 目标版本、tag 格式、标题模板与三种资产名（Apple Silicon DMG、Intel DMG、Windows x64 NSIS EXE）
src-tauri/Cargo.toml - Rust crate、Tauri v2 与后端依赖声明
src-tauri/Cargo.lock - Rust 依赖锁定文件，保证本地与 CI 构建同构
src-tauri/tauri.conf.json - Tauri 共享运行配置
src-tauri/tauri.macos.conf.json - macOS 覆盖配置，声明 DMG/bundle 与 dylib 资源
src-tauri/tauri.windows.conf.json - Windows 覆盖配置，声明 NSIS/x64 与 generic translator/QPA delegate 资源
injector/generated_translations.inc - 编译期嵌入的翻译静态表
injector/cavalry_i18n_macos_tool_help_text_path.{h,cpp} - macOS TransformTool 五条自绘 action 的双 slice Mach-O/caller/Skia ABI 适配边界
</config>

法则: 极简·稳定·导航·版本精确
