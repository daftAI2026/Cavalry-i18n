# windows/
> L2 | 父级: ../CLAUDE.md

成员清单

CMakeLists.txt: shared Qt 6.6.3 x64 MSVC + Windows Psapi 构建边界；拒绝静态 Qt，编译 generic 翻译 runtime 与使用版本化私有 QPA 头的原厂委托代理，注册 display/hook/vendor、strict manifest 及仅显式语言入口合同，发布 `generic/cavalryi18n.dll` 和 `qpa/qwindows.dll`。
build.ps1: 带 UTF-8 BOM 的 Windows 唯一可重复构建入口；先从当前 TS/模型词典重生成共享 C++ 翻译表，再验证生成/发布父链无重解析点，每次清空唯一受控 build 目录后解析 shared Qt SDK 与可选 vendor root，串联 configure/build/ctest 并发布两个不纳入 Git 的已验证 DLL。
cavalry_i18n_callback_snapshot.h: 固定数量 exact source/translation 的不可变值表，支持按 source 或已验证索引读取；有意不析构的 process-lifetime shared_ptr 槽在卸载后只保留不触碰 Qt/Skia 的 forward-only 墓碑。
cavalry_i18n_plugin.h: `QGenericPlugin` metadata 与工厂接口，只暴露大小写不敏感的 `cavalryi18n` key，并声明严格非空 specification 边界。
cavalry_i18n_plugin.cpp: Qt generic factory 路由；空 specification 与未知语言一律拒绝，只把 QPA 明确传值映射到 runtime，并将内部配置失败投影为 `nullptr`。
cavalry_i18n_qpa_contract.h: QPA manifest v1 与语言 marker 的纯数据接口；隔离代理文件 IO 和 exact schema/hash/语言判定。
cavalry_i18n_qpa_contract.cpp: 严格拒绝 manifest 未知/缺失字段、版本/架构/固定 vendor hash 漂移，逐项比较实际 Cavalry.exe/vendor/proxy/generic SHA-256，并只接受四语言精确 marker。
cavalry_i18n_qpa_contract_test.cpp: 无厂商 DLL 的激活合同回归；覆盖 prepared/active/restoring、schema/key/运行 Qt/Cavalry.exe/hash 漂移、vendor 执行前摘要门及 marker 空白/大小写拒绝。
cavalry_i18n_qpa_binary_smoke_test.cpp: 最终 `qpa/qwindows.dll` 产物加载门；验证 QPA IID、唯一 `windows` key、动态依赖可解析及 `QPlatformIntegrationPlugin` 类型，不调用 create 或触碰厂商 DLL。
cavalry_i18n_qpa_proxy.h: Qt 6.6.3 私有 `QPlatformIntegrationPlugin` 接口与 `windows` metadata；完整实现两种 create 重载。
cavalry_i18n_qpa_proxy.cpp: 在 `QPluginLoader::instance` 前校验运行 Qt 6.6.3 与固定 vendor 摘要，再绝对加载/永久驻留原厂 QPA；原厂 integration 成功后，仅在 active manifest、Cavalry.exe/vendor/proxy/generic 四项实际 hash 与非英语 marker 全通过时显式启动 generic，翻译失败保留原厂 integration。
cavalry_i18n_display.h: 主动显示翻译接口与对象生命周期状态，明确 QWidget/QAction、已知基名数字后缀、QComboBox/QTreeWidget DisplayRole 与受词表约束的 QLineEdit 显示值边界。
cavalry_i18n_dynamic_label.h: 不依赖 QObject 的纯动态 QLabel 规则，严格匹配 `N selected` 与登录离线认证天数并提供三语投影；未知语言、未知文本和近似文本返回空值。
cavalry_i18n_display.cpp: 幂等翻译菜单、动作、标题、逐行复合 tooltip、已知基名数字后缀、严格 selected/离线认证倒计时 QLabel、QComboBox 可见项和递归 QTreeWidget DisplayRole；通过 `aboutToShow`/`changed`/model signal/Paint 接住首帧与动态英文写回，复合提示只替换词表命中行，未知行、UserRole、currentIndex 和通用 item view 保持原值。
cavalry_i18n_display_test.cpp: 三语显示层单元回归，锁定 ToolBox/渲染窗口标题、Exit/调色板动作、CogTool Pitch context-only 隔离、selected/离线认证动态 QLabel 正反例与非 QLabel 隔离、精确尾随空白工具标签、横竖工具栏及播放、渲染、Sub-Mesh、Path、脚本表面的 `标题\n说明` tooltip、未知提示行、已知基名数字后缀与 DisplayRole 投影隔离合同。
cavalry_i18n_extension_layer_hook.h: ExtensionLayer 的串行化聚合生命周期接口；固定 aggregate→text 锁序，拥有 helper/placeholder/MessageBar 三槽、独立 text-path 子 hook 及结构化诊断转发，只有四路全部安装才报告 `installed`。
cavalry_i18n_extension_layer_sources.h: 不依赖 Qt 的共享文本真相，锁定九条 helper、十三条 CustomListWidget placeholder、一条 MessageBar Pencil 警告、二十二条静态 text-path source 与一条由跨平台策略导出的 CogTool `Pitch Radius: ` context-only 动态前缀；Pencil/Pen/Centre 快捷键与动作保持成对证据但只翻译动作。
cavalry_i18n_extension_layer_hook.cpp: 编排 helper、placeholder、MessageBar 与 Core text-path 四条可逆 IAT 边界；取得 aggregate owner 后、首次 Qt IAT 写入前必须永久 PIN 插件，失败则零写入；waiting 可保留已装前缀，终态失败逆序回滚。
cavalry_i18n_aggregate_pin_contract_test.cpp: aggregate 危险原语顺序合同分片；枚举真实 `ensureInstalled` 的三个 Qt IAT 安装写点并要求均晚于插件 PIN，同时直测 PIN helper 的空地址拒绝与本映像正例。
cavalry_i18n_extension_layer_qt_hooks.h: helper/placeholder/MessageBar 三条 Qt callback 机制接口；暴露 placeholder/MessageBar ABI 验证、immutable snapshot 发布/启停、replacement 地址与三项 global original 独立清理。
cavalry_i18n_extension_layer_qt_hooks.cpp: 解码 canonical `setPlaceholder` setter 尾跳槽并锁定 MessageBar history/live 两个 `QTextEdit::append` return；三条 callback 均不持 raw owner，Pencil 只替换最后一个 `<br>` 后精确正文并明确排除 `js_logger`。
cavalry_i18n_messagebar_qt_hook_test.cpp: MessageBar 双 caller/单 source 低层回归，覆盖 history/live、`js_logger` 排除、无 `<br>`/未知正文/空地址透传、Unicode 空白保持、禁用与 forward-only 墓碑。
cavalry_i18n_messagebar_lifecycle_contract_test.cpp: MessageBar 聚合生命周期分片，以 message-only partial install 验证终态回滚、第三方接管 CAS 失败与 original 保留，不与正文 dispatch 单测混淆。
cavalry_i18n_extension_layer_text_path_dispatch.h: Core::MakePathFromText 的纯分发合同，定义三处批准 caller、静态/动态 source 匹配、普通译文组合与无堆分配的有界写入接口。
cavalry_i18n_extension_layer_text_path_dispatch.cpp: 安装期与每次 callback 都逐字节验证 canonical、PrimitiveTool 首行/后续行三处 call/preamble/return，首行包络从 `mov rdx,[rdi]` 锁定 MSVC 字符串来源；canonical caller 只接纳二十二条静态 source，动态路径只允许 `Pitch Radius: ` 后接 MSVC `int` 会生成的 canonical 32-bit 十进制文本，callback 译文写入固定栈缓冲，其他 caller/source 全部拒绝。
cavalry_i18n_extension_layer_text_path_dispatch_test.cpp: 三语静态/动态 text-path 回归，逐项锁定 Pencil/Pen/Centre 动作及近似拒绝，验证 Pitch 0、正负边界逐字保留，callback 对运行期包络变更继续 fail-closed，并拒绝正号、小数、单位、前导零、负零、溢出、额外空格、大小写变体及越界 caller。
cavalry_i18n_extension_layer_text_path_hook.h: Core::MakePathFromText 的独立 MSVC x64 边界，声明延迟安装、slot/caller 字节包络/source/context 四重门、CogTool 整数后缀保留、terminal renderer 失败、forward-only 墓碑及 canonical/whitelist/success/fallback/source-mask 诊断。
cavalry_i18n_extension_layer_text_path_hook.cpp: 只替换 RVA `0x1B28F98` IAT 槽；runtime ABI 完整通过并永久 PIN plugin/Core/skia 后才安装，callback 仅接纳持续通过完整包络复核的三处批准 caller 与精确 context，并零 IO 地累计二十三项三十二位 source 位图，卸载先原子换成无 renderer 墓碑再恢复 IAT。
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
cavalry_i18n_vendor_iat_contract_test.cpp: 只读映射指定 vendor PE 文件，锁定 Cavalry 2.7.2 的 helper IAT/CavalryUI 导出、`setPlaceholder` thunk/setter/尾跳槽、placeholder literals 与 `%1 selected → QLabel::setText` 数据流，并调用 MessageBar/text-path 合同分片；从不加载、执行或修改厂商代码。
cavalry_i18n_vendor_messagebar_contract.h: 已映射 ExtensionLayer PE64 的 MessageBar 只读验证入口，把 vendor 主测试与具体 append caller/HTML/source 证据隔离。
cavalry_i18n_vendor_messagebar_contract.cpp: 锁定唯一 `QTextEdit::append` IAT、三处真实引用、history/live 两个批准 return、命名 `js_logger` 排除项、MessageBar HTML 模板及 Pencil 原文。
cavalry_i18n_vendor_text_path_contract.h: 已映射 ExtensionLayer PE64 的 text-path 只读验证入口，把 vendor 主测试与具体 IAT/caller/ABI preamble RVA 证据隔离。
cavalry_i18n_vendor_text_path_contract.cpp: 锁定唯一 Core MakePath IAT、二十个槽调用、canonical 静态 caller、viewport 与 Edit/Transform/Pencil/Pen/Centre tool-help 数据流，以及 CogTool `Pitch Radius: ` 两处分支生产、optional vector 存储、PrimitiveToolBase 消费和首行/后续行两处 MakePath ABI caller 的完整链路。
cavalry_i18n_vendor_skia_text_path_contract.h: Core/skia 只读 CJK Path 兼容验证入口，隔离 renderer 依赖的导出、对象布局和所有权证据。
cavalry_i18n_vendor_skia_text_path_contract.cpp: 独立锁定 Core 固定 Lato、SkFont move/null、SkPath copy prefix、CJK 导出与 refcount 析构；不与运行时常量共用证据。
cavalry_i18n_extension_layer_hook_test.cpp: 无厂商模块主合同；覆盖三语、helper/placeholder 槽生命周期、runtime identity 正反例、renderer-free tombstone 与原子计数/source-mask，并调用独立 MessageBar 生命周期分片。
cavalry_i18n_runtime.h: QPA 显式语言、可查询配置结果、主动显示刷新、聚合四边界延迟安装及 revision-driven marker 生命周期声明。
cavalry_i18n_runtime.cpp: 语言只消费 QPA 非空 specification，绝不读取 `CAVALRY_I18N_LANG`；显式绝对 marker 下创建 75ms Qt 线程计时器，只在 text-path revision 改变时写九项计数/位图。
cavalry_i18n_translator.h: 嵌入式 translator 查询接口与统计边界，隔离生成表表示和运行时生命周期。
cavalry_i18n_translator.cpp: 复用共享 `generated_translations.inc`，构建精确 `(context, source)` 首条优先哈希与遵循现有显示层语义的末条覆盖 source fallback；共享策略声明的自绘词条不进入 fallback。
cavalry_i18n_translator_test.cpp: 三语言非空表、已证实 helper 与调色板/场景/工具残留的嵌入翻译样本、精确尾随空白查询、context-only 拒绝、source fallback、未知语言和未知文本合同测试。
cavalry_i18n_plugin_smoke_test.cpp: 由最小 `QApplication` 加载真实 generic DLL，证明空 specification 即使存在遗留环境也被拒，并验证 QPA 等价显式语言、显示投影、数据隔离与九字段 marker。
cavalryi18n.json: Qt plugin metadata，声明唯一自动加载 key `cavalryi18n`。
qwindows.json: Qt QPA metadata，声明唯一平台 key `windows`。
README.md: Windows 插件依赖、构建目录、四条 ExtensionLayer 边界、MessageBar 精确排除规则、子进程环境契约、只读 vendor 静态合同与 live gate 判定。
generic/: 由 build.ps1 生成的 Tauri resource 稳定目录，只允许 `cavalryi18n.dll`，禁止复制 Qt runtime。
qpa/: 由 build.ps1 生成的 QPA 代理稳定资源目录，只允许 `qwindows.dll`，部署层负责原厂备份、manifest 与原子替换。

