# capabilities/
> L2 | 父级: ../CLAUDE.md

成员清单
default.json: 仅授予 `main` 窗口基础 core/window/webview、标题区 `start_dragging` 及 Windows caption 明确消费的 minimize/toggle-maximize/close；不开放任意定位、尺寸、装饰或创建窗口权限。
about.json: 仅授予独立 `about` 窗口 renderer 的 `core:app:allow-version`；项目链接继续由固定 Tauri command/privilege 白名单收口，不授予 About 页面创建、定位、尺寸、装饰、焦点或任意窗口管理权限。

依赖边界:

该模块是 WebView 与原生窗口之间的最小 ACL；renderer 不直接获得全局 Tauri API，新权限必须同时有明确 UI 消费者和合同测试。

法则: 最小权限·窗口精确·不暴露全局 API

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
