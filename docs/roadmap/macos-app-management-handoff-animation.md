<!--
[INPUT]: 依赖当前 macOS 写事务与权限错误路径、Apple App Management 文档、本机 System Settings 只读复核、仓库外跨应用授权动画取证和锁定版本 MIT 参考源码
[OUTPUT]: 对外提供 Cavalry-i18n macOS 权限数量结论、自动 handoff/用户拖拽/同进程真实 oracle/Later 重开提示/Quit & Reopen fresh-session 投影的逐步状态机、受保护写事务 commit→reverse→打开 Cavalry 的因果边界、point/backing-pixel 与跨屏窗口模型、跨应用授权动画证据边界、typed 权限处理、当前生产实现、洁净室架构与分阶段验收路线
[POS]: docs/roadmap 的 App Management 实施账本；工作台复用生产 renderer，当前 macOS 包用于验证真实 AppKit 生命周期，不承担 release 级首次授权取证
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# macOS App Management 授权引导动画

状态: Active / Native implemented / Browser verified / Packaged shell verified / First-denied live pending
建立日期: 2026-08-31
适用范围: Cavalry-i18n macOS Switch / Restore 写事务

## 1. 产品结论

正常安装在 `/Applications` 的 Cavalry，Switcher 为写入 `Cavalry.app` 只需要 **一个真正的 macOS 隐私权限：App Management**。

不要把以下三件事混成“两个权限”：

| 边界 | 用户做什么 | 是否是本功能的 TCC 权限 |
| --- | --- | --- |
| Gatekeeper / quarantine | 首次打开未公证或 ad-hoc 包时确认信任，必要时按发布说明处理 | 否；这是分发信任 |
| App Management | 允许 Switcher 修改另一个 app bundle | **是；当前唯一写事务权限** |
| Cavalry 重签与清除 quarantine | Switcher 在事务内处理被修改后的本地 Cavalry | 否；这是写事务的内部步骤 |

某些桌面控制工具需要 Accessibility 与 Screen Recording，是因为它们必须“看见并控制其他应用”；Switcher 的任务是修改一个选定的 Cavalry bundle，两者没有权限数量上的类比关系。

## 2. 当前代码事实

| 事实 | 代码证据 | 结论 |
| --- | --- | --- |
| 设置入口 | `src-tauri/src/privilege/restart.rs::open_privacy_security` 只打开 `Privacy_AppBundles` | 唯一显式隐私页是 App Management |
| 状态读取 | `src-tauri/src/commands/status.rs::probe_app_management_permission` 在 macOS 固定返回 `None` | 启动时不能诚实显示 Granted/Denied |
| 真正验证 | Switch / Restore 写事务遇到权限拒绝后返回 typed `permissionRequired` | 实际事务才是当前可靠 oracle |
| 关闭 Cavalry | `src-tauri/src/privilege/macos/process.rs` 通过固定 JXA 调用 `NSRunningApplication.terminate` | 不是控制 System Events 的自动化流程，不构成第二个正常权限 |
| 用途说明 | `src-tauri/Info.plist` 与四个 `.lproj/InfoPlist.strings` 由 macOS bundle 配置映射 | 源码合同已闭合；最终 `.app` 仍必须 readback |
| 原生 owner | `src-tauri/native/macos_permission_handoff.m` + `src-tauri/src/macos_permission_handoff.rs` | AppKit 只负责视觉/拖拽，真实 `apply_language` 仍是唯一授权 oracle |

授权主体是 **Switcher 本身**，不是 Cavalry。2026-08-31 对本机 macOS 27 `SecurityPrivacyExtension` 的只读复核证明，`SystemPolicyAppBundles` 使用 `APPLICATION_BUNDLES_QUIT_ALLOW_TITLE` 明确说明 Switcher 在退出前不能更新或删除其他 App，并提供 `QUIT_APP = Quit & Reopen` 与 `QUIT_LATER = Later`。因此首次启用 App Management 后必须让当前 Switcher 退出，新权限才生效；系统提供退出重开动作，但静态证据不能证明该动作在当前环境每次都成功重开。这不是项目代码调用 updater 的 `app.restart()`，也不是 Cavalry 的业务重启。

产品决策保持最短路径：若系统成功重开 Switcher，它是**新会话**并按普通首屏开始；不持久化旧 `pendingAction`，不自动修改 Cavalry，不恢复旧 Activity。用户重新选择后再点 Switch / Restore；下一次受保护写事务才是权限是否生效的真实 oracle。file-URL drop 后只运行一次同进程真实 oracle；若仍返回 typed `permissionRequired`，说明当前进程尚不能使用新权限，Activity 直接提示重新打开语言切换器并回收 helper，不再把“稍后”解释为可继续 Retry。Accessibility / Screen Recording 样本的同进程 `validateAuthorization` 不能跨服务套用到 App Management。

错误解析器保留 `not authorized to send apple events` 只是一条历史兼容分类；不能以一个错误字符串反推当前产品有第二项常规授权。

## 3. 诚实状态机

App Management 没有可靠的只读预检 API。状态必须建模为“未知”，而不是把未知伪装成未授权或已授权：

```text
unknown
  └─ 用户执行 Switch / Restore
       ├─ 受保护写事务 commit ───────► 内部 oracle；打开 Cavalry → 最终业务结果
       ├─ 非权限错误 ───────────────► typed-error
       └─ permissionRequired ───────► denied-or-missing
                                         └─ Open System Settings
                                              └─ 视觉 handoff + 用户操作
                                                   ├─ Quit & Reopen
                                                   │    └─ 系统尝试退出并重开 Switcher
                                                   │         └─ 若成功：新会话普通首屏；用户重新发起任务
                                                   └─ Later
                                                        └─ 当前进程继续但新权限未生效
                                                             └─ Activity 提示重新打开；不续跑旧任务
```

约束：

1. 首次启动不主动写入 Cavalry 以“探测”权限；状态读取不能破坏已签名 bundle。
2. 设置页返回后不自动展示 Granted；只有下一次真实事务成功才有权宣布可用。
3. 动画是解释“去哪里完成操作”的视觉桥，不是授权证明，也不自动点击系统设置。
4. 自定义可写安装根可能不触发 App Management；只有 typed error 出现时才进入该分支。
5. 系统 Quit & Reopen 后不续跑旧任务；禁止用 localStorage、state.json 或启动参数偷偷恢复用户意图。

### 3.1 事件链与两个正交状态机

