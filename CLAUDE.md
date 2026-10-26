# Cavalry-i18n - Cavalry 的 macOS / Windows Tauri 桌面语言补丁器
HTML + Javascript + Rust (Tauri) + Objective-C++ / C++ (Qt Injector / Windows generic translator + QPA delegate)

当前只推进Cavalry 2.8.0。2.7 p12是终版，只保留历史下载。
Windows原生Apply在profile/runtime写入前持久化已验安装选择；GUI、--launch-cavalry和卸载共用native模式状态域及操作锁。卸载先解析必要目标，缺状态零profile写入，宿主已移除仍幂等恢复自有profile。
Windows启动warning独立限域于Api目标语言sidecar缺失分支；动态安装根下17官方目录和实际同版批准用户包共同授降噪，缺包/漂移、英语源缺失、未知插件与其它日志保留。不补写安装级翻译目录，不改变Mac日志链。
ARM production-2.8已接编译期资源、命令与独立updater配置；本地包生命周期另验。预览状态与生产状态分离，旧2.7不作验收前置。
macOS 2.8.0 NRT将Extension补丁纳入恢复事务。baseline schema 2保存原像，owner v3记录九槽后像。旧八槽owner保留读取与English恢复；新写入须先恢复原厂再捕获。
Welcome、双Save caption、Graph空态与Demo reader源码已归位。9c冻结源码对应20个归位文件。新ARM候选已正常升级owned测试App；历史9973/b643制品保留。正常首帧与完整发行仍另验，不继承旧PASS。


验收工具入口：`tools/acceptance/README.md`；整轮单表与失败复验规则见`docs/acceptance-workflow.md`。Windows接手包见`tools/acceptance/local/handoff_windows/README.md`，逐项任务见`HANDOFF-TASKS.md`；它核验源码与工具，不授予产品PASS。runs/local忽略；打包器只显式收Windows交接材料，不含Mac私档。
验收schema2分开保存完整源键库存与批准实屏项。旧表显式迁移保留原件、全部历史及逐项映射；库存不授通过信用，未解决失败不转库存。
插件324源键与ToolHelp三语198译值各保留库存；ToolHelp沿既有四工具组。Timeline180观察索引由15父场景负责；Null15误展开源项归库存。macOS表2630项不等于2630次操作。

Windows 2.8.0生产入口复用native资源与用户事务；安装发现沿既有动态链，profile独立解析Local/Roaming系统根。ToolHelp确认零写者时不启动辅助进程；同名进程再核用户SID。安装journal与profile共享Windows目录同步，实际补充runtime与完整验收独立裁决。
Windows2.8.0窄补充在`injector/windows/native/`：复用225项/固定状态及Graph目录/完整字形覆盖与标题、保存caption、Guide、内置Easing及Fast Unicode策略；384/17帮助说明及401根四行布局共用既有producer，Windows单独证明MSVC文档/调用布局。Demo沿共享297源/489位置，仅将完整源等价的Windows CRLF映射到实际SHA/位置，在动态官方Preset根与唯一reader caller投影。Welcome沿共享裸句/精确节日策略，Windows先核logger及启动producer才读取影子payload。Qt6.9.2构建且只用宿主Qt。runtime-only沿既有QPA/vendor备份/CAS和固定payload journal，普通根/Program Files共用执行器；状态同时比较编译期runtime来源。完整实屏与首帧验收独立，不继承Mac或私人helper信用。

