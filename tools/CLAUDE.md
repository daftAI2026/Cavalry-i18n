# tools/
> L2 | 父级: ../CLAUDE.md

成员清单
check_powershell_syntax.ps1: Parser.ParseFile单文件语法driver；只读源码并以退出码报告错误，不执行待验脚本。
windows_native_pack_contract.ps1: Windows合同driver加载真实native pack校验器；只消费临时fixture，不安装软件。
windows_native_pack.ps1: NSIS烟测的production三语资源校验器；显式接收源根与安装根，复用调用方断言，核manifest与payload字节。
windows_native_build.js: Windows默认2.8.0生产包装器；准备官方资源和native DLL，独立Tauri子进程启用production，固定四overlay与显式x64目标，复用provenance三阶段。
windows_native_build.test.js: 注入进程与文件操作验证准备/打包阶段、MSVC与CTest、DLL发布、production隔离及tag参数；不运行原生编译器。
native_windows_catalog_warning_guard.js: Windows DLL构建期复用完整production bundle审批，生成三语包长度/摘要与17官方catalog相对表；沿native_生产者命名进入既有NSIS来源清单，不写宿主/profile/Mac runtime。
native_windows_catalog_warning_guard.test.js: 离线核三语/目录精确投影和preview、不完整、locale/摘要/大小及目录漂移拒绝。
prepare_cavalry_28_windows_ci_inputs.ps1: Windows CI官方输入；按现有target摘要提取MSI到RUNNER_TEMP，aqt准备Qt6.9.2后导出assets/SDK路径，不安装宿主。
prepare_cavalry_28_windows_ci_inputs.test.js: 官方源、既有身份、隔离路径及BOM/CRLF合同；Windows真实解析全部生产PS并拒绝坏续行，不替代实际提取。
check_windows_native_nsis.test.js: 核PS接线与BOM；Windows临时三语包调用真实PS校验器，验证原样通过与manifest/payload漂移拒绝；不执行安装。
check_app_syntax.js: Node短入口按固定清单逐文件执行--check；保留原顺序，不经shell拼接，首个失败返回非零。
check_app_syntax.test.js: 短入口与原218项顺序摘要合同；实际语法错/缺文件验证非零退出和停止后续检查。
cavalry_native_windows_target.json: Windows 2.8.0官方MSI及x64运行时摘要锁；仅宿主准入，译文沿共享native catalog。
acceptance/: 44主项整轮单表；schema2分离源键库存与实屏项，显式迁移保留历史；Python按平台编排，离线自测不启动产品。
generate_demo_reader_tables.js: 构建期将批准示例投影为有限native表；Windows显式CRLF须还原完整批准LF身份后映射实际SHA/偏移，不修改厂商文件。
generate_demo_reader_tables.test.js: 合成UTF-8源验证默认精确准入、显式CRLF偏移映射及BOM/未知字节漂移拒绝，不授官方运行信用。
native_demo_scene_dnt_identities.js: 官方100项示例菜单源身份表，只限定DNT显示例外，不含译文。
native_demo_menu_approval.test.js: 合成catalog验证100菜单三语批准值、完整身份与production profile透传，拒绝越界DNT例外。
native_demo_scene_dnt_exceptions.test.js: 验证DNT默认关闭、逐语审批和身份漂移拒绝，不运行Cavalry。
native_demo_script_translations.test.js: 验证100示例文件的批准文字与位置，保留脚本身份和DNT符号。
native-display-tests/: 项目显示技能的四份标准库离线维护测试；依赖技能脚本与场景，不运行App，不自动加入test:contracts。
native_schema_gap_translations.test.js: 离线源绑定合同；保留365固定行和旧364摘要，验证隐藏Background Rendering独立caption；合成producer完整与单键撤批missing分开守门；不读App或私账。
native_remaining_ui_contract.js: 纯测试共享分区摘要、格式与三语producer守门；单键回退供历史摘要重放。不读私账/App，不进入产品运行时。
native_remaining_ui_final_repair_cases.js: 构建期剩余UI后半分区纯静态回退数据，Global06的112文字槽/6物理键决定、Node A04/A05/A06与B04/B05/B06分别绑定77/98/82/58/52/40个冻结源身份及旧值；不依赖私账，不以数据生成代验批准。
native_remaining_ui_repair_cases.js: 构建期纯静态有限真实修订回退样本，A02/A03/B01/B02/B03/Global04/Global05精确source身份与old/new逐槽共址；测试逻辑不依赖私账，拆分防止多批合同单文件膨胀。
native_graphics_reaudit.test.js: Node本轮88槽/62键有限图形修订、13纠错/377厂商原样及Twist单键译名revision合同；负例锁来源/批准/其他12键，三语真实投影无metadata；不读私账或冒称live。
native_remaining_ui_translations.test.js: Node剩余UI入库主合同；锁十三分区、三语producer及有限旧值回退，继续验证空场景/JS Snippet单键历史摘要；类别提示合同独立文件，不读私账或代表live。
native_messagebar_no_further_revision.test.js: Node单键尾字节合同；核三语真实producer、严格UTF-8反例与原摘要回退。不运行App，不证明live。
native_empty_region_prompt_punctuation.test.js: Node离线空区域提示类别合同；有限锁38个appStrings键/源/三语文字，复算真实native pack producer与六模块旧/新决定摘要；旧值回退只复现历史，不做运行时裁剪或live证明。
native_remaining_ui_tail_translations.test.js: Node剩余UI后半合同；保留A05/A06/B04/B05/B06完整摘要及历史源回退；闭合77官方模块/10278键、Forge8、缺源365固定行+隐藏caption1、插件caption1，共81模块/10653键；target补充373不变，资源补充375，DNT仍195；不读取stage或私账、不代表live。
native_guide_plugin_translations.test.js: Node的15完整Guide/Plugin catalog、396键/1188决定合同；历史批准摘要保持原值，现行三语摘要含Twist单键修订；锁390厂商来源JA中13纠错/377原样、6DNT与真实producer，不代验live。
native_mesh_family_translations.test.js: 官方catalogId+owner双身份选择，不把同owner schema补键反写旧批准分母；Node的六完整mesh-family owner/152键默认源绑定批准合同；锁456决定与真实源身份，完整基线后15旧译回退及21单槽有限语义反例，显示投影不写模型，不依赖stage或live。 合成source fixture保留官方DNT，避免新源绑定门将漏metadata误报为批准漂移。
native_mesh_family_semantic_contract.js: 构建期有限语义合同；源notes绑定Fill All/Count、网格细分与顶点标签、Capture/Flow、剔除与松弛、SkSL边界和当前caption，区分Catmull DNT与Mitchell技术保留，不实现通用NLP。
native_six_owner_translations.test.js: 官方catalogId+owner双身份选择，不把同owner schema补键反写旧批准分母；Node的六完整owner/200键默认审批合同；共享official-target投影仍锁冻结b6官方身份，锁600决定/源/notes/角色/DNT/审批登记，正向基线后36摘要破坏与63单槽反例；合成源同步DNT身份，不代验live。
native_six_owner_semantic_contract.js: 纯测试有限语义合同；引用现行Kerning/Character Spacing/Camera及本域label，约束Falloff概率/视口与计算、父路径垂线/帧模式/圆弧阈值、统计Nominal/柱高、四角入出与Bayer/2.5D保留；不是通用NLP，不参与产品运行时。
native_ten_owner_translations.test.js: 官方catalogId+owner双身份选择，不把同owner schema补键反写旧批准分母；Node的十完整owner/201键合同；共享official-target投影保留冻结b6源身份，603现行源绑定决定与历史批准摘要分开锁定；全201基线后30摘要变异及58有限反例/39旧译回退，只投影display、不依赖私账或通用NLP。
native_ten_owner_semantic_contract.js: 纯测试合同；以既有Auto Animate显示词约束Stagger引用，按source-notes绑定通用宽度渐变、沿路径移动与仅未设置材质时替换的已审caption，双端渐细独立守边界；共享正向guard与单槽真实旧译反例，改译须重新审定，不进入产品运行时。
native_resource_bundle.js: 构建期生成三语native包；默认development-preview，显式production-2.8要求10848键完整。两模式复用审批与payload；freshness核源摘要，缺译或profile不符拒绝。
native_resource_bundle.test.js: 纯生成合同覆盖DNT、vendor优先与补充源；另锁生产完整度、计数一致性、资源overlay及2.8.0独立endpoint。
prepare_cavalry_28_ci_inputs.sh: 仅被显式2.8.0 macOS矩阵调用；按arm64/x86_64 runner与target下载并校验官方Cavalry/Qt字节，在runner隔离目录生成production包和同架构dylib；仅成功后写入GitHub环境。
prepare_native_qt_headers.py: 验证官方Qt6.9.2 qtbase归档SHA与长度；兼容include与framework Versions/A/Headers布局，将三个模块归一到include前缀，只复制公开头文件。
prepare_native_qt_headers.test.py: 标准库路径合同与可选锁定py7zr的合成7z输入；验证framework成员映射、私有版本目录排除及旧include兼容，不读取网络或Qt运行库。
check_native_28_ci_input_contract.js: YAML解析同SHA源码前置条件，mock双架构下载/构建边界；验证Rust测试仅用TAURI_CONFIG清空打包资源、CI分派与已授权2.8.0三平台生产发布闭包，并调用native源码manifest临时树合同核生成/消费及漂移拒绝，不运行vendor或GitHub Actions。
native_schema_supplement.js: 2.8.0 nodeDefinitions原始SHA、Forge owner父链、八字段完整schema及Inspector顺序的source-only投影；固定catalogId/source notes与dontTranslate=false、补充target字段及官方键碰撞门，不生成locale译文、不扩展任意ID。
native_schema_supplement.test.js: 合成nodeDefinitions边界合同；验证8个owner/ID/fallback source及显式DNT=false、父链/schema/UI顺序/重复身份/官方碰撞和原始字节摘要拒绝，不依赖安装、App或profile。
native_schema_gap_sources.js: SHA锁定的2.8.0 nodeDefinitions adapter；历史365源行摘要不变，额外输出隐藏Background Rendering行，当前投影366；固定行继续校验父链/schema/Inspector顺序，隐藏字段另校验hide=true、无UI自有字段、bool/default及碰撞；不装配审批或运行时。
native_plugin_caption_supplement.js: 构建期SHA锁Directional Blur definitions原始字节；只输出amount一条source row并校验owner/schema/Inspector顺序及官方键碰撞，不读取target sourceFiles、不进入运行时。
native_plugin_caption_supplement.test.js: 合成验证Directional Blur身份与schema、raw SHA拒绝门、单键三语producer投影和missing；不嵌入厂商definition字节，真实raw正例由assets-root验收，不代验实机消费。
native_schema_gap_sources.test.js: 固定365 tuple摘要与当前366源行投影合同；合成根/继承/list/compound及隐藏bool定义，覆盖schema漂移、hide/UI漂移、官方/Forge碰撞与metadata拒绝；不证明live/审批。
native_official_target.js: 精确投影target官方字段；target仍锁Forge8+固定缺源365=373，隐藏Background Rendering与插件caption均在target外独立计数，不改变baseline摘要。
native_official_target.test.js: source/provenance共用target合同；冻结官方摘要正例，验证runtime/catalog/native count/安装身份变异失败，并证明补充count/path/hash单独失败且未知字段不被忽略。
native_user_scope_copy.test.js: 四语 userProfile copy与badge状态投影合同；锁定p12正常待机、真实资源故障恢复提示及unset/explicit共用English标签与当前语言ARIA、显式/Unknown/legacy分流和默认语言不授予hostless Restore；读取user-profile-text→ui-text组合，不代替浏览器布局或现场可见性验收。
cavalry_native_target.json: 2.8.0 host/17个official catalog与原厂源身份锁；target保持10473官方键、Forge8及固定缺源365=补充373；隐藏caption1和插件caption1仅在资源manifest独立计数，不改target/baseline原字节。
native_observed_ui_translations.test.js: Node 的 CUA 现场遗漏键入库合同；锁定 42 app 键与 drawable 不透明度、完整 catalog 身份、Auto 推荐限定词、9 DNT、三语格式与厂商日语优先，混合包投影保护模型身份，离线通过不代替现场重验。
native_sound_translations.test.js: Node 的 Sound 整域 65 键审批合同；绑定官方 source/notes/角色摘要、三语显式决策、Mel/Bark/RMS 技术保留、分析阈值与声像/采样/计权关系、11枚举索引及反向变异、当前标签引用；缺模块/原草稿真实失败，离线通过不代表 Sound live 验收。
native_sound_legacy_translations.test.js: Node 的 Sound Legacy 整域48键入库合同；绑定旧场景说明与独有最大dB、两项技术保留、七类关系及真实反向变异、标签引用/显示身份和厂商日语优先；入库前缺模块为RED，不将新版Sound或离线审批作旧场景行为证明。
native_rgb_split_translations.test.js: Node 的 RGB Split 完整35键/105译值审批合同；锁定源对/notes/role/provenance、RGB偏移、镜头半径与Padding边界、重复距离与次数、One/Two/Zero预设及16个命名混合模式，含真实反向变异；stage输入仅用于只读红绿核验，不代表实机显示。
native_slit_scan_translations.test.js: Node 的 Slit Scan 48键/144译值默认合同；锁定完整owner/source/notes/角色与provenance、base/Glow混合模式引用、Mirror Scan 原标签及非整图翻转/循环算法过度承诺边界、ICU/富文本格式、模型身份投影和真实反向变异；正式模块缺失先RED，stage仅对root绑定草稿RED/审定候选GREEN，不代表实机显示。
native_align_distortion_glow_translations.test.js: 官方catalogId+owner双身份选择，不把同owner schema补键反写旧批准分母；Node的三完整owner/100键默认审批合同；锁定官方source/notes/身份、300决策、对齐方向/HSV/RGB/半径强度/预览/Xor/Porter-Duff与18共享模式，22个实际修订逐一原稿回退变异；缺模块先真实RED，stage诊断不代表正式入库或live。
native_array_distribution_translations.test.js: Node 的 Array完整4键/12值默认合同；锁定官方source/notes/身份摘要、手工坐标列表/计数方向/序列索引与三语审定文字，12个实际译值反向变异保护Array非网格和日语配置语法；正式模块缺失真实RED，source-only stage不代表审批或live。
native_auto_animate_translations.test.js: Node 离线 autoAnimate 128 叶入库合同；锁定 owner/source/notes 与稳定键摘要、三语格式、当前进度模式/层级标签引用、相机变焦/几何缩放与可逆进退场、显示投影不写模型身份和厂商日语优先，先RED后入库，不调用服务或App。
native_metadata_reuse.js: Node 的已审帮助复用与表装配器；复用478条SHA审批和34条source-bound补译，拒绝缺项/源漂移，输出384 main与17 def根表。
native_metadata_reuse.test.js: Node 的纯复用/帮助表合同；锁哈希、补译闭合、分表输出与synthetic边界，环境指定时校验384/17/111分账。
build_native_help_description_table.js: 从SHA锁定的四份2.8.0 MetaData与source-bound审定仓外生成跨平台384/17说明表、独立401根排版表及回执；说明字节不变，ABI由消费者承担。
build_native_help_description_table.test.js: Node生成器合同；锁UTF-8转义、仓外输出、384/17说明与401根排版分表，不授live信用。
native_easing_display_data.js: 构建期内置缓动显示源；15项root批准译文仅作显示，五项复用既有native键，不进官方catalog或包统计。
build_native_easing_display_table.js: 校验20项内置身份与现有源键；接受Windows跨卷仓外输出，生成同源C++表，不接runtime。
native_easing_display.test.js: Node纯合同；锁20项身份/源唯一、五项native复用、三语闭合、C++转义与仓外输出，不授live信用。 Windows path.win32合同区分仓内、同卷仓外与跨卷临时目录。
native_help_popup_rows.js: 构建期纯投影；复用稳定根键，保留main/def同名项，按原厂格式输出type/name/参数/返回文字，不含说明或像素宽。
native_help_popup_rows.test.js: Node纯合同；锁可选参数富文本、默认值不显示、返回顶层键排序和根范围；不读App或私档。
native_translation_inventory.js: Node 的全量纯队列编排器；组合官方 source/日语 catalog 与旧 JSON/TS 候选，按 registry key 排序，dontTranslate 与厂商日语优先，候选分类不代表审定或完成。
native_translation_inventory.test.js: Node 的离线全量队列合同；锁定来源清单、跨 catalog 撞键、未映射叶、同源多键和互斥三语计数，期望文件清单仍由调用方核对。
native_translation_candidates.js: Node 的旧译纯索引；从已知 JSON 显示角色及 TS 提取精确英语候选和来源，保留歧义，不以规范化匹配或模型身份自动批准复用。
native_translation_candidates.test.js: Node 的旧译角色/身份合同；覆盖稳定 owner、数组重排、显示专用来源、重复身份隔离、空译及多义同源，不把单候选当翻译通过。
native_translation_format.js: Node 的构建期格式门；使用固定 FormatJS ICU AST 比对参数、分支、offset、逐分支 #，另保留旧占位符与 HTML 技术属性，不引入运行时解释器。
native_translation_format.test.js: Node 的合成格式合同；验证 ICU 语法/语义、参数新增删除、legacy tokens、HTML 属性字节和 Unicode，不能证明原厂 ICU 求值或界面布局。
native_metadata_help.js: Node 的脚本帮助纯投影/表生产器；按稳定键验source绑定，分别输出已审非def/def根name、英文源与三语译文，不走UI ICU门。
native_metadata_help.test.js: Node的metadata根表合同；覆盖排序、跨表同名隔离、def同表重复、未知namespace、source漂移和缺译拒绝。
native_translation_reviews.test.js: Node 的补译入库合同；核验 UI/形状/OpenType/累加渲染与帮助说明的完整源绑定、三语决策、格式/代码/标签引用和显示投影，锁定字形访问而非全选、基字相对位置/字母匹配及源纠错/字符串缩短/自动宽度条件；首批九条不是范围上限。
project_translation_skill.test.js: Node 的项目级翻译技能配置合同；验证可发现元数据、上游及安装摘要、Markdown 依赖与 EXTEND 四语词表路径，不发翻译请求、不承担产品运行时。
native_language_pack.js: Node构建期纯投影；按实体/字段路径收集显示键，DNT保持强身份、日语默认vendor优先；只有带root批准及完整source/notes/原JA/新译摘要的精确key纠错可覆盖，vendor-corrected内部状态不泄露到UI-text，不读安装或写用户目录。
native_language_pack.test.js: Node 的 2.8.0 native-first TDD 合同；锁定稳定键与命名空间、DNT强身份边界和默认vendor优先；有限厂商纠错必须绑定key/catalog/owner/fieldPath/source/notes/原JA及root批准，跨语种/上下文漂移拒绝，确定性输出不代替真实语义和实机验收。
check_macos_timeline_font.test.js: Node 驱动 vendor-free 原生字体策略回归，编译并验证完整名称覆盖、UTF-8 边界与 borrowed 字体字节保真。
macos_timeline_font_fixture.cpp: C++ mock 字体覆盖差异和重复调用回归；不冒充私有 ABI 或实机字形证明。
check_macos_quick_add_category.test.js: 同时比对完整 injector fixture 与生产构建的适配器编译输入，防止链接遗漏； 锁定 Mac 类别 getter 的双架构机器码、编译器 QString 返回 ABI、exact owner 与共享映像门，不冒充实机。
quick_add_placeholder_fixture.cpp / check_quick_add_placeholder.sh: Qt vendor-free 空结果显示合同，锁定三语、exact Classic owner、viewport、重复 Paint 幂等与原厂英文重写恢复；不替代平台 ABI 或实机。
classic_rank_contract_fixture.cpp: Qt 6.6.3 合成评分器与既有 Classic 搜索共同挂接，验证三语完整/前缀标题排序、UTF-8 长度与三语界面英文回退、分数归还、碰撞、独立 detach 与 1000 次生命周期；不冒充原厂 ABI 或实机证据。
check_classic_rank_contract.sh: macOS 隔离编译运行共享评分 fixture，固定 Qt 6.6.3 与 QT_NO_KEYWORDS，可选 ASan/UBSan，不启动 Cavalry。
post_release_reactions.js: 已公开 Release 的六种正向反馈与分页回读；默认使用 2.7 profile，显式 profile 可为已公开的2.8.0 Release补 reactions；GitHub 按账号幂等，拒绝 draft/prerelease，不触碰资产。
post_release_reactions.test.js: 注入式 GitHub API 离线合同，验证六种 reaction、重复调用、默认/显式 profile tag 约束、公开状态前置条件与回读失败。
check_quick_add_display_tags.h: Fast 显示 fixture 的独立标签片段，验证原厂显示别名、paint/sizeHint 一致投影及源分类/创建身份保真，覆盖短字符串与大块堆存储边界。

