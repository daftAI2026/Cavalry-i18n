# renderer/
> L2 | 父级: ../CLAUDE.md

原生userProfile的Official徽章跨平台消费后端来源与无覆盖双门；legacy Windows仍不显示厂商来源徽章。

成员清单
index.html: 跨平台语义 DOM 骨架，承载原生标题区、默认隐藏手动选择入口的安装 Item、Trigger 与空值 popup 均保留占位投影的全宽 Select、scope-aware Switch/Restore English、仅精确 2.8 预览+2.7.2 目标显露的固定旧版发行 CTA、三轨 Activity 与按需权限/Issue 表单动作，footer 独立占30px轨道且不压缩原内容；按 bridge→user-profile静态copy→UI_TEXT聚合→language/version policy→状态机→app加载，并保留 Windows/About 独立窗口边界。
app-icon.png: About 的 128px 本地应用标识投影，字节级复用 Tauri 图标集同尺寸产物，不形成第二套品牌源图或远程依赖。
tokens.css: 离线设计角色唯一真相源；小红书品牌红只供该标识消费；16/14/13px、400/450/500 与 4px 主节奏覆盖窗口/控件/Activity/Toast/AlertDialog，页面内紧密动作组按 20px 页面 padding 的一半固定为 10px、AlertDialog 按 16px padding 的一半保持 8px，footer与content底留白共用固定10px spacing，按20px正文行+10px底padding推导30px，16px图标与32px命中区分离；文字与图标整组居中，四语墨迹间距需实屏验证；Windows compositor 外壳固定 10px 透明阴影留白并让主窗口与 About 共同消费 32px 专属圆角，macOS 保持 AppKit 默认窗口圆角；Updater 使用 20px，右侧 About/Minus/Square-or-Copy/X 统一使用 16px Phosphor Regular，Close 保持 4px Button 右边距，标题左缘以其可见路径右缘约 15px 为光学基准，About 标识由 64px 基准加一个 16px 档得到 80px。informational blue 精确投影 Vercel 发布的 `vbg-blue-700`，同时服务语言 blue-subtle 文本与权限引导；Official green-subtle 独立表达更新/通过语义，彩色 Badge 使用透明边界，基础灰色可保留描边；Activity 的 warning/danger 只服务语义图标，权限阻断使用不受 Reduce Motion 消除的共享可读停顿，Toast 保留 shadcn 16px inset 并与 20px 主网格错层。
button.css: 无框架 Button 基础 primitive；按锁定 shadcn Base Button 源码统一 inline-flex、disabled、SVG 与 ghost/icon-xs/icon-sm 状态，全部普通动作与 Toast 关闭共同消费，Select Trigger 因拥有独立 combobox 状态机而明确隔离。
styles.css: 跨平台三轨 shell（40px titlebar/434px内容/30px footer）、安装 Item、无可见描边的彩色 Badge、带可选徽章的 item-aligned Select/只读占位行、Tooltip、按钮和 AlertDialog 视觉实现；Windows 在 transparent 顶层表面内用共享 10px shadow inset、32px 共享 radius、可用时的 squircle 曲线和 alpha 阴影绘制单一外壳，最大化态归零三者，并让标题左缘以当前 16px Close 可见路径距本体右边约 15px 为光学基准，阴影不参与视觉布局；更新可用入口与语言补丁徽章复用 green-subtle token，安装摘要用 Flex 容纳可选文件夹动作且隐藏时不留空轨，内容区首个 section 允许 min-width 收缩以免默认路径候选撑开固定窗口，主动作 Grid 将 20px 纵向 flow 与 10px 同行按钮关系分开，AlertDialog 保持 modal 语义但只遮罩标题栏以下任务区，正文自然换行并只保留显式段落边界，Grid 管复合结构，Flex 管一维关系，主窗口禁止滚动。
support-footer.css: 额外承载不占Grid布局、不接收输入、aria-hidden/inert的fixed手臂层，仅transform/opacity运动。主窗口底边以下30px支持轨道的独立视觉层；无分割线，Grid以两列20px单行居中排布文案与图标；上方与下方复用固定10px spacing，上方归content底padding，不重复加padding；32px命中区与焦点框不裁切，四语墨迹间距仍需实屏验收；复用正文14px字号/20px行高，关注文案用Medium500，单行垂直居中且不截断文案，小红书宽标识用48px槽保持两段可见间距相等，仅hover时用品牌红。
operation-log.css: 三轨任务视窗的独立视觉层，只消费 tokens.css；中性外框复用 12px panel padding、border 与 radius，idle 单轨双轴居中，running 以 Grid 固定首尾 14/20 Message 并只让中段 Marker 滚动；任一可见状态动作才创建第二外层轨道及 8px 间距，避免隐藏动作挤压普通完成态；中段按 shadcn Base Marker、Spinner、shimmer 复刻 16px 单色 marker 与统一 8px 关系间距，warning/error 用 amber/danger 图标与中性前景标题编码，说明/事件行/外框继续收敛为中性，新行只以不改变布局的 opacity/transform 入场，8px scroll-fade 由 `data-at-start` / `data-at-end` 精确收口，不裁切外框或首尾。
icons.js: Renderer 单一语义图标注册表，集中保存经 MIT 归因的精简 Phosphor Regular SVG path 与项目自有权限 handoff 实心箭头，并注册共享 GitHub/X/小红书品牌mark，供About与主窗footer共同消费，只暴露冻结 `create(name)` 工厂；Restore 映射 FloppyDiskBack，打开 Cavalry 映射 Play，事件拖入映射 ArrowUp，权限交接返回映射 CaretLeft、视觉提示使用独立 clean-room glyph，Updater 映射 ArrowCircleUp，Windows caption 映射 Info/Minus/Square/Copy/X；事件、Updater、Toast 与窗口控件只消费语义名，不接管应用 Logo 或 macOS 交通灯。
operation-log.js: 依赖 icons.js 的任务反馈状态机，显式切换 idle/events/running 布局，首尾 Message 按 `word + trailing whitespace` delta 非阻塞更新同一文本节点，并在固定首尾轨道显隐、换行或增量写入后先同步、再于浏览器下一布局帧复测中段视窗溢出与 live edge，避免带说明的终态因旧行高停在视窗外；中段维护稳定 id 的 ordered upsert，真实 Channel 事件到达后由表现队列保证 running 最短可读时间与相邻阶段落位间隔，慢事件不加等待、错误或显式阻断立即抢占，阻断可向业务层返回完成落位后的共享可读停顿，外部权限按钮轨显隐后复用同一重测入口；权限同进程 oracle 不通过 start 清空既有历史，也不合成 resume 旁白，业务层折叠已经成功展示过的 verify/baseline 前置阶段，只追加新增结果或真实失败；结果句只在队列末尾出现。短流顶部起排，只有读者仍在 live edge 时才跟随新增 Marker，运行态组合 Spinner/shimmer，终态按语义名取图标。状态机不读取 Tauri、不阻塞后端事务、不自行推进业务阶段。
permission-handoff.js: App Management 权限交接控制器；在原 AlertDialog 仍可见时冻结正向动作，同时冻结持久 Activity 权限动作作为返回锚点，等待固定 bridge 确认 native 已接管后才关闭瞬时 source，并只把本 session Channel 的 retryRequested 重放到原写事务；显式 Back 回到重新捕获的 Activity 动作，业务成功/错误只清层，同一 session 的重复 Retry/drop 在前次事务返回前折叠为一次。
update-progress.js: Updater 事件语义适配器，以固定更新引言启动三轨，把 bridge 的 downloading/installing/restarting DTO 压缩为下载、验证并安装、重启三个用户 Marker；下载百分比作为唯一默认可见的阶段次行并在完成后稳定保留 100%，文件名/路径等内部步骤不投影；只调用任务反馈状态机，不发起下载、不持有 Update、不把下载结束误报为已验证，也不伪造跨重启结果。
toast.css: 共享短时通知视觉层，消费 Button/token 投影 shadcn Base Toast 的 16px inset、底部堆叠、16px padding、12px 图文关系、4px copy 间距及 500/250/150ms 动画，不改变主内容 20px 网格。
toast-control.js: 无依赖 Toast 状态机，按 Base UI 1.6.0 提供 5000ms、3 条、loading 常驻、hover/focus/window blur 暂停剩余时间、F6/Escape 与 polite live region；关闭动作复用共享 Button，只服务外围失败。
project-link-control.js: DOM-free 固定外链适配器，消费冻结 bridge、四语文案和外围 Toast；主窗动作、footer、About 共用同一失败提示，不接收或拼接 URL。
follow-hand.webp: x-hands 10d4f90 的原始 hand-suit.webp，本地装饰素材，MIT 归因见 THIRD_PARTY_NOTICES.md。
support-follow-hand.js: 独立装饰动画生命周期。首次无警告的非恢复切换动作，完成消息完整显示并前台停留800ms后演一次2.8秒手势；localStorage仅记已展示，后台等待焦点，操作立即收起，Reduce Motion跳过，随机选GitHub/X/小红书一个图标，指尖按其实际位置定位，从左斜上方伸出，袖口按几何伸到窗外；不改Activity/外链业务。
support-footer.js: 主窗口 footer 控制器；把四语短文案、操作title和无障碍名称写入固定DOM，以共享图标工厂装配GitHub/X/小红书，并只分发repository/twitter/xiaohongshu固定ID。
THIRD_PARTY_NOTICES.md: 另完整保留x-hands MIT许可证、素材及动作来源提交；renderer 内适配的 shadcn/ui 组件行为与 Phosphor SVG path（含 About 的 Regular XLogo）的 MIT 来源，以及 pinned Simple Icons GitHub/小红书 SVG 的 CC0 来源；仅记录实际进入本地源码的第三方材料，不把远程组件库/CDN 引入运行时。
about.css: About 专属视觉层，以共享 icons.js SVG carrier 呈现品牌mark；将主窗口40px可拖动Chrome覆盖在完整内容画布之上并复用共享caption Button/排印/token，同时移除重复视觉标题与分隔线；Twitter/X与小红书用4px列间距，GitHub/License保持全宽，80px应用标识、版本与入口纵向间距用10px收口；底边距固定20px；macOS使用Overlay和原生交通灯，Windows使用transparent compositor外壳、无系统装饰Chrome和共享Close。
window-controls.css: Windows caption 的 Button 变体层；40px 标题栏以 4px 间距和 4px 右边距排列 32px ghost icon-sm Button，Info/Minus/Square-or-Copy/X 统一使用 16px Phosphor Regular；主窗口依次为 Info/Minus/Square-or-Copy/X，About 窗口只消费 X，关闭按钮仅在 hover/active 进入危险态并保留 forced-colors；最大化状态同时驱动 styles.css compositor 外壳归零阴影与圆角。
select-control.js: 菜单与 Trigger 已选值共享 option 内容和无障碍名称，状态刷新清理旧徽章； 无依赖单选组件状态机，按 Base UI 的 placeholder/open/active/selected/disabled 分层投影 combobox/listbox/option ARIA，并以真实布局盒在开启瞬间把只读占位行或真实选中项中心锚定 Trigger；按 shadcn Nova 的 trigger/popup/item/check 构成实现跳过禁用项的方向键、Home/End、Enter/Space、Escape、typeahead、稳定指针高亮、值变更通知与外部点击收口，可由业务为任意选项传入安全文本 Badge 与完整 aria label，不替业务预选默认值，只同步隐藏原生 select。
tooltip-control.js: 无依赖 Tooltip 状态机，复刻 shadcn Base UI 的 delay=0、单开 Provider、hover/focus 打开、click/Escape/focusout 关闭与触摸禁用；Popup portal 到 body 后以 bottom 优先、边缘 shift/top flip 和 Arrow 锚点定位，`aria-describedby` 只在打开期存在，不读取业务或文案。
path-display.js: 无依赖安装位置投影器，Windows 将 executable 路径降为其所在安装目录，macOS 保留 app bundle；不超过 36 字符时完整显示，超限后按路径层级保留盘符/根与末级安装目录，极长 UNC authority 保留根而不能保证字符上限；默认候选逐路径复用同一截断并以独立 label 投影，再由现有可收缩前缀承担像素级兜底。完整语义位置只保留在 aria-label，禁止原生 title 生成第二套不可控 Tooltip，也不改变后端选择的真实路径。
about-control.js: 主窗口 About 入口状态机，仅在 Windows 将注册表的 Phosphor Regular Info 装入最小化左侧共享 caption Button，并把点击交给冻结 bridge 的单一 `showAbout` command；Tooltip 委托共享状态机，不持有 About 内容、窗口 URL、版本或关闭焦点状态。
about.html: 独立 About WebviewWindow 页面，品牌图标由icons.js装配；复用主窗口 titlebar DOM 的拖动/控制语义与 tokens/styles/window-controls/about/toast，视觉 Chrome 不重复产品标题；Twitter/X 与小红书各显示「关注 + 图标」和平台区分的四语可访问名称，GitHub/License各占全宽固定入口；Windows提供固定about-label Close，OS窗口标题仍由Rust owner保留。
about-window.js: About 页面控制器，以共享图标工厂装配GitHub/X/小红书图标，为两项“关注”提供平台区分的四语可访问名称；DOM监听只把固定twitter/xiaohongshu/repository/license ID交给project-link-control；Windows接通共享Phosphor X与bridge固定`about` label close，外链失败只在本窗口显示error Toast，不暴露URL。
window-controls.js: Windows caption 状态机，只在 `platform=windows` 展示右侧最小化/最大化或还原/关闭，消费图标注册表与 bridge 固定 main-window 操作并在 toggle/resize 后同步最大化状态、四语可访问名称和 compositor 外壳 normal/maximized 投影；系统 API 继续拥有行为，失败不污染业务任务事件视窗或 AlertDialog，macOS 路径不执行窗口 mutation。
user-profile-text.js: 纯静态四语 userProfile 的真实资源/恢复故障提示、固定英文Restore确认与故障阶段copy；不再保存普通Switch确认文案，只由ui-text.js spread合并为统一UI_TEXT，不承载策略/bridge/runtime逻辑。
app.js: 唯一业务交互源；只接线project-link-control与supportFooterControl，启动只消费 bridge 的只读 version/scope/language/patchStatus/reconciliation 投影并遵守后端兼容枚举；未找到安装时把本地默认候选作为结构数据交 PathDisplay，不把路径插入文案；installation 沿用原安装级事务，userProfile仅在只读nativeLocaleState=unset且currentLang=en时显示统一English标签，unset与未知currentLang矛盾或缺字段/unrecognized仍Unknown；此copy不改currentLang或Select/Restore ownership门，资源缺失只禁Switch/Select；hostless Restore 必须由严格 true 的 nativeEnglishRestoreAvailable 放行，只面向当前 owned full activeimage，不受 unknown/reconciliation/snake_case 推断授权，英文恢复 verify 阶段不冒称宿主验证成功，严格 nativeRestoreOnly 结果明示恢复但未启动 Cavalry；失败回执要求协调时保留错误 Activity 并刷新只读状态；用户级 Switch 直接进入正常事务，Restore 保留共享配置确认，appPath仍是宿主事务与重启目标；只有 Cavalry 2.7.2 在后端判为 olderUnsupported 且 supportedVersion=2.8.0 时显露 legacyRelease固定p12下载链接，不误标 2.7.2默认版；固定错误不分流到权限/App Management或2.7.2重装，普通验证Issue、安装级完整Restore、平台权限、Updater与Toast保持既有边界。
tauri-bridge.js: 非视觉兼容桥，在业务脚本前定义最小冻结 API；归一化 camelCase scope、受控 locale/unknown、userProfile专属 nativeLocaleState 三值（旧 installation 为 null）、原生资源、严格 ownership-gated English restore availability 与 action code，保持原有命令形状；拒绝snake_case/debug扩展并丢弃raw error/warning prose；`nativeRestoreOnly` 仅允许 `apply_language` 的成功固定英文动作且要求最终语言为 en、无warning/reconciliation/permission/error，不能被 Switch 或其他 API 冒认；固定 project-link ID 为 twitter/xiaohongshu/repository/license/reportIssue/legacyRelease，不接收 renderer URL，其他 URL/路径/debug 仍丢弃。
version-guidance.js: 版本提示与四语简短p12按钮；兼容状态文案键直接消费后端枚举，legacyRelease 按安装 2.7.2 + 后端 olderUnsupported + supportedVersion 2.8.0 精确显露；只提供固定四语按钮名与门控，不推断 semver、不持 URL 或调用 Tauri。
language-scope.js: renderer 语言范围策略的唯一投影层；按冻结Status分别决定Switch/Select资源门与userProfile unset与explicit共用English/Unknown徽章文案，不把localeState当所有权证明、恢复可用性或当前语言推断，另管strict owned-image hostless 英文恢复门、仅Restore确认及宿主无关的英文 verify 与固定英文 apply 阶段key；正常启动沿用p12待机；仅资源故障或待恢复状态投影启动提示；普通Switch由既有requestApply路径直接提交，不访问Tauri或应用文件路径。
ui-text.js: Official说明限定已验证原厂App且无Switcher语言覆盖，不宣称全UI或第三方插件原样；依赖user-profile-text.js并以四语spread合成稳定UI_TEXT，再提供`STATUS_TITLE_KEYS`状态标题路由；默认候选引导只提供本地化label，候选路径由PathDisplay单独呈现；About与主窗单行footer提供四语文案；footer操作提示与可访问名称共用一份copy；统一消费面覆盖Select/Badge/Switch/Update/Restore/Updater、安装级恢复、userProfile英文恢复、旧宿主不支持短提示与2.7.2专用p12入口、权限提示、四语无障碍copy及普通verify Issue，不为子域复制第二份文案。

依赖边界:

- Renderer 只依赖 `window.cavalryI18n`，不读 Tauri command。
- project-link-control.js只接受固定ID，不接收URL。
- 它统一外链调用和失败Toast，不写任务Activity。
- 主窗脚本顺序：tauri-bridge→user-profile-text→ui-text→language-scope→version-guidance→icons→select-control→tooltip-control→path-display→operation-log→permission-handoff→update-progress→toast-control→project-link-control→support-follow-hand→support-footer→about-control→window-controls→app。
- About脚本顺序：tauri-bridge→user-profile-text→ui-text→icons→toast-control→project-link-control→about-window。
- support-footer.js装配固定DOM、四语copy、共享品牌图标和固定链接ID；关注手势只由成功动作提供完整结果句触发，错误/警告/Restore不触发，不改布局或焦点。
- support-footer.css只消费tokens；共享10px底间距不改变内部404px控件布局。
- icons.js先于所有图标消费者。
- window-controls.js只操作固定main/about窗口API；About创建只用showAbout。
- Node VM验证生产源语义；WebView与CSP属于独立外部门。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
