<!--
[INPUT]: 依赖 injector/CavalryTranslatorInjector.mm、tools/build_translator_injector.sh、src-tauri/src/{commands,privilege,keychain_patch}.rs 与 manual_macos_smoke.rs 的最终实现和 2026-07-13 本机验证记录
[OUTPUT]: 对外提供 runtime 热路径、增量签名、真实 Cavalry 注入与功能等价性的完成证据、性能数据和残余边界
[POS]: docs/audits 的 dated 性能实施报告，闭环 2026-05-21 根因审计与 docs/roadmap/runtime-refresh-performance.md
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Runtime Performance Implementation — 2026-07-13

## 结论

本轮优化没有用翻译可靠性换速度。普通 Qt 交互已经从“全局 widget 扫描 + inventory 写盘”收敛为 dirty object / direct children 局部补译；显式 session capture、菜单首次绘制、Dialog 局部首帧、QuickAdd 异步 model 更新和 Time Editor 英文保护仍保留。Rust apply 改为异步执行、进程内 AtomicBool + macOS state-dir `flock` 跨进程单飞、内容差异复制、changed-code-only 签名，并在任何快路径验签失败时回退到全量修复；restart 也受同一锁保护。

真实 Cavalry 2.7.2 进程已外加载本分支候选 dylib，三种目标语言均产出非 placeholder 的 `live-injector` inventory；APFS 副本完成三语 apply、重复 apply、English 恢复和 `codesign --verify --deep --strict`。测试前后 `/Applications/Cavalry.app` 的关键代码/配置文件保持逐字节一致。

## 核心实现

### Injector 热路径

- 普通运行没有显式 session/capture 时，不创建 UUID、不调用 `QApplication::allWidgets()` 导出 inventory、不写 cache。
- `Show`、`ActionAdded`、`MouseButtonRelease`、`ChildAdded` 只处理相关 QObject 与直接子控件；菜单继续在 `aboutToShow/ActionAdded/Show` 同步补译。
- `QAbstractItemView` 监听 `rowsInserted/modelReset/dataChanged`，覆盖 QuickAdd 在窗口显示后异步填充的 item。
- QLabel/QLineEdit Paint 采用随 QObject 生命周期清理的 `(lang, text, placeholder)` fingerprint；外部文本变化后仍会重新翻译。
- `(context, source)` 精确查找改为 QHash，并保留生成表的 exact first-match-wins；source-only 路径保留历史 last-match-wins。
- 固定动态规则使用函数级 `static const QRegularExpression`，dirty queue 批量弹出，构建启用 `-O2`。

### 可搬移 Qt 链接

真实进程验证曾捕获一个构建风险：把临时副本或仓库 Qt SDK 的绝对 RPATH 写入 injector，会让 Cavalry 同时加载两套 Qt 并在平台初始化时 SIGABRT。发布 dylib 现在优先使用 `@loader_path`，即只解析它所在 `Contents/Frameworks` 的 Qt；构建 SDK 不再作为运行时 fallback。合同同时检查 checked-in dylib 必须含 `@loader_path` 且不得含 `qt_sdk/.../lib` RPATH。

### Apply 与签名

- `extract_english`、`apply_language` 使用 `spawn_blocking`；extract/apply/restart 共用进程内 AtomicBool 快拒绝与 macOS `flock(LOCK_EX | LOCK_NB)`，两个切换器进程不能同时修改或重启同一 state-dir 管理的安装，进程崩溃由内核自动释放锁。
- staging 前按文件内容与 mode 过滤无变化 pair；没有变化仍执行 deep/strict verify，损坏 seal 会自动修复。
- 有变化时只签实际变化的 injector / ExtensionLayer 和 outer app，再执行 deep/strict verify。
- 快路径签名或验签失败时，按 canonical path + inode 去重执行完整 nested repair，最后二次验签。
- 快路径删除 `--remove-signature` 与 outer `--deep`；只有 repair fallback 保留 `--deep`。
- Keychain patch 的 production 路径消费 owned `Vec<u8>`，不再复制约 46.5MB 的 dylib buffer。

## 验证证据

### 翻译语义等价

优化前 dylib 与候选实现使用同一 Qt 夹具对比：

- 12,994 个 `(context, source)` exact keys：0 mismatch。
- 71 个 normalized-source 冲突 key：0 mismatch。
- zh-Hans / zh-Hant / ja_JP 的窗口标题、菜单、QAction、QLabel、QLineEdit、QuickAdd 异步 item 与 duplicate first-match 全部逐字段一致。
- `generated_translations.inc` 与变更前 SHA-256 相同；本轮没有改翻译资产。

### Injector 性能

同机、1000 QLabel、10 次点击、两轮平均：

| 指标 | 优化前 | 优化后 |
| --- | ---: | ---: |
| 交互阶段最大 timer jitter | 87.893 ms | 0.299 ms |
| 启动阶段最大 timer jitter | 246.537 ms | 171.968 ms |
| user CPU | 1.350 s | 0.500 s |
| 普通运行 inventory 导出 | 47 | 0 |

