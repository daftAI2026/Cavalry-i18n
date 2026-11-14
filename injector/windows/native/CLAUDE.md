# native/
> L2 | 父级: ../CLAUDE.md

Windows 2.8.1窄补充；native strings仍是翻译主干。固定帮助字体已在私人owned进程验证，正式部署/正常首帧/三语回归另验。此目录不编译旧generic显示翻译器。

成员清单
CMakeLists.txt: Qt6.9.2 x64 SDK构建native generic/QPA；共享producer仓外生成帮助、20缓动、五项菜单、100 Demo与批准包摘要；新增producer读取的源码和官方catalog必须同步配置依赖，内容漂移触发重新校验；CTest核平台策略/栈链、真实PE及包边界，不携带Qt。
tool_help_font_policy.h: 只将Windows原厂Alt前缀映射至共享批准的Option/Alt组合做字体准入，显示原字节、其它owner与未知文字保持原路。
tool_help_font_contract_test.cpp: 三语Windows Alt组合的旧拒绝/新准入、源字节保全及未知文本/编码/长度反例；不抵实屏。
plugin.cpp: 仅接QPA显式语言的QGenericPlugin；不读环境、profile或认证，不包含验收helper。
runtime.h: 窄runtime安装与只读诊断边界。
dependency_node_adapter.h: 2.8.1 NodeView直属两行header准入；单次TextView paint借用实际完整串首测选择字体，后续测量/绘制共用并修复UTF8省略边界，不解析闭包或改模型。
dependency_node_contract_test.cpp: 合成MSVC直属/可选/错误owner、坏指针与三语省略片段，锁定每次paint仅选字体一次、测量/绘制一致和原名称不变。
dependency_node_binary_contract_test.cpp: 只读真实281 PE；以RTTI、虚表/paint跳板、成员访问指令和Skia导入证明平台常量，拒绝错映像，不执行vendor代码。
title_adapter.h: 官方2.8.1 updateAppTitle fmt11 descriptor 0xcdd、return 0x1f295a及MSVC x64参数帧证明；共享标题策略只翻标签和真实空值，用户同名字节保全。
help_adapter.h: 官方Windows四string/vector文档布局与main/def caller；共享审批选择，仅description投影，原对象和其它成员保全。
help_contract_test.cpp: Windows 2.8.1文档ABI、双caller三语分表、原像/opaque成员及单次异常传播；不启动宿主。
demo_adapter.h: Core optional<string> 40/32字节ABI；独立准入Create > Demo Scenes Run Preset reader return 0xca5187与OnboardingChoiceView loadDemoScene return 0x87f0b2；两个runGuiScript执行返回位和Import Preset .cvp return 0x4b59d4保持透传，两个合法入口各自核canonical Presets根与文件SHA。
demo_contract_test.cpp: 同一批准脚本/哈希三语覆盖两个互不抵扣的100 Presets入口；拒绝邻近reader、runGuiScript执行返回及Import Preset .cvp caller，并验证漂移、nullopt和原异常单次转发，不执行示例。
demo_binary_contract_test.cpp: 锁ExtensionLayer官方SHA、textFromFile槽及两条独立reader/runGuiScript参数流；对照Import Preset .cvp过滤器与importPreset分支，不加载vendor代码。
welcome_adapter.h: 2.8.1 Windows spdlog log_msg 96字节影子，复用三语Welcome/两精确节日后缀；未知producer不读取消息，原logger只调用一次。
welcome_contract_test.cpp: 合成验证九种Welcome投影、opaque/用户消息保全、坏指针未知caller及原异常单次传播，不抵实屏。
catalog_warning_policy.h: 只匹配动态宿主根下17个官方catalog的所选locale目标缺失消息；英语源、未知插件、跨根和附加正文拒绝。
catalog_warning_adapter.h: 复用Windows log_msg 96字节ABI；Api producer 0x37508、logger return 0x3b1e4、warning级别、完整消息及实际批准包同时命中才省略，否则原参数单次透传。
catalog_warning_pack.h: 只在精确启动warning后按固定Roaming路径有界读取实际包；同版摘要/长度匹配且无reparse才授降噪，不缓存旧证明。
catalog_warning_contract_test.cpp: 153个三语/自定义及Unicode安装根正例，未知caller坏指针、英语源、未知消息、包拒绝与异常透传反例；不抵实屏。
catalog_warning_pack_test.cpp: 实际临时文件的包证明，覆盖完整正例、缺失、内容漂移、错长度、目录与尺寸上界。
title_contract_test.cpp: 隔离帧fixture验证fmt11 descriptor/栈帧、三语真实空值、同名用户数据、分隔符名称、dirty后缀与未知ABI；不接宿主。
viewport_snapshot.h: Windows 2.8.1分段blob只从有序已证父帧读取完整名称；要求caller 0x430bff、parent return 0x40d784与线程栈边界，direct输入留在runtime。
viewport_snapshot_contract_test.cpp: 分段blob仅接受有序双返回位；缺父帧、倒序、相邻位及直接blob拒绝父栈名称读取。
runtime.cpp: 官方同根映像/导出准入、唯一locale及窄显示适配；ToolHelp复用共享字体门并仅补Windows Alt组合。Demo只在内置JS读取caller核动态canonical根、100文件实际源SHA与489位置后复用共享投影，不写脚本。Welcome保持精确启动producer；另接Api独有logger IAT，目标缺失分支+完整17目录消息+固定Roaming实际批准包共同授降噪，英语源缺失及其它日志原样透传。Fast仅在已证filter caller开启Unicode；CAS限已证IAT与TextView paint单槽；节点header共享一次完整源字体选择和UTF8省略，Save/Open精确caption沿共享策略，显示热路径无IO。

scene_dialog_abi_contract.h: 官方281 ExtensionLayer SHA、Qt QFileDialog IAT、精确scene wrapper与Load .cv尾跳调用位；已知预设/导出调用作拒绝样本。
scene_dialog_adapter.h: Save复用共享双caption策略；Open同时要求scene QFileDialog wrapper和Load .cv构造caller，未知caller/source透传。
scene_dialog_contract_test.cpp: 验证Save/Open三语、参数/QString返回、真实预设/导出caller反例、漂移与异常单次转发；不创建对话框。
scene_dialog_binary_contract_test.cpp: 只读官方PE摘要、import表、IAT调用窗、Load .cv构造与尾跳链；不加载vendor DLL。
vendor_pe_contract.h: Demo、scene dialog、NodeView与DG菜单二进制合同共用只读PE/RVA/import/export parser及失败计数；仅测试支持，不加载vendor代码。
dg_menu_abi_contract.h: 官方281 ExtensionLayer SHA、ToolMenu导出/尾跳、五个菜单source caller及QWidget addAction IAT返回位。
dg_menu_adapter.h: 有界栈帧中的ToolMenu返回位与五个helper返回位进入共享source策略；未知项单次透传。
dg_menu_contract_test.cpp: 消费共享生成表，验证五个source/helper、三语投影及坏caller/source/缺栈透传。
dg_menu_binary_contract_test.cpp: 只读官方PE导出、五条直接调用、source构造和QWidget IAT调用窗；不加载vendor DLL。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
