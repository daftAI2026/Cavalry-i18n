<!--
[INPUT]: 依赖 renderer 生产源码、Tauri 平台窗口配置、AppKit 实机 AX/像素轮廓、Windows DWM/Tauri 官方窗口合同与本轮 UI 裁决
[OUTPUT]: 对外提供 Switcher 最终 UI 的跨平台构建规格、原生窗口所有权、几何 token、Select/About 组件边界、macOS 外圆角测量口径与 Windows 自绘标题栏边界
[POS]: docs/audits 的 UI 事实基线；约束实现与评审，但不替代 LOCAL_BUILD_SOP、packaged gate 或 Windows 实机验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Switcher UI 最终构建规格（2026-08-28）

状态: Active — macOS 几何已实机裁决；Windows 自绘标题栏已实现，待 Windows 真机验收
适用版本: Cavalry Language Switcher `0.7.0` 候选
视觉真相源: `renderer/index.html`、`renderer/tokens.css`、`renderer/styles.css`、`renderer/select-control.js`、`renderer/about.css`、`renderer/about-dialog.js`
窗口真相源: `src-tauri/tauri.conf.json`、`src-tauri/src/lib.rs`、平台覆盖配置

## 1. 设计原则

1. 内容层跨平台共用，系统外框按平台所有权分流。
2. Grid 管 shell/卡片/动作/Alert 的复合轨道和列回流；Flex 管主内容纵向事件流、标题、徽章和按钮内部的一维关系。
3. macOS 不伪造交通灯；Windows 不照搬交通灯，而在右侧提供 Windows 原生语义的最小化、最大化/还原、关闭。
4. 不用透明 WebView 手画系统阴影和外轮廓。macOS 交给 AppKit/WindowServer；Windows 交给 HWND/DWM。
5. 数值必须有语义 token 或原生几何来源，禁止用散落魔法数字微调截图；`renderer/tokens.css` 是唯一可调设计常量源，`styles.css` 与 `window-controls.css` 不得定义私有 CSS 变量，只保留 `0`/`100%`/`1fr`/轨道数等结构语法。

## 2. 冻结几何

| 语义 | 值 | 依据 |
| --- | ---: | --- |
| 默认窗口 | `460 × 404pt` | 删除业务分割线、去掉 Section 标题的合成 20pt 空槽，并以字形盒为 32pt 留白终点后的当前 Tauri 配置；macOS 原生外框允许 1pt 报告差异 |
| 最小窗口 | `420 × 390pt` | 保持默认窗口的可回流下限 |
| 标题栏 | `40pt` | `12 + 16 + 12`：交通灯/标题基准上下等距 |
| 标题字形校正 | `-1pt` | 2× 实机截图中原始字形 ink center 为 `42.5px`，交通灯/更新图标为 `39.5px`；整点上移后为 `40.5px`，避免半像素文字模糊 |
| macOS 交通灯 | `16 × 16pt` | 当前 Tauri `NSWindow` 实机 AX 尺寸 |
| 标题栏动作 | 更新为 `18pt` SVG box；Windows About 为 `16pt` SVG box；都使用 `24 × 24pt` 纯圆点击区 | 更新跨平台紧随标题；macOS About 归系统应用菜单，Windows About 才在标题栏继续以 7pt 间距排列 |
| 标题栏中心线 | `y = 20pt` | 标题、更新图标及 Windows 控件共享视觉中心 |
| Windows caption | `3 × 32pt` 点击目标，`12pt` 图形，右边距 `12pt` | 保留 Windows 图形/危险关闭语义；位置服从 macOS 的 40/20/12 标题栏几何 |
| 内容四周 padding | `20pt` | 与 macOS 红灯中心横坐标共线 |
| 板块节奏 | 安装摘要底边 → Switch to 字形盒、Switch 控件底边 → Recovery 字形盒均为真实 `32pt` | 两个 `16pt` token 合成板块留白；标题不再居中于额外 20pt 空槽，因此 CSS 数值与视觉边界同义 |
| 面板内边距 | `12pt` | 安装 Item 与 Alert 共用 |
| 主控件高度 | `36pt` | Select 与动作 Button 共用 |
| Button / 面板圆角 | `7pt / 9pt` | 动作控件与容器层级分离 |
| Select 圆角 | Trigger `10pt`、Popup `10pt`、Item `8pt` | 复刻 shadcn Nova/Base UI Select 当前源码角色，不再强行套用 Button 圆角 |
| macOS 灯间净距 / 第三灯至标题净距 | `7pt / 7pt` | 相同关系，而非相同中心距 |

主内容排印只允许三个信息层级与两个标准字重：

| 角色 | 字号 / 字重 | 消费者 |
| --- | --- | --- |
| Title | `14pt / 600` | Cavalry 安装名称 |
| Body | `12pt / 400–600` | Section 标题、Select、动作、Alert 标题与恢复正文 |
| Meta | `10pt / 400` | 路径、徽章、Tooltip 与键盘跳转链接；徽章靠色彩、边框与形状表达状态，不再用粗体制造第四层强调 |