依赖边界:

generic runtime 只依赖 Qt 6.6.3 Core/Gui/Widgets 公共 ABI、Windows Psapi、本地 PE/IAT 与父级生成表；QPA 代理额外显式依赖 Qt 6.6.3 版本化私有平台插件 ABI。部署层把原厂 `qwindows.dll` 持久化到安装根专用子目录并以本代理占据原入口；代理自身不写安装根、不读注册表、不创建环境变量，只有可选 diagnostic marker 延续既有显式环境输入。`CAVALRY_VENDOR_ROOT` 仍只用于构建期只读 ABI/import 合同，两个产物均不携带第二套 Qt runtime。

运行数据流:

原生任意入口 → 根 `qwindows.dll` 代理 → 在执行前校验运行 Qt 与固定 vendor 摘要，再绝对加载并委托 `cavalry-i18n-qpa/vendor-qwindows.dll`；原厂 integration 非空后解析 exact manifest v1，prepared/restoring 或 English 只返回原厂结果，active 则逐项验证 Cavalry.exe/vendor/proxy/generic 实际 SHA-256 与严格语言 marker → `QGenericPlugin::create("cavalryi18n", language)` 显式传值，不经 `qputenv`；旧式 `QT_QPA_GENERIC_PLUGINS` 的空 specification 被工厂拒绝，不能绕过 manifest → runtime 安装 translator/显示层。`generated_translations.inc` → `CavalryEmbeddedTranslator` 精确/兜底哈希，其中 context-only 自绘词条不进入 source fallback → `CavalryDisplayTranslator` 作幂等显示投影 → helper/placeholder/MessageBar immutable snapshot 与 text-path 白名单四边界；任一翻译、字体、字形、ABI 或 Path 异常都保留原厂窗口系统/英文并在显式 marker 可用时输出结构化错误。

