<!--
[INPUT]: 依赖当前 feature branch 工作树、远端 refs、验证命令、UI/Updater 路线图与发布协议
[OUTPUT]: 对外提供本轮 Switcher UI、Updater、macOS 验证、release/tag 与清理事项的可追溯执行事件簿
[POS]: docs/roadmap 的临时执行控制面；只记录状态、证据与下一动作，不替代 SOP、审计报告或发布门禁
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Switcher 更新与发布执行事件簿

状态: Active
建立日期: 2026-08-28
工作分支: `codex/update-ui-updater`
基线提交: `f8d29bcca91e20df547ff75a088d2be9534b342a`

## 使用规则

- 每一项只允许 `Pending`、`In progress`、`Blocked`、`Done` 四种状态。
- `Done` 必须写明可复查的文件、命令或远端 ref；聊天结论不能单独作为证据。
- 本文不是发布 SOP。成熟且可重复的步骤才允许进入 `LOCAL_BUILD_SOP.md` 或 `docs/workflows/`。
- 未完成项全部关闭前，不创建、推送或发布新 tag。

## 事件总表

| ID | 事项 | 状态 | 已确认事实 / 证据 | 下一动作 / 完成条件 |
| --- | --- | --- | --- | --- |
| E01 | 远端与 tag 真相 | Done | `origin/main` 为 `f8d29bc`；当前 feature 已包含 handoff 与 updater 路径修复 `4682323`；本地/远端及 GitHub Release 仍只有 `cavalry-2.7.2-p1` 至 `p5`，无 `p6` | 打 tag 前重新执行 `git fetch --tags`、比较候选/`origin/main` 拓扑与远端 tags |
| E02 | zh-Hant glossary 修复 | Done | `CHANGELOG.md` 记录 `視埠` → `檢視區` 三处修复及 macOS onboarding oracle 同步 | 保持翻译合同通过，不为该纯文案修复重复跑全量构建 |
| E03 | `Viewport Quality: High` 边界 | Done | `CHANGELOG.md` 明确为 macOS-only `ACCEPTED-ENGLISH-BOUNDARY`，不是翻译 PASS；Windows 未测试 | 后续 Windows 实机验证前不得扩大为跨平台结论 |
| E04 | Restore English / Restore official 语义核查 | Done | Renderer 分别走 `showApplyConfirmation('en')` 与 `runApply('restore-official')`；Rust 精确测试 `english_ui_and_official_restore_are_distinct_macos_actions` 1/1 PASS | 保持两个 action 与确认文案分离，不能因视觉整理合并业务语义 |
| E05 | 工作隔离 | Done | 所有当前改动位于 `codex/update-ui-updater`；该分支已合并 Windows handoff，`main`/`origin/main` 仍停在 `f8d29bc` 且未被修改 | 后续签名 smoke 仍复用本 feature，不新建分支、不提前创建 tag |
| E06 | design.md 全面 UI 对齐 | In progress | 第二轮以用户提供的 `preview.html` 为几何基线：安装 Item、2:1 语言主任务、三列 Maintenance、持久 Alert、36px 控件与 7/9px 圆角已落地；Tauri 默认窗收敛为 460×440，Overlay 保留 macOS 系统原生交通灯；实机 dev 窗 AX 为 460×441（含 1px 窗框）且完整展示最长安全错误 | 等待用户对当前原生窗目视裁决；通过后再冻结并进入 E10 真实打包 |
| E07 | shadcn / Base UI 源码与状态机审计 | Done | 已读取 shadcn `683a5a9` 与 Base UI `772b7c1` 的 Button、Native Select、Tooltip、Dialog 源码/测试；吸收 ready fail-closed、tooltip 显式 open/closed、Escape/click 关闭和 dialog 单一 close owner；合同 22/22 PASS | 不引入 React、Radix、Base UI、Tailwind 或运行时组件库；后续状态扩展继续保持原生语义 |
| E08 | 更新提示 R0 | Done | 生产默认隐藏；显式 localhost preview 才显示用户给定 SVG 的 16px 图形/32px 绿色点击区与四语 tooltip；renderer/bridge 合同 22/22 PASS | 只在 updater 返回签名验证后的可用版本时展示生产入口，不把 preview 宣称为真实更新 |
| E09 | Tauri Updater R1 | In progress | 已固定官方 updater plugin，命令扩展为 8 个；Rust State 保存签名验证后的 pending Update，bridge 只暴露脱敏 DTO，renderer 完成生产隐藏、可用通知、确认与安装重启状态机；最终公钥/endpoint 已固定，E19 已以 GitHub Secrets 真实完成双架构签名与验签 | 代码、配置与签名边界已收口；仍需 E10/E11 真实打包与跨版本实机验证 |
| E10 | macOS 实机打包证据 | Pending | 本轮 UI 修改后只完成原生 dev window 与 Rust/config/renderer 合同；不能沿用旧包证明当前工作树 | UI 与 Updater 范围冻结后按 `LOCAL_BUILD_SOP.md` 重新产包和验证；没有新证据不得声称当前候选包通过 |
| E11 | Windows 实机更新证据 | Pending | 当前没有 Tauri updater 跨版本 Windows 实机证据；现有 NSIS 同版本 `/UPDATE` 不能替代 | R1 完成后在真实 Windows 验证 user-wide、Program Files/UAC、状态保留和失败回退 |
| E12 | Release 内容 | Pending | 已确认 release 内容应按现有发布协议从真实变更与验证边界生成，不手写虚假 PASS | 候选版本、资产和证据冻结后，按 release SOP 生成并人工审阅正文 |
| E13 | 调试/构建/预览产物清理 | Done | 已删除 `.playwright-mcp`、`output/playwright`，停止 8765/8766 与原生 Tauri dev；临时 updater 密钥由 trap 删除；最终执行 `cargo clean --manifest-path src-tauri/Cargo.toml` 删除 11.6 GiB/35,484 个 target 产物，并按显式 allowlist 删除 `src-tauri/gen`、`aqtinstall.log` 与六个 `.DS_Store` | 保留 `qt_sdk`/`node_modules` 这两类有效开发依赖；后续新构建若产生临时文件，发布前重复同一 allowlist 检查 |
| E14 | 新 tag / GitHub Release | Blocked | 未创建、未推送新 tag；远端最新仍是 `p5` | 仅当 E06、E09 至 E13、E15 至 E17 按本轮最终范围完成且用户再次授权，才按 SOP 创建下一个 tag |
| E15 | Updater 独立签名密钥 | Done | 用户已生成最终独立密钥对；公钥文件 SHA-256 为 `95a22cd49c1efa14fec74c555a4eefa30daa90b8ae2570614fd0b8336ca82945`，已嵌入共享 Tauri 配置；本机私钥内容未读取，文件权限已从 `0644` 收紧为 `0600`；远程 `release-production` Environment 已创建，`gh secret list --env release-production` 确认两项 updater Secret 名称与更新时间存在；Environment 已启用 custom deployment policy，只允许 `cavalry-2.7.2-p*` tag | GitHub 不回显 Secret 值是正常安全边界；不再传输或重新生成该密钥，后续只通过真实签名 build 验证公私钥/口令匹配 |
| E16 | Updater 发布资产与 manifest 门 | In progress | 已扩展唯一命名与三平台 manifest 语义复验；schema v5 seal、provenance、SHA256SUMS/private-draft exact readback 绑定九项分发资产；tag workflow 已接入受保护 updater secrets、tag-only overlay、macOS archive/signature、Windows EXE signature 与 deterministic `latest.json`；E19 已使用真实 key 证明 macOS 双架构 archive/signature 闭环 | 仍需 E10/E11 跨版本实机验证和最终 tag-shape 发布门；之前不允许 tag |
| E17 | 首个 updater-enabled SemVer bootstrap | Pending | 当前内部版本为 `0.7.0`；远端 `p5` 没有 updater 公钥/命令，无法被新 manifest 反向唤起；公开 tag 的 `pN` 不能参与 updater 版本比较 | 发布边界冻结后用现有 `sync:version` 升到 `0.7.1`；该版本是未来更新链的人工 bootstrap，旧 `p5` 用户仍需手动安装一次 |
| E18 | Windows release handoff 合并 | Done | 远端唯一提交 `82385e1` 已通过 merge commit `e75a114` 进入当前 feature；`git merge-base --is-ancestor` PASS；`release-seals/TODO.md` 保留 source `9e293df` 债务并明确当前状态以本事件簿为准 | 远端 handoff 分支在当前 feature 推送/落地前保留；不用旧 source 证据代替新候选的实机验收 |
| E19 | 无 tag updater 签名验证 | Done | run `33164618098` 在 exact commit `4682323` 上整体 success；x64/arm64 两个受保护 macOS job 的 updater archive 签名和内嵌公钥验签均 PASS，Windows 普通包门亦 PASS；`release` 明确 skipped，无 tag/Release；临时 branch policy `58474196` 已删除，environment 仅余 `cavalry-2.7.2-p*` tag policy `58471815` | 后续发布只能由 tag policy 进入 Secrets；本 smoke 不替代 E10/E11 真实跨版本更新验收 |

