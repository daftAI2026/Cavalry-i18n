<!--
[INPUT]: 依赖 renderer 生产源码、共享 Button/语义图标、UI Review fixture platform、Tauri 平台窗口配置、AppKit 实机 AX/像素轮廓、Windows DWM/Tauri 官方窗口合同与本轮 UI 裁决
[OUTPUT]: 对外提供 Switcher 最终 UI 的跨平台构建规格、直接 Switch/单一 Restore 任务流、idle 居中/首尾 Message/中段 Marker 三轨任务视窗、Event/AlertDialog/Toast 反馈语义矩阵、无滚动窗口、原生窗口所有权、几何 token、Button/Select/About 组件边界、UI Review 平台外壳同步、三类证据分层、macOS 外圆角测量口径与 Windows 自绘标题栏边界
[POS]: docs/audits 的 UI 事实基线；约束实现与评审，但不替代 LOCAL_BUILD_SOP、packaged gate 或 Windows 实机验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Switcher UI 最终构建规格（2026-08-28）

状态: Active — 当前代码几何为 400×484，macOS native dev 已按新高度重验；package 与 Windows 真机证据仍待验证
适用版本: Cavalry Language Switcher `0.7.0` 候选
视觉真相源: `renderer/index.html`、`renderer/tokens.css`、`renderer/button.css`、`renderer/styles.css`、`renderer/icons.js`、`renderer/window-controls.css`、`renderer/window-controls.js`、`renderer/operation-log.css`、`renderer/operation-log.js`、`renderer/update-progress.js`、`renderer/select-control.js`、`renderer/about.css`、`renderer/about-control.js`、`renderer/about.html`、`renderer/about-window.js`
窗口真相源: `src-tauri/tauri.conf.json`、`src-tauri/src/lib.rs`、平台覆盖配置
最新现场证据: 当前 native dev 的 Tauri 逻辑配置为 `400×484`，AX/CGWindow 外框按 AppKit 语义报告 `400×485`，截图 `/tmp/cavalry-native-400x484.png` 显示当前真实 blocker 投影与加高后的 Activity。localhost UI Review 已改为直接加载同一生产 renderer，只用 fixture bridge 切换场景；其 Activity 因而天然复用 `360×176`、12px padding、94px 中段，不再以独立手绘原型声称同构。UI Review 的外围平台示意必须与同一 fixture 的 `platform` 同步：Windows fixture 不得出现 macOS 交通灯或占位，macOS fixture 不得出现 Windows caption。这些不替代 package/manual smoke 或 Windows live。

## 1. 设计原则

1. 内容层跨平台共用，系统外框按平台所有权分流。
2. Grid 管窗口 shell、Select/双动作复合轨道、任务事件视窗与 AlertDialog 的复合结构；Flex 管安装摘要与可选手动入口、标题、徽章、按钮和 Marker 行等一维关系。
3. macOS 不伪造交通灯；Windows 不照搬交通灯，而在右侧提供 Windows 原生语义的最小化、最大化/还原、关闭。
4. 不用透明 WebView 手画系统阴影和外轮廓。macOS 交给 AppKit/WindowServer；Windows 交给 HWND/DWM。
5. 数值必须有语义 token 或原生几何来源，禁止用散落魔法数字微调截图；`renderer/tokens.css` 是唯一可调设计常量源，`button.css`、`styles.css`、`operation-log.css` 与 `window-controls.css` 不得定义私有设计变量。4px 是默认节奏；少量组件源码特有值必须先 token 化并在消费处注明来源。
6. Vercel Design MD 负责角色、层级、系统字体与节奏原则；shadcn/Base UI 源码只提供需要的结构和状态参考。项目不引入组件库、Tailwind、CDN 或第二套 token。

## 2. 冻结几何

