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
| E06 | design.md 全面 UI 对齐 | Done | 第二轮以用户提供的 `preview.html` 为几何基线：安装 Item、2:1 语言主任务、可回流 Recovery、持久 Alert、36px 控件与 7/9px 圆角已落地；窗口四周 padding 独立为 20px，板块节奏 token 为 16px，复合轨道/列回流使用 Grid，一维内容流/标题关系使用 Flex；`renderer/tokens.css` 已成为颜色、排印、几何、阴影、状态与动效的唯一可调真相源，`styles.css`/`window-controls.css` 不定义私有变量且不保留可调的裸颜色或 `px/ms/em/deg`；按对象/操作/佐证三种阅读任务，主内容排印只保留 14/12/10px 三级字号与 400/600 两级字重，所有元数据文本统一为 10px/400，徽章仅靠色彩、边框与形状表达状态；安装名称与 Section 单行标题通过标准 text-box-trim 按字体度量收紧，Section 父级不再用 20px min-height 把裁紧字形重新居中，板块底边到下一标题字形盒由两个 16px token 组成真实 32px，标题到控件由独立 8px token 拥有；Alert 标题保留 16px 行盒拥有标题→正文间距，多行正文保留 17px 行距，旧 WebView 安全回退；删除全部业务 divider，默认窗口按新排印闭包收敛为 460×404；当前语言统一使用 Geist purple-subtle 类别色，安装信任/翻译状态只使用 green/blue/amber，Switcher transaction recovery 只进入阻断 Alert，不冒充 Cavalry 本体状态；字体回归平台系统栈，标题为 normal，并按 2× 截图像素重心相对原生控件上移 1px；安装 Item 的语言/安装双徽章只消费真实 Rust 状态并以四语合同验证；逐条审计 `app.js → tauri-bridge.js → Rust StatusPayload/ActionPayload` 后，Alert 从固定“操作状态”改为真实状态驱动的四语结果/风险/动作标题，正文只保留影响和恢复路径，`result.error`/`startupRecoveryError` 不再进入用户文案；原生交通灯按实机 AX 外框而非 AppKit 局部常量校正，红灯相对窗口目标 `(12,12,16,16)`，使 40px 标题区上下各 12px、内容 20px 左缘与红灯中心线同轴，第三盏灯到标题及标题到更新入口均复用 7px 灯间净距；macOS 27 外角与 Windows 自绘标题栏的最终口径见 `docs/audits/switcher-ui-final-build-2026-08-28.md` | UI 源码与生产内容基线已冻结；进入 E10 后只接受真实 packaged 回归发现的修复，不再以假文案扩大布局 |
| E07 | shadcn / Base UI 源码与状态机审计 | Done | 逐行复查 shadcn 当前 Base UI Select 的 Nova 源码；选择器按 open/active/selected 分层落成独立 `renderer/select-control.js`，包含 combobox/listbox/option ARIA、方向键/Home/End/Enter/Space/Escape/typeahead/外部点击；视觉复刻 10px Trigger/Popup、8px Item 圆角、4px viewport、28px Item、10/8px Trigger padding、6/32px Item padding、16px Lucide chevron/check 与 ring + shadow，项目只保留 36px 相邻控件等高及 12px Body 排印；Popup 由真实 layout box 推导 top，`460×404` 渲染实测 Trigger 与选中 Item 中心同为 y=190；不引入 React/Radix/Base UI/Tailwind/CDN；静态与 fake-DOM 合同 27/27 PASS，原生 WebView 已重新拉起 | 继续保持组件状态与业务状态分离；不复制 Base UI 的多选、portal、滚动箭头等当前不需要能力 |
| E08 | 更新提示 R0 | Done | 生产默认隐藏；显式 localhost preview 才显示用户给定 SVG 的 18px 图形/24px 纯圆点击区与四语 tooltip；图标盒四周留 3px，macOS 与 Windows 均让入口以交通灯同源的 7px 关系间距紧随标题，Windows 标题从左侧 12px 起；renderer/bridge/Select/About/Windows caption 合同 27/27 PASS | 只在 updater 返回签名验证后的可用版本时展示生产入口，不把 preview 宣称为真实更新 |
| E09 | Tauri Updater R1 | In progress | 已固定官方 updater plugin；Updater 令 command 表达到 8 个，随后 E20 固定 About 外链使当前总数为 9；Rust State 保存签名验证后的 pending Update，bridge 只暴露脱敏 DTO，renderer 完成生产隐藏、可用通知、确认与安装重启状态机；最终公钥/endpoint 已固定，E19 已以 GitHub Secrets 真实完成双架构签名与验签 | 代码、配置与签名边界已收口；仍需 E10/E11 真实打包与跨版本实机验证 |
| E10 | macOS 实机打包证据 | In progress | exact `9766ee3` clean release build 已生成当前 arm64 ad-hoc `.app`/DMG；packaged 5 PASS/1 architecture skip、DMG layout PASS、packaged UI regression 1/1 PASS。DMG SHA-256 为 `9e3e2115a68d16532d4a4bcab871764c91b1d43faa4c040b661acc300423738b`，应用签名为 `adhoc,runtime`，无 quarantine；当前 dev AX 为配置 `460×404`、外框 `460×405`，close 相对 `(12,12,16,16)`。真实 Cavalry manual smoke 仍因 `/Applications/Cavalry.app` marker=`zh-Hans` 被 English source guard 正确阻断 | 当前 UI/Updater 的 macOS 打包与窗口回归已闭合；仍需准备可验证 English 的 disposable Cavalry 输入再跑 ignored manual smoke，不能把阻断写成 PASS |
| E11 | Windows 实机更新证据 | Pending | 已实现 Windows `decorations:false + shadow:true` 完整窗口 override、左侧 12px 标题与随后的更新入口、右侧 minimize/maximize-or-restore/close、固定 main-window bridge、最小 capability、四语可访问名称与最大化状态同步；Node runtime/static 合同 27/27 PASS。macOS AppKit 交通灯仍由 `cfg(target_os = "macos")` 隔离，DWM 继续拥有外框；尚无 Windows 真机截图、Snap、scaling 或 updater 跨版本证据 | 在真实 Windows 验证 user-wide、Program Files/UAC、100/125/150% scaling、拖动/双击/缩放/Snap、高对比度、状态保留和 updater 失败回退；不得用 macOS 或 fake DOM 推断 PASS |
| E12 | Release 内容 | Pending | 已确认 release 内容应按现有发布协议从真实变更与验证边界生成，不手写虚假 PASS | 候选版本、资产和证据冻结后，按 release SOP 生成并人工审阅正文 |
| E13 | 调试/构建/预览产物清理 | Done | 已删除 `.playwright-mcp`、`output/playwright`、旧生成目录与日志；临时 updater 密钥由 trap 删除；曾执行 `cargo clean --manifest-path src-tauri/Cargo.toml` 删除 11.6 GiB/35,484 个 target 产物。本轮为 E06 实机裁决重新启动 Tauri dev，截图/CGEvent 脚本只写 `/tmp`，不进入仓库 | 保留 `qt_sdk`/`node_modules` 这两类有效开发依赖；E06 裁决结束后停止 dev，发布前重新执行工作树与受控产物检查 |
| E14 | 新 tag / GitHub Release | Blocked | 未创建、未推送新 tag；远端最新仍是 `p5` | 仅当 E06、E09 至 E13、E15 至 E17 按本轮最终范围完成且用户再次授权，才按 SOP 创建下一个 tag |
| E15 | Updater 独立签名密钥 | Done | 用户已生成最终独立密钥对；公钥文件 SHA-256 为 `95a22cd49c1efa14fec74c555a4eefa30daa90b8ae2570614fd0b8336ca82945`，已嵌入共享 Tauri 配置；本机私钥内容未读取，文件权限已从 `0644` 收紧为 `0600`；远程 `release-production` Environment 已创建，`gh secret list --env release-production` 确认两项 updater Secret 名称与更新时间存在；Environment 已启用 custom deployment policy，只允许 `cavalry-2.7.2-p*` tag | GitHub 不回显 Secret 值是正常安全边界；不再传输或重新生成该密钥，后续只通过真实签名 build 验证公私钥/口令匹配 |
| E16 | Updater 发布资产与 manifest 门 | In progress | 已扩展唯一命名与三平台 manifest 语义复验；schema v5 seal、provenance、SHA256SUMS/private-draft exact readback 绑定九项分发资产；tag workflow 已接入受保护 updater secrets、tag-only overlay、macOS archive/signature、Windows EXE signature 与 deterministic `latest.json`；E19 已使用真实 key 证明 macOS 双架构 archive/signature 闭环 | 仍需 E10/E11 跨版本实机验证和最终 tag-shape 发布门；之前不允许 tag |
| E17 | 首个 updater-enabled SemVer bootstrap | Pending | 当前内部版本为 `0.7.0`；远端 `p5` 没有 updater 公钥/命令，无法被新 manifest 反向唤起；公开 tag 的 `pN` 不能参与 updater 版本比较 | 发布边界冻结后用现有 `sync:version` 升到 `0.7.1`；该版本是未来更新链的人工 bootstrap，旧 `p5` 用户仍需手动安装一次 |
| E18 | Windows release handoff 合并 | Done | 远端唯一提交 `82385e1` 已通过 merge commit `e75a114` 进入当前 feature；`git merge-base --is-ancestor` PASS；`release-seals/TODO.md` 保留 source `9e293df` 债务并明确当前状态以本事件簿为准 | 远端 handoff 分支在当前 feature 推送/落地前保留；不用旧 source 证据代替新候选的实机验收 |
| E19 | 无 tag updater 签名验证 | Done | run `33164618098` 在 exact commit `4682323` 上整体 success；x64/arm64 两个受保护 macOS job 的 updater archive 签名和内嵌公钥验签均 PASS，Windows 普通包门亦 PASS；`release` 明确 skipped，无 tag/Release；临时 branch policy `58474196` 已删除，environment 仅余 `cavalry-2.7.2-p*` tag policy `58471815` | 后续发布只能由 tag policy 进入 Secrets；本 smoke 不替代 E10/E11 真实跨版本更新验收 |
| E20 | About 与固定项目链接 | Done | 本机 `/Applications/Maipo.app` 证明其 About 由 `WMAboutWindowController.nib`/`openAboutWindow:` 自定义而非标准面板；Switcher 把 macOS 默认应用菜单中的标准 About 替换为自绘 Dialog 入口，Windows 才显示标题栏信息按钮，避免双入口；2026-08-29 已从真实 macOS 应用菜单点击 `About Cavalry Language Switcher` 并打开同一 WebView Dialog；Dialog 显示 GitHub 标识、`plugin:app|version` 的真实版本、完整项目地址与 MIT License；bridge、command 与 privilege 三层只接受 repository/license 枚举，任意 renderer URL 的 facade 拒绝测试 1/1 PASS；Node 27/27、Rust 外链 2/2、command contract 6/6 PASS | 保持 About 为低频独立组件；Windows packaged 时复核默认浏览器跳转，不用 macOS 结果冒充 Windows live PASS |

