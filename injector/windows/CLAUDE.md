# windows/
> L2 | 父级: ../CLAUDE.md

成员清单

CMakeLists.txt: Qt 6.6.3 x64 MSVC + Windows Psapi generic plugin 构建边界；编译 display、translator、PE/IAT、ExtensionLayer 四条边界、动态 Pitch dispatch、mapped Skia runtime ABI 防火墙、CJK renderer 与 process-lifetime callback snapshot，发布产物只含 `generic/cavalryi18n.dll`。
build.ps1: 带 UTF-8 BOM 的 Windows 唯一可重复构建入口，兼容 PowerShell 5.1 解析中文契约头，解析 Qt SDK 与显式可选 `CAVALRY_VENDOR_ROOT`，不猜测盘符或安装目录，串联 configure/build/ctest 并把已验证 DLL 发布到稳定资源路径。
cavalry_i18n_callback_snapshot.h: 固定数量 exact source/translation 的不可变值表，支持按 source 或已验证索引读取；有意不析构的 process-lifetime shared_ptr 槽在卸载后只保留不触碰 Qt/Skia 的 forward-only 墓碑。
cavalry_i18n_plugin.h: `QGenericPlugin` metadata 与工厂接口，只暴露大小写不敏感的 `cavalryi18n` key。
cavalry_i18n_plugin.cpp: Qt generic factory 路由，把受支持 key 映射到独立的运行时生命周期对象。
cavalry_i18n_display.h: 主动显示翻译接口与对象生命周期状态，明确 QWidget/QAction、已知基名数字后缀、QComboBox/QTreeWidget DisplayRole 与受词表约束的 QLineEdit 显示值边界。
cavalry_i18n_display.cpp: 幂等翻译菜单、动作、标题、逐行复合 tooltip、已知基名数字后缀、QComboBox 可见项和递归 QTreeWidget DisplayRole；通过 `aboutToShow`/`changed`/model signal/Paint 接住首帧与动态英文写回，复合提示只替换词表命中行，未知行、UserRole、currentIndex 和通用 item view 保持原值。
cavalry_i18n_display_test.cpp: 三语显示层单元回归，锁定 ToolBox/渲染窗口标题、Exit/调色板动作、CogTool Pitch context-only 隔离、精确尾随空白工具标签、横竖工具栏及播放、渲染、Sub-Mesh、Path、脚本表面的 `标题\n说明` tooltip、未知提示行、已知基名数字后缀与 DisplayRole 投影隔离合同。
cavalry_i18n_extension_layer_hook.h: ExtensionLayer 的串行化聚合生命周期接口；固定 aggregate→text 锁序，拥有 helper/placeholder/MessageBar 三槽、独立 text-path 子 hook 及结构化诊断转发，只有四路全部安装才报告 `installed`。
cavalry_i18n_extension_layer_sources.h: 不依赖 Qt 的共享文本真相，锁定九条 helper、十三条 CustomListWidget placeholder、一条 MessageBar Pencil 警告、十五条静态 text-path source 与一条由跨平台策略导出的 CogTool `Pitch Radius: ` context-only 动态前缀。
cavalry_i18n_extension_layer_hook.cpp: 编排 helper、placeholder、MessageBar 与 Core text-path 四条可逆 IAT 边界；取得 aggregate owner 后、首次 Qt IAT 写入前必须永久 PIN 插件，失败则零写入；waiting 可保留已装前缀，终态失败逆序回滚。
cavalry_i18n_aggregate_pin_contract_test.cpp: aggregate 危险原语顺序合同分片；枚举真实 `ensureInstalled` 的三个 Qt IAT 安装写点并要求均晚于插件 PIN，同时直测 PIN helper 的空地址拒绝与本映像正例。
cavalry_i18n_extension_layer_qt_hooks.h: helper/placeholder/MessageBar 三条 Qt callback 机制接口；暴露 placeholder/MessageBar ABI 验证、immutable snapshot 发布/启停、replacement 地址与三项 global original 独立清理。
cavalry_i18n_extension_layer_qt_hooks.cpp: 解码 canonical `setPlaceholder` setter 尾跳槽并锁定 MessageBar history/live 两个 `QTextEdit::append` return；三条 callback 均不持 raw owner，Pencil 只替换最后一个 `<br>` 后精确正文并明确排除 `js_logger`。
cavalry_i18n_messagebar_qt_hook_test.cpp: MessageBar 双 caller/单 source 低层回归，覆盖 history/live、`js_logger` 排除、无 `<br>`/未知正文/空地址透传、Unicode 空白保持、禁用与 forward-only 墓碑。
cavalry_i18n_messagebar_lifecycle_contract_test.cpp: MessageBar 聚合生命周期分片，以 message-only partial install 验证终态回滚、第三方接管 CAS 失败与 original 保留，不与正文 dispatch 单测混淆。
cavalry_i18n_extension_layer_text_path_dispatch.h: Core::MakePathFromText 的纯分发合同，定义三处批准 caller、静态/动态 source 匹配、普通译文组合与无堆分配的有界写入接口。
cavalry_i18n_extension_layer_text_path_dispatch.cpp: 安装期与每次 callback 都逐字节验证 canonical、PrimitiveTool 首行/后续行三处 call/preamble/return，首行包络从 `mov rdx,[rdi]` 锁定 MSVC 字符串来源；只允许 `Pitch Radius: ` 后接 MSVC `int` 会生成的 canonical 32-bit 十进制文本，callback 译文写入固定栈缓冲，其他 caller/source 全部拒绝。
cavalry_i18n_extension_layer_text_path_dispatch_test.cpp: 三语动态 text-path 回归，验证 0、正负边界逐字保留，callback 对运行期包络变更继续 fail-closed，并拒绝正号、小数、单位、前导零、负零、溢出、额外空格、大小写变体及越界 caller。
cavalry_i18n_extension_layer_text_path_hook.h: Core::MakePathFromText 的独立 MSVC x64 边界，声明延迟安装、slot/caller 字节包络/source/context 四重门、CogTool 整数后缀保留、terminal renderer 失败、forward-only 墓碑及 canonical/whitelist/success/fallback/source-mask 诊断。
cavalry_i18n_extension_layer_text_path_hook.cpp: 只替换 RVA `0x1B28F98` IAT 槽；runtime ABI 完整通过并永久 PIN plugin/Core/skia 后才安装，callback 仅接纳持续通过完整包络复核的三处批准 caller 与精确 context，并零 IO 地累计十六项 source 位图，卸载先原子换成无 renderer 墓碑再恢复 IAT。
cavalry_i18n_skia_runtime_abi.h: Cavalry 2.7.2 Core/skia 私有 ABI 防火墙接口，向 renderer 暴露唯一已验证函数表与插件 process-lifetime PIN 入口。
cavalry_i18n_skia_runtime_abi.cpp: 以普通模块引用稳住映像，逐范围 `VirtualQuery` 验证 PE64 timestamp/SizeOfImage、每个导出 RVA 与关键 ownership/copy bytes，成功后 FROM_ADDRESS|PIN 并释放普通引用。
cavalry_i18n_skia_text_path_renderer.h: 经全量 glyph 覆盖验证的 CJK Path 工厂接口；借用调用方 UTF-8 string_view，必须接收已放行的 `CavalrySkiaRuntimeAbi`，不暴露 DLL 发现旁路。
cavalry_i18n_skia_text_path_renderer.cpp: 只消费 runtime ABI 函数表和借用文本重建白名单 `Cavalry::Path`，复现 UTF-8/GetPath/Y 翻转并有界管理 typeface；不再调用 GetModuleHandle/GetProcAddress。
cavalry_i18n_iat_lifecycle.h: IAT 单槽/双槽卸载所有权纯合同；未安装或非 owner 不 restore，mixed/partial 结果中每个 global original 只随本槽 restore 成功独立清理。
cavalry_i18n_iat_patch.h: 已验证单槽的共享可逆写入接口；调用方负责模块、符号、槽位与调用点证据。
cavalry_i18n_iat_patch.cpp: 页面临时可写期间用 `InterlockedCompareExchangePointer` 替换 IAT；expected mismatch 不覆盖第三方，保护恢复失败时仅 CAS 回滚仍为 replacement 的槽，重试仍失败给出调用方必须终止或隔离进程的不可恢复诊断。
cavalry_i18n_pe_iat.h: PE 导入表解析与精确 IAT slot 发现接口，隔离 Windows 二进制边界检查。
cavalry_i18n_pe_iat.cpp: 解析 PE import directory 并仅定位白名单 DLL/符号的 IAT 项，拒绝越界或格式异常映像。
cavalry_i18n_pe_iat_test.cpp: 合成 PE/IAT 解析合同测试，覆盖有效映像、白名单命中与拒绝损坏/非目标输入。
cavalry_i18n_vendor_iat_contract_test.cpp: 只读映射指定 vendor PE 文件，锁定 Cavalry 2.7.2 的 helper IAT/CavalryUI 导出、`setPlaceholder` thunk/setter/尾跳槽与 placeholder literals，并调用 MessageBar/text-path 合同分片；从不加载、执行或修改厂商代码。
cavalry_i18n_vendor_messagebar_contract.h: 已映射 ExtensionLayer PE64 的 MessageBar 只读验证入口，把 vendor 主测试与具体 append caller/HTML/source 证据隔离。
cavalry_i18n_vendor_messagebar_contract.cpp: 锁定唯一 `QTextEdit::append` IAT、三处真实引用、history/live 两个批准 return、命名 `js_logger` 排除项、MessageBar HTML 模板及 Pencil 原文。
cavalry_i18n_vendor_text_path_contract.h: 已映射 ExtensionLayer PE64 的 text-path 只读验证入口，把 vendor 主测试与具体 IAT/caller/ABI preamble RVA 证据隔离。
cavalry_i18n_vendor_text_path_contract.cpp: 锁定唯一 Core MakePath IAT、二十个槽调用、canonical 静态 caller、viewport/tool-help 数据流，以及 CogTool `Pitch Radius: ` 两处分支生产、optional vector 存储、PrimitiveToolBase 消费和首行/后续行两处 MakePath ABI caller 的完整链路。
cavalry_i18n_vendor_skia_text_path_contract.h: Core/skia 只读 CJK Path 兼容验证入口，隔离 renderer 依赖的导出、对象布局和所有权证据。
cavalry_i18n_vendor_skia_text_path_contract.cpp: 独立锁定 Core 固定 Lato、SkFont move/null、SkPath copy prefix、CJK 导出与 refcount 析构；不与运行时常量共用证据。
cavalry_i18n_extension_layer_hook_test.cpp: 无厂商模块主合同；覆盖三语、helper/placeholder 槽生命周期、runtime identity 正反例、renderer-free tombstone 与原子计数/source-mask，并调用独立 MessageBar 生命周期分片。
cavalry_i18n_runtime.h: 翻译加载、主动显示刷新、聚合四边界延迟安装及 revision-driven 结构化 marker 生命周期声明。
cavalry_i18n_runtime.cpp: 显式绝对 marker 路径下才创建 75ms Qt 线程计时器，只在 text-path revision 改变时写九项计数/位图；渲染 callback 不执行 Qt/IO，无 marker 的发布运行无周期唤醒。
cavalry_i18n_translator.h: 嵌入式 translator 查询接口与统计边界，隔离生成表表示和运行时生命周期。
cavalry_i18n_translator.cpp: 复用共享 `generated_translations.inc`，构建精确 `(context, source)` 首条优先哈希与遵循现有显示层语义的末条覆盖 source fallback；共享策略声明的自绘词条不进入 fallback。
cavalry_i18n_translator_test.cpp: 三语言非空表、已证实 helper 与调色板/场景/工具残留的嵌入翻译样本、精确尾随空白查询、context-only 拒绝、source fallback、未知语言和未知文本合同测试。
cavalry_i18n_plugin_smoke_test.cpp: 由最小 `QApplication` 走真实 generic plugin 自动发现，验证显示投影、数据隔离与九字段 text-path marker 结构；不将零计数冒充 live hook 覆盖。
cavalryi18n.json: Qt plugin metadata，声明唯一自动加载 key `cavalryi18n`。
README.md: Windows 插件依赖、构建目录、四条 ExtensionLayer 边界、MessageBar 精确排除规则、子进程环境契约、只读 vendor 静态合同与 live gate 判定。
generic/: 由 build.ps1 生成的 Tauri resource 稳定目录，只允许 `cavalryi18n.dll`，禁止复制 Qt runtime。

