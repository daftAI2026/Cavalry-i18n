# windows/
> L2 | 父级: ../CLAUDE.md

成员清单

CMakeLists.txt: CMake 4.2+ 与 Visual Studio 2022+ MSVC v143 的 shared Qt 6.6.3 x64 + Windows Psapi 构建边界；拒绝静态 Qt，编译产品 generic runtime、版本化私有 QPA 代理及独立 acceptance-only generic plugin，注册 display/hook/vendor/strict manifest 合同；build.ps1 只发布产品 `generic/cavalryi18n.dll` 与 `qpa/qwindows.dll`，验收 DLL 留在 build tree。
build.ps1: 带 UTF-8 BOM 的 Windows 唯一可重复构建入口；先从当前 TS/模型词典重生成共享 C++ 翻译表，再验证生成/发布父链无重解析点，每次清空唯一受控 build 目录后解析 shared Qt SDK 与可选 vendor root，由 CMake 选择当前已安装的 Visual Studio 生成器并锁定 x64/v143，串联 configure/build/ctest 并发布两个不纳入 Git 的已验证 DLL。
cavalry_i18n_callback_snapshot.h: 固定数量 exact source/translation 的不可变值表，支持按 source 或已验证索引读取；有意不析构的 process-lifetime shared_ptr 槽在卸载后只保留不触碰 Qt/Skia 的 forward-only 墓碑。
cavalry_i18n_plugin.h: `QGenericPlugin` metadata 与工厂接口，只暴露大小写不敏感的 `cavalryi18n` key，并声明严格非空 specification 边界。
cavalry_i18n_plugin.cpp: Qt generic factory 路由；空 specification 与未知语言一律拒绝，只把 QPA 明确传值映射到 runtime，并将内部配置失败投影为 `nullptr`。
cavalry_i18n_acceptance_plugin.h: acceptance-only `QGenericPlugin` 工厂声明；metadata key 与产品 plugin 分离，只接纳显式 `onboarding`/`adjacent` specification，并把 Qt test profile 约束在测试工厂。
cavalry_i18n_acceptance_plugin.cpp: 测试插件三重门；要求 exact key/specification、三种非英语语言和受控 acceptance 目录，在创建 driver 前启用 `QStandardPaths` test mode，再把 Onboarding/Adjacent driver 启动排入 GUI 线程；不链接产品 runtime、不进入发布 generic。
cavalryi18n_acceptance.json: acceptance-only Qt metadata，声明唯一 key `cavalryi18n_acceptance`；构建产物不得进入 Tauri resource 或发布 generic 目录。
cavalry_i18n_onboarding_acceptance.h: Windows firstLaunch 验收窄接口与状态；声明 MainDock 启动稳定、五步 ready/ACK、workspace-reset hard fail、真实下一页标题/正文确认和 bounded Next retry。
cavalry_i18n_onboarding_acceptance.cpp: acceptance-only 编译适配层；只为测试 target 选择 runtime.cpp 的 Onboarding 分区，产品 target 不链接 UI driver。
cavalry_i18n_adjacent_acceptance.h: Windows Tag/Assets 定向验收窄接口；只有显式同目录 acceptance/evidence/fixture 身份闭合时启用，正常产品运行不创建任何场景。
cavalry_i18n_adjacent_acceptance.cpp: Adjacent 验收状态与共享纯 helper；组合生命周期、Assets producer 与证据分片，保持外部只见 `start/drive`，以独立 state timer 避免 ContextMenu 嵌套循环丢 poll，并把登录/Welcome 旁路限制在受控验收实例。
cavalry_i18n_adjacent_acceptance_lifecycle.inc: Adjacent 生命周期与 Tag producer 分片；暴露 MainDock、语义点击真实 `TagHeader` GroupButton、验证 `PopOverView` exact 标签及 owner-external 负例。
cavalry_i18n_adjacent_acceptance_assets.inc: Adjacent Assets producer 分片；把带 run nonce 的冻结素材真实 Drop 到 `assets::Window`，按动态 stem 重解析 row，再向 exact viewport post 真实 ContextMenu 事件，以可见的 Replace/Create 菜单作为接受后置条件；write-once trace 只进入临时 evidence。
cavalry_i18n_adjacent_acceptance_evidence.inc: Adjacent 证据与终态分片；在 producer 瞬态仍存活时执行 exact QWidget grab，绑定同 PID producer HWND 或 alien-popup 的进程 HWND 锚点，原子发布 ready/ack/done；进程退出不混入 producer PASS，统一交给外部 exact-PID/HWND gate 清理。
cavalry_i18n_qpa_contract.h: QPA manifest v1 与语言 marker 的纯数据接口；隔离代理文件 IO 和 exact schema/hash/语言判定。
cavalry_i18n_qpa_contract.cpp: 严格拒绝 manifest 未知/缺失字段、版本/架构/固定 vendor hash 漂移，逐项比较实际 Cavalry.exe/vendor/proxy/generic SHA-256，并只接受四语言精确 marker。
cavalry_i18n_qpa_contract_test.cpp: 无厂商 DLL 的激活合同回归；覆盖 prepared/active/restoring、schema/key/运行 Qt/Cavalry.exe/hash 漂移、vendor 执行前摘要门及 marker 空白/大小写拒绝。
cavalry_i18n_qpa_binary_smoke_test.cpp: 最终 `qpa/qwindows.dll` 产物加载门；验证 QPA IID、唯一 `windows` key、动态依赖可解析及 `QPlatformIntegrationPlugin` 类型，不调用 create 或触碰厂商 DLL。
cavalry_i18n_qpa_proxy.h: Qt 6.6.3 私有 `QPlatformIntegrationPlugin` 接口与 `windows` metadata；完整实现两种 create 重载。
cavalry_i18n_qpa_proxy.cpp: 在 `QPluginLoader::instance` 前校验运行 Qt 6.6.3 与固定 vendor 摘要，再绝对加载/永久驻留原厂 QPA；原厂 integration 成功后，仅在 active manifest、Cavalry.exe/vendor/proxy/generic 四项实际 hash 与非英语 marker 全通过时显式启动 generic，翻译失败保留原厂 integration。
cavalry_i18n_display.h: 主动显示翻译接口与对象生命周期状态，明确 QWidget/QAction、已知基名数字后缀、QComboBox/QTreeWidget DisplayRole、受词表约束的 QLineEdit、厂商父系内精确 QPlainTextEdit 占位文字、真实 Assets ContextMenu 的 Replace/动态 Create 双 action 边界，以及仅供原生测试目标注入 CavalryUI `gMainWindow` 身份的 seam。
cavalry_i18n_dynamic_label.h: 不依赖 QObject 的纯动态 QLabel 规则，严格匹配 `N selected` 与登录离线认证天数并提供三语投影；未知语言、未知文本和近似文本返回空值。
cavalry_i18n_display.cpp: 幂等翻译菜单、动作、标题、逐行复合 tooltip、数字后缀、严格 selected/离线认证，以及仅在 `MeshExplorerRowWidget` 父系内的整数 QLabel、`Color Settings` 对话框内的 `Automatic (%1)` QComboBox DisplayRole、`AttributeEditorWindow` 父系内的单索引 QPlainTextEdit 占位文字、`ProjectStatisticsWindow` 父系内三条性能 QLabel、CavalryUI `gMainWindow` 直属且带 `WA_DeleteOnClose`/WindowModal-progress/Cancel 结构的原生 Tracking 对话框和递归 QTreeWidget DisplayRole；Assets producer bridge 只在同一 ContextMenu 事件轮把 `assets::Window` owner 传给刚创建的双 action 菜单，先翻译 Replace 与动态 Create 再进入通用菜单路径；通过 `aboutToShow`/`changed`/model signal/Paint 接住首帧与动态英文写回，无关同文控件、编辑器正文、UserRole、currentIndex 和通用 item view 保持原值。
cavalry_i18n_display_test.cpp: 三语显示层单元回归，锁定 ToolBox/渲染标题、四条 exact-context 普通 Qt 动作、`ProjectStatisticsWindow` 性能标签、真实 Assets 双 action ContextMenu 与 gMainWindow/`WA_DeleteOnClose`/WindowModal-progress/Cancel Tracking 结构，并覆盖相同文本的无关 QLabel、非 Assets 或 action 形状不完整菜单、不同父窗口及普通/不完整/错误按钮 QDialog 负例；同时锁定 8 条 source fallback 拒绝、Color Settings/Mesh Explorer/单索引动态模板、正文隔离、编号书签、CogTool context-only、selected/离线认证、LineTool、复合 tooltip、数字后缀与 DisplayRole/UserRole/currentIndex 合同。
cavalry_i18n_extension_layer_hook.h: ExtensionLayer 的串行化聚合生命周期接口；固定 aggregate→text 锁序，拥有 helper/placeholder/MessageBar 三槽、独立 text-path 子 hook 及结构化诊断转发，只有四路全部安装才报告 `installed`。
cavalry_i18n_extension_layer_sources.h: 不依赖 Qt 的共享文本真相，锁定九条 helper、十三条 CustomListWidget placeholder、一条 MessageBar Pencil 警告、三十六条静态 text-path source 与一条由跨平台策略导出的 CogTool `Pitch Radius: ` context-only 动态前缀；除 EditShapeTool/TransformTool 长操作前缀外，新增 SkeletonTool Bone Tool 四组逐字采证提示，`Space`、纯修饰键及单字母快捷键保持原文。
cavalry_i18n_extension_layer_hook.cpp: 编排 helper、placeholder、MessageBar 与 Core text-path 四条可逆 IAT 边界；取得 aggregate owner 后、首次 Qt IAT 写入前必须永久 PIN 插件，失败则零写入；waiting 可保留已装前缀，终态失败逆序回滚。
cavalry_i18n_aggregate_pin_contract_test.cpp: aggregate 危险原语顺序合同分片；枚举真实 `ensureInstalled` 的三个 Qt IAT 安装写点并要求均晚于插件 PIN，同时直测 PIN helper 的空地址拒绝与本映像正例。
cavalry_i18n_extension_layer_qt_hooks.h: helper/placeholder/MessageBar 三条 Qt callback 机制接口；暴露 placeholder/MessageBar ABI 验证、immutable snapshot 发布/启停、replacement 地址与三项 global original 独立清理。
cavalry_i18n_extension_layer_qt_hooks.cpp: 解码 canonical `setPlaceholder` setter 尾跳槽并锁定 MessageBar history/live 两个 `QTextEdit::append` return；三条 callback 均不持 raw owner，Pencil 只替换最后一个 `<br>` 后精确正文并明确排除 `js_logger`。
cavalry_i18n_messagebar_qt_hook_test.cpp: MessageBar 双 caller/单 source 低层回归，覆盖 history/live、`js_logger` 排除、无 `<br>`/未知正文/空地址透传、Unicode 空白保持、禁用与 forward-only 墓碑。
cavalry_i18n_messagebar_lifecycle_contract_test.cpp: MessageBar 聚合生命周期分片，以 message-only partial install 验证终态回滚、第三方接管 CAS 失败与 original 保留，不与正文 dispatch 单测混淆。
cavalry_i18n_extension_layer_text_path_dispatch.h: Core::MakePathFromText 的纯分发合同，定义三处批准 caller、静态/动态 source 匹配、普通译文组合与无堆分配的有界写入接口。
cavalry_i18n_extension_layer_text_path_dispatch.cpp: 安装期与每次 callback 都逐字节验证 canonical、PrimitiveTool 首行/后续行三处 call/preamble/return，首行包络从 `mov rdx,[rdi]` 锁定 MSVC 字符串来源；canonical caller 只接纳三十六条静态 source，动态路径只允许 `Pitch Radius: ` 后接 MSVC `int` 会生成的 canonical 32-bit 十进制文本，callback 译文写入固定栈缓冲，其他 caller/source 全部拒绝。
cavalry_i18n_extension_layer_text_path_dispatch_test.cpp: 三语静态/动态 text-path 回归，逐项锁定 Pencil/Pen/Centre/Bone 动作、Bone 语义前缀及近似拒绝，验证 Pitch 0、正负边界逐字保留，callback 对运行期包络变更继续 fail-closed，并拒绝正号、小数、单位、前导零、负零、溢出、额外空格、大小写变体及越界 caller。
cavalry_i18n_extension_layer_text_path_hook.h: Core::MakePathFromText 的独立 MSVC x64 边界，声明延迟安装、slot/caller 字节包络/source/context 四重门、CogTool 整数后缀保留、terminal renderer 失败、forward-only 墓碑及 canonical/whitelist/success/fallback/source-mask 诊断。
cavalry_i18n_extension_layer_text_path_hook.cpp: 只替换 RVA `0x1B28F98` IAT 槽；runtime ABI 完整通过并永久 PIN plugin/Core/skia 后才安装，callback 仅接纳持续通过完整包络复核的三处批准 caller 与精确 context，并零 IO 地累计三十七项 64 位 source 位图；既有 Pitch 固定保留 bit 28，Bone 使用 bits 29–36，卸载先原子换成无 renderer 墓碑再恢复 IAT。
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
cavalry_i18n_vendor_iat_contract_test.cpp: 只读映射指定 vendor PE 文件，先锁定 ExtensionLayer/CavalryUI 的 2.7.2 timestamp/image-size 身份并以头部漂移负例锁住拒绝路径，再验证 helper IAT/CavalryUI 导出、`setPlaceholder` 链、placeholder literals、共享 8-key ordinary-Qt 证据覆盖、四条 meta-object 翻译、三条性能 QLabel，以及 Tracking 的 `gMainWindow`→QDialog parent、dialog→`WA_DeleteOnClose` receiver、dialog→progress/Cancel parent、progress→`Qt::WindowModal` receiver 连续寄存器字节包络、`%1 selected`、动态表面父系 meta-object、Mesh Explorer QLabel factory、Color Settings QComboBox 与单索引 QPlainTextEdit 数据流，并调用 MessageBar/text-path 合同分片；从不加载、执行或修改厂商代码。
cavalry_i18n_vendor_messagebar_contract.h: 已映射 ExtensionLayer PE64 的 MessageBar 只读验证入口，把 vendor 主测试与具体 append caller/HTML/source 证据隔离。
cavalry_i18n_vendor_messagebar_contract.cpp: 锁定唯一 `QTextEdit::append` IAT、三处真实引用、history/live 两个批准 return、命名 `js_logger` 排除项、MessageBar HTML 模板及 Pencil 原文。
cavalry_i18n_vendor_text_path_contract.h: 已映射 ExtensionLayer PE64 的 text-path 只读验证入口，把 vendor 主测试与具体 IAT/caller/ABI preamble RVA 证据隔离。
cavalry_i18n_vendor_text_path_contract.cpp: 锁定唯一 Core MakePath IAT、二十个槽调用、canonical 静态 caller、viewport 与 Edit/Transform/Pencil/Pen/Centre/Bone tool-help 数据流；Bone 额外锁定 SkeletonTool RTTI/vtable 与第四组内联字符串构造，并继续验证 CogTool `Pitch Radius: ` 两处分支生产、optional vector 存储、PrimitiveToolBase 消费和首行/后续行两处 MakePath ABI caller 的完整链路。
cavalry_i18n_vendor_skia_text_path_contract.h: Core/skia 只读 CJK Path 兼容验证入口，隔离 renderer 依赖的导出、对象布局和所有权证据。
cavalry_i18n_vendor_skia_text_path_contract.cpp: 独立锁定 Core 固定 Lato、SkFont move/null、SkPath copy prefix、CJK 导出与 refcount 析构；不与运行时常量共用证据。
cavalry_i18n_extension_layer_hook_test.cpp: 无厂商模块主合同；覆盖三语、helper/placeholder 槽生命周期、runtime identity 正反例、renderer-free tombstone 与原子计数/source-mask，并调用独立 MessageBar 生命周期分片。
cavalry_i18n_runtime.h: QPA 显式语言、可查询配置结果、主动显示刷新、聚合四边界延迟安装及 revision-driven marker 生命周期声明；产品接口不持有 Onboarding/Adjacent driver 或任何验收环境入口。
cavalry_i18n_runtime.cpp: 产品分区语言只消费 QPA 非空 specification，Show/Paint 仅刷新受控显示属性，并把 `assets::Window` ContextMenu producer 通过单事件轮弱引用交给显示层。acceptance-only Onboarding 分区要求证据目录与 marker 同目录、MainDock 稳定 15 秒且工作区重置框从未出现，manager-first 触发 `firstLaunch`，按安装 catalog 独立验证唯一标题 QLabel/正文 QTextBrowser；前四步只点击唯一 localized Next，并在 `waiting-for-transition` 中等真实下一页唯一标题/正文出现后才推进，旧页 1.5 秒稳定时最多重试三次，第五步 ACK-only。
cavalry_i18n_translator.h: 嵌入式 translator 查询接口与统计边界，隔离生成表表示和运行时生命周期。
cavalry_i18n_translator.cpp: 复用共享 `generated_translations.inc`，构建精确 `(context, source)` 首条优先哈希与遵循现有显示层语义的末条覆盖 source fallback；共享策略声明的 context-only、8 条 ordinary-Qt exact-only，以及双平台均已由真实 owner/producer 采证的 Tag/动态 Assets 邻接 key 均不进入 fallback。
cavalry_i18n_translator_test.cpp: 三语言非空表、已证实 helper 与 ordinary-Qt 残留、编号书签、Color Settings/Mesh Explorer/单索引动态模板、LineTool 精确标签、具体 Add Layer 快捷键，以及双平台 owner/producer 已采证的 Tag/动态 Assets 共享 key 之 exact-context 正例与 Unknown/null fallback 负例；同时覆盖 context-only 拒绝、普通 source fallback、未知语言和未知文本。
cavalry_i18n_plugin_smoke_test.cpp: 由最小 `QApplication` 加载真实 generic DLL，证明空 specification 即使存在遗留环境也被拒，并验证 QPA 等价显式语言、显示投影、数据隔离与九字段 marker。
cavalryi18n.json: Qt plugin metadata，声明唯一自动加载 key `cavalryi18n`。
qwindows.json: Qt QPA metadata，声明唯一平台 key `windows`。
README.md: Windows 插件依赖、构建目录、四条 ExtensionLayer 边界、MessageBar 精确排除规则、子进程环境契约、只读 vendor 静态合同与 live gate 判定。
generic/: 由 build.ps1 生成的 Tauri resource 稳定目录，只允许 `cavalryi18n.dll`，禁止复制 Qt runtime。
qpa/: 由 build.ps1 生成的 QPA 代理稳定资源目录，只允许 `qwindows.dll`，部署层负责原厂备份、manifest 与原子替换。

