<!--
[INPUT]: 依赖当前 macOS 写事务与权限错误路径、Apple App Management 文档、本机 System Settings 只读复核、仓库外跨应用授权动画取证和锁定版本 MIT 参考源码
[OUTPUT]: 对外提供 Cavalry-i18n macOS 权限数量结论、自动 handoff/用户拖拽/真实重试的逐步状态机、point/backing-pixel 与跨屏窗口模型、跨应用授权动画证据边界、typed 权限与独立用户证据门、当前生产实现、洁净室架构与分阶段验收路线
[POS]: docs/roadmap 的 App Management 实施与证据账本；代码已进入生产路径，但在 packaged 首次授权、多屏和 Reduce Motion 实机证据闭合前不得写成发布结论
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# macOS App Management 授权引导动画

状态: Active / Native implemented / Packaged static evidence closed / Live permission evidence pending
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

错误解析器保留 `not authorized to send apple events` 只是一条历史兼容分类；不能以一个错误字符串反推当前产品有第二项常规授权。

## 3. 诚实状态机

App Management 没有可靠的只读预检 API。状态必须建模为“未知”，而不是把未知伪装成未授权或已授权：

```text
unknown
  └─ 用户执行 Switch / Restore
       ├─ 写事务成功 ───────────────► verified-by-operation
       ├─ 非权限错误 ───────────────► typed-error
       └─ permissionRequired ───────► denied-or-missing
                                         └─ Open System Settings
                                              └─ 视觉 handoff + 用户操作
                                                   └─ 返回后 Retry
                                                        ├─ 成功 ► verified-by-operation
                                                        └─ 仍拒绝 ► denied-or-missing
```

约束：

1. 首次启动不主动写入 Cavalry 以“探测”权限；状态读取不能破坏已签名 bundle。
2. 设置页返回后不自动展示 Granted；只有下一次真实事务成功才有权宣布可用。
3. 动画是解释“去哪里完成操作”的视觉桥，不是授权证明，也不自动点击系统设置。
4. 自定义可写安装根可能不触发 App Management；只有 typed error 出现时才进入该分支。

### 3.1 事件链与两个正交状态机

权限生命周期不能塞进动画 phase。生产编排必须同时维护两条彼此独立的状态：

