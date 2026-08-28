<!--
[INPUT]: 依赖 renderer 生产源码、Tauri 平台窗口配置、AppKit 实机 AX/像素轮廓、Windows DWM/Tauri 官方窗口合同与本轮 UI 裁决
[OUTPUT]: 对外提供 Switcher 最终 UI 的跨平台构建规格、单一 Apply/Restore 任务流、无滚动窗口、原生窗口所有权、几何 token、Select/About 组件边界、macOS 外圆角测量口径与 Windows 自绘标题栏边界
[POS]: docs/audits 的 UI 事实基线；约束实现与评审，但不替代 LOCAL_BUILD_SOP、packaged gate 或 Windows 实机验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Switcher UI 最终构建规格（2026-08-28）

状态: Active — 当前候选的 400×480 几何已有 macOS native dev 证据；当前 package/manual smoke 与 Windows 真机验收仍待完成
适用版本: Cavalry Language Switcher `0.7.0` 候选
视觉真相源: `renderer/index.html`、`renderer/tokens.css`、`renderer/styles.css`、`renderer/operation-log.css`、`renderer/operation-log.js`、`renderer/select-control.js`、`renderer/about.css`、`renderer/about-control.js`、`renderer/about.html`、`renderer/about-window.js`
窗口真相源: `src-tauri/tauri.conf.json`、`src-tauri/src/lib.rs`、平台覆盖配置
最新现场证据: 正确 Tauri 配置重新编译并拉起的 native dev 为 AX/CGWindow 外框 `400×481`（逻辑配置 `400×480`，AppKit 允许 `1px` 报告差异）；`/tmp/cavalry-titlebar-visual-gap.png` 显示 16px 交通灯、20px 更新图形/24px 点击圆、20px 内容外边距与 `170+20+170` 动作轨道。2x 截图按实体着色边缘测得绿灯右缘到标题首字形空白 24px、标题末字形到升级圆环左缘空白 25px，即逻辑约 12px 且仅有抗锯齿边界的半像素差；此证据只证明 current native dev，不证明 current package 或 manual smoke。

## 1. 设计原则

1. 内容层跨平台共用，系统外框按平台所有权分流。
2. Grid 管窗口 shell、安装卡片、Select/双动作复合轨道与 AlertDialog 的复合结构；Flex 管标题、徽章、按钮和 Activity 行等一维关系。
3. macOS 不伪造交通灯；Windows 不照搬交通灯，而在右侧提供 Windows 原生语义的最小化、最大化/还原、关闭。
4. 不用透明 WebView 手画系统阴影和外轮廓。macOS 交给 AppKit/WindowServer；Windows 交给 HWND/DWM。
5. 数值必须有语义 token 或原生几何来源，禁止用散落魔法数字微调截图；`renderer/tokens.css` 是唯一可调设计常量源，`styles.css`、`operation-log.css` 与 `window-controls.css` 不得定义私有设计变量。4px 是默认节奏；少量组件源码特有值必须先 token 化并在消费处注明来源。
6. Vercel Design MD 负责角色、层级、系统字体与节奏原则；shadcn/Base UI 源码只提供需要的结构和状态参考。项目不引入组件库、Tailwind、CDN 或第二套 token。

## 2. 冻结几何