## 当前验证记录

```text
node --check renderer/app.js                                      PASS
node --check renderer/select-control.js                           PASS
node --check renderer/about-dialog.js                             PASS
node --check renderer/ui-text.js                                  PASS
node --check renderer/window-controls.js                          PASS
node --test tools/check_renderer_contract.js \
  tools/check_tauri_bridge_runtime.js                             27/27 PASS (Select + About + Recovery/Alert/install badge + Windows caption)
cargo test --test command_contract                              6/6 PASS
cargo test commands::update::tests                              5/5 PASS
cargo test commands::tests::project_link_command_rejects_renderer_supplied_urls 1/1 PASS
cargo test --manifest-path src-tauri/Cargo.toml                 PASS (lib 137/137; integration 全部通过；updater artifact smoke 1 ignored)
mise x node@24.20.0 -- npm run test:contracts                    240/240 PASS
node --test tools/check_tauri_build_sop.js                       31/31 PASS
cargo test --test updater_signature_contract \
  embedded_updater_public_key_is_valid_minisign_material         1/1 PASS
cargo test --test tauri_config_contract \
  tauri_window_size_matches_frozen_contract                      1/1 PASS
native Tauri dev AX production                                  current config 460×404; AX outer frame 460×405; close (12,12,16,16); titlebar 40
native Tauri dev CGEvent title drag                              (+60,+40) PASS
native Tauri dev custom Select pointer-open screenshot           PASS
native Tauri dev production dynamic `Reinstall Cavalry` Alert    PASS at current 460×404 config
native Tauri dev language/install double badge                    PASS
native Tauri dev title optical center                             40.5px at 2× vs native controls 39.5px; integer -1pt correction
native Tauri dev update geometry                                  18px SVG / 24px circle / 7px after title; macOS + Windows shared
native Tauri dev section hierarchy                                Recovery four-locale copy; no business divider; block-to-next-title 32px whitespace; column Flex content
native Tauri dev macOS application-menu About                     PASS; custom Dialog opened from system application menu
exact `9766ee3` clean macOS arm64 release `.app` + DMG            BUILT (ad-hoc, not notarized; DMG sha256 `9e3e2115...423738b`)
packaged app contract                                             5 PASS / 1 architecture skip
DMG layout / packaged UI regression                              PASS / 1/1 PASS
packaged macOS AX                                                 window config 460×404; outer height tolerance 1pt PASS
Windows caption static + fake-DOM runtime                         27/27 PASS (not Windows live evidence)
cargo test --test tauri_config_contract                           8/8 PASS
cargo test english_ui_and_official_restore_are_distinct_macos_actions 1/1 PASS
git diff --check                                                  PASS
```