check_macos_selection_values.sh: 本地原生 fixture 构建入口，显式接收 Qt SDK/vendor Frameworks、链接 Classic 评分 ABI 适配器，只读链接 libskia 并强制 SDK 单套 Qt/offscreen plugin，保留测试退出码。
check_macos_selection_values.mm: Qt 原生选择值 fixture，直调 macOS 生产翻译入口并验证三语普通 QLineEdit、只读切换、Combo/编辑器/自定义弹出列表；实际值、信号与 Paint 不污染业务值，placeholder 仍翻译；只读链接显式 vendor Frameworks，不启动或修改真实 Cavalry。
check_selection_value_contract.test.js: 按实际runtime核对Mac输入策略与Windows native字体源码指纹； 同时锁定共享 Quick Add context 的双平台源码闭包； CI-safe 选择值保护接线合同，冻结双平台共享输入策略的 Combo/编辑器/弹出列表覆盖与 QLineEdit placeholder-only/实际名称查询值原文边界（含只读、parentless/重挂接），与原生 fixture 分层验收。
check_macos_quick_add_inputs.sh: 本地 macOS Quick Add 搜索输入合同 runner；只读链接 Qt 6.6.3/vendor Frameworks，链接 Classic 评分 ABI 适配器，绿色运行生产搜索 guard，红测仅在临时生产源码副本恢复 QLineEdit 实际值 `setText` 污染后预期失败。
check_macos_quick_add_inputs.mm: 覆盖预填充 parentless 补全输入及 owner 建立前的回调； Qt 原生 Quick Add 搜索输入 fixture；以 moc 生成精确 `QuickAddWindow`/`cavalry::FastQuickAddWindow`、`CompleterLineEdit`/`SearchBar`/`Widget` 父系，直调生产显示、callback 与 Paint 路径并验证三语完整/部分/大小写/CJK/清空 query 与 placeholder 分层，不启动或修改真实 Cavalry。
check_quick_add_search.cpp: Qt 6.6.3 vendor-free FastQuickAdd model/view 合同；以可控 owner/model fixture 证明精确 FastQuickAddModel 下三语 role 257 alias 投影与内侧 Unicode code-point subsequence filter 不污染 role 0/256 与其他角色，并保留 vendor role 0/257 fuzzy subsequence 命中（含 Behaviour Mixer），覆盖视频词条 Text/Shape/Box/Circle、任意新条目、多词别名、大小写/标点/组合字符/clear、分类多实例、动态插入删除、源替换、幂等挂接、原始搜索框接线、拒绝任意 Qt 列表及 view/filter 双向析构、旧 filter 复用与 QObject 生命周期，不冒充真实 Cavalry UI 证据；搜索上下文 guard 来自窄 `injector/cavalry_i18n_quick_add_context.h`。
check_quick_add_search.sh: 本地 Quick Add 搜索合同 runner；从 `CAVALRY_QT_PREFIX` 或仓库 `qt_sdk/6.6.3/macos` 选择 SDK，先以 `qmake -query QT_VERSION` 验证 6.6.3，再在临时目录运行 moc/clang++ fixture，不读取或修改真实 Cavalry.app；编译闭包包含共享 Quick Add context。 共享 Fast 搜索合同与 Windows 产品统一使用 QT_NO_KEYWORDS，防止本地默认 Qt 宏掩盖编译兼容性问题。
check_quick_add_display.cpp: 双平台 vendor-free Quick Add 显示副本合同，Windows CTest 使用 QT_NO_KEYWORDS 并单独编译尺寸/对齐负例；以 exact `FastQuickAddModel`/`FastQuickAddDelegate` 复现已读证 Qt 6.6.3 `FastQuickAddItem` 128/8 布局，验证 vendor/version/type/size/alignment/title fail-open、仅绘制副本标题/类别投影、未知 model/role/index 透传、paint/sizeHint shadow、编辑/help/commit 原 index、model replacement 首绘、英文回退、幂等 wrapper 与 delegate 生命周期。
check_quick_add_display.sh: 本地 Quick Add 显示 ABI 合同 runner；从 `CAVALRY_QT_PREFIX` 或仓库 Qt 6.6.3 macOS SDK 选择 qmake/moc，在隔离临时目录编译并运行 fake fixture 及 size/alignment 负例，不加载、读取或修改真实 Cavalry.app。
generate_quick_add_descriptions.js: 从四语 `nodeStrings.json` 的 nodeInfo 与插件 layerInfo 按稳定相对路径/字段/类型生成独立 Quick Add 描述反向索引，保留英文原文输入与多值碰撞，不写入通用翻译 fallback。
generate_quick_add_descriptions.test.js: Quick Add 描述生成器合同，验证 English 与三语 JSON 同构、确定性输出、转义和缺失/额外键 fail-closed。
check_classic_quick_add_search.cpp: Qt 6.6.3 vendor-free Classic QuickAddWindow/ListWidget 合同；证明 U+FFFE role0 source 与 query-dependent 标题/英文说明 token 投影、exact search-box guard、独立 itemWidget 标题与说明显示层、多语言 Text/Shape/Box 与 Circle 负例、native filter/no-results、ASCII cleanup 与 `ab`/`ba`/`aa` 顺序匹配、16 项多语言同 locale 原文/挂接后升降序与自动排序矩阵、source-only 比较器/非嵌套 layout 探针及持久选择身份、延后 itemWidget、动态插入删除排序/reset、幂等及标准 Qt DisplayRole MIME 结果，不冒充 vendor command/custom MIME 真人证据；macOS 已由本地 SDK 验证，Windows 必须由同一 fixture 的 CTest 执行且失败即阻断，待 native CI/live 取得 vendor 证据；搜索框 guard 来自窄 shared context。
check_classic_quick_add_search.sh: 本地 Classic Quick Add 搜索合同 runner；从 `CAVALRY_QT_PREFIX` 或仓库 `qt_sdk/6.6.3/macos` 选择 SDK，先以 `qmake -query QT_VERSION` 验证 6.6.3，再在隔离临时目录运行 moc/clang++ fixture 及 原生 source-only 同 locale 排序矩阵，不读取或修改真实 Cavalry.app；编译闭包包含共享 Quick Add context。
test_temp_dir.js: 合同测试 fixture 的临时目录所有权边界；仅创建并清理本进程在 os.tmpdir 直接子级、固定前缀且无 symlink/reparse 的注册目录
windows-acceptance/: Windows x64 Cavalry 2.7.2 release acceptance contract/producer; Rust live tests emit the TEMP machine record only after the runtime source DLL bytes match the final NSIS inputs, the interactive reviewer only confirms existing screenshots and derives review/final records, and the producer verifies final NSIS/provenance, generic/QPA DLL identities, live inventory, exact PID/HWND matrix, tag/source/session bindings before deriving a portable release summary.
check_app_contracts.js: output只保留稳定规则，派生报告不作fixture；打包与source artifact隔离门。QLabel fallback 断言按函数边界而非固定字符距离定位，允许精确类别 getter 分流但不丢普通标签路径； Tauri-only Node 合同测试；在既有跨平台/翻译/打包边界上，定向锁定 macOS/Windows Assets 瞬态 owner、Tag/Tracking 负边界、Add Layer 具体快捷键隔离、Scene Statistics 同窗 Update 三语值、Transform 五 action ABI 防火墙、Guide 固定 `en` 加载槽位与所有 JSON `type:font` 默认字体选择身份，不承载现场证据编排。
path_display.test.js: Node 的安装位置显示纯组件合同；验证默认候选列表走 PathDisplay 结构化投影、逐路径复用截断并保留完整 aria-label，app 不把路径插入本地化 label，VM按 user-profile-text→ui-text加载且隔离普通提示/已选安装路径，不访问 Cavalry。
check_renderer_contract.js: Renderer 静态与隔离 VM 合同，冻结 token 单向依赖、模块化 UI_TEXT 脚本顺序/四语字典合并、平台 chrome、DOM 锚点、Select/Tooltip/AlertDialog/Toast、About与主窗footer共享图标源；主窗相对顺序为 Toast→固定外链适配器→footer→app，About 为 Toast→固定外链适配器→About 控制器；支持文案和无障碍名称四语闭合；About Twitter/X 与小红书按「关注+图标」双列、GitHub/License全宽、Simple Icons CC0图标指纹与固定 project-link ID，外链失败复用外围 Toast 且不接收裸URL；主窗57px单行footer独立视觉层保持原444px内容轨；Windows caption、scope与恢复策略；锁定userProfile普通Switch直达事务、仅Restore确认、原厂English/Japanese与unknown+owned zh-Hans徽章矩阵及不按locale推断来源、版本门控、报告入口、权限 handoff、Updater、CSP 和本机视觉边界。
check_operation_log_runtime.js: 任务反馈专属运行时合同，以最小 DOM/时钟执行真实 icons/operation-log 源，隔离验证 Marker 稳定原位更新、下一帧真实行高收敛后的 live-edge、首尾固定轨道改变中段高度后的溢出与起止边缘回算、快事件可读串行、结果排队和错误立即抢占，不重复 bridge 业务 fixture。
check_tauri_bridge_runtime.js: 锁旧宿主四语不支持短提示与2.7.2专用p12入口；fake-DOM Tauri bridge 运行合同执行真实 bridge、user-profile-text→ui-text、language-scope/version-guidance和app源；锁 camelCase DTO、nativeLocale三态投影、四语 Official 对原厂English/Japanese显示与unknown+owned zh-Hans隐藏（不按locale推断来源）、不预选与Restore ownership门，及普通userProfile Switch不显示确认且立即apply、Restore仍确认、installation/native user事务、失败恢复、权限、Updater、主窗单行footer四语文案/title/无障碍名称与GitHub/X/小红书固定ID；About验证共享图标、「关注+图标」顺序、平台区分的四语名称与固定ID、拒绝裸URL和局部Toast，不虚称WebView/CSP/Tauri shell。
ui_review_workspace.js: localhost UI Review 的纯导航壳；侧栏切换真实主窗口/400×541主窗（原444px内容+57px单行footer）；320×354 且 Chrome 覆盖完整画布的无重复视觉标题 About、反馈/图标/徽章总览及权限交接页，只拥有 fixture/locale 路由与主/About 审查窗口外框；普通验证失败场景单独展示报告入口，typed Cavalry 仍运行保留独立错误场景；handoff 占满可用 stage，不再套用会压缩原型的假窗口；revision 变化重载整个工作台以同步父级 CSS、目录和 renderer，而不是只刷新 iframe，并兼容转发独立 handoff renderer。
ui_review_permission_handoff.js: clean-room macOS App Management 权限 handoff 的结构/样式层；以内嵌真实 `permissionMac` renderer iframe 为源、匿名 DOM mock 为系统设置目标，复用生产 tokens/Button/语义图标/应用标识，以 604px 舞台完整容纳 400×541 source、484px 设置目标与 532×112px 参考同形 helper；helper 固定“项目箭头 + 单行 Drag 指令 / Phosphor Back + 单行 App row”，外层只模拟 accessory 自有半透明材质，拖拽快照显式清除 row 背景与边框；底部并列不入库的本机截图、仅供核对提示箭头的私有 Raster 与项目自绘候选；落稳后的 App 权限项与有状态已有行开关只审查 HTML 视觉连续性，控制区分别显露同进程 oracle、Later 与 Quit & Reopen fresh-session，不复制生产 Dialog、第三方私有资产或冒充原生 AppKit 实现。
ui_review_permission_handoff_runtime.js: 权限 handoff 原型的浏览器行为层；将 typed 拒绝→打开/定位设置→单次 50pt 弧线与双图交叉→参考同形 live helper 接管/项目自绘箭头提示→整条 App row 的透明底 DOM snapshot drag image 向整个 System Settings 区域发起 file URL copy drop→系统行视觉更新→fixture 经真实 renderer 运行一次同进程 oracle 分开建模；正向可来自瞬时 Alert 或持久 Activity，helper 的显式 Back 会重新捕获持久 Activity 动作并 reverse，drop/已有行才进入真实 oracle，成功、仍拒绝或其他错误都直接 cleanup；Later 保留生产 Activity 中的“重新打开语言切换器”阻断，Quit & Reopen 则只投影为不续跑旧任务的普通新会话，不能冒充系统已成功重开；显式重置会重载同一生产 renderer fixture，并在新 document 重新出现真实权限动作前关闭交接入口，避免旧状态或导航竞态污染下一轮审查；正向开始后冻结 forward source，Back 前刷新 Activity return target；source 缺失与系统 Reduce Motion 走静态 helper，renderer 变化与舞台重排只刷新 target；所有 DOM 视觉、单屏 CSS 几何、HTML 拖放与 fixture 结果仅是 UI Review 证据，不冒充 NSImage/NSPanel/NSDraggingSession、多屏 backing-scale、真实系统退出重开或 native 授权。
ui_review_permission_handoff_session.js: 权限 handoff 原型的 session 生命周期片段；只生成 Quit & Reopen fresh-session iframe 投影与显式 reset 函数，复用 runtime 的状态/视觉 owner，不复制几何、拖拽或业务 fixture，也不把浏览器文档重载冒充 macOS 进程重开。
ui_review_server.js: 补丁 fixture 明确区分 current/updateAvailable/unknown/notApplicable，重应用成功收敛到 current、结构拒绝保留旧状态且不虚构生产错误码；localhost UI Review 编排入口；About link failure fixture 点击小红书入口并覆盖双列社交链接布局；`notFound` fixture 提供两条固定默认候选以视觉核验独立 label、逐路径截断及固定单行几何；四个闭合 `nativeUnknown`/`nativeResourceUnavailable`/`nativeRecoveryNoResources`/`nativeLegacyRelease` userProfile URL fixture 审查 2.8.0 Unknown、缺资源/恢复门与 2.7.2 固定旧版入口；新增 `nativeDefaultEnglish` unset+en/unknown、`nativeOfficialDefaultEnglish` unset+en/official、`nativeOwnedHans` explicit+zh-Hans/unknown 三种 2.8.0 userProfile 来源/语言分离 fixture，全部资源可用且不伪造 officialRecovery 或 English Restore 权限；官方来源仅由fake backend投影给出，owned zh-Hans保持unknown；另有 `nativeRestoreOnly` owned-hostless 与 `nativeRestoreOnlyHostFailure` 同版本宿主探测失败 fixture，以真实 renderer/fake bridge 核验有权用户级英文恢复不受安装路径/资源可用性门误挡、host probe失败后的状态仍为 unknown、只读探测失败不伪造成 Channel error、三阶段均保留实际完成事件且不假造 restart、最终“未验证兼容安装/未启动”结果语义；每次请求直接读取真实 renderer 并失效工作台/handoff/catalogs/session 模块缓存，600ms revision 同时覆盖生产 renderer 与五个审查模块以自动刷新当前 iframe；只在 frozen bridge 前注入 fake API，以不含审查占位更新说明的场景 fixture 驱动未找到/官方/翻译/Managed Legacy/旧新版本/重装、普通 verify 失败报告入口、typed Cavalry 运行中错误、更新 Tooltip、AlertDialog、Toast 及 Switch/Restore English/Update 流程，并以固定同源消息让 handoff 审查页把三种注入结论跑进同一真实 Activity；权限场景在 `applyTransaction` commit 后、进入 `restartCavalry` 前发送 success-settled 控制消息，供 review cleanup 使用但不新增生产 Activity 事件；`/handoff` 只提供匿名 clean-room 原型，三个固定 `/local-reference/` 路由从临时目录或显式 `CAVALRY_UI_REVIEW_REFERENCE_ROOT` 只读取落稳 helper、箭头与系统行且缺失即 404，不伪造 native/package 证据。
ui_review_catalogs.js: UI Review 三类动态总览；从生产 tokens/styles 与 user-profile-text→ui-text 字典加载顺序读取四语反馈文案、语义图标和 Badge 状态，不维护第二套产品视觉资产。
classify_ci_changes.js: GitHub Actions 变更风险分类器；Windows catalog guard生成器精确归属Windows门，近似未知路径仍fail-closed；项目技能Markdown只走文档门，技能脚本仍按未知源码全门；以 PR merge-base、push before/head 或事件强制策略投影 documentation/source/vulnerability/windows/macOS-injector 门，未知源码路径和不可解析 diff 均 fail-closed，tag/workflow_dispatch 永远跑完整闭环；共享 Quick Add 顶部标签与显示适配器、Classic 评分、描述输入/策略与生成表进入双平台 native 门。
classify_ci_changes.test.js: CI 风险分类器离线合同；覆盖Windows catalog guard单文件/混合变更/近似未知路径边界；覆盖技能Markdown/脚本/混合原生/tag边界、纯文档、合同/SOP、Windows、macOS、共享翻译表及翻译/输入/Quick Add 顶部标签/显示/搜索/Classic 搜索与评分策略的逐文件双平台门、macOS-only 原生源码、依赖/workflow、定时漏洞复审、空 diff 与未知源码/自动化路径边界。
check_tauri_build_sop.js: NSIS夹具读取真实production overlay与安装语言配置，验证三语包、源变更、语言文件漂移及完整prepare/record/verify； 2.8.0 ARM/Intel与Windows native生产入口合同；核共同production及Windows资源overlay，拒过期未实现声明；保留统一latest.json、p12历史资产、三平台发布guard及既有配置/provenance合同。injector检查与镜像记录均固定macos-15。
check_tauri_packaged_app.js: 最终App资源验收；production-2.8按显式arm64/x86_64目标核App架构、架构中立manifest/三payload、同架构runtime内嵌与renderer字节闭包。默认仍选arm64；不把SKIP当生产通过。
packaged_native_resources.js: 纯文件校验production包与构建输入一致；按显式目标架构将runtime Mach-O切片绑定可执行文件，manifest保持架构中立；不启动App。
packaged_native_resources.test.js: 临时fixture验证资源manifest中立性、arm64/x86_64 runtime正反例、错误profile/缺译/字节漂移与错误目标架构。
windows_nsis_provenance_contract.js: Windows NSIS provenance 跨边界结构真相层；从 machine-readable schema 读取唯一版本、目标与 required keys，向 producer 提供文档构造器、向 producer/verifier 提供同一 fail-closed 结构校验，但不替代双方对真实文件与哈希的独立复验。
windows_nsis_provenance.js: 与默认wrapper共用四份2.8.0配置；指纹绑定native三语包、原生源码、译文、两DLL及配置的NSIS语言文件；通过共享 contract 生成 schema v2 sidecar，intent 区分普通构建与 tag updater 构建，前者拒绝任意 `.exe.sig`，后者要求并绑定 exact base64 signature；只清本版本受控 EXE/provenance/signature，拒绝外国输出，并对 renderer/languages/Tauri/updater overlay/Rust/native/shared translation+input+Quick Add context+tabs+display+search+Classic search/rank+Quick Add 描述 policy/JSON/generated table/generic/QPA 复算 fingerprint。
check_windows_nsis_install.ps1: 核对生成输入与已安装的2.8.0 production manifest/三语pack；带 UTF-8 BOM 的 Windows x64 NSIS 安装态守门器；先以 `windows_nsis_provenance.js` 复算显式 `x86_64-pc-windows-msvc` target 的唯一 EXE/sidecar，再在固定 HKCU/快捷方式冲突即失败的前提下于唯一随机 `%TEMP%` 根静默安装、以同一安装器执行 `/UPDATE`、仅通过包内卸载器静默卸载并观察零残留；三阶段都要求独立 TEMP 根中 `qwindows.dll`、vendor backup 与 manifest 的长度/SHA-256 哨兵不变，漂移时保留证据，禁止递归删除掩盖失败。
capture_windows_pid_window.ps1: 带 UTF-8 BOM 的 Windows disposable live-smoke GUI 证据 helper；先验 `%TEMP%` sentinel clone/evidence、无 reparse 路径链与精确 PID，自动截取 Viewport Quality/Transform 且 Transform 必须同时命中 action 与三条长操作前缀的 64 位位图，并在有界 exact-HWND 前台获取重试中以 `VK_A` 触发 Edit Shape，键投递前由 helper 再复核 HWND/PID；Onboarding 只接受 runtime 发布的非零十进制 HWND，复核可见、未 cloaked 且属于 exact PID 后直接截图；Adjacent 正式 gate 由 producer-side Qt grab 封存瞬态 PNG，本 helper 的 exact-HWND screen-copy 只保留为诊断回退；Close 向 exact PID 全部顶层 HWND 投递 WM_CLOSE，ForceStop 只在超时且再次复核同 executable/PID 后用于 disposable child 清理，不参与 PASS；按键后的同 PID 子窗/模态窗焦点变化不再被误判为失败，禁止盲键确认、场景脚本、Qt UIA、坐标/鼠标自动化、固定 sleep 和覆盖证据。
check_dmg_layout.sh: DMG 身份、布局与签名守门器；挂载真实镜像并从 `.DS_Store` 锁定 800×476 Finder frame、400px 左锚和非正 AppKit bottom-origin，确保首次打开由 Finder 约束到当前可见底边；同时验证卷标、背景、卷宗图标、Applications 链接及 DMG/安装态 bundle seal。
window_contract_lib.js: 窗口回归公共库，封装 AX 权限探测、精确 PID 绑定的窗口枚举/聚焦/resize/关闭、选定bundle的CFBundleName读取、原生交通灯几何与About菜单精确操作，以及400×541 Overlay内容截图与`sips`尺寸归一；System Events直接tell PID，旧API保持兼容。
check_tauri_window_regression.js: packaged Tauri 主窗口 macOS 回归测试；以launchTauri子进程PID绑定首次显示、resize/restore、About开关与截图；About菜单项按选定bundle的CFBundleName精确匹配，About窗口标题保持固定；再验三灯位置、400×541 Overlay外形与完整内容截图，拒绝同名App污染证据。
sync_project_version.js: 项目版本同步器，以 CHANGELOG 最新正式版本为真相源，规范化 CRLF/LF 后级联同步 package、package-lock、Cargo、Tauri 公共配置与 Cargo.lock。
install_git_hooks.js: 跨平台 Git hook 安装器，Windows 在 stale PATH 时继续探测 Program Files/用户级 Git，写入 hook 目录与当前 Node 绝对路径，并精确区分 Git 不可用与非工作树，供 npm postinstall 消费。
pre_commit_gate.js: 可测试的 Node pre-commit 执行层；先拒绝本次 gate 输入闭包中的未暂存/未跟踪差异，再按暂存路径运行 Rust `cargo fmt --check`、JS `node --check`、版本投影同步、语言 JSON 合同与嵌入翻译表一致性；禁止通配暂存，版本投影是唯一受控 `git add`。
check_git_hooks.js: Windows 兼容 Git hook 合同测试，模拟 stale PATH、缺失 Git、非工作树，以及 JS/Rust/版本/语言/gate 自身的 partial-staged 漂移，并冻结快速门禁触发范围。
python_command.js: Python 3 命令边界，优先尊重 `PYTHON`；Windows 先探测用户级 Python Launcher 的绝对路径，再回退 `py -3`/`python`，隔离 IDE/Codex 继承旧 PATH 与 Windows Store 假别名；其余平台使用 `python3`，供 Node 验证器与 Qt SDK 解析器复用。
npm_command.js: npm 工具链身份命令边界，优先以当前 Node 执行 `npm_execpath` 保持无 shell；仅在缺少 CLI 路径的 Windows 宿主为固定 `npm --version` 使用 shell fallback，供漏洞门与 toolchain evidence recorder 复用。
powershell_command.js: Windows 开发脚本宿主边界；优先单次启动 `pwsh.exe`，仅在宿主不存在时清除继承的 `PSModulePath` 并回退 `powershell.exe`，脚本非零或启动拒绝原样失败，供 injector 构建与 NSIS 安装态守门复用。
release.config.json / release-2.8.config.json: 冻结2.7.2 p12默认profile与当前2.8.0生产profile；共用latest.json通道，2.8.0 profile固定tag-pinned archive URL。
release_metadata.js: GitHub Release 元数据守门器；默认 `release.config.json` 保留2.7 `latest.json`历史命名，显式2.8.0 profile生成当前发布元数据；workflow按profile进入三平台发布闭包。
create_updater_manifest.js: 静态 Tauri updater manifest producer；从所选 profile、当前 package SemVer、已审阅 notes、三个 exact-name artifact 与 base64 `.sig` 确定性生成指定 JSON；2.8.0 archive URL 固定到 tag，平台仍限 macOS 双架构与 Windows x64。
create_updater_manifest.test.js: updater manifest 离线对抗测试；以临时伪 artifact/signature 验证默认与显式2.8.0共用latest.json、tag-pinned URL、三平台映射、时间归一化及命名/签名/symlink 失败关闭。
create_legacy_updater_manifest.js: 历史p12原文/输出字节锁的离线producer；保留旧方案复核，不参与当前构建、发布或更新。
create_legacy_updater_manifest.test.js: 固定历史feed的离线合同；锁原文字节/三条tag URL/原签名指纹、真实input/output变异和CLI新建/同字节幂等/异内容保留/参数与symlink拒绝；独立source fixture，不依赖动态发行平台或密码学验签。
release_publish.js: profile-aware GitHub Release发布器；2.7 p12仅只读回读七项资产，p13+拒绝；当前2.8.0 profile沿用latest.json并使用tag-pinned包地址，workflow执行公开发布闭包。
release_publish.test.js: fake-gh离线合同；验证p12只读七项回读、阻断p13、真实2.8.0 profile的单manifest/provenance与七项公开资产闭环；不替代生产tag授权。
create_sbom.js / verify_release_provenance.js: 从 npm/Cargo lockfiles 生成确定性 CycloneDX 1.5 SBOM，并在 CI 内按所选profile复核 ReleaseAssetProvenance v5、release commit、真实平台签名声明、SBOM/toolchain、单feed九项分发身份及manifest语义；这些构建证据不作为用户下载附件。
create_source_artifact.js / verify_source_artifact.js / source_artifact_manifest.json + schemas/: 用 mode-preserving tar 输出 repo 外 source artifact；必需路径包含2.7/2.8.0 release profiles及2.8.0 endpoint overlay；verifier独立生成同commit的`git archive`，拒绝link/special/traversal/duplicate/secret并精确比对路径、bytes、type与mode，marker不能替代tree校验。
verify_ci_action_pins.js + ci_action_pins.json: 以 strict unique-key YAML AST 枚举 job/step 全部 `uses`（含 unnamed、`if`-first、flow mapping 与 quoted key），执行 GitHub Actions 全量 40 位 SHA allowlist、Node/Python/aqt/Rust 精确 pin，并拒绝 cargo-audit 绕过 channel qualifier 触发项目组件调和。固定 runner 集合要求 macos-15。
verify_ci_action_pins.test.js: 离线夹具验证精确 action、工具链与 runner pin；退役 macOS 镜像回归必须失败。
record_toolchain_evidence.js / create_toolchain_evidence_bundle.js: 前者在 source-contract/macOS 真实 producer 上 fail-closed 捕获无 secret 的版本与 runner 证据；后者要求 source-contracts、macOS aarch64/x64 三 scope 与 release commit/target 精确一致，聚合为由公开 provenance 绑定的 `toolchain-evidence.json`；Windows producer evidence 由 `record_windows_toolchain_evidence.js` 单独上传，待 #16 纳入 release 聚合。
extract_release_changelog.js: 保留英文分类语义并投影中文标题、要求逐条中文且拒绝伪列表的 Release notes 内容守门器，按内部 SemVer 从 `CHANGELOG.md` 精确抽取单个已发布日期区块；缺失、重复、未标日期或空正文时失败关闭，防止固定产品模板吞掉版本更新。
check_runtime_ui_coverage.js: runtime UI 覆盖率守门脚本，读取真实菜单 inventory 并按阈值阻塞未翻译文本。
check_full_ui_coverage.js: 单语言全 UI 覆盖检查，组合 runtime、compiled、JSON-backed 校验，并通过共享 Python 命令边界启动验证器。
check_full_ui_matrix.js: 多语言矩阵覆盖检查，写出稳定 runlog 便于连续追踪。
verify_gate_inputs.js: full-ui 前置输入守门器，冻结 session artifact、2.7.2 JSON lower bound、source-map 与 runtime provenance 合法性。
capture_accessibility_inventory.js: live AX runtime 抓取器，写 `RUNTIME_DIR/<lang>-ax-inventory.json` 与 menuDepthMax/submenu path audit evidence。
merge_runtime_inventory.js: runtime inventory 合并器，只接受 live-injector / live-accessibility 输入并产出 `live-merged` session 分母。
run_live_full_ui_matrix.js: G-CAPTURE 编排器，启动真实 Cavalry、解析 launcher PID、拒绝弱抓取并写 session run record，支持无副作用 `--help`。
macos-acceptance/: 可复用 macOS 定向 release-gate 工具；以 `source_contract.js` 为 producer/verifier 共用的完整源码、共享翻译/输入/搜索/Classic/Quick Add 描述及 macOS-only 显示策略与 fixture closure，结合 tracked Objective-C++ driver、exact CGWindow helper、冻结媒体、现场 `sw_vers` host product/build identity 与 target/stage 身份闭合的 Node matrix/v6 执行三语 21-run/48-point 验收，静态合同和无 vendor app 原生 compile 进入 CI，运行产物严格留在 repo/clone 外 session。
freeze_extraction_inventory.js: G-X freeze 器，按 whitelist 噪声规则冻结 JSON/compiled/runtime 英文分母并写顶层 target identity。
extract_compiled_ui_strings.js: 从 Cavalry 二进制和 framework 提取疑似用户可见 compiled UI 字符串。
generate_embedded_translations.js: 从 `tools/*.ts` 与 `model_display_translations.json` 生成带 GEB L3 契约的 injector 编译期翻译表，拒绝任何位于 `<context>` 外、运行时不可达的孤儿 `<message>`，并仅对显式 `xml:space="preserve"` 的 source/translation 保留首尾空白。
model_display_translations.json: display-only 模型名词典，保存 JSON niceName 英文化前的三语显示译名，只供 injector 翻译 Qt 浮动标题等显示层，不回写模型数据，并保持简繁中文 Latin/CJK 间距。
runtime-noise-quarantine.json: Runtime 翻译噪声隔离清单，记录无资源/live-capture provenance 的短 token，并让生成器跳过这些项以保持英文。
resolve_cavalry_qt_sdk.js: 从单一 Cavalry/Qt 版本真相解析宿主默认或显式 macOS/Windows SDK 投影；无论本地是否已有全局 aqt，都以 repo-local venv 和 `requirements-ci.txt` 完整 hash-lock bootstrap `aqtinstall==3.3.0`；stdout 只输出 shell env/JSON，venv/pip/aqt 诊断统一转 stderr，避免污染 `eval`；macOS 除版本还校验 `cavalry_qt_target.json` 固定的完整 SDK tree SHA-256（所有目录、普通文件内容和 symlink target 的 canonical projection），不匹配即拒绝。
resolve_windows_cmake.js: 从 `ci_action_pins.json` 的官方 Kitware/CMake v4.4.3 Windows x64 zip pin 下载并校验 archive SHA-256，重新解包受控缓存，执行 `cmake --version` 并验证 CTest 同包布局；stdout 只输出机器可解析路径或 identity JSON，拒绝 runner PATH、低版本、floating URL、缺摘要和 archive 漂移。
record_windows_toolchain_evidence.js: 读取已验证 Windows CMake identity，复核 archive/可执行文件摘要与实际 `cmake --version`，并 fail-closed 记录 Windows x64 producer 的 CMake 来源、版本、SHA-256、Node/npm/Rust/Python 与 runner identity；不涉及 Authenticode。
dependency_vulnerability_gate.json / dependency_vulnerability_gate.js / dependency_vulnerability_gate.test.js: 三生态依赖漏洞门；Node 24.22.1/npm 12.2.1与锁文件摘要共同准入；版本同步也会改变 package-lock 字节，必须核验依赖差异并同步 npm 摘要，不能跳过 audit；通过共享 npm 命令边界固定 Node/npm 与 registry，hash-lock `pip-audit==2.10.1` 并要求报告精确等于 CPython 3.12.6/Linux 的 24 项 canonical active lock（拒绝截断/增项/重复/漏洞），Cargo 固定 cargo-audit 与 immutable RustSec commit/timestamp，并要求 30 天内重审 snapshot。
verify_runner_image.js: 规范化 GitHub `ImageOS`/`ImageVersion` 及 runner OS/arch；PR/main 记录，tag 在受保护 environment 的 allowlist 缺失或不匹配时 fail-closed。
dmg_volume_identity.js: DMG 挂载身份真相源，从 package SemVer 与 `_aarch64`/`_x64` 文件名后缀生成 `Cavalry Switcher <SemVer> <arch>`，由 producer/verifier 共同消费并拒绝未知架构。
stamp_dmg_icon.test.js: 执行真实盖章脚本的离线生命周期合同；只虚拟化系统命令，覆盖忙卷三次等待、非忙错误直退及挂载 backing 保全。
stamp_dmg_icon.sh: 仅对卸载 EBUSY=16 等待2/4秒；保留错误，仍挂载时不删 backing。DMG 卷标与卷宗图标 producer；将共享身份写入可写镜像，再用 hdiutil 写入 `.VolumeIcon.icns`/custom-icon 标记，并以 Rez/SetFile best-effort 写本机 Finder 文件图标。
cavalry_qt_target.json: 发布目标映射，唯一声明 Cavalry 2.7.2 与 Qt 6.6.3，并为 macOS `clang_64`、Windows `msvc2019_64` 提供 repo-local SDK 路径和 aqt 参数；macOS qtbase 安装身份是可复核的完整 SDK tree SHA-256，而非仅版本号。
build_translator_injector.sh: 同时编译时间轴字体适配器，vendor-free Skia 链接桩覆盖 measure/draw； 同步生成独立 Quick Add 说明索引， 重生成共享翻译表后，以 `-O2/-fno-omit-frame-pointer` 合编 macOS injector、Classic 评分、空结果、完整分类 getter 与 TransformTool ABI 适配器；真实运行绑定 `@rpath/libskia.dylib`，无 vendor app 的 CI 只使用不入包的临时链接桩。
launch_cavalry_with_injector.sh: 手动调试启动器，复用 embedded injector runtime flow。
validate_translations.py: JSON/TS/injector 翻译质量检查脚本；Guide catalog 纳入真实分母并固定 `en` loader slot，可见文本先解码 HTML entity，再执行既有占位符、type:font 默认完整身份 parity 与 FP-1..12 审查；B14 结果进入 full-ui 单语言总 gate。
forbidden_translation_patterns.py: Python 共享 forbidden-pattern detector，检测 FP-1/2/3/4/5/7/8/9/10/11 单条翻译反模式。
forbidden_translation_patterns.js: Node 共享 forbidden-pattern detector，供 runtime/full-ui gate 与契约测试复用 FP-1/2/3/4/5/7/8/9/10/11。
forbidden_translation_patterns.json: §P5 detector 配置，集中声明正则、source/context denylist、latin residue、受保护品牌/格式词、transliteration 与 pangram 规则。
translation-whitelist.json: JSON 翻译检测契约；Guide `value` 可翻译而 `type/language` 保持 loader 身份，其他模型 niceName、Time Editor 与 FP-10/11/12 边界不变。
ja_JP.ts: 日文 compiled UI 翻译源。
zh-Hans.ts: 简体中文 compiled UI 翻译源。
zh-Hant.ts: 繁体中文 compiled UI 翻译源。
runtime_ui_allowlist.json: runtime UI 覆盖率允许保留英文/快捷键/格式标签/样本值的 exact、contains、regex 与 stripRegex 清单；可翻译的自动编号 Composition 标签不得进入噪声豁免。
fixtures/: fake Cavalry.app测试工厂与已发行p12公开manifest的固定字节输入；不包含真实应用包或用户配置。
git-hooks/: Git Hook bootstrap 目录，承载提交前 Node 路径解析与快速门禁入口（详见 git-hooks/CLAUDE.md）。

