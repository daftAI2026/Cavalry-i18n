<!--
[INPUT]: 依赖当前 macOS 写事务与权限错误路径、Apple App Management 文档、仓库外跨应用授权动画取证和锁定版本 MIT 参考源码
[OUTPUT]: 对外提供 Cavalry-i18n macOS 权限数量结论、诚实状态机、跨应用授权动画的证据边界、洁净室架构与分阶段验收路线
[POS]: docs/roadmap 的未来交互路线；约束 App Management 授权引导但不冒充已实现的生产功能或稳定 SOP
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# macOS App Management 授权引导动画

状态: Active / Research
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
| 配置缺口 | 当前 bundle 配置没有 `NSAppBundlesUsageDescription` | 原生实现前必须补充四语目的说明并验证最终 Info.plist |

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

## 4. 参考实现的证据分层

### 4.1 仓库外参考应用：当前与历史样本的本机证据

完整对象身份、路径、摘要、内部类型与反汇编记录只保存在兄弟项目的受控 reference 文档中，不随本开源仓库分发。本路线只保留影响自身设计的中性结论。

当前样本的直接证据仍包含完整原生 shared-element transition：

- coordinator 持有权限请求、forward start、reverse completion、transition session、无动画 fallback 与真实 accessory window；
- source probe 跟踪权限行/权限动作的 layout 与所属窗口；
- capture 明确携带 `frameOnScreen + NSImage? + cornerRadius`；
- transition controller 同时持有 source 与 destination capture，不是只移动一个 live view；
- overlay 由每块屏幕的 non-key/non-main `NSPanel` replicant 组成，并持有 clipping、stroke 与三组 shadow layer/mask；
- content model 持有 source image、target image、progress、corner radius 与最大 blur 半径；
- 动画结束后由包含应用身份、权限说明、hosting view、drag delegate 与返回动作的真实 accessory UI 接管；
- 当前仍有 transition session、正向、反向与无动画分支；历史样本恢复了 preparing/presented/reversing 三阶段语义，当前具体内部枚举名称不作为本项目合同。

因此它不是视频、GIF、Lottie，也不是把 SwiftUI 视图跨进程搬进 System Settings；它用自己的 AppKit 窗口制造跨应用视觉连续性，并且不会成为 key/main window。

动画参数必须按版本分栏：

| 参数 | 当前参考样本 | 历史参考样本 | 可用结论 |
| --- | --- | --- | --- |
| spring response | 权限转场代码区域加载 `0.72` | 已确认 `0.72` | 当前为高置信；私有 helper 完整签名未恢复 |
| damping | 同一路径加载 `1.0` | 已确认 `1.0` | 当前为高置信临界阻尼 |
| arc | 存在弧高字段/参数 | 历史样本恢复过具体值 | 当前数值未知；本项目不能照抄历史常量 |
| blur | 存在 `maxBlurRadius` | 存在但曲线未知 | 只能确认效果结构 |
| shadow | 三套 layer + mask 直接存在 | 历史研究确认 | 数值、opacity、offset 未知 |
| alpha / scale / radius | 有相应几何或状态结构 | 不完整 | 当前具体曲线与数值未知 |
| 固定时长 / 60fps | 未确认 | 未确认 | 不能把公开样本参数倒灌成参考应用事实 |
| Reduce Motion | 未发现当前直接证据 | 未确认 | 我们仍必须自行正确实现降级 |

参考应用还包含另一套截图 presentation 动画。它服务于应用截图展示，不是权限行到 System Settings 的授权转场，禁止交叉套用参数。

### 4.2 公开 MIT 参考实现

仓库外已锁定一份公开 MIT 源码作为洁净室工程样本；具体项目名、commit 与许可文本保存在兄弟项目 reference 中。本项目只吸收经独立验证的公开 AppKit 行为，不建立源码依赖。

| 能力 | 源码事实 | 对本项目的意义 |
| --- | --- | --- |
| App Management | `.appManagement` 打开 `Privacy_AppBundles`，status capability 为 unsupported | 与当前 `None` 状态模型相互印证 |
| 设置窗口跟踪 | 30Hz polling；无 AX 时使用 `CGWindowListCopyWindowInfo`，已有 AX 时才加 observer | 动画本身不应要求 Accessibility |
| 浮动窗口 | borderless + nonactivating `NSPanel`，不成为 key/main，支持所有 Space | 不抢走 System Settings 焦点 |
| 飞行动画 | 60fps Timer；公开样本使用临界阻尼、alpha 与 minimum scale | 可作为低复杂度 MVP 行为参考，不能描述外部参考应用的当前参数 |
| 轨迹 | 二次 Bezier；弧高随距离 clamp | 比固定直线自然，但不是任何私有实现参数的证明 |
| 目标布局 | 跟随 System Settings 主窗口，在 trailing content 邻接 helper panel | 不需要截取或修改系统设置内容 |

