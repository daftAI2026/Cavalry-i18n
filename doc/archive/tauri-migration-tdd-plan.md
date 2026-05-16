# Cavalry-i18n Tauri 迁移 TDD 方案

> 目标：迁移到 Tauri，但保持 UI 100% 一致、功能 100% 一致。
> 口径：UI 不重写；现有 `desktop-patcher/renderer/index.html`、`styles.css`、`app.js` 是唯一 UI 真相源。

---

## 1. 不变契约

### 1.0 本方案边界与文档协议

本方案主要约束 Tauri 迁移、UI 保真、功能等价、TDD 阻塞门。

GEB 分形文档不参与 Electron 行为 snapshot，也不参与 Tauri 功能等价比较；snapshot 只证明“旧行为”和“新行为”是否一致。

但后续迁移实施一旦创建或修改架构文件，必须同步文档相：

- 新增 `src-tauri/` 前，先补根 `CLAUDE.md` 作为 L1 项目宪法。
- 新增 `src-tauri/` 时，同步创建 `src-tauri/CLAUDE.md` 作为 L2 模块地图。
- 新增 Rust 业务模块时，补齐文件头部 L3 契约。
- 修改模块职责、接口、目录结构时，同步更新对应 L2/L1 文档。
- 文档同步作为迁移实施验收项，不得替代行为测试，也不得绕过仓库协议。

### 1.1 UI 100% 一致

UI 一致不靠“重做得像”，而靠“不动原件”。

必须保持：

- `desktop-patcher/renderer/index.html` 原样作为 Tauri 页面入口。
- `desktop-patcher/renderer/styles.css` 原样作为唯一样式源。
- `desktop-patcher/renderer/app.js` 原样作为唯一交互源。
- DOM 结构、CSS token、状态文案、按钮顺序、选择器行为不迁移到 React/Vue/Svelte。
- Tauri 只能在底层提供与 Electron preload 等价的 `window.cavalryI18n` API。

禁止：

- 禁止重写 UI。
- 禁止“视觉相似”的替代实现。
- 禁止为了 Tauri 方便而改 DOM、class、文案、布局。

允许但必须显式登记：

- 如果 Tauri 无法在页面加载前注入兼容层，才允许增加一个非视觉 bridge 文件。
- 一旦需要改 `index.html` 引入 bridge，必须先让 UI hash 测试红灯，再把该变更列为唯一例外。

### 1.2 功能 100% 一致

Electron 当前暴露 5 个能力，Tauri 必须提供同名、同参数、同返回结构的等价能力：

| Renderer API | Electron IPC | Tauri Command | 等价要求 |
| --- | --- | --- | --- |
| `getStatus()` | `i18n:get-status` | `get_status` | 字段名、默认路径、语言列表、`needsExtract` 语义一致 |
| `browseApp()` | `i18n:browse-app` | `browse_app` | 选择 `.app` 后写 state，取消返回 `{ canceled: true }` |
| `extractEnglish(appPath)` | `i18n:extract-english` | `extract_english` | 提取核心 JSON 与插件 JSON 的路径映射一致 |
| `applyLanguage(appPath, lang)` | `i18n:apply-language` | `apply_language` | JSON 覆盖、runtime 文件、提权、重签、quarantine、state 更新一致 |
| `restartCavalry(appPath)` | `i18n:restart-cavalry` | `restart_cavalry` | quit + `open -n` 行为一致 |

---

## 2. 目标架构

Tauri 只替换 Electron 主进程和 preload，不替换 renderer。

```text
Cavalry-i18n/
├── desktop-patcher/
│   ├── renderer/                 # 原样保留，UI 真相源
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   └── injector/
│       └── libCavalryTranslatorInjector.dylib
├── languages/                    # 原样作为语言资源
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── lib.rs                # Tauri command 注册
│       ├── commands.rs           # 5 个 renderer API 的等价入口
│       ├── detect.rs             # Cavalry 探测、Info.plist 版本读取
│       ├── patch.rs              # JSON 提取、插件发现、copy pairs、staging
│       ├── mac_runtime.rs        # wrapper、Info.plist 改写、injector 安装
│       ├── privilege.rs          # osascript/codesign/xattr/open 的命令适配
│       ├── state.rs              # state.json 读写与 normalize
│       └── bridge.rs             # 注入 window.cavalryI18n 兼容层
└── doc/
    └── tauri-migration-tdd-plan.md
```

