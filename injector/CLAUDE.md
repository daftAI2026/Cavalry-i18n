# injector/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
CavalryTranslatorInjector.mm: Objective-C++ runtime 翻译注入器主源，子类化 QTranslator 拦截 Qt 菜单与普通 QWidget 翻译，用 display-only 模型名词典恢复属性编辑器浮动标题等 Qt 显示层翻译，监听 QLineEdit 首次绘制前与后续文本变化并以 signal-blocked 写回，通用保留自动编号、点编号与括号编号动态图层名后缀，派生运行时生成的 `X Shape` 图层名显示翻译，用 QObject property ABI-safe 读取 accessibility 字符串识别 Time Editor item view，阻止模型 niceName 与动态括号图层名经 item `setText()` 或 QAbstractItemView `DisplayRole/EditRole` 写成 CJK，QMenu `aboutToShow/ActionAdded/Show` 首次绘制前同步翻译懒加载菜单项，QDialog/ModalDialog 首次绘制前同步翻译退出确认窗与按钮，规则化处理动态右键菜单标签、认证倒计时状态句、冒号后缀标签与 No 前缀混合文本，支持定时刷新 UI 与带坐标父链/Qt item model 的 runtime inventory。ExtensionLayer 自绘层使用 Latin-only 字体，CJK 显示为 `?`，不注册 `__cstring` 补丁回调并保持英文原文。
generated_translations.inc: 由 `tools/generate_embedded_translations.js` 从 `tools/*.ts` 与 display-only 模型名词典自动生成的 C++ 编译期翻译表，不可手动编辑。
libCavalryTranslatorInjector.dylib: 预编译的 universal (x86_64/arm64) 动态库，由 `tools/build_translator_injector.sh` 构建，Tauri 打包时作为 bundle resource 嵌入。

依赖边界:
injector 在 Cavalry 进程内通过 DYLD_INSERT_LIBRARIES 加载；它依赖 Qt 6.6.3 runtime ABI 与 AppKit，不依赖仓库其他模块。generated_translations.inc 是 tools/*.ts 的机器投影，任何翻译变更必须通过 generate_embedded_translations.js 重生成。

法则: 翻译表自动生成·模型 niceName 保留英文·显示层模型名可翻译·Scene View 图层列表可翻译·Time Editor 自身 item view 与 model role 保留英文·QLineEdit 显示翻译不改模型·aboutToShow 菜单同步翻译·动态菜单规则化·dylib 预编译·禁止引入目标 Qt 缺失符号·Qt ABI 锁定·ExtensionLayer 自绘层保留英文且不走空补丁

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