```text
permission workflow:
denied → opening-settings → locating-settings → handoff-presented
       → awaiting-user → dragging? → retrying
       → returning → verified | still-denied | typed-error

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
| 7 | `retry-requested` | copy drop / 已有行确认后由 coordinator 继续，或用户显式重试 | helper 保持 presented，重放原始 Switch / Restore 一次；动画不能抢在业务 oracle 前收口 |
| 8a | `operation-verified` | 重试写事务成功 | 才能宣布权限已由实际操作验证，并触发单次 reverse；原 Activity 继续显示真实阶段与结果 |
| 8b | `permission-still-missing` | 重试仍返回 typed `permissionRequired` | helper 保持 presented 并回到等待设置，不反向回收、不显示虚假成功 |
| 8c | `typed-error` | 重试返回其他错误 | 触发 reverse/cleanup 后进入现有错误语义，不归因于权限 |
| 9 | `handoff-dismissed` | 已有业务结论后的 reverse session completion | 幂等清理视觉层；成功没有另造烟花或打勾，reverse 本身就是已确认的成功收口动画 |

目标窗口丢失、System Settings 被关闭、显示器变化和 app 退出是 session 清理事件，不是授权结果；它们必须幂等撤销 overlay，并保留用户可重试的业务状态。

当前 R1 UI Review 已按上表纠正：工作台仍嵌入真实 `permissionMac` renderer 作为 source，权限拒绝先在共享 Activity 中完成 1200ms 可读停顿；handoff 单独落到 helper 中的实时 draggable app row，不再把 Apple 列表行当动画终点。source 在正向交接开始时冻结，renderer 随后的弹窗关闭与任务事件只能刷新 target，不能销毁反向动画所需的源。浏览器 drag 使用独立 App 图标而非整卡截图作为 drag image，整个 System Settings mock 都是接收区域；copy drop 后模拟系统行更新并自动继续原事务验证，不再要求审查者额外点击开关或理解内部重试门禁。原型可独立审查 HTML copy drop 成功/拒绝/取消、已有行、fixture 经真实 renderer 的重试序列与项目自定的 Reduce Motion 降级；source 缺失时也不再中止，而是直接显示静态 helper。fixture 成功先跑真实 Activity 组件的阶段/结果，再以同一 shared-element 做 reverse/cleanup；仍拒绝则保留 helper；其他错误回收后进入真实错误语义。其视觉层已切换到当前锁定样本的 50pt apex、线性尺寸/圆角、`1-p / p` 双图 opacity、12pt 对向 blur、分层 shadow/stroke 和独立箭头节奏。系统行的 mock 更新只表达“设置接收了 App”，**仍不是权限证明**；这里的 DOM clone、HTML Drag and Drop、单屏 CSS 几何、CSS/RAF 与 fixture 结果只证明状态和视觉规格可审查，**不是**原生 `NSImage` capture、per-screen `NSPanel` replicant、`NSDraggingSession`、混合 backing-scale 或 packaged 权限证据，R4 必须由 Rust 写事务提供结果。

2026-08-31 以 UI Review revision `mtgsrup7.mj` 对当前浏览器实现重新逐分支审查。审查先暴露了一个真实原型竞态：点击“重置”后，旧 source document 仍可能在同一 URL 导航提交前短暂可见，导致下一次交接误走静态 fallback。现在重置会重载同一生产 renderer fixture，并在**新 document 的非零权限动作重新出现前**保持交接入口禁用，不再让上一轮成功态或旧 DOM 污染下一轮。随后 Playwright 实跑确认：Reduce Motion 只产生 `full→reduced` 状态变化，正向直接进入 helper，成功后立即回到 idle；仍拒绝保留 helper 且事件止于 `permissionStillMissing`；其他 typed error 执行 reverse、清除 helper 并进入 `typedError`。完整成功 reverse 捕获 66 个 RAF 样本、约 1084ms，目标 opacity 从 `1` 单调下降到 `0.001`，中点 `p=0.5089 / 1-p=0.4911`，双图 opacity 互补最大误差小于 `5.1e-7`，对向 blur 和为 12px 的最大误差小于 `5.1e-5`；阶段只经过“反向动画→待命”。真实 Playwright `dragTo` 还闭合 `appDragStarted→appDropAccepted→retryRequested→operationVerified→handoffDismissed`，目标行 checked、helper 清理，console 为 0 error / 0 warning。该记录证明浏览器状态机、公式和可重复审查入口成立，仍不把 HTML drop 或 fixture success 冒充 macOS 授权。

当前生产代码已在同一状态合同上完成 R2/R3/R4 的**源码落地**：renderer 在 AlertDialog 关闭前冻结 source rect 与 CSS viewport；既有第九条 `open_privacy_security` 以 per-session Channel 启动独立 Rust/AppKit owner；Objective-C 层按屏幕裁切 non-key/non-main panel、使用 source/target `NSImage`、项目自绘箭头和真实 app-bundle file URL `NSDraggingSession`；copy drop 只请求重试，renderer 将同一 session 在前次事务完成前重复到达的 Retry/drop 折叠为一次，真实写事务成功才 reverse，仍缺权限则保留 helper，其他错误/取消才 cleanup。源码与 macOS linker 已通过本机编译，工作台也已用生产 controller + fixture bridge 跑通 forward→drag→真实 renderer retry→reverse。最终 ad-hoc `.app`/DMG 已从空 bundle 目录按 SOP 重建，四语 `InfoPlist.strings`、默认用途说明、`CodeResources`、strict codesign、DMG 内与安装态 bundle seal 均已回读通过。**这仍不是首次授权、System Settings 真 drop、混合倍率或 packaged app 的权限链 live PASS**；这些结论只允许由 R5 实机证据给出。

隔离用户验证暴露了与 TCC 正交的 POSIX 所有权边界：系统级 `/Applications/Cavalry.app` 通常不由另一标准用户拥有；App Management 不会把另一个标准用户提升为该 bundle 的 owner，而 macOS 路径又明确拒绝 root/admin shell fallback。因此默认发现保持已保存路径第一，其后遵循 macOS application domain 的 `~/Applications/Cavalry.app`→`/Applications/Cavalry.app` 次序。独立用户先复制一份由自己拥有的官方 Cavalry 到用户域，只能证明 POSIX 写入前提成立，**不能保证该用户域路径一定触发 App Management**；首次真实 Switch 若直接成功，R5 应停止并记录“未触发权限阻断”，不得伪造 `permission-blocked`。候选顺序由 Rust 合同锁定，不为测试加入专用入口或写权限探针。

`b0c784d` 的 ad-hoc 包（Switcher `d1d2e3c9…`、DMG `d1bd5318…`、PID `63112`）现在只保留为历史候选：它仍从当时已被 Switcher 修改并 ad-hoc 重签的 `/Applications/Cavalry.app` 派生隔离输入，不能充当官方 English R5 基线。后续审计已经把生产链收紧为两层：`openat`/`renameatx_np` 的原始 `PermissionDenied` 在回滚补充说明后仍保留 typed 类别，macOS command 不再解析任意错误文案；原生 drag 也只有在 copy operation 的释放点位于实时 System Settings 窗口内时才请求重试，Finder 或其他接受 Copy 的目标不会推进权限链。两项修复均不能替代首次授权实测，只是消除了假阳性入口。

R2 单屏原生视觉子门另用仓库外临时 AppKit harness **直接编译同一份生产 `.m`**，连接本机真实 System Settings 而不写 TCC。首次截图发现 164pt helper 中箭头与说明重叠，四语矩阵又发现日文 `キャンセル` 在 68pt action 中截断；生产源码随后收敛为 200pt、20pt 外边距的 Arrow→Instruction→App Row→Action 非重叠层级，并把共享 action width 提升到 88pt。英文、简中、繁中、日文四张 2x helper readback 均无截断；WindowServer 记录到 source window、`320×200` helper 及 `1412×485` 单屏 replicant，连续捕获的 replicant PNG 显示 source/target 双快照沿走廊交接。箭头 70 帧采样从基础 `36×35px` 进入 `43×62px` overshoot、回摆至 `34×29px` 后归位，证明 native 已消费锁定的 `mass=1 / stiffness=200 / damping=11`，而非旧 `NSAnimationContext` 插值。该子门证明真实 AppKit/WindowServer 渲染和四语几何，仍不证明 System Settings 接受 file URL、权限已允许或业务重试成功。

helper 呈现后的原生焦点 readback 同样不依赖 Accessibility：`NSWorkspace.frontmostApplication` 保持 `com.apple.systempreferences`，harness 进程 `keyWindow=none / sourceKey=0`，同时 WindowServer 仍显示 layer-3 helper。结合 `CAVNonActivatingPanel.canBecomeKeyWindow/canBecomeMainWindow = NO`，这证明辅助层在真实设置窗口前没有把前台或 key/main 身份抢回本进程；它不证明跨 Space 或全屏切换分支。

同一 harness 又只通过生产公开收口入口 `cavalry_permission_handoff_finish(true)` 触发 reverse，没有修改 TCC 或另写测试动画。WindowServer 连续序列先记录 `320×200` helper（window `26411`），随后 7 帧记录覆盖 source→target 走廊的 `1412×485` reverse replicant（window `26412`），第 9 帧起 helper 与 replicant 均消失，只剩原 `400×516` source（window `26399`）；native terminal event 同时回读 `outcome=0 / terminal=1`。这闭合了**同一原生实现的 reverse→completion→视觉层清理子门**，证明收口不是工作台 DOM 特效，也没有残留 overlay。它仍是 marker 驱动的视觉/lifecycle harness，不等于用户真实 copy drop、System Settings 行更新、权限打开或原业务重试成功。

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
| 每屏 non-key/non-main replicant 与跨屏裁切 | 已确认 | 缺失 | R3；当前 R1 不得称像素级跨屏复刻 |
| forward completion 后 live accessory 接管 | 已确认 | 已做结构替身 | R2 需真实 nonactivating `NSPanel`/hosting view |
| 独立 HintArrow raster、0.5/0.25/4s 节奏 | 已确认 | 项目自绘 glyph + 已确认节奏，部分 | 私有 raster 不进入开源产品；只复刻行为语法 |
| app row 的真实 `NSDraggingSession` | 已确认 | HTML DnD + 独立 App 图标 drag image 替身 | R2 必须 file URL pasteboard + drag source |
| 4pt 阈值、56pt drag image、cancel bounce | 仅公开 MIT 样本确认，非原样本参数 | 缺失 | 可 clean-room 采用但必须标注公开来源，不冒充私有参数 |
| 整个设置目标接收 copy drop、且与权限授予分离 | 已确认 operation + 目标几何约束；私有精确命中条件未知 | 整窗 mock 接收并更新系统行，已做 | R2 由原生 drop operation/屏幕几何裁决；R4 仍以写事务为唯一 oracle |
| 已有列表行只需开启的分支 | 已确认产品必要；原样本逐条件未知 | 已做人工分支 | 无 AX 时不能自动声称已检测到系统行 |
| status provider / permission oracle | 已确认原样本存在 | fixture 经真实 renderer 任务序列驱动，未接 TCC | 生产必须由 Cavalry 原写事务替代；两产品 oracle 不同，不复制状态判断 |
| 成功后 reverse / reverse completion | 已确认存在 | **已纠正为 fixture 业务成功后触发** | 生产接线后改由真实任务成功触发；精确私有条件仍未知，不得另造成功特效 |
| reverse 使用最新 destination | 已确认 | reverse 前重采 helper 目标，已做 | R2/R3 验证窗口移动后的连续性 |
| reverse completion 恢复 source / cleanup | 已确认 | 已做状态回收 | R2 必须 generation token + 幂等释放 panel |
| no-transition fallback | 已确认存在 | Reduce Motion 与 source 缺失走静态 helper，部分 | target 缺失、设置关闭也必须走明确 fallback |
| 原样本 Reduce Motion 行为 | **未知** | 项目自定义静态降级 | 这是无障碍产品决策，不声称复刻私有行为 |
| 关闭、取消、Space、预授权、热插拔显示器全部分支 | 部分结构可证，逐条件未知 | 缺失或仅 reset | R3/R5；隔离账户逐分支验收 |
| 成功后的业务反馈 | 原样本更新 granted 状态；未发现独立烟花/打勾动画证据 | fixture 经真实 Cavalry Activity 组件投影阶段 + 结果句 | 产品层反馈，不冒充原样本私有视觉或 packaged 证据 |

结论：当前已经恢复的是**转场骨架、几何公式、双图材质、阴影、箭头节奏与拖拽/授权分离的语义边界**；尚未恢复的是原生窗口/拖拽、多屏与所有异常分支。此前 R1 把 reverse 放在结果注入之前，导致“成功后动画”被吃掉；这是原型顺序错误，现已改为 fixture 业务成功驱动 reverse，而不是补一个无证据的成功 glyph。

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

按对象关系可恢复的参考链路是：权限请求进入 coordinator → source probe/capture → 启动或定位 System Settings → destination capture → forward session → accessory window 接管 → 用户从 accessory 拖出 app → System Settings 接收 copy drop → coordinator 继续等待/验证 → reverse session → completion cleanup。前半段是程序自动完成的视觉 handoff，拖入列表则是用户鼠标动作；两者之间有 checked continuation 形成的硬等待边界。飞行代理与落稳后的可拖控件视觉连续，但不是同一个 live 对象：前者由 source/target 快照和每屏 replicant 构成，后者才是 Hosted AppKit drag source。

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
| Drag source | 4pt 移动阈值、Finder 风格 file URL/filename payload、56pt drag icon、cancel/fail 回弹 | 可用公开 AppKit 独立实现；这些数值不等于私有参考参数 |
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
  ├─ 区分 drag accepted 与 permission verified
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
7. **授权仍由原事务判定。** helper 的 copy drop、已有行开关、System Settings 关闭都只改变引导 session；`open_privacy_security` 返回 `retryRequested` 后，renderer 只调用一次现有 `runApply(state.pendingAction)`，只有 `ActionPayload.ok` 才是 verified。其他 typed error 退出权限链，不回到“仍需授权”；native owner 绝不直接调用 apply transaction。

### 5.3 第一版应做什么

推荐先做一个窄而真实的单权限版本：

1. `permissionRequired` AlertDialog 内展示一行 App Management 目的说明和 `Open System Settings` 动作。
2. 从这行的真实矩形生成视觉代理；如果 WebView 局部快照不稳定，第一版复制同一视觉 token 到 native proxy，而不是截整个窗口。
3. 打开 `Privacy_AppBundles`，通过 CGWindow 找到最大的可见 layer-0 System Settings window。
4. 用不激活的透明 panel 沿临界阻尼弧线路径过渡到设置窗口旁的真实 helper；坐标转换集中在 native owner，并始终保留 point/backing-pixel 分层。自动动画止于 helper，绝不能自动飞入 Apple 列表。
5. helper 显示一个真实 draggable Switcher app row，并说明“列表已有时开启；没有时拖入”；drag payload 是 app bundle file URL，取消/失败回弹，drop 时 panel 必须让出鼠标给 System Settings。
6. drag accepted 只更新引导阶段，不显示授权成功；用户返回后重试原始 Switch / Restore，只有写事务成功才进入 verified。
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
| R1 UI Review 原型 | 复用真实权限 Dialog/card 的动画场景 | 自动 handoff 只落到 helper；用户可拖 app row 到列表；drop 成功/失败、已有行、返回重试与 Reduce Motion 可独立审查；不冒充 native |
| R2 native 单屏 MVP | 独立 AppKit owner + fixed bridge | 不抢焦点；打开准确 pane；真实 file URL drag 可被设置接收；失败回弹；设置窗口移动时 helper 跟随；取消幂等 |
| R3 native 鲁棒性 | 多显示器、Space、窗口关闭/重开、目标丢失 | 无孤儿 panel、无焦点劫持、无额外权限、无崩溃 |
| R4 生产接线 | typed `permissionRequired` → handoff → retry | 只有真实事务成功才显示成功；四语目的说明进入最终包 |
| R5 packaged evidence | ad-hoc/package 实机 | 最终 Info.plist、四语资源和 bundle seal 已静态回读；仍需首次拒绝、打开设置、允许、重试成功和 Reduce Motion |

当前状态：R0/R1 已闭合；R2/R3/R4 已完成源码与编译门，R2 单屏 helper/forward/reverse/cleanup 及 R3 source 缺失/目标关闭/定位超时的原生 WindowServer 子门与 R5 最终 bundle 静态资源/签名子门已闭合。首次权限拒绝、真实 drop、业务重试、Reduce Motion、多屏/Space/热插拔仍未完成，不能被工作台、仓库外 harness、Node VM、`cargo check` 或 ad-hoc bundle 静态 readback 代替。

### 6.1 R5 packaged 人工取证协议

R5 不允许用主账户 `tccutil reset` 制造“首次授权”，也不允许 producer 自动拖放、拨开关或截取 System Settings 权限列表。`tools/macos-handoff-acceptance/record_checkpoint.js` 对 live session 强制绑定 clean-detached exact source、与执行用户不同的 source owner、当前用户精确的 `$HOME/Applications/Cavalry.app`、Switcher/Cavalry launcher/runtime SHA、厂商 Team ID 与目标语言；`permission-blocked` 仍只是观察，`retry-verified` 才回读目标 marker、strict bundle seal 和当前用户 Application Support `state.json` 的 `appPath/currentLang/operationId`。其 Swift probe 记录单调时间、Reduce Motion/Transparency、每屏 point/backing scale、前台 bundle 及 Switcher/System Settings 的无标题窗口几何，PNG 只取 Switcher 自有窗口。initialize 必须选择固定 scenario；producer 拒绝跳步、倒序与未完成 seal，seal/verify 再按场景原顺序回放 checkpoint 身份。因此，session 能证明“哪一个包在什么宿主几何下按哪条因果链呈现了什么”，不能单独读取或证明 TCC 授权。

```bash
SESSION="/Users/Shared/cavalry-handoff-<new-user>-<session-id>"
CAVALRY_APP="$HOME/Applications/Cavalry.app"
OFFICIAL_DMG="/Users/Shared/Cavalry-2.7.2-official.dmg"
OFFICIAL_APP="/Volumes/Cavalry/Cavalry.app"

