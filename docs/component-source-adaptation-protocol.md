<!--
[INPUT]: 依赖项目 Design token、renderer 现有无框架组件状态机、锁定版本的 shadcn/ui 与 Phosphor 上游源码及其许可证。
[OUTPUT]: 对外提供从开源组件源码到本项目原生 HTML/CSS/JS 的统一调查、抽象、适配、验证和归因协议。
[POS]: docs 的 UI 工程知识基线；约束 Select、Tooltip、AlertDialog、Marker、Spinner、shimmer、scroll-fade 与后续 Toast 等自写组件，避免凭截图仿制或引入第二套设计系统。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 开源组件源码适配协议

本项目不安装 React、Base UI、Tailwind、完整图标包或 CDN，但也不凭视觉记忆重写成熟组件。正确路径是：**锁定上游源码 → 理解完整状态与依赖 → 映射到项目语义 token → 用原生 HTML/CSS/JS 实现 → 以合同证明行为同构。**

## 1. 三层所有权

| 层级 | 真相源 | 决定什么 | 不决定什么 |
| --- | --- | --- | --- |
| 产品设计系统 | `renderer/tokens.css`、`docs/audits/switcher-ui-final-build-2026-08-28.md`、Vercel design.md | 字号角色、字重、颜色、4px 间距、窗口层级、平台差异 | 组件内部状态机与无障碍细节 |
| 组件行为 | 锁定提交的 shadcn/Base UI 源码、样式、示例、文档 | DOM 组成、状态、键盘、焦点、ARIA、动画公式、utility API | Cavalry 业务阶段和用户文案 |
| 产品业务 | renderer 状态机与 Tauri bridge/Rust Channel | 何时出现、真实事件顺序、失败恢复、哪些状态可被用户观察 | 组件基础几何和开源实现细节 |

任何实现都必须尊重这个依赖方向。组件不能发明业务事实；业务代码不能复制组件状态机；上游原子类不能在项目里形成第二套 token。

## 2. 调查闭包

不能只打开文档示例或只看组件文件。每次适配必须读取同一上游版本的完整闭包：

1. 组件根、子槽位和 variant 源码。
2. 所选风格的最终 CSS；Tailwind class 只是索引，最终规则才是视觉事实。
3. 官方示例，包括 disabled、error、RTL、reduced-motion、长内容和组合用法。
4. 组件依赖的 utility、primitive 和图标。
5. Accessibility/API 文档。
6. LICENSE、copyright、commit SHA 与 package version。

若上游组件本身不拥有某项行为，就不得声称“照官方实现”。例如 Marker 规定行、图标槽、内容槽与 variant，但不规定业务阶段何时到达；逐行节奏必须由本项目的任务表现状态机负责。

## 3. 适配决策表

落代码前，为每个能力写出三类决策：

- **原样投影**：公式或状态语义不变，只翻译技术载体。例如 shimmer 的渐变算法、Select 的 active/selected 分层、Tooltip 的 Escape 收口。
- **项目化适配**：保留行为，数值和结构接入现有 token/DOM。例如 shadcn `gap-2` 映射为项目 `--space-2`，React slot 映射为稳定 HTML anchor。
- **明确拒绝**：当前产品不需要的能力不复制。例如多选 Select、远程 portal 框架、任意 URL updater、泛化日志、未实现 Toast 队列。

“以后可能会用”不是复制理由。新增能力必须有当前用户任务、真实数据源和测试入口。

## 4. Tailwind 到语义 CSS

转换规则：

1. 展开上游最终 CSS，禁止只按 class 名猜值。
2. 通用设计值先归入 `tokens.css` 的已有角色；已有角色能表达时不得新建同义 token。
3. 组件独有值可以新增语义 token，但必须注明来源和用途，不能命名为 `--value-12` 之类的数字容器。
4. 状态选择器应表达组件状态，如 `data-state="running"`，而不是依赖 DOM 偶然位置。
5. 动画只改变 `opacity`/`transform` 等不扰动布局的属性；不得用 height/margin/padding 动画破坏滚动锚定。
6. `prefers-reduced-motion`、forced-colors、键盘焦点和文本溢出属于实现本体，不是最后补丁。

示例：官方 shimmer 的默认公式为 `20deg`、`3ch + 40px` spread、`currentColor` 的 `alpha × 0.2` 高光、`2s linear infinite`，背景从 `100% 0` 到 `0 0`。项目可以更名为 operation 语义 token，但不能用一条“看起来差不多”的三色渐变替代。

## 5. 状态机与业务事件

组件状态与业务状态必须分层：

- Select 管 `closed/open`、`active`、`selected`、键盘与焦点；它不知道语言如何应用。
- Tooltip 管 hover/focus/Escape/触摸与 portal 定位；它不知道更新是否可用。
- AlertDialog 管确认、取消、焦点恢复与阻塞语义；它不知道权限如何授予。
- Marker 管图标槽、内容槽、running/terminal 视觉；它不知道后端下一阶段是什么。
- scroll-fade 和 live-edge 管可视位置；它们不能制造或丢弃事件。

对于快速后端事件，表现层可以让**已经到达**的状态按人类可读节奏串行显示，但不能阻塞事务、预铺未来步骤或延迟错误。终态错误优先于动画；成功结语只能排在真实阶段之后。

## 6. 验证矩阵

每个适配组件至少具备：

1. **静态合同**：DOM anchor、token 依赖、禁止远程资源、上游公式和不可达旧实现。
2. **状态机测试**：键盘、焦点、ARIA、增量更新、错误/取消和 reduced-motion 分支。
3. **组合测试**：组件与真实 renderer 业务调用链共同执行。
4. **原生窗口检查**：确认 WebView、系统标题栏、字体和平台差异；网页预览不能替代 Tauri 证据。
5. **打包检查**：只在发布候选阶段验证 CSP、资源闭包、包体与签名；开发截图不能冒充 package PASS。

截图只回答“像不像”，合同回答“为什么不会漂”。两者缺一不可。

## 7. 当前锁定基线

| 来源 | 锁定版本 | 当前用途 |
| --- | --- | --- |
| shadcn/ui | commit `683a5a9b370acdb7785a0529434e6a3b8c7e0441` | Marker、Select、Tooltip、AlertDialog、示例与 accessibility 基线 |
| `shadcn` npm package | `4.19.0` | `tailwind.css` 中 shimmer/scroll-fade 最终 utility 公式 |
| Phosphor Icons Core | commit `2b75f3ad12b420c9504ef05df8d2564a28f8500e` | `renderer/icons.js` 中精选 Regular SVG path |

运行时不依赖这些包；版本只用于源码审计和归因。适配代码与许可见 `renderer/THIRD_PARTY_NOTICES.md`。

## 8. 新组件进入仓库的最短路径

1. 在真实用户任务中证明需要该组件，而不是因为组件目录里存在。
2. 锁定上游版本并完成调查闭包。
3. 写适配决策表，优先复用现有 token、图标、弹层和状态机。
4. 先建立 L3 契约，再实现结构/状态/视觉。
5. 增加静态与运行时合同；需要视觉时另建不进入发布证据的预览。
6. 更新 `renderer/CLAUDE.md`、`docs/CLAUDE.md` 和相关设计决策。
7. 最后检查许可证与包体，确认没有意外引入框架/CDN。

核心判断只有一句：**复用成熟设计的知识，不复制造成运行时负担的框架。**