checked-in universal dylib 从 2,646,208 bytes 降到 2,335,008 bytes，arm64/x86_64 与 ad-hoc-only `flags=0x2` 保持不变；最终源码产物与 Tauri packaged resource 的 SHA-256 均为 `eef1ca71daec699888530a755dea6c3fb89b508612a9910f65b5ba0aa16360eb`。

### 真实 Cavalry 与副本 apply

`npm run test:tauri:manual-smoke` 在本机完成并通过：

- 最终 APFS clone apply：zh-Hans 1.625s、重复 zh-Hans 1.420s、zh-Hant 1.619s、ja_JP 1.797s。
- 每次 apply 后，clone 内 injector 与候选 dylib byte-for-byte 相同，deep/strict codesign 通过。
- clone 最后恢复 English marker 与 canonical `languages/en` snapshot，签名再次通过。
- 同一候选 dylib 外加载到真实 `/Applications/Cavalry.app/Contents/MacOS/Cavalry`，三语进程均稳定存活并输出：
  - zh-Hans：`文件 / 编辑 / 合成`
  - zh-Hant：`檔案 / 編輯 / 合成`
  - ja_JP：`ファイル / 編集 / コンポジション`
- 三份 inventory 均为 formatVersion 3、`source=live-injector`、真实 PID / bundle hash / session UUID，且日志包含 bootstrap、translator installed 与 inventory export。
- 真实安装只用于加载候选 dylib；测试没有把候选文件覆盖进 `/Applications`，关键文件前后快照一致。

最终 smoke 要求每种语言的三个哨兵全部出现，并在临时 session 清理前输出可复核摘要：

| Language | PID | Session | Menu sentinels | Inventory SHA-256 | Log SHA-256 |
| --- | ---: | --- | --- | --- | --- |
| zh-Hans | 66822 | `REAL-zh-Hans` | `文件 / 编辑 / 合成` | `0c305a6ef6aa0fdeded11d7cd1ea2ea340afd378c9434c559212b89c03eb4376` | `e48974165c43aedbd809d676b443cc4567f9755449f23da0652fc273886536f0` |
| zh-Hant | 66910 | `REAL-zh-Hant` | `檔案 / 編輯 / 合成` | `00227533bf37bf41c51365767c639a04a110c4cad2da8ca55d243e2b3e226616` | `e775461eef9227f6ed7646b78dd9869a9b6c06dc583411e6c57a40dc3c561f9a` |
| ja_JP | 67492 | `REAL-ja_JP` | `ファイル / 編集 / コンポジション` | `291352d79d1533c72d96b7dc32330ab375bd69817b65334519a692a2412e4612` | `50542c0ab9600357535abe25ae78574a42c6dff7b05e0d3984607c85731e95f4` |

三次 capture 的真实 executable bundle hash 均为 `413ec3b79eab2caa6d1dfff32f3ad20ba071c4d7b143f842be337e986119b332`。

最终发布级回归同时通过：121/121 Node contracts、24 个 Rust unit tests、38 个 Rust integration tests、`cargo check`、Tauri app/DMG build、packaged 5 pass / 1 architecture skip、DMG layout，以及真实可见桌面上的 packaged window 1/1 pass / 0 skip。

Waza 对最终工作树进行了独立只读复审：P0/P1/P2 均为 0，结论为 no blocker；未提交/未推送状态被明确视为交付状态而非已发布分支提交。

## 参考任务复核

Codex task `019f3919-757d-7710-b8f3-01bf095b0e0e` 确实创建过 `codex/user-story-feature-audit`，但没有 commit/push；其修改后来以 dirty worktree 进入本分支。自定义 select 的 `change` 语义和空 warning 修复正确，已保留；重复 popup 同步已删除，`warning: None` 因 `skip_serializing_if` 会省略字段。

原任务的 `28 PASS / 2 BLOCKED` 不能作为“每个用户行为均测试”的证据：多条 PASS 只有源码/fixture/contract。窗口测试原先用无关窗口数量判断 AX 可用并可能空心 skip；现已改为明确 AX 查询、使用 `sips` 读取截图尺寸，真实 packaged 窗口回归已执行通过。canonical workbook 必须按本轮最终证据重算状态，而不是沿用旧结论。

## 残余边界

- live inventory 逐一证明三语首屏三个菜单哨兵与真实 injector 路径；全 UI 100% matrix 仍是发布前更宽的覆盖门，不应与本轮性能正确性混为一谈。
- 本轮真实 smoke 不调用产品 `restart` command；restart 的命令顺序与 renderer 时序有自动合同，但 path/PID-bound 的真实重启仍按 PARTIAL 记录，不能混入 injector 通过结论。
- deep/strict verify 本身约 1.4s，因此重复 apply 不追求“零耗时”；这是一条有意保留的安全成本。
- 当前成果位于 `codex/performance-overhaul` 工作树，遵循仓库约束尚未 commit/push，不冒充已发布的分支提交；候选 dylib 不主动覆盖用户已安装的旧 injector，真实安装更新仍由产品 Apply 操作完成。