# 独立用户只从只读官方 DMG 复制自己的 bundle；当前 /Applications 安装不是 English 证据。
test "$(shasum -a 256 "$OFFICIAL_DMG" | awk '{print $1}')" = \
  ff78ea40467d2aebacf354dcc73146d44d3e3f04531486f35bdfcf79e44a86b5
hdiutil attach -nobrowse -readonly "$OFFICIAL_DMG"
codesign --verify --deep --strict "$OFFICIAL_APP"
test ! -e "$CAVALRY_APP"
mkdir -p "$HOME/Applications"
ditto "$OFFICIAL_APP" "$CAVALRY_APP"
test "$(stat -f '%Su' "$CAVALRY_APP/Contents/MacOS/Cavalry")" = "$(id -un)"
codesign --verify --deep --strict "$CAVALRY_APP"

npm run record:handoff:macos -- --initialize \
  --session-dir "$SESSION" \
  --switcher-app "/path/to/Cavalry Language Switcher.app" \
  --cavalry-app "$CAVALRY_APP" \
  --scenario fresh-drop-success \
  --expected-source-commit "<exact-clean-commit>" \
  --expected-switcher-executable-sha256 "<exact-switcher-sha256>" \
  --expected-cavalry-executable-sha256 5a9860b96d398922f49e90d73819a02027c4862960b118d56619229b7810eb5d \
  --expected-cavalry-runtime-sha256 5a9860b96d398922f49e90d73819a02027c4862960b118d56619229b7810eb5d \
  --expected-vendor-team-id TB4YVNQHVC \
  --expected-language zh-Hans

