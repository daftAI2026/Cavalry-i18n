# workflows/
> L2 | 父级: ../CLAUDE.md

成员清单
build.yml: 主 CI/CD 工作流，支持手动触发、main/PR/tag 自动触发；release tag 在任何平台构建前必须证明 commit 已包含于 `origin/main`，source artifact 保留 injector/acceptance 源码并排除 dylib/DLL，Linux 跑版本/release/Node/翻译合同，PR/main 另在无 Cavalry.app 的干净 macOS Runner 编译/链接 universal product injector 及 host-arch acceptance drivers/exact-window helper，后者只防 producer 腐烂、不替代 live gate；Windows 通过统一 resolver 准备 Qt 6.6.3 SDK，现场构建 generic translator 与 QPA delegate，跑 Node/Rust/NSIS 安装态守门并上传 provenance 已复算的唯一 EXE 与 sidecar；tag/手动触发才生成双架构 Tauri DMG，最终以 `release.config.json` 与精确 CHANGELOG 区块发布三资产并写回 badge。

依赖边界:
workflow 只调用仓库里已经存在的脚本与构建入口；默认 build 变更时这里必须同构更新。

法则: 脚本唯一·产物可追踪·release 不漂移

变更日志
2026-05-14: `build.yml` 增加 `workflow_dispatch` 与 `npm run check:version`，让 GitHub 可手动自助打包，同时阻止版本漂移进入 CI 产物。
2026-05-14: macOS packaging 增加本地 `aqt-venv` 并通过 `PYTHON` 传入 resolver，避开 GitHub macOS 系统 Python 的 PEP 668 管理限制；构建步骤按 `LOCAL_BUILD_SOP.md` 显式执行 `CSC_IDENTITY_AUTO_DISCOVERY=false`、`APPLE_SIGNING_IDENTITY="-"`、`npm run tauri:build`、DMG 盖章，以及除 `manual-smoke`/GUI window regression 外的 SOP 验证门；GitHub clean checkout 不执行本地 stale bundle 清理。
2026-05-15: packaging artifact 与 tag Release 回归直接发布 `*.dmg`，对齐常见 GitHub 桌面应用 Release 结构。
2026-05-15: release job 改为产品化标题和手写 release notes，避免只输出自动 changelog 链接；macOS packaging 在 Tauri build 前 `unset CI`，避免 create-dmg 跳过 Finder 美化，并新增 DMG 布局挂载验证。
2026-05-15: release notes 模板改为第一次发布可读的产品说明，中文为主并补充日文短说明与英文独立工具声明，包含用途、支持语言、权限提醒和下载入口，不在用户侧 Release 说明中展示内部 SOP 构建验证细节。
2026-05-15: macOS packaging job 限制为 `cavalry-*-p*` tag 与手动触发，main/PR push 不再自动生成 macOS DMG artifact；Release 继续只由 `cavalry-*-p*` tag 创建。
2026-05-15: macOS packaging 显式设置 `APPLE_SIGNING_IDENTITY="-"`，让 GitHub runner 走与本地一致的 Tauri ad-hoc bundle signing，避免 release DMG 安装后缺少 `CodeResources` 被 Gatekeeper 判定 damaged。
2026-05-15: release notes 增加未 notarized 下载包的首次打开说明、`xattr -dr com.apple.quarantine` 命令，以及按 `LOCAL_BUILD_SOP.md` 让本机 agent 从源码构建的提示词。
2026-05-15: tag 发布协议从内部 `v*` SemVer 改为 `cavalry-*-p*`，并由 `tools/release_metadata.js` 读取 `release.config.json` 生成 release 标题与 GitHub Release DMG 资产名。
2026-05-17: README badge 与 CI 表述改用 GitHub Release tag / `cavalry-*-p*`，避免历史 `v0.1.x` SemVer tag 再污染用户可见发布入口。
2026-06-04: Release job 在 `gh release create` 成功后写回 `docs/badges/release.json` 到 main，让 README 使用 Shields endpoint badge 而不是实时 GitHub Release API badge。
2026-06-10: macOS packaging 改为 matrix 同时构建 `aarch64-apple-darwin` 与 `x86_64-apple-darwin`，Release notes 提供 Apple M 芯片与 Intel 芯片两个 DMG 下载入口。
2026-06-10: Release notes 下载入口从 markdown 表格改为 `[Apple M芯片](...) | [Intel芯片](...)` 行内链接样式，移除多余的 `Release: ${RELEASE_TITLE}` 行；清理遗留死 tag `cavalry-2.7.2-p2`，实际发布版号从 p3 回退为 p2。
2026-07-14: Release job 不再只发布固定产品模板；它先以 `INTERNAL_APP_VERSION` 调用 `tools/extract_release_changelog.js`，在缺失、重复、未标日期或空区块时阻断发布，再把精确版本更新摘要插入产品说明与下载入口之间。
2026-07-23: 全部依赖安装改为 `npm ci`；新增 `windows_check`，在 `windows-latest` 安装 Qt 6.6.3 `qtbase`，运行 Windows plugin 双测试、Node/Rust 合同和显式 `tauri.windows.conf.json` NSIS 构建，上传 Windows 安装包，并把跨平台 hook/Python helper 纳入 source artifact。
2026-07-24: source artifact 上传完整 `tools/`，使 package scripts、hook bootstrap、Node gate 与其验证依赖保持同一可复现闭包；release 配置只允许 Apple Silicon DMG、Intel DMG 与 Windows x64 NSIS 三种资产，拒绝 x86/i686 变体。
2026-07-24: tag release 下载 `cavalry-i18n-windows-nsis` artifact，按 `release.config.json` 规范化稳定 Windows x64 EXE 名，并与 Apple Silicon/Intel 两个 DMG 同时发布；release notes 增加 Windows 下载与非固定盘符说明。
2026-07-24: Windows NSIS 构建后新增 `test:tauri:windows-nsis` 安装态 gate；固定 HKCU/快捷方式已存在时拒绝运行，只在随机 TEMP 根以 `/S /NS` 安装并静默卸载，artifact 缺失改为 hard failure。
2026-07-27: Windows NSIS smoke 与 artifact 上传统一消费显式 `x86_64-pc-windows-msvc` target 目录，禁止回退到可能残留旧 EXE 的隐式 `target/release` 路径。
2026-07-27: Windows Qt SDK 安装改为复用 `prepare:qt-sdk:windows` 与 `cavalry_qt_target.json` 的平台投影，不再在 workflow 里独立手写版本与 aqt 架构。
2026-07-27: Windows artifact 改为成对上传唯一 NSIS EXE 与 provenance sidecar；构建/安装态 smoke 共用内容 fingerprint，防止 stale bundle 被 wildcard 当成当前发布包。
2026-07-27: Windows runner 同次构建 generic translator 与 QPA delegate；provenance/NSIS 安装态同时证明双 DLL 的 x64 与摘要，原生 Cavalry 入口不再依赖子进程 plugin 环境。
2026-07-28: source artifact 显式排除平台生成的 dylib/DLL；macOS/Windows runner 分别从共享源码现场构建原生库，macOS artifact 只上传已嵌入 dylib 的 `.app`/DMG，不再发布冗余的独立 dylib。
2026-07-28: Windows NSIS workflow gate 增加 hooks 无 Cavalry/QPA 写入入口合同与同一安装器 `/UPDATE` 重入，并在安装、同版本更新、卸载后校验独立 TEMP QPA 三文件哨兵未变；该门禁不替代任意真实 Cavalry 根或跨版本升级兼容验收。
2026-07-29: release tag ancestry 前移为所有平台构建的共同 preflight，只接受已包含于 `origin/main` 的 commit；PR/main 新增无 vendor app 的 universal macOS injector 原生编译/链接门，避免 tag 成为 Transform ABI 适配器的第一道真实构建。
2026-07-30: PR/main macOS job 增加 tracked acceptance producer 的 Qt-only compile smoke，在无 Cavalry.app 条件下编译、签名两枚 driver 并构建 exact-window helper；该门只防源码腐烂，不产生 live session 或 PASS。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
