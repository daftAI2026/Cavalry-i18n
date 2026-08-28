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
| E04 | 自动恢复基线 / Restore 产品语义收敛 | Done | 当前代码沿 Renderer → Rust apply → snapshot/platform transaction 已闭合：非英文 `apply_language_inner` 在任何 Cavalry 写入前调用 `extract_english_snapshot_or_throw`，只接受 clean vendor English 或匹配 immutable revision/provenance；renderer 不再暴露手动 `Refresh English`。UI 只有一个 `restoreButton`：macOS 传 `restore-official` 做完整官方英文还原，Windows 传 `en` 执行 English + vendor QPA/generic cleanup；内部 action 差异保留在平台事务层。当前 renderer/bridge 30/30、command contract 6/6 与 clean-official auto-baseline 单测均通过；正式 Cavalry manual smoke 另由 E10 追踪 | 保持 fail-closed：自动基线或官方还原证据不足时在任何写入前阻断，并用独立 AlertDialog 给出恢复路径；不恢复第二个用户按钮 |
| E05 | 工作隔离 | Done | 所有当前改动位于 `codex/update-ui-updater`；该分支已合并 Windows handoff，`main`/`origin/main` 仍停在 `f8d29bc` 且未被修改 | 后续签名 smoke 仍复用本 feature，不新建分支、不提前创建 tag |
| E06 | design.md 全面 UI 对齐 | Done | 当前实现以 `preview.html` 与项目 Design token 为基线：窗口为 `400×480`，内容宽 `360px`、四边 `20px`，标题栏由 16px 交通灯与上下各 12px 推导为 40px；标题结构 gap 为 8px，并补偿原生灯位与升级 SVG 内缩，使两段实体视觉间距同为约 12px。双动作轨道为 `170px + 20px + 170px`。安装位置最多显示 36 个 Unicode 字符：macOS 保留 `.app`，Windows 去掉末尾 `.exe`，超限时按层级保留根与末级安装文件夹，且不再以原生 `title` 制造第二套 Tooltip。复合关系由 Grid 管理，标题/徽章/按钮等一维关系由 Flex 管理；排印只用系统字体 16/14/13px 与 400/450/500，间距以 4px token 为默认节奏。主窗口禁止滚动，Select 与 Activity Log 各自在自身范围内滚动；主界面结果区为 Activity Log，必要确认/权限/危险操作使用独立 AlertDialog；旧 Recovery/Refresh/业务 divider 已删除 | UI 源码与静态合同已冻结；native/package 证据由 E10，Windows live 证据由 E11 单独负责，不把代码合同写成跨平台运行时 PASS |
| E07 | shadcn / Base UI 源码与状态机审计 | Done | `renderer/select-control.js` 保留 Base UI Select 必要的 open/active/selected 状态分层，以及 combobox/listbox/option ARIA、方向键/Home/End/Enter/Space/Escape、typeahead、外部点击和弹层列表自滚动；`renderer/operation-log.js/css` 逐层对照 Marker/MarkerIcon/MarkerContent、Item、ScrollArea、Spinner 与官方运行示例：Marker 只管行布局，运行态组合 Spinner + shimmer，完成后恢复检查安装/恢复文件/翻译事务/重启各自的 Phosphor 图标；真实推进只来自 verify/baseline/apply/restart 四阶段 Channel。`styles.css` 对照 AlertDialog；不引入 React/Radix/Base UI/Tailwind/CDN 或完整图标包，MIT 来源记录在 `renderer/THIRD_PARTY_NOTICES.md`。当前 renderer 静态合同 6/6、运行时合同 22/22 PASS | 继续保持组件投影与业务编排分离；不复制 Base UI 当前不需要的多选、portal、滚动箭头等能力，也不以 fake DOM 代替 macOS native 或 Windows live |
| E08 | 更新提示 R0 | Done | 生产默认隐藏；显式 localhost preview 才显示用户给定 SVG 的 20px 图形/24px 纯圆点击区与四语 tooltip；macOS 与 Windows 均以 8px Flex 结构 gap 紧随标题，实体圆环因盒内留白与标题约隔 12px，Windows 标题从左侧 12px 起；current native dev 的更新状态见 E10 | 只在 updater 返回签名验证后的可用版本时展示生产入口，不把 preview 宣称为真实更新 |
| E09 | Tauri Updater R1 | In progress | 已固定官方 updater plugin；renderer-facing Tauri command registry 与 Rust builder 当前为 9 条，About 的 `show_about` 只负责复用单一 Rust window owner，固定外链仍由既有 `open_project_link` 处理；Rust State 保存签名验证后的 pending Update，bridge 只暴露脱敏 DTO，renderer 完成生产隐藏、可用通知、确认与安装重启状态机；最终公钥/endpoint 已固定，E19 已以 GitHub Secrets 真实完成双架构签名与验签 | 代码、配置与签名边界已收口；仍需 E10/E11 真实打包与跨版本实机验证 |
| E10 | macOS 实机打包证据 | In progress | 旧 `333×420` 配置与 `334×421` 外框记录属于已作废的旧 native 证据，不代表当前候选。当前源码已用正确 Tauri 配置重新编译并拉起 native dev：逻辑配置 `400×480`，AX/CGWindow 外框 `400×481`（AppKit 允许 1px 差异）；`/tmp/cavalry-titlebar-visual-gap.png` 确认 16px 交通灯、20px 更新图形/24px 点击圆、20px 内容外边距和 Activity 错误状态。2x 实体边缘测量为绿灯—标题 24px、标题—升级圆环 25px，即逻辑约 12px，仅留抗锯齿半像素差。因此 current native dev PASS；current package/manual smoke 仍 pending。提交 `9766ee3` 的旧 `.app`/DMG（`460×404`）只属历史，不能宣称当前 packaged PASS | 重新生成当前源码的 macOS package，并以可验证 English 的 disposable Cavalry 输入运行 ignored manual smoke；current native dev、current package、manual smoke 三者继续分开陈述 |
| E11 | Windows 实机更新证据 | Pending | 已实现 Windows `decorations:false + shadow:true` 完整窗口 override、左侧 12px 标题与随后的更新入口、右侧 minimize/maximize-or-restore/close、固定 main-window bridge、最小 capability、四语可访问名称与最大化状态同步；当前 renderer/bridge 合同 30/30 PASS。macOS AppKit 交通灯仍由 `cfg(target_os = "macos")` 隔离，DWM 继续拥有外框；尚无 Windows 真机截图、Snap、scaling 或 updater 跨版本证据 | 在真实 Windows 验证 user-wide、Program Files/UAC、100/125/150% scaling、拖动/双击/缩放/Snap、高对比度、状态保留和 updater 失败回退；不得用 macOS 或 fake DOM 推断 PASS |
| E12 | Release 内容 | Pending | 已确认 release 内容应按现有发布协议从真实变更与验证边界生成，不手写虚假 PASS | 候选版本、资产和证据冻结后，按 release SOP 生成并人工审阅正文 |
| E13 | 调试/构建/预览产物清理 | Done | 已删除 `.playwright-mcp`、`output/playwright`、旧生成目录与日志；临时 updater 密钥由 trap 删除；曾执行 `cargo clean --manifest-path src-tauri/Cargo.toml` 删除 11.6 GiB/35,484 个 target 产物。本轮为 E06 实机裁决重新启动 Tauri dev，截图/CGEvent 脚本只写 `/tmp`，不进入仓库 | 保留 `qt_sdk`/`node_modules` 这两类有效开发依赖；E06 裁决结束后停止 dev，发布前重新执行工作树与受控产物检查 |
| E14 | 新 tag / GitHub Release | Blocked | 未创建、未推送新 tag；远端最新仍是 `p5` | 仅当 E06、E09 至 E13、E15 至 E17 按本轮最终范围完成且用户再次授权，才按 SOP 创建下一个 tag |
| E15 | Updater 独立签名密钥 | Done | 用户已生成最终独立密钥对；公钥文件 SHA-256 为 `95a22cd49c1efa14fec74c555a4eefa30daa90b8ae2570614fd0b8336ca82945`，已嵌入共享 Tauri 配置；本机私钥内容未读取，文件权限已从 `0644` 收紧为 `0600`；远程 `release-production` Environment 已创建，`gh secret list --env release-production` 确认两项 updater Secret 名称与更新时间存在；Environment 已启用 custom deployment policy，只允许 `cavalry-2.7.2-p*` tag | GitHub 不回显 Secret 值是正常安全边界；不再传输或重新生成该密钥，后续只通过真实签名 build 验证公私钥/口令匹配 |
| E16 | Updater 发布资产与 manifest 门 | In progress | 已扩展唯一命名与三平台 manifest 语义复验；schema v5 seal、provenance、SHA256SUMS/private-draft exact readback 绑定九项分发资产；tag workflow 已接入受保护 updater secrets、tag-only overlay、macOS archive/signature、Windows EXE signature 与 deterministic `latest.json`；E19 已使用真实 key 证明 macOS 双架构 archive/signature 闭环 | 仍需 E10/E11 跨版本实机验证和最终 tag-shape 发布门；之前不允许 tag |
| E17 | 首个 updater-enabled SemVer bootstrap | Pending | 当前内部版本为 `0.7.0`；远端 `p5` 没有 updater 公钥/命令，无法被新 manifest 反向唤起；公开 tag 的 `pN` 不能参与 updater 版本比较 | 发布边界冻结后用现有 `sync:version` 升到 `0.7.1`；该版本是未来更新链的人工 bootstrap，旧 `p5` 用户仍需手动安装一次 |
| E18 | Windows release handoff 合并 | Done | 远端唯一提交 `82385e1` 已通过 merge commit `e75a114` 进入当前 feature；`git merge-base --is-ancestor` PASS；`release-seals/TODO.md` 保留 source `9e293df` 债务并明确当前状态以本事件簿为准 | 远端 handoff 分支在当前 feature 推送/落地前保留；不用旧 source 证据代替新候选的实机验收 |
| E19 | 无 tag updater 签名验证 | Done | run `33164618098` 在 exact commit `4682323` 上整体 success；x64/arm64 两个受保护 macOS job 的 updater archive 签名和内嵌公钥验签均 PASS，Windows 普通包门亦 PASS；`release` 明确 skipped，无 tag/Release；临时 branch policy `58474196` 已删除，environment 仅余 `cavalry-2.7.2-p*` tag policy `58471815` | 后续发布只能由 tag policy 进入 Secrets；本 smoke 不替代 E10/E11 真实跨版本更新验收 |
| E20 | About 与固定项目链接 | In progress | 本机 `/Applications/Maipo.app` 仍证明 About 由自定义窗口控制器而非标准面板；代码已删除主窗口 About Dialog，新增独立本地 `about.html`，由固定 `about` label 的 Rust owner 懒创建并复用给 macOS 菜单与 Windows 标题栏入口；窗口使用原生装饰、固定尺寸、非 modal、不可 resize/maximize/minimize，页面复用现有 token，使用 64px 同源图标、真实版本、Cavalry-i18n/GitHub 项目行与 MIT License。bridge、command 与 privilege 三层仍只接受 repository/license 枚举，任意 renderer URL 的 facade 拒绝；本轮仅有静态/合同证据，未运行真实 About 窗口 | 运行允许的 Node/Rust 合同；随后另行拉起原生 About 做视觉复核，不能把静态合同冒充 macOS/Windows native PASS |
| E21 | 开发态/打包态图标分流 | In progress | 用户确认已安装版本 Dock 比例正确；进一步证明正式 `.app` 读取 `icon.icns`，当前裸 dev 进程读取孤立漂移的 `icon.png`。HEAD `icon.icns` 的 512px 表示与 2026-05-11 前透明 `icon.png` 解码像素完全相同；显大根因是后续仅把 runtime 图替成四角不透明的 1024px 文件，而非系统或正式包比例。已撤回对 icns/ico/全平台派生图标的重缩放，只恢复透明 512px dev runtime，并让 About 复用 tracked 128px 投影 | 重启而非仅刷新 dev 二进制，复核 Dock；正式安装包图标不因该开发态缺陷重建或改比例 |
| E22 | 单任务流文案与紧凑布局 | Done | 当前代码已完成 UX Writing/层级裁决：页面固定为 `Switch to` → 全宽 Select → 同行 `Apply & Restart` / `Restore` → Activity Log；旧 `Recovery` 标题、手动 `Refresh English`、`Restore English` 与 `Restore Official` 双入口已删除。必要原文件由 Apply 自动保存；Activity Log 只呈现准备、结果、风险和恢复路径，必要确认/权限/危险操作另用 AlertDialog，不暴露 Backup/snapshot/provenance。两个动作按钮同宽，窗口为 `400×480`、内容宽 `360px`，主窗口禁止横向/纵向滚动，Select 与 Activity Log 各自内部滚动；当前 native dev 已由 E10 的两张现场截图复核，current package/manual smoke 仍未完成 | 代码、静态布局与 current native dev 已完成；Windows live 和当前源码 packaged 证据仍分别留在 E11/E10，不以本项替代 |

