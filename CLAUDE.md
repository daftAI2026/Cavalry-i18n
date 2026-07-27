# Cavalry-i18n - Cavalry 的 macOS / Windows Tauri 桌面语言补丁器
HTML + Javascript + Rust (Tauri) + Objective-C++ / C++ (Qt Injector / Windows generic plugin)

<directory>
.baoyu-skills/ - 项目本地 Agent 技能扩展配置，约束翻译偏好与术语来源 (Markdown)
.github/ - GitHub Actions 自动化入口，运行合同测试、Windows NSIS 构建/隔离安装卸载与 macOS 双架构构建，并上传三种发布资产 (YAML)
desktop-patcher/ - 旧桌面补丁器产物镜像，仅保留 injector 生成物与预编译 dylib (C++, dylib)
docs/ - 架构计划、翻译规范、工作流协议与历史证据链 (Markdown, JS, Shell)
injector/ - macOS DYLD 注入器与 Windows Qt generic plugin，复用生成表处理运行时翻译 (C++, Objective-C++)
languages/ - 运行时 JSON 语言包，保存 English 基线与三语同构翻译资产 (JSON)
renderer/ - Tauri 前端 UI，提供多语言补丁的管理界面 (HTML, JS)
src-tauri/ - Tauri 后端；以 commands/、privilege/ 与 platform_runtime 私有编排模块分离 renderer 契约、受控系统命令和平台运行时差异，同时保留稳定 Rust facade 与 disposable live-clone 现场合同 (Rust)
tools/ - 自动化工具链，涵盖翻译提取、校验、SDK 解析、Windows NSIS 安装态守门与精确 PID/HWND 窗口证据采集 (Node.js, PowerShell, Bash)
output/ - 派生审计产物，保存截图、JSON surface 抓取与翻译草稿 (JSON, PNG)
</directory>

<config>
AGENTS.md - 根级 Agent 行动地图，按 Kumo knowledge base 结构固化查找入口、约定、反模式、命令、流水线、工具链与安全边界
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
src-tauri/tauri.windows.conf.json - Windows 覆盖配置，声明 NSIS/x64 与 generic plugin 资源
injector/generated_translations.inc - 编译期嵌入的翻译静态表
</config>

法则: 极简·稳定·导航·版本精确