| 语义 | 值 | 依据 |
| --- | ---: | --- |
| 默认窗口 | `400 × 484px` | 当前 Tauri 逻辑配置；新增 4px 全部归入 Activity，不挤占既有间距 |
| 最小窗口 | `400 × 484px` | 主任务一屏完成；主窗口禁止滚动，Select 与任务事件视窗各自处理内部溢出 |
| Activity | 外框 `360 × 176px`；padding `12px`；中段视窗 `94px` | UI Review 直接消费生产实现；首尾 Message、8px 关系与上游几何不变 |
| 内容轨道 | `360px` | `400 - 20 - 20`；内容四边 padding 均为 `20px` |
| 标题栏 | `40px` | `12 + 16 + 12`：交通灯上下留白各 `12px` |
| macOS 交通灯 | `16 × 16px` | 原生 AppKit 控件；目标中心线为 `y = 20px` |
| 标题栏动作 | 更新图形 `20px`；纯圆点击区 `24 × 24px` | 更新入口只在有可用更新或 loopback preview 时出现 |
| 标题结构间距 | `8px` | Flex 盒关系使用同一 4px 节奏；实体图形还需计入原生灯位与 SVG 在点击盒内的留白 |
| 标题栏中心线 | `y = 20px` | 标题、更新图形及 Windows caption 图形共享视觉中心 |
| 应用图标路径 | 开发态 `icon.png` / 正式包 `icon.icns` / About `128x128.png` | 系统负责最终圆角 mask、尺寸和效果，但不替开发者重新决定内部 artwork 比例；本项目不拿裸 debug 进程的外观改写正式包，只要求开发态 512px 图与 `icns` 同尺寸表示像素同构，About 字节复用 tracked 128px 投影 |
| Windows caption | `3 × 32px` 点击目标，`4px` 相邻间距，`16px` 图形，右边距 `12px` | 三枚动作消费共享 Button 的 `ghost + icon-sm`；只替换视觉，不接管系统行为 |
| 动作轨道 | `170px + 20px + 170px` | 两枚按钮在 `360px` 内容轨道内等宽；不因语言改变列定义 |
| 主任务节奏 | 以 `4px` token 组合 | 板块之间、字段关系和内边距均由语义 token 组合，不以未命名数字补偿字形 |
| 面板内边距 | 安装 Item 与任务事件容器都使用 `padding-panel` | 任务容器保留中性 border/radius 与统一内边距；scroll-fade 只作用于 padding 内的滚动视窗，不遮蔽外框，也不继承 Alert 的红色风险语义 |
| 主控件高度 | `36pt` | Select 与动作 Button 共用 |
| Button / 面板圆角 | `8px / 10px` | `radius-md` 与 `radius-lg` 分离动作控件和容器层级 |
| Select 圆角 | Trigger `10pt`、Popup `10pt`、Item `8pt` | 复刻 shadcn Nova/Base UI Select 当前源码角色，不再强行套用 Button 圆角 |
| macOS 实体标题关系 | 约 `12px` | 比较绿灯可见右缘、标题字形与升级 SVG 圆环，不比较 DOM 占位盒；结构 gap 保持 `8px`，64px 原生占位吸收两侧图形内缩 |

Apple 当前 App icon 合同是开发者提供居中的未遮罩图层，由系统施加平台外形 mask 与效果；Icon Composer 仍由设计者调整 layer 的 position/scale，再由系统生成平台与外观变体。因此自动 mask 不等于运行时替 artwork 做光学缩放。Switcher 仍走 Tauri 静态 PNG/ICNS 路径，不在本轮为修一个 dev runtime 漂移引入 Xcode `.icon` 资产链。[Apple App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons?param1=online-sales) · [Creating your app icon using Icon Composer](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer?changes=_1)

主内容排印只允许三个字号和三个标准字重：

| 角色 | 字号 / 字重 | 消费者 |
| --- | --- | --- |
| Heading | `16px / 450`；独立 Dialog 标题按组件语义可用 `500` | 窗口标题、Cavalry 安装名称、AlertDialog 标题 |
| Body | `14px / 400` 或 `500` | Section 标题、Select、动作、AlertDialog 正文与任务事件标题 |
| Meta | `13px / 400`；徽章使用 `450`，必要强调可用 `500` | 路径、徽章、Tooltip、任务说明与辅助文本；小尺寸徽章提升一级字重保证可读性，仍依靠文字、填充色和胶囊形状共同表达类别 |