权限生命周期不能塞进动画 phase。生产编排必须同时维护两条彼此独立的状态：

```text
permission workflow:
denied → opening-settings → locating-settings → handoff-presented
       → awaiting-user → dragging? → same-process-oracle
       → protected-apply-committed (internal oracle)
       | restart-required | typed-error
       → system-quit-and-reopen → fresh-session-if-reopened
       | later → restart-required

visual transition:
idle → preparing → presenting → presented → reversing → idle
```

主链事件按因果顺序固定为：

| 顺序 | 事件 | 真实来源 | 用户可见结果 |
| --- | --- | --- | --- |
| 1 | `permissionRequired` | Switch / Restore 写事务 | Activity 先把红色链尾阻断及说明完整落位并保持 1200ms 可读停顿，再由 AlertDialog 接管注意力 |
| 2 | `source-captured` | 用户点击真实 `Open Settings` 动作时捕获 source rect/视觉 | 为 handoff 冻结源，而不是复制另一份 Dialog |
| 3 | `open-settings-requested` | 固定 bridge 命令 | 打开固定 `Privacy_AppBundles`，不得接受任意 URL |
| 4 | `settings-target-located` + `destination-captured` | 原生 coordinator 找到可见 System Settings 窗口并冻结目标 | 允许开始视觉 handoff；找不到则走静态 fallback |
| 5 | `handoff-presented` | forward session 完成 | 视觉代理只落到非激活 helper，**没有自动飞进 Apple 权限列表** |
| 6a | `existing-row-enabled` | 用户发现列表已有 Switcher 并开启开关 | 只表示用户完成系统设置动作，仍不宣称权限已验证 |
| 6b | `app-drag-started` | 用户按住 helper 内真实 app row 并移动鼠标 | 生成 app bundle file URL 的系统 drag session；helper 不再挡住目标 |
| 6c | `app-drop-accepted` | System Settings 整个接收窗口返回 copy operation | app 对象已交给系统列表，helper 恢复 source row；取消/失败必须回弹；drop 仍不等于权限已验证 |
| 7a | `system-quit-and-reopen` | 用户在 macOS App Management 系统提示中选择 Quit & Reopen | 系统尝试退出并重开当前 Switcher；若重开成功，旧 helper、Activity 与内存意图随旧进程结束，新会话显示普通首屏，不自动续跑；成功重开待 packaged live 证明 |
| 7b | `retry-requested` | file-URL Copy drop 被 System Settings 接受 | 为唯一一次同进程 oracle 分配 `attemptId`，重放原始 Switch / Restore；不重新 `start`，不清空既有历史，也不插入合成旁白。已经成功展示过的 verify/baseline 前置阶段不重复成行，真实失败仍投影 |
| 7c | `restart-required` | 同进程 oracle 仍返回 typed `permissionRequired`；包括用户选择 Later 或系统提示尚未完成 | 回收 helper，隐藏权限 Retry，在 Activity 链尾显示“重新打开语言切换器”及退出后生效的说明；不再重试旧任务 |
| 8a | `protected-apply-committed`（内部边界，非产品事件） | 受保护写事务真实 commit 成功 | Rust 立即启动单次 reverse，然后继续既有 `restartCavalry` 阶段与最终业务结果；不新增“权限已验证” Marker、文案或独立事件 |
| 8b | `permission-still-missing` | 同进程 oracle 仍返回 typed `permissionRequired` | 保留既有 Activity 历史，把当前失败收敛为重开阻断；helper cleanup，不反向回收、不显示虚假成功 |
| 8c | `typed-error` | 重试返回其他错误 | 保留既有 Activity 历史，进入现有错误语义并按既有规则 reverse/cleanup，不归因于权限成功 |
| 9 | `handoff-dismissed` | 同进程 oracle 已有业务结论后的 reverse/cleanup completion | 成功 commit 才 reverse；任何失败直接幂等 cleanup；系统 Quit & Reopen 由旧进程退出自然清层，不等待 reverse；成功不另造烟花或打勾 |

目标窗口丢失、System Settings 被关闭、显示器变化和 app 退出是 session 清理事件，不是授权结果；它们必须幂等撤销 overlay，并保留可供用户重新发起操作的安装与 Activity 状态。

当前 R1 UI Review 已按上表纠正：工作台仍嵌入真实 `permissionMac` renderer 作为 source，权限拒绝先在共享 Activity 中完成 1200ms 可读停顿；handoff 单独落到 helper 中的实时 draggable app row，不再把 Apple 列表行当动画终点。source 在正向交接开始时冻结，renderer 随后的弹窗关闭与任务事件只能刷新 target，不能销毁同进程 oracle 所需的源。浏览器 drag 在 `dragstart` 时克隆整条 live App row 并保持鼠标在行内的相对锚点，整个 System Settings mock 都是接收区域。原型可独立审查 HTML copy drop 成功/拒绝/取消、已有行、同进程成功、Later 重开提示、Quit & Reopen fresh-session 投影与项目自定的 Reduce Motion 降级；source 缺失时直接显示静态 helper。生产同进程 oracle 只使用唯一 `attemptId` 保留原 Activity；已经成功展示过的安装验证和恢复文件前置阶段不重复成行，但真实前置失败仍投影；仍拒绝时链尾改为重开提示且立即 cleanup，系统若重开，新会话不恢复旧 Activity。系统行的 mock 更新只表达“设置接收了 App”，**仍不是权限证明**；工作台的 fresh-session 也不冒充系统已成功重开。这里的 DOM clone、HTML Drag and Drop、单屏 CSS 几何、CSS/RAF 与 fixture 结果只证明状态和视觉规格可审查，**不是**原生 `NSImage` capture、per-screen `NSPanel` replicant、`NSDraggingSession`、混合 backing-scale、真实系统退出重开或 packaged 权限证据，R4 必须由 Rust 写事务和实机进程观察提供结果。