依赖边界:

generic runtime 只依赖 Qt 6.6.3 Core/Gui/Widgets 公共 ABI、Windows Psapi、本地 PE/IAT 与父级生成表；QPA 代理额外显式依赖 Qt 6.6.3 版本化私有平台插件 ABI。acceptance plugin 是第三个独立测试目标，只由 ignored live gate 临时复制到 disposable clone，既不链接产品 runtime，也不进入 `generic/`、Tauri resources 或 NSIS。部署层把原厂 `qwindows.dll` 持久化到安装根专用子目录并以本代理占据原入口；代理自身不写安装根、不读注册表、不创建环境变量，只有可选 diagnostic marker 延续既有显式环境输入。`CAVALRY_VENDOR_ROOT` 仍只用于构建期只读 ABI/import 合同，发布的两个产品 DLL 均不携带第二套 Qt runtime。

运行数据流:

原生任意入口 → 根 `qwindows.dll` 代理 → 在执行前校验运行 Qt 与固定 vendor 摘要，再绝对加载并委托 `cavalry-i18n-qpa/vendor-qwindows.dll`；原厂 integration 非空后解析 exact manifest v1，prepared/restoring 或 English 只返回原厂结果，active 则逐项验证 Cavalry.exe/vendor/proxy/generic 实际 SHA-256 与严格语言 marker → `QGenericPlugin::create("cavalryi18n", language)` 显式传值，不经 `qputenv`；旧式 `QT_QPA_GENERIC_PLUGINS` 的空 specification 被工厂拒绝，不能绕过 manifest → runtime 安装 translator/显示层。`generated_translations.inc` → `CavalryEmbeddedTranslator` 精确/兜底哈希，其中 context-only 自绘词条、8 条跨平台 ordinary-Qt exact-only 词条及 Tag/动态 Assets owner-scoped 邻接 key 都不进入 source fallback → `CavalryDisplayTranslator` 只在 exact context、ProjectStatistics 父系、已由 vendor receiver 包络证明的 gMainWindow Tracking 结构或同事件轮的真实 Assets producer 内作幂等显示投影 → helper/placeholder/MessageBar immutable snapshot 与 text-path 白名单四边界。ignored Adjacent live gate 另以 `QT_QPA_GENERIC_PLUGINS=cavalryi18n_acceptance:adjacent` 把临时 acceptance DLL 装入 disposable clone；它只在显式绝对目录、fixture、marker 三重身份闭合时运行，按语义驱动 Tag/Assets producer，并持续隐藏登录、Welcome 与恢复工作区模态框。正常产品与用户安装路径不存在该 DLL 或这些输入。任一翻译、字体、字形、ABI、Path 或验收身份异常都保留原厂窗口系统/英文并在显式 marker 可用时输出结构化错误。

