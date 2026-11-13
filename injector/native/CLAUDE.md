# injector/native/
> L2 | 父级: ../CLAUDE.md

# 本目录保存 Cavalry 2.8 macOS arm64与x86_64字体、FPS、Graph、标题、帮助、Guide、Fast、Easing、Mesh、Welcome与Demo候选组件。
GetPath每语lane由27→31→75项；旧225项表不变，Graph空态使用独立单文本三语表。
本目录候选均不进入2.7发布链。
帮助说明、帮助布局、Guide正文与Fast C1适配已加入单一候选源。
main与def两条已证caller各读独立source-bound表。
未知caller由对应架构veneer透明尾跳原导入；x86偏移只取官方x86切片。
字体适配只消费同bundle四个已验映像。
标题另依赖fmt10，帮助依赖CavalryUI，布局依赖同bundle Qt 6.9.2。
Guide正文只接精确Keep going caller/source；ABI门在构造时核对QtWidgets与Extension。
Easing只投影精确20个预设显示标签；回调捕获的枚举身份保持原值。
Demo reader只投影精确Preset读取caller、官方文件路径、源SHA和文字位置；其它调用原样返回optional。
冻结9c352155已由普通Switcher部署到owned测试App。
三语各100菜单已核AX；完整首帧与正式发行另验。

