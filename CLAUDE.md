# Cavalry-i18n - Tauri desktop language patcher for Cavalry
HTML + Javascript + Rust (Tauri) + Objective-C++ (Qt Injector)

<directory>
injector/ - Qt 进程动态注入器，负责运行时翻译拦截与菜单刷新 (C++, Objective-C++)
renderer/ - Tauri 前端 UI，提供多语言补丁的管理界面 (HTML, JS)
src-tauri/ - Tauri 后端逻辑，处理进程启动、注入与资源管理 (Rust)
tools/ - 自动化工具链，涵盖翻译提取、校验与 SDK 解析 (Node.js, Bash)
output/ - 派生审计产物，保存截图、JSON surface 抓取与翻译草稿 (JSON, PNG)
</directory>

<config>
package.json - 项目元数据与核心构建/测试指令
src-tauri/tauri.conf.json - Tauri 运行配置
injector/generated_translations.inc - 编译期嵌入的翻译静态表
</config>

法则: 极简·稳定·导航·版本精确