Windows固定工具帮助的Alt组合仅在字体准入时对应共享Option/Alt组合；原显示字节、75项共享lane及准确owner调用链不变，三语隔离合同与实屏复验分账。
<directory>
.agents/ - 项目技能入口；翻译与macOS显示分别路由；显示按影响合批补验，显式隔离Switcher状态，发布前清测试副本并回交安装选择；脚本自测留tools，不参与产品构建或运行 (1 子目录: skills)
.baoyu-skills/ - 项目本地 Agent 技能扩展配置，约束翻译偏好与术语来源 (Markdown)
.github/ - GitHub Actions与Issue模板；定时依赖巡检不启动build或ci_gate；手动macos-2.8-preflight在现有ARM/Intel矩阵打包，不发布；2.7 p12拒绝重打包，2.8.0公开tag走三平台发布闭包 (YAML)
desktop-patcher/ - 旧桌面补丁器产物镜像，仅保留 injector 生成物与预编译 dylib (C++, dylib)
docs/ - 公开项目必须的翻译规范、可重复维护 SOP 与 README 图片资产；研究、事件簿、实跑记录和历史方案不进入公开仓 (Markdown, JSON, PNG)
injector/ - macOS与Windows运行时补充（2子目录：native、windows）。默认2.7.2路径锁Qt6.6.3，保留显示翻译、输入保护、Quick Add与精确字体适配。native/承载2.8.0 arm64字体与窄显示候选；新增同库Fast精确caller Unicode选项，显式Qt6.9.2公开头仅构建期、运行只复用同App QtCore；编译/纯合同与最终静态门已过，三语单个可见Twist查询与同owner清空通过，新字体矩阵及首帧仍另验；主标题fmt接线与384根帮助组件已合并静态验证，e4候选已见正常日文欢迎页，默认标题三语已实屏，帮助新候选三语401可达根实屏与全图复核已闭，111nested当前根loader N/A；FPS精确直绘owner同候选三语字形/播放已证，日文冒号已按源与原图视觉通过，首帧另账；Guide动态正文仅在已证Qt setter caller投影；Easing仅在已证addAction caller投影20个显示标签，枚举身份不变；两者复用locale且不进绘制热路径；复用原厂getter与单一字体核心；按成功制品复原动态可执行路径，旧81项固定表覆盖Transform/Edit Shape与质量；当前追加Mesh四键三语12项，共93项，旧81项逐字节保全；644daf完整候选三语六态与Mesh四行稳定实屏已验，首帧与测量另账；源码另追加40组固定ToolHelp/语与4组固定前缀组合至225槽，旧213保全；8b42新制品三语六态/Pivot稳定已验，正常Hans更新已部署为签后0cdeeb；私有三语测量36槽限定实证返回位透传，完整工具上下文/首帧另账；旧2aef首次繁体partial保留，整个界面首帧与生命周期待验；显式native/debug已嵌入完整候选并沿原事务部署，正常繁日载入已证，简体正常入口与首帧另验；不接默认2.7发布链。Windows generic与QPA保留原厂窗口委托和安装根验证。生成翻译表只由tools源投影，不手写。模型身份、用户输入及未知owner保持原值。完整职责与ABI边界见injector/CLAUDE.md。
languages/ - 现行English与三语JSON overlay；native/原4319质量冻结后新增5959键源绑定准入，官方域78模块10378键、余0；独立Forge schema域另1模块8键，缺源域另2模块366 caption（历史365与Background Rendering新增1分账），新增Directional实际amount插件caption1，总82模块10753审批/10848 source/10848派生输出、三语missing0，不伪造第18份官方catalog；13厂商日语核证纠错独立登记/377原样，source与身份保全，草稿不进入producer；独立帮助由injector/native窄接线，不进入registry (JSON, 构建期JS数据)；官方100示例菜单三语300槽已源绑定接入，DNT仅本批显示例外；脚本297源/891译值经精确Presets reader消费，两类示例三语已实屏。
renderer/ - 普通userProfile Switch直达原事务，仅Restore English保留确认；四语删除两项死确认copy，完整两个renderer合同74/74及真实单击Switch/Restore取消已验。Official可访问说明限定可信原厂App且无Switcher语言覆盖，不宣称全UI或任意第三方原样；候选路径以结构化截断与grid最小宽度约束保持固定窗口；显式native预览的用户scope/Unknown/资源门沿单一API投影，只有完整owned image授权无兼容宿主English恢复，阶段与终态不冒称验证安装或启动；协调失败只读刷新不丢Activity；语言选择将当前语言与补丁版本状态分离，当前语言有更新时在选项及已选值保留同源绿色徽章并支持重应用；Tauri 前端 UI；user-profile-text.js维护独立四语userProfile静态copy，ui-text.js合并为唯一UI_TEXT，双页面与VM载入顺序受合同锁定；以单一 token、共享 Button primitive、系统字体和离线 HTML/CSS/JS 提供无描边彩色 Badge、保留但禁用当前语言的显式占位 Select/Tooltip、直接 Switch/单一 Restore English、真实 Channel 驱动的三轨 Activity、普通验证失败的固定 Issue 入口、必要 AlertDialog，以及 Base UI 对齐的外围失败 Toast；Select Trigger 保持独立 combobox 状态机，Windows caption 仅替换视觉而由系统窗口 API 执行动作，持久事实不叠 Toast，About社交入口采用Twitter/X与小红书双列「关注+平台图标」，GitHub/License保持全宽并经project-link-control统一固定外链与失败Toast；主窗30px单行关注footer由support-footer.js/css独立装配，固定链接复用icons.js与project-link-control.js，加载顺序为Toast→project-link-control→footer→app；内部404px控件布局不变，仅底留白缩为10px (HTML, CSS, JS)
src-tauri/ - 同源非English动作以bounded owner hint、approved源和2.8.0宿主身份判路，只写profile；operation/writer/NRT与UserReceipt恢复保留，不读App槽/baseline/签名，不授App写恢复权；English与runtime更新保留完整准入。native状态仅在Current-owned非英语profile比较内嵌runtime源与有界owner hint；失配提示更新，坏证据留Unknown；不读App槽/journal/签名，不授写许可；native成功apply同guard直接launch，独立Restart完整准入保留；dev/test只保留调试行表，release默认不变；profile apply复用首次无pending回执，pending恢复仍读回。macOS NativeRuntimeOnly保留固定槽journal、owner与来源意图；NRT同份manifest核intent，只在四个实际回滚phase预读profile，无journal/终态不重复读；2.8.0切换和启动不扫描整树；新原厂baseline仅备份固定槽，兼容旧schema 1；原厂恢复核固定槽与厂商签名。旧schema6/StateDocument路径保持，原厂签名与postimage漂移守门；中性runtime计划接stock首次安装owner；其复用main/injector签名与NRT，官方临时副本真实安装/签名已验；全树仅作独立验收，不进入生产切换；完整候选已在正式preview正常繁日载入，首帧与生命周期另验；正式preview已接双owner命令、持久归属及原厂恢复；有界bundle清单与typed2.8.0原厂baseline进入macOS编译；baseline已真实只读capture/load/verify，managed归属已接显式preview；全链路现场验收另账。native Official由厂商验签与内置en/ja且无Switcher覆盖共同准入，自有三语/未知/漂移隐藏徽章，资源/恢复权限独立；显式macOS native开发预览使用编译期资源审批和独立userProfile事务/UI，owned English恢复独立于宿主/新包可用性，以解析时同份receipt bytes+mode约束pending发布并禁止无宿主启动，默认2.7安装级路径不变，非完整2.8.0产品；成功应用回执与内容寻址补丁源支持跨版本严格验证；macOS 只有完整、可验证的 official vendor baseline 才能受管升级或原厂恢复，历史 JSON-only/无完整基线安装返回 typed `reinstallRequired`，不靠 P 版本哈希猜测；新源冻结后由原平台事务提交；Tauri 后端分离 renderer 契约、安装真相、受控系统命令与平台运行时，macOS 直接尝试安全写事务，仅在真实 typed PermissionDenied 后进入 App Management handoff，并把脚本入口重签的三个自有外置组件纳入不暴露给用户的路径级兼容清理、回滚和 English 恢复；完整 baseline 证明 vendor-derived managed postimage 后，旧 wrapper/injector 仅作为安全替换目标而不要求历史 code identity，最终签名仍是事务提交门，Windows 以无系统 caption + transparent compositor 表面承载自绘阴影、圆角与右侧 renderer 控件；语言事务通过四阶段 Channel 投影真实边界，Updater 只从 Rust State 消费已检查 Update；immutable snapshot、durable manifest/backup、原子 English 清理、same-EXE UAC 与 NSIS 生命周期统一控制面和数据面 (Rust, NSIS)
tools/ - 自动化工具链；DMG盖章复用Tauri三次忙卷卸载等待，失败保留诊断与挂载镜像，离线合同守住错误边界；历史365条加Background Rendering独立1条schema声明/Core实际fallback固定源边界经raw SHA与完整官方/Forge碰撞门接producer，365 caption正式准入，单键World Scale追加不改旧364摘要，完整/撤批partial分别守门，不增加live完成信用；当前统一latest.json供Switcher更新，旧宿主沿已有短提示/p12入口，历史冻结producer不进发布闭环；2.8.0公开tag按所选profile进入三平台发布闭包；新增 2.8.0 原生稳定键/ICU 格式/正式旧译候选与帮助说明审批及Guide/Plugin canonical完整域合同的纯构建期边界，不参与显示热路径；涵盖renderer四语copy子域的脚本/VM/打包顺序合同，以及翻译提取、校验、选择输入值双平台合同与 macOS 生产入口 Qt fixture、SDK 解析、DMG `产品 + SemVer + 架构` 卷标/布局 producer-verifier、真实 renderer + fixture bridge 的 UI Review 及权限工作流/视觉转场双状态原型、Windows NSIS 安装态、exact PID/HWND/受限 cleanup 与 producer-side PNG 证据，以及 tracked macOS Objective-C++/CGWindow 21-run/48-point 定向验收器；原生库和 live session 现场生成而不入库 (Node.js, PowerShell, Bash, Objective-C++, Swift)
output/ - 只跟踪稳定地图与派生产物规则；实跑证据在仓外session，历史研究归档私人文档；派生产物不驱动构建、测试或运行时 (Markdown)
</directory>

