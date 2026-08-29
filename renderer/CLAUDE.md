# renderer/
> L2 | 父级: ../CLAUDE.md

成员清单
index.html: 跨平台语义 DOM 骨架，在 macOS Overlay 原生交通灯后提供标题/更新入口，Windows 左起位置再提供 About 并在右侧另设三枚原生语义控件；安装 Item 始终显示 Cavalry 当前语言，仅在 macOS 官方运行时验证通过时追加 Official 徽章，路径拆为可收缩前缀和保留末段，语言主任务使用隐藏原生数据槽 + combobox/listbox 语义骨架，收敛为全宽 Select、等宽 Switch/Restore 与 idle/任务引言/中段 Marker/整体结果四个稳定锚点；标题栏 Tooltip 具备 Popup/Arrow 锚点，Restore、更新、权限和危险操作走独立 AlertDialog；About 内容不再嵌入主窗口，由独立本地页面承载。
app-icon.png: About 的 128px 本地应用标识投影，字节级复用 Tauri 图标集同尺寸产物，不形成第二套品牌源图或远程依赖。
tokens.css: 离线设计角色的唯一真相源，按颜色/徽章、排印、边界/阴影、窗口 Chrome、布局/控件、Select、Tooltip/Dialog 与状态/动效边界组织语义 token；排印只允许 16/14/13px 与 400/450/500，间距以 4px 节奏为主；语言身份使用 Geist purple-subtle，只有验证通过的 Official 使用 green-subtle，不为组合状态制造色彩。Marker/ScrollArea/Tooltip/Dialog 源码特有规格必须先进入语义 token，并在消费处说明例外来源。
styles.css: 跨平台共享 shell、安装 Item、Select、Tooltip、按钮和 AlertDialog 视觉实现，只消费 tokens.css 且不定义私有设计常量；16/14/13px 与 400/450/500 复用系统字体排印角色。Grid 管 400×480 窗口内的 shell、安装卡片、Select/双动作复合轨道与 Dialog 结构，Flex 管标题/徽章/路径/按钮等一维关系；安装路径以前缀弹性省略并保留末段，Tooltip 采用 shadcn Base Nova 的 Popup/Arrow 几何并由状态机提供 portal 定位；内容宽 360px、四边 20px、动作轨道为 170px + 20px + 170px，标题栏为 40px（交通灯 16px、上下各 12px），结构 gap 为 8px，并以 64px 原生占位补偿点击盒/SVG 内缩，使“绿灯可见右缘—标题字形—升级圆环可见左缘”两段实体间距同为约 12px；主窗口禁止滚动，Select 列表与任务事件视窗各自在自身边界内滚动。
operation-log.css: 三轨任务视窗的独立视觉层，只消费 tokens.css；中性外框复用 12px panel padding、border 与 radius，idle 单轨双轴居中，running 以 Grid 固定首尾 14/20 Message 并只让中段 Marker 滚动；权限按钮仅在可见时创建第二外层轨道及 8px 间距，普通完成态不被零高隐藏轨道向上挤压；中段按 shadcn Base Marker、Spinner、shimmer 复刻 16px 单色 marker 与统一 8px 关系间距，新行只以不改变布局的 opacity/transform 入场，8px scroll-fade 不裁切外框或首尾。
icons.js: Renderer 单一语义图标注册表，集中保存经 MIT 归因的精简 Phosphor Regular SVG path，并只暴露冻结 `create(name)` 工厂；事件、Updater 与后续 Toast 通过稳定语义名复用，不接管应用 Logo、macOS 交通灯或 Windows caption 图形。
operation-log.js: 依赖 icons.js 的任务反馈状态机，显式切换 idle/events/running 布局，首尾 Message 按 `word + trailing whitespace` delta 非阻塞更新同一文本节点，中段维护稳定 id 的 ordered upsert；真实 Channel 事件到达后由表现队列保证 running 最短可读时间与相邻阶段落位间隔，慢事件不加等待、错误立即抢占、结果句只在队列末尾出现；短流顶部起排，只有读者仍在 live edge 时才跟随新增 Marker，运行态组合 Spinner/shimmer，终态按语义名取图标。状态机不读取 Tauri、不阻塞事务、不自行推进业务阶段。
update-progress.js: Updater 事件语义适配器，以固定更新引言启动三轨，把 bridge 的 downloading/installing/restarting DTO 压缩为下载进度、验证并安装、重启三个用户 Marker；只调用任务反馈状态机，不发起下载、不持有 Update、不把下载结束误报为已验证，也不伪造跨重启结果。
THIRD_PARTY_NOTICES.md: renderer 内适配的 shadcn/ui 组件行为与 Phosphor SVG path 的 MIT 来源和版权通知；仅记录实际进入本地源码的第三方材料，不把远程组件库/CDN 引入运行时。
about.css: About 专属视觉层，复用共享 Tooltip/排印/间距/token，为 Windows 提供 24px 标题栏信息入口，并为独立原生页面提供 64px 应用标识、Switcher 版本、带 GitHub 图形的项目名行与 MIT 许可证链接；不绘制自定义关闭按钮。
window-controls.css: Windows caption 专属视觉层，以 40px 标题栏、右侧 12px 外边距、32px 点击目标和 12px Windows 图形对齐 macOS 的 y=20 中心线；最大化/还原图标分态，关闭按钮有独立危险状态与 forced-colors 回退，不绘制 HWND 外框、阴影或圆角。
select-control.js: 无依赖单选组件状态机，按 Base UI 的 open/active/selected 分层投影 combobox/listbox/option ARIA，并以真实布局盒让选中项中心锚定 Trigger；按 shadcn Nova 的 trigger/popup/item/check 构成实现方向键、Home/End、Enter/Space、Escape、typeahead、指针高亮与外部点击收口，只同步隐藏原生 select，不读取业务或 Tauri 状态。
tooltip-control.js: 无依赖 Tooltip 状态机，复刻 shadcn Base UI 的 delay=0、单开 Provider、hover/focus 打开、click/Escape/focusout 关闭与触摸禁用；Popup portal 到 body 后以 bottom 优先、边缘 shift/top flip 和 Arrow 锚点定位，`aria-describedby` 只在打开期存在，不读取业务或文案。
path-display.js: 无依赖安装位置投影器，Windows 将 executable 路径降为其所在安装目录，macOS 保留 app bundle；不超过 36 字符时完整显示，超限后按路径层级保留盘符/根与末级安装目录，再由可收缩前缀 + 固定末段承担像素级兜底。完整语义位置只保留在 aria-label，禁止原生 title 生成第二套不可控 Tooltip，也不改变后端选择的真实路径。
about-control.js: 无依赖主窗口 About 入口状态机，仅在 Windows 展示标题栏按钮并把点击交给冻结 bridge 的单一 `showAbout` command；Tooltip 委托共享状态机，不持有 About 内容、窗口 URL、版本或关闭焦点状态。
about.html: 独立 About WebviewWindow 的本地语义页面，复用 tokens/about.css，显示 64px 应用图标、真实 Switcher 版本、Cavalry-i18n 项目行与 MIT License，不创建第二套窗口控制。
about-window.js: 独立 About 页面控制器，消费已有 bridge 的 `getSwitcherVersion` 与固定 `openProjectLink` 枚举，完成四语文案和链接事件绑定；不创建窗口、不暴露 URL。
window-controls.js: 无依赖 Windows caption 状态机，只在 `platform=windows` 展示右侧最小化/最大化或还原/关闭，消费 bridge 固定 main-window 操作并在 toggle/resize 后同步最大化状态、四语可访问名称；失败不污染业务任务事件视窗或 AlertDialog，macOS 路径不执行窗口 mutation。
app.js: 唯一业务交互源，按系统语言本土化 UI，调用冻结 bridge 与独立 Select/Tooltip/Path/任务反馈状态机完成跨平台状态读取、`uninitialized/loading/ready` 控件门禁、Cavalry 当前语言与条件式 Official 徽章、受控语言选择、更新检查/通知/确认/安装重启、安装位置选择与平台统一 Restore；Switch 不设冗余确认，直接进入后端 fail-before-mutation 事务，运行中的 Cavalry 只产生可恢复阻塞而不会被强停；首次非英文 Switch 允许后端在写入前自动建立可信恢复基线，macOS Restore 映射完整官方还原，Windows Restore 映射 English + QPA/generic cleanup；Switch/Restore 先投影不阻塞事务的引言，再投影四个真实阶段，只有无 warning 的完整成功路径才写入带本地标点的结果 Message；持久阻塞留在事件视窗，Restore、更新、权限和危险操作才使用 AlertDialog；更新图标生产默认隐藏，仅由 updater 检查到可用版本或 loopback 开发 preview 展示。
tauri-bridge.js: 非视觉兼容桥，在业务脚本前定义最小冻结 API；归一化 camelCase payload、稳定 `warningCodes`/updater error codes、Action/Status、脱敏 Update DTO 与 downloading/installing/restarting 有序事件，不暴露独立 snapshot mutation，并将单一 About 唤起、固定 `main` label 的 minimize/toggle/is-maximized/close 暴露给各自状态机；更新安装不接收 renderer 提供的 URL、版本或签名，未知阶段和不安全计数在边界丢弃。
ui-text.js: 稳定的 English/简体中文/繁体中文/日文 renderer 文案与 `STATUS_TITLE_KEYS` 状态标题路由；标题、Windows caption 可访问名称、条件式 Official 徽章、Switch/Restore/Update 任务上下文与真实阶段事件全部本地化；Switch 文案只表达用户目标，把后端 restart phase 诚实投影为“打开 Cavalry”，AlertDialog 遵循“结果/风险在标题，影响/恢复在正文”，不暴露 Refresh/snapshot/provenance；更新文案覆盖 tooltip、确认、下载/验证安装/重启、稳定错误与 macOS 新包 ad-hoc/Gatekeeper 提醒。

依赖边界:

renderer 不知道业务 Tauri command 或 `.app`/`.exe` 布局；它只依赖 `window.cavalryI18n` 兼容 API。唯一平台例外是 `window-controls.js` 消费固定 `main` label 的四项 Tauri window 命令，About 入口只消费单一 `showAbout`，两者都不能扩成任意窗口管理器。bridge、文案、语义图标与 Select/Tooltip/Path/任务事件/Updater 投影/About/Windows caption 状态机必须在 `app.js` 前加载；icons.js 必须先于任何图标消费者，about.html 只加载冻结 bridge、文案与 About 页面控制器。Node VM 只验证生产源语义，packaged WebView/CSP 属于独立外部门。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
