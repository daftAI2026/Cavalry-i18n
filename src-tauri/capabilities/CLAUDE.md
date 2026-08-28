# capabilities/
> L2 | 父级: ../CLAUDE.md

成员清单
default.json: 仅授予 `main` 窗口基础 core/window/webview 能力与标题区 `start_dragging`；拖动权限只服务本地 `data-tauri-drag-region`，不开放任意窗口变更 API。

依赖边界:

该模块是 WebView 与原生窗口之间的最小 ACL；renderer 不直接获得全局 Tauri API，新权限必须同时有明确 UI 消费者和合同测试。

法则: 最小权限·窗口精确·不暴露全局 API

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