法则: shared Qt 6.6.3 公共/私有 QPA ABI 双锁定·QPA manifest exact schema/固定版本架构/Cavalry.exe+三 DLL 实际 SHA-256·vendor 摘要先于执行·prepared/restoring/English 不激活 generic·空 specification 永久拒绝·显式语言不写环境·原厂 integration 先成功、翻译后尝试且 fail-open·x64 MSVC release `std::string` 必须为 32 bytes·共享生成表真相·精确键首条优先·source fallback 末条覆盖但 context-only 专用词条禁止进入·已知基名数字后缀通用投影·selected-count/离线认证保持严格 QLabel；Mesh Explorer、Color Settings 与单索引提示必须额外命中已采证父系/对话框来源·动态 Combo 只写 DisplayRole·单索引只写 QPlainTextEdit placeholderText 且绝不读写正文·QTreeWidget 只写 DisplayRole·QLineEdit 仅翻译词表命中值且以 `QSignalBlocker` 隔离回写·无关同文控件/未知输入/UserRole/currentIndex/通用 item view 不变·Paint 禁止树遍历·ExtensionLayer 只允许共享合同中已采证 source 经四条精确 IAT 边界进入，未知或表内非白名单文本原样透传·MessageBar 只批准 history/live 两个 return 与单条 HTML 尾部正文，`js_logger`、无 `<br>`、未知正文和整份 QTextEdit 文档保持原样·callback 不持 hook/translator raw pointer 且不得在生命周期锁内调用原函数·固定 aggregate→text 锁序·插件 process-lifetime PIN 必须早于任一 aggregate IAT 安装写入且 text-path 保留独立 PIN·终态失败回滚而 waiting 可保留 partial install·text-path 必须同时命中 exact slot/caller 字节包络/source/context 且每次 callback 重验，动态 Pitch 只能保留 canonical 32-bit `int` 后缀，CJK Path 只可由已锁定 Core/skia 导出在白名单内重建，任一失败回退英文·禁止扩大到 vendor `.text`、Skia、libc 或 QPainter 全局拦截·EditShapeTool/TransformTool 三条长操作前缀及 Bone Tool 四组已采证提示可翻译，`Space`、纯修饰键与单字母快捷键保持英文·三十七项 action/quality/长前缀/Bone/Pitch 与 Pencil 三语文案不加末尾句号·IAT 卸载非 owner 不碰 globals，mixed restore 逐槽清 original，失败槽保留 forward-only snapshot·Snippet 仅在直调 canonical `setPlaceholder` 链与十三条 placeholder 合同中翻译·无远程线程·无第二套 Qt runtime·diagnostic marker 仅在显式绝对路径启用且 `installed` 代表四路完成·Onboarding/Adjacent 验收目录都必须是 marker 父目录下真实直系子目录，Adjacent fixture 必须冻结且同目录、每次动态 stem 带唯一 nonce、登录/Welcome 只在受控 gate 隐藏、producer-side PNG/逐图 ack/两逻辑结果任一不成立即 fail closed

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