<config>
.node-version - 本机Node 24.22.1；packageManager固定npm 12.2.1
src-tauri/tauri.native-windows-2.8.conf.json - Windows默认生产wrapper的runtime资源映射；与native-production共同装三语包和同版generic/QPA，不带旧translator或Qt运行时
.gitignore - 排除依赖、构建、实跑和output派生产物；output仅保留CLAUDE与README稳定规则
CAVALRY_2_8_MIGRATION_PLAN.md - 单2.8.0迁移唯一44项主账，44完成/0待办；§66.193记录2.8.0 p1正式发行及七资产/统一feed回读；Windows D-6/G-5按§66.189收口；§66.191记录2.8.0首发授权、1.1.0及生产tag启用；§5.2是待办导航，§66.149–151记录NRT Keychain、同源profile快路与真实恢复进度，§66.159–177记录四语footer、ARM内部包/恢复、5.367GiB清理、Save caption、验收复用纠偏、Intel隔离编译与Graph/官方示例新缺口；原动画不动。Intel实机不阻断，编译/反馈留XIA-187；Windows已在合批流程稳定后完成本机验收。完整225不变；普通GUI繁1.449秒、简4.309秒，不抵冷首装/恢复/完整性能/首帧。Guide79/79/79；本profile首启已完成，限定N/A各19、待验0，源分母各98。旧STOP§126限当次私档发布；新归档独立执行，功能分支已合入PR54，2.8.0 p1已按§66.193公开发行。私档不作为构建输入。
AGENTS.md - 固定本轮单2.8.0安装范围，不加旧版/双安装必验门；根级 Agent 行动地图，按 Kumo knowledge base 结构固化查找入口、约定、反模式、命令、流水线、工具链与安全边界
CHANGELOG.md - 新版本中文条目与英文分类语义分离的 SemVer 发布历史与 Unreleased 用户可见变更真相源；tag 正文由 workflow 按版本抽取，不保留会漂移的根目录 release body 快照
LOCAL_BUILD_SOP.md - 当前2.8.0三平台生产构建与发布合同；旧2.7.2 p12只作历史下载，release.config.json保留冻结profile与共享latest.json endpoint；唯一桌面打包与发布操作合同，区分本地验证、ad-hoc tag、Tauri updater 签名和未具备的平台身份，并固定 macOS DMG 文件名与挂载卷标的不同职责
README.md - 简体中文主入口；标题与介绍说明Cavalry汉化/中文语言包及Windows/macOS支持，英文入口移至README.en.md；四语保留头部徽章与语言导航，Preview和图片前置，说明紧跟图片；再列2.8.0亮点、三步使用及权限恢复，Release安装段置于权限之后、开发之前；折叠原理、语言代码、翻译来源、目录和CI；徽章读取最新Release，2.7.2保留p12入口
README.en.md - 英文完整说明，保留原英文内容并导航回默认中文入口
README.zh-Hans.md - 简体中文兼容镜像，保留既有链接与锚点，与默认入口保持Preview前置、Release安装靠后的标题结构，以及2.8.0用户profile与归属恢复事实
README.zh-Hant.md - 繁体中文 README，与默认中文入口保持Preview前置、Release安装靠后的标题结构，以及2.8.0使用者profile與歸屬還原事实
README.ja_JP.md - 日文 README，与默认中文入口保持Preview前置、Release安装靠后的标题结构，以及2.8.0ユーザープロファイルと所有状態の復元事实
package.json - Windows默认构建经windows_native_build.js生成2.8.0生产NSIS及指纹；CI先准备官方2.8.0/Qt6.9.2，安装烟测核native三语包。tauri:build使用无硬编码target的2.8.0 production入口；ARM与Intel alias各传一次目标，复用盖章和目标架构资源检查；纯packaged helper加入合同/语法门。项目元数据与核心构建/测试指令；纳入20项Easing显示表合同和生成器语法门；默认合同与语法门纳入384/17帮助表及401根排版producer测试，生成表仍须显式官方MetaData输入，构建输出不入库；默认合同与语法门包含历史365加独立1条raw source adapter、366批准caption/旧364冻结与单键撤批missing反例及显式官方集合/合法数字开头vendor owner反例；默认合同与语法门覆盖native源身份/ICU、已审批次及88槽真实旧译回退、13厂商纠错/377原样闭合，历史批准摘要与现行译文摘要分别守门；新增38条空区域短提示类别合同，锁精确source及三语producer，并注册于test:contracts和check:app；p12旧feed、候选路径和四语userProfile copy保持独立；check:app语法门包含user-profile-text模块。build:tauri:native:candidate显式生成ARM优化预览App/DMG，保持独立状态并禁用updater；显式tauri:dev:native仅运行未发布2.8.0预览，build:native-resources必须传官方assets；FormatJS仅作构建期格式校验
package-lock.json - npm 依赖锁定文件，冻结 Tauri CLI/API 与构建期 ICU parser，不增加产品运行时解释器
release.config.json - 冻结2.7.2 p12读取与合同profile；共享latest.json endpoint，不用于当前2.8.0发布
release-2.8.config.json - 当前2.8.0统一latest.json生产profile；固定cavalry-2.8.0-pN、三平台资产与tag-pinned archive URL，发布仍受三平台闭包约束
SECURITY.md - 支持渠道、私密漏洞上报、平台签名边界与 supply-chain 控制说明
rust-toolchain.toml - CI/本地 Rust channel 固定入口，禁止 tag 构建漂移到浮动 stable
requirements-ci.in / requirements-ci.txt - certifi 2026.10.19排除受损emSign信任链，Brotli双绑定锁定安全补丁；Qt SDK bootstrap 的 Python 顶层声明与完整 `--require-hashes` 锁定闭包；固定 CPython 3.12.6/Linux active set 另由漏洞策略精确绑定
requirements-audit.in / requirements-audit.txt - certifi与Qt构建锁同版；`pip-audit==2.10.1` 自身的独立顶层声明与 universal hash-locked 工具闭包，避免漏洞扫描器通过未锁定安装进入 CI
src-tauri/Cargo.toml - Rust crate、Tauri v2 与后端依赖声明；dev调试行表由test继承，release默认不变
src-tauri/Cargo.lock - Rust 依赖锁定文件，保证本地与 CI 构建同构
src-tauri/tauri.conf.json - Tauri 共享运行配置，固定本地 CSP/updater 信任根、`main`/`about` capability 与 400×504 无滚动 macOS Overlay 主窗口边界；30px单行footer位于434px内容轨道下方，内部404px控件布局不变；创建时由 Tauri 定位原生交通灯而非应用层 resize 回调
src-tauri/tauri.macos.conf.json - macOS 覆盖配置，声明 DMG/bundle、dylib、四语 runtime 语言目录（排除 native 构建期数据）与四语 App Management 用途说明资源，并把 800×476 Finder 安装窗首次打开原点锁定为实测参考位置 400×655
src-tauri/tauri.windows.conf.json - Windows 覆盖配置，以隐藏创建的完整窗口 override 关闭系统 caption/native shadow，启用带 10px alpha 留白的 transparent compositor 外壳，再声明 NSIS/x64、四语 runtime 语言目录（排除 native 构建期数据）与 generic translator/QPA delegate 资源
src-tauri/tauri.release-2.8.conf.json - 2.8.0 endpoint覆盖；tag命令按已选profile追加，已授权tag复用三平台production构建及签名回读闭包
tools/cavalry_native_target.json - macOS 2.8.0预览的main/Api/Core/QtCore与17对catalog锁；官方10473及schema补充373（Forge8+缺源365）分账，nodeDefinitions单独锁源，不含厂商内容，不证明profile实际路径
src-tauri/tauri.native-preview.conf.json - 未发布2.8.0开发预览覆盖，只装native包、隔离identifier/state、关闭旧injector前置，后端禁用updater并拒绝release profile
src-tauri/tauri.updater-artifacts.conf.json - updater 产物覆盖，仅启用签名 archive/sidecar 生成；与共享配置中已固定的最终公钥/endpoint 合并，仅由tag生产流程使用；手动macOS预验不读取updater私钥
injector/generated_translations.inc - 编译期嵌入的翻译静态表
injector/cavalry_i18n_input_policy.h - 双平台共享 QLineEdit 输入边界；只翻译 `placeholderText`，名称/查询实际值（含只读、parentless/重挂接）保持原文并继续承担改名/过滤语义
injector/cavalry_i18n_macos_tool_help_text_path.{h,cpp} - macOS TransformTool 五条自绘 action 的双 slice Mach-O/caller/Skia ABI 适配边界
</config>