2026-08-31 以 UI Review revision `mtgsrup7.mj` 开始逐分支审查。审查先暴露了一个真实原型竞态：点击“重置”后，旧 source document 仍可能在同一 URL 导航提交前短暂可见，导致下一次交接误走静态 fallback。现在重置会重载同一生产 renderer fixture，并在**新 document 的非零权限动作重新出现前**保持交接入口禁用，不再让上一轮成功态或旧 DOM 污染下一轮。该 revision 的动画采样仍提供有效历史证据：完整成功 reverse 捕获 66 个 RAF 样本、约 1084ms，目标 opacity 从 `1` 单调下降到 `0.001`，中点 `p=0.5089 / 1-p=0.4911`，双图 opacity 互补最大误差小于 `5.1e-7`，对向 blur 和为 12px 的最大误差小于 `5.1e-5`。生命周期修正后的最新实跑则确认：同进程 oracle 成功才 reverse；其他 typed error 直接 cleanup；再次拒绝会清除 helper、在生产 Activity 链尾显示 `restart-required`，并禁用 Retry；模拟系统 Quit & Reopen 后，真实 renderer fixture 进入普通新会话首屏，不续跑旧任务。HTML drop、fixture settled、fresh-session 投影和 review trace 都不冒充 macOS 授权或系统已成功重开。

当前生产代码已在同一状态合同上完成 R2/R3/R4 的**源码落地**：renderer 在 AlertDialog 关闭前冻结 source rect 与 CSS viewport；既有第九条 `open_privacy_security` 以 per-session Channel 启动独立 Rust/AppKit owner；Objective-C 层按屏幕裁切 non-key/non-main panel、使用 source/target `NSImage`、项目自绘箭头和真实 app-bundle file URL `NSDraggingSession`；copy drop 只请求一次同进程 oracle，renderer 将同一 session 在前次事务完成前重复到达的 Retry/drop 折叠为一次，真实写事务成功才 reverse，任何失败都 cleanup；再次 PermissionDenied 会在 Activity 链尾显示重开提示。源码与 macOS linker 已通过本机编译，工作台也已用生产 controller + fixture bridge 跑通 forward→drag→真实 renderer oracle→success reverse / Later restart-required / fresh-session 投影。最终 ad-hoc `.app`/DMG 仍按项目 SOP 验证四语用途说明、签名与包结构，但这里不再建设独立账户、官方 DMG 封存或首次 TCC release 证明。

生产链只保留两项必要的 fail-closed 约束：`openat`/`renameatx_np` 的原始 `PermissionDenied` 在回滚补充说明后仍保留 typed 类别，macOS command 不解析任意错误文案；原生 drag 只有在 copy operation 的释放点位于实时 System Settings 整窗内时才请求重试，Finder 或其他接受 Copy 的目标不会推进权限链。

R2 单屏原生视觉子门另用仓库外临时 AppKit harness **直接编译同一份生产 `.m`**，连接本机真实 System Settings 而不写 TCC。首次截图发现 164pt helper 中箭头与说明重叠，四语矩阵又发现日文 `キャンセル` 在 68pt action 中截断；生产源码随后收敛为 200pt、20pt 外边距的 Arrow→Instruction→App Row→Action 非重叠层级，并把共享 action width 提升到 88pt。英文、简中、繁中、日文四张 2x helper readback 均无截断；当时的 WindowServer 记录到 source window、`320×200` helper 及 `1412×485` 走廊切片 replicant，连续 PNG 显示 source/target 双快照沿走廊交接。箭头 70 帧采样从基础 `36×35px` 进入 `43×62px` overshoot、回摆至 `34×29px` 后归位，证明 native 已消费锁定的 `mass=1 / stiffness=200 / damping=11`，而非旧 `NSAnimationContext` 插值。二次目标复审后生产拓扑已从走廊切片改为每屏完整 `screenFrame` panel，本段旧窗口尺寸只保留为 shared-element/四语历史证据，不能替代新拓扑的跨屏 live readback；System Settings 接受 file URL、权限已允许或业务重试成功也仍未由该子门证明。

helper 呈现后的原生焦点 readback 同样不依赖 Accessibility：`NSWorkspace.frontmostApplication` 保持 `com.apple.systempreferences`，harness 进程 `keyWindow=none / sourceKey=0`，同时 WindowServer 仍显示 layer-3 helper。结合 `CAVNonActivatingPanel.canBecomeKeyWindow/canBecomeMainWindow = NO`，这证明辅助层在真实设置窗口前没有把前台或 key/main 身份抢回本进程；它不证明跨 Space 或全屏切换分支。

同一 harness 又只通过生产公开收口入口 `cavalry_permission_handoff_finish(true)` 触发 reverse，没有修改 TCC 或另写测试动画。旧走廊切片 revision 的 WindowServer 连续序列先记录 `320×200` helper（window `26411`），随后 7 帧记录 `1412×485` reverse replicant（window `26412`），第 9 帧起 helper 与 replicant 均消失，只剩原 `400×516` source（window `26399`）；native terminal event 同时回读 `outcome=0 / terminal=1`。这证明 reverse→completion→视觉层清理不是工作台 DOM 特效；但每屏完整 `screenFrame` 拓扑取代旧 revision 后，该尺寸不再是当前窗口证据，仍需后续 native live readback。该 harness 也不等于用户真实 copy drop、System Settings 行更新、权限打开或原业务重试成功。

R3 可在不改变安全设置的失败分支也由同一 harness 补齐了单屏 live evidence：`hasSourceRect=false` 时不创建飞行代理，直接显示同一 helper；helper 已呈现后关闭 System Settings，owner 回送 `outcome=2 / terminal=1` 并移除 helper，只剩 source；设置页完全未出现时，50 次有界探测结束后回送 `outcome=3 / terminal=1`，且 WindowServer 从未留下 helper/replicant。对应源码合同现以 4/4 测试固定静态降级、目标丢失宽限、定位超时、non-key/non-main panel 与 terminal→cleanup 顺序。该证据关闭的是 source 缺失和目标丢失的单屏生命周期分支，Space、显示器拓扑变化与真实 drag cancel 仍不在其证明范围内。

Reduce Motion 的生产分支另以仓库外、进程内 `NSWorkspace.accessibilityDisplayShouldReduceMotion=true` 替身执行同一 `.m`，没有写入系统偏好：保留真实 source 时以 10ms 间隔采样 600 次，WindowServer 只出现 source 与 `320×200` helper，`SAW_REPLICANT=false`；调用生产 `finish(true)` 后第一个后续采样即只剩 source，全程仍无 reverse replicant，native 回读 `outcome=0 / terminal=1`。这证明 reduced-motion 代码路径确实把 forward/reverse 降级为静态接管/即时清理，而非只在源码里保留一个未消费布尔值；它**不证明 packaged app 从真实 macOS 无障碍设置读到该值**，系统级 Reduce Motion PASS 仍须在用户确认临时改动后完成。