## 当前验证记录

以下记录均针对当前工作树（不是 `9766ee3` 历史打包产物）：

```text
node --test tools/check_renderer_contract.js \
  tools/check_tauri_bridge_runtime.js                             30/30 PASS
cargo test --manifest-path src-tauri/Cargo.toml \
  --test command_contract                                             6/6 PASS
cargo test --manifest-path src-tauri/Cargo.toml \
  --test tauri_config_contract                                         8/8 PASS
cargo test --manifest-path src-tauri/Cargo.toml \
  --lib commands::tests::registers_nine_commands                   1/1 PASS
cargo test --manifest-path src-tauri/Cargo.toml \
  --lib detect::tests                                             5/5 PASS
cargo check --manifest-path src-tauri/Cargo.toml                      PASS
node --test tools/check_renderer_contract.js \
  tools/check_tauri_bridge_runtime.js \
  tools/check_tauri_build_sop.js                                  PASS
cargo test --manifest-path src-tauri/Cargo.toml \
  --test bridge_webview_contract                                     2/2 PASS
cargo test --manifest-path src-tauri/Cargo.toml                  242 PASS / 2 explicit live-artifact tests ignored
历史（已作废）Playwright 333×420 四语正式状态/三类 Dialog 溢出矩阵       不作为当前证据
历史（已作废）native Tauri dev AX / CGWindow                       334×421 outer; config 333×420
current native Tauri dev AX / CGWindow                             400×481 outer; config 400×480; `/tmp/cavalry-marker-v2.png`
current update Activity screenshot                                  `/tmp/cavalry-update-marker-v2.png`; Activity: Phosphor ArrowCircleUp + Update available
```