法则: 极简·稳定·导航·版本精确

2026-10-12 MessageBar单键修订：三语实际显示完整UTF-8且无句点，旧摘要保全。Snippet三语扩宽后全文已验；繁日原超时/退出桥接错误保留，回交已另核。字体制品不变。

2026-10-13 Mesh字体：GetPath每语固定表27→31项，保留旧81项并追加四键三语12项。源合同逐字节守住旧表和批准译文；实屏与首帧分账。

2026-10-13 profile恢复进度：canonical回执与前像校验通过后，facade完成EnsureBaseline并开始Apply；不加IO或延时，renderer原动画保持。Intel实机不阻断发布，编译与反馈留XIA-187；Windows验收后置至macOS合批流程稳定。

2026-10-15 合并候选9c352155仅仓外外载。三语18组Measure返回位一致；两官方示例、另存caption与Graph单空态三语已实屏。Hans/JA九质量组合与四工具动作已读回并恢复；选中遮罩与首帧仍另账。9973/b643成功bundle不变，主账34/44、剩10。

本批私人续卷f5b3990已远端逐文件读回；独立写锁释放，已验临时clone清理。公开代码未commit/push/tag/release。

2026-10-15 ARM新候选：复用M43完整三语包，100菜单批准值进入打包资源。冻结9c未重编；新App/DMG构建并逐字节读回。普通Switcher升级至9c并启动Hans，后端8.826秒；此为升级计时，不是完整首屏计时。首轮录屏区域与实际第二屏不符，保留工具失败，不授首帧。

