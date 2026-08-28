# renderer/
> L2 | 父级: ../CLAUDE.md

成员清单
index.html: 跨平台语义 DOM 骨架，在 macOS Overlay 原生交通灯下只提供 46px 可拖拽标题内容，不伪造窗口按钮；安装 Item 将当前语言与 macOS 安装信任分成相邻双徽章，语言主任务使用隐藏原生数据槽 + combobox/listbox 语义骨架，内容按安装 Item + 三动作 Maintenance Button Group + 持久 Alert 展开，保留更新 tooltip、两种英文恢复语义、原生 dialog 和全部稳定控件锚点；只加载本地资源。
styles.css: 唯一样式源，以平台系统字体、36px 控件、7/9px 圆角、统一窗口/面板/控件 padding token 与语义色实现 460×440 默认桌面布局；二维结构和动作回流由 Grid 拥有，标题栏、徽章与按钮内部关系由 Flex 拥有，共享 23px 标题栏中心线；持久 Alert 按正式生产文案自然增高，不为伪造诊断定高或建立嵌套滚动，极端溢出只由主内容区兜底；选择器键盘焦点只改变细边框而不绘制外圈，不含交通灯绘制、CDN、字体包或组件运行时。
select-control.js: 无依赖单选组件状态机，按 Base UI 的 open/active/selected 分层投影 combobox/listbox/option ARIA，按 shadcn 的 trigger/popup/item/check 构成实现方向键、Home/End、Enter/Space、Escape、typeahead、指针高亮与外部点击收口；只同步隐藏原生 select，不读取业务或 Tauri 状态。
app.js: 唯一业务交互源，按系统语言本土化 UI，调用冻结的 `window.cavalryI18n` 与独立 `createSelectControl` 完成跨平台状态读取、`uninitialized/loading/ready` 控件门禁、受控语言选择、更新检查/通知/确认/安装重启、安装位置选择、English 快照/恢复与独立官方还原；当前语言徽章消费 `currentLang`，macOS 安装徽章只把真实 `installationMode` 与语言状态投影为官方/已翻译/已修改/需恢复，Windows 与无安装态不伪造信任结论；持久 Alert 以真实可达状态选择具体结果/风险/动作标题，正文承载影响和恢复路径，禁止把 raw backend error/warning 当用户文案；更新图标生产默认隐藏，仅由签名验证后的可用 Update 或显式开发 preview 展示，真实安装只消费 Rust 保存的 pending Update。
tauri-bridge.js: 非视觉兼容桥，在 `app.js` 前定义最小冻结 API；归一化 camelCase payload、稳定 `warningCodes`/updater error codes、Action/Status 与脱敏 Update DTO；更新安装不接收 renderer 提供的 URL、版本或签名，丢弃插件原始响应并只请求 Rust State 中最近一次已检查对象。
ui-text.js: 稳定的 English/简体中文/繁体中文/日文 renderer 文案与 `STATUS_TITLE_KEYS` 状态标题路由；标题、正文、语言/安装双徽章、主任务与 Maintenance 层级全部本地化，Alert 遵循“结果/风险在标题，影响/恢复在正文”，更新文案覆盖 tooltip、可用通知、安装确认、稳定错误与 macOS 新包 ad-hoc/Gatekeeper 提醒。

依赖边界:

renderer 不知道 Tauri command 或 `.app`/`.exe` 布局；它只依赖 `window.cavalryI18n` 兼容 API。Tauri bridge 与 `ui-text.js` 必须在 `app.js` 执行前注入，并只转发 renderer 真正消费的平台中立状态字段；Node VM 只验证生产源语义，packaged WebView/CSP 属于独立外部门。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
