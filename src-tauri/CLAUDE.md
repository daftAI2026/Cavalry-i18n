# src-tauri/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
Cargo.toml: Rust crate 与 Tauri v2 依赖声明，`tauri` 与 npm Tauri 包保持 2.10 minor，`tauri-build` exact pin 到其真实发布线。
build.rs: Tauri build script 入口，读取 `tauri.conf.json` 并生成 runtime context。
tauri.conf.json: Tauri app 配置，指向原 renderer、启用 `withGlobalTauri`、固定窗口尺寸与 bundle resources。
capabilities/: Tauri v2 capability 配置，限定 main window 的 core 权限。
icons/: Tauri runtime 默认窗口图标，`icon.png` 必须保持 1024x1024 8-bit RGBA，避免 `generate_context!()` 启动崩溃。
src/: Rust command 与纯函数模块，替代 Electron 主进程业务能力。
tests/: Rust contract tests，守住版本、配置、command JSON shape、窗口 bridge、文件映射与真实 macOS 手动冒烟入口。

依赖边界:
Tauri 只替换 Electron main/preload；renderer 三文件仍是 UI 真相源。Rust command 返回 Electron 兼容 JSON shape，不把 Tauri 类型泄漏到 `app.js`。

法则: 版本精确·桥先注入·命令等价·副作用可测

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