2.8.0 tag已按profile接独立endpoint overlay；preflight runtime guard保持。两个定向合同通过，未运行Windows或发布。

性能口径：8秒是参考，不是硬性验收线。优化实际注入等待与进度连贯性；首次升级与同源切语分别计时，不因单次超8秒阻断。

2026-10-15 同源繁体后端0.875秒、AX观察1.132秒；Hans/Hant各100菜单AX相等。空场景录像首个可见窗中文可读，不抵完整首帧。Intel仅thin compile-only链接通过；完整产品编译仍待。检测到用户Applications进程后暂停切语与配置回交，继续离线工作。

2026-10-15 JA后端0.180秒、AX观察0.280秒；三语各100示例菜单消费闭合，XIA-197按窄范围闭项。测试PID已授权清理；繁体与原偏好/工作区字节和权限回交完成，新9c owner保留。

M57/G3/M58私人续卷b87fc728已远端读回并释锁；仅清理本任务干净clone，公开代码未发布。

2026-10-15 M63仅补最终9c繁体九质量/四工具，22原图复核与配置回交完成；三语此限定回归闭合，不抵首帧。M61真实x86 native源码编译链接通过，完整Intel App仍未闭。M60仅清两份完全相同target副本28,219,607字节。

M60/M61/M63私档f61071cc已远端逐文件读回，写锁释放；成功脚本与逐字原话保留。公开产品未commit/push/tag/release。