## 当前验证记录

```text
node --check renderer/app.js                                      PASS
node --check renderer/ui-text.js                                 PASS
node --test tools/check_renderer_contract.js \
  tools/check_tauri_bridge_runtime.js                            23/23 PASS (preview-based UI v2)
cargo test --test command_contract                              5/5 PASS
cargo test commands::update::tests                              5/5 PASS
cargo test --manifest-path src-tauri/Cargo.toml                 PASS (lib 134/134; integration 全部通过；manual macOS smoke 1 ignored)
mise x node@24.20.0 -- npm run test:contracts                   236/236 PASS
node --test tools/check_tauri_build_sop.js                       31/31 PASS
cargo test --test updater_signature_contract \
  embedded_updater_public_key_is_valid_minisign_material         1/1 PASS
cargo test --test tauri_config_contract \
  tauri_window_size_matches_frozen_contract                      1/1 PASS
native Tauri dev AX window / screenshot                          460x441, native traffic lights PASS
cargo test --test tauri_config_contract                           7/7 PASS
cargo test english_ui_and_official_restore_are_distinct_macos_actions 1/1 PASS
git diff --check                                                  PASS
```

已知非失败警告:

- 默认 shell 的 Node `22.23.1` 会被依赖漏洞门拒绝；项目精确工具链为 Node `24.20.0` / npm `11.19.0`，已通过 `mise` 复跑完整合同。

