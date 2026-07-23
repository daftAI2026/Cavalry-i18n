# injector/
> L2 | 父级: ../CLAUDE.md

成员清单
CavalryTranslatorInjector.mm: Objective-C++ runtime 翻译注入器主源，以保留生成表首条语义的 `(context, source)` 哈希实现 QTranslator，固定动态菜单/名称/日志正则按函数静态编译，启动期执行有界全量补译，交互期只翻译 dirty object 与直接子控件；QLabel/QLineEdit Paint 使用含语言、文本、placeholder 且随 QObject 生命周期清理的 fingerprint 专用首帧路径，外部改值后仍会重新翻译，QAbstractItemView 监听 rowsInserted/modelReset/dataChanged 以覆盖 Show 后异步填充的 QuickAdd 与 Time Editor，QMenu `aboutToShow/ActionAdded/Show` 首次绘制前同步翻译懒加载菜单，QDialog/ModalDialog 同步翻译完整局部子树。display-only 模型词典、自动编号/点编号/括号编号动态图层名、Time Editor `DisplayRole/EditRole` 英文保护、MessageBar `QTextEdit::append` 追加时翻译及动态状态模板保持原边界；runtime inventory 仅在显式 session/capture 环境启用，以 trailing dump 保留 live gate 动态证据，并按进程复用 session 路径与 bundle hash，普通语言运行不扫全局写盘。ExtensionLayer 仅对 Assets、Attribute Editor、Scene Tree 与 Snippet Editor 四条经二进制确认的自绘提示拦截 `QPainter::drawText(QPointF, QString)`，其中包括 `Drag some JavaScript here to make a Snippet.`：复用生成表、开启 CJK font fallback，以新旧字宽差修正 x 坐标，并通过 Qt 6.6.3 等价的四参数重载无条件保留原文绘制回退，保持水平中心、纵向基线、图标及 panel 几何不变；其余自绘文本继续保持英文，禁止恢复不安全的 `__cstring` 补丁。
generated_translations.inc: 由 `tools/generate_embedded_translations.js` 从 `tools/*.ts` 与 display-only 模型名词典自动生成的 C++ 编译期翻译表，不可手动编辑。
libCavalryTranslatorInjector.dylib: 预编译的 universal (x86_64/arm64) 动态库，由 `tools/build_translator_injector.sh` 以 `-O2` 构建并用 `@loader_path` 解析所选 app 同目录 Qt，Tauri 打包时作为 bundle resource 嵌入。
windows/: Windows Qt 6.6.3 x64 MSVC `QGenericPlugin` 模块；构建并部署唯一的 `generic/cavalryi18n.dll` 到用户选定的 Cavalry 安装根，由子进程环境发现，禁止携带第二套 Qt runtime。

依赖边界:
macOS 注入器在 Cavalry 进程内通过 DYLD_INSERT_LIBRARIES 加载；Windows 通过 Qt generic plugin 扩展点加载。二者均依赖 Cavalry 的 Qt 6.6.3 runtime ABI，不携带第二套 Qt；macOS 额外依赖 AppKit。`generated_translations.inc` 是 `tools/*.ts` 与 display-only 模型词典的共享机器投影，任何翻译变更必须通过 `generate_embedded_translations.js` 重生成，两个平台都不得手改或分叉该表。

法则: 翻译表自动生成·精确哈希保持 first-match-wins·模型 niceName 保留英文·显示层模型名可翻译·Scene View 图层列表可翻译·Time Editor 自身 item view 与 model role 保留英文·QLineEdit 显示翻译不改模型·QTextEdit append 只翻译日志正文与有限日志模板·aboutToShow 菜单同步翻译·交互事件禁止全局刷新·普通运行禁止 inventory 写盘·动态菜单规则化·dylib 预编译·只加载目标 app 的单套 Qt·禁止引入目标 Qt 缺失符号·Qt ABI 锁定·ExtensionLayer 自绘翻译必须精确白名单并保持原中心·禁止 `__cstring` 补丁

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
