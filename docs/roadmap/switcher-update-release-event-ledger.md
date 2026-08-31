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
| E04 | 自动恢复基线 / Restore 产品语义收敛 | Done | Renderer → Rust apply → snapshot/platform transaction 已闭合：首次 Switch 自动建立可信基线，UI 只保留 `Restore English`。macOS 有完整 vendor baseline 时映射 `restore-official`；旧 Switcher 安装只有在 p1-p5 精确 wrapper、三组已发布 injector code identity、匹配 marker、完整 Keychain postimage、历史 state/revision 与 38 份 English overlay 全部成立时分类为 `managedLegacy`，继续四语切换并用普通 `en` 恢复受管英文，不伪称官方恢复；Windows `en` 继续恢复 vendor QPA 并清理 owned runtime。2.7.1/2.7.3/未知版本分别保持只读，且新版本不要求降级。renderer 40/40、Rust lib 151/151、command contract 6/6 focused PASS；正式 native/package 证据由 E10/E11 追踪 | 保持 fail-closed：未知修改仍阻断，只有完整 vendor baseline 才能承诺官方恢复；不恢复第二个用户按钮，不让 2.7.3 用户为 Switcher 降级 |
| E05 | 工作隔离 | Done | 所有当前改动位于 `codex/update-ui-updater`；该分支已合并 Windows handoff，`main`/`origin/main` 仍停在 `f8d29bc` 且未被修改 | 后续签名 smoke 仍复用本 feature，不新建分支、不提前创建 tag |
| E06 | design.md 全面 UI 对齐 | Done | 当前实现以项目 Design token 为基线：窗口 `400×484`、内容宽 `360px`、四边 `20px`、40px 标题栏与 16/14/13px 系统字体角色保持不变；主界面收敛为安装摘要 → Select → 双动作 → 176px 有界任务事件视窗。Grid 管复合轨道，Flex 管一维关系；事件区保留中性外框与统一 panel padding，scroll-fade 只作用于框内滚动层，隐藏权限按钮不再留下 8px Grid 伪间距。语言徽章恒表示 Cavalry 当前语言；第二徽章只在 macOS 官方运行时验证通过时显示 Official；两种彩色填充 Badge 均改用透明边界，文字使用 13px/450 的不透明语义色，不把 `modifiedOrUnverified` 或 translated 机器状态伪装成用户标签。主窗口禁止滚动，Select 与事件视窗各自滚动。旧 Downloads 工作台曾复制 renderer/Badge/Toast/Marker 并锁定旧提交，现已由 localhost UI Review 替代：主界面与 About 每次请求读取真实 renderer，只用 fixture bridge 解耦状态、事件和时序；反馈文案、语义图标与徽章总览也动态读取同一生产真相源。 | UI 源码与静态合同已冻结；native/package 证据由 E10，Windows live 证据由 E11 单独负责，不把代码合同写成跨平台运行时 PASS |
| E07 | shadcn / Base UI 源码与状态机审计 | Done | `button.css` 从锁定 shadcn Base Button 源码投影 inline-flex、disabled、SVG、ghost 与 icon size，共享给十一枚普通静态动作和动态 Toast 关闭；Select Trigger 因拥有 combobox 状态机明确隔离。Windows 三枚 caption 只消费 `ghost + icon-sm` 视觉，32px 目标/4px 间距/16px Phosphor Minus、Square、Copy、X，不改变 Tauri 系统窗口行为。`select-control.js` 保留 Base UI Select 的 placeholder/open/active/selected 与键盘/ARIA 状态；初始占位不等于 selection，用户明确 commit 前 Switch 禁用。任务事件实现对照 shadcn 官方 Marker、shimmer、scroll-fade 提交 `683a5a9b370acdb7785a0529434e6a3b8c7e0441` 与 Phosphor Regular 提交 `2b75f3ad12b420c9504ef05df8d2564a28f8500e`：Marker 使用 16px 单色语义图标、8px 间距、14/20 常规中性色文字，运行态 SpinnerGap + shimmer，终态原位切换语义图标。Toast 另锁定 shadcn 同提交与 `@base-ui/react 1.6.0`：5 秒、3 条、hover/focus/window blur 暂停剩余时间、F6/Escape/live region，并保留 16px 组件 inset 与 20px 主网格错层。 | 保持组件投影与业务编排分离；不复制当前不需要的多选、portal 或任意日志能力，也不以 fake DOM 代替 native/live 证据 |
| E08 | 更新提示 R0 | Done | 生产默认隐藏；显式 localhost preview 才显示用户给定 SVG 的 20px 图形/24px 纯圆点击区与四语 tooltip；正式入口只在官方 updater 检查返回可用版本后显示，签名验证仍发生在后续下载事务中，不能把“发现版本”写成“签名已验证”。 | current native dev 更新入口几何沿用既有证据；真实安装进度与签名失败路径由 E09/E10/E11 验证 |
| E09 | Tauri Updater R1 | In progress | 官方 updater plugin、最终公钥/endpoint、9 条 command registry 与 Rust-only pending Update 已接入。`install_update` 不接收 renderer 的 URL/签名/版本，只消费 Rust State，并通过 camelCase Channel 发送 `downloading`、`installing`、`restarting`；下载结束回调先于签名验证，因此第二阶段文案为“正在验证并安装”，不虚构 verified。bridge 丢弃未知阶段与 URL/签名/路径/raw，`update-progress.js` 将真实事件投影为用户任务；Channel 失败不改变更新事务。Rust updater focused 8/8、renderer/bridge 40/40 与 Node 24.20 全量 contracts 256/256 PASS。 | 代码边界已收口；仍需 E10/E11 真实打包、签名失败及跨版本更新验证，未完成前不宣称完整 updater PASS |
| E10 | macOS 实机打包证据 | In progress | 旧 `333×420`、旧 package 与误报 `Reinstall Cavalry` 的截图均已作废。当前生产候选已从空 bundle 目录按 SOP 以显式 ad-hoc identity 重建 `.app`/DMG；packaged renderer/injector、四语 App Management purpose resources、`CodeResources`、strict codesign、DMG 内与安装态 seal 全部回读通过。WindowServer 只读证据确认该精确 bundle 的 PID 与 `400×485` 外框，生产首屏显示 2.7.2/简体中文、空 Select、`Switch`/`Restore English` 与 176px Activity；未点击 Switch/Restore，不把静态 bundle 证据升级为写事务或权限链 smoke。 | 仍需以 disposable Cavalry 输入触发真实 Switch/Restore Channel，复核逐行节奏、错误抢占、触底推进、App Management handoff 与受管英文事务；随后运行 ignored manual smoke |
| E11 | Windows 实机更新证据 | Pending | 已实现 Windows `decorations:false + shadow:true` 完整窗口 override、左侧 12px 标题与随后的更新入口、右侧 minimize/maximize-or-restore/close、固定 main-window bridge、最小 capability、四语可访问名称与最大化状态同步；三枚 caption 已切到共享 Button 的 32px ghost icon-sm、4px 间距与 16px Phosphor 图形，系统 API 行为未改，当前 renderer/bridge 合同 40/40 PASS。macOS AppKit 交通灯仍由 `cfg(target_os = "macos")` 隔离，DWM 继续拥有外框；尚无 Windows 真机截图、Snap、scaling 或 updater 跨版本证据 | 在真实 Windows 验证 user-wide、Program Files/UAC、100/125/150% scaling、拖动/双击/缩放/Snap、高对比度、状态保留和 updater 失败回退；不得用 macOS 或 fake DOM 推断 PASS |
| E12 | Release 内容 | Pending | 已确认 release 内容应按现有发布协议从真实变更与验证边界生成，不手写虚假 PASS | 候选版本、资产和证据冻结后，按 release SOP 生成并人工审阅正文 |
| E13 | 调试/构建/预览产物清理 | Done | 已删除 `.playwright-mcp`、`output/playwright`、旧生成目录与日志；临时 updater 密钥由 trap 删除；曾执行 `cargo clean --manifest-path src-tauri/Cargo.toml` 删除 11.6 GiB/35,484 个 target 产物。2026-08-31 再次按项目边界删除 1.2 GiB 过期 `src-tauri/target/release`（含旧 `0.7.0` DMG）、`src-tauri/gen`、Python/Playwright 审查缓存；保留当前 Tauri dev 正在消费的 4.4 GiB `target/debug`，截图只写 `/tmp`。 | 保留 `qt_sdk`/`node_modules` 与运行中的 debug 增量缓存；UI/native 裁决结束并停止 dev 后再决定是否清理 debug，发布前重新执行工作树与受控产物检查 |
| E14 | 新 tag / GitHub Release | Blocked | 未创建、未推送新 tag；远端最新仍是 `p5` | 仅当 E06、E09 至 E13、E15 至 E17 按本轮最终范围完成且用户再次授权，才按 SOP 创建下一个 tag |
| E15 | Updater 独立签名密钥 | Done | 用户已生成最终独立密钥对；公钥文件 SHA-256 为 `95a22cd49c1efa14fec74c555a4eefa30daa90b8ae2570614fd0b8336ca82945`，已嵌入共享 Tauri 配置；本机私钥内容未读取，文件权限已从 `0644` 收紧为 `0600`；远程 `release-production` Environment 已创建，`gh secret list --env release-production` 确认两项 updater Secret 名称与更新时间存在；Environment 已启用 custom deployment policy，只允许 `cavalry-2.7.2-p*` tag | GitHub 不回显 Secret 值是正常安全边界；不再传输或重新生成该密钥，后续只通过真实签名 build 验证公私钥/口令匹配 |
| E16 | Updater 发布资产与 manifest 门 | In progress | 已扩展唯一命名与三平台 manifest 语义复验；schema v5 seal、provenance、SHA256SUMS/private-draft exact readback 绑定九项分发资产；tag workflow 已接入受保护 updater secrets、tag-only overlay、macOS archive/signature、Windows EXE signature 与 deterministic `latest.json`；E19 已使用真实 key 证明 macOS 双架构 archive/signature 闭环 | 仍需 E10/E11 跨版本实机验证和最终 tag-shape 发布门；之前不允许 tag |
| E17 | 首个 updater-enabled SemVer bootstrap | Pending | 当前内部版本为 `0.7.0`；远端 `p5` 没有 updater 公钥/命令，无法被新 manifest 反向唤起；公开 tag 的 `pN` 不能参与 updater 版本比较 | 发布边界冻结后用现有 `sync:version` 升到 `0.7.1`；该版本是未来更新链的人工 bootstrap，旧 `p5` 用户仍需手动安装一次 |
| E18 | Windows release handoff 合并 | Done | 远端唯一提交 `82385e1` 已通过 merge commit `e75a114` 进入当前 feature；`git merge-base --is-ancestor` PASS；`release-seals/TODO.md` 保留 source `9e293df` 债务并明确当前状态以本事件簿为准 | 远端 handoff 分支在当前 feature 推送/落地前保留；不用旧 source 证据代替新候选的实机验收 |
| E19 | 无 tag updater 签名验证 | Done | run `33164618098` 在 exact commit `4682323` 上整体 success；x64/arm64 两个受保护 macOS job 的 updater archive 签名和内嵌公钥验签均 PASS，Windows 普通包门亦 PASS；`release` 明确 skipped，无 tag/Release；临时 branch policy `58474196` 已删除，environment 仅余 `cavalry-2.7.2-p*` tag policy `58471815` | 后续发布只能由 tag policy 进入 Secrets；本 smoke 不替代 E10/E11 真实跨版本更新验收 |
| E20 | About 与固定项目链接 | Done | 本机 `/Applications/Maipo.app` 证明 About 由自定义窗口控制器而非标准面板；实现已删除主窗口 About Dialog，改由固定 `about` label 的 Rust owner 懒创建并复用独立本地 `about.html`。macOS 不再维护第二套原生标题栏：About 与主窗口共同消费 `styles.css`/`tokens.css` 的 40px Overlay 标题栏，并由 `window_chrome.rs` 统一持有 AppKit 交通灯偏移、resize/scale 重放和跨窗口 Rust 高度合同；About 总尺寸固定 `320×308`，其中内容区保留已审核的 268px。Windows 继续使用原生 caption，内容高度仍为 268px，待真机验证后再决定是否共享无系统 caption 变体。页面展示由 64px 基准加一个 4px 档得到的 68px 同源项目图标、真实 `0.7.0` 版本、带 GitHub 图标的 `Cavalry-i18n` 项目行与 MIT License；内容栈垂直居中后，上下各为 20px token 加均分的 1px 像素余数。bridge、command 与 privilege 三层只接受 repository/license 枚举，任意 renderer URL 的 facade 拒绝；About/默认浏览器外链失败使用本窗口 5 秒 error Toast。当前 macOS native 已从真实应用菜单拉起并截图 `/tmp/cavalry-about-shared-titlebar.png`，实测外框 `320×308`，共享排印、交通灯位置、内容节奏、关闭行为及无蓝色 focus ring 均通过；未点击外链，不把该证据扩大为 Windows native PASS。 | 保持固定枚举外链、共享 Chrome 与独立窗口边界；Windows 标题栏入口和系统浏览器跳转仍随 E11 在 Windows 真机复核 |
| E21 | 开发态/打包态图标分流 | Done | 用户确认已安装版本 Dock 比例正确；进一步证明正式 `.app` 读取 `icon.icns`，裸 dev 进程读取曾孤立漂移的 `icon.png`。HEAD `icon.icns` 的 512px 表示与 2026-05-11 前透明 `icon.png` 解码像素完全相同；显大根因是后续仅把 runtime 图替成四角不透明的 1024px 文件，而非系统或正式包比例。已撤回对 icns/ico/全平台派生图标的重缩放，只恢复透明 512px dev runtime，并让 About 复用 tracked 128px 投影；本轮已重启真实 dev 二进制，Dock 截图 `/tmp/cavalry-dev-dock.png` 显示图标视觉占位与相邻应用一致，About native 同源图标亦通过。 | 保持 dev runtime 与正式 bundle 图标各自消费既有正确资产；不为已正确的正式安装包重建或二次缩放图标 |
| E22 | 单任务流文案与紧凑布局 | Done | 页面固定为 `Switch to` → 带本地化占位的全宽 Select → 同行 `Switch` / `Restore English` → 任务事件视窗；四语主动作收敛为 `Switch / 切换 / 切換 / 切り替える` 与单一 `Restore English / 恢复英文 / 還原英文 / 英語に戻す`。Select 不再暗中预选第一种语言，用户明确选择目标后才启用 Switch。Switch 点击后无确认直达现有 `apply_language` 事务：Cavalry 运行中由 typed preflight 在任何写入前返回 `cavalryStillRunning`，不会强停；已关闭时完成切换后自动打开。未增加“稍后重启”半状态或第二 restart API；Restore English、Updater 与权限继续使用必要 AlertDialog。旧 Recovery/Refresh/双 Restore 与可见 `Action/Status/Log` 标题均删除。 | 维持 UX Writing 的用户目标、结果、影响、下一步顺序；后续只按真实 backend event 扩展，不把内部 Apply/restart 函数名直接暴露给用户 |
| E23 | Event / AlertDialog / Toast 反馈分层 | In progress | 生产 renderer 已把有界事件框实现为 idle 单轨双轴居中，以及 running 的 fade 外任务引言 Message / 中段 Marker scroll-fade / fade 外 Switch-Restore 整体结果 Message；仅首尾 Message 按 `word + trailing whitespace` text delta 更新同一节点且不阻塞事务。Marker 严格对齐 shadcn `4.19.0` 的 16px/8px/14px 结构与原始 shimmer 算法，并以表现队列让已到达的快事件至少保留 360ms running、相邻新行间隔 120ms；慢后端不额外等待，error 立即同步前序事实并抢占，reduced-motion 归零。warning/error 继续使用同一 Marker 排布，只分别给 warningCircle/errorCircle 使用 Vercel amber 与项目 danger token，并把标题提升到中性前景；说明、事件行和任务外框保持次级/中性，既增加阻断辨识度，又不把持久事件伪装成第二个 Alert。UI Review 不再拥有反馈原型副本，而以同一生产 renderer 接收 fixture Channel，因此两端天然共用 176px 任务框、12px padding、10px 圆角、94px 中段视窗与 8px fade；工作台已集中提供未找到、官方/翻译、Windows clean、重装、启动恢复、权限、成功、warning、失败、Updater 与 About 场景，并从生产真相动态生成反馈四语、语义图标和 Badge 三类总览。四个单行阶段完成后只滚动 10px。Updater 的下载阶段是唯一默认可见的阶段次行：百分比从真实字节比值更新，进入 installing 时稳定保留 `100%`，再另起验证安装阶段；文件名、临时路径与未启用的文件级细节不投影。更新可用由绿色标题栏入口持久承载，Tooltip 解释、`aria-live` 公告，点击后由 AlertDialog 决策，不重复 Toast。macOS 启动状态为保护签名包而不写权限探针，`appManagementGranted=null` 只表示未知并保持 idle；只有真实 Switch/Restore 返回 typed `permissionRequired` 后才显示权限 AlertDialog，删除“可能需要权限”的伪警告。权限拒绝不再清空已完成阶段，而把真正失败的 phase 原位收敛为链尾阻塞项“需要系统权限 / 允许语言切换器修改 Cavalry，然后重试”，再由 AlertDialog 分别说明 macOS System Settings 或 Windows UAC 的恢复动作；说明行属于事件真实高度，DOM 更新后必须在下一布局帧复测 `scrollHeight`，只有仍处于 live edge 时才把旧阶段向上推。阶段失败不再拼接“桌面服务不可用”，该文案只保留给真实 bridge/IPC rejection。localhost 生产场景实测 `clientHeight=78 / scrollHeight=104 / maxScroll=26 / scrollTop=26`，renderer/bridge/完整 contracts 通过。未选择安装、必须重装、Cavalry 仍运行等持久事实只留在 Activity；生产 Toast 仅接 About/固定项目链接失败，默认 5000ms/3 条并对 hover、焦点和窗口失焦暂停。用户滚离 live edge 后新增事件不抢位；首尾固定 Message 的显隐、换行或流式增量都会重新测量中段高度。Switch/Restore 只有四阶段完整完成且无 warning 才输出带四语标点的结果；Updater 没有跨重启完成凭据，仍不伪造结语。 | 拉起当前 macOS native dev 审核 warning/error Marker、下载两行稳定记录与三轨动画；其余任务型 Toast 依据语义裁决保持不启用；文件级 detail 继续保持未启用，UI Review 不作为 packaged/release 证据 |
| E24 | macOS App Management 授权 handoff 动画 | In progress | 当前代码与 README 共同证明正常 `/Applications` 写事务只需要 App Management；Gatekeeper/ad-hoc 是分发信任，不是第二个 TCC 权限。macOS status 为保护签名 bundle 固定返回未知，只有真实 Switch/Restore typed denial 与重试成功可作 oracle。匿名锁定样本已逐调用链证明：每个 request 只有一次 forward；飞行代理与落稳后的 hosted drag source 是两套对象；coordinator 用 checked continuation 等待真实 `NSDraggingSession` 的 copy drop；循环的是独立箭头而非 app/假光标。当前参数闭合为 response/damping `0.72/1.0`、50pt apex、线性尺寸/圆角、`1-p/p` opacity、12pt 对向 blur、三层 shadow/0.5pt stroke，以及箭头首延迟 0.5s、stretch 0.25s、idle 4s、`1/200/11` spring。具体样本身份、地址、摘要和 raster 只保存在兄弟 reference。公开源码复核进一步锁定 CGWindow 30Hz/12 次丢失阈值、按屏幕最大交叠完成 CG→AppKit point 映射、56pt/4pt 真实拖拽阈值，并证明公开样本只靠 AppKit backing 处理倍率、没有私有样本的每屏 replicant。工作台本机参考只走两个固定只读路由，可由 `CAVALRY_UI_REVIEW_REFERENCE_ROOT` 显式指向外部 ignored 证据目录；真实 System Settings 图只保留 Switcher 行，账户头像、侧栏和其他 App 在截图源头排除，私有 Raster 与系统截图均不进入当前仓库或 bundle。`/handoff` 已拆成导航壳、结构/样式、行为三职责并全部低于 800 行；它从真实 `#modalPrimaryButton` capture，单次 morph 到独立 helper snapshot，随后显示本项目 Phosphor ArrowUp 与可拖 app row；HTML copy drop/取消/已有行/返回重试均不制造 Granted，Reduce Motion 直接静态交接。Playwright 已验证双击只完成一次 forward、`p≈.59` 时双图 opacity/blur/stroke 符合公式、HTML copy drop 可达，并实走“返回重试→其他 typed error”门禁，console 0 error/0 warning；renderer contract 9/9 PASS。审查页旧资源根因不是 Chrome cache，而是 server 启动时解构并长期持有 Node `require` cache，同时 `/revision` 只观察 renderer；入口现已在每次工作台/handoff/catalog 请求前失效四个审查模块，600ms revision 同时覆盖 renderer 与四模块，HTTP 继续 `no-store`，后续 iframe 会自动刷新而不依赖人工重启。R2/R3/R4 生产源码现已沿该边界落地：保持九命令，点击时在 `closeModal()` 前冻结 trigger rect 与 CSS viewport，既有 `open_privacy_security` 启动 per-session Channel；独立 Rust/AppKit owner 完成 source capture、CGWindow 跟踪、每屏 non-key/non-main replicant、项目箭头、真实 file-URL `NSDraggingSession` 与幂等 cleanup，renderer 只在 `retryRequested` 后重放原事务，并把同一 session 在前次事务完成前重复到达的 Retry/drop 折叠为一次；真实 apply 成功才 reverse。四语 `NSAppBundlesUsageDescription`、最终 ad-hoc App/DMG、`CodeResources`、strict codesign 与 DMG 安装态 seal 均已回读通过，`window_chrome`、固定 URL opener 和权限 oracle 未扩责。仓库外 native harness 直编同一 `.m` 后在真实 System Settings 前发现并修复箭头/说明重叠、日文按钮截断与旧非物理箭头；四语 2x helper、`320×200` panel、`1412×485` replicant 和 `1/200/11` overshoot/回摆均已由 WindowServer/PNG 只读采样证明，未写 TCC。同一 harness 随后只调用生产 `finish(true)`：WindowServer 从 helper 切入 7 帧 reverse replicant，第 9 帧起只剩 source，native 回读 `outcome=0 / terminal=1`，证明 reverse completion 与 overlay cleanup 同源闭合而非工作台特效。单屏失败分支继续证明无 source 时静态显示 helper、设置关闭时回送 dismissed 并清层、设置未出现时 50 次有界探测后回送 error 且无孤儿 panel；对应源码合同 4/4 PASS。 | 当前完成源码、macOS link、Node/Rust 合同、工作台生产-controller 回环、packaged 静态子门及单屏 helper/forward/reverse/cleanup/source-missing/target-loss 原生子门，不是首次授权证据；仍需 disposable 未授权账户真实 drop/retry、Reduce Motion、多屏/混合倍率/Space/热插拔验收，闭合前不进入 tag 或 release 结论 |

