# Cavalry-i18n - Tauri desktop language patcher for Cavalry
HTML + Javascript + Rust (Tauri) + Objective-C++ (Qt Injector)

<directory>
.baoyu-skills/ - 项目本地 Agent 技能扩展配置，约束翻译偏好与术语来源 (Markdown)
.github/ - GitHub Actions 自动化入口，运行合同测试、macOS 构建与发布产物上传 (YAML)
desktop-patcher/ - 旧桌面补丁器产物镜像，仅保留 injector 生成物与预编译 dylib (C++, dylib)
doc/ - 架构计划、翻译规范、工作流协议与历史证据链 (Markdown, JS, Shell)
injector/ - Qt 进程动态注入器，负责运行时翻译拦截与菜单刷新 (C++, Objective-C++)
languages/ - 运行时 JSON 语言包，保存 English 基线与三语同构翻译资产 (JSON)
renderer/ - Tauri 前端 UI，提供多语言补丁的管理界面 (HTML, JS)
src-tauri/ - Tauri 后端逻辑，处理进程启动、注入与资源管理 (Rust)
tools/ - 自动化工具链，涵盖翻译提取、校验与 SDK 解析 (Node.js, Bash)
output/ - 派生审计产物，保存截图、JSON surface 抓取与翻译草稿 (JSON, PNG)
</directory>

<config>
README.md - 英文主入口，链接三语本地化 README 并描述当前构建、运行与验证路径
README.zh-Hans.md - 简体中文 README，本地化主文档并保持命令、路径与版本不漂移
README.zh-Hant.md - 繁体中文 README，本地化主文档并保持命令、路径与版本不漂移
README.ja_JP.md - 日文 README，本地化主文档并保持命令、路径与版本不漂移
package.json - 项目元数据与核心构建/测试指令
package-lock.json - npm 依赖锁定文件，冻结 Tauri CLI 与运行时 API 版本
release.config.json - GitHub Release 协议真相源，声明 Cavalry 目标版本、tag 格式、标题模板与 DMG 资产名
src-tauri/Cargo.toml - Rust crate、Tauri v2 与后端依赖声明
src-tauri/Cargo.lock - Rust 依赖锁定文件，保证本地与 CI 构建同构
src-tauri/tauri.conf.json - Tauri 运行配置
injector/generated_translations.inc - 编译期嵌入的翻译静态表
</config>

法则: 极简·稳定·导航·版本精确