法则: shared Qt 6.6.3 公共/私有 QPA ABI 双锁定·QPA manifest exact schema/固定版本架构/Cavalry.exe+三 DLL 实际 SHA-256·vendor 摘要先于执行·prepared/restoring/English 不激活 generic·空 specification 永久拒绝·显式语言不写环境·原厂 integration 先成功、翻译后尝试且 fail-open·x64 MSVC release `std::string` 必须为 32 bytes·共享生成表真相·精确键首条优先·source fallback 末条覆盖但 context-only 自绘词条禁止进入·已知基名数字后缀通用投影·selected-count 与离线认证倒计时只匹配严格 QLabel 文本·显示属性白名单·QComboBox/QTreeWidget 只写 DisplayRole·QLineEdit 仅翻译词表命中值且以 `QSignalBlocker` 隔离回写·未知输入/UserRole/currentIndex/通用 item view 不变·Paint 禁止树遍历·ExtensionLayer 只允许共享合同中已采证 source 经四条精确 IAT 边界进入，未知或表内非白名单文本原样透传·MessageBar 只批准 history/live 两个 return 与单条 HTML 尾部正文，`js_logger`、无 `<br>`、未知正文和整份 QTextEdit 文档保持原样·callback 不持 hook/translator raw pointer 且不得在生命周期锁内调用原函数·固定 aggregate→text 锁序·插件 process-lifetime PIN 必须早于任一 aggregate IAT 安装写入且 text-path 保留独立 PIN·终态失败回滚而 waiting 可保留 partial install·text-path 必须同时命中 exact slot/caller 字节包络/source/context 且每次 callback 重验，动态 Pitch 只能保留 canonical 32-bit `int` 后缀，CJK Path 只可由已锁定 Core/skia 导出在白名单内重建，任一失败回退英文·禁止扩大到 vendor `.text`、Skia、libc 或 QPainter 全局拦截·快捷键 prefix 保持英文·二十三项 action/quality/Pitch 与 Pencil 三语文案不加末尾句号·IAT 卸载非 owner 不碰 globals，mixed restore 逐槽清 original，失败槽保留 forward-only snapshot·Snippet 仅在直调 canonical `setPlaceholder` 链与十三条 placeholder 合同中翻译·无远程线程·无第二套 Qt runtime·diagnostic marker 仅在显式绝对路径启用且 `installed` 代表四路完成

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