公开实现的最终 panel 从点击位置飞向目标；仓库外参考应用的当前/历史样本则有源/目标图像和多屏 replicant。两者不能混写成同一种实现。

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
  ├─ cleanup / cancel / Reduce Motion
  └─ 不判断“已授权”
```

不要把实现塞进 `window_chrome.rs`。标题栏与权限 handoff 是两个独立变更理由；新的原生模块只暴露固定 permission enum 与有界 session 生命周期。

### 5.2 第一版应做什么

推荐先做一个窄而真实的单权限版本：

1. `permissionRequired` AlertDialog 内展示一行 App Management 目的说明和 `Open System Settings` 动作。
2. 从这行的真实矩形生成视觉代理；如果 WebView 局部快照不稳定，第一版复制同一视觉 token 到 native proxy，而不是截整个窗口。
3. 打开 `Privacy_AppBundles`，通过 CGWindow 找到最大的可见 layer-0 System Settings window。
4. 用不激活的透明 panel 沿临界阻尼弧线路径过渡到设置窗口旁的静态 helper；响应与弧高都作为本项目原型 token 人工裁决，不把外部历史常量写成生产真相。
5. helper 只说“在 App Management 中允许 Cavalry Language Switcher，然后返回重试”，不显示虚假的实时授权状态。
6. System Settings 关闭、目标窗口消失、显示器切换或主 app 退出时幂等清理。

### 5.3 第一版明确不做什么

- 不引入整套 Swift Package 或第二套组件库；只学习经过锁定的状态和几何。
- 不为动画请求 Accessibility、Screen Recording 或 Automation。
- 不读写 TCC 数据库，不尝试自动拨动权限开关。
- 不同时实现多权限通用框架；YAGNI，当前只有 App Management。
- 不把每屏 replicant、反向 shared-element 和完整系统设置 accessory 一次性全部堆入 MVP。

## 6. 分阶段验收

| 阶段 | 产物 | 通过条件 |
| --- | --- | --- |
| R0 证据冻结 | 本文 + 当前 Computer Use 复核 | 直接证据、公开源码、推断、产品方案四层不混写 |
| R1 UI Review 原型 | 复用真实权限 Dialog/card 的动画场景 | 文案、源元素、轨迹、结束 helper、Reduce Motion 可人工审查；不冒充 native |
| R2 native 单屏 MVP | 独立 AppKit owner + fixed bridge | 不抢焦点；打开准确 pane；设置窗口移动时 helper 跟随；取消幂等 |
| R3 native 鲁棒性 | 多显示器、Space、窗口关闭/重开、目标丢失 | 无孤儿 panel、无焦点劫持、无额外权限、无崩溃 |
| R4 生产接线 | typed `permissionRequired` → handoff → retry | 只有真实事务成功才显示成功；四语目的说明进入最终包 |
| R5 packaged evidence | ad-hoc/package 实机 | 验证最终 Info.plist、首次拒绝、打开设置、允许、重试成功和 Reduce Motion |

## 7. 验证矩阵

至少覆盖：

- 权限未知、已拒绝、用户在设置中允许、用户不允许直接返回；
- System Settings 已打开 / 未打开 / 打开后立刻关闭；
- source rect 缺失时静态降级；
- 单屏、双屏、目标窗口跨屏；
- Reduce Motion 开启；
- Cavalry 位于 `/Applications` 与明确可写自定义根；
- AlertDialog 键盘焦点仍留在正确结果界面，overlay 永不成为 key window；
- App Management 之外没有新增 TCC 请求。

## 8. 发布与许可边界

- 本路线不会改变当前 tag 或 release 门；未实现、未打包、未实机验证前不得写入发布 SOP。
- 若后续直接移植公开 MIT 参考实现的实质代码，必须保留 copyright/许可并更新第三方 notices；仅学习公开行为后独立实现，也要在兄弟 reference 中保留 commit 与证据链以便审计。
- 仓库外二进制研究只用于行为理解和洁净室设计，不复制私有实现，也不在本开源仓库暴露具体研究对象身份。
