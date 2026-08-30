# renderer/
> L2 | 父级: ../CLAUDE.md

成员清单
index.html: 跨平台语义 DOM 骨架，承载原生标题区、默认隐藏手动选择入口的安装 Item、Trigger 与空值 popup 均保留占位投影的全宽 Select、等宽 Switch/Restore English、三轨 Activity、必要 AlertDialog，并加载共享 Toast；About 内容由独立本地页面承载。
app-icon.png: About 的 128px 本地应用标识投影，字节级复用 Tauri 图标集同尺寸产物，不形成第二套品牌源图或远程依赖。
tokens.css: 离线设计角色唯一真相源；16/14/13px、400/450/500 与 4px 节奏覆盖窗口/控件/Activity/Toast/AlertDialog。语言 blue-subtle 与 Official green-subtle 使用透明边界，基础灰色可保留描边；Toast 保留 shadcn 16px inset 并与 20px 主网格错层。
styles.css: 跨平台 shell、安装 Item、无可见描边的彩色 Badge、item-aligned Select/只读占位行、Tooltip、按钮和 AlertDialog 视觉实现；安装摘要用 Flex 容纳可选文件夹动作且隐藏时不留空轨，AlertDialog 保持 modal 语义但只遮罩标题栏以下任务区，正文自然换行并只保留显式段落边界，Grid 管复合结构，Flex 管一维关系，主窗口禁止滚动。
operation-log.css: 三轨任务视窗的独立视觉层，只消费 tokens.css；中性外框复用 12px panel padding、border 与 radius，idle 单轨双轴居中，running 以 Grid 固定首尾 14/20 Message 并只让中段 Marker 滚动；权限按钮仅在可见时创建第二外层轨道及 8px 间距，普通完成态不被零高隐藏轨道向上挤压；中段按 shadcn Base Marker、Spinner、shimmer 复刻 16px 单色 marker 与统一 8px 关系间距，新行只以不改变布局的 opacity/transform 入场，8px scroll-fade 由 `data-at-start` / `data-at-end` 精确收口，不裁切外框或首尾。
icons.js: Renderer 单一语义图标注册表，集中保存经 MIT 归因的精简 Phosphor Regular SVG path，并只暴露冻结 `create(name)` 工厂；Restore 的稳定语义名映射 FloppyDiskBack，表达从已保存恢复基线写回而非泛化历史回退；事件、Updater 与后续 Toast 复用同一注册表，不接管应用 Logo、macOS 交通灯或 Windows caption 图形。
operation-log.js: 依赖 icons.js 的任务反馈状态机，显式切换 idle/events/running 布局，首尾 Message 按 `word + trailing whitespace` delta 非阻塞更新同一文本节点，并在固定首尾轨道显隐、换行或增量写入后重算中段视窗溢出与起止边缘；中段维护稳定 id 的 ordered upsert，真实 Channel 事件到达后由表现队列保证 running 最短可读时间与相邻阶段落位间隔，慢事件不加等待、错误立即抢占、结果句只在队列末尾出现；短流顶部起排，只有读者仍在 live edge 时才跟随新增 Marker，运行态组合 Spinner/shimmer，终态按语义名取图标。状态机不读取 Tauri、不阻塞事务、不自行推进业务阶段。
update-progress.js: Updater 事件语义适配器，以固定更新引言启动三轨，把 bridge 的 downloading/installing/restarting DTO 压缩为下载、验证并安装、重启三个用户 Marker；下载百分比作为唯一默认可见的阶段次行并在完成后稳定保留 100%，文件名/路径等内部步骤不投影；只调用任务反馈状态机，不发起下载、不持有 Update、不把下载结束误报为已验证，也不伪造跨重启结果。
toast.css: 共享短时通知视觉层，消费 token 投影 shadcn Base Toast 的 16px inset、底部堆叠、16px padding、12px 图文关系、4px copy 间距及 500/250/150ms 动画，不改变主内容 20px 网格。
toast-control.js: 无依赖 Toast 状态机，按 Base UI 1.6.0 提供 5000ms、3 条、loading 常驻、hover/focus/window blur 暂停剩余时间、F6/Escape 与 polite live region；只服务外围失败。
THIRD_PARTY_NOTICES.md: renderer 内适配的 shadcn/ui 组件行为与 Phosphor SVG path 的 MIT 来源和版权通知；仅记录实际进入本地源码的第三方材料，不把远程组件库/CDN 引入运行时。
about.css: About 专属视觉层，复用共享 Tooltip/排印/间距/token，为 Windows 提供 24px 标题栏信息入口，并为独立原生页面提供 64px 应用标识、Switcher 版本、带 GitHub 图形的项目名行与 MIT 许可证链接；不绘制自定义关闭按钮。
window-controls.css: Windows caption 专属视觉层，以 40px 标题栏、右侧 12px 外边距、32px 点击目标和 12px Windows 图形对齐 macOS 的 y=20 中心线；最大化/还原图标分态，关闭按钮有独立危险状态与 forced-colors 回退，不绘制 HWND 外框、阴影或圆角。
select-control.js: 无依赖单选组件状态机，按 Base UI 的 placeholder/open/active/selected 分层投影 combobox/listbox/option ARIA，并以真实布局盒在开启瞬间把只读占位行或真实选中项中心锚定 Trigger；按 shadcn Nova 的 trigger/popup/item/check 构成实现方向键、Home/End、Enter/Space、Escape、typeahead、稳定指针高亮、值变更通知与外部点击收口，不替业务预选默认值，只同步隐藏原生 select。
tooltip-control.js: 无依赖 Tooltip 状态机，复刻 shadcn Base UI 的 delay=0、单开 Provider、hover/focus 打开、click/Escape/focusout 关闭与触摸禁用；Popup portal 到 body 后以 bottom 优先、边缘 shift/top flip 和 Arrow 锚点定位，`aria-describedby` 只在打开期存在，不读取业务或文案。
path-display.js: 无依赖安装位置投影器，Windows 将 executable 路径降为其所在安装目录，macOS 保留 app bundle；不超过 36 字符时完整显示，超限后按路径层级保留盘符/根与末级安装目录，再由可收缩前缀 + 固定末段承担像素级兜底。完整语义位置只保留在 aria-label，禁止原生 title 生成第二套不可控 Tooltip，也不改变后端选择的真实路径。
about-control.js: 无依赖主窗口 About 入口状态机，仅在 Windows 展示标题栏按钮并把点击交给冻结 bridge 的单一 `showAbout` command；Tooltip 委托共享状态机，不持有 About 内容、窗口 URL、版本或关闭焦点状态。
about.html: 独立 About WebviewWindow 页面，复用 tokens/about/toast，显示同源图标、真实版本、项目与许可证入口。
about-window.js: About 页面控制器，固定 repository/license 枚举；默认浏览器失败只在本窗口显示 error Toast，不暴露 URL。
window-controls.js: 无依赖 Windows caption 状态机，只在 `platform=windows` 展示右侧最小化/最大化或还原/关闭，消费 bridge 固定 main-window 操作并在 toggle/resize 后同步最大化状态、四语可访问名称；失败不污染业务任务事件视窗或 AlertDialog，macOS 路径不执行窗口 mutation。
app.js: 唯一业务交互源；文件夹动作只在后端未发现安装、`appPath` 为空时显露，任何已发现安装都保持摘要只读，恢复阻塞由 Activity/AlertDialog 承载；Select 初始只显示本地化占位并在明确选择前禁用 Switch，旧/新/未知 Cavalry 版本统一进入只读门禁，Managed Legacy 继续四语切换且 Restore English 自动退化为受管英文事务；持久任务进入 Activity，Restore English/更新/权限进入 AlertDialog，About 唤起失败进入 Toast。
tauri-bridge.js: 非视觉兼容桥，在业务脚本前定义最小冻结 API；归一化 camelCase payload、稳定 `warningCodes`/updater error codes、四态 `versionCompatibility`、`officialRecoveryAvailable`、Action/Status、脱敏 Update DTO 与 downloading/installing/restarting 有序事件，不暴露独立 snapshot mutation，并将单一 About 唤起、固定 `main` label 的 minimize/toggle/is-maximized/close 暴露给各自状态机；更新安装不接收 renderer 提供的 URL、版本或签名，未知阶段和不安全计数在边界丢弃。
ui-text.js: 稳定的 English/简体中文/繁体中文/日文 renderer 文案与 `STATUS_TITLE_KEYS` 状态标题路由；标题、Windows caption 可访问名称、Select 占位、条件式 Official 徽章、Switch/Restore English/Update 任务上下文与真实阶段事件全部本地化；Switch 文案只表达用户目标，把后端 restart phase 诚实投影为“打开 Cavalry”，Restore 只承诺英文结果而不伪称所有路径都恢复官方 runtime，旧/新/未知版本分别保持用户升级方向与安装只读；重装路径要求重装后重新打开 Switcher，AlertDialog 遵循“结果/风险在标题，影响/恢复在正文”，不暴露 Refresh/snapshot/provenance。

依赖边界:

renderer 不知道业务 Tauri command 或 `.app`/`.exe` 布局；它只依赖 `window.cavalryI18n` 兼容 API。唯一平台例外是 `window-controls.js` 消费固定 `main` label 的四项 Tauri window 命令，About 入口只消费单一 `showAbout`，两者都不能扩成任意窗口管理器。bridge、文案、语义图标与 Select/Tooltip/Path/任务事件/Updater 投影/About/Windows caption 状态机必须在 `app.js` 前加载；icons.js 必须先于任何图标消费者，about.html 只加载冻结 bridge、文案与 About 页面控制器。Node VM 只验证生产源语义，packaged WebView/CSP 属于独立外部门。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
