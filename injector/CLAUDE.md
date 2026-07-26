# injector/
> L2 | 父级: ../CLAUDE.md

成员清单

CavalryTranslatorInjector.mm: macOS Objective-C++ runtime 翻译注入器；以 `(context, source)` 哈希复用生成表，在启动期有界补译、交互期只处理 dirty 控件，并保持菜单首帧、模型 identity、MessageBar 与 session-scoped runtime inventory 的既定边界。
generated_translations.inc: 由 `tools/generate_embedded_translations.js` 从 `tools/*.ts` 与 display-only 模型名词典自动生成的 C++ 编译期翻译表，不可手动编辑。
libCavalryTranslatorInjector.dylib: 预编译 universal macOS 动态库，由 `tools/build_translator_injector.sh` 构建并以 `@loader_path` 解析所选 app 同目录 Qt，Tauri 打包时作为 bundle resource 嵌入。
windows/: Windows Qt 6.6.3 x64 MSVC `QGenericPlugin` 模块；部署唯一 `generic/cavalryi18n.dll` 到用户选定安装根，不携带第二套 Qt。ExtensionLayer 聚合 helper、placeholder 与十五项 text-path 三条精确 IAT 边界；插件永久 PIN 是任一 aggregate IAT 安装写入的前置资格，text-path 另在私有 Core/skia 映像逐范围通过 PE64 timestamp/size、精确导出 RVA 与关键 ownership bytes 后独立 PIN 并允许 CJK Path。callback 使用无静态析构的 process-lifetime 槽，text-path restore 先发布无 renderer 墓碑；诊断以十五位 source mask/原子计数进入显式 marker，渲染路径无 IO。

依赖边界:

macOS 注入器在 Cavalry 进程内通过 DYLD_INSERT_LIBRARIES 加载；Windows 通过 Qt generic plugin 扩展点加载。二者均依赖 Cavalry 的 Qt 6.6.3 runtime ABI，不携带第二套 Qt；macOS 额外依赖 AppKit。`generated_translations.inc` 是 `tools/*.ts` 与 display-only 模型词典的共享机器投影，任何翻译变更必须通过 `generate_embedded_translations.js` 重生成，两个平台都不得手改或分叉该表。

法则: 翻译表自动生成·精确哈希保持 first-match-wins·模型 niceName 保留英文·显示层模型名可翻译·已知基名数字后缀仅在基名有嵌入译文时投影·QComboBox 仅改 DisplayRole 且 UserRole/currentIndex 不变·Scene View 图层列表可翻译·Time Editor 自身 item view 与 model role 保留英文·QLineEdit 显示翻译不改模型·QTextEdit append 只翻译日志正文与有限日志模板·aboutToShow 菜单同步翻译·交互事件禁止全局刷新·普通运行禁止 inventory 写盘·动态菜单规则化·dylib 预编译·只加载目标 app 的单套 Qt·禁止引入目标 Qt 缺失符号·Qt ABI 锁定·ExtensionLayer 仅可用共享合同内已验证的 helper/placeholder/text-path 三条精确边界，第三路必须 exact slot/caller/source 同时命中且 unknown/prefix 原样透传·十五项 action/quality 三语文案不加末尾句号·CJK 自绘仅可用已锁定 vendor Skia 导出重建白名单 Path，任一失败回退英文·禁止 vendor `.text` / Skia / libc / QPainter 全局 hook·IAT 卸载必须 owner-only 且 restore 失败 fail-open·QString 赋值槽只能由 canonical setter 尾跳解码·禁止 `__cstring` 补丁

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