# 每个命令只在独立测试用户手工达到该真实阶段后执行；阶段不能预填或倒序伪造。
npm run record:handoff:macos -- --checkpoint baseline --session-dir "$SESSION"
npm run record:handoff:macos -- --checkpoint permission-blocked --session-dir "$SESSION"
npm run record:handoff:macos -- --checkpoint helper-presented --session-dir "$SESSION"
npm run record:handoff:macos -- --checkpoint drop-accepted --session-dir "$SESSION"
npm run record:handoff:macos -- --checkpoint retry-verified --session-dir "$SESSION"
npm run record:handoff:macos -- --checkpoint reverse-complete --session-dir "$SESSION"
npm run record:handoff:macos -- --seal --session-dir "$SESSION"
npm run record:handoff:macos -- --verify --session-dir "$SESSION"
```

首次授权链必须在独立 macOS 测试用户手工完成：先执行会真实修改文件的简体中文 Switch。只有真实事务返回 typed `permissionRequired`，才记录 `permission-blocked`、观察 1200ms 阻断停顿并继续 helper；**若第一次事务直接成功，立即停止该 scenario，记录“用户域路径未触发 App Management”，不得补拍权限阶段。** 如果列表已有行则改用 `existing-row-success`；如果没有则把 helper 的真实 app row 拖到整个 System Settings 窗口。copy drop 只表示设置窗口接收了文件，完成设置后由 Retry 重放原事务，只有 marker/signature/state 收据全部通过才记录 `retry-verified` 与 reverse。拒绝、拖拽取消、目标关闭、已有行和 Reduce Motion 各用独立 session/分支记录；没有 1x/双屏硬件时明确保留未验证，不用合成坐标升级结论。

旧 schema 2 baseline `b0c784d`/`a100ea2` 与 Shared kit `b0c784d` 的身份只作为历史审计记录：其中 runbook 绑定了已修改 `/Applications/Cavalry.app`，不能代表新的官方输入或当前 recorder schema；对应旧 session/kit 目录已在新证据闭合后按精确 manifest/commit 守卫清理，不再进入 live PASS 判定。

新的隔离账户 kit 内含只读官方 `Cavalry.dmg`：SHA-256 `ff78ea40467d2aebacf354dcc73146d44d3e3f04531486f35bdfcf79e44a86b5`，厂商 Team ID `TB4YVNQHVC`，`CFBundleExecutable=Cavalry`，launcher/runtime SHA-256 均为 `5a9860b96d398922f49e90d73819a02027c4862960b118d56619229b7810eb5d`，`libExtensionLayer.dylib` 为 `747c70a2dacb945c05b594c14b8cf650ddbf15335554aa51a8a22ad10d3b7806`。该输入来自 read-only HFS mount，且无 language marker/injector residue；复制到新用户目录后仍须重新 strict codesign/owner readback。

当前最终准备提交为 `3ea2d16d7712f35751acbb3b358790181f5a4ad7`。在该 clean source 上从空 bundle 目录重建的 ad-hoc Switcher Mach-O SHA-256 为 `9387c1c71e3144f0d3579fbedb0367c774073fc715b6ba799b5582d1704cbf2e`，盖章后 DMG 为 `a4113bd27394527e9403b9a83d5e91c293dd46f9406193979f27c85fab3ff64d`；packaged 6 PASS/1 架构项按环境 SKIP、DMG layout、`400×485` window regression、构建合同 32/32、strict ad-hoc codesign 与四语用途资源 readback 全部通过。`/Users/Shared/Cavalry-i18n-r5-3ea2d16` 冻结同一 clean-detached source、同一 Switcher、官方 DMG、Node `24.20.0`（`9d050fd4…`）、schema 3 recorder wrapper 和独立用户 runbook；runbook 在 initialize 前即要求 state/marker/injector 为空，并明确首次事务直接成功时停止。

新的只读 baseline `/private/tmp/cavalry-handoff-evidence-3ea2d16` 已 seal/verify：绑定 packaged PID `12683`、上述 source/Switcher、官方 Cavalry 双 SHA/Team ID、单屏 `1710×1107pt @2x`、Switcher `400×485pt`、System Settings `740×625pt` 与 Reduce Motion/Transparency 关闭；只截 Switcher 自有窗口，`seal.json` SHA-256 为 `b9ef38b59c11fc64b7d852e3968ceb57122cdc270c9683c3e4f3a9298a6131d6`。该 baseline 与 kit 只证明候选、官方输入和独立用户执行路径已闭合；本机目前仍只有一个交互账户，因此不是首次授权 PASS。

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

- 本功能不会改变当前 tag 或 release 门；packaged 首次授权与多屏证据未闭合前不得写入发布说明或宣称可发布。
- 若后续直接移植公开 MIT 参考实现的实质代码，必须保留 copyright/许可并更新第三方 notices；仅学习公开行为后独立实现，也要在兄弟 reference 中保留 commit 与证据链以便审计。
- 仓库外二进制研究只用于行为理解和洁净室设计，不复制私有实现，也不在本开源仓库暴露具体研究对象身份。