依赖边界:

本模块只依赖 Qt 6.6.3 Core/Gui/Widgets 公共 ABI、Windows Psapi 与本地 PE/IAT 解析，并从父级共享生成表取得翻译真相；启动器负责把插件根、语言和可选 marker 作为子进程环境传入。`CAVALRY_VENDOR_ROOT` 仅在构建期把明确路径的 DLL 作为只读 ABI/import 合同输入，运行时不读取安装注册表、不修改厂商 DLL、不执行远程注入、不创建全局环境变量，也不携带第二套 Qt runtime。

运行数据流:

`generated_translations.inc` → `CavalryEmbeddedTranslator` 精确/兜底哈希，其中 context-only 自绘词条不进入 source fallback → `CavalryDisplayTranslator` 对菜单、受控属性、QComboBox/QTreeWidget DisplayRole 及词表命中 QLineEdit 值作幂等投影；树的 model signal、输入框 `textChanged` 与局部 Paint 接住动态英文写回，UserRole/未知输入不变 → helper/placeholder/MessageBar 三条 callback 在安装期生成并原子发布 immutable snapshot；`QT_QPA_GENERIC_PLUGINS=cavalryi18n` → Qt generic factory → `CavalryI18nRuntime` → 安装 translator/显示层 → Show/Paint 首帧验证 ExtensionLayer 四边界：唯一 `CavalryUI::ui::textAtWidgetCentre` 槽处理九条 helper；canonical `setPlaceholder → QString::operator=` 链处理十三条 placeholder；`QTextEdit::append` 仅在 history/live 两个已锁定 return 且最后一个 `<br>` 后正文精确等于 Pencil 警告时替换；唯一 `Core::MakePathFromText` 槽还须在每次 callback 命中三处批准 caller 完整字节包络，canonical caller 仅接受十五条静态 source，PrimitiveTool 两处 line caller 仅以精确 CogTool context 接受 `Pitch Radius: ` 加 canonical 32-bit `int` 文本。命中时仅以已锁定 Core/skia 导出构造白名单 CJK Path；任一字体、字形、ABI 或 Path 异常则调用原函数保留英文，所有快捷键 prefix 也保持英文 → 可选原子聚合 marker。

