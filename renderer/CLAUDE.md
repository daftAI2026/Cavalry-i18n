# renderer/
> L2 | 父级: ../CLAUDE.md

成员清单
index.html: 跨平台语义 DOM 骨架，在 macOS Overlay 原生交通灯后提供标题/更新入口，Windows 左起位置再提供 About 并在右侧另设三枚原生语义控件；安装 Item 将当前语言与 macOS 安装信任分成相邻双徽章，语言主任务使用隐藏原生数据槽 + combobox/listbox 语义骨架，所有业务板块只以留白分层，内容继续展开三动作 Recovery Button Group + 持久 Alert，保留更新 tooltip、两种英文恢复语义、About/确认 dialog 和全部稳定控件锚点；macOS About 由系统应用菜单唤起，只加载本地资源。
tokens.css: 离线设计角色的唯一真相源，按颜色/徽章、排印、边界/阴影、窗口 Chrome、布局/控件、Select、Tooltip/Dialog 与状态/动效边界组织语义 token；语言身份使用 Geist purple-subtle 语义色并与安装状态色正交，同值只在共享设计语义时复用，不把无关数字硬合并为通用间距。
styles.css: 跨平台共享视觉实现，只消费 tokens.css 且不定义私有设计常量；以 14/12/10px 三级字号、400/600 两级字重、Grid 复合轨道与 Flex 一维内容流实现冻结布局；路径、徽章、Tooltip 与跳转链接共用 10px/400/14px 元数据角色并禁止字重合成，安装名称与 Section 标题用 text-box-trim 读取字体度量，Alert 保留标题行盒/正文行距；标题栏与原生控件共享 y=20 几何中心线，安装摘要、Switch to 与 Recovery 全部只以稳定留白分层。
about.css: About 专属视觉层，复用共享 Tooltip/Dialog/token，为 Windows 提供 24px 标题栏信息入口，并为两平台提供 GitHub 标识、Switcher 版本、完整项目地址与 MIT 许可证链接，不污染 macOS 标题栏或高频业务布局。
window-controls.css: Windows caption 专属视觉层，以 40px 标题栏、右侧 12px 外边距、32px 点击目标和 12px Windows 图形对齐 macOS 的 y=20 中心线；最大化/还原图标分态，关闭按钮有独立危险状态与 forced-colors 回退，不绘制 HWND 外框、阴影或圆角。
select-control.js: 无依赖单选组件状态机，按 Base UI 的 open/active/selected 分层投影 combobox/listbox/option ARIA，并以真实布局盒让选中项中心锚定 Trigger；按 shadcn Nova 的 trigger/popup/item/check 构成实现方向键、Home/End、Enter/Space、Escape、typeahead、指针高亮与外部点击收口，只同步隐藏原生 select，不读取业务或 Tauri 状态。
about-dialog.js: 无依赖 About 组件状态机，向 macOS 系统菜单暴露只读 show 入口、仅在 Windows 展示标题栏按钮，并管理 Tooltip、Dialog 焦点归还、真实 Switcher 版本读取和 repository/license 固定枚举分发；仅显示项目地址，绝不把 URL 当作 renderer 控制的系统输入。
window-controls.js: 无依赖 Windows caption 状态机，只在 `platform=windows` 展示右侧最小化/最大化或还原/关闭，消费 bridge 固定 main-window 操作并在 toggle/resize 后同步最大化状态、四语可访问名称；失败不污染业务 Alert，macOS 路径不执行窗口 mutation。
app.js: 唯一业务交互源，按系统语言本土化 UI，调用冻结的 `window.cavalryI18n` 与独立 `createSelectControl` 完成跨平台状态读取、`uninitialized/loading/ready` 控件门禁、受控语言选择、更新检查/通知/确认/安装重启、安装位置选择、English 快照/恢复与独立官方还原；当前语言徽章消费 `currentLang`，macOS 安装徽章只把可分类的真实安装投影为官方/已翻译/已修改，Switcher pending journal 恢复只进入阻断 Alert 而不冒充 Cavalry 安装状态，Windows 与无安装态不伪造信任结论；持久 Alert 以真实可达状态选择具体结果/风险/动作标题，正文承载影响和恢复路径，禁止把 raw backend error/warning 当用户文案；更新图标生产默认隐藏，仅由签名验证后的可用 Update 或显式开发 preview 展示，真实安装只消费 Rust 保存的 pending Update。
tauri-bridge.js: 非视觉兼容桥，在 `app.js` 前定义最小冻结 API；归一化 camelCase payload、稳定 `warningCodes`/updater error codes、Action/Status 与脱敏 Update DTO，并将固定 `main` label 的 minimize/toggle/is-maximized/close 暴露给独立 Windows caption 状态机；更新安装不接收 renderer 提供的 URL、版本或签名。
ui-text.js: 稳定的 English/简体中文/繁体中文/日文 renderer 文案与 `STATUS_TITLE_KEYS` 状态标题路由；标题、Windows caption 可访问名称、正文、语言/安装双徽章、主任务与 Recovery 层级全部本地化，Alert 遵循“结果/风险在标题，影响/恢复在正文”，更新文案覆盖 tooltip、可用通知、安装确认、稳定错误与 macOS 新包 ad-hoc/Gatekeeper 提醒。

依赖边界:

renderer 不知道业务 Tauri command 或 `.app`/`.exe` 布局；它只依赖 `window.cavalryI18n` 兼容 API。唯一平台例外是 `window-controls.js` 消费固定 `main` label 的四项 Tauri window 命令，不能扩成任意窗口管理器。bridge、文案与 Select/About/Windows caption 三个组件状态机必须在 `app.js` 前加载；Node VM 只验证生产源语义，packaged WebView/CSP 属于独立外部门。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
