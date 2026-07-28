# renderer/
> L2 | 父级: ../CLAUDE.md

成员清单
index.html: 跨平台静态 DOM 骨架，固定安装信息、语言选择、操作按钮、状态输出与 modal 权限弹窗锚点。
styles.css: 唯一样式源，定义窗口布局、按钮、权限弹窗、状态面板、自定义 select 与视觉 token。
app.js: 唯一交互源，按系统语言本土化 UI，调用 `window.cavalryI18n` 完成跨平台状态读取、安装位置选择、刷新 English、应用确认、权限等待态与重启；Windows 仅在 `requestElevation` 时显示管理员重试，并以稳定 errorCode 四语提示先保存/关闭仍运行的 Cavalry。
tauri-bridge.js: 非视觉兼容桥，在 Tauri 壳里于 `app.js` 前定义 `window.cavalryI18n`，归一化 camelCase payload、稳定 errorCode、平台与权限动作，保留六命令消费契约。

依赖边界:
renderer 不知道 Tauri command 或 `.app`/`.exe` 布局；它只依赖 `window.cavalryI18n` 兼容 API。Tauri bridge 必须在 `app.js` 执行前注入，并只转发 renderer 真正消费的平台中立状态字段。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
