# injector/
> L2 | 父级: ../CLAUDE.md

成员清单

CavalryTranslatorInjector.mm: macOS Objective-C++ runtime 翻译注入器；以 `(context, source)` 哈希复用生成表，在启动期有界补译、交互期只处理 dirty 控件，并保持菜单首帧、模型 identity、MessageBar 与 session-scoped runtime inventory 的既定边界。
cavalry_i18n_translation_policy.h: 跨平台 source-only 查询边界；把 CogTool 动态 Pitch 前缀限制在精确 context，禁止自绘专用词条泄漏到普通 QWidget 或用户文本。
generated_translations.inc: 由 `tools/generate_embedded_translations.js` 从 `tools/*.ts` 与 display-only 模型名词典自动生成的 C++ 编译期翻译表，不可手动编辑。
libCavalryTranslatorInjector.dylib: 不纳入 Git 的 universal macOS 平台构建产物；由 `tools/build_translator_injector.sh` 从当前源码生成并以 `@loader_path` 解析所选 app 同目录 Qt，Tauri 打包时作为 bundle resource 嵌入。
windows/: Windows Qt 6.6.3 x64 MSVC 双模块；`qpa/qwindows.dll` 以版本化私有 QPA ABI 委托持久化原厂平台插件，只有安装根 exact manifest v1、三项实际 SHA-256 与非英语 marker 同时通过才显式传语言启动 `generic/cavalryi18n.dll`，不写进程环境，翻译失败保留原厂 integration。generic 显示层与 macOS 对齐逐行翻译 `标题\n说明` tooltip，并以严格 QLabel 规则投影 selected-count 与登录离线认证倒计时；ExtensionLayer 聚合 helper、placeholder、MessageBar 与 text-path 四条精确 IAT 边界，后者覆盖二十二项静态文本及 CogTool 动态整数 Pitch。MessageBar 只批准 history/live 双 return 与单条 HTML 尾部正文并排除 `js_logger`。插件永久 PIN 是任一 aggregate IAT 安装写入的前置资格，text-path 另在私有 Core/skia 映像逐范围通过 PE64 timestamp/size、精确导出 RVA 与关键 ownership bytes 后独立 PIN 并允许 CJK Path；每次 callback 继续复核完整 caller 字节包络及精确 context。callback 使用无静态析构的 process-lifetime 槽，restore 失败保留 forward-only original；诊断以三十二位 source mask/原子计数进入显式 marker，渲染路径无 IO。

依赖边界:

macOS 注入器在 Cavalry 进程内通过 DYLD_INSERT_LIBRARIES 加载；Windows 从所有原生入口必经的 QPA 代理委托原厂窗口系统，再显式启动 generic 翻译 runtime，环境自动发现仅保留为兼容合同。二者均依赖 Cavalry 的 Qt 6.6.3 runtime ABI，不携带第二套 Qt；Windows QPA 额外锁定同版本私有头，macOS 额外依赖 AppKit。`generated_translations.inc` 是 `tools/*.ts` 与 display-only 模型词典的共享机器投影，任何翻译变更必须通过 `generate_embedded_translations.js` 重生成，两个平台构建入口都必须在编译前重建且不得手改或分叉该表；dylib/DLL 仅由对应平台 Runner 生成并由最终 DMG/NSIS 承担发布事实。

法则: 翻译表自动生成·精确哈希保持 first-match-wins·模型 niceName 保留英文·显示层模型名可翻译·已知基名数字后缀仅在基名有嵌入译文时投影·selected-count 与登录离线认证倒计时仅投影严格 QLabel 文本·QComboBox 仅改 DisplayRole 且 UserRole/currentIndex 不变·Scene View 图层列表可翻译·Time Editor 自身 item view 与 model role 保留英文·QLineEdit 显示翻译不改模型·QTextEdit append 只翻译日志正文与有限日志模板·aboutToShow 菜单同步翻译·交互事件禁止全局刷新·普通运行禁止 inventory 写盘·动态菜单规则化·原生库由对应平台生成且不纳入 Git·只加载目标 app 的单套 Qt·禁止引入目标 Qt 缺失符号·Qt ABI 锁定·ExtensionLayer 仅可用共享合同内已验证的 helper/placeholder/MessageBar/text-path 四条精确边界，MessageBar 必须双 caller/末尾 `<br>`/exact body 同时命中且排除 `js_logger`，text-path 必须 exact slot/caller 字节包络/source/context 同时命中且每次 callback 重验；context-only 自绘词条禁止进入 source fallback，unknown/prefix 原样透传；CogTool Pitch 只允许 canonical 32-bit `int` 后缀·二十三项 action/quality/Pitch 与 Pencil 三语文案不加末尾句号·CJK 自绘仅可用已锁定 vendor Skia 导出重建白名单 Path，任一失败回退英文·禁止 vendor `.text` / Skia / libc / QPainter 全局 hook·IAT 卸载必须 owner-only 且 restore 失败 fail-open·QString 赋值槽只能由 canonical setter 尾跳解码·禁止 `__cstring` 补丁

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