设计原则：

- Renderer 不知道 Electron 已经消失。
- Rust command 返回 JSON shape，不把 Tauri 类型泄漏到 UI。
- 文件系统副作用集中在 `patch.rs`、`mac_runtime.rs`、`privilege.rs`。
- 外部命令一律通过 `CommandRunner` 抽象，测试不直接执行 `codesign`、`xattr`、`osascript`。
- Tauri 版本必须固定在同一个 v2 minor，`tauri`、`tauri-build`、`tauri-cli`、`@tauri-apps/api` 不允许用漂移的宽松版本。

---

## 3. TDD 总策略

先修复 Electron baseline，再隔离 Electron 副作用，然后冻结行为，最后让 Tauri 追平现实。

### 3.0 当前阻塞事实

2026-04-23 复核结果：

```bash
npm run check:desktop   # 绿
npm run test:desktop    # 红，37 个测试中 5 个失败
```

当前失败项：

- renderer 测试仍断言 `Current:`，但实际 UI 文案已经是 `Current —`。
- `package.json` 缺少 runtime UI coverage gate 脚本。
- `package.json` 缺少 compiled UI extraction workflow 脚本。
- `package.json` 缺少 per-language full UI blocker 脚本。
- `package.json` 缺少 matrix full UI blocker 脚本与 runlog 路径。

结论：

- 现在不能进入 Tauri 实现。
- 现在不能捕获 Electron snapshot 作为可信基准。
- 第一阶段必须是修复并冻结 Electron baseline。

### 3.1 Baseline 绿灯

当前 Electron 版本作为行为基准，先保住已有测试：

```bash
npm run check:desktop
npm run test:desktop
```

新增 baseline 测试：

```bash
node --test tools/check_renderer_contract.js
node --test tools/check_electron_contract_snapshots.js
```

注意：`check_electron_contract_snapshots.js` 不能直接驱动真实 Electron IPC。当前 `applyLanguage` 会触发 injector 构建、提权 copy、`codesign`、`xattr`、restart 等真实系统副作用。必须先建立 Electron harness，把 dialog、userData、文件系统根目录、外部命令 runner 全部替换成 fake，再捕获 snapshot。

`check_renderer_contract.js` 固定三件事：

- renderer 三文件 hash。
- `window.cavalryI18n` 需要的 5 个方法名。
- HTML 里核心控件 id 不变：`appVersion`、`appPath`、`currentLanguage`、`languageSelect`、`browseButton`、`extractButton`、`applyButton`、`statusText`。

### 3.2 红灯定义

每个迁移阶段必须先出现真实失败：

- `src-tauri` 不存在，Rust contract tests 失败。
- Tauri command 未注册，bridge tests 失败。
- 纯函数未实现，fixture tests 失败。
- 命令调用顺序不对，fake runner tests 失败。
- 资源未打包，packaging tests 失败。

没有红灯，不写实现。

### 3.3 绿灯定义

绿灯不是“能启动”，而是可比较的等价结果：

- Electron fixture 输出和 Tauri fixture 输出一致。
- Renderer 文件 hash 一致。
- Electron 与 Tauri 主窗口截图和布局锚点在阈值内一致。
- Tauri bridge 暴露同名 API。
- fake Cavalry bundle 被 patch 后文件树一致。
- fake command runner 记录到的 `codesign`、`xattr`、`open` 调用顺序一致。

---

## 4. 分阶段红绿清单

### Phase -1：修复并冻结 Electron baseline

目的：先让旧世界可信。旧世界不可信，新世界追平的是噪音。

红灯：

- `npm run test:desktop` 当前失败 5 个用例。
- renderer 文案断言与真实 HTML 不一致。
- package scripts 对 runtime/full UI coverage 的暴露不满足现有测试。
- `desktop-patcher/main.js` 无法在无副作用 harness 中加载 5 个 IPC handler。