工作台底部另有严格 local-only 的视觉对照区：localhost 只读系统临时目录中的真实 System Settings 截图与本机**提示箭头** Raster 参考，缺失即显示不可用；它们不进入 Git、Tauri resource、构建或发布包。这里的 Raster 只对应提示箭头，箭头下方的 App 权限项在原型中是独立实时可拖控件，不得用截图冒充交互对象。并排的项目箭头是仓库自有矢量候选，使用设计 token 与白色轮廓，目的在于人工裁决视觉语法，不复制第三方私有像素或路径。

## 4. 参考实现的证据分层

### 4.0 完整性审计：原样本、当前实现与证据债务

“代码已编译”也不等于实机授权通过。下表冻结每个环节的证据等级和当前缺口；`未知` 项禁止用想象补齐，浏览器与源码门都不能替代 packaged live 证据。

| 能力 / 行为 | 原样本证据 | 当前 R1 | 原生阶段 / 声明边界 |
| --- | --- | --- | --- |
| source probe 随布局记录权限动作 | 已确认 | 真实 renderer DOM 观察，部分 | R2 用 AppKit/WebView 坐标桥；浏览器 DOM 不是原生证明 |
| 点击时冻结 source rect/image/radius | 已确认 contract；具体 snapshot API 未知 | computed DOM clone，部分 | R2 必须选定公开 capture API；不得声称与原样本采集方式相同 |
| 固定打开目标隐私页 | 已确认 | mock | 生产只允许 `Privacy_AppBundles` 枚举 |
| 观察 System Settings 与最新目标几何 | 已确认存在 observer；频率/优先级未知 | 单页 ResizeObserver，部分 | R2/R3 用 CGWindow，目标移动与跨 Space 实机验收 |
| 双 capture shared-element morph | 已确认 | 已做 | R1 只证明视觉公式可审查 |
| spring `.72 / 1.0` 与 50pt 二次 Bézier apex | 已确认 | 已做 | response 不是固定 720ms；逐帧 settle 仍待隔离录屏 |
| 尺寸、圆角线性插值与 integral frame | 已确认 | 已做近似 | CSS pixel 不能冒充 AppKit point/backing pixel |
| source/target `1-p / p` 与 12pt 对向 blur | 已确认 | 已做 | 原生材质、色彩空间与 rasterization 待 R2/R3 |
| destination/key/ambient shadow 与 0.5pt stroke | 已确认 | 已做单层浏览器投影 | R2 才能验证 CALayer mask/clipping |
| 每屏 non-key/non-main replicant 与跨屏裁切 | 已确认每屏窗口覆盖各自 `screenFrame` | 浏览器缺失；原生已改为每屏完整透明窗口并在本地坐标绘制运动内容 | 工作台不得称跨屏证明；混合倍率/热插拔仍需原生 live 验证 |
| forward completion 后 live accessory 接管 | 已确认 | 已做结构替身 | R2 需真实 nonactivating `NSPanel`/hosting view |
| 独立 HintArrow window/raster、0.5/0.25/4s 节奏 | 已确认 | 原生使用独立非激活 child panel + 项目自绘 glyph + 已确认节奏；浏览器仅作结构替身 | 私有 raster 不进入开源产品；窗口生命周期与行为语法对齐，像素轮廓不复制 |
| app row 的真实 `NSDraggingSession` 与整行 drag snapshot | 已确认：`appRowView.bounds → bitmapImageRepForCachingDisplayInRect → cacheDisplayInRect → NSImage → setDraggingFrame:contents:` | HTML DnD 克隆整行 App row；原生对整行实时 `NSView` 调用同类 AppKit snapshot | file URL pasteboard + drag source 已对齐；浏览器替身不冒充 native 证据 |
| 系统 drag 接管与 cancel bounce | 目标样本确认 `mouseDown:` 直接建立 session，并启用系统回弹 | 原生同样从 `mouseDown:` 交给 AppKit；不再复制公开样本的自定义 4pt 门槛 | 目标样本已确认的 drag visual 是整行而非 56pt icon |
| 整个设置目标接收 copy drop、且与权限授予分离 | 已确认 operation + 目标几何约束；私有精确命中条件未知 | 整窗 mock 接收并更新系统行，已做 | R2 由原生 drop operation/屏幕几何裁决；R4 仍以写事务为唯一 oracle |
| 已有列表行只需开启的分支 | 已确认产品必要；原样本逐条件未知 | 已做人工分支 | 无 AX 时不能自动声称已检测到系统行 |
| status provider / permission oracle | 已确认原样本存在 | fixture 经真实 renderer 任务序列驱动，未接 TCC | 生产必须由 Cavalry 原写事务替代；两产品 oracle 不同，不复制状态判断 |
| 成功后 reverse / reverse completion | 已确认存在 | fixture 在 `applyTransaction` commit 后、`restartCavalry` 前发送 success-settled，再驱动 review-only reverse | 生产由 Rust 在受保护写事务 commit 后启动单次 reverse；随后继续 restart 与最终业务结果，不新增“权限已验证”产品事件 |
| reverse 使用最新 destination | 已确认 | reverse 前重采 helper 目标，已做 | R2/R3 验证窗口移动后的连续性 |
| reverse completion 恢复 source / cleanup | 已确认 | 已做状态回收 | R2 必须 generation token + 幂等释放 panel |
| no-transition fallback | 已确认存在 | Reduce Motion 与 source 缺失走静态 helper，部分 | target 缺失、设置关闭也必须走明确 fallback |
| 原样本 Reduce Motion 行为 | **未知** | 项目自定义静态降级 | 这是无障碍产品决策，不声称复刻私有行为 |
| 关闭、取消、Space、预授权、热插拔显示器全部分支 | 部分结构可证，逐条件未知 | 缺失或仅 reset | R3/R5；隔离账户逐分支验收 |
| 成功后的业务反馈 | 原样本更新 granted 状态；未发现独立烟花/打勾动画证据 | fixture 经真实 Cavalry Activity 组件投影阶段 + 结果句；success-settled 仅为审查控制消息 | 真实受保护写事务 commit 是 App Management oracle；不新增“权限已验证”产品事件，最终反馈仍由既有阶段与结果句承担 |