不再使用 `10.5/11.5/12.5/13pt` 或 `500/520/540/620/650` 这类对当前三层信息没有必要的中间值。字体继续使用平台系统栈而非引入 Geist：`design.md` 的报告网站品牌合同要求 Geist，但本项目是离线原生工具，应遵循其“角色一致、对等元素同规格、强调稀缺”的排印原则，而不是照搬报告品牌字体或远程资源。[Vercel design.md](https://vercel.com/design.md)

`text-box-trim` 只用于需要与外部几何对齐的安装名称与 Section 单行标题。Alert 是内部文字栈：标题保留 `16pt` 行盒，正文保留 `17pt` 行距，两者之间由正文唯一拥有 `2pt` 上边距；禁止裁掉标题行盒后仍宣称间距未变。

安装摘要、Switch to 与 Recovery 都属于同一主任务流。每个板块间距由两个 `16pt` token 合成真实 `32pt`，终点是经过 `text-box-trim` 裁紧的 Section 标题字形盒顶部，而不是一个人为的 20pt 父级行槽顶部。`.section-head` 不再设置 `min-height`，标题到控件由唯一的 `8pt` token 拥有；因此不会在 32pt 外再暗加约 5.77pt 字形顶部空隙。支持 CSS Inline Layout Level 3 的 WebView 中，英文按 `cap alphabetic` 字体度量裁到实测 `8.453pt`，中日文使用安全的 `text` edge；不支持时保留字体自身 20pt line-height 回退。该实现读取字体度量，不用负 margin 猜字形轮廓。[CSS Inline Layout Level 3](https://drafts.csswg.org/css-inline-3/#text-box-trim)

原实现还有第二个真实问题：主内容改为 Flex 后，直接子项仍使用默认 `flex-shrink: 1`，安装标题继承的 `20.3pt` 行高及路径的比例行高又把后续流推入亚像素坐标。Retina 实机截图因此曾出现两条 divider 分别占 2 与 1 个 device pixels 的栅格差异。最终实现让 section/status 在空间不足时滚动而非压缩，删除所有业务 divider，并让安装标题与元信息使用 `20pt / 14pt` 整数行高和 `4pt` 栈间距，使安装 Item 回到精确 `64pt`。这解决的是布局与栅格稳定性，不用不对称 margin 追逐单一字体截图。

当前语言徽章是类别元数据，不是信任状态。四种语言统一使用 Geist `purple-subtle` 的 `purple-200 / purple-400 / purple-900` 角色；安装徽章只使用 green / blue / amber 表达 Official / Translated / Modified。Switcher 的 pending journal 或启动恢复失败不是 Cavalry 本体状态，不进入安装徽章，只通过红色 Alert、操作锁和恢复路径表达。两枚徽章即使相邻也不会混写维度，且文字仍是颜色之外的必要语义线索。[Geist Badge](https://vercel.com/geist/badge) [Geist Colors](https://vercel.com/geist/colors)

### 2.1 Select 源码对齐

Select 不引入 React、Base UI、shadcn、Tailwind 或 CDN，但实现边界以 shadcn 当前 Base UI Select 的 Nova 源码为准：Trigger 使用 leading/trailing `10/8pt`、`6pt` 内容间距和 `16pt` Lucide chevron；Popup 使用 `4pt` viewport padding、`10pt` 圆角及 ring + 两层 shadow；Item 固定 `28pt` 高、`6/32pt` 横向 padding、`8pt` 圆角和右侧 `16pt` check。项目只保留两个上位约束：与相邻 Apply Button 共用 `36pt` 控件高度，继续使用产品的 `12pt` Body 排印。

Base UI 默认 `alignItemWithTrigger=true` 不是“菜单固定出现在控件下方”。`select-control.js` 在 Popup 显示后读取 Trigger 与选中 Item 的真实 layout box，推导 Popup top，使两者视觉中心重合；不为不同字体和语言硬编码三组偏移。`460×404` 实际渲染中 Trigger 与当前选中 Item 的中心均为 `y=190pt`，三项分别保持 `28pt` 高。键盘、typeahead、指针高亮、selected 与 active 状态仍保持分离。[shadcn Base UI Select](https://ui.shadcn.com/docs/components/base/select)

### 2.2 About 边界

About 采用和本机 Maipo 同类的“系统应用菜单入口 + 原生应用窗口内自定义内容”方向，不使用 Tauri 原生 `AboutMetadata`：后者在 macOS 不支持 `website`、`website_label` 和 `license`，Windows 也不能满足可点击链接与 GitHub 标识。macOS 将默认应用菜单中的标准 About 替换为固定 id，菜单事件只唤起 renderer 自绘 Dialog；Windows 没有该系统菜单，才显示 `16pt` 标题栏信息图标和 `24pt` 命中圆。Dialog 显示 GitHub 标识、由 `plugin:app|version` 读取的真实 Switcher 版本、完整项目地址与 MIT License。

外部导航不引入 opener 组件，也不让 renderer 传 URL。bridge 只接受 `repository` / `license` 两个 id；Rust `ProjectLink` 再映射为编译期 HTTPS 地址，最终经 privilege 的既有 `CommandRunner` 调用平台默认浏览器。这个双重白名单是安全边界，不可退化为 `open(url)`。

## 3. macOS 外圆角：事实、测量与绘制模型

### 3.1 所有权

生产应用使用 `decorations: true`、`titleBarStyle: Overlay`、`hiddenTitle: true`。外圆角不是 renderer 的 `border-radius`，也不是 Tauri 固定常量；它由原生 `NSWindow` 的 frame theme 与 WindowServer 最终裁切。Apple 的 `NSWindow.frame` 定义包含标题栏，但公开 API 没有稳定的“标准窗口外圆角半径”属性，因此不能把某个测量值冒充跨 macOS 版本 ABI。[Apple NSWindow](https://developer.apple.com/documentation/appkit/nswindow)

### 3.2 当前实机测量

测量宿主:

- macOS `27.0`，build `26A5416b`
- 内建 Liquid Retina，截图 backing scale `2×`
- 外角取证时窗口配置为 `460 × 428pt`、CGWindow/AX 外框为 `460 × 429pt`；当前排印闭包配置为 `460 × 404pt`，2026-08-29 原生 Tauri dev 的 AX 外框实测为 `460 × 405pt`，保持同一 AppKit/WindowServer 的 1pt 外框报告差异
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

当前实现让产品标题从标题栏左侧 `12px` 起排；更新入口位于标题右侧，复用跨平台 `7px` 标题关系间距，不挤入系统窗口操作区。三枚按钮仍固定在最右侧，依次为最小化、最大化/还原、关闭，标题栏 `12px` 右内边距形成外侧 inset。按钮高度直接继承 `40px` 标题栏，图形中心固定在 `y=20px`。`32px` 是 Windows 指针目标 token，不拿 macOS 交通灯的 16px 可见尺寸冒充 Windows 点击区。最大化状态由 Tauri `is_maximized` 查询，并在 toggle 与 resize 后同步图形及四语可访问名称。

`tauri.windows.conf.json` 必须完整覆盖 `app.windows` 数组。Tauri 平台配置按 JSON Merge Patch 合并，数组不是按 `label` 深合并；只写 `{ decorations: false }` 会丢失共享窗口的 URL、尺寸与最小尺寸。因此这里的完整重复是平台边界的显式快照，并由 Rust 配置合同锁定共享几何，不能为追求表面 DRY 改成不完整数组。

实现继续遵守 renderer bridge 边界：`app.js` 不裸调 Tauri；`window-controls.js` 只消费冻结 bridge 的固定 `main` label 窗口操作，capability 只新增 minimize/toggle-maximize/close。源码合同已覆盖四命令、最大化图标与四语名称；拖拽、双击标题栏、键盘焦点、高对比度及真实 Windows Snap/缩放仍需真机验收。

## 5. 验收口径

macOS:

- AX 实测红灯相对外框目标为 `(12, 12, 16, 16)`。
- 标题栏上下留白各 `12pt`；内容左缘与红灯中心 `x=20pt` 共线。
- 更新入口以 `7pt` 间距紧随标题，与 Windows 使用同一 DOM 顺序和 Flex 关系。
- packaged screenshot 必须按截图前后的新鲜窗口坐标捕获，禁止复用启动前坐标。
- 外圆角只验证原生裁切未丢失，不把约 `24pt` 测量冻结为跨系统精确断言。

Windows:

- 不出现双标题栏，不出现 macOS 交通灯或其占位。
- 产品标题从左侧 `12px` 起，更新入口只在有可用更新时以 `7px` 间距紧随标题；右侧只保留 Windows caption controls。
- 三个右侧按钮的状态、图标与命中区在 100%/125%/150% scaling 下保持正确。
- 最小化、最大化/还原、关闭、拖动、双击、边缘缩放、Aero Snap 与高对比度全部需要真机证据。
- DWM 外圆角按目标 Windows 版本观察，不用 renderer 截图假造系统框通过。

跨平台组件:

- Select 必须保持 Trigger 与当前选中 Item 的视觉中心对齐；不能退回固定 top 偏移或浏览器原生弹出层。
- macOS 从系统应用菜单打开产品内 About Dialog，Windows 从标题栏信息入口打开同一 Dialog；两者共用四语内容、真实应用版本和固定项目链接枚举。
- renderer 只能提交 `repository` 或 `license`，Rust command 与 privilege 适配器必须再次拒绝任意 URL；默认浏览器跳转不允许引入第二套 opener。

## 6. 非目标

- 不在 macOS 自绘外框或替换原生交通灯。
- 不要求 macOS 与 Windows 外圆角数值一致。
- 不引入 React、shadcn、Base UI、Tailwind 或 CDN 来实现三个窗口按钮。
- 不用透明窗口、CSS shadow 或 SVG mask 替代平台窗口管理器。
- 本文不证明 Windows 实机已经通过，也不替代 updater、DMG/NSIS 或 release evidence 门。