绿灯：

- `npm run check:desktop` 绿。
- `npm run test:desktop` 绿。
- 先把 `desktop-patcher/main.js` 的 IPC 注册拆成可注入装配函数：
  - `registerI18nHandlers(ipcMain, deps)` 只注册 5 个 handler。
  - `createI18nHandlers(deps)` 返回可直接测试的 handler map。
  - `main.js` 只负责 Electron 真实依赖装配、窗口创建、应用生命周期。
- `deps` 必须显式包含 `fs`、`os`、`path`、`spawn`、`spawnSync`、`dialog`、`appPaths`、`resourcesPath`、`now`、`platform`、`commandRunner`。
- 新增 Electron harness，能在测试中注入：
  - fake `app.getPath('userData')`
  - fake `dialog.showOpenDialog`
  - fake `spawn` / `spawnSync`
  - fake packaged resource path
  - fake file root 或临时目录
- Electron 的 5 个 IPC handler 可在 fake bundle 上运行，不触发真实 `osascript`、`codesign`、`xattr`、`open`。

阻塞：

- `npm run test:desktop` 不绿，禁止进入 Phase 0。
- IPC handler 没有拆成 `registerI18nHandlers(ipcMain, deps)` 或等价可注入 factory，禁止进入 Phase 0。
- Electron handler 仍直接绑定真实系统命令，禁止捕获 snapshot。
- Electron snapshot 需要管理员权限或会修改真实 `/Applications`，禁止执行。

### Phase 0：冻结 UI 与 Electron 行为

红灯：

- 新增 `tools/check_renderer_contract.js`，先故意写入当前 hash，任何 UI 文件改动会失败。
- 新增 Electron contract snapshot，只通过 Phase -1 的无副作用 harness 记录 5 个 IPC 在 fake bundle 下的返回 shape。
- 新增 Electron 主窗口截图和布局锚点 baseline：窗口尺寸、核心控件 bounding box、按钮顺序、状态文本、字体加载状态。

绿灯：

- 当前 Electron 测试全绿。
- renderer hash 测试全绿。
- contract snapshot 可复现，且运行日志证明没有真实系统命令被执行。
- Electron 主窗口视觉 baseline 可复现，截图和布局锚点写入固定快照。

阻塞：

- UI 文件 hash 变化，迁移停止。
- 当前 Electron baseline 不绿，迁移停止。
- snapshot harness 触发真实 `osascript`、`codesign`、`xattr`、`open`，迁移停止。
- 主窗口截图或布局锚点无法稳定复现，迁移停止。

### Phase 1：Tauri 壳与 bridge

红灯：

- `cargo test tauri_versions_are_pinned_to_one_v2_minor` 失败。
- `cargo test bridge_exposes_cavalry_i18n_api` 失败。
- `cargo test registers_five_commands` 失败。
- Tauri 无法加载现有 `index.html` 失败。
- 真实 WebView 集成测试证明 `app.js` 执行时 `window.cavalryI18n` 不存在。
- capability 配置未授权 5 个 command，bridge 调用被拒绝。
- dialog 方案未固定：要么使用 Tauri dialog plugin 并配置权限，要么用 Rust 原生 `rfd`/系统对话框且测试覆盖。

绿灯：

- `Cargo.toml` 与 package scripts 固定 Tauri v2 同一 minor 版本，不使用裸 `^2` 漂移。
- Tauri app 能加载同一份 `desktop-patcher/renderer/index.html`。
- `tauri.conf.json` 显式启用 `app.withGlobalTauri = true`，让无 bundler 的 vanilla renderer 可以访问 `window.__TAURI__`。
- capabilities 明确允许 `get_status`、`browse_app`、`extract_english`、`apply_language`、`restart_cavalry`。
- dialog 选择 `.app` 的实现和权限配置能在真实 WebView 测试中通过。
- 使用 Tauri WebView 的 pre-page-load 初始化能力注入兼容 JS，在页面脚本执行前创建 `window.cavalryI18n`。
- bridge JS 内容只做一件事：从 `window.__TAURI__.core.invoke` 取出 `invoke`，把 5 个方法映射到 Tauri command，并保持 Electron preload 的 Promise 返回语义。
- 5 个方法返回占位错误，但签名已稳定。