依赖边界:
tools 可以读取仓库与本地 Cavalry 安装，但测试型脚本不得修改真实应用；会产生副作用的脚本必须由 npm script 或手动命令显式触发。

法则: 守门清晰·runlog 稳定·真实副作用显式

变更日志
2026-05-14: 新增 `sync_project_version.js` 与 `git-hooks/pre-commit`，将版本真相源收敛为 CHANGELOG 最新正式版本，并同步 npm、Cargo 与 Tauri 元数据。
2026-05-15: 新增 `check_dmg_layout.sh`，把 DMG 背景图、窗口布局元数据与安装链接纳入真实挂载验证；`stamp_dmg_icon.sh` 改为先写 DMG 内部卷宗图标，再 best-effort 写本机 Finder 文件图标。
2026-05-15: `check_tauri_packaged_app.js` 增加 macOS bundle seal 验证，要求 packaged `.app` 含 `_CodeSignature/CodeResources` 并通过 `codesign --verify --deep --strict`，防止浏览器下载后被 Gatekeeper 判定 damaged。
2026-05-15: `check_dmg_layout.sh` 增加 DMG 内与安装态 `.app` 签名验证，确保 GitHub 上传的最终安装镜像本身也携带有效 bundle seal。
2026-05-15: 新增 `release_metadata.js`，把 GitHub Release tag、标题与 DMG 资产名收敛到 `release.config.json`，避免内部 SemVer 与 Cavalry 目标补丁号混用。
2026-05-17: `run_live_full_ui_matrix.js` 增加无副作用 `--help`/`-h`，避免误触发默认 `en` 抓取。
2026-05-17: `runtime_ui_allowlist.json` 扩展 regex/stripRegex 过滤，剔除快捷键、HTML 标签、颜色样本与 AX chrome 噪声，让 live coverage 聚焦真实残留。
2026-05-17: `check_app_contracts.js` 增加 ExtensionLayer 自绘字面量补丁 contract，要求 injector 通过 dyld/Mach-O `__cstring` copy-on-write 命中 Qt 属性抓不到的空状态与视口提示。
2026-05-18: `check_app_contracts.js` 将 ExtensionLayer 合同改为自绘层保持英文，防止 Latin-only overlay renderer 把 CJK glyph 显示为 `?`，并要求 compact sentinel 在 `strcmp` 前被跳过。
2026-05-18: `check_app_contracts.js` 增加 Time Editor niceName 合同，要求 node/plugin 模型 niceName 与英文基线一致，并要求 injector 在 item `setText()` 前跳过这些模型词汇。
2026-05-18: `check_app_contracts.js` 增加 QLineEdit 动态文本合同，要求 injector 监听后续 `textChanged`、保留自动编号后缀，并用 signal-blocked 写回做显示层翻译，避免属性编辑器名称位漏翻或反向污染模型名。
2026-05-18: `generate_embedded_translations.js` 接入 `model_display_translations.json`，把模型 niceName 的中文/日文显示译名移到 injector 显示层，保护 Time Editor 英文模型名同时恢复属性编辑器浮动标题翻译。
2026-05-19: `check_app_contracts.js` 增加对新增动画/时序翻译项与动态帧关键帧菜单的断言测试；`ja_JP.ts`、`zh-Hans.ts`、`zh-Hant.ts` 补充相关翻译条目；`CavalryTranslatorInjector.mm` 支持 Time Editor 在特定帧添加关键帧动作（Add Keyframe on frame <n>）的正则拦截翻译。
2026-05-19: 新增 `runtime-noise-quarantine.json`，`generate_embedded_translations.js` 在生成表时跳过无 provenance 的 runtime 短 token，防止 `Rhu -> 鲁/ログイン` 一类批量污染进入 injector。
2026-05-19: `nodeStrings.json` 补齐 Forge Dynamics 生成属性 label，`tools/*.ts` 修正 `Un-Parent` 与地面/迭代/场术语，`CavalryTranslatorInjector.mm` 增加 `N selected` 状态栏动态翻译。
2026-05-20: `tools/*.ts` 补齐 Add Layer/属性面板生成词，`check_app_contracts.js` 锁定 Add Layer 空标题行修剪、tag token 与 Time Editor niceName 保护边界。
2026-05-20: `zh-Hans.ts` 修正 `unsaved scene` 误译，`CavalryTranslatorInjector.mm` 增加冒号后缀标签兜底，让 `Looping:` 复用 `Looping` 的翻译。
2026-05-20: 修复 `check_tauri_window_regression.js` 在 Retina 屏下由于 physical pixels 物理像素 2 倍缩放导致的截图断言失败，支持自适应 backing scale factor 归一化校验。
2026-05-20: `tools/*.ts` 补齐 `Click to see next message` 裸文本，避免只翻译 HTML 版本而漏掉 Tips 面板渲染后的 QLabel 文本。
2026-05-20: `check_app_contracts.js` 增加 Voronoi Shader `loopLength` 属性与合同断言，确保运行时循环长度标签在四语语言包中同构存在。
2026-05-20: `tauri-bridge.js` 移除 snake_case 回退与未消费 debug 字段，`check_tauri_bridge_runtime.js` 锁定 camelCase-only payload；`check_app_contracts.js` 要求 ExtensionLayer 自绘层不注册空 literal patch 回调。
2026-05-20: `tools/*.ts` 补齐截图审计中暴露的运行时生成属性标签（如 Color Mode、Blend Mode、Gradient Mode、Capture Force、No Mask），`check_app_contracts.js` 锁定这些 TS 兜底翻译，同时继续由 Time Editor niceName 合同保护右侧模型名英文。
2026-05-20: `forbidden_translation_patterns.json` 将 Excel 纳入保留品牌词，配合翻译规范允许 `Excel 工作表` / `Excel シート` 这类术语表声明过的品牌组合。
2026-05-20: `tools/*.ts` 补齐第四批运行时生成属性标签（如 Controllers、Gradient、Dash, Gap、Particles Per Pixel、Emitter Velocity、Speed Limit、Blind Color等），同步更新 `check_app_contracts.js` 合同断言、`generated_translations.inc` 嵌入表并重编译 dylib。
2026-05-20: `CavalryTranslatorInjector.mm` 增加 No-prefix 混合文本兜底翻译，`tools/*.ts` 补齐第五批运行时生成属性标签（如 Override Mass、Direction Type、Cycles），修正 Lottie 及 Force Velocity 物理与波形术语，同步更新 `check_app_contracts.js` 合同断言、`generated_translations.inc` 并重新编译 dylib。
2026-05-21: `CavalryTranslatorInjector.mm` 收窄 Time Editor item view 保护，避免父级 `Scene Window (Time Editor)` 误伤左侧图层列表；新增 `X Shape` 运行时生成图层名显示层派生翻译，并锁定 `No Third Shaders` 等 No-prefix 兜底合同。
2026-05-21: `check_app_contracts.js` 增加注入库 Qt ABI 守门，禁止 checked-in dylib 引入 Cavalry Qt 6.6.3 缺失的 `QWidget::accessibleName/accessibleDescription` 符号。
2026-05-21: `check_app_contracts.js` 增加懒加载 QMenu 首次绘制前翻译合同，锁定 `ActionAdded/Show` 同步处理，避免菜单先显示英文再被后置刷新覆盖。
2026-05-21: `CavalryTranslatorInjector.mm` 增加离线重认证倒计时动态翻译，保留剩余天数；`tools/zh-Hant.ts` 与 `tools/ja_JP.ts` 补齐 Tips 面板 `<i>Click to see next message</i>` 富文本源。
2026-05-21: `CavalryTranslatorInjector.mm` 将 `QMenu::aboutToShow` 收敛到同步首次绘制前菜单翻译链路，避免 Composition 菜单中运行时重置的 QAction 先显示英文再翻译；`check_app_contracts.js` 锁定该合同。
2026-05-21: `tools/*.ts` 修正 Canva 登录态三语文案，保留 Canva/Cavalry 品牌词并清理 Sign-in/Signing out 误译；`check_app_contracts.js` 增加品牌词合同，`generated_translations.inc` 同步再生成。
2026-05-21: `CavalryTranslatorInjector.mm` 将 QLineEdit 纳入 `QEvent::Paint` 首次绘制前同步翻译链路，覆盖 SceneTree `EditableNodeName` 行名英文先画再翻译的问题；`check_app_contracts.js` 锁定该合同。
2026-05-21: `CavalryTranslatorInjector.mm` 增加点编号与括号编号动态图层名正则，红框 Qt/Scene View 显示 `Matches.0`、`String Generator 2 [2.Match String]` 等翻译并保留数字，黄框 Time Editor item view 用同一解析器反向恢复英文；`check_app_contracts.js` 锁定该边界。
2026-05-22: `CavalryTranslatorInjector.mm` 将 Time Editor 保护扩展到通用 `QAbstractItemView` 的 `DisplayRole/EditRole`，覆盖右侧自绘条不走 QListWidgetItem/QTreeWidgetItem 包装时的动态括号名英文恢复；`check_app_contracts.js` 锁定 model role 写回边界。
2026-05-22: `languages/*/nodeStrings.json` 将 Apply Character Spacing 的 `pairs*` 动态属性恢复为英文数据层，避免 Time Editor 自绘条读取 CJK 后显示方框；`tools/*.ts` 继续承担红框 Qt 显示层翻译，`translation-whitelist.json` 与合同测试锁定该分层。
2026-05-22: `CavalryTranslatorInjector.mm` 增加 `QTextEdit::append` 在 dyld 符号解析失败时的安全写入兜底，用直接 cursor 插入避免吞没日志消息；`check_app_contracts.js` 增加对应安全断言。
2026-05-22: `CavalryTranslatorInjector.mm` 增加 `Copied <object>` 动态消息模板翻译，固定谓词按语言本地化、对象名复用现有词典，并同时覆盖 MessageBar 弹窗与底部 QLabel/QStatusBar 状态文本；`check_app_contracts.js` 锁定三语模板、对象名查表与通用 widget 入口。
2026-05-22: `CavalryTranslatorInjector.mm` 移除 MessageBar QTextEdit 的 Paint/Show 文档扫描，只保留 `QTextEdit::append(QString)` 追加时正文替换，避免注入逻辑进入原生弹窗动画路径；`check_app_contracts.js` 锁定该性能边界。
2026-05-22: `CavalryTranslatorInjector.mm` 增加 `Undo/Redo (<operation>)` 动态消息模板翻译，谓词按语言本地化、括号内操作名复用现有词典，并同时覆盖 MessageBar 弹窗与底部状态文本；`check_app_contracts.js` 锁定该入口。
2026-06-04: `check_tauri_build_sop.js` 增加 README release badge endpoint 合同，要求四语 README 不再使用 Shields GitHub Release badge，并要求 tag release workflow 成功创建 Release 后写回 `docs/badges/release.json`。
2026-07-13: 修正 `window_contract_lib.js` 的 AX 前置检查，不再用无关窗口数量判断权限；截图尺寸改由 `sips` 读取，真实 packaged Tauri 窗口回归已执行而非空心 skip。
2026-07-07: `check_tauri_bridge_runtime.js` 增加自定义语言 select 的 change 事件合同，要求自定义弹层选择与原生 select 语义一致。
2026-07-13: injector 合同锁定 capture-only inventory、dirty/direct-child 局部补译、QHash 语义、Paint fingerprint、item-model 异步更新、`-O2` 与 `@loader_path`；真实 Cavalry 验证禁止构建 SDK 作为 runtime RPATH，避免双 Qt SIGABRT。
2026-07-14: `CavalryTranslatorInjector.mm` 定点拦截 `QPainter::drawText(QPointF, QString)`，只翻译 Assets、Attribute Editor、Scene Tree 三处由 `ui::textAtWidgetCentre` 绘制的空状态提示；`zh-Hans.ts`、`zh-Hant.ts`、`ja_JP.ts` 将三条统一收敛为无句号的 UI 微文案，合同锁定三语标点一致性、CJK font fallback、新旧字宽中心补偿、纵向基线不变、Qt 6.6.3 等价四参数重载的不可吞字回退及 `__cstring` 补丁禁令。
2026-07-14: 新增 `extract_release_changelog.js` 与失败关闭合同，GitHub Release 只接受 `INTERNAL_APP_VERSION` 对应的单个非空、已标日期 CHANGELOG 区块，并继续保留产品介绍与下载模板。
2026-07-23: 新增 `install_git_hooks.js` 与 `python_command.js`，修复 Windows npm postinstall/Python 入口；版本、renderer hash、生成表及 C++ 源合同统一跨 CRLF/LF，打包合同同步冻结公共/macOS/Windows Tauri 配置和 Windows CI 可执行构建基线。
2026-07-24: `release_metadata.js` 与打包合同把 Windows x64 NSIS 稳定资产名纳入 `release.config.json` 真相源，要求 tag release 同时上传一个 EXE 与两个 DMG。
2026-07-24: pre-commit 拆为最小 shell bootstrap 与 `pre_commit_gate.js`；按暂存路径执行 Rust 格式、JS 语法、语言 JSON 合同和嵌入翻译表一致性，版本同步仍只显式暂存受控投影，并用 Windows Git resolver 合同覆盖 stale PATH。
2026-07-24: pre-commit 在运行任何读取工作区的子进程 gate 前，拒绝 Rust、JS/package、翻译/语言合同与 gate 自身输入闭包的未暂存或未跟踪差异，防止工作区修正掩盖旧 index；source artifact 同步携带 hook bootstrap 与 Node gate 闭包。
2026-07-24: ExtensionLayer 空状态、拖放提示与 CustomListWidget placeholder 的简中、繁中、日语显示文案统一移除末尾句号；英文 source 与精确 hook 白名单保持不变，完整状态通知仍保留句子标点。
2026-07-24: 新增 `check_windows_nsis_install.ps1`，把 Windows x64 NSIS 从构建产物提升为 CI 隔离安装/卸载合同；随机 TEMP 根、固定用户状态碰撞拒绝、PE/资源/哈希/注册表验证与无破坏性 fallback 的零残留观察共同守住安装态发布面。
2026-07-28: macOS dylib 与 Windows 双 DLL 统一为对应平台 Runner 现场产物；合同要求 source artifact 排除原生库、Windows 构建先重生成共享翻译表，并由 packaged app 以哈希和 Mach-O ABI 证明嵌入的是同次 macOS 构建物。
2026-07-28: runtime UI allowlist 移除自动编号 `Composition <n>` 豁免；合同要求英文 `Composition 1` 阻断 100% coverage，而简中、繁中与日语本地化编号标签正常通过。
2026-07-27: Windows NSIS 安装态守门只解析显式 `x86_64-pc-windows-msvc` target 产物目录，与构建脚本及 CI artifact 上传同构，杜绝脏工作区里旧 `target/release` EXE 被误验。
2026-07-27: `cavalry_qt_target.json` 从 macOS 单投影升级为共享版本加双平台 SDK 投影；resolver 默认跟随宿主并支持 `--platform windows`，Windows CI 与本地 `prepare:qt-sdk:windows` 复用同一路径和 Qt 6.6.3 `msvc2019_64` 校验。
2026-07-27: Windows NSIS 以 `windows_nsis_provenance.js` 形成构建前精确旧输出清理、构建后输入/安装器哈希记录、安装前复算的闭环；sidecar 与 EXE 成对上传，拒绝版本变更留下的未知 EXE 或 orphan sidecar，禁止用 Git HEAD 或 mtime 伪造当前包来源。
2026-07-28: Windows NSIS 安装态 gate 增加 hooks 无 Cavalry/QPA 写入入口合同、同一安装器 `/UPDATE` 重入与独立 TEMP QPA 三文件哨兵；安装、同版本更新、卸载后均要求哨兵长度/SHA-256 不变，漂移时保留证据，同时明确该合同不替代任意真实 Cavalry 根或跨版本升级验收。
2026-07-24: 新增 `capture_windows_pid_window.ps1` 与 ignored Windows live-clone 合同；三语真实 PID 窗口证据必须等待 ExtensionLayer installed 和 DWM 完成，helper 独立调用也先拒绝非 `%TEMP%` sentinel clone，只能优雅关闭 outstanding 精确进程；三张主窗不等于全表面覆盖，逐类追加截图后才进入人工通过。
2026-07-27: `generate_embedded_translations.js` 对 `<context>` 外、不会进入 injector 表的 TS 孤儿消息失败关闭；繁中与日语目录清除 11 条已有 canonical 同源项的历史重复，避免审计把无效备份误判为运行时翻译。
2026-07-27: 三份 compiled/runtime TS 以 `(context, source)` 集合保持严格对称，补齐 `MenuBarManager / ToolBox` 的繁中与日语窗口标题，并为二进制实证的 File 菜单 `Exit` 动作增加三语翻译，阻止普通 Qt runtime 词条静默回退英文。
2026-07-27: Windows MessageBar 仅在 history/live 两个真实 `QTextEdit::append` return 处理最后一个 `<br>` 后的精确 Pencil 警告，明确排除命名 `js_logger`；三语文案统一无句号，Node/合成 callback/只读 vendor PE 合同共同锁定边界。
2026-07-27: 三语 TS 补齐二进制实证的调色板/命名、场景/渲染与工具设置普通 Qt 表面；生成器以 `xml:space="preserve"` 保留 `QMetaObject::tr` 实际 source 的尾随空格，Finder 作为 macOS 产品名进入集中 Latin 保留词；`Pitch Radius:` 暂留到独立绘制链采证完成后处理。
2026-07-27: `CogTool` 的 `Pitch Radius: <integer>` 经 ExtensionLayer 生产、optional vector、PrimitiveToolBase 消费与两处 Core text-path caller 全链采证后加入三语 TS；Windows dispatch 仅在两个批准 caller 接受固定前缀和 MSVC `int` 会生成的 canonical 32-bit 十进制文本，生成表与 Node/C++/vendor 合同共同锁定。
2026-07-27: 繁中 compiled TS 将 Pen/Pencil 状态消息中的简体“钢笔/铅笔”统一为“鋼筆/鉛筆”；共享 FP-4 词表与整份 zh-Hant TS 扫描合同共同阻止同类简体工具名回流。
2026-07-27: Windows NSIS 固定内置 English/SimpChinese/TradChinese/Japanese，直接跟随系统 UI 语言并以 English 兜底；安装器复用现有 ico，明确不把尺寸/格式不匹配的 DMG 背景伪装成 header/sidebar 品牌资产。
2026-07-28: `LineToolSettings` 的 `Stroke Width: ` 与 `Cap Style: ` 按 Cavalry 2.7.2 `ExtensionLayer.dll` 唯一真实字面量改为精确冒号/尾随空格源，三语 TS、生成表及 Windows 显示/translator 合同共同拒绝旧的无冒号假表面。
2026-07-28: Windows 2.7.2 二进制调用链确认的普通 Qt 残留按现有 translator/display 边界补入三语：`Bookmark %1`、`Boundary Color`、两条绑定占位符、Velocity Preset 动作/过滤器及上下文动作；动态值保留 `%1`，无需扩大 ExtensionLayer 自绘 hook。
2026-07-28: Windows 2.7.2 二进制确认 `Automatic (%1)` 经 Color Settings QComboBox DisplayRole、四条 Mesh Explorer 整数模板经 QLabel factory、`Enter an index, e.g: 0` 经 `acrStringSingleIndex` 的 QPlainTextEdit 占位属性；三语 TS 与 exact-context 策略之外，运行时还要求 `Color Settings` 对话框、`MeshExplorerRowWidget` 或 `AttributeEditorWindow` 父系，编辑器正文、模型角色、近似文本及无关同文控件保持原值。
2026-07-29: Windows NSIS provenance 将 Windows 编译单元直接依赖的共享 `cavalry_i18n_translation_policy.h` 纳入输入 fingerprint；合同要求安装包记录完成后单独修改该头文件必须使 verify 失败，防止共享策略漂移被已构建 DLL 掩盖。
2026-07-29: macOS 定向合同锁定 parentless Assets ContextMenu 的单事件循环 owner 承接、Tag/Tracking owner 负边界、具体 Add Layer 快捷键隔离，以及 TransformTool 五 action 的双 slice caller/Skia ABI 防火墙。
2026-07-29: Guide catalog 纳入 translation validator，固定 Cavalry 2.7.2 实际读取的 `en` slot、98-key 同构与引用完备性；生成翻译表同时保留 GEB L3 契约。
2026-07-29: Windows NSIS provenance 比较 canonical file identity，修复 macOS `/var` 与 `/private/var` 指向同一安装器却被误拒绝的本地合同假阴性；bundle 边界与内容 fingerprint 不变。
2026-07-30: 将 2026-07-29 现场使用的 macOS 21-run/48-point acceptance driver、exact-window helper、媒体输入和 harness 从可清理 Cache 恢复到 `macos-acceptance/`；CI 运行静态合同与无 vendor app compile，live PASS 仍只由显式 session 证据产生。
2026-07-31: Windows Adjacent gate 将 Tag/Assets producer driver、双素材与 exact-HWND 证据握手收进 tracked Rust/C++/PowerShell 边界；正式瞬态 PNG 改由 producer-side Qt grab，helper 只封存/诊断，三语动态 stem 带 run nonce 防止还原工作区污染。
2026-08-09: 新增 release acceptance evidence/seal、detached offline acceptance signer 与独立双 trust anchor、exact-commit/mode source tar、strict-YAML Actions SHA pin、toolchain evidence、三生态漏洞门与 private-draft 最后公开的幂等 release_publish；当时合同测试曾锁定 tag Developer ID fail-closed 与 badge PR 路径，前者已由 2026-09-01 的 ad-hoc 事实修正撤销。