M66正式模式ARM App/DMG已真实构建。成品检查6/6、SOP定向4/4、DMG安装启动与自有副本删除已验；正式包语言动作仍待，不闭G-4。
私档f0bd78e4保存2.7终版决定与M62/M66范围，已远端回读并清理自有clone。

2026-10-15 §66.178：C-3先行；RGB/Sound按维护者裁决转XIA-198非阻断，不冒称显示PASS。官方2.8.0预设注册文件缺失；Sound用户内容保持原样。

2026-10-15 §66.179：繁日Guide reset四键实屏通过并取消。原繁体偏好/布局按字节与mode回交；不确认Reset。C-3余Classic繁日；不重跑Guide。维护者明确只验翻译行为，Snippet窄布局不再阻断；Welcome稳定消费按8个同源组件复用，首帧另账。

M68/69/70私人续卷1e09d8e9已远端逐文件回读，独立写锁释放，自有干净clone清理。成功驱动和原话保留，公开产品未发布。

2026-10-15 §66.180：C-3可达消费者收口，主账35/44、剩9。Classic繁日查询/创建/原始类型与缓冲恢复已验；Snippet布局不阻断，Welcome按组件复用。原失败保留，产品9c未重编，繁体配置已回交。接F-2，不重跑已过矩阵。