不再使用 `10/12px`、`600` 或其他临时中间级别。字体继续使用平台系统栈而非引入 Geist：`design.md` 的报告网站品牌合同要求 Geist，但本项目是离线原生工具，应遵循其“角色一致、对等元素同规格、强调稀缺”的排印原则，而不是照搬报告品牌字体或远程资源。[Vercel design.md](https://vercel.com/design.md)

排印角色只定义字号、字重和行高；字形边界不能成为第二套几何系统。标题栏、安装摘要和 Dialog 依靠各自的 token 行盒完成对齐，不能通过局部负 margin 或未命名数字修正截图。

安装摘要表达“安装位置”而不是重复文件选择结果。macOS 保留 `.app` bundle 路径，标准 `/Applications/Cavalry.app` 可完整显示；Windows 将末尾 `.exe` 降为其所在安装目录。不超过 36 个 Unicode 字符时完整展示，超限后按路径层级从中间省略，至少保留盘符/根和末级安装文件夹，例如 `C:\Users\…\Cavalry`。完整语义位置只进入 `aria-label`，不设置会触发 WebView 原生悬浮窗的 HTML `title`；CSS 的弹性省略只是窗口像素继续不足时的第二道兜底。

安装摘要、Switch to、Select、双动作行与任务事件视窗属于同一主任务流。正常路径由后端自动发现唯一 Cavalry 安装，安装摘要只陈述事实，不常驻手动维护动作；文件夹选择入口默认隐藏，且只在后端未发现安装、`appPath` 为空时出现。已发现但需要重装、恢复或权限处理的安装仍是同一个目标，其阻塞与下一步由 Activity/AlertDialog 承载，不能再暴露一个会暗示“换目录即可修复”的文件夹动作；外部重装完成后由启动探测重新识别同一路径。可选入口与摘要使用一维 Flex，隐藏后不保留空 Grid 轨道或假间距。`Switch to` 到 Select 使用唯一的 `8px` 字段关系 token；事件视窗是有界过程与结果输出。持久阻塞直接留在视窗，不再用 toast 重复同一事实；Switch 直接开始，只有 Restore、Updater、权限和危险操作才进入独立 AlertDialog。因此主窗口高度不由某条异常正文无限撑开。

当前实现用 Grid 固定主窗口的复合轨道，并让任务事件视窗成为 `minmax(0, 1fr)`；`operation-log.css` 再以 Flex 管每条 Marker。`html/body/.content` 禁止窗口级滚动，Select 列表和事件视窗只在自身边界内滚动。业务分割线不承担层级，层级由留白与边界 token 表达。

当前语言徽章是说明性类别元数据，不是信任状态。`design.md` 只提供“颜色必须增加语义”的上位原则，并不直接发布本项目使用的 Badge HEX；具体角色来自 Geist Badge/Colors：四种语言统一投影 informational `blue-subtle`，Official 投影 `green-subtle`，再由 `tokens.css` 固化为本项目 `--badge-language-*` / `--badge-green-*` 语义 token。gray 在语义上同样成立，但当前界面的路径、禁用控件、次级文字与边框已经大量使用灰阶，语言徽章继续用 gray 会退成背景噪声；紫色则制造无来源的分类强调。green 继续只属于验证通过的 Official 与更新动作，amber/red 保留给警告/错误。对照 shadcn Badge variant 后，blue/green 填充变体使用透明边界，不再额外绘制同色描边；基础 gray/outline 变体仍可保留可见边线。透明 `1px` 只维持既有 20px 盒模型，不形成视觉描边。Badge 文字颜色使用不带 alpha 的实色，并以 `13px / 450` 提升小尺寸可读性；不能通过透明度制造弱层级。Switcher 的 pending journal 或启动恢复失败不是 Cavalry 本体状态，不进入安装徽章，只通过事件视窗、独立 AlertDialog、操作锁和恢复路径表达。两枚徽章即使相邻也不会混写维度，且文字仍是颜色之外的必要语义线索。[Vercel design.md](https://vercel.com/design.md) [Geist Badge](https://vercel.com/geist/badge) [Geist Colors](https://vercel.com/geist/colors)

### 2.1 Select 源码对齐

Select 不引入 React、Base UI、shadcn、Tailwind 或 CDN。实现只借鉴 shadcn Base Nova 的语义结构与状态边界：Trigger、Popup、Item、selected indicator 分层，`placeholder/open/active/selected` 不混用；项目自身几何由 `tokens.css` 约束为 `36px` 控件高度、`14px` 文字、`8px` 内容关系和 `16px` chevron。初始状态显示本地化占位文案，不暗中选择第一种语言；只有用户明确 commit 选项后才启用 Switch。源码特有的 Item 高度、指示器位置和弹层 padding 也只能通过 Select token 表达，不能在业务脚本中散落偏移。

Base UI 默认 `alignItemWithTrigger=true` 不是“菜单固定出现在控件下方”。`select-control.js` 在 Popup 显示后读取 Trigger 与选中 Item 的真实 layout box，推导 Popup top，使两者视觉中心重合；不为不同字体和语言硬编码偏移。键盘、typeahead、指针高亮、selected 与 active 状态仍保持分离，列表只在自己的 max-height 内滚动。[shadcn Base UI Select](https://ui.shadcn.com/docs/components/base/select)

### 2.2 任务事件视窗源码对齐

主界面的下半区不是 Alert，也不是无差别日志，而是当前用户任务的有界三轨视窗。它保留原结果框的外边界、圆角与内部 padding，以稳定空间层级；容器本身保持中性，不因某一行失败而整体冒充 Alert。健康 idle 在完整内容区双轴居中显示一句四语任务邀请；Apply、Restore 或 Update 经 AlertDialog 确认后，固定顶部任务引言 Message、中段 Marker 视窗和底部整体结果 Message。流式范围严格限定为首尾 Message；Marker 标题、阶段次行、Toast 与 AlertDialog 不流式。Message 不显示机械光标，也不让每个 chunk 单独淡入，而是按 shadcn helper 的 `word + trailing whitespace` text delta 更新同一文本节点；表现层不被 await，因此不延迟真实事务。没有可见的 `Action`、`Status`、`Log` 泛化标题，屏幕阅读器仍通过隐藏标题获得区域名称。

任务必须有首尾闭环：引言说明意图，Marker 记录过程，Switch/Restore 四阶段全部成功后再出现一条整体结果 Message，例如“已切换为简体中文，Cavalry 已打开。”或“已恢复官方英文状态，Cavalry 已打开。”。结果是完整 Body Message 句子，English 用 `.`、简繁中文与日本語用 `。` 收尾；Marker 短标签不加句号。容器保留一层外边框并显式建模布局状态：idle 是覆盖完整内容区的单轨，任务邀请以整个外框为参照双轴居中；running 才使用 `auto minmax(0, 1fr) auto` 三轨，顶部引言 Message 与底部结果 Message 固定在 scroll-fade 外，中间无边框视窗只滚动四个阶段 Marker。禁止依赖隐藏元素是否参与 Grid 排版来碰巧实现居中。这条结语不是最后一个阶段的改名，也不能在 warning/error 路径出现。Updater 安装后会终止当前进程；在新进程尚无一次性、版本绑定的完成凭据前，不显示不可验证且通常不可见的 Update 成功结语。

`operation-log.js` 只维护 idle/events/running 布局、稳定 id 的 ordered upsert/replace、首尾 Message delta、安全文本投影与已到达事件的表现队列；MarkerIcon/MarkerContent 承担图标与文案，组件不拥有业务编排。后端事务不等待动画：首个真实阶段立即出现，若 `running → terminal` 快于 `360ms`，只在视觉层补足剩余时间；相邻新 Marker 至少隔开 `120ms`。后端本来更慢时不叠加延迟，error 或 typed 阻塞则立即中断等待、同步已到达前序事实并抢占当前阶段，未来阶段与成功结语不得出现；权限拒绝将真正失败的 phase 原位变成带说明的 warning，而不是清空历史。新行入场只动画 opacity/transform，不改变 height/margin/padding；reduced-motion 下表现时序和入场归零。第一条记录从外框 `12px` panel padding 后的中段顶部开始，未溢出时明确保持 `scrollTop=0`；记录逐条向下增长，只有读者仍处于 live edge 时，新事件才让中段跟随到底部。用户滚离底部后不再抢位，重新回到底部才恢复跟随。Marker 次行或 Message 变化可能在当前脚本栈之后才改变真实行高，因此组件先同步一次、再于下一浏览器布局帧复测 `scrollHeight`；不得用旧行高让阻塞说明停在视窗外。scroll-fade 只在中段真实溢出时出现，内部保留滚动条；紧凑视窗将官方 `--scroll-fade-size` 覆盖为 `8px`（等价 `scroll-fade-2`），只缩短遮罩深度，不修改内容 padding，并在起点/终点分别保持对应边缘清晰。[fade size](https://ui.shadcn.com/docs/utils/scroll-fade#fade-size)

下一版跟随策略继续对齐 Message Scroller 的 live edge，而不是每次更新都强制 `scrollTop=scrollHeight`：只有读者仍贴近最新内容时，Message chunk、Marker 新增或次行变化才自动跟随；滚轮、触控、键盘或拖动滚动条离开底部后，后续内容允许在屏外继续增长，不抢走阅读位置。回到底部后才重新跟随。[shadcn Message Scroller](https://ui.shadcn.com/docs/components/base/message-scroller)

Marker 视觉直接投影 shadcn Base Nova 的 `gap-2 text-sm text-muted-foreground min-h-4`：图标盒 `16px`、图文间距 `8px`、文字 `14px/20px` 常规字重，图标与文字统一继承中性色，不把完成/警告/错误染成第二套 Badge。运行态组合 Phosphor `SpinnerGap` 与 shadcn `4.19.0` 原始 shimmer 算法：`currentColor` 基色、`alpha × 0.2` 高光、`20deg`、`3ch + 40px` spread、`2s linear infinite`，从 `100% 0` 扫到 `0 0`，reduced-motion 下移除背景并恢复 `currentColor`；这里只把 Tailwind utility 改写为项目语义 token，不另造渐变。完成后原位换成该步骤自己的图标，而不是统一打勾：验证安装 `ShieldCheck`、准备恢复 `Archive`、应用语言 `Translate`、恢复官方状态 `FloppyDiskBack`、下载 `DownloadSimple`、安装 `Package`、重启 `ArrowClockwise`。只有缺少更具体业务语义的整体成功状态才使用 `CheckCircle`。

Apply 的四阶段只来自后端 `verifyInstallation`、`ensureBaseline`、`applyTransaction`、`restartCavalry` Channel。Updater 的三阶段来自 `downloading`、`installing`、`restarting` Channel：下载结束回调发生在签名验证之前，因此 UI 把第二阶段写成“正在验证并安装”，绝不虚构“已验证”事件；下载 URL、签名、临时路径和原始响应不进入 renderer。后端事件可以压缩成面向用户的任务语言，但不能提前声明尚未成立的结果。

阶段内动态说明属于同一 Marker 的 description，不是额外同级 Marker：下载主行保持“正在下载版本”，次行更新真实百分比；准备恢复文件或恢复 Cavalry 也可以在次行原位轮换当前对象，终态再把主行改为“恢复文件已就绪”或“Cavalry 已恢复”。description 与主步骤统一使用 `14px/20px` 和 `8px` 垂直节奏；层级由缩进与所属关系表达，不靠缩成脚注字号或压缩行距。但当前 Apply `OperationEvent` 只有 `phase/state`，没有文件、索引或总数，因此生产不得轮播假文件名。正确实现必须让 Rust 事务从真实处理边界发出受控 detail code / manifest item id，bridge 拒绝任意路径和底层原文，renderer 再本地化显示名称。

持久启动阻塞继续使用同一事件视窗，因为用户需要在采取恢复动作前持续看到它；未选择安装、必须重装、Cavalry 仍在运行都不再叠加 Toast。Toast 只承担 About/固定项目链接等没有主任务承载位置的短时外围失败；AlertDialog 只用于必须立即作出选择的确认、权限或危险操作。

全部当前与提案文案、四语版本及组件归属集中在 [Switcher 反馈语义与四语文案审阅目录](./switcher-feedback-copy-catalog-2026-08-29.md)，避免聊天裁决散落后再次混淆 Event、AlertDialog 与 Toast。

结构与动画对照 shadcn/ui 官方 Marker、shimmer、scroll-fade 源码，审查基线为上游提交 `683a5a9b370acdb7785a0529434e6a3b8c7e0441`；Phosphor Regular 图标来自提交 `2b75f3ad12b420c9504ef05df8d2564a28f8500e`。项目只内嵌所需结构、CSS 与 SVG path，不引入 React、Base UI、Tailwind、CDN 或完整图标包。参考：[Marker](https://ui.shadcn.com/docs/components/base/marker)、[shimmer](https://ui.shadcn.com/docs/utils/shimmer)、[scroll-fade](https://ui.shadcn.com/docs/utils/scroll-fade)、[Phosphor Icons](https://phosphoricons.com/)。许可证投影见 `renderer/THIRD_PARTY_NOTICES.md`。

### 2.3 AlertDialog 与 About 边界

AlertDialog 只承载 Restore、Updater、权限请求和危险操作，不替代任务事件视窗，也不用于可逆且已有 fail-before-mutation 保护的 Switch，更不用于只有“知道了”而没有真实选择的错误。结构对照 shadcn Base Nova 的 `AlertDialog`：overlay、content、header、title/description、footer/actions，但不照搬网页全视口遮罩：Switcher 标题栏是窗口身份与系统 Chrome，视觉遮罩从既有 `--titlebar-height` 以下开始，只覆盖当前任务内容；原生 `showModal()`、焦点锁、文档 inert 与不可绕过的确认语义保持不变。项目实际尺寸、间距、圆角和排印均由 `tokens.css` 提供。当前冻结规格为 `320px` 弹窗盒宽、`16px` 内边距、标题与正文 `8px`、正文与 actions `16px`，扣除边框后正文可用宽度为 `286px`：标题 `16px/24px/500`，正文 `14px/20px/400`。正文使用自然换行，禁止会重新平衡 CJK 行长的 `text-wrap: balance`；`white-space: pre-line` 只保留 Updater 版本说明等文案显式给出的段落边界。不能把源组件默认值散落到 CSS，也不能用硬编码换行修补单一语言。[shadcn Base Nova AlertDialog](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/base/ui/alert-dialog.tsx)

About 采用和本机 Maipo 同类的“系统应用菜单入口 + 独立应用窗口内自定义内容”方向，不使用 Tauri 原生 `AboutMetadata`：后者在 macOS 不支持 `website`、`website_label` 和 `license`，Windows 也不能满足可点击项目链接。macOS 将默认应用菜单中的标准 About 替换为固定 id，菜单事件与 Windows 标题栏信息入口共同调用同一个 Rust `about` WebviewWindow owner；窗口非 modal、固定 `320×308px` 且不可 resize/maximize/minimize，主窗口不被锁住，并与主窗口复用同一 40px Overlay 标题栏和 AppKit 交通灯 owner。About 本地页面使用现有 token，顶部显示 68px、与安装包同源的应用图标和 `plugin:app|version` 真实版本；项目行只显示 `Cavalry-i18n`，GitHub 图形进入该行作为目的地提示，MIT License 独立成行，系统交通灯提供关闭行为。

外部导航不引入 opener 组件，也不让 renderer 传 URL。bridge 只接受 `repository` / `license` 两个 id；Rust `ProjectLink` 再映射为编译期 HTTPS 地址，最终经 privilege 的既有 `CommandRunner` 调用平台默认浏览器。这个双重白名单是安全边界，不可退化为 `open(url)`。

### 2.4 Event、AlertDialog 与 Toast 语义矩阵

三者不是互斥组件，而是不同时间尺度：Event 是可回看的任务事实，AlertDialog 是必须立即作出的选择，Toast 是短暂的注意力提示。允许组合，但不允许逐字重复，也不允许 Toast 成为唯一恢复说明。

| 实际情境 | 当前代码事实 | 正确承载 | 组合裁决 |
| --- | --- | --- | --- |
| 启动读取状态 | `bootstrap` running | Event | 短暂任务事实，不弹 Toast、不阻塞 |
| 未选择 Cavalry | `chooseAppToContinue` 持久 warning | Event | 操作控件已禁用且安装选择入口可见；不为同一事实叠 Toast 或 AlertDialog |
| English 基线不可验证，必须重装 | `reinstallRequired` 持久 error | Event | 外部重装后重新打开 Switcher 触发探测；不显示文件入口，也不使用会消失的 Toast |
| 启动恢复失败、state durability、Windows residue、自定义目录不可写 | 稳定 error/warning code | Event | 属于持续阻塞或恢复债务，不使用会自动消失的唯一提示，也不叠摘要 Toast |
| Switch 开始 | 运行中 fail-before-mutation，关闭态可逆 | Event Scroll | 无冗余确认，点击后直接进入真实 Channel；不提供“稍后重启”半状态 |
| Restore 开始前 | 已有 confirm handler | AlertDialog | 用户必须明确继续或取消；此时不再叠 Toast |
| Switch / Restore 执行 | 四个真实 Channel phase | Event Scroll | `verifyInstallation → ensureBaseline → applyTransaction → restartCavalry`，用户文案把末阶段投影为“打开 Cavalry”，运行态与完成态原位切换 |
| 运行中需要系统权限 | `permissionRequired` + 明确 Open Settings / Elevation 动作 | Event + AlertDialog | Event 留下任务为何停住；AlertDialog 提供立即选择，不叠 Toast |
| Cavalry 仍在运行 | `cavalryStillRunning` | Event | 保存、关闭、重试的恢复路径必须可回看；既不叠 Toast，也不伪装成确认框 |
| Apply 后 cleanup/restart warning | `warningCodes` | Event | 已发生事务的后续结果必须可回看；默认不叠 Toast |
| 发现可用更新 | updater check DTO + 标题栏绿色图标 + `aria-live` 公告 | 标题栏入口 + Tooltip | 非紧急持久状态已有稳定入口；点击后再由 AlertDialog 展示版本、影响与操作，不重复 Toast |
| 安装更新前 | 版本说明、macOS ad-hoc 风险 | AlertDialog | 用户明确 Update & Restart / Cancel；不叠 Toast |
| 安装更新中 | 三个真实 Updater phase | Event Scroll | `downloading → verifying/installing → restarting`，不虚构 verified |
| 更新失败 | 稳定 updater error code | Event | 保留失败与重试路径；只有窗口失焦等明确需求出现时再考虑 Toast |
| About / 外链打开失败 | 独立、短时、非任务操作 | Toast | 在发生操作的窗口显示 5 秒 error Toast，不清空主任务事件流，不弹 AlertDialog |

生产 Toast 固定在窗口右下角，由下向上进入；最多三条，从右下向上堆叠。结构对照 [shadcn Base Toast 文档](https://ui.shadcn.com/docs/components/base/toast#types) 与[固定源码](https://github.com/shadcn-ui/ui/blob/683a5a9b370acdb7785a0529434e6a3b8c7e0441/apps/v4/registry/bases/base/ui/toast.tsx)，计时/焦点闭包锁定 `@base-ui/react 1.6.0`：普通 Toast `5000ms`，`loading` 常驻，hover/focus/window blur 暂停并保留剩余时间，F6 进入、Escape 关闭，viewport 使用 polite live region。视觉保持 16px viewport inset、16px padding、12px 图文间距、4px标题/说明间距及 `500/250/150ms` 动画层级；16px inset 有意与 20px 主内容网格错开，颜色、圆角、阴影和排印仍服从项目 token。当前两个外围错误不提供 Retry Action，因为原按钮/链接仍在原位，重复入口只增加噪声。

## 3. macOS 外圆角：事实、测量与绘制模型

### 3.1 所有权

生产应用使用 `decorations: true`、`titleBarStyle: Overlay`、`hiddenTitle: true`。外圆角不是 renderer 的 `border-radius`，也不是 Tauri 固定常量；它由原生 `NSWindow` 的 frame theme 与 WindowServer 最终裁切。Apple 的 `NSWindow.frame` 定义包含标题栏，但公开 API 没有稳定的“标准窗口外圆角半径”属性，因此不能把某个测量值冒充跨 macOS 版本 ABI。[Apple NSWindow](https://developer.apple.com/documentation/appkit/nswindow)

### 3.2 当前实机测量

测量宿主:

- macOS `27.0`，build `26A5416b`
- 内建 Liquid Retina，截图 backing scale `2×`
- 外角取证时窗口配置为 `460 × 428pt`、CGWindow/AX 外框为 `460 × 429pt`；该数据只用于曲线测量。上一版逻辑 `400 × 480px` / native `400 × 481px` 同样只保留为历史；当前候选是 `400 × 484px`，package/manual smoke 另行复核。
- 使用 `screencapture -o -l <CGWindowID>` 排除阴影，再读取 PNG alpha 轮廓；不以白色背景目测边缘

当前左上角 alpha 轮廓在顶边和左边各占约 `24pt` 后进入直线段。因此应记录为：

> **macOS 27 当前标准窗口的外角视觉占位约 24pt；这不是可写入配置的固定圆半径。**

### 3.3 曲线判断

该轮廓明显不是半径 `24pt` 的普通四分之一圆。Core Animation 公开两种 corner curve：`circular` 与 `continuous`；Apple 将 `continuous` 效果描述为 squircle，并建议直接使用 `cornerRadius + cornerCurve`，而不是自建 mask。[Apple CALayerCornerCurve](https://developer.apple.com/documentation/quartzcore/calayercornercurve)、[Apple continuous-corner rendering guidance](https://developer.apple.com/videos/play/tech-talks/10857/)

当前宿主运行时返回:

```text
CALayer.cornerCurveExpansionFactor(.continuous) = 1.528665
CALayer.cornerCurveExpansionFactor(.circular)   = 1.0
```

`24 / 1.528665 ≈ 15.7`，与一个约 `16pt` 的 semantic corner radius 经 continuous curve 扩张后的视觉占位吻合。由于 AppKit 的实际 `CUIWindowFrameLayer` 遮罩属于系统实现，最终结论必须分级：

- **实测事实**：macOS 27 当前窗口的轴向外角占位约 `24pt`。
- **高可信推断**：轮廓对应约 `16pt` semantic radius 的 continuous/squircle 曲线，而非 `24pt` circular arc。
- **禁止宣称**：所有 macOS 版本都固定使用 `16pt` 或同一私有路径。

### 3.4 如果必须重建

生产 macOS 窗口不重建，继续让 AppKit 绘制。只有设计稿、离屏原型或独立自绘 layer 必须模拟时，采用：

```swift
layer.cornerRadius = 16
layer.cornerCurve = .continuous
layer.masksToBounds = true
```

不要用 `border-radius: 24px` 或半径 24 的 SVG 圆弧替代；那会把“曲线占位”误当成“圆半径”。非 Apple 渲染器没有 continuous corner API 时，可用四次超椭圆（squircle）作视觉近似，但它不是 AppKit 私有遮罩的字节级复刻，必须以目标系统截图复核。

## 4. Windows 最终窗口策略

Windows 采用平台专属无原生 caption 的窗口，而不是保留“系统标题栏 + 产品标题区”双层结构：

```text
40pt 产品标题栏
├── 左侧：产品标题与更新入口
└── 右侧：最小化 / 最大化或还原 / 关闭
        ↓
Tauri/TAO：拖拽、缩放、Aero Snap、HWND 生命周期
        ↓
Windows DWM：系统边界、阴影、Windows 11 外圆角
```

Windows 三个按钮使用 Windows 原生语义与图形，不移植 macOS 交通灯；位置关系服从本规格的 `40pt` 标题栏与 `y=20pt` 中心线。右侧点击目标应满足 Windows 操作习惯，关闭按钮保留独立危险 hover/active 状态。外圆角由 DWM 决定：Windows 11 顶层窗口通常为约 `8px`，最大化或贴靠时为 `0`；Windows 10 不伪造同一外观。[Microsoft Windows geometry](https://learn.microsoft.com/en-sg/windows/apps/design/signature-experiences/geometry)、[Microsoft DWM rounded corners](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/ui/apply-rounded-corners)

当前实现让 Windows 产品标题从标题栏左侧 `12px` 起排；更新入口位于标题右侧，Flex 结构 gap 使用跨平台 `8px` token，升级 SVG 在 24px 点击盒内的留白使标题字形到圆环实体约为 `12px`。三枚按钮仍固定在最右侧，依次为最小化、最大化/还原、关闭，标题栏 `12px` 右内边距形成外侧 inset。它们共同消费 `ui-button` 的 `ghost + icon-sm` 变体：点击目标 `32×32px`、相邻间距 `4px`、Phosphor Regular 图形 `16px`，在 40px 标题栏中双轴居中，因此图形中心固定在 `y=20px`；只有关闭按钮的 hover/active 使用危险色。最大化状态由 Tauri `is_maximized` 查询，并在 toggle 与 resize 后同步 Square/Copy 图形及四语可访问名称。CSS 只替换视觉，最小化、最大化/还原和关闭仍由 Tauri/TAO 系统窗口 API 执行。

UI Review 只验证生产 renderer 在受控 fixture 下的视觉合同。`fixture.platform` 是外围 frame 的唯一平台输入，平台示意与 fixture state 不一致时，预览作废；它不能被当作 Windows DWM、原生标题栏、Snap、缩放或真实 caption 行为的替代证据。

`tauri.windows.conf.json` 必须完整覆盖 `app.windows` 数组。Tauri 平台配置按 JSON Merge Patch 合并，数组不是按 `label` 深合并；只写 `{ decorations: false }` 会丢失共享窗口的 URL、尺寸与最小尺寸。因此这里的完整重复是平台边界的显式快照，并由 Rust 配置合同锁定共享几何，不能为追求表面 DRY 改成不完整数组。

实现继续遵守 renderer bridge 边界：`app.js` 不裸调 Tauri；`window-controls.js` 只消费冻结 bridge 的固定 `main` label 窗口操作，capability 只新增 minimize/toggle-maximize/close。共享 `button.css` 统一普通动作的布局、disabled、SVG 与 variant/size，Select Trigger 因拥有 combobox 状态机而保持隔离。源码合同已覆盖四命令、按钮 primitive、Phosphor caption 图标、最大化状态与四语名称；拖拽、双击标题栏、键盘焦点、高对比度及真实 Windows Snap/缩放仍需真机验收。

## 5. 验收口径

验收报告必须把三类证据分开记录：

| 证据 | 证明边界 | 禁止替代 |
| --- | --- | --- |
| 视觉合同 | 生产 renderer 在 fixture 中的布局、排印、颜色、间距和平台示意 | 不得声称 native/package/live PASS |
| 静态合同 | DOM、token、状态机、bridge 与平台行为所有权的源代码不变量 | 不得声称像素或真实系统行为通过 |
| 真机证据 | 指定平台上的真实 Tauri/系统窗口、权限、安装、重启或发布资产 | 不得外推到未测试平台或不同构建 |

三者可以互相引用，但不能互相升级；尤其 UI Review 的 Windows 外壳截图不能证明 Windows 真机，macOS native 的交通灯结果不能证明 Windows caption。

macOS:

- AX 实测红灯相对外框目标为 `(12, 12, 16, 16)`。
- 标题栏上下留白各 `12pt`；内容左缘与红灯中心 `x=20pt` 共线。
- 更新入口与标题使用 `8px` Flex 结构 gap；64px 原生占位补偿绿灯与 DOM 边界，使绿灯—标题和标题—升级圆环的实体空白同为约 `12px`。
- packaged screenshot 必须按截图前后的新鲜窗口坐标捕获，禁止复用启动前坐标。
- 外圆角只验证原生裁切未丢失，不把约 `24pt` 测量冻结为跨系统精确断言。

Windows:

- 不出现双标题栏，不出现 macOS 交通灯或其占位。
- 产品标题从左侧 `12px` 起，更新入口只在有可用更新时以 `8px` 结构 gap 紧随标题，标题字形到升级圆环实体约 `12px`；右侧只保留 Windows caption controls。
- 三个右侧按钮的状态、图标与命中区在 100%/125%/150% scaling 下保持正确。
- 最小化、最大化/还原、关闭、拖动、双击、边缘缩放、Aero Snap 与高对比度全部需要真机证据。
- DWM 外圆角按目标 Windows 版本观察，不用 renderer 截图假造系统框通过。

跨平台组件:

- 主窗口不得出现横向或纵向滚动，`400×484` 内必须完整显示正式四语主任务与 176px 任务事件视窗；Select 列表和事件视窗的独立滚动不计入窗口滚动，Restore/Updater/权限/危险操作使用独立 AlertDialog。
- 主任务只有全宽 Select 与等宽 `Switch` / `Restore`；Switch 直接执行、Restore 的平台映射与自动恢复基线合同见 `switcher-auto-baseline-and-restore-decision-2026-08-29.md`。
- Select 必须保持 Trigger 与当前选中 Item 的视觉中心对齐；不能退回固定 top 偏移或浏览器原生弹出层。
- macOS 从系统应用菜单、Windows 从标题栏信息入口打开同一个 `about` 原生 WebviewWindow；两者共用四语本地页面、真实应用版本和固定项目链接枚举，重复触发只 show+focus，主窗口不进入 modal 状态。
- renderer 只能提交 `repository` 或 `license`，Rust command 与 privilege 适配器必须再次拒绝任意 URL；默认浏览器跳转不允许引入第二套 opener。

## 6. 非目标

- 不在 macOS 自绘外框或替换原生交通灯。
- 不要求 macOS 与 Windows 外圆角数值一致。
- 不引入 React、shadcn、Base UI、Tailwind 或 CDN 来实现三个窗口按钮。
- 不用透明窗口、CSS shadow 或 SVG mask 替代平台窗口管理器。
- 本文不证明 Windows 实机已经通过，也不替代 updater、DMG/NSIS 或 release evidence 门。