结论：当前已经恢复的是**转场骨架、几何公式、双图材质、阴影、箭头节奏与拖拽/授权分离的语义边界**；尚未恢复的是原生窗口/拖拽、多屏与所有异常分支。此前 R1 把 reverse 放在结果注入之前，导致“成功后动画”被吃掉；现在改为 fixture 在 `applyTransaction` commit 后、`restartCavalry` 前发送 review-only settled 控制消息，生产则由 Rust 的保护写事务 commit 边界启动 reverse。该边界不生成新的权限成功事件，失败保留既有 Activity 并继续阻断。

### 4.1 仓库外参考应用：当前与历史样本的本机证据

完整对象身份、路径、摘要、内部类型与反汇编记录只保存在兄弟项目的受控 reference 文档中，不随本开源仓库分发。本路线只保留影响自身设计的中性结论。

当前样本的直接证据仍包含完整原生 shared-element transition：

- coordinator 持有权限请求、forward start、reverse completion、transition session、无动画 fallback 与真实 accessory window；
- source probe 跟踪权限行/权限动作的 layout 与所属窗口；
- capture 明确携带 `frameOnScreen + NSImage? + cornerRadius`；
- transition controller 同时持有 source 与 destination capture，不是只移动一个 live view；
- overlay 由每块屏幕的 non-key/non-main `NSPanel` replicant 组成，并持有 clipping、stroke 与三组 shadow layer/mask；
- content model 持有 source image、target image、progress、corner radius 与最大 blur 半径；
- 动画结束后由包含应用身份、权限说明、hosting view、drag delegate 与返回动作的真实 accessory UI 接管；coordinator 另持有 drag continuation，并明确等待用户把 app 拖到 System Settings；
- 当前仍有 transition session、正向、反向与无动画分支；历史样本恢复了 preparing/presented/reversing 三阶段语义，当前具体内部枚举名称不作为本项目合同。

按对象关系可恢复的参考链路是：权限请求进入 coordinator → source probe/capture → 启动或定位 System Settings → destination capture → forward session → accessory window 接管 → 用户从 accessory 拖出 app → System Settings 接收 copy drop → coordinator 继续等待受保护写事务结果 → reverse session → completion cleanup。前半段是程序自动完成的视觉 handoff，拖入列表则是用户鼠标动作；两者之间有 checked continuation 形成的硬等待边界。飞行代理与落稳后的可拖控件视觉连续，但不是同一个 live 对象：前者由 source/target 快照和每屏 replicant 构成，后者才是 Hosted AppKit drag source。