法则: Qt 6.6.3 ABI 锁定·x64 MSVC release `std::string` 必须为 32 bytes·共享生成表真相·精确键首条优先·source fallback 末条覆盖但 context-only 自绘词条禁止进入·已知基名数字后缀通用投影·显示属性白名单·QComboBox/QTreeWidget 只写 DisplayRole·QLineEdit 仅翻译词表命中值且以 `QSignalBlocker` 隔离回写·未知输入/UserRole/currentIndex/通用 item view 不变·Paint 禁止树遍历·ExtensionLayer 只允许共享合同中已采证 source 经四条精确 IAT 边界进入，未知或表内非白名单文本原样透传·MessageBar 只批准 history/live 两个 return 与单条 HTML 尾部正文，`js_logger`、无 `<br>`、未知正文和整份 QTextEdit 文档保持原样·callback 不持 hook/translator raw pointer 且不得在生命周期锁内调用原函数·固定 aggregate→text 锁序·插件 process-lifetime PIN 必须早于任一 aggregate IAT 安装写入且 text-path 保留独立 PIN·终态失败回滚而 waiting 可保留 partial install·text-path 必须同时命中 exact slot/caller 字节包络/source/context 且每次 callback 重验，动态 Pitch 只能保留 canonical 32-bit `int` 后缀，CJK Path 只可由已锁定 Core/skia 导出在白名单内重建，任一失败回退英文·禁止扩大到 vendor `.text`、Skia、libc 或 QPainter 全局拦截·快捷键 prefix 保持英文·十六项 action/quality/Pitch 与 Pencil 三语文案不加末尾句号·IAT 卸载非 owner 不碰 globals，mixed restore 逐槽清 original，失败槽保留 forward-only snapshot·Snippet 仅在直调 canonical `setPlaceholder` 链与十三条 placeholder 合同中翻译·进程级环境·无 vendor 修改·无远程线程·无第二套 Qt runtime·marker 仅在显式绝对路径启用且 `installed` 代表四路完成

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
