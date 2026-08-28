# renderer/
> L2 | 父级: ../CLAUDE.md

成员清单
assets/: renderer 离线视觉资产边界，固定 Geist Sans/Mono v1.7.2 与 OFL 许可，不引入远程字体或组件运行时。
index.html: 跨平台语义化 DOM 骨架，以安装对象、语言主任务、英文维护、状态反馈建立四级信息架构；业务控件默认禁用直到状态 bootstrap 完成，固定跳转导航、仅更新可用时出现的单一图标/tooltip 与独立无障碍通知、macOS 官方/受管安装态、三种目标语言的原生选择、英文恢复/英文快照按钮、独立官方还原、原生 dialog 与状态 live region 锚点；只加载本地资源。
styles.css: 唯一样式源，以 Geist 排印、36px 桌面控件、6/8px 圆角、4px 倍数间距和克制边界实现 Vercel design.md 判断；顶部二维关系与桌面三动作同排使用 Grid，维护语义容器以 `display: contents` 参与共享列，420px 冻结最小窗宽只收紧该动作行的横向 padding 而不缩字或换行，图标/标题行与弹窗动作使用 Flex，文档流保持自然布局；路径使用 Mono、状态自然语言使用 Sans，macOS 以平台安全顶距避开原生标题栏；绿色只表达可用更新，16px 用户指定 SVG 置于 32px 点击区，tooltip 同时支持 hover/focus，默认静止且尊重 reduced motion。
app.js: 唯一交互源，按系统语言本土化 UI，调用冻结的 `window.cavalryI18n` 完成跨平台状态读取、`uninitialized/loading/ready` 控件门禁、更新检查/通知/确认/安装重启、安装位置选择、English 快照/恢复与独立官方还原；更新图标生产默认隐藏，仅由签名验证后的可用 Update 或显式开发 preview 展示，preview 不访问网络，真实安装只消费 Rust 保存的 pending Update；原生 dialog `close` 事件独占清理与焦点归还，tooltip 的 click/Escape 收口明确；所有后端 warning/updater error 只消费稳定 code 并本土化，禁止显示 raw prose、URL 或签名。
tauri-bridge.js: 非视觉兼容桥，在 `app.js` 前定义最小冻结 API；归一化 camelCase payload、稳定 `warningCodes`/updater error codes、Action/Status 与脱敏 Update DTO；更新安装不接收 renderer 提供的 URL、版本或签名，丢弃插件原始响应并只请求 Rust State 中最近一次已检查对象。
ui-text.js: 稳定的 English/简体中文/繁体中文/日文 renderer 文案目录；维护动作使用不换行的紧凑可见名称并保留完整无障碍名称，更新文案覆盖 tooltip、可用通知、安装确认、稳定错误与 macOS 新包 ad-hoc/Gatekeeper 提醒。

依赖边界:

renderer 不知道 Tauri command 或 `.app`/`.exe` 布局；它只依赖 `window.cavalryI18n` 兼容 API。Tauri bridge 与 `ui-text.js` 必须在 `app.js` 执行前注入，并只转发 renderer 真正消费的平台中立状态字段；Node VM 只验证生产源语义，packaged WebView/CSP 属于独立外部门。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