阻塞：

- Tauri v2 minor 版本未固定，迁移停止。
- 如果必须修改 `app.js` 才能接 Tauri，方案失败。
- 如果 bridge 注入晚于 `app.js` 执行，方案失败。
- 如果 `app.withGlobalTauri` 未启用且没有等价自带 bridge 机制，方案失败。
- capability 缺失导致任一 command 不能从 renderer 调用，方案失败。
- dialog 插件或替代方案无权限/无测试，方案失败。
- 如果 CSP 或 asset 加载方式导致 bridge 无法在真实 WebView 中运行，方案失败。

### Phase 2：探测与状态

红灯：

- `find_cavalry_app_prefers_saved_path` 失败。
- `read_bundle_version_from_info_plist` 失败。
- `normalize_state_defaults_to_english` 失败。
- `get_status_matches_electron_shape` 失败。

绿灯：

- 默认候选路径与 Electron 一致：`/Applications/Cavalry.app`、`~/Applications/Cavalry.app`。
- `state.json` schema 与 Electron 一致。
- `get_status` 返回字段与 Electron snapshot 一致。

阻塞：

- 字段名变化，迁移停止。
- `needsExtract` 语义变化，迁移停止。

### Phase 3：英文提取与语言包映射

红灯：

- `extract_english_copies_core_files` 失败。
- `discover_plugins_to_camel_case` 失败。
- `build_copy_pairs_matches_electron` 失败。
- `stage_files_preserves_mode` 失败。

绿灯：

- 核心文件映射一致：
  - `Definitions/nodeStrings.json`
  - `Definitions/appStrings.json`
  - `Learn/tips.json`
  - `Learn/onboarding.json`
- 插件映射一致：`Plugins/{Folder Name}/strings.json` 到 `plugins/{camelName}.json`。
- staging 文件名、权限保留策略等价。

阻塞：

- 任何一个文件映射缺失，迁移停止。
- 插件 camelCase 结果与 Electron 不一致，迁移停止。

### Phase 4：macOS runtime patch

红灯：

- `build_launch_wrapper_matches_electron` 失败。
- `rewrite_info_plist_executable_to_wrapper` 失败。
- `lang_marker_empty_for_english` 失败。
- `runtime_pairs_include_plist_wrapper_injector_marker` 失败。

绿灯：

- wrapper shell 内容与 Electron 等价。
- `CFBundleExecutable` 从 `Cavalry` 改为 `CavalryLauncher`。
- `en` 写空 marker，非英文写语言代码加换行。
- injector 目标路径为 `Contents/Frameworks/libCavalryTranslatorInjector.dylib`。

阻塞：

- wrapper 内容不等价，迁移停止。
- injector 打包路径不可解析，迁移停止。

### Phase 5：提权、重签、quarantine、重启

红灯：

- `copy_tries_direct_then_admin_on_permission_error` 失败。
- `finder_fallback_used_for_app_bundle_permission_denied` 失败。
- `resign_collects_nested_macho_paths` 失败。
- `quarantine_clear_ignores_missing_xattr` 失败。
- `restart_quits_then_opens_new_instance` 失败。

绿灯：

- 直接 copy 成功时不提权。
- 权限错误时走 `osascript ... with administrator privileges`。
- macOS 拒绝 shell copy 时保留 Finder fallback。
- 重签顺序与 Electron 逻辑一致：内部 Mach-O，再 bundle。
- `xattr -dr com.apple.quarantine` 缺失属性时不报错。
- restart 使用 AppleScript quit，再 `open -n appPath`。

阻塞：

- 测试里出现真实 `sudo`、真实 `codesign`、真实 `xattr`，迁移停止。
- fake runner 无法断言调用顺序，迁移停止。

### Phase 6：真实打包与资源

红灯：

- `tauri_build_contains_renderer_files` 失败。
- `tauri_build_contains_injector_dylib` 失败。
- `tauri_build_contains_languages` 失败。
- `tauri_bundle_app_size_report` 失败。
- `tauri_config_enables_global_api_for_vanilla_bridge` 失败。
- `tauri_config_declares_capabilities_and_resource_access` 失败。
- `tauri_local_build_sop_replaces_electron_builder` 失败。
- Tauri 主窗口截图或布局锚点与 Electron baseline 超阈值。