M70/M73私人续卷13fc09ff已远端逐文件回读并释放写锁。已清理自有干净clone；成功脚本与原失败保留，公开代码未发布。

2026-10-16 M66正式ARM bootstrap生命周期闭合：生产简体切换、移除保留翻译、同版本重装与English十固定槽恢复通过。M74脚本跳过已过阶段，一次完成繁体/正常Quit/偏好布局原字节mode回交。主账36/44、剩8；跨版本updater按SOP留下一版，不记PASS。Intel官方双slice已核，自研x86接线与完整产品编译继续；快拖裁切仍未修。

2026-10-16 §66.182：维护者确认第4项快速拖动通过，F-3收口。主账37/44、剩7；不宣称新增修复，不重复缩放测试。F-2旧文件补差继续，Windows仍后置。

M74/G4成功脚本私档3a605cdc已远端逐文件读回，写锁释放，自有干净clone已清理。原件、最小依赖与用户裁决保留；原配置和App未上传，公开产品未发布。

2026-10-16 §66.183：M75三语旧文件六名全文与未选中长条字形通过，F-2关闭。主账38/44、剩6；旧五态/测量不重跑。繁体旧Quit超时保留，清理不抵生命周期。正常繁体与配置字节mode已回交；接F-4，Intel并行。

2026-10-16 Intel产品接线：production模式接受macOS arm64/x86_64 release，build/runtime按编译目标核thin dylib；标准packaged门按目标架构检查。隔离Intel App/DMG已编译，成品6/6；Root合并产品合同并复验5+2+3项。native x86源码仍在三方合并，尚不关闭F-5，不宣称GitHub线上通过。

2026-10-16 现有CI阻断修复：Python urllib3 2.7→2.8与Rust rustls 0.23.43→0.23.46仅最小锁升级；RustSec固定快照经实际审查更新，30日阈值不变。隔离固定Rust1.98 cargo check通过，未触发Actions，不将本地门记成线上绿。

2026-10-16 §66.184：Intel完整native及App/DMG编译、6/6成品门与51路径源码合并闭合，F-5关闭。主账39/44、剩5；ARM9c未重编，Intel实机未验非阻断。patch mode事故与隔离实apply证据保留；F-4与现有GitHub打包接线继续，Windows及发行后置。

2026-10-16 M82：现有GitHub macOS矩阵接2.8.0 production输入，ARM/Intel各传一次target。官方DMG与Qt头包固定字节，x86源码清单从当前仓库生成，不再依赖私人证据。手动默认只检查，显式预验只上传包；Windows和正式发布门不变。Root排除候选patch的错误隔离根图，保留本L1。尚无线上Actions结果。

2026-10-16 §66.185：三语正常首批字形九面已核，原厂/日文编辑与播放资源对照完成；F-4余启动时钟与搜索资源。M82 CI输入本地接线已验，Qt真实1357头抽取通过；线上Actions未跑。繁体原配置/布局已回交，主账39/44不变。

2026-10-16 私档续卷9b947c6：F2成功脚本、Intel完整编译、三语首显、资源口径与真实Qt解包已远端读回。主账39/44不变；写锁释放，自有干净clone清理，公开产品未发布。

2026-10-16 §66.186：F4按固定9c首绘与外部性能观察收口，40/44、剩4。M83补同Mach启动/搜索；M86补真实鼠标菜单；M85无阈值离线帧间隔，不授内部render时延或统计保证。繁体偏好/布局已回交；G3余授权后的线上预验及发布时双feed回读，Windows和Release后置。