2026-08-09: 本地 Qt ensure 取消裸 `pip install aqtinstall`，改用项目内 hash-locked bootstrap，并以 Qt 6.6.3 macOS 完整 SDK tree SHA-256 拒绝下载/安装漂移；新增 npm/Python/Cargo 已知漏洞、RustSec freshness 与 tag runner-image fingerprint 工具门。

2026-08-10: Qt SDK resolver 将 venv/pip/aqt bootstrap 诊断统一路由到 stderr，保留 stdout 为可 `eval` 的机器输出；CI pin 守门器要求 cargo-audit 通过 manifest 中的精确 Rust channel 安装；新增 npm 工具链身份命令边界，修复 Windows Runner 无 shell 启动 `npm` shim 失败，三者共同隔离宿主 bootstrap 差异。

2026-08-27: `test_temp_dir.js` 为合同测试注册本进程创建的有限 TEMP fixture；`check_app_contracts.js` 与 `check_tauri_build_sop.js` 在顶层 `after` 中仅清理直接位于 `os.tmpdir`、固定前缀且无 symlink/reparse 的目录，不扫描或删除历史/陌生路径。
2026-08-27: CI、action pin 与漏洞门共同升级到 Node.js 24.20.0 / npm 11.19.0；精确版本只存在于共享 policy/pin 及其 strict contract 中，开发文档统一声明 Node 24 LTS 下限。
2026-10-22: 安全发布将同一精确钉升到 Node.js 24.22.1 / npm 11.19.1。历史验收记录不改写。
2026-08-31: UI Review 收敛匿名 macOS 权限 handoff 原型；复用真实 `permissionMac` renderer iframe 作为源，独立模拟系统设置目标，运行时捕获/递归克隆真实权限动作与目标 row，固定 duration/response 0.72、1.0 临界阻尼公式、initialAlpha/minimumLaunchScale 与距离比例 lift，保留正反向状态机、静态 accessory takeover 和 Reduce Motion snap/crossfade；禁止固定 arc 滑杆、通用阻尼分支、手绘 proxy 内容与新增外部具体身份信息。
2026-09-01: 发布资产合同撤销未具备凭据的 Developer ID/notarization 强制前提；seal v6 与 provenance v4 改为显式 `macos: ad-hoc`，生成器要求调用方明确传入签名模式，验证器与合同测试同步拒绝把 Tauri updater Ed25519 冒充 Apple 平台信任。
2026-09-01: macOS DMG 挂载卷标由共享 resolver 固定为 `Cavalry Switcher <SemVer> <arch>`；本地与 CI 的既有盖章步骤同时写入，真实挂载 gate 精确回读，发布资产文件名仍独立表达 Cavalry 兼容目标与 patch tag。
2026-09-04: Windows NSIS provenance schema v2 收敛为 producer/acceptance verifier 的单一 machine-readable 合同；验收 fixture 改由生产构造器生成，并以真实 producer→verifier round-trip 与协议突变反例阻止两套版本/键集合再次各自变绿。
2026-09-22: Issue 33 现行输入边界收敛为双平台共享 `translateLineEditPlaceholder` 的 placeholder-only 路径：普通/只读名称以及 parentless/重挂接查询框的 QLineEdit 实际值保持原文，`text()` 仅供改名/查询或 Paint fingerprint 观察；上方 2026-05-18/21 条目保留为当时历史，不改写成现行行为。当前合同名为 `embedded injector keeps input values outside display translation` 与 `generic line edit paths on both platforms do not write business text`；其他 model DisplayRole 风险未由此条目宣称全部解决。
2026-09-22: Issue 33 现行输入边界收敛为双平台共享 `translateLineEditPlaceholder` 的 placeholder-only 路径：普通/只读名称以及 parentless/重挂接查询框的 QLineEdit 实际值保持原文，`text()` 仅供改名/查询或 Paint fingerprint 观察；上方 2026-05-18/21 条目保留为当时历史，不改写成现行行为。当前合同名为 `embedded injector keeps input values outside display translation` 与 `generic line edit paths on both platforms do not write business text`；其他 model DisplayRole 风险未由此条目宣称全部解决。
2026-09-22: 新增 JSON `type:font` 默认身份 B14 合同；以递归全 surface 比较保留 default 键存在性及完整对象，禁止翻译字体族/样式或为无 default 的定义制造默认值。Node 合同与 Python validator 都不硬编码字体名、节点路径或语言文案，B14 直接阻断 full-ui。
2026-10-06: UI Review 将显式 owned zh-Hans fixture 从误报 official 改为后端 unknown；Node 的隔离生产 renderer 矩阵验证原厂 English/Japanese 可显示 Official、unknown+owned zh-Hans 隐藏徽章，四语文案一致且 JS 不按 locale 推断来源。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

dependency_vulnerability_gate.json: 固定审计工具、RustSec快照和Python活动锁闭包。复核日期随真实审查更新，30日上限不放宽。

2026-10-16: Qt头包真实输入使用framework Versions/A/Headers；抽取器归一为include/Qt*。PR跑纯路径合同，macOS锁定venv再跑合成7z合同；真实官方归档已独立抽取通过。

手动预验合同逐事件验证checkout/Node前置，防止显式打包在空runner读取缺失脚本。

验收场景范围：scene-scope显式归档195个未填展开项；Timeline保留180观察索引与15父场景。macOS当前表2630项，不新增GUI或产品门。

CI动作pin与漏洞策略固定Node 24.22.1、npm 12.2.1。
verify_ci_action_pins逐job核验紧邻Node的npm安装。
安装与Node同条件，错序或忽略失败均拒绝。