已知非失败警告:

- 默认 shell 的 Node `22.23.1` 会被依赖漏洞门拒绝；项目精确工具链为 Node `24.20.0` / npm `11.19.0`，已通过 `mise` 复跑完整合同。

## 当前决策

1. 不在 `main` 上堆叠 UI/Updater 实验，统一留在当前 feature branch。
2. Updater 的 bridge/renderer 行为边界与第二轮 UI 生产基线已经冻结；后续仅响应 packaged 回归暴露的真实缺陷，发布供应链继续独立推进。
3. 可以读开源组件源码，但只移植必要语义、几何和状态行为，不引入组件库。
4. `Restore English` 与 `Restore official` 是两个后端语义，视觉上可以分层，业务上不能合并。
5. Tauri updater 签名、Apple Developer ID/notarization、Windows Authenticode 是三个独立信任层。
6. 当前不打 tag；R0 图标预览不是 R1 自动更新完成证据。
7. Updater 私钥是当前唯一需要用户介入的凭据决策；Apple Developer ID 与 Windows Authenticode 不替代它，当前实现也不把三者混为一谈。
8. Alert 几何只以正式四语文案和生产状态组合为基线；标题必须说明具体结果、风险或下一动作，正文只补充影响和恢复路径；底层异常详情既不进入用户文案，也不作为预留固定高度的设计分母，极端溢出才由主内容区兜底滚动。

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