第5项性能私档4510740b已发布，109文件远端逐字回读、释锁并清理自有clone。成功脚本与原失败保留；第7项线上预验仍待授权，主账40/44。

2026-10-16 已授权推送现有feat/cavalry-2.8.0并执行macOS预验；不合并main、不tag/release。M88修正手动profile验证遗漏checkout/Node前置，只回归工作流合同。

2026-10-16 M88候选e9f2500已推送功能分支并启动Actions 38880747612。手动前置通过；Demo测试旧签名、ARM综合ABI门和Intel Popup静态门失败。仅修测试并补失败诊断，不放宽ABI，不重验已过界面。主账40/44；未合并main、tag或Release。

M88 ARM根因已实证：整行arm64匹配误中了CI路径，取到x86 UUID。按架构字段选slice；固定UUID/offset不变。路径干扰回归接入check:native-2.8-ci-inputs；072d6b8线上源码检查通过，完整macOS包仍待。

M88手动预验失败候选仅保留1天，供读取真实Mach-O；不包含官方库，不发布。ARM已越过UUID门并编译，SkTextBlob静态门待定位；Intel继续查实际interpose槽。

M88统一根因：同一CI候选在runner旧dyld_info中符号错位，LLVM绑定表与本机新版读值一致。候选绑定检查统一读取LLVM，不放宽库/符号/槽语义。Intel另补实际漏传的libCore链接；复用原.o隔离relink已证两槽从flat变为Core。ARM Popup旧abi文本断言与现popup_abi接线不同，修检查不改运行时。
手动2.8.0预验去重复源码门及漏洞扫描等待；同SHA源码门只跑一次，包任务保留架构Rust与production制品检查。PR/main/tag/schedule扫描规则不变。主账仍40/44，线上新结果另记。
候选binding与Popup源码回归接入check:native-2.8-ci-inputs；不新增依赖或运行时组件。

2026-10-17 线上预验38932098058最终success，源码4263177。ARM/Intel production App/DMG、标准成品门与上传通过；不含Windows实机或公开发行。验收流程仅本地整合，单表与现场证据Git忽略。每批采图后立即结束自有exact PID，失败与中断同样收尾；强制清理不抵正常Quit。产品主账40/44不变，不重复已过产品验收。

2026-10-19 PR54@83aae3a已合入功能分支b7eec06；Windows验收和定向补证通过，主账42/44。未提交的异常加固草稿已撤销；余双feed实际回读及授权发行，不重跑既有验收。

2026-10-19 新裁决：Switcher统一latest.json更新，撤销旧feed冻结/按宿主拆通道。2.7.2沿现有短提示与p12按钮；p12历史资产不变。G-3改核统一feed发布回读，42/44不变；不得据此打tag或发布。

2026-10-19: 维护者批准2.8.0首发。移除过期迁移tag拦截，保留main ancestry及三平台production、updater签名与七资产回读；准备cavalry-2.8.0-p1 / app1.1.0。未获发行实证前，G-3/G-6仍待。

2026-10-19: cavalry-2.8.0-p1（app1.1.0）已公开，main/tag CI与三平台包均成功。七资产实取、SHA-256、三平台updater验签、统一latest.json及p12前后对比通过；主账44/44。Intel实机仍未验且非阻断，平台签名身份不变。后续账本提交不移动发布tag。

2026-10-19 p2修订：正式版四语共享提示去预览声明，unset与explicit英文共用English标签；权限helper改贴Settings右下内侧10pt并沿用实时端点。测试隔离和发布前收尾只记显示skill，不改SOP。版本1.1.1，发布实证另记。

2026-10-19 p2待机更正：正常启动对齐p12的四语idlePrompt，不常驻共享profile说明。仅保留资源故障与待恢复提示，不新增确认框；旧p2流水线在公开前已取消。

2026-10-20：cavalry-2.8.0-p2（app1.1.1）已公开；此前p2待机记录仅描述公开前的候选状态。

## Node 工具链

本机与CI固定Node 24.22.1、npm 12.2.1。
每个CI Node setup后显式安装并核验npm。
工具链迁移保留main的1.1.2版本。
Tauri CLI/API 2.10.1与Rust 2.10.3同minor。
Node合同在原生编译前拒绝单边升级。