成员清单
ABI合同默认保持950e713的2.8.0完整内容；仅定义`CAVALRY_NATIVE_TARGET_281`时，14个既有合同头才包含`abi_2_8_1/`中的arm64合同。
abi_2_8_1/: Cavalry 2.8.1 arm64合同快照；SetSize使用已复核`0x6f`字节，title合同只含arm64 fmt11，不定义Intel合同。
abi_2_8_1/contract_snapshot_test.py: 校验14个2.8.0默认头的SHA快照、15个281 profile头及标题/SetSize边界；不调用vendor。
dependency_node_font_abi_contract.h: 仅在281 arm64显式配置下转入profile；280没有NodeView字体准入合同。
native_font_candidate.mm: 定位同bundle Frameworks；接通Graph空态、Demo、字体、标题、帮助、Guide、Easing与Welcome，并装配双保存caption。
candidate_contract_test.cpp: 验证FPS/Graph直连帧、Graph三语精确门、旧owner透传与75项lane。
guide_body_abi_contract.h: 锁定唯一Guide正文caller、尾跳callee、双映像UUID与Qt setter符号。
guide_body_policy.h: 仅把精确Keep going source映射到三语固定短文案；英文与未知输入透传。
guide_body_runtime.inc: 复用同TU gLocale；ABI失败只关投影，未知caller单次调用Qt原setter。
guide_body_contract_test.cpp: 验证Guide caller/source/locale门、单次调用与异常传播。
easing_menu_abi_contract.h: 锁定addEasingMenu的addAction调用窗、Extension与Qt 6.9.2导出。
easing_menu_policy.h: 仅按完整源标签选择三语预设显示文本；拒绝歧义与未知输入。
easing_menu_runtime.inc: 同TU复用gLocale；精确caller才改QAction显示文本，再单次调用原addAction。
easing_menu_contract_test.cpp: vendor-free验证20项表形状、精确匹配、短路、单次转发与异常。
save_scene_caption_abi_contract.h: 锁定2.8 QFileDialog调用窗、QString返回槽与QtWidgets导出。
save_scene_caption_policy.h: 仅按精确caller及Save Scene/Save as .cv原文投影三语caption。
save_scene_caption_runtime.inc: 绑定同bundle QtWidgets；其它caller原参单次转发。
save_scene_caption_contract_test.cpp: QtCore-only合同验证两种原文、三语映射、QString返回、引用寿命与透传。
candidate_static_contract_test.py: 用合成反汇编锁定目标符号边界，并拒绝混合FAT UUID。
macho_bindings.py: 读取候选LLVM Bind/Lazy bind表；按精确符号、库与section校验GOT/interpose槽。
macho_bindings_test.py: 离线验证LLVM列解析、错库、缺slot、flat反例与多合同汇总。
check_help_popup_layout_contract_test.py: 验证arm Popup checker接受arm alias并拒绝x86/generic alias。
native_uuid_slice_selector_contract_test.py: 用双slice双路径顺序fixture验证两构建器按dwarfdump第三字段选UUID；不调用vendor。
check_candidate_contract.py: 核GetPath/FPS来源、ABI与候选LLVM two-level绑定；一次汇总所有必需槽错误。
build_candidate.sh: 核Core/Extension/spdlog ABI；拒绝时打印实值与工具链身份；通过后生成Demo表、编译arm64候选并运行ABI合同。
demo_reader_abi_contract.h: 锁定Core optional<string>结果槽、Extension Preset caller、GOT与返回点。
demo_reader_policy.h: 跨平台纯策略只替换审批位置的JS字面量，optional单次转发不依赖Mach-O ABI；未知locale与源结果保持不变。
demo_reader_source_identity.h: 验证实际原厂脚本SHA，macOS用CommonCrypto、Windows复用宿主Qt摘要；不读路径或语言状态。
demo_reader_runtime.inc: 绑定同bundle Core/Extension与Presets路径；只为唯一菜单caller发布翻译门。
demo_reader_contract_test.cpp: vendor-free验证optional ABI、单次原调用、源门、未知caller与异常边界。
README.md: 说明字体/FPS/Graph/Demo/标题/双保存caption/帮助/Guide/Fast/Easing/Welcome与225槽边界；实机状态见总账。
fast_search_unicode_adapter.mm: 以可执行路径定位同bundle；仅固定Fast C1调用改Unicode选项。
fast_search_unicode_abi_contract.h: 锁定Qt 6.9.2符号、Extension UUID、调用字节、正则与选项。
fast_search_unicode_policy.h: 短路校验caller、原选项与pattern；保留单次原C1透传。
fast_search_unicode_contract_test.cpp: 验证短路、选项、原调用与异常传播；不证明产品加载。
native_image_paths.h: 规范主可执行路径并比较已加载映像路径；生产门和纯合同测试共用。
getpath_font_abi.h: 声明七参 GetPath 原型；保留 x0-x4、s0/s1 及原异常语义。
getpath_font_abi_contract.h: 锁定 GetPath、FPS及Graph MakePath调用窗、owner返回点与Skia ABI。
getpath_font_adapter.inc: 用唯一gLocale选固定lane、Graph空态或FPS前缀，再调用共享字体核心。
getpath_font_policy.h: 定义缓存/FPS/Graph owner、75项lane、512字节上限与精确文本门。
getpath_font_texts.inc: 保存225条固定UI文本；三语lane各75行，原213条逐字节保全。
getpath_graph_editor_empty_texts.inc: 保存catalog批准的三语Graph空态句；与旧225项lane隔离。
getpath_font_texts.81.baseline.inc: 冻结原81条三语lane；新合同逐字节核对旧行前缀。
getpath_font_texts.93.baseline.inc: 冻结扩表前93槽和原31行lane；ToolHelp源合同按固定SHA核前缀。
getpath_mesh_source_contract.py: 核原81槽与四条Mesh源行仍在前缀；不放宽Mesh键或顺序。
getpath_toolhelp_source_contract.py: 核44个批准键、2个旧命中、2组去重及每语40行与4个固定前缀组合。
getpath_font_veneer.S: 精确三指令 veneer；保存 x30/x29 并尾跳 dispatcher。
getpath_owner_adapter.h: 单读帧记录；验证Core→FPS/Graph与Core→cache→producer链。
native_locale_abi_contract.h: 锁定 activeLocale 入口、Extension 调用窗、stub 与 GOT 偏移。
native_locale_adapter.inc: 直接绑定原 getter并核对Extension GOT目标；同bundle路径由共享路径helper提供。
native_locale_snapshot.h: 保存唯一 native locale 快照；原 getter 只调用一次且异常向上传播。
help_description_abi_contract.h: 锁Cavalry 2.8 arm64 main/def caller条件与call字节、同一callee及四string/vector布局；仅+0x00语义已证。
help_description_lookup.h: Mac/Windows共享裸name、精确英文源及三语main/def表选择；不依赖文档对象ABI。
help_description_policy.h: 复用共享查询并保留Mac文档对象逐成员shadow；libc++布局不授Windows准入。
help_description_adapter.inc: 按精确LR选表；source匹配时只复制description并单次转发。
help_description_runtime.inc: 验证双caller机器码并发布两返回PC；复用同一gLocale与原导入。
help_description_veneer.S: 仅比较LR；main/def进入dispatcher，其它caller保寄存器与返回槽尾跳原UI导入。
check_help_description_contract.py: 按帮助入口符号截取13条指令；核双caller分支地址及候选LLVM two-level接线。
help_description_contract_test.cpp: 无Qt/vendor合同；测分表、同名异源、locale、shadow与异常透传。
help_description_veneer_contract_test.cpp: 直链真实veneer；测两未知LR透传及main/def精确LR分流。
help_description_veneer_probe.S: 合成callee记录x0-x8、v0-v7、sp/x29/x30和原返回寄存器。
help_popup_layout_abi_contract.h: 锁定DocumentationPopup唯一activate调用窗、return PC与QtWidgets导出。
help_popup_layout_policy.h: 识别四行结构及401项上限；只激活未显式隐藏的参数/返回行布局。
help_popup_layout_adapter.mm: 仅在精确setContent caller前改布局；未知调用单次透传。
help_popup_layout_contract_test.cpp: 用同bundleQt离线测401项上限、QLabel绘制行界、枚举词完整性与未知结构。
help_popup_layout_sequence_test.inc: 三语核长短参数/返回切换、fresh行几何及隐藏行恢复。
check_help_popup_layout_contract.py: 核精确arm caller、401表、arm popup_abi与候选LLVM Qt绑定；保留全局no-flat门。
title_format_policy.h: 共享Project/Scene字节投影保留名称、分隔符和后缀；Mac兼容入口仍核24字节源对象/借用地址，Windows薄适配另证MSVC空值，不互借ABI。
title_format_abi_contract.h: 默认锁定2.8.0 fmt10标题合同；显式281配置选择arm64 fmt11合同，不新增Intel准入。
title_format_adapter.inc: 复用唯一gLocale与fmt原函数；fmt前快照源对象，原调用后只适配精确LR/format/descriptor。
shared_verified_text_fallback.inc: CoreText首选；仅覆盖拒绝后用三语固定PostScript名创建候选；复用8槽与单次RAII锁。
skia_original_bindings.inc: 直接绑定四个 Skia 原函数并核对已验入口；未知链不准字体替换。
timeline_font_adapter.inc: 验证 Timeline caller 后把完整名称交给共享字体核心。
timeline_mixed_span_utf16.h: 把共享 UTF-8 首缺 scalar 映射为 UTF-16 range。
timeline_owner_observer_abi.h: 声明 Measure/Draw 原 ABI、veneer 与 typed dispatcher。
timeline_owner_observer_arm64.S: 将 closure/return PC 送入两个 Timeline dispatcher，不改原参数。
timeline_owner_observer_contract.h: 锁定 Timeline caller、closure 字段与 arm64 调用窗。
timeline_system_fallback_contract.h: 锁定8个字体槽、factory seed、PostScript上限与 setSize ABI。
timeline_system_fallback_mixed_span_coretext.h: 将已验证缺字位置映射为 CoreText CFRange。
timeline_system_fallback_policy.h: 定义共享字体 key、locale gate、owner/字号门与纯策略。
verified_text_selection.h: 保存三语固定PostScript名并有界选候选；全串覆盖失败才继续，解析错误即停。
viewport_blob_abi.h: 声明 TextBlob 非平凡结果槽及原函数/dispatcher ABI。
viewport_blob_veneer.S: 保留 x0-x3/x8，并传递调用者 x29/x30。
viewport_font_adapter.inc: 验证 Viewport owner 后把完整名称交给共享字体核心。
viewport_owner_snapshot.h: 单读并核验线程栈帧记录；复制有限完整的Viewport名称容器。
welcome_log_it_abi_contract.h: 锁定Extension/spdlog UUID、唯一返回PC、导出地址与message payload偏移。
welcome_log_it_policy.h: 仅匹配裸Welcome或两种精确节日suffix；三语替换前缀并保留suffix。
welcome_log_it_adapter.inc: 先核caller再复制message字节；未知输入原参单次转发。
welcome_log_it_runtime.inc: 核同bundle spdlog原导出与GOT；ABI完整后才发布唯一Welcome caller PC。
welcome_log_it_veneer.S: 构造前门值为零；未知caller直跳同映像原导入桩，精确caller进入dispatcher。
welcome_log_it_contract_test.cpp: 验证三语、完整suffix、同前缀用户文案、单次转发与异常传播。
welcome_log_it_veneer_contract_test.cpp: 验证未知LR直跳旧导入且不读坏message；精确LR只分流一次。
welcome_log_it_veneer_probe.S: 提供两种合成LR调用点，供arm64 veneer合同调用。
welcome_dyld_fixture_contract.h: 声明vendor-free dyld fixture共享快照与构造器状态。
welcome_dyld_fixture_support.cpp: 记录原调用寄存器、errno、dispatcher次数与加载阶段。
welcome_dyld_fixture_spdlog.S: 模拟原log_it_导出；捕获入口寄存器且不读取message。
welcome_dyld_fixture_early_caller.cpp: 依赖构造器先发日志，并记录调用后的errno。
welcome_dyld_fixture_caller.S: 构造坏message与寄存器哨兵；保存LR并恢复调用者栈状态。
welcome_dyld_fixture_interposer.cpp: 声明fixture interpose tuple、零caller门与构造顺序回执。
welcome_dyld_fixture_main.cpp: 断言dyld早期调用单次透传、寄存器/errno原样及门关闭。
welcome_dyld_fixture.sh: 编译红绿动态加载fixture；用冻结unsafe源证明初始abort风险。