绿灯：

- `.app` 内包含 renderer、languages、injector。
- `doc/LOCAL_BUILD_SOP.md` 已改为 Tauri 打包 SOP：使用 `tauri build`，不再把 `electron-builder -m` 作为默认发布路径。
- 当前 Electron 打包 SOP 已归档到 `doc/archive/LOCAL_BUILD_ELECTRON_SOP.md`，只作为回退期文档存在。
- Tauri SOP 明确记录：
  - Qt `6.6.3` 与 `CAVALRY_QT_PREFIX` 仍用于编译 injector。
  - injector 编译由 `npm run build:injector`、`beforeBuildCommand` 或 `beforeBundleCommand` 中的唯一流程触发。
  - renderer 由 `build.frontendDist` 指向 `desktop-patcher/renderer` 或等价只读产物。
  - `languages`、injector dylib 通过 `bundle.resources` 打进 Tauri `$RESOURCE/`。
  - DMG、icon、产物路径按 Tauri 输出目录验证。
- Tauri 外框尺寸补偿 Electron `useContentSize` 语义：配置 `480x528`、最小 `420x528`，保持内容区仍为 `480x500`。
- Tauri 配置显式包含 `app.withGlobalTauri = true`，或测试证明无需该配置也能在 vanilla HTML 中获得等价 `invoke` 能力。
- Tauri capabilities、dialog 权限、asset/resource 访问规则显式覆盖 renderer、languages、injector 和 5 个 command。
- 资源路径在 dev 和 packaged 模式下都能解析。
- Tauri 主窗口截图、字体加载状态、核心控件 bounding box、按钮顺序、状态文本与 Electron baseline 在阈值内一致。

阻塞：

- packaged 模式找不到 injector，迁移停止。
- packaged 模式找不到 languages，迁移停止。
- 窗口尺寸不同，迁移停止。
- `withGlobalTauri` 配置缺失且 bridge 无等价机制，迁移停止。
- capabilities 或资源权限缺失，迁移停止。
- `doc/LOCAL_BUILD_SOP.md` 仍指向 `electron-builder -m`，迁移停止。
- Electron SOP 未进入 `doc/archive/`，迁移停止。
- 用户可见 UI 回归超过阈值，迁移停止。

### Phase 7：真实 macOS 冒烟

红灯：

- 在干净 fake bundle 上跑不通完整 apply。
- 在真实 Cavalry.app 副本上无法完成 Apply & Restart。
- 回滚 English 后 UI 状态不一致。

绿灯：

- `zh-Hans`、`zh-Hant`、`ja_JP` 三种语言可应用。
- `English` 可恢复。
- 应用后 Cavalry 可直接启动目标语言。
- 重启后状态显示与 marker 一致。

阻塞：

- 任何语言不能应用，不能宣称功能 100%。
- 真实 macOS 提权流不能走完，不能删 Electron。

---

## 5. 测试文件规划

新增测试建议：

```text
tools/
├── check_renderer_contract.js          # UI 文件 hash 与 DOM/API 锚点
├── electron_harness.js                 # 无副作用加载 Electron handler 的测试壳
├── capture_electron_contract.js        # 只通过 harness 捕获 Electron 行为 snapshot
├── check_electron_contract_snapshots.js
├── capture_electron_window_baseline.js # Electron 主窗口截图与布局锚点
├── check_tauri_window_regression.js     # Tauri 对比 Electron UI baseline
├── check_tauri_build_sop.js             # Tauri SOP 默认路径与 Electron SOP 归档检查
└── fixtures/
    └── make_fake_cavalry_bundle.js

src-tauri/
├── src/
│   ├── detect.rs
│   ├── patch.rs
│   ├── mac_runtime.rs
│   ├── privilege.rs
│   └── state.rs
└── tests/
    ├── bridge_webview_contract.rs
    ├── tauri_config_contract.rs
    ├── tauri_version_contract.rs
    ├── command_contract.rs
    ├── detect_contract.rs
    ├── patch_contract.rs
    ├── mac_runtime_contract.rs
    ├── privilege_contract.rs
    └── packaging_contract.rs
```

