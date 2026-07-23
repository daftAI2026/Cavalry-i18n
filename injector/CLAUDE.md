# injector/
> L2 | 父级: ../CLAUDE.md

成员清单

CavalryTranslatorInjector.mm: macOS Objective-C++ runtime 翻译注入器；以 `(context, source)` 哈希复用生成表，在启动期有界补译、交互期只处理 dirty 控件，并保持菜单首帧、模型 identity、MessageBar 与 session-scoped runtime inventory 的既定边界。
generated_translations.inc: 由 `tools/generate_embedded_translations.js` 从 `tools/*.ts` 与 display-only 模型名词典自动生成的 C++ 编译期翻译表，不可手动编辑。
libCavalryTranslatorInjector.dylib: 预编译 universal macOS 动态库，由 `tools/build_translator_injector.sh` 构建并以 `@loader_path` 解析所选 app 同目录 Qt，Tauri 打包时作为 bundle resource 嵌入。
windows/: Windows Qt 6.6.3 x64 MSVC `QGenericPlugin` 模块；部署唯一 `generic/cavalryi18n.dll` 到用户选定安装根，由子进程环境发现且不携带第二套 Qt runtime。其 Qt 显示层复用 macOS 已知基名数字后缀规则，并仅向受控 QComboBox 的 DisplayRole 投影生成表译文；ExtensionLayer 适配拦截已采证的 `CavalryUI::ui::textAtWidgetCentre` 正常 IAT 与由 canonical `CustomListWidget::setPlaceholder` setter 尾跳解码的 `QString::operator=` 槽，前者只处理共享合同的九条 helper source，后者仅在直接 `E8 → setPlaceholder`、共享合同的十三条 placeholder source 与生成表同时命中时处理（包括 Snippet），动态 `HelperHints` 保持英文。

依赖边界:

macOS 注入器在 Cavalry 进程内通过 DYLD_INSERT_LIBRARIES 加载；Windows 通过 Qt generic plugin 扩展点加载。二者均依赖 Cavalry 的 Qt 6.6.3 runtime ABI，不携带第二套 Qt；macOS 额外依赖 AppKit。`generated_translations.inc` 是 `tools/*.ts` 与 display-only 模型词典的共享机器投影，任何翻译变更必须通过 `generate_embedded_translations.js` 重生成，两个平台都不得手改或分叉该表。

法则: 翻译表自动生成·精确哈希保持 first-match-wins·模型 niceName 保留英文·显示层模型名可翻译·已知基名数字后缀仅在基名有嵌入译文时投影·QComboBox 仅改 DisplayRole 且 UserRole/currentIndex 不变·Scene View 图层列表可翻译·Time Editor 自身 item view 与 model role 保留英文·QLineEdit 显示翻译不改模型·QTextEdit append 只翻译日志正文与有限日志模板·aboutToShow 菜单同步翻译·交互事件禁止全局刷新·普通运行禁止 inventory 写盘·动态菜单规则化·dylib 预编译·只加载目标 app 的单套 Qt·禁止引入目标 Qt 缺失符号·Qt ABI 锁定·ExtensionLayer 仅可用共享合同内的已验证 helper/placeholder 精确调用边界且未知/表内非白名单文本原样透传·空状态与拖放提示的三语显示文案不加末尾句号·QString 赋值槽只能由 canonical setter 尾跳解码·禁止 `__cstring` 补丁

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
