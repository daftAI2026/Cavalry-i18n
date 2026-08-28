# tests/
> L2 | 父级: ../CLAUDE.md

成员清单
tauri_version_contract.rs: 断言 npm 与 Cargo Tauri 依赖 exact pin 到同一个 v2 minor。
tauri_config_contract.rs: 宿主无关断言 renderer/460×440 窗口/macOS 原生交通灯 Overlay/local CSP/禁用 global Tauri/capabilities、macOS 配置不覆盖外部 release signing identity、平台资源隔离与 Windows 双 DLL；NSIS 固定四语、保留翻译/恢复 English 双语义、更新保留与失败中止合同。
updater_signature_contract.rs: 解析共享配置内嵌的 updater minisign 公钥；ignored 真实产物门接收显式 artifact/`.sig` 路径，解开 Tauri 外层 Base64 后流式验签，不读取私钥且不创建 tag/Release。
command_contract.rs: 断言 6 个 command 注册名、旧权限字段、`platform`/`permissionAction`、稳定 `errorCode`、可组合 `warningCodes` 与 renderer 兼容 camelCase JSON shape。
bridge_webview_contract.rs: 通过 Node 执行 `bridge::script()` 返回的实际 Rust initialization include，断言冻结 `window.cavalryI18n`、camelCase/warningCodes 与 Builder/HTML source 顺序；明确不替代 packaged WebView/CSP 外部门。
detect_contract.rs: 断言保存路径优先、任意 Windows 安装根规范化、typed XML/binary Info.plist、展示版本不伪造，并验证非 MSI 安装的不可变二进制 mutation 必然改变 revision、受控 ExtensionLayer mutation 不改变 macOS revision。
patch_contract.rs: 断言 English 提取、精确插件 manifest/hash、重复 canonical destination/component-boundary fail closed、原始 Unix mode manifest 与 mac exact restore/overlay pairs、copy pair/snapshot、packaged-English 逐叶内容证明与 revision provenance 失效，验证 keyed overlay 保留 smoother/未来节点，并锁定 smoother 属性的英简繁日四语同构。
mac_runtime_contract.rs: 断言 wrapper 的 mixed DYLD/owned language 环境策略、trusted Info.plist bytes、typed XML/binary 改写、首次 runtime pair 的 wrapper-before-Info 顺序、目标路径，以及 default/override `macos-apply-transaction` journal 存在时的 final-marker 运行门。
privilege_contract.rs: 断言复制/Keychain/签名、Windows Known Folder UAC、macOS authenticated transaction 源码边界、事务 SHA-256/reparse/typed exit 与 libproc exact-PID 关闭边界；Signing 未登记有界 mutation、canonical→tombstone 清理中断、首装第三次 PID 扫描与 observe-only JSON 漂移由 apply_transaction owner tests 执行真实 kill/reopen。
process_dispatch_contract.rs: 断言 Windows 进程入口按 same-EXE 提升 worker→uninstall English restore→headless Cavalry launch→Tauri WebView 的固定顺序消费保留参数。
state_contract.rs: 断言 Tauri state.json 的当前 revision/快照 provenance schema、normalize、读写、typed control recovery diagnostic/commit outcome、无 generation 重写的显式目录 durability reconfirm 与旧 state serde-default 迁移。
manual_macos_smoke.rs: 真实 macOS ignored smoke test，在 APFS 副本跑三语 apply、重复 apply、strict codesign 与 English 恢复，并将候选 injector 外加载到真实 Cavalry 进程，要求每种语言的三个菜单哨兵全部出现，输出日志/inventory 哈希，并核验 provenance、进程存活及原安装关键文件零变化。
manual_windows_smoke.rs: 默认 ignored 的 Windows 克隆验收，只接受显式 `%TEMP%` disposable 安装；逐级守卫 JSON/plugin/marker/qwindows/recovery 写入链，依次验证简繁日全部资源、smoother、QPA ACTIVE、manifest 绑定的 immutable-generation English 快照，以及显式 English 对 38 JSON 与 vendor qwindows 的原始字节恢复；RecordingRunner 只允许一次 exact-path graceful close，禁止 UAC。
manual_windows_live_smoke.rs: 默认 ignored 的 Windows disposable live-clone 三门薄入口，公共实现按 capture/clone-guard/Adjacent/orchestration/toolchain/tests 六个 support 分片收敛；FullSurfaces 使用 run-root 下的 TEMP-owned `APPDATA`/`LOCALAPPDATA` profile，启动前以 `assets/Icons/sign-in-bg.png`、`cavByCanva.png`、`tool_search.png` 三个非空哈希哨兵证明 clone 关键样式完整，再覆盖 Transform/Viewport/Edit Shape/可选 Cog Pitch；Onboarding/Adjacent 由 acceptance-only plugin 在 driver 创建前启用 sentinel-owned Qt test profile，不复制或伪造登录态。Onboarding 等 MainDock 稳定后 manager-first 触发 firstLaunch，前四步只点击唯一 localized Next 且由下一页唯一标题/正文确认转场，第 5 步只 ACK，工作区重置框出现即失败；Adjacent 真实点击 `TagHeader`、真实 Drop 双 nonce fixture、向 exact Assets receiver 投递 ContextMenu，并以 producer QWidget grab + 同 PID HWND 锚点封存 3 张 PNG。三门都要求 write-once 身份、English 恢复和零进程；逻辑证据完成后以 exact HWND `WM_CLOSE` 清理，超时只对复核后的同 EXE/PID ForceStop，清理方式不参与翻译 PASS。显式设置 release tag/installer/provenance/generic/QPA 环境变量时，Onboarding/Adjacent 只有在当前 checkout 的运行时 source DLL 与最终 NSIS shipped DLL 字节一致时，才通过 toolchain 分片优先执行 `npm_execpath` 与活动 Node、缺失时执行固定 Windows shell fallback，额外写入 TEMP session sentinel、machine record 与每张 PNG 的 PID/HWND inventory；人工 review/final 由 `tools/windows-acceptance/review_windows_acceptance.js` 从现有截图派生。
support/: ignored Windows smoke 的路径安全支撑；见 `support/CLAUDE.md`。

依赖边界:
默认测试只读配置、临时安装 fixture 或通过 fake runner 调用 Rust API，不访问真实 Cavalry 安装、不启动 GUI/UAC；例外是显式 `--ignored` 的 macOS/Windows disposable clone smoke。Windows live smoke 要求 clone/evidence 两个显式 `%TEMP%` 根与 sentinel 双重证明，所有写目标逐级拒绝 reparse/越界，并把无 OCR 的 PNG 结果停在人工 gate；Onboarding/Adjacent 的 qttest/Cavalry 目录还要求独立固定 magic sentinel 与 reparse 拒绝。acceptance-only DLL 只在测试进程前写入 disposable `generic/`，退出后删除，发布 generic 目录仍只有产品 DLL；Ctrl+C/强制终止不承诺 cleanup。

法则: 合同先行·配置可证·无真实副作用

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