## 当前决策

1. 不在 `main` 上堆叠 UI/Updater 实验，统一留在当前 feature branch。
2. Updater 的 bridge/renderer 行为边界保持稳定，但视觉稿不冻结；第二轮 UI 精修与发布供应链分开推进，避免互相污染。
3. 可以读开源组件源码，但只移植必要语义、几何和状态行为，不引入组件库。
4. `Restore English` 与 `Restore official` 是两个后端语义，视觉上可以分层，业务上不能合并。
5. Tauri updater 签名、Apple Developer ID/notarization、Windows Authenticode 是三个独立信任层。
6. 当前不打 tag；R0 图标预览不是 R1 自动更新完成证据。
7. Updater 私钥是当前唯一需要用户介入的凭据决策；Apple Developer ID 与 Windows Authenticode 不替代它，当前实现也不把三者混为一谈。

## Updater 密钥交接

首个 updater-enabled 版本尚未发布，因此现在可以废弃任何测试密钥，并重新生成最终密钥对：

```bash
mise x node@24.20.0 -- npm run tauri -- signer generate \
  -w "$HOME/.tauri/cavalry-i18n-updater-v1.key"
```

- 使用全新文件名比 `--force` 覆盖旧文件更容易审计；CLI 会交互式要求设置口令。
- GitHub `release-production` Environment Secret `TAURI_SIGNING_PRIVATE_KEY` 保存私钥**内容**，`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 保存对应口令。
- 生成出的公钥不是 secret；已写入 `src-tauri/tauri.conf.json`，并由合同测试与 `release.config.json` endpoint 交叉固定。
- 首个带该公钥的版本发布后，必须长期备份同一私钥与口令。擅自轮换或遗失会让已安装客户端拒绝后续更新；真正轮换需要独立兼容迁移方案。
