# renderer/
> L2 | 父级: ../CLAUDE.md

成员清单
index.html: 跨平台语义 DOM 骨架，承载原生标题区、默认隐藏手动选择入口的安装 Item、Trigger 与空值 popup 均保留占位投影的全宽 Select、等宽 Switch/Restore English、三轨 Activity、必要 AlertDialog，并按 bridge→视觉状态机→permission handoff→app 顺序加载共享行为；About 内容由独立本地页面承载。
app-icon.png: About 的 128px 本地应用标识投影，字节级复用 Tauri 图标集同尺寸产物，不形成第二套品牌源图或远程依赖。
tokens.css: 离线设计角色唯一真相源；16/14/13px、400/450/500 与 4px 节奏覆盖窗口/控件/Activity/Toast/AlertDialog，About 标识由 64px 基准加一个 4px 档得到 68px。informational blue 精确投影 Vercel 发布的 `vbg-blue-700`，同时服务语言 blue-subtle 文本与权限引导；Official green-subtle 独立表达更新/通过语义，彩色 Badge 使用透明边界，基础灰色可保留描边；Activity 的 warning/danger 只服务语义图标，权限阻断使用不受 Reduce Motion 消除的共享可读停顿，Toast 保留 shadcn 16px inset 并与 20px 主网格错层。
button.css: 无框架 Button 基础 primitive；按锁定 shadcn Base Button 源码统一 inline-flex、disabled、SVG 与 ghost/icon-xs/icon-sm 状态，全部普通动作与 Toast 关闭共同消费，Select Trigger 因拥有独立 combobox 状态机而明确隔离。
styles.css: 跨平台 shell、安装 Item、无可见描边的彩色 Badge、item-aligned Select/只读占位行、Tooltip、按钮和 AlertDialog 视觉实现；更新可用入口以组合选择器覆盖共享 ghost 中性色并稳定保持 green token，安装摘要用 Flex 容纳可选文件夹动作且隐藏时不留空轨，AlertDialog 保持 modal 语义但只遮罩标题栏以下任务区，正文自然换行并只保留显式段落边界，Grid 管复合结构，Flex 管一维关系，主窗口禁止滚动。
operation-log.css: 三轨任务视窗的独立视觉层，只消费 tokens.css；中性外框复用 12px panel padding、border 与 radius，idle 单轨双轴居中，running 以 Grid 固定首尾 14/20 Message 并只让中段 Marker 滚动；权限按钮仅在可见时创建第二外层轨道及 8px 间距，普通完成态不被零高隐藏轨道向上挤压；中段按 shadcn Base Marker、Spinner、shimmer 复刻 16px 单色 marker 与统一 8px 关系间距，warning/error 用 amber/danger 图标与中性前景标题编码，说明/事件行/外框继续收敛为中性，新行只以不改变布局的 opacity/transform 入场，8px scroll-fade 由 `data-at-start` / `data-at-end` 精确收口，不裁切外框或首尾。
icons.js: Renderer 单一语义图标注册表，集中保存经 MIT 归因的精简 Phosphor Regular SVG path 与项目自有权限 handoff 实心箭头，并只暴露冻结 `create(name)` 工厂；Restore 映射 FloppyDiskBack，打开 Cavalry 映射 Play，事件拖入映射 ArrowUp，权限交接返回映射 CaretLeft、视觉提示使用独立 clean-room glyph，Windows caption 映射 Minus/Square/Copy/X；事件、Updater、Toast 与窗口控件只消费语义名，不接管应用 Logo 或 macOS 交通灯。
operation-log.js: 依赖 icons.js 的任务反馈状态机，显式切换 idle/events/running 布局，首尾 Message 按 `word + trailing whitespace` delta 非阻塞更新同一文本节点，并在固定首尾轨道显隐、换行或增量写入后先同步、再于浏览器下一布局帧复测中段视窗溢出与 live edge，避免带说明的终态因旧行高停在视窗外；中段维护稳定 id 的 ordered upsert，真实 Channel 事件到达后由表现队列保证 running 最短可读时间与相邻阶段落位间隔，慢事件不加等待、错误或显式阻断立即抢占，阻断可向业务层返回完成落位后的共享可读停顿，外部权限按钮轨显隐后复用同一重测入口；权限同进程 oracle 不通过 start 清空既有历史，也不合成 resume 旁白，业务层折叠已经成功展示过的 verify/baseline 前置阶段，只追加新增结果或真实失败；结果句只在队列末尾出现。短流顶部起排，只有读者仍在 live edge 时才跟随新增 Marker，运行态组合 Spinner/shimmer，终态按语义名取图标。状态机不读取 Tauri、不阻塞后端事务、不自行推进业务阶段。
permission-handoff.js: App Management 权限交接控制器；在原 AlertDialog 仍可见时冻结真实动作的 CSS rect 与 viewport，等待固定 bridge 确认 native 已接管后才关闭 source，并只把本 session Channel 的 retryRequested 重放到原写事务；同一 session 的重复 Retry/drop 在前次事务返回前折叠为一次，设置已打开、窗口已定位或 file-URL drop 均不冒充授权成功。
update-progress.js: Updater 事件语义适配器，以固定更新引言启动三轨，把 bridge 的 downloading/installing/restarting DTO 压缩为下载、验证并安装、重启三个用户 Marker；下载百分比作为唯一默认可见的阶段次行并在完成后稳定保留 100%，文件名/路径等内部步骤不投影；只调用任务反馈状态机，不发起下载、不持有 Update、不把下载结束误报为已验证，也不伪造跨重启结果。
toast.css: 共享短时通知视觉层，消费 Button/token 投影 shadcn Base Toast 的 16px inset、底部堆叠、16px padding、12px 图文关系、4px copy 间距及 500/250/150ms 动画，不改变主内容 20px 网格。
toast-control.js: 无依赖 Toast 状态机，按 Base UI 1.6.0 提供 5000ms、3 条、loading 常驻、hover/focus/window blur 暂停剩余时间、F6/Escape 与 polite live region；关闭动作复用共享 Button，只服务外围失败。
THIRD_PARTY_NOTICES.md: renderer 内适配的 shadcn/ui 组件行为与 Phosphor SVG path 的 MIT 来源和版权通知；仅记录实际进入本地源码的第三方材料，不把远程组件库/CDN 引入运行时。
about.css: About 专属视觉层，复用主窗口 Overlay 标题栏、共享 Tooltip/排印/间距/token；macOS 以同一 40px 标题栏和原生交通灯承载窗口身份，Windows 保留原生装饰，同时让 68px 应用标识、Switcher 版本、项目与许可证链接在内容区上下等距；不复制标题栏几何或绘制自定义关闭按钮。
window-controls.css: Windows caption 的 Button 变体层；40px 标题栏内放置三枚 32px ghost icon-sm Button，以 4px 间距、16px Phosphor 图标和右侧 12px 外边距对齐共享网格；关闭按钮只在 hover/active 进入危险态，保留 forced-colors，不绘制 HWND 外框、阴影或圆角。
select-control.js: 无依赖单选组件状态机，按 Base UI 的 placeholder/open/active/selected/disabled 分层投影 combobox/listbox/option ARIA，并以真实布局盒在开启瞬间把只读占位行或真实选中项中心锚定 Trigger；按 shadcn Nova 的 trigger/popup/item/check 构成实现跳过禁用项的方向键、Home/End、Enter/Space、Escape、typeahead、稳定指针高亮、值变更通知与外部点击收口，不替业务预选默认值，只同步隐藏原生 select。
tooltip-control.js: 无依赖 Tooltip 状态机，复刻 shadcn Base UI 的 delay=0、单开 Provider、hover/focus 打开、click/Escape/focusout 关闭与触摸禁用；Popup portal 到 body 后以 bottom 优先、边缘 shift/top flip 和 Arrow 锚点定位，`aria-describedby` 只在打开期存在，不读取业务或文案。
path-display.js: 无依赖安装位置投影器，Windows 将 executable 路径降为其所在安装目录，macOS 保留 app bundle；不超过 36 字符时完整显示，超限后按路径层级保留盘符/根与末级安装目录，再由可收缩前缀 + 固定末段承担像素级兜底。完整语义位置只保留在 aria-label，禁止原生 title 生成第二套不可控 Tooltip，也不改变后端选择的真实路径。
about-control.js: 无依赖主窗口 About 入口状态机，仅在 Windows 展示标题栏按钮并把点击交给冻结 bridge 的单一 `showAbout` command；Tooltip 委托共享状态机，不持有 About 内容、窗口 URL、版本或关闭焦点状态。
about.html: 独立 About WebviewWindow 页面，复用主窗口 titlebar DOM 语义与 tokens/styles/about/toast，显示同源图标、真实版本、项目与许可证入口；标题栏只标识软件，About 语义由内容承担。
about-window.js: About 页面控制器，固定 repository/license 枚举；默认浏览器失败只在本窗口显示 error Toast，不暴露 URL。
window-controls.js: Windows caption 状态机，只在 `platform=windows` 展示右侧最小化/最大化或还原/关闭，消费图标注册表与 bridge 固定 main-window 操作并在 toggle/resize 后同步最大化状态、四语可访问名称；系统 API 继续拥有行为，失败不污染业务任务事件视窗或 AlertDialog，macOS 路径不执行窗口 mutation。
app.js: 唯一业务交互源；文件夹动作只在后端未发现安装时显露，Select 保留但禁用当前语言，非支持版本进入只读门禁；已证明的 Managed Legacy 即使当前 strict codesign 漂移也继续四语切换，旧 Switcher 自有签名副作用由后端事务静默收敛而不成为产品状态；后端 `macosPermissionHandoffRequired` 为真时，Switch/Restore 在调用 `applyLanguage` 前先进入既有 handoff，Activity 下方始终保留可再次打开权限设置的小按钮，设置打开与 drop 均不冒充已授权，file-URL drop 只触发一次真实 oracle；后续 typed PermissionDenied 保留 Activity 历史并要求重开；Updater、Cavalry 打开阶段、Toast 继续保持各自语义边界。
tauri-bridge.js: 非视觉兼容桥，在业务脚本前定义最小冻结 API；归一化 camelCase payload、稳定 warning/updater codes、四态版本、官方恢复、后端证明的 `macosPermissionHandoffRequired`、Action/Status 与脱敏 Update DTO；内部签名清理事实不进入 renderer 契约，App Management 入口只发送固定 permission、有限 source rect/CSS viewport 与独立 Channel，不接受任意设置 URL。
ui-text.js: 稳定的 English/简体中文/繁体中文/日文 renderer 文案与 `STATUS_TITLE_KEYS` 状态标题路由；覆盖 Select、Badge、Switch/Restore、Updater 与首次权限前导；只有版本/结构或恢复基线真正不可用时才给出重开后再官方重装的恢复路径，内部兼容清理不生成文案，权限文案只陈述用户动作，不声称设置已授予权限；AlertDialog 遵循“结果/风险在标题，影响/恢复在正文”。

依赖边界:

renderer 不知道业务 Tauri command 或 `.app`/`.exe` 布局；它只依赖 `window.cavalryI18n` 兼容 API。唯一平台例外是 `window-controls.js` 消费固定 `main` label 的四项 Tauri window 命令，About 入口只消费单一 `showAbout`，两者都不能扩成任意窗口管理器。bridge、文案、语义图标与 Select/Tooltip/Path/任务事件/Updater 投影/About/Windows caption 状态机必须在 `app.js` 前加载；icons.js 必须先于任何图标消费者，about.html 只加载冻结 bridge、文案与 About 页面控制器。Node VM 只验证生产源语义，packaged WebView/CSP 属于独立外部门。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
