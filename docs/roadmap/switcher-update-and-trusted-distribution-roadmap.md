<!--
[INPUT]: 依赖当前 Tauri 发布资产与版本契约、release-seals 的信任边界，以及官方 Tauri updater 的签名/manifest 约束
[OUTPUT]: 对外提供 Switcher 更新提示、自更新与可信分发的 R0/R1 当前事实、剩余前置条件、非目标与验收门槛
[POS]: docs/roadmap 的 Active 主题；记录 R0 已完成、R1 代码基础已落地但分发仍阻塞的边界，不替代当前发布 SOP
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Switcher 更新提示与可信分发路线图

状态: Active
实现状态: R0 行为边界已完成但最终视觉待第二轮精修；R1 Rust/bridge/renderer、最终公钥/endpoint、GitHub updater Secrets、manifest producer 与 tag 发布闭包已实现，真实签名构建与跨版本实机证据仍阻塞
记录日期: 2026-08-28
目标 Cavalry: 2.7.2
依据: [`release.config.json`](../../release.config.json)、[`release-seals/README.md`](../../release-seals/README.md)、[Tauri Updater 文档](https://v2.tauri.app/plugin/updater/)

## 定位

记录 **Cavalry Language Switcher 自身**的更新提示与安全更新能力。当前仓库已实现 R0 界面，并落地 R1 的官方 Tauri updater plugin、脱敏 Rust commands、冻结 bridge 与 renderer 确认/安装状态机，以及 `latest.json`/signature/九资产的 tag 发布闭包。最终 updater 公钥与 GitHub `latest.json` HTTPS endpoint 已写入共享 Tauri 配置；当前远程 p5 尚无 `latest.json`，因此检查会失败关闭并保持图标隐藏，直到首个签名 updater-enabled Release 真实发布。

在 R1 分发闭环完成前，用户仍按现有流程手动下载对应的 macOS DMG 或 Windows NSIS 安装器。远程 p5 仍只有三项人工安装资产；下一个 updater-enabled tag 的代码契约已扩展为三项人工安装资产加六项 updater 资产。这些改动不改变语言切换事务，也不把未经实证的 tag 步骤提前写入 `LOCAL_BUILD_SOP.md`。

## 当前可考虑的最小切片

### R0 — 更新提示 UI / preview state

状态: Behavior done / Visual refinement pending
范围:

- Switcher 顶部身份区预留一个更新图标位置；生产默认完全隐藏，只有 localhost `?preview=update` 或测试专用显式 hook 才显示“有新版本”，禁止误报线上版本。
- 图标使用用户提供的圆圈向上箭头原始 SVG path，视觉尺寸 16×16，外层绿色按钮保持 32×32 点击区；绿色只编码“更新可用”，同时以图标、辅助名称和 tooltip 提供非颜色线索。
- 四语 tooltip 与点击后的状态明确：R0 不访问网络、不打开 GitHub、不下载、不安装、不替换，也不执行热更新；macOS ad-hoc 约束保留在路线图/发布说明，不长期占据主界面。
- preview 分支不触发 bridge/network；生产分支只在 Rust 返回签名验证后的可用 Update 时展示入口。

验收门槛:

- 默认没有更新入口，也不产生网络/Tauri update 调用；显式 preview 才显示图标，点击后仅写入本地化状态，不暗示已经下载或升级。
- 四语 tooltip、按钮辅助名称和状态文本均来自 `ui-text.js`；更新箭头保持用户提供的 exact SVG path，并以 16px 图形置于 32px 操作区。
- 现有发布 SOP、DMG/NSIS 资产和 release seal 不因提示功能改变。

实现与证据:

- UI：`renderer/index.html`、`renderer/styles.css`、`renderer/app.js`、`renderer/ui-text.js`；单一更新图标与 tooltip 位于顶部身份区，保留可见焦点、hover/focus tooltip、响应式布局与可访问名称。
- 预览：`renderer/app.js` 的显式开发/测试 hook 只解除图标隐藏并允许写入本地状态；不经过 update bridge，不调用网络、GitHub 或 Rust command。
- 合同：`tools/check_renderer_contract.js` 与 `tools/check_tauri_bridge_runtime.js` 覆盖 exact SVG path、16/32px 几何、四语 tooltip、默认隐藏、preview 状态、无网络与无 update API。

## 完整自更新的前置条件

### R1 — Tauri updater 基础设施

状态: In progress / Distribution blocked

已实现:

- 固定 `tauri-plugin-updater = 2.10.1`，注册 `check_update` / `install_update`，command 总数从 6 扩展为 8。
- `Update` 只保存在 Rust State；renderer 只取得 `currentVersion/version/notes/pubDate/available/errorCode`，安装不接收 URL、签名或版本参数。
- 检查/安装使用 updater 单飞状态；网络检查不占用 Cavalry bundle lock，真正安装与语言写入复用全局 operation lock。
- bridge 截断非可信 notes/version/date 长度并丢弃 raw response；renderer 生产默认隐藏，发现更新后通过 live announcement、tooltip 与原生 dialog 完成冷更新确认。
- `release.config.json` / `release_metadata.js` 统一人工安装与 updater 资产命名；`create_updater_manifest.js` 从 package SemVer、三平台 artifact/signature 与已审阅 changelog 确定性生成 `latest.json`。
- tag workflow 只在受保护环境加载 updater artifact overlay，生成 macOS 双架构 `.app.tar.gz/.sig` 与 Windows NSIS `.exe.sig`；普通 PR/main 构建不接触私钥。
- ReleaseAcceptanceSeal v5、ReleaseAssetProvenance、`SHA256SUMS` 与 private-draft exact readback 已统一绑定三项人工安装与六项 updater 分发资产；Windows provenance v2 同时约束 tag signature intent。

已完成的密钥配置:

- 已生成独立 updater 密钥对；公钥文件 SHA-256 为 `95a22cd49c1efa14fec74c555a4eefa30daa90b8ae2570614fd0b8336ca82945`，不复用 acceptance attestation 或 release seal 密钥。
- 最终公钥与 `https://github.com/daftAI2026/Cavalry-i18n/releases/latest/download/latest.json` endpoint 已写入 `src-tauri/tauri.conf.json`，并由 Rust 配置合同与 `release.config.json` 交叉固定。

仍必须完成:

- GitHub `release-production` Environment 及 `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 两项 Secrets 已创建；GitHub 只提供名称与更新时间，不回显值。
- 用最终密钥在 macOS 双架构与 Windows x64 真实 tag-shape build 中复验已接入的产物路径、签名 sidecar 与九资产发布闭包。

### R2 — 版本与首次升级策略

状态: Not started

- Cavalry 目标仍是 `2.7.2`；公开 tag 继续使用 `cavalry-2.7.2-pN`，但 `pN` 不是 updater 的版本比较值。
- 当前应用 SemVer 为 `0.7.0`；未来启用 updater 的版本必须递增 SemVer，例如 `0.7.1`，不能用 `p6` 代替应用版本。
- 现有 `p5` 没有 updater 公钥、manifest 和 updater artifacts，因此 p5 用户不能被首个 updater-enabled 版本反向自动升级；首次需要人工安装 bootstrap 版本。
- Switcher 自更新不能顺带改变 Cavalry 的版本兼容承诺。若 Cavalry 从 `2.7.2` 变更到其他版本，必须另行完成 injector/QPA/JSON 兼容性验证。

## 信任边界：三件不同的事

“可信分发”不能被一个签名概念代替：

| 层次 | 作用 | 当前状态 |
| --- | --- | --- |
| Tauri updater 签名 | 证明下载的 updater artifact 是发布方签出的、未被篡改 | 产物/签名/manifest 发布链、最终公钥嵌入与 GitHub 受保护私钥 Secrets 已完成；真实 tag 签名与跨版本证据尚未完成 |
| macOS Developer ID + notarization | 让 macOS 公开分发的 App 具备 Apple 认可的开发者身份与公证记录 | 当前没有 Developer ID 身份，不能声称已完成可信公开分发 |
| Windows Authenticode | Windows 可执行文件的发布者身份与 SmartScreen/企业信任链 | 尚未纳入本路线的实机验证；不能用 Tauri 签名替代它 |

因此，Apple Developer ID/notarization 与 Tauri updater 签名是不同事项；现有 acceptance attestation、release seal、SHA-256 也不能替代 updater `.sig`。当前本地 ad-hoc 包只能作为开发/验证产物，不能据此宣称公开可信分发。

账号与凭据的未来边界:

- R0 是本地 UI preview，不访问 GitHub，不需要新增 Tauri 账号。
- R1 需要维护 updater 密钥，并把私钥文本与口令分别放入受保护 `release-production` Environment Secrets：`TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`；私钥只允许进入受保护 tag 构建步骤的短命环境，不得进入仓库、产物或候选应用运行时；公钥则随应用配置提交。
- 首个 updater-enabled 版本发布前可以废弃测试密钥并重新生成最终密钥；首版发布后，已安装客户端会信任嵌入的公钥，后续不得无迁移方案地轮换或遗失对应私钥。
- macOS 可信公开分发需要 Apple Developer Program / Developer ID 与 notarization 凭据；当前没有这项身份。
- Windows 若要求可信发布者显示，需要另行取得并管理 Authenticode 证书。

## 安装语义与明确非目标

完整 updater 的预期语义是：

```text
检查 / 下载可以在当前 Switcher 进程中进行
        ↓
签名校验
        ↓
退出当前 Switcher，替换完整 Switcher bundle / installer
        ↓
重新启动 Switcher
```

这属于**冷更新**：下载可以在线完成，安装需要退出/重启。未来也不做以下“热更新”方案:

- Cavalry 正在运行时在线覆盖 `languages/*` 或修改 Cavalry.app。
- 在线替换 macOS `.dylib`、Windows generic translator 或 QPA delegate。
- 只更新 JSON、只更新 injector，或把不同版本的 JSON/native runtime 混装。
- 用扩大 allowlist、跳过重签名、绕过 Windows hash lock 或跳过事务恢复来实现“即时生效”。

若将来支持完整自更新，应把 JSON、native injector/QPA、Rust 与 renderer 作为同一版本的 Switcher bundle 一起更新；Cavalry 的翻译应用仍走现有显式、可恢复的冷事务。

## R3 — 跨版本实机验收

状态: Not started
在声称“一键更新”之前，至少需要保留两个版本的真实升级证据:

- macOS arm64 与 x64：旧 updater-enabled Switcher → 新版本，包含 `/Applications` 权限路径、重启和 App bundle 完整性。
- Windows x64 用户目录与 Program Files/UAC：旧版本 → 新版本，包含 NSIS `/UPDATE`、文件占用、权限拒绝与重启路径。
- 断网、manifest 不可用、签名错误、磁盘不足和安装中断时，旧版本仍可启动。
- 更新 Switcher 后，`state.json`、当前 Cavalry 语言、vendor QPA backup、marker 和恢复状态不被误删或混合写入。
- Windows 的上述 updater 行为当前**未测试**；不能从现有 NSIS 安装、同版本 `/UPDATE` 或 CI 结果推断跨版本 updater PASS。

## 状态与边界

- 本文记录已落地的 R0 行为边界、R1 代码、最终公钥/endpoint 与发布门基础；这不代表受保护私钥 Secrets、真实签名资产、跨版本实机证据或平台分发身份已经准备好。
- 本文不把 macOS Developer ID/notarization、Windows Authenticode 或 Tauri updater 签名写成当前 release 的事实。
- 本文不修改当前产品行为，不改变现有 release SOP，也不授权跳过现有 acceptance、provenance、attestation 或 seal 门禁。
- R1 发布闭包仍保持 fail-closed：没有与已嵌入公钥匹配的 GitHub 私钥 Secrets 和真实平台证据时，tag 不得创建；R0 不自动升级，也不替代这些前置工作。

## 下一步

R0 行为与 R1 代码/公钥/Secrets/发布闭包已完成；当前下一步是用受保护 Secrets 完成 macOS/Windows tag-shape 和跨版本实机验证。上述完成前不宣称自动更新或可信分发。