依赖边界:
复用父目录 Mach-O 解析器与 2.7 UTF-8 字形纯策略。
本目录不读取产品语言状态，不写运行诊断，不扫描字体候选。
默认发布链不消费本目录。
显式native/debug可编译嵌入已验候选。
preview协调器部署该字节，现场加载另验。
本目录自身不签名、安装或启动App。


## x86_64 机器相

build_x86_64_candidate.sh: 快照源码闭包，核x86构造器、owner与veneer并链接隔离dylib；Popup失败回显原日志，不启动或部署产品。
native_source_manifest_x86_64.py: 从仓库现行native编译闭包生成外部逐文件SHA/字节/模式快照；不读私档或vendor安装。
native_source_manifest_x86_64_contract_test.py: 临时源码树行为合同；验证生成/消费、文件闭包与字节/模式漂移拒绝，不调用vendor或编译器。
check_font_abi_x86_64.py: 逐字节核官方x86字体、Viewport、FPS机器码并输出回执。
check_getpath_cache_x86_64.py: 从官方Core/Extension切片核UUID、调用窗和two-level导入。
check_help_popup_layout_x86_64.py: 用dyld_info核官方UI/QtWidgets x86窗口与GOT；用LLVM核候选Popup QtWidgets和Demo libCore双slot绑定。
check_timeline_owner_observer_x86_64.py: 核官方x86 Timeline字节与builder传入的当前源码manifest，再编译寄存器合同；不回退私档路径。
getpath_cache_x86_64_abi_contract.h: 锁定Core→缓存→ToolHelp/Viewport质量生产者的x86返回点与字节窗。
getpath_cache_x86_64_contract_test.cpp: Rosetta验证双帧owner、错误链拒绝和原函数单次透传。
getpath_font_veneer_x86_64.S: 保留x86调用寄存器并转发GetPath owner。
getpath_fps_x86_64_abi_contract.h: 锁定viewport.fps字面量、格式调用与Extension返回点。
getpath_graph_empty_x86_64_abi_contract.h: 锁定Core/Extension/Skia x86 UUID与Graph双帧调用窗。
help_description_veneer_x86_64.S: 仅分流已审x86帮助caller，未知caller转原函数。
help_popup_layout_x86_64_abi_contract_test.cpp: Rosetta验证Popup精确返回PC、单次应用与未知透传。
native_candidate_architecture.h: 提供arm64与x86官方映像UUID选择；不授函数准入。
native_candidate_architecture_contract_test.cpp: 验证x86官方UUID选择和架构边界。
native_font_factory_bindings.inc: 保存各架构合同验证后的Core/Skia factory指针。
native_font_owner_snapshot.inc: 按x86已验证tag解析短/长字符串；保持ARM读取路径不变。
native_font_x86_64_abi_contract.h: 锁定官方x86地址、Timeline字符串解码与准入透传策略。
native_font_x86_64_abi_contract_test.cpp: Rosetta核四原函数绑定、字体门负例、TextBlob与owner透传。
native_font_x86_64_runtime.inc: 核x86原函数地址、factory及Timeline/Viewport/FPS/cache字节窗。
native_image_runtime_helpers.inc: 为native ABI门提供Frameworks路径和精确导出寻址；不授权功能。
native_locale_x86_64_abi_contract.h: 锁定x86 locale getter、精确owner返回点与导入stub。
timeline_owner_observer_x86_64.S: 保存x86 Timeline寄存器并调用有限observer。
timeline_owner_observer_x86_64_contract.h: 锁定x86 Measure/Draw closure和return-PC字节。
timeline_owner_observer_x86_64_probe.S: 为vendor-free合同提供x86寄存器探针。
timeline_owner_observer_x86_64_veneer_contract_test.cpp: 验证x86 Timeline veneer保持参数、栈与返回值。
viewport_blob_veneer_x86_64.S: 保存x86 TextBlob参数并转发Viewport owner。
viewport_blob_x86_64_abi_contract.h: 锁定x86 getNiceName槽、首个TextBlob sret调用及混合变体拒绝点。
viewport_blob_x86_64_owner_snapshot.h: 从x86 RBP-0xd0读取同一短/长串；指针长度或对象不稳即透传。
welcome_log_it_veneer_x86_64.S: 保存x86日志参数并按窄caller门路由。
x86_64_owner_veneer_contract_test.cpp: 验证x86 veneers的寄存器透传与单次回调。
x86_64_owner_veneer_probe.S: 为x86 owner合同提供合成调用帧。
x86_macho_contract.py: 供x86静态合同复用UUID、符号、字节窗和Mach-O读取原语。