Focused、非发布证据：

- `detect` 的 5/5 focused tests 覆盖签名载荷及签名末端 `__LINKEDIT` extent 的安全归一化；无关 `__LINKEDIT` extent 仍参与身份比较。
- `/tmp` disposable Cavalry 副本的首次/重复 Apply 已成功，证明本次重复 Apply 根因修复路径；这不是正式 macOS manual smoke，也不是当前 packaged PASS。
- 当前工作树已有新的 macOS native dev 几何/截图证据，但没有新的 packaged PASS；`9766ee3` 的 `460×404` packaged 证据仍只作历史记录。
- Windows 仍只有静态/fake-DOM 证据，未作 Windows live 结论。

已知非失败警告:

- 默认 shell 的 Node `22.23.1` 会被依赖漏洞门拒绝；项目精确工具链为 Node `24.20.0` / npm `11.19.0`，本次 renderer/bridge 合同使用当前受支持工具链通过。

## 当前决策

1. 不在 `main` 上堆叠 UI/Updater 实验，统一留在当前 feature branch。
2. Updater 的 bridge/renderer 行为边界与第二轮 UI 生产基线已经冻结；后续仅响应 packaged 回归暴露的真实缺陷，发布供应链继续独立推进。
3. 可以读开源组件源码，但只移植必要语义、几何和状态行为，不引入组件库。
4. `Restore English` 与 `Restore official` 的后端事务不同，但用户意图已统一为单一 `Restore`：macOS 映射完整官方还原，Windows 映射 English + QPA/generic cleanup。
5. Tauri updater 签名、Apple Developer ID/notarization、Windows Authenticode 是三个独立信任层。
6. 当前不打 tag；R0 图标预览不是 R1 自动更新完成证据。
7. Updater 私钥是当前唯一需要用户介入的凭据决策；Apple Developer ID 与 Windows Authenticode 不替代它，当前实现也不把三者混为一谈。
8. Activity Log 负责主界面的过程与结果输出；必要确认、权限和危险操作才使用独立 AlertDialog。主窗口禁止横向和纵向滚动，Select 与 Activity Log 只在自身边界内滚动；底层异常详情不直接进入用户文案，溢出不能由窗口滚动兜底。

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
