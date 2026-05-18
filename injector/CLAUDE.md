# injector/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
CavalryTranslatorInjector.mm: Objective-C++ runtime 翻译注入器主源，子类化 QTranslator 拦截 Qt 菜单与普通 QWidget 翻译，阻止 Time Editor 共用的模型 niceName 经 item `setText()` 写成 CJK，规则化处理动态右键菜单标签，支持定时刷新 UI 与 English dump-only 模式输出 runtime inventory。ExtensionLayer `__cstring` 补丁基础设施保留但已禁用（自绘层使用 Latin-only 字体，CJK 显示为 `?`），该层提示保持英文原文。
generated_translations.inc: 由 `tools/generate_embedded_translations.js` 从 `tools/*.ts` 自动生成的 C++ 编译期翻译表，不可手动编辑。
libCavalryTranslatorInjector.dylib: 预编译的 universal (x86_64/arm64) 动态库，由 `tools/build_translator_injector.sh` 构建，Tauri 打包时作为 bundle resource 嵌入。

依赖边界:
injector 在 Cavalry 进程内通过 DYLD_INSERT_LIBRARIES 加载；它依赖 Qt 6.6.3 runtime ABI、dyld/Mach VM 与 AppKit，不依赖仓库其他模块。generated_translations.inc 是 tools/*.ts 的机器投影，任何翻译变更必须通过 generate_embedded_translations.js 重生成。

法则: 翻译表自动生成·模型 niceName 保留英文·动态菜单规则化·dylib 预编译·Qt ABI 锁定·ExtensionLayer 自绘层保留英文

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
