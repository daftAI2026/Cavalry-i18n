# renderer/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
index.html: 静态 DOM 骨架，固定应用信息、语言选择、操作按钮、状态输出与 modal 权限弹窗锚点。
styles.css: 唯一样式源，定义窗口布局、按钮、权限弹窗、状态面板、自定义 select 与视觉 token。
app.js: 唯一交互源，按系统语言本土化 UI，调用 `window.cavalryI18n` 完成状态读取、授权预检呈现、选择 app、刷新 English、应用确认、权限等待态与重启。
tauri-bridge.js: 非视觉兼容桥，在 Tauri 壳里于 `app.js` 前定义 `window.cavalryI18n`，只归一化 camelCase payload，暴露 renderer 消费字段并补充 `openPrivacySecurity`。

依赖边界:
renderer 不知道 Tauri command 细节；它只依赖 `window.cavalryI18n` 兼容 API。Tauri bridge 必须在 `app.js` 执行前注入，并只转发 renderer 真正消费的状态字段。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
