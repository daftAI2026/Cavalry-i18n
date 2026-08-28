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
| E04 | 自动恢复基线 / Restore 产品语义收敛 | Done | 当前代码沿 Renderer → Rust apply → snapshot/platform transaction 已闭合：非英文 `apply_language_inner` 在任何 Cavalry 写入前调用 `extract_english_snapshot_or_throw`，只接受 clean vendor English 或匹配 immutable revision/provenance；renderer 不再暴露手动 `Refresh English`。UI 只有一个 `restoreButton`：macOS 传 `restore-official` 做完整官方英文还原，Windows 传 `en` 执行 English + vendor QPA/generic cleanup；内部 action 差异保留在平台事务层。当前 renderer/bridge 32/32、command contract 6/6 与 clean-official auto-baseline 单测均通过；正式 Cavalry manual smoke 另由 E10 追踪 | 保持 fail-closed：自动基线或官方还原证据不足时在任何写入前阻断，并在常驻任务事件视窗给出恢复路径；只有需要用户立即选择时才使用 AlertDialog，不恢复第二个用户按钮 |
| E05 | 工作隔离 | Done | 所有当前改动位于 `codex/update-ui-updater`；该分支已合并 Windows handoff，`main`/`origin/main` 仍停在 `f8d29bc` 且未被修改 | 后续签名 smoke 仍复用本 feature，不新建分支、不提前创建 tag |
| E06 | design.md 全面 UI 对齐 | Done | 当前实现以 `preview.html` 与项目 Design token 为基线：窗口 `400×480`、内容宽 `360px`、四边 `20px`、40px 标题栏与 16/14/13px 系统字体角色保持不变；主界面收敛为安装摘要 → Select → 双动作 → 有界任务事件视窗。Grid 管复合轨道，Flex 管一维关系；主窗口禁止滚动，Select 与事件视窗各自滚动；持久阻塞留在视窗，确认/权限/风险进入 AlertDialog，不叠加 toast。 | UI 源码与静态合同已冻结；native/package 证据由 E10，Windows live 证据由 E11 单独负责，不把代码合同写成跨平台运行时 PASS |
| E07 | shadcn / Base UI 源码与状态机审计 | Done | `select-control.js` 保留 Base UI Select 的 open/active/selected 与键盘/ARIA 状态；任务事件实现对照 shadcn 官方 Marker、shimmer、scroll-fade 源码及上游提交 `683a5a9b370acdb7785a0529434e6a3b8c7e0441`：idle separator、任务 separator、Spinner + shimmer、事件专属 Phosphor 终态图标、短记录贴底、溢出向上推进与内部 scroll-fade。首项 `margin-top:auto` 避免 `flex-end` 造成顶部事件不可达；不引入 React/Base UI/Tailwind/CDN 或完整图标包。 | 保持组件投影与业务编排分离；不复制当前不需要的多选、portal 或任意日志能力，也不以 fake DOM 代替 native/live 证据 |
| E08 | 更新提示 R0 | Done | 生产默认隐藏；显式 localhost preview 才显示用户给定 SVG 的 20px 图形/24px 纯圆点击区与四语 tooltip；正式入口只在官方 updater 检查返回可用版本后显示，签名验证仍发生在后续下载事务中，不能把“发现版本”写成“签名已验证”。 | current native dev 更新入口几何沿用既有证据；真实安装进度与签名失败路径由 E09/E10/E11 验证 |
| E09 | Tauri Updater R1 | In progress | 官方 updater plugin、最终公钥/endpoint、9 条 command registry 与 Rust-only pending Update 已接入。`install_update` 不接收 renderer 的 URL/签名/版本，只消费 Rust State，并通过 camelCase Channel 发送 `downloading`、`installing`、`restarting`；下载结束回调先于签名验证，因此第二阶段文案为“正在验证并安装”，不虚构 verified。bridge 丢弃未知阶段与 URL/签名/路径/raw，`update-progress.js` 将真实事件投影为用户任务；Channel 失败不改变更新事务。Rust updater focused 8/8 与 renderer/bridge 32/32 PASS。 | 代码边界已收口；仍需 E10/E11 真实打包、签名失败及跨版本更新验证，未完成前不宣称完整 updater PASS |
| E10 | macOS 实机打包证据 | In progress | 旧 `333×420` 与旧 package 记录均已作废。当前源码于 2026-08-29 重新编译并拉起 native dev，截图 `/tmp/cavalry-task-viewport-current.png` 显示 `400×480` 主窗、20px 内容边距、无旧 Alert 卡片、持久 `Reinstall Cavalry` 事件贴底且正文在内容轨道内换行；这证明当前 native dev 的 idle/blocker 投影，不证明滚动序列、current package 或 manual smoke。 | 先完成当前任务事件序列的 native 视觉复核，再重新生成当前源码 package，并以 disposable Cavalry 输入运行 ignored manual smoke；三类证据继续分开陈述 |
| E11 | Windows 实机更新证据 | Pending | 已实现 Windows `decorations:false + shadow:true` 完整窗口 override、左侧 12px 标题与随后的更新入口、右侧 minimize/maximize-or-restore/close、固定 main-window bridge、最小 capability、四语可访问名称与最大化状态同步；当前 renderer/bridge 合同 32/32 PASS。macOS AppKit 交通灯仍由 `cfg(target_os = "macos")` 隔离，DWM 继续拥有外框；尚无 Windows 真机截图、Snap、scaling 或 updater 跨版本证据 | 在真实 Windows 验证 user-wide、Program Files/UAC、100/125/150% scaling、拖动/双击/缩放/Snap、高对比度、状态保留和 updater 失败回退；不得用 macOS 或 fake DOM 推断 PASS |
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
| E22 | 单任务流文案与紧凑布局 | Done | 页面固定为 `Switch to` → 全宽 Select → 同行 `Apply & Restart` / `Restore` → 任务事件视窗；旧 Recovery/Refresh/双 Restore 与可见 `Action/Status/Log` 标题均删除。Apply 自动建立必要恢复基线；renderer 只把真实后端边界压缩为用户可理解的“检查安装、准备恢复文件、应用/恢复、重启”及“下载、验证并安装、重启”，不暴露 snapshot/provenance/内部函数。持久阻塞不使用会消失的 toast，必须立即选择的确认/权限/危险操作才使用 AlertDialog。 | 维持 UX Writing 的结果、影响、下一步顺序；后续只按真实 backend event 扩展，不把调试日志直接暴露给用户 |

## 当前验证记录

以下记录均针对当前工作树（不是 `9766ee3` 历史打包产物）：

```text
mise x node@24.20.0 -- npm run test:contracts                    245/245 PASS
node --test tools/check_renderer_contract.js \
  tools/check_tauri_bridge_runtime.js                              32/32 PASS
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
cargo test --manifest-path src-tauri/Cargo.toml                  245 PASS / 2 explicit live-artifact tests ignored
历史（已作废）Playwright 333×420 四语正式状态/三类 Dialog 溢出矩阵       不作为当前证据
历史（已作废）native Tauri dev AX / CGWindow                       334×421 outer; config 333×420
current native Tauri dev AX / CGWindow                             400×481 outer; config 400×480; `/tmp/cavalry-marker-v2.png`
current task viewport blocker screenshot                            `/tmp/cavalry-task-viewport-current.png`; native dev, persistent event at bottom
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
8. 任务事件视窗负责当前动作的过程、持久阻塞与结果输出；idle 只有 separator，运行时从底部累积，溢出后旧事件向上推进并保留内部滚动/scroll-fade。toast 不重复常驻事实；必要确认、权限和危险操作才使用 AlertDialog。底层异常详情不直接进入用户文案。

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
