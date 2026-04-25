# desktop-patcher/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
main.js: Electron 原生壳层，创建 480x500 BrowserWindow，装配 dialog、userData、resourcesPath、command runner 后注册 i18n handler。
i18n-handlers.js: 5 个 renderer API 的业务入口，集中状态读写、App Management 授权预检、JSON patch、runtime wrapper、重签、quarantine、restart，可被测试 harness 注入 fake 依赖。
preload.js: Electron renderer 兼容桥，把 `window.cavalryI18n` 映射到 `i18n:*` IPC。
lib/: 纯 Node 辅助模块，负责探测、JSON 文件映射、提权复制。
renderer/: UI 真相源，`index.html`、`styles.css`、`app.js` 原样驱动桌面界面。
injector/: Objective-C++ 动态库与生成翻译表，负责 Cavalry runtime Qt/AppKit 文本注入。
resources/: Electron 图标资产，供本地窗口与打包配置使用。

依赖边界:
main.js -> i18n-handlers.js -> lib/*；renderer 只看 preload 暴露的 `window.cavalryI18n`，不接触 Electron 或 Tauri 细节。

法则: 壳层薄·handler 可测·renderer 不动·系统副作用可替换

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