native_font_candidate.mm（2.8.1增量）: 仅显式arm64目标启用NodeView头文字与fmt v11符号；默认2.8.0路径保持原样。
dependency_node_font_policy.h: 识别281两header slots；复用既有UTF8解码器，仅为与完整源串吻合的损坏省略片段求字符边界。
dependency_node_font_adapter.inc: 证明两种NodeView布局、完整源串与caller帧；字体覆盖后仅在同步原调用中修复省略span，模型原文不变。
dependency_node_font_contract_test.cpp: 验证measure/draw取帧与有/无ComplexRoundRectView前项的两种布局；仅准两个header，拒绝composer伪装者。
skia_text_dispatch_281.inc: 仅供CAVALRY_NATIVE_TARGET_281 arm64使用；把两个NodeView header的Measure/Draw接入既有字体核心。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

build_candidate_2_8_1.py：在临时源树使用abi_2_8_1合同与测试构建显式arm64候选；fmt11标题只核C字符串指针，不要求未初始化的第二word；不覆盖280原源或安装App。
build_candidate_2_8_1_test.py：核281 fmt/Viewport/TextBlob输入；编译实际选中的标题suffix判断，验证281允许非零第二word、未知/空指针仍拒绝，280零值合同与原源保留。
check_dependency_node_font_contract.py：对281 NodeView两header定位的符号与调用窗做只读vendor校验。