| 语义 | 值 | 依据 |
| --- | ---: | --- |
| 默认窗口 | `400 × 480px` | 当前 Tauri 逻辑配置；不是旧 `333 × 420` 候选的延续 |
| 最小窗口 | `400 × 480px` | 主任务一屏完成；主窗口禁止滚动，Select 与 Activity Log 各自处理内部溢出 |
| 内容轨道 | `360px` | `400 - 20 - 20`；内容四边 padding 均为 `20px` |
| 标题栏 | `40px` | `12 + 16 + 12`：交通灯上下留白各 `12px` |
| macOS 交通灯 | `16 × 16px` | 原生 AppKit 控件；目标中心线为 `y = 20px` |
| 标题栏动作 | 更新图形 `20px`；纯圆点击区 `24 × 24px` | 更新入口只在有可用更新或 loopback preview 时出现 |
| 标题结构间距 | `8px` | Flex 盒关系使用同一 4px 节奏；实体图形还需计入原生灯位与 SVG 在点击盒内的留白 |
| 标题栏中心线 | `y = 20px` | 标题、更新图形及 Windows caption 图形共享视觉中心 |
| 应用图标路径 | 开发态 `icon.png` / 正式包 `icon.icns` / About `128x128.png` | 系统负责最终圆角 mask、尺寸和效果，但不替开发者重新决定内部 artwork 比例；本项目不拿裸 debug 进程的外观改写正式包，只要求开发态 512px 图与 `icns` 同尺寸表示像素同构，About 字节复用 tracked 128px 投影 |
| Windows caption | `3 × 32pt` 点击目标，`12pt` 图形，右边距 `12pt` | 保留 Windows 图形/危险关闭语义；位置服从 macOS 的 40/20/12 标题栏几何 |
| 动作轨道 | `170px + 20px + 170px` | 两枚按钮在 `360px` 内容轨道内等宽；不因语言改变列定义 |
| 主任务节奏 | 以 `4px` token 组合 | 板块之间、字段关系和内边距均由语义 token 组合，不以未命名数字补偿字形 |
| 面板内边距 | 安装 Item 使用 panel token；Activity Log 使用 `8px` | Activity 的 `8px` 对照 Item xs 的局部 padding，但不重复叠加窗口 `20px` 外边距 |
| 主控件高度 | `36pt` | Select 与动作 Button 共用 |
| Button / 面板圆角 | `7pt / 9pt` | 动作控件与容器层级分离 |
| Select 圆角 | Trigger `10pt`、Popup `10pt`、Item `8pt` | 复刻 shadcn Nova/Base UI Select 当前源码角色，不再强行套用 Button 圆角 |
| macOS 实体标题关系 | 约 `12px` | 比较绿灯可见右缘、标题字形与升级 SVG 圆环，不比较 DOM 占位盒；结构 gap 保持 `8px`，64px 原生占位吸收两侧图形内缩 |

Apple 当前 App icon 合同是开发者提供居中的未遮罩图层，由系统施加平台外形 mask 与效果；Icon Composer 仍由设计者调整 layer 的 position/scale，再由系统生成平台与外观变体。因此自动 mask 不等于运行时替 artwork 做光学缩放。Switcher 仍走 Tauri 静态 PNG/ICNS 路径，不在本轮为修一个 dev runtime 漂移引入 Xcode `.icon` 资产链。[Apple App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons?param1=online-sales) · [Creating your app icon using Icon Composer](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer?changes=_1)

主内容排印只允许三个字号和三个标准字重：

| 角色 | 字号 / 字重 | 消费者 |
| --- | --- | --- |
| Heading | `16px / 450`；独立 Dialog 标题按组件语义可用 `500` | 窗口标题、Cavalry 安装名称、AlertDialog 标题 |
| Body | `14px / 400` 或 `500` | Section 标题、Select、动作、AlertDialog 正文与 Activity 标题 |
| Meta | `13px / 400` 或 `500` | 路径、徽章、Tooltip、Activity 说明与辅助文本；徽章依靠颜色、边框和形状表达状态 |