Fixture 策略：

- 用测试代码生成 fake `Cavalry.app`，不要提交大二进制。
- fake bundle 必须包含 `Contents/Info.plist`、`Contents/assets`、`Contents/MacOS`、`Contents/Frameworks`。
- fake command runner 只记录命令，不执行系统副作用。
- Electron harness 必须能替换 `dialog`、`app.getPath`、`process.resourcesPath`、`spawn`、`spawnSync`。
- Electron snapshot 捕获只允许访问临时目录和 fake bundle。
- Tauri bridge 测试必须覆盖真实 WebView 加载顺序，不只检查字符串存在。
- Tauri config 测试必须断言 vanilla bridge 所需的 `withGlobalTauri` 或等价机制存在。
- Tauri version 测试必须断言 Tauri v2 依赖固定到同一个 minor。
- Tauri capability 测试必须断言 5 个 command、dialog 能力、资源访问规则可用。
- Tauri build SOP 测试必须断言 `LOCAL_BUILD_SOP.md` 不再包含默认 `electron-builder -m`，且 Electron SOP 已归档。
- UI 回归测试必须至少覆盖截图、窗口尺寸、字体加载状态、核心控件 bounding box、按钮顺序、状态文本。
- 真实 macOS 冒烟单独放 `manual` 或 `ignored`，不能阻塞日常单元测试。

---

## 6. 切换策略

不能一次性替换。正确顺序是并行、追平、再切换。

1. 修复当前 Electron baseline，让 `npm run test:desktop` 变绿。
2. 建 Electron 无副作用 harness。
3. 捕获 Electron contract snapshot。
4. 捕获 Electron 主窗口 UI baseline。
5. 保留 Electron 当前入口。
6. 固定 Tauri v2 版本、capabilities、dialog、资源访问协议。
7. 加入 Tauri 入口和测试。
8. Tauri 后端追平 5 个 API。
9. Tauri packaged build 通过资源测试和 UI 回归测试。
10. 将 `doc/LOCAL_BUILD_SOP.md` 改为 Tauri 打包 SOP，并把当前 Electron SOP 归档到 `doc/archive/LOCAL_BUILD_ELECTRON_SOP.md`。
11. 同步后续新增/修改文件的 GEB 文档相。
12. 真实 macOS 冒烟通过。
13. 默认 `npm run build` 切到 Tauri。
14. Electron 构建脚本保留一个版本周期作为回退。
15. 回退期结束后再删除 Electron 依赖。

删除 Electron 的前置条件：

- Electron baseline 全绿。
- Electron snapshot 由无副作用 harness 捕获。
- Electron 主窗口 UI baseline 已捕获。
- Tauri v2 版本、capabilities、dialog、资源访问协议已固定并测试。
- `doc/LOCAL_BUILD_SOP.md` 已是 Tauri 默认打包流程，旧 Electron SOP 已归档。
- Tauri contract tests 全绿。
- 当前 Electron baseline 与 Tauri snapshot 无差异。
- Tauri 主窗口 UI 回归通过。
- 后续新增/修改的 Tauri 模块完成对应 `CLAUDE.md` 与 L3 契约同步。
- 三语言真实 apply 通过。
- English 恢复通过。
- packaged `.app` 可独立运行。

---

## 7. 主要风险

### 7.1 WebKit 与 Chromium 渲染差异

风险：Tauri macOS 使用系统 WebKit，Electron 使用 Chromium。即使 HTML/CSS 不变，字体栅格化可能有差异。

处理：

- 不用“视觉重写”修差异。
- 保持源码同一份。
- 必须做用户可见 UI 回归：截图、窗口尺寸、字体加载状态、核心控件 bounding box、按钮顺序、状态文本。
- UI 契约分两层：renderer 文件 hash 防重写，视觉回归防 WebKit/Chromium 造成用户可见漂移。

### 7.2 提权不是 Tauri 自动解决