当前样本的拖拽细节可直接确认；Apple 的 [`NSDraggingSession`](https://developer.apple.com/documentation/appkit/nsdraggingsession) 与 [`beginDraggingSession`](https://developer.apple.com/documentation/appkit/nsview/begindraggingsession%28with%3Aevent%3Asource%3A%29) 文档也确认真实 drag 在下一轮 run loop 开始，并通过 source 的 ended-operation 回调结束：

- `mouseDown:` 建立 `NSDraggingSession`；
- pasteboard provider 输出应用 bundle 的 `NSPasteboardTypeFileURL`；
- drag begin 隐藏 accessory 中的真实 app row；
- cancel/fail 开启系统回弹；
- end 只有在 copy operation 成功时才通知 delegate，随后恢复 app row；
- drop 完成信号与权限是否真正生效不是同一件事。

它与本项目需要的视觉中段一致，但参考应用的权限请求模型和成功 oracle 不能直接照搬；Cavalry-i18n 必须在两端保留自己的 typed 写事务拒绝与真实重试结果。

因此它不是视频、GIF、Lottie，也不是把 SwiftUI 视图跨进程搬进 System Settings；它用自己的 AppKit 窗口制造跨应用视觉连续性，并且不会成为 key/main window。

当前锁定样本的动画参数已经从同一份 ARM64 二进制重新取证；机器地址只用于兄弟 reference 的复核，不进入本项目合同：

| 参数 | 当前样本直接证据 | 可用结论 |
| --- | --- | --- |
| spring | `SpringParameters(response:dampingFraction:)` 接收 `0.72 / 1.0`，progress 从 `0 → 1` | 临界阻尼；`0.72` 是 response，不是固定 720ms 时长 |
| 轨迹 | 二次 Bézier helper 接收 `arcHeight = 50pt` | 起终点为两 capture 中心；控制点被反解为 `t=0.5` 时到达较高端点再上抬 50pt |
| 尺寸 / 圆角 | width、height 与 corner radius 都按 progress 线性插值，frame 最终 integral 化 | 几何连续且避免半像素边界 |
| source image | opacity `1-p`；blur `12p` | 从清晰源图连续退出，不在顶点突然切图 |
| target image | opacity `p`；blur `12(1-p)` | 从模糊目标图连续进入；`p=.5` 时两图各 0.5 alpha / 6pt blur |
| destination shadow | shadow opacity `0.06`、radius `2`、offset `(0,-3)`；整层 opacity 随 `p` | 目标接近时渐入 |
| key shadow | shadow opacity `0.09`、radius `15`、offset `(0,-5)` | 与 ambient shadow 分层，不把阴影烘进快照 |
| ambient shadow | shadow opacity `0.20`、radius `3`、offset `(0,0)` | 提供近场接触阴影 |
| stroke | 0.5pt 黑色描边；整层 opacity `0.15p` | 只在接近目标时逐渐建立边界 |
| 自动次数 | 每个请求一次 forward；返回/取消时至多一次 reverse | shared-element flight 不循环；完成由 spring session callback 驱动 |
| 提示箭头节奏 | 出现 0.5s 后开始；stretch 0.25s、idle 4s 循环；hover 触发一次 0.25s stretch | 循环的是独立提示箭头，不是 app 卡片或假拖拽 |
| Reduce Motion | 当前参考样本未找到可归因的直接分支 | 本项目仍必须自行正确实现静态降级 |

提示箭头使用资源目录中的独立 raster，不是通用软件光标。其当前视觉为 `28×28`、底部锚点、stretch 时 `x=1.15 / y=1.6`、黑色 23% 阴影 `radius=7, x=0, y=4`、垂直偏移 `-10`；所有伸缩使用 `interpolatingSpring(mass:1, stiffness:200, damping:11, initialVelocity:0)`。这套 0.5/0.25/4 秒节奏只解释“请在这里拖”，不得被实现成自动移动 app 对象，更不得作为授权完成计时器。

参考应用还包含另一套截图 presentation 动画。它服务于应用截图展示，不是权限行到 System Settings 的授权转场，禁止交叉套用参数。

### 4.2 公开 MIT 参考实现

仓库外已锁定一份公开 MIT 源码作为洁净室工程样本；具体项目名、commit 与许可文本保存在兄弟项目 reference 中。本项目只吸收经独立验证的公开 AppKit 行为，不建立源码依赖。

本轮逐文件审计了该锁定 revision 的全部库、示例、测试与本地化 Swift 源码，并实际执行其 13 项契约测试。必须先钉死两个边界：其 floating panel 是同进程、nonactivating 的真实 `NSPanel`，内部 app card 是由 SwiftUI hosting view 承载的真实 `NSDraggingSource`，**不是截图**；但公开实现没有 System Settings drop-success oracle、目标行 AX 检测、成功反向动画、成功后自动关闭或 Reduce Motion 分支。`onDrop` 只登记宿主传入的候选 app，不等于系统设置接受了拖放；静态 granted checkmark 只反映 status provider 的再次读取，也不等于成功动画。

| 能力 | 源码事实 | 对本项目的意义 |
| --- | --- | --- |
| App Management | `.appManagement` 打开 `Privacy_AppBundles`，status capability 为 unsupported | 与当前 `None` 状态模型相互印证 |
| App Management drag | `.appManagement` 未被排除出 floating authorization panel；panel 的主卡片是可拖 app bundle | 公开样本直接支持“helper 落稳后由用户拖入列表”的产品路径 |
| 设置窗口跟踪 | 30Hz polling；无 AX 时使用 `CGWindowListCopyWindowInfo`，已有 AX 时才加 observer | 动画本身不应要求 Accessibility |
| 浮动窗口 | borderless + nonactivating `NSPanel`，不成为 key/main，支持所有 Space | 不抢走 System Settings 焦点 |
| 飞行动画 | 60fps Timer；公开样本使用临界阻尼、alpha 与 minimum scale | 可作为低复杂度 MVP 行为参考，不能描述外部参考应用的当前参数 |
| 轨迹 | 二次 Bezier；弧高随距离 clamp | 比固定直线自然，但不是任何私有实现参数的证明 |
| 目标布局 | 跟随 System Settings 主窗口，在 trailing content 邻接 helper panel | 不需要截取或修改系统设置内容 |
| Drag source | 公开样本自有 4pt 移动阈值、Finder 风格多类型 payload、56pt icon-only drag image 与 cancel/fail 回弹 | 只作公开工程对照；当前产品按目标样本采用 `mouseDown:` 系统 session、file-URL provider 与整行 snapshot，不复制这组 4pt/56pt 方案 |
| Drag passthrough | drag 时 helper `ignoresMouseEvents=true`、置后并降 alpha，结束恢复 | 让 System Settings 而非 helper 接收 drop |
| 成功边界 | drag source 的 ended callback 收到 operation 但公开实现忽略其值；没有 destination/drop callback 与成功动画 | 本项目必须用真实 Cavalry 写事务重试作为最终 oracle，不能用 drop 或计时器制造成功 |
| 关闭与恢复 | helper 关闭、设置退出与返回前台应用是显式控制分支；没有成功自动收口 | reverse/cleanup 若采用，属于本项目经私有样本独立取证后的设计，不能冒充公开实现行为 |

公开实现的最终 panel 从点击位置飞向目标；仓库外参考应用的当前/历史样本则有源/目标图像和多屏 replicant。两者不能混写成同一种实现。

### 4.2.1 本机 App Management 目标页复核

在 macOS 27.0 上只读打开固定 `Privacy_AppBundles` 页面并截取 System Settings 自身窗口，当前页面直接显示：

- app 列表；
- 每个 app 的独立开关；
- 列表底部的添加/移除控件；
- 本机 Switcher 已经存在于列表中。

这带来一个不能忽略的产品分支：**已有行时只需启用，不应强迫用户再次拖拽；缺少行时才展示 draggable app row。** 当前不请求 Accessibility，因此不能靠读取 System Settings 内部 AX tree 自动决定分支。第一版 helper 应同时给出两条简洁指引：“列表中已有时开启；没有时拖入下方 App”，最终仍由返回后的写事务验证。

本轮没有为了证明 drop 而向真实 TCC 列表写入新的测试 app，也没有修改任何开关。Apple 公开支持文档确认 App Management 的用途，但没有逐字承诺 drag 行为；“App Management 可走 floating drag panel”目前由锁定 MIT 源码与真实页面的 app-list/add-control 结构交叉支持，仍需在 disposable 测试账户完成一次 R5 live drop 验收。

### 4.2.2 point、backing pixel 与跨屏归属

公开源码给出了可直接审计的坐标管线，不能把它简化成“乘一个 Retina 比例”：

1. `CGWindowListCopyWindowInfo` 与 AX window attribute 提供全局、左上原点的窗口 rect；布局单位仍是 point，不是资源像素。
2. 为每个 `NSScreen` 读取 `NSScreenNumber → CGDisplayBounds`，找到与目标 rect **交叠面积最大**的屏幕，避免窗口横跨显示器时随数组顺序误归属。
3. 先求 rect 相对该屏 `CGDisplayBounds` 的局部 `x/y`，再用该屏的 `NSScreen.frame.maxY - localY - height` 转成 AppKit 左下原点坐标。
4. helper 最终 frame 使用目标屏 `visibleFrame` 做 clamp，避免落到菜单栏、Dock 或屏幕外；公开样本中的 `-3pt` 与视觉边框补偿属于样本局部调参，不能进入本项目通用转换函数。
5. `NSScreen.frame`、窗口 frame、圆角、阴影半径与 28pt 箭头容器都保持 point；真正绘制时由窗口/视图所在屏幕的 `backingScaleFactor` 决定 backing pixel。矢量 path 自动重栅格，位图则由 asset catalog 在 1x/2x rendition 间选择。

这解释了“29×33 的 Raster 为什么能放进 28×28 的视图”：前者是图片自身 logical size/rendition 身份，后者是布局容器；`aspectFit`、裁切或视图内缩放决定最终视觉，不应把 57×66 的 2x 像素尺寸直接当 CSS/AppKit frame。

公开样本只维护一扇 helper panel：选择与目标相交的屏幕并 clamp，足够解释单屏 MVP，但它不能证明跨屏飞行期间每个像素都稳定。生产级参考采用每个 `NSScreen` 一扇 non-key/non-main replicant panel，共享一个全局 transition model，每扇 panel 只绘制运动 rect 与自身 `screenFrame` 的交集。这样不同 backing scale、color space、负坐标、Space 和屏幕边界裁切各自留在所属 panel，不让一扇超大窗口跨越所有显示器。

本机只读复核时主屏为 `1710×1107pt`、`backingScaleFactor=2`，System Settings 最大 layer-0 window 的 CG bounds 为 `740×625pt`。窗口截图包含系统阴影，PNG 像素边界不能反推内容 frame；生产测试必须同时记录 point frame、backing scale 与内容截图，禁止仅凭 PNG 宽高判断缩放是否正确。

### 4.2.3 实机动态证据边界

当前主机只有单块 2x、60Hz 内置屏，主账户也已存在相关系统授权和系统级辅助组件；它可以验证静态二进制结构、单屏 2x 布局和最多 60 个真实显示状态/秒，却不能提供“干净首次授权”、1x、多屏或真实 120Hz 的完整证据。向 ScreenCaptureKit 请求 `1/120s` 只会产生至多 60Hz 的真实画面与可能的重复帧，禁止据此宣称 120fps 通过。

完整动态取证必须在独立 macOS 测试用户中保留参考样本原签名，由用户手工覆盖成功、拒绝、关闭与拖拽取消；若要验证首次安装而不只是首次授权，则使用干净外置系统或另一台 Mac。采集同时记录 monotonic timestamp、窗口 point frame、display id、backing scale、原始无损帧、帧 hash、重复/丢帧与真实事务结果；不得执行 `tccutil reset`、修改 TCC 数据库、自动拨动系统开关或把主账户授权当成目标 Bundle 的证明。

### 4.3 Apple API 边界

- [`NSAppBundlesUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsappbundlesusagedescription) 是 App Management 的目的说明键；生产包必须在最终 `Info.plist` 中可验证。
- [`NSWorkspace.Authorization`](https://developer.apple.com/documentation/appkit/nsworkspace/authorization) 的特权文件操作路径需要 [`com.apple.developer.security.privileged-file-operations`](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.security.privileged-file-operations)；不是本项目可直接拿来做通用 App Management 预检的捷径。
- 动画只需要捕获自己的 source view、通过 [`CGWindowListCopyWindowInfo`](https://developer.apple.com/documentation/coregraphics/cgwindowlistcopywindowinfo(_:_:)) 读取公开窗口元数据并创建自己的 overlay；禁止截取、伪造或自动操作 System Settings 权限列表。
- 必须响应 [`accessibilityDisplayShouldReduceMotion`](https://developer.apple.com/documentation/appkit/nsworkspace/accessibilitydisplayshouldreducemotion)；降级路径是直接打开设置并显示静态辅助面板，而不是缩短一点动画假装完成无障碍支持。Reduce Transparency 开启时还应改用不透明 helper surface。

## 5. 推荐的生产架构

### 5.1 所有权

```text
renderer permission dialog/card
  └─ 只提供：本地化目的、Open Settings、source DOM rect
       ↓ fixed bridge command; 不接受任意 URL
Rust command layer
  └─ 只接受固定 appManagement 枚举
       ↓
macos_permission_handoff.rs
  ├─ 打开 Privacy_AppBundles
  ├─ 跟踪 System Settings window
  ├─ 持有非激活 NSPanel / animation session
  ├─ 在 helper 中承载真实可拖 app bundle URL
  ├─ 区分 drag accepted 与 protected apply commit
  ├─ cleanup / cancel / Reduce Motion
  └─ 不判断“已授权”
```

不要把实现塞进 `window_chrome.rs`。标题栏与权限 handoff 是两个独立变更理由；新的原生模块只暴露固定 permission enum 与有界 session 生命周期。

### 5.2 当前仓库的最短接线缝

本轮继续沿真实代码查到的生产接线，不应在 R2 再重新发明：

1. **保持九命令不变。** `open_privacy_security` 已是固定 App Management 入口；只把它从无参数动作扩成异步的 `AppHandle + PermissionHandoffRequest → PermissionHandoffPayload`，不新增第十条 command，也不接受任意 URL。command 在 native session 返回/取消/失败时只回传 typed `retryRequested/dismissed/error`，不另建全局 event bus。
2. **renderer 只给局部 CSS rect。** `renderer/app.js` 必须在现有 `closeModal()` **之前**冻结本次触发元素的 `getBoundingClientRect()`：Dialog 路径使用真实 `#modalPrimaryButton`，常驻权限动作使用 `#permissionButton`。bridge 只接受有限、非负、有限数值的 `x/y/width/height`。renderer 不计算全局屏幕坐标，也不获得新的 window capability。
3. **原生层完成坐标转换。** `WebviewWindow::ns_view/ns_window` 与 AppKit `convertRect` 负责把 CSS y-down 局部矩形投影到全局 AppKit y-up 坐标；禁止把标题栏高度、设备像素比或屏幕原点写成 renderer 魔法偏移。source rect 缺失或越界时仍打开固定设置页，只跳过飞行动画并显示静态 helper。
4. **独立 owner 持有生命周期。** 新建 `macos_permission_handoff.rs`，由 `lib.rs` 装配并由 command facade 调用；`window_chrome.rs` 不扩职责，`privilege::open_privacy_security` 继续只负责固定系统 URL。owner 负责 panel、CGWindow 跟踪、drag session、generation token 与幂等 cleanup。
5. **依赖必须直接、精确。** 当前锁中已有 `objc2-app-kit 0.3.2` 与 `core-graphics 0.25.0`，但前者只启用了标题栏所需最小 feature，后者只是传递依赖。R2 必须在 macOS target 下直接声明需要的 AppKit/Foundation/CoreGraphics API，不能依赖 Tauri 偶然带入。
6. **本地化进入 bundle，而非 renderer JSON。** 默认 `Info.plist` 持有英文 `NSAppBundlesUsageDescription`；`en/zh-Hans/zh-Hant/ja.lproj/InfoPlist.strings` 提供系统权限文案投影，并在 dev/app/DMG 最终 `Info.plist` 和资源目录逐项 readback。它不是 Cavalry runtime translation，也不进入 `languages/`。
7. **授权仍由原事务判定。** helper 的 copy drop、已有行开关、System Settings 关闭都只改变引导 session。copy drop 只触发一次 `retryRequested`，生成唯一 `attemptId` 并调用原始 `runApply` 作为同进程 oracle；若仍拒绝，Rust cleanup helper，renderer 在 Activity 链尾提示重新打开，Later 不再继续 Retry。用户选择系统 Quit & Reopen 时，macOS 尝试终止并重新打开 Switcher；若重开成功，新会话不恢复旧任务。受保护 apply commit 后 Rust 才触发同进程单次 reverse，再继续与授权无关的 `restartCavalry` 业务阶段与最终结果；native owner 绝不直接调用 apply transaction。

### 5.3 第一版应做什么

推荐先做一个窄而真实的单权限版本：

1. `permissionRequired` AlertDialog 内展示一行 App Management 目的说明和 `Open System Settings` 动作。
2. 从这行的真实矩形生成视觉代理；如果 WebView 局部快照不稳定，第一版复制同一视觉 token 到 native proxy，而不是截整个窗口。
3. 打开 `Privacy_AppBundles`，通过 CGWindow 找到最大的可见 layer-0 System Settings window。
4. 用不激活的透明 panel 沿临界阻尼弧线路径过渡到设置窗口旁的真实 helper；坐标转换集中在 native owner，并始终保留 point/backing-pixel 分层。自动动画止于 helper，绝不能自动飞入 Apple 列表。
5. helper 显示一个真实 draggable Switcher app row，并说明“列表已有时开启；没有时拖入”；drag payload 是 app bundle file URL，取消/失败回弹，drop 时 panel 必须让出鼠标给 System Settings。
6. drag accepted 只更新引导阶段，不显示授权成功；它只以唯一 attempt 运行一次原始 Switch / Restore 事务作为同进程 oracle，并保留 Activity 历史，不追加合成 resume 文案。受保护写事务 commit 才启动 reverse；若仍拒绝则 cleanup helper、隐藏 Retry 并提示重新打开，系统若成功重开则进入普通新会话。
7. System Settings 关闭、目标窗口消失、显示器切换、drag 取消或主 app 退出时幂等清理。

### 5.4 第一版明确不做什么

- 不引入整套 Swift Package 或第二套组件库；只学习经过锁定的状态和几何。
- 不为动画请求 Accessibility、Screen Recording 或 Automation。
- 不读写 TCC 数据库，不尝试自动拨动权限开关。
- 不同时实现多权限通用框架；YAGNI，当前只有 App Management。
- 三层 shadow 与 multi-display replicant 已进入原生源码；在跨屏、混合倍率与热插拔实机通过前，只能称为实现，不得称像素级证据。

## 6. 分阶段验收

| 阶段 | 产物 | 通过条件 |
| --- | --- | --- |
| R0 证据冻结 | 本文 + 当前 Computer Use 复核 | 直接证据、公开源码、推断、产品方案四层不混写 |
| R1 UI Review 原型 | 复用真实权限 Dialog/card 的动画场景 | 自动 handoff 只落到 helper；用户可拖 app row 到列表；同进程 oracle 成功/仍拒绝/其他错误、已有行、fresh session 与 Reduce Motion 可独立审查；不冒充 native |
| R2 native 单屏 MVP | 独立 AppKit owner + fixed bridge | 不抢焦点；打开准确 pane；真实 file URL drag 可被设置接收；失败回弹；设置窗口移动时 helper 跟随；取消幂等 |
| R3 native 鲁棒性 | 多显示器、Space、窗口关闭/重开、目标丢失 | 无孤儿 panel、无焦点劫持、无额外权限、无崩溃 |
| R4 生产接线 | typed `permissionRequired` → handoff → 单次 oracle / restart-required | 只有真实事务成功才显示成功；再次拒绝必须 cleanup 并要求重开；四语目的说明进入最终包 |
| R5 packaged visual check | 当前 ad-hoc/package 实机 | 从干净 bundle 目录构建，检查四语资源、签名、窗口、helper/drop/oracle/reverse；系统当前权限状态不允许出现的分支由共享工作台审查，不另造账户或证据系统 |

当前状态：R0/R1 已闭合；R2/R3/R4 已完成源码、编译与单屏原生子门，helper/forward/reverse/cleanup、source 缺失、目标关闭、定位超时均有验证。共享工作台的成功、仍拒绝、typed error、Reduce Motion、fresh session 与整行 drag snapshot 分支已通过；当前 ad-hoc `.app`/DMG 的包结构、四语权限用途说明、签名、资源与窗口 shell 也已通过。当前账户尚未自然重现首次拒绝后的真实 System Settings 接收、单次写事务 oracle、Quit & Reopen 新进程或 Later 重开提示，因此这些 live 分支仍待用户后续实机检查；多屏/Space/热插拔属于后续鲁棒性验证，不阻塞本次 UI 落地。

### 6.1 macOS 实机查看

从空 bundle 目录构建当前 ad-hoc 包，按现有 `LOCAL_BUILD_SOP.md` 检查包结构、四语用途说明、窗口回归和签名；随后在当前账户打开该包，按系统当下真实状态观察 helper 呈现、整窗 drop、单次 oracle 与 reverse/cleanup。工作台负责稳定复现成功、仍拒绝、typed error、fresh session、source 缺失和 Reduce Motion 等分支；实机只验证当前系统确实可到达的路径。这里不创建独立账户、不重置 TCC、不封存官方 DMG，也不把该动画单独升级成 release 证明。

## 7. 验证矩阵

至少覆盖：

- 权限未知、已拒绝、用户在设置中允许、用户不允许直接返回；
- App 已在列表只需开启 / App 不在列表需要拖入；
- drag 成功、目标拒绝、半途取消、释放在错误位置；
- System Settings 已打开 / 未打开 / 打开后立刻关闭；
- source rect 缺失时静态降级；
- 单屏、双屏、目标窗口跨屏；
- 1x/2x 或不同缩放显示器之间移动窗口、动画中热插拔显示器，并记录 point frame、backing scale 与截图三项证据；
- Reduce Motion 开启；
- Cavalry 位于 `/Applications` 与明确可写自定义根；
- AlertDialog 键盘焦点仍留在正确结果界面，overlay 永不成为 key window；
- App Management 之外没有新增 TCC 请求。

## 8. 发布与许可边界

- 本功能不新增 tag 或 release 门；发布判断继续服从项目既有 SOP，不由授权动画另造证据体系。
- 若后续直接移植公开 MIT 参考实现的实质代码，必须保留 copyright/许可并更新第三方 notices；仅学习公开行为后独立实现，也要在兄弟 reference 中保留 commit 与证据链以便审计。
- 仓库外二进制研究只用于行为理解和洁净室设计，不复制私有实现，也不在本开源仓库暴露具体研究对象身份。