不再使用 `10/12px`、`600` 或其他临时中间级别。字体继续使用平台系统栈而非引入 Geist：`design.md` 的报告网站品牌合同要求 Geist，但本项目是离线原生工具，应遵循其“角色一致、对等元素同规格、强调稀缺”的排印原则，而不是照搬报告品牌字体或远程资源。[Vercel design.md](https://vercel.com/design.md)

排印角色只定义字号、字重和行高；字形边界不能成为第二套几何系统。标题栏、安装摘要和 Dialog 依靠各自的 token 行盒完成对齐，不能通过局部负 margin 或未命名数字修正截图。

安装摘要表达“安装位置”而不是重复文件选择结果。macOS 保留 `.app` bundle 路径，标准 `/Applications/Cavalry.app` 可完整显示；Windows 将末尾 `.exe` 降为其所在安装目录。不超过 36 个 Unicode 字符时完整展示，超限后按路径层级从中间省略，至少保留盘符/根和末级安装文件夹，例如 `C:\Users\…\Cavalry`。完整语义位置只进入 `aria-label`，不设置会触发 WebView 原生悬浮窗的 HTML `title`；CSS 的弹性省略只是窗口像素继续不足时的第二道兜底。

安装摘要、Switch to、Select、双动作行与 Activity Log 属于同一主任务流。`Switch to` 到 Select 使用唯一的 `8px` 字段关系 token；Activity Log 是有界结果输出。必要确认、权限和危险操作才进入独立 AlertDialog；因此主窗口高度不由某条异常正文无限撑开。

当前实现用 Grid 固定主窗口的复合轨道，并让 Activity Log 的中间行成为 `minmax(0, 1fr)`；`operation-log.css` 再以 Flex 管每条 Marker/Item。`html/body/.content` 禁止窗口级滚动，Select 列表和 Activity Log 只在自身边界内滚动。业务分割线不承担层级，层级由留白与边界 token 表达。

当前语言徽章是类别元数据，不是信任状态。四种语言统一使用 Geist `purple-subtle` 的 `purple-200 / purple-400 / purple-900` 角色；安装徽章只使用 green / blue / amber 表达 Official / Translated / Modified。Switcher 的 pending journal 或启动恢复失败不是 Cavalry 本体状态，不进入安装徽章，只通过红色 Activity 结果行、独立 AlertDialog、操作锁和恢复路径表达。两枚徽章即使相邻也不会混写维度，且文字仍是颜色之外的必要语义线索。[Geist Badge](https://vercel.com/geist/badge) [Geist Colors](https://vercel.com/geist/colors)

### 2.1 Select 源码对齐

Select 不引入 React、Base UI、shadcn、Tailwind 或 CDN。实现只借鉴 shadcn Base Nova 的语义结构与状态边界：Trigger、Popup、Item、selected indicator 分层，`open/active/selected` 不混用；项目自身几何由 `tokens.css` 约束为 `36px` 控件高度、`14px` 文字、`8px` 内容关系和 `16px` chevron。源码特有的 Item 高度、指示器位置和弹层 padding 也只能通过 Select token 表达，不能在业务脚本中散落偏移。

Base UI 默认 `alignItemWithTrigger=true` 不是“菜单固定出现在控件下方”。`select-control.js` 在 Popup 显示后读取 Trigger 与选中 Item 的真实 layout box，推导 Popup top，使两者视觉中心重合；不为不同字体和语言硬编码偏移。键盘、typeahead、指针高亮、selected 与 active 状态仍保持分离，列表只在自己的 max-height 内滚动。[shadcn Base UI Select](https://ui.shadcn.com/docs/components/base/select)

### 2.2 Activity Log 源码对齐

主界面的结果区是有界 Activity Log。`operation-log.js` 只维护稳定 id 的 ordered upsert/replace/clear 与安全文本投影；Marker 仅承担行布局，MarkerIcon/MarkerContent 承担图标与文案，组件不拥有业务编排。`app.js` 把后端强类型 Channel 映射为 `verifyInstallation`、`ensureBaseline`、`applyTransaction`、`restartCavalry` 四个真实阶段；Channel 关闭或发送失败不改变事务结果。运行态组合 Spinner 与文字 shimmer，完成后换回阶段自己的 Phosphor 图标，warning/error 使用各自语义图标，不用一枚通用勾伪装所有事件。`operation-log.css` 参考 shadcn Base Nova 的 Marker、Item xs、ScrollArea、Spinner 结构，以 Flex 管单条记录，以内部 `overflow-y` 处理长记录；所有几何值仍来自项目 token。

参考源码：[Marker](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/base/ui/marker.tsx)、[Marker examples](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/base/examples/marker-example.tsx)、[Item](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/base/ui/item.tsx)、[ScrollArea](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/base/ui/scroll-area.tsx)、[Spinner](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/base/ui/spinner.tsx)、[Phosphor core](https://github.com/phosphor-icons/core)。项目只内嵌所需 SVG path，不引入完整图标包、React、Tailwind 或 CDN；许可证投影见 `renderer/THIRD_PARTY_NOTICES.md`。

### 2.3 AlertDialog 与 About 边界

AlertDialog 只承载必要确认、权限请求、危险操作和不可恢复错误，不替代 Activity Log。结构对照 shadcn Base Nova 的 `AlertDialog`：overlay、content、header、title/description、footer/actions；项目实际尺寸、间距、圆角和排印均由 `tokens.css` 提供，标题使用 `16px` 角色，正文使用 `14px` 角色，不能把源组件的默认值直接散落到 CSS。[shadcn Base Nova AlertDialog](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/base/ui/alert-dialog.tsx)

About 采用和本机 Maipo 同类的“系统应用菜单入口 + 原生应用窗口内自定义内容”方向，不使用 Tauri 原生 `AboutMetadata`：后者在 macOS 不支持 `website`、`website_label` 和 `license`，Windows 也不能满足可点击项目链接。macOS 将默认应用菜单中的标准 About 替换为固定 id，菜单事件与 Windows 标题栏信息入口共同调用同一个 Rust `about` WebviewWindow owner；窗口使用系统原生装饰、非 modal、固定尺寸且不可 resize/maximize/minimize，主窗口不被锁住。About 本地页面使用现有 token，顶部显示 64px、与安装包同源的应用图标和 `plugin:app|version` 真实版本；项目行只显示 `Cavalry-i18n`，GitHub 图形进入该行作为目的地提示，MIT License 独立成行，原生标题栏提供关闭行为。

外部导航不引入 opener 组件，也不让 renderer 传 URL。bridge 只接受 `repository` / `license` 两个 id；Rust `ProjectLink` 再映射为编译期 HTTPS 地址，最终经 privilege 的既有 `CommandRunner` 调用平台默认浏览器。这个双重白名单是安全边界，不可退化为 `open(url)`。

## 3. macOS 外圆角：事实、测量与绘制模型

### 3.1 所有权

生产应用使用 `decorations: true`、`titleBarStyle: Overlay`、`hiddenTitle: true`。外圆角不是 renderer 的 `border-radius`，也不是 Tauri 固定常量；它由原生 `NSWindow` 的 frame theme 与 WindowServer 最终裁切。Apple 的 `NSWindow.frame` 定义包含标题栏，但公开 API 没有稳定的“标准窗口外圆角半径”属性，因此不能把某个测量值冒充跨 macOS 版本 ABI。[Apple NSWindow](https://developer.apple.com/documentation/appkit/nswindow)

### 3.2 当前实机测量

测量宿主:

- macOS `27.0`，build `26A5416b`
- 内建 Liquid Retina，截图 backing scale `2×`
- 外角取证时窗口配置为 `460 × 428pt`、CGWindow/AX 外框为 `460 × 429pt`；该数据只用于曲线测量，属于外角历史测量。当前候选已改为逻辑 `400 × 480px`，最新 native dev 外框为 `400 × 481px`；仍允许同一 AppKit/WindowServer 的 1px 报告差异，package/manual smoke 另行复核
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

当前实现让 Windows 产品标题从标题栏左侧 `12px` 起排；更新入口位于标题右侧，Flex 结构 gap 使用跨平台 `8px` token，升级 SVG 在 24px 点击盒内的留白使标题字形到圆环实体约为 `12px`。三枚按钮仍固定在最右侧，依次为最小化、最大化/还原、关闭，标题栏 `12px` 右内边距形成外侧 inset。按钮高度直接继承 `40px` 标题栏，图形中心固定在 `y=20px`。`32px` 是 Windows 指针目标 token，不拿 macOS 交通灯的 16px 可见尺寸冒充 Windows 点击区。最大化状态由 Tauri `is_maximized` 查询，并在 toggle 与 resize 后同步图形及四语可访问名称。

`tauri.windows.conf.json` 必须完整覆盖 `app.windows` 数组。Tauri 平台配置按 JSON Merge Patch 合并，数组不是按 `label` 深合并；只写 `{ decorations: false }` 会丢失共享窗口的 URL、尺寸与最小尺寸。因此这里的完整重复是平台边界的显式快照，并由 Rust 配置合同锁定共享几何，不能为追求表面 DRY 改成不完整数组。

实现继续遵守 renderer bridge 边界：`app.js` 不裸调 Tauri；`window-controls.js` 只消费冻结 bridge 的固定 `main` label 窗口操作，capability 只新增 minimize/toggle-maximize/close。源码合同已覆盖四命令、最大化图标与四语名称；拖拽、双击标题栏、键盘焦点、高对比度及真实 Windows Snap/缩放仍需真机验收。

## 5. 验收口径

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

- 主窗口不得出现横向或纵向滚动，`400×480` 内必须完整显示正式四语主任务与 Activity Log；Select 列表和 Activity Log 的独立滚动不计入窗口滚动，必要确认/权限/危险操作使用独立 AlertDialog。
- 主任务只有全宽 Select 与等宽 `Apply & Restart` / `Restore`；Restore 的平台映射与自动恢复基线合同见 `switcher-auto-baseline-and-restore-decision-2026-08-29.md`。
- Select 必须保持 Trigger 与当前选中 Item 的视觉中心对齐；不能退回固定 top 偏移或浏览器原生弹出层。
- macOS 从系统应用菜单、Windows 从标题栏信息入口打开同一个 `about` 原生 WebviewWindow；两者共用四语本地页面、真实应用版本和固定项目链接枚举，重复触发只 show+focus，主窗口不进入 modal 状态。
- renderer 只能提交 `repository` 或 `license`，Rust command 与 privilege 适配器必须再次拒绝任意 URL；默认浏览器跳转不允许引入第二套 opener。

## 6. 非目标

- 不在 macOS 自绘外框或替换原生交通灯。
- 不要求 macOS 与 Windows 外圆角数值一致。
- 不引入 React、shadcn、Base UI、Tailwind 或 CDN 来实现三个窗口按钮。
- 不用透明窗口、CSS shadow 或 SVG mask 替代平台窗口管理器。
- 本文不证明 Windows 实机已经通过，也不替代 updater、DMG/NSIS 或 release evidence 门。