风险：Tauri 没有自动替代当前 `osascript with administrator privileges` 的魔法按钮。

处理：

- 继续用 Rust 调用 macOS 原生命令。
- 所有命令通过 `CommandRunner` 测试。
- 真实提权只在冒烟阶段执行。

### 7.3 packaged 资源路径变化

风险：dev 模式能找到 `languages` 和 dylib，packaged 模式找不到。

处理：

- 资源路径独立封装。
- dev/packaged 都有测试。
- injector 缺失时必须报明确错误。

### 7.4 当前 Electron 后端过大

风险：`desktop-patcher/main.js` 同时负责窗口、状态、补丁、提权、签名、重启，直接翻译成 Rust 会得到同样的大泥团。

处理：

- Rust 不按文件机械翻译。
- 按职责拆成 `detect`、`patch`、`mac_runtime`、`privilege`、`state`。
- 每个模块先测试，再实现。

### 7.5 Tauri 配置漂移

风险：Tauri v2 的 `withGlobalTauri` 默认为 `false`，capabilities 是命令调用边界，dialog 和资源访问也受配置影响；如果版本或权限漂移，bridge 可能在 dev 能跑、packaged 失败。

处理：

- 固定 Tauri v2 同一 minor。
- 用配置测试锁死 `withGlobalTauri`、command capabilities、dialog 方案、资源访问规则。
- dev 和 packaged 都必须跑 bridge 与资源解析测试。

### 7.6 打包 SOP 漂移

风险：当前 `doc/LOCAL_BUILD_SOP.md` 是 Electron 发布流程，默认依赖 `electron-builder -m`、Electron `build.files`、`extraResources` 和 DMG 盖章脚本。迁移后如果文档仍指向旧流程，代码已经是 Tauri，发布知识却还停在 Electron。

处理：

- Phase 6 必须把 `LOCAL_BUILD_SOP.md` 改成 Tauri 默认发布流程。
- 旧 Electron SOP 只允许归档到 `doc/archive/LOCAL_BUILD_ELECTRON_SOP.md`，作为回退期历史文档。
- Tauri SOP 必须把 Qt 6.6.3 injector 编译、`tauri build`、`bundle.resources`、DMG/icon 产物验证写成唯一链路。
- 回退期结束后，删除 Electron 构建脚本时同步删除或标记归档 SOP 失效。

---

## 8. 完成定义

迁移完成必须同时满足：

- 当前 Electron baseline 已修复并冻结。
- Electron contract snapshot 不触发真实系统副作用。
- UI 三文件未发生非批准变更。
- Electron 与 Tauri 主窗口 UI 回归通过。
- `window.cavalryI18n` 5 个方法仍可被现有 `app.js` 直接调用。
- Tauri vanilla bridge 的 `withGlobalTauri` 或等价机制已被配置测试覆盖。
- Tauri v2 版本、capabilities、dialog、资源访问协议已被配置测试覆盖。
- 真实 Tauri WebView 验证 bridge 早于 `app.js` 注入。
- Tauri command 返回结构与 Electron snapshot 一致。
- fake bundle 单元测试全绿。
- fake command runner 调用顺序全绿。
- packaged `.app` 包含 renderer、languages、injector。
- `doc/LOCAL_BUILD_SOP.md` 已切换为 Tauri 打包 SOP，当前 Electron SOP 已归档到 `doc/archive/LOCAL_BUILD_ELECTRON_SOP.md`。
- 后续新增/修改文件的 GEB 文档同步已完成。
- 真实 macOS 上 Apply & Restart 成功。
- English 恢复成功。
- Electron 删除前仍有一个可运行回退点。

如果任何一项不满足，不能声称 UI 100% 或功能 100%。

---

## 9. 品味自检

- 可消除的特殊情况：把平台分支收敛到 `privilege.rs`，不要让每个 command 都判断 macOS。
- 超过三层缩进：Rust command 只做调度，复杂流程拆到纯函数和小模块。
- 不必要抽象：不引入前端框架，不引入状态管理库，不重做 UI。
- 最不优雅代码：当前 Electron `main.js` 是职责泥团；迁移时必须借机拆开，而不是逐行翻译。