## 当前验证记录

以下记录均针对当前工作树（不是 `9766ee3` 历史打包产物）：

```text
mise x node@24.20.0 -- npm run test:contracts                    256/256 PASS
node --test tools/check_renderer_contract.js \
  tools/check_tauri_bridge_runtime.js                              40/40 PASS
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
cargo test --manifest-path src-tauri/Cargo.toml                  249 PASS / 2 explicit live-artifact tests ignored
历史（已作废）Playwright 333×420 四语正式状态/三类 Dialog 溢出矩阵       不作为当前证据
历史（已作废）native Tauri dev AX / CGWindow                       334×421 outer; config 333×420
current native Tauri dev AX / CGWindow                             400×485 outer; Managed Legacy read-only screenshot `/tmp/cavalry-managed-legacy-native.png`
current localhost UI Review                                       真实 renderer 400×484 + fixture bridge；`npm run review:ui`
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
4. 旧 `Restore English` 与 `Restore Official` 的后端事务不同，但用户意图已统一为一个可见的 `Restore English`：它写明恢复对象，macOS 映射完整官方还原，Windows 映射 English + QPA/generic cleanup，不再让用户选择内部恢复等级。
5. Tauri updater 签名、Apple Developer ID/notarization、Windows Authenticode 是三个独立信任层。
6. 当前不打 tag；R0 图标预览不是 R1 自动更新完成证据。
7. Updater 私钥是当前唯一需要用户介入的凭据决策；Apple Developer ID 与 Windows Authenticode 不替代它，当前实现也不把三者混为一谈。
8. 任务反馈视窗负责当前动作的过程、持久阻塞与结果输出；idle 任务邀请双轴居中，running 固定首尾 Message 并让中段 Marker 从顶部累积，仅在读者处于 live edge 时跟随，内部滚动与 8px scroll-fade 不遮蔽首尾。toast 不重复常驻事实；Restore、Updater、权限和危险操作才使用 AlertDialog。底层异常详情不直接进入用户文案。
9. Switch 是可逆的用户主任务，且后端在 Cavalry 运行中 fail before mutation；因此主按钮直接开始，不弹安装确认、不提供“现在/稍后重启”，末阶段只告诉用户 Cavalry 正在打开。Restore、Updater 与权限仍按各自风险保留 AlertDialog。

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
