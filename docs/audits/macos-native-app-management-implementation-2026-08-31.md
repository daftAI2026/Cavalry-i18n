<!--
[INPUT]: 依赖根 CLAUDE.md、src-tauri/CLAUDE.md、src-tauri/src/CLAUDE.md、docs/roadmap/macos-app-management-handoff-animation.md、src-tauri/Cargo.toml、src-tauri/src/lib.rs、commands.rs、commands/contract.rs、privilege/restart.rs、window_chrome.rs、Tauri 2.10.3 本地源码，以及 Apple AppKit/CoreGraphics 公开 API 文档
[OUTPUT]: 对外提供 macOS App Management handoff 原生落地的最短实施路径、九命令边界、CSS→AppKit 坐标转换、per-screen NSPanel/live NSDraggingSession 生命周期、单次 apply oracle 后的 reverse 或 restart-required cleanup、Reduce Motion/Info.plist、证据分级，以及后续 native motion surface 与箭头 overscan 修正的事实附录
[POS]: docs/audits 的 dated 原生边界审计；主体保留 2026-08-31 设计快照，附录记录当前 native owner 的窄范围修正；不修改 renderer、tools 或既有状态机，也不把未知的私有行为写成事实
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# macOS App Management 原生实施审计 — 2026-08-31

## 结论先行

**最短可维护路径是：Rust 保持事务与生命周期真相，Objective-C++ 只承载 AppKit 窗口、快照投影和真实拖拽；不引入 Swift，不增加 Tauri command，不读取或操作 TCC 数据。**

```text
renderer 局部 source rect
        │  fixed open_privacy_security command
        ▼
Rust command / session state
        │  AppHandle::run_on_main_thread
        ▼
Objective-C++ AppKit shim
  ├─ fixed Privacy_AppBundles URL
  ├─ source/target geometry + per-screen non-key NSPanel
  ├─ live accessory + NSDraggingSession(file URL)
  └─ callback: retryRequested / dismissed / error
        │
        ▼
现有 apply_language 写事务
  ├─ permissionRequired：helper 保留，不宣称成功
  ├─ ok == true：触发 reverse，再幂等 cleanup
  └─ 其他 error：按错误语义 reverse/cleanup
```

这份报告的主体是 **2026-08-31 的审计和实施设计快照**，不是当日原生功能已落地的证明；截至该快照，当前分支没有 native handoff 源文件，本轮只在隔离 worktree 新增本报告和文档地图项，不触碰主工作区正在修改的 `renderer/`、`tools/` 或既有 roadmap。后续 native owner 已在当前分支落地；2026-09-01 的动画几何修正与当前证据边界见同目录的本附录末尾及 `docs/roadmap/macos-app-management-handoff-animation.md`，不回写成 8 月 31 日已经取得的实机证据。

## 1. 审计边界与证据等级

### 1.1 本轮实际核对

- 根 `CLAUDE.md`、`src-tauri/CLAUDE.md`、`src-tauri/src/CLAUDE.md`。
- 当前工作区的 `docs/roadmap/macos-app-management-handoff-animation.md`；该文件在主工作区有未提交改动，本报告不覆盖、不回滚。
- `src-tauri/Cargo.toml`、`Cargo.lock`、`build.rs`、`tauri.conf.json`、`tauri.macos.conf.json`。
- `src-tauri/src/lib.rs`、`bridge.rs`、`commands.rs`、`commands/contract.rs`、`commands/status.rs`、`privilege/restart.rs`、`window_chrome.rs`、macOS apply/runtime/transaction 模块。
- 当前仓库的 Objective-C++/Swift 仅限 injector 和 acceptance producer；Tauri 产品壳目前没有 `.mm`/`.swift` 编译入口。
- 本机 Tauri 2.10.3、`tauri-build` 2.5.6、`objc2-app-kit` 0.3.2、Xcode macOS 27 SDK 的公开头文件。

### 1.2 证据分层

| 等级 | 已确认内容 | 可以说什么 | 不能说什么 |
| --- | --- | --- | --- |
| 仓库代码 | 只有 `open_privacy_security` 固定打开 `Privacy_AppBundles`；App Management probe 在 macOS 返回 `None`；写事务返回 typed `permissionRequired`；产品只注册九个 command | 写事务是当前真实权限 oracle；现有窗口桥只有交通灯 | 不能说已有 handoff、NSPanel 或原生拖拽 |
| Apple 公开 API | `NSView.beginDraggingSession`、`NSDraggingSession`、`NSPanel`/nonactivating style、`NSWindow` screen conversion、`CGWindowListCopyWindowInfo`、`NSWorkspace` Reduce Motion/Transparency | 可以用公开 AppKit/CoreGraphics API 独立实现 | 不能从公开 API 推断系统设置内部 row 的命中或授权状态 |
| 匿名参考样本 | 观察到 source/target capture、一次 forward/一次 reverse、per-screen non-key/non-main replicant、落稳后 live accessory | 可以把这些作为洁净室行为目标 | 不能声称知道其私有 capture API、内部类、精确成功回调或所有 OS 分支 |
| 当前本机 | 单块内置 2x、60Hz，主账户已有相关授权/辅助状态 | 可做静态编译和单屏 point 几何验证 | 不能宣称首次授权、1x、多屏、120Hz、全量 live 通过 |

## 2. 当前代码事实与硬边界

### 2.1 九命令必须保持原样

`src-tauri/src/commands/contract.rs` 的 `COMMAND_NAMES` 当前且必须继续是：

```text
get_status
browse_app
apply_language
open_privacy_security
open_project_link
show_about
restart_cavalry
check_update
install_update
```

落地 handoff 只扩展 `open_privacy_security` 的参数/返回 DTO，并在既有 `apply_language` 内部通知 handoff owner；**不得新增 `start_permission_handoff`、`retry_permission`、`finish_permission_handoff` 等第十条命令**。

### 2.2 已有职责不能互相吞并

- `window_chrome.rs` 只负责 macOS Overlay 标题栏交通灯对齐；不要把权限动画塞进去。
- `privilege::open_privacy_security` 只负责固定 `x-apple.systempreferences:...Privacy_AppBundles` URL；不要让原生动画层接受任意 URL，也不要让它负责授权判断。
- `apply_language` 继续拥有关闭 Cavalry、snapshot/baseline、写入、runtime、重启和 typed `ActionPayload`；它是唯一可以把 `permissionRequired` 转为 `verified` 或再次失败的边界。
- `bridge.rs` 继续是 renderer bridge 的 Rust include 真相源；后续 renderer/bridge 改动由主代理单独完成，本审计不改。
- `tools/macos-acceptance/` 是 acceptance producer，不应被复用为产品运行时；现有 Swift `cgwindow_exact` 也不是产品 handoff 入口。

### 2.3 现有依赖和构建缺口

- `objc2-app-kit = 0.3.2` 目前只启用了交通灯所需的 `NSButton/NSControl/NSView/NSWindow` 最小 feature。
- `core-graphics = 0.25.0` 出现在锁中，但当前不是 `Cargo.toml` 的直接依赖；R2 不应依赖 Tauri 偶然带入的传递依赖。
- `cc` 已在锁中，但当前不是本 crate 的直接 build dependency；若采用 `.mm`，必须在 `Cargo.toml` 直接精确声明，不能把锁中的传递版本当作合同。
- `src-tauri/build.rs` 目前只调用 `tauri_build::build()` 并生成 Windows source provenance，没有编译产品 `.mm`/`.swift` 的路径。
- Tauri macOS 配置当前没有 `bundle.macOS.infoPlist`，也没有 `NSAppBundlesUsageDescription` 或四语 `InfoPlist.strings` 的资源映射。

## 3. 方案裁决：Objective-C++ shim，不用 Swift

### 3.1 为什么选 Objective-C++

这是当前仓库的最短路径，而不是语言偏好：

1. AppKit、CoreGraphics、NSDragging 的公开头文件天然是 Objective-C API；`.mm` 可以直接实现 `NSPanel`/`NSView` 子类和 `NSDraggingSource`，不需要 Rust `objc2` 的自定义 class/protocol 宏和大量 `unsafe` 生命周期代码。
2. 仓库已有 Objective-C++ 构建经验、Xcode/clang++ 工具链和 AppKit 运行时；缺口只是把一个小 shim 接入 Tauri build。
3. Swift 会新建第二套产品语言/链接路径。当前 Swift 只用于 acceptance helper；把 Swift runtime 和 `swiftc` deployment 规则带进 Tauri bundle，会增加签名、部署目标和 CI 变量，不是当前最短路径。
4. 纯 Rust `objc2` 不是不可行，但需要扩展多个 AppKit feature、声明 `NSPanel`/dragging protocols、自定义 subclass、处理 main-thread actor 与对象所有权；它适合后续若要完全消除 native shim 的独立重构，不适合这次窄功能。

**结论：没有新增 Swift 文件。** Objective-C++ 只负责 AppKit；Rust 仍负责 session id、typed result、任务事务和文档可测试边界。

### 3.2 计划中的文件变更

以下是截至 2026-08-31 审计快照中规划的文件清单；该快照分支不创建其中的源文件。后续实际落地文件不改变本节对职责边界的分析。

| 文件 | 动作 | 单一职责 |
| --- | --- | --- |
| `src-tauri/src/macos_permission_handoff.rs` | 新增 | Rust session owner、请求校验、主线程调度、typed callback、apply 结果路由、generation/idempotent cleanup |
| `src-tauri/native/macos_permission_handoff.h` | 新增 | 极小 `extern "C"` opaque ABI；只暴露固定 App Management session，不暴露任意 URL/系统开关 |
| `src-tauri/native/macos_permission_handoff.mm` | 新增 | AppKit `NSPanel`/`NSView` 子类、source capture、per-screen replicant、System Settings window metadata、live drag、动画帧和原生 cleanup |
| `src-tauri/build.rs` | 修改 | macOS target 下以 `cc::Build` 编译 `.mm`，声明 AppKit/Foundation/CoreGraphics/QuartzCore 链接与 rerun 依赖；非 macOS 不触发 |
| `src-tauri/Cargo.toml` | 修改 | 直接锁定 macOS build dependency `cc`；只有在纯 Rust 方案被选中时才扩展 `objc2-app-kit` feature |
| `src-tauri/Cargo.lock` | 生成修改 | 记录直接 build dependency 的精确解析结果，不手改 |
| `src-tauri/src/lib.rs` | 修改 | 声明模块、`manage` session state、在退出事件清理；invoke handler 仍是同九项 |
| `src-tauri/src/commands.rs` | 修改 | 将现有 `open_privacy_security` 扩展为 async request/typed outcome；在已有 `apply_language` 返回真实结果后通知 owner |
| `src-tauri/src/commands/contract.rs` | 修改 | 增加 handoff DTO/outcome 的稳定 camelCase 合同；不改变既有 `ActionPayload` 成功/权限语义 |
| `src-tauri/tauri.macos.conf.json` | 修改 | 指定 `bundle.macOS.infoPlist`，将四语 `.lproj/InfoPlist.strings` 映射到最终 `Contents/Resources` 根 |
| `src-tauri/Info.plist` | 新增 | 只放 Tauri 默认 plist 的增量，至少包含 `NSAppBundlesUsageDescription` |
| `src-tauri/macos-resources/{en,zh-Hans,zh-Hant,ja}.lproj/InfoPlist.strings` | 新增 | 系统权限目的说明的四语原生资源；不放入 Cavalry `languages/` |
| `src-tauri/tests/macos_permission_handoff_contract.rs` | 后续新增 | 只读验证 DTO、九命令、请求边界和无 TCC 写入；native live 仍单独列为 ignored/manual |

以下文件**明确不应因 handoff 修改**：`src-tauri/src/window_chrome.rs`、`src-tauri/src/privilege/restart.rs` 的固定 URL 语义、`injector/`、`tools/macos-acceptance/`。renderer/bridge 的最小接线属于后续主代理工作，不在本审计分支内。

## 4. 九命令内的 Rust 接线

### 4.1 `open_privacy_security` 的返回类型

当前命令是无参数同步 `fn open_privacy_security() -> ActionPayload`。最短且语义不混乱的目标是：

```text
open_privacy_security(
    app: AppHandle,
    request: PermissionHandoffRequest,
) -> PermissionHandoffPayload
```

`PermissionHandoffRequest` 只接受：

```text
kind: "appManagement"       // 固定枚举，不接受任意 URL
sourceRect: { x, y, width, height }
viewportCss: { width, height }
```

可选的视觉字段（例如 radius）必须有明确 token 合同；如果 native 使用项目固定 token，就不要把重复的魔法数字从 renderer 传进来。所有数字都要求 finite、非负、尺寸大于零、落在 viewport 内，并设上限，拒绝 NaN、Infinity、负数和超大值。

返回 DTO 建议独立于 `ActionPayload`：

```text
outcome: "retryRequested" | "dismissed" | "error"
errorCode?: "handoffUnavailable" | "settingsWindowNotFound" | "handoffCanceled"
```

原因是 `ActionPayload.ok` 代表写事务是否成功；把“设置窗口已经打开”或“用户请求重试”编码成 `ok` 会让 renderer 把引导阶段误当成业务成功。DTO 可以保留一个 `started` 内部状态，但不要把它伪装成 permission granted。

### 4.2 不建立全局 event bus

- Rust command 创建**本次请求专属**的 waiter/callback context。
- `run_on_main_thread` 内取得 `main` 的 native `NSView*`/`NSWindow*`，调用 C shim start；AppKit 对象始终只在 main thread 创建和销毁。
- command 在 native session 结束、用户明确 retry、取消或失败时返回 typed outcome。若使用标准 channel 等待，不要在 async command 直接 `recv()`；把阻塞等待放进 `spawn_blocking`，避免占住 Tokio executor。
- native callback 只回传 `retryRequested/dismissed/error`，不能直接调用 `apply_language`。用户意图回到既有 renderer，既有 `apply_language` 继续是唯一写事务入口。
- session 的 native owner 不能只跟随 command future 的栈生命周期；command 返回后仍可能需要等待 apply 结果。因此 native registry 以内部 `sessionId/generation` 保留 coordinator，直到 `apply result` 或 cancel terminal。

### 4.3 `apply_language` 是唯一成功 oracle

在现有 `apply_language` 的业务结果已经生成后，增加一个**内部 Rust 调用**，不是新 command：

```text
ActionPayload.ok && !permissionRequired
        └─ verified：handoff.finish_success(sessionId)

!ok && permissionRequired
        └─ permission-still-missing：cleanup helper，Activity 收敛为 restart-required

!ok && !permissionRequired
        └─ typed-error：reverse/cleanup，再把既有错误交给 renderer
```

`ok == true` 包含“写入成功但重启有 warning”的现有语义；warning 不应阻止 reverse，因为真实写事务已经提交。`permissionRequired` 仍只表示真实写事务被 macOS 权限边界阻断，drag/drop、窗口出现、计时器结束都不是授权证明。

`finish_success` 只排队到 AppKit 主线程，不在 `spawn_blocking` 线程直接碰 `NSPanel`。若没有活动 handoff session，它是 no-op；这样普通 Apply/Restore 不会被原生动画 owner 绑架。

## 5. CSS WebView rect → AppKit screen rect/point

### 5.1 输入定义

`getBoundingClientRect()` 返回 CSS viewport 坐标：原点左上、y 向下、单位 CSS px。必须在 renderer 关闭 Dialog/modal **之前**冻结 source rect。renderer 不计算全局屏幕坐标，不加标题栏高度，不乘 Retina 比例。

native 必须同时收到 CSS viewport 宽高，原因是“CSS px → native point”不能靠一个写死的 `devicePixelRatio` 猜。若 viewport 与 native view bounds 的比例不稳定，直接静态 fallback，而不是猜一个缩放。

### 5.2 AppKit 转换算法

所有 AppKit 调用在主线程执行，使用 Tauri 当前已存在的 `WebviewWindow::ns_view()` 和 `ns_window()`：

```text
1. 校验 cssRect / viewportCss 全部 finite、非负、在 viewport 内。
2. webViewBounds = [webView bounds]，读取 [webView isFlipped]。
3. sx = webViewBounds.width  / viewportCss.width
   sy = webViewBounds.height / viewportCss.height
   若 sx/sy 非正、相差超过容差或 rect 映射越界：静态 fallback。
4. localRect.size = { cssWidth * sx, cssHeight * sy }
5. localRect.origin.y =
     isFlipped ? cssY * sy
               : webViewBounds.height - (cssY + cssHeight) * sy
   localRect.origin.x = cssX * sx
6. windowRect = [webView convertRect:localRect toView:nil]
7. screenRect = [window convertRectToScreen:windowRect]
8. 用 screenRect.origin + size 作为 source frameOnScreen；只在最后
   为 bitmap backing 需要时调用 [window convertRectToBacking:...]
```

`convertRect:toView:nil` 让 AppKit 按实际 view/window 层级处理 Overlay 标题栏、content view 和 flippedness；随后 `convertRectToScreen:` 才进入 AppKit screen point。这里不能复用 `window_chrome.rs` 的 `TITLEBAR_HEIGHT`，也不能手动补 40px/22px。AppKit 的 `frame`/screen rect/圆角/阴影都是 point；backing pixel 是另一个层。

### 5.3 source snapshot

第一版只捕获自家 WebView source view：公开的 `bitmapImageRepForCachingDisplayInRect:` + `cacheDisplayInRect:toBitmapImageRep:` 可作为起点。若 source view 无法稳定缓存，则绘制同一设计 token 的 native proxy；不要截取完整 Switcher，也不要把 System Settings 像素当作自己的 target 资源。

源快照记录：

```text
{ frameOnScreen(point), image, cornerRadius(point), displayID, backingScale }
```

图片用于视觉代理；frame/radius/scale 用于几何和证据记录。不要把 `devicePixelRatio` 直接当成 AppKit frame 缩放因子。

### 5.4 System Settings window 的公开 metadata

仍调用现有固定 URL 打开 `Privacy_AppBundles`，然后用 `CGWindowListCopyWindowInfo` 有界轮询公开窗口字典：

- 先从 `NSRunningApplication`/运行窗口现场绑定 System Settings PID；不要只凭窗口标题。
- 过滤当前用户 session、可见、非零 bounds、`kCGWindowLayer == 0`，并记录 `kCGWindowNumber`、PID、bounds、display id/时间戳。
- `CGWindowListCopyWindowInfo` 本身不给出可直接信任的 display id；display id 必须由 bounds 与 `CGDisplayBounds`/`NSScreen.frame` 的交叠配对计算，不能从窗口标题或全局屏幕尺寸臆造。
- 选目标窗口后，只用其几何 metadata 计算 helper target；不读取内部 AX row，不自动点击开关，不请求 Accessibility/Screen Recording/Automation。
- 找不到目标或目标关闭时，保留固定设置 URL 的业务能力，动画退化为静态 helper。

Quartz 窗口 bounds 是以主显示器左上为原点；AppKit `NSScreen.frame` 是屏幕坐标下的左下原点。跨屏转换应按**交叠面积最大**的 `NSScreen`/`CGDisplayBounds` 配对：

```text
cgLocalX = cgRect.origin.x - displayBounds.origin.x
cgLocalY = cgRect.origin.y - displayBounds.origin.y
appKitX  = screen.frame.origin.x + cgLocalX
appKitY  = screen.frame.origin.y + screen.frame.height
           - cgLocalY - cgRect.height
```

这里的 `screen.frame.origin` 可能为负；绝不能拿一个全局“总屏幕高度”做 y 翻转。helper frame 最终用目标屏的 `visibleFrame` clamp，避免覆盖菜单栏/Dock。跨屏横跨时，各屏 slice 都保留自己的 `displayID`、point frame、backing scale 和 color space。

## 6 per-screen non-key NSPanel snapshot replicant

### 6.1 panel 创建合同

在 AppKit main thread，为运动区域与每块 `NSScreen.frame` 求交，非空才创建一扇 panel：

```text
styleMask = NSWindowStyleMaskBorderless
          | NSWindowStyleMaskNonactivatingPanel
backing   = NSBackingStoreBuffered
defer     = NO
```

每扇 panel 都应满足：

- `NSPanel` 子类覆写 `canBecomeKeyWindow` 和 `canBecomeMainWindow` 为 `NO`。
- 使用 `orderFront:`，绝不 `makeKeyAndOrderFront:`。
- `opaque = NO`、透明背景、`hasShadow = NO`；阴影/stroke/mask 由自己的 layer/view 绘制，避免 AppKit 额外阴影改变几何。
- 快照 panel `ignoresMouseEvents = YES`；只有 live accessory panel/row 接收事件。
- `releasedWhenClosed = NO`，所有 panel 由 coordinator 显式持有；结束时 `orderOut`、清 content view/image/layer，再释放。
- 使用最低足够的公开 window level（R2 先验证 `NSFloatingWindowLevel`）；不得使用 modal/screen-saver 等抢焦点层。
- R3 才在多 Space/full-screen 证据下启用 `canJoinAllSpaces`/`fullScreenAuxiliary` 等 collection behavior；不要未经验证把 helper 放到所有应用/所有 Space。

### 6.2 replicant 的内容模型

所有 panel 共享同一个 coordinator model，但每扇只绘制 `motionRect ∩ screen.frame`：

```text
SharedTransitionModel
  sourceImage / targetProxy
  sourceFrame / targetFrame
  progress p in [0, 1]
  sourceOpacity = 1 - p
  targetOpacity = p
  sourceRadius / targetRadius
  blurRadius (最多使用已观测的样本参数；不是通用 Apple 常量)

ScreenReplicantPanel[i]
  screenID / backingScale / sliceFrame
  layer mask / stroke / shadow
```

匿名参考样本确实显示 source/target shared-element 和 per-screen replicant；但具体私有 capture、材质和 shadow implementation 未知。洁净室实现只复用可观察行为与公开 API，不复制私有类名、私有 selector 或系统设置截图。

帧驱动先用 main-thread、时间驱动的 `NSTimer` 做单屏 MVP；进度由 monotonic elapsed time 算，不按“第 N 帧”算。R3 若需要 120Hz/显示器同步，再把帧时钟替换为公开 CoreVideo display link，状态模型不变。当前机器只能证明 60Hz，不能以模拟 120fps 作为实机证据。

### 6.3 forward / reverse

- forward 只运行一次：source snapshot 从源 rect 向 target geometry 过渡，落稳后把 live accessory 接管。
- reverse 只运行一次：真实 apply 成功后，从 helper/current target geometry 回到原 source rect；若 target 窗口已消失，使用最近有效 geometry 或静态收口，不制造“成功”假象。
- `spring response/damping`、apex、blur 等只按已锁定样本作为初始调参；除非有本项目自己的视觉证据，不要把它们写成系统 API 保证。
- reverse completion 是 cleanup，不另造未经证据支持的 checkmark/烟花。

## 7 live accessory 与真实 NSDraggingSession

### 7.1 accessory 不是截图

落稳后创建/显示一个独立的 live accessory panel/view。它是 `NSView`，有自己的文字/图标/布局和 `NSDraggingSource`，不是 source snapshot 的最后一帧，也不是 `CGWindowListCreateImage` 截图。

accessory panel 仍是 borderless + nonactivating；但它的 row hit area 必须 `ignoresMouseEvents = NO`，否则用户无法开始 drag。snapshot panel 保持忽略鼠标。

### 7.2 file URL drag

`mouseDown:` 只记录事件和起点；超过小的位移阈值后构造真实 file URL pasteboard：

```text
bundleURL = [[NSBundle mainBundle] bundleURL]
pasteboardWriter = bundleURL
item = NSDraggingItem(pasteboardWriter)
item.draggingFrame = row-local icon/text frame
item.image = app icon / native drag image
session = [row beginDraggingSessionWithItems:@[item]
                                        event:event
                                       source:row]
session.animatesToStartingPositionsOnCancelOrFail = YES
```

`NSDraggingSource` 至少实现 `sourceOperationMaskForDraggingContext`，先按真实实机结果允许最小 operation（通常先验证 `.copy`，不把它预写成授权保证）；实现 `willBeginAtPoint`、`movedToPoint`、`endedAtPoint:operation:`。dragging session 必须由 ObjC++ owner 强引用到结束，不能让 row 释放 source。

匿名参考样本的公共行为是“用户从 live accessory 把 app 拖入整个 System Settings 接收窗口”，不是拖到我们预设的某个 CSS 坐标。helper 在 drag 开始时隐藏/让出鼠标事件，使 System Settings 成为 drop destination；不要在本应用 panel 里拦截 drop。

### 7.3 drop 与授权严格分离

`endedAtPoint:operation:` 的非 `NSDragOperationNone`（例如 `.copy`）只能记为 `appDropAcceptedCandidate`：

- 它表示 AppKit 报告了一个候选 drag operation。
- 它不表示系统 App Management 列表已经写入。
- 它不表示当前用户授权已存在。
- 用户把 app 放在错误位置、取消 drag、设置窗口关闭，都必须有取消/失败回弹或静态 fallback。
- App 已在列表时，用户可以手动开启；没有 AX 证据时，不要向用户声称我们已经探测到“已有行”。

drop accepted 后只允许 renderer 调用一次原有 `apply_language` 作为同进程 oracle。若再次返回 typed `permissionRequired`，当前进程不能继续 Retry：必须 cleanup helper，在 Activity 链尾提示重新打开语言切换器，不持久化或自动续跑旧任务。

## 8 真实 apply 结果驱动 reverse/cleanup

### 8.1 生命周期

```text
Idle
  → SourceFrozen
  → SettingsOpened
  → TargetLocated | StaticFallback
  → ForwardAnimating
  → AccessoryReady
  → Dragging
  → AwaitingApply
  → Applying (existing apply_language, not native)
  → Verified | PermissionStillMissing | TypedError
  → ReverseAnimating | KeepHelper | StaticError
  → Cleaned
```

每次 session 分配单调 `generation`。所有 callback、timer、window observer 和 apply result 都先比对 generation；旧 session 不能清理新 session 的 panel。

### 8.2 成功

`apply_language` 在现有写事务和重启阶段完成后得到 `ActionPayload.ok == true`：

1. Rust 将 `finish_success(generation)` 排到 AppKit main thread。
2. native coordinator 重新采集当前 helper/target geometry；不使用旧的 System Settings frame 猜位置。
3. 共享 transition `p: 1 → 0`，source 是 helper/live accessory 的视觉代理，destination 是原始 Switcher source snapshot。
4. reverse 完成后关闭所有 panel、清除 images/layers、移除 window observer/timer/drag delegate、释放 callback context。
5. renderer 继续显示既有真实完成 Event；native 不额外捏造“权限已授予”文案。

如果 `ok == true` 但有 `restartFailed` 等现有 warning，仍 reverse；warning 是已提交事务后的可恢复结果，不是权限失败。

### 8.3 仍缺权限、其他错误和取消

- `permissionRequired`：不 reverse、不清掉 helper 的等待上下文；保留重试路径，向 renderer 返回既有 typed error。
- 其他 typed error：不归因于权限；按错误语义 reverse/cleanup，再让既有 Activity/Alert 表现错误。
- drag cancel/fail、System Settings 关闭、目标消失、窗口退出：所有 cleanup 幂等；有 source 就回弹，没有 source 就静态收口。
- native owner 绝不修改 Cavalry、调用 apply、写 TCC、点击系统开关或关闭 System Settings。
- App 退出时先取消 generation，再在 main thread `orderOut`/释放 panel；退出路径不能留下悬挂 non-key window。

## 9 Reduce Motion、Transparency 和 Info.plist

### 9.1 无障碍降级

session 开始时读取 `[[NSWorkspace sharedWorkspace] accessibilityDisplayShouldReduceMotion]`，并监听 `NSWorkspaceAccessibilityDisplayOptionsDidChangeNotification`：

- Reduce Motion 为真：不做大幅 source→target 飞行、不做 blur/arrow loop，直接打开固定设置页并呈现静态 helper；仍保留真实 file URL drag 和真实 apply retry。
- Reduce Transparency 为真：helper/proxy 使用不透明背景，不依赖半透明层传递结构。
- Differentiate Without Color/Increase Contrast：颜色不能承担唯一状态，保留形状、图标和文字差异。
- Reduce Motion 的具体私有样本分支未知；这里是遵循 Apple 公开无障碍要求的本项目产品决策，不声称复刻了样本私有行为。

Apple 公开头文件明确要求 Reduce Motion 时避免大型动画；因此“把 duration 缩短一点”不算完整降级。

### 9.2 Tauri Info.plist

Tauri 2 的 `bundle.macOS.infoPlist` 支持把自定义 plist 合并到默认 plist；当前仓库尚未使用。未来配置建议：

```json
{
  "bundle": {
    "macOS": {
      "infoPlist": "Info.plist",
      "files": {
        "macos-resources/en.lproj/InfoPlist.strings": "Resources/en.lproj/InfoPlist.strings",
        "macos-resources/zh-Hans.lproj/InfoPlist.strings": "Resources/zh-Hans.lproj/InfoPlist.strings",
        "macos-resources/zh-Hant.lproj/InfoPlist.strings": "Resources/zh-Hant.lproj/InfoPlist.strings",
        "macos-resources/ja.lproj/InfoPlist.strings": "Resources/ja.lproj/InfoPlist.strings"
      }
    }
  }
}
```

`src-tauri/Info.plist` 只需要声明真实、简短的 `NSAppBundlesUsageDescription`；它不会授予权限，也不能替代真实写事务。`.lproj/InfoPlist.strings` 必须在最终 app 的 `Contents/Resources` 根下，不能混进 Cavalry 的 `languages/`。

打包后必须 readback，而不是只检查源码：

```bash
APP="src-tauri/target/release/bundle/macos/Cavalry Language Switcher.app"
plutil -p "$APP/Contents/Info.plist"
find "$APP/Contents/Resources" -path '*/InfoPlist.strings' -print
codesign --verify --deep --strict "$APP"
```

若 Tauri resource mapping 在某个 CLI 版本下改变，必须以 `Contents/Resources/<lang>.lproj/InfoPlist.strings` 的最终产物为准；不能因为 build 退出 0 就声称系统文案已本地化。

## 10 已证实、未知与禁止臆造

### 已证实

- 当前 macOS 代码没有可靠只读的 App Management grant probe；状态为 unknown，真实写事务才是 oracle。
- 当前固定 URL 指向 App Management pane；正常写入不是通过新增通用 privileged-file entitlement 完成。
- `NSPanel` borderless/nonactivating、`NSDraggingSession` file URL drag、`NSWindow` screen conversion、`CGWindowListCopyWindowInfo` metadata、`NSWorkspace` Reduce Motion 都有公开 API 支持。
- 观察到的 handoff 语义是“程序自动把视觉代理交给 helper；用户再从 live app row 手动拖入 System Settings；真实 apply 成功后 reverse”，不是程序自动拨动系统开关。
- 截至本审计快照，当前产品没有原生 handoff 实现，也没有 Swift 产品编译路径；当前分支的后续落地使用 Objective-C++，没有引入 Swift 产品编译路径。

### 未知

- System Settings 当前 OS 版本对 app bundle drop 的精确 operation、命中区域、失败回调和 UI 文案；必须在 disposable 账户/安装上 R5 实测。
- 匿名参考样本的私有 snapshot/capture API、内部类、确切 target capture 内容、所有成功时序与窗口 level。
- 非激活 panel 在不同 Space、全屏、窗口移动和外接显示器下的所有 AppKit 细节。
- `NSRunningApplication`/window metadata 在新系统中对 System Settings 的最佳绑定策略；PID 必须运行时重新发现，不能写死旧 PID。
- 当前主机不能证明干净首次授权、1x、多屏/负坐标、120Hz 和已授权/未授权所有分支。

### 明确禁止

- 不调用私有 AppKit API，不反编译后复制私有 selector/class。
- 不对 System Settings 做 Screen Recording 截图、伪造系统权限列表或自动 UI 点击。
- 不写 TCC 数据库，不添加 Accessibility、Screen Recording、Automation 权限来“补成功”。
- 不把 drag operation、窗口出现、动画完成、截图相似度当作 permission granted。
- 不把当前单屏本机结果写成 macOS 全版本、多屏、120Hz 或 packaged release 证据。

## 11 分阶段实施与验收

### R2：单屏 native MVP

1. 先加 `.mm`/C ABI、`cc` build hook，完成无 UI 的 compile/link。
2. 加 Rust session state 和固定 command DTO；验证九命令列表不变。
3. 接入 source rect conversion；缺 rect 时仍能打开设置并显示静态 helper。
4. 实现一个 non-key/non-main panel + live file URL drag；不做跨屏承诺，不自动切换权限。
5. 让 `apply_language` 的真实结果驱动 finish；验证 success reverse、permission-still-missing cleanup + restart-required，以及 error/cancel 幂等 cleanup。
6. 加 Info.plist merge/四语资源，并 readback 最终 app。

### R3：鲁棒性

- per-screen slice、负坐标、窗口跨屏、Space/full-screen、目标窗口移动/关闭/重开、显示器热插拔。
- Reduce Motion/Transparency 动态切换。
- 取消/退出不留孤儿 panel、不抢 key/main、不增加 TCC 请求。

### R4/R5：生产接线和证据

- 只允许 typed `permissionRequired → handoff → existing apply_language`。
- 独立账户/外置安装验证“列表已有只需开启”和“列表没有需要拖入”两分支。
- 记录 point frame、display id、backing scale、时间戳、drag operation、真实 ActionPayload，不保存私密系统截图或 TCC 数据库。
- 只有 packaged app 的 Info.plist、签名、首次拒绝、用户允许、重试成功和 Reduce Motion 都有独立证据，才可以把原生 handoff 写入 release 结论。

## 12 关键风险

| 风险 | 后果 | 最短缓解 |
| --- | --- | --- |
| 把 `ok` 用在 handoff “已打开”上 | renderer 误报成功 | handoff 使用独立 `outcome` DTO |
| command future 持有 AppKit 对象 | 跨线程崩溃/孤儿 panel | ObjC++ main-thread registry + generation；Rust 只持 typed state |
| 手工加 titlebar/Retina 偏移 | 不同缩放/Overlay 全部漂移 | native `convertRect` + screen/backing 分层 |
| 把 `CGWindow` metadata 当授权 | 假阳性 | 只有 `apply_language` 的 typed result 能 verified |
| panel 抢 key/main 或挡住 drop | 用户无法拖入 System Settings | nonactivating subclass、snapshot ignores mouse、drag begin 即让出 panel |
| 把系统设置截图当 target | 隐私/权限/分发边界失控 | target 只取公开几何，自绘 proxy |
| `InfoPlist.strings` 放错目录 | 系统权限文案仍是默认语言 | 最终 `Contents/Resources` readback |
| 直接引入 Swift | 额外 runtime、签名、deployment 复杂度 | 当前版本只用 ObjC++；Swift 留给独立后续重构 |
| 只测当前主机 | 把单屏 2x 误写成全平台通过 | R2/R3/R5 分阶段，证据按能力分级 |

## 13 2026-09-01 原生动画修正附录

本附录只记录当前分支对 `src-tauri/native/macos_permission_handoff.m` 的窄范围修正；它不改变九命令、权限状态机、renderer 接线或真实写事务 oracle，也不把静态合同当成新的 packaged live 证据。

### 13.1 表层与阴影的几何 owner

此前 `CAVReplicantView` 把 source/target `NSImageView` 放在根 view 下，把 destination/key/ambient shadow 和 stroke 作为根 layer 的兄弟对象。它们虽然在同一方法里收到相同的 frame 数值，但分属不同的坐标/裁切 owner；当每屏 panel 在本地坐标裁切或 layer 发生 rasterization 时，表层与阴影可能出现不同步或错位。

当前实现新增一个 `motionSurfaceView`：

- 外层 replicant 只移动 `motionSurfaceView.frame`；
- 两张 image view、三层 shadow 和 stroke 都挂在该 surface；
- 所有子对象使用 `motionSurfaceView.bounds`，shadow path 也由同一 bounds 生成。

因此表层、阴影和描边共享同一个运动 frame 与生命周期。该结论来自源码结构和新增 native contract test，不等于已完成所有显示器倍率的像素级 readback。

### 13.2 箭头 overscan 与已锁定节奏

参考研究已锁定箭头 `28×28` 视觉尺寸、`scaleX=1.15`、`scaleY=1.6`、`mass=1 / stiffness=200 / damping=11`、初始等待 `0.5s`、stretch `0.25s`、空闲 `4s`、视觉上移 `10pt`，以及黑色 `0.23 / radius 7 / y 4` 阴影。此前 native child panel 仍是紧贴 glyph 的 `28×28`，最大 stretch 和 shadow 会越出 panel 上边界，所以出现箭头上半部被裁切。

当前实现保留 spring/stretch/shadow 参数，只改变承载几何：canvas 宽度为 `ArrowSize + 2 × shadowRadius`，高度为最大 `scaleY` 高度加上上下 shadow overscan；glyph 放在 canvas 内，layer 以底边为 anchor，箭头 shadow 跟随同一 glyph layer。panel 不再用 `28×28` 紧框裁切，最大 stretch、横向 shadow和上下 shadow 都有自己的透明余量。2026-09-02 真机截图又证明：研究中的 `-10pt` 视觉关系不能作为第二次 screen-space 位移叠到项目已锁定 helper 坐标上。修正后先固定原始 `glyphScreenX/Y`，再仅向四周扩展透明 panel；静止 glyph 与 overscan 前完全同位，避免“为防裁切反而把初始箭头上移”的坐标 owner 错误。

这仍是洁净室实现：只复用研究对象可观察的节奏、位移、曲线和公开 AppKit/Core Animation 行为，不复制仓库外的私有 raster。新增 `macos_permission_handoff_contract.rs` 静态合同锁定上述常量、bottom anchor、overscan 公式、shadow 同层和 `settlingDuration`；真实 macOS 首次授权、多屏/混合倍率与 packaged 像素 readback仍按 roadmap 的 R3/R5 边界执行。

## 参考资料

- Apple [`NSView.beginDraggingSession(with:event:source:)`](https://developer.apple.com/documentation/appkit/nsview/begindraggingsession%28with%3Aevent%3Asource%3A%29)：真实 `NSDraggingSession` 的启动入口。
- Apple [`NSDraggingSession`](https://developer.apple.com/documentation/appkit/nsdraggingsession)：dragging pasteboard、当前位置和取消/失败回弹属性。
- Apple [`NSWindow`](https://developer.apple.com/documentation/appkit/nswindow)：window frame、screen conversion、backing scale。
- Apple [`NSWindow.StyleMask.nonactivatingPanel`](https://developer.apple.com/documentation/appkit/nswindow/stylemask-swift.struct/nonactivatingpanel)：不激活 owner 的 panel style。
- Apple [`CGWindowListCopyWindowInfo`](https://developer.apple.com/documentation/coregraphics/cgwindowlistcopywindowinfo%28_%3A_%3A%29?language=_5)：当前用户 session 的公开窗口 metadata。
- Apple [`NSWorkspace.accessibilityDisplayShouldReduceMotion`](https://developer.apple.com/documentation/appkit/nsworkspace/accessibilitydisplayshouldreducemotion?language=objc)：Reduce Motion 读取入口。
- Apple [`NSAppBundlesUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsappbundlesusagedescription)：App Management 目的说明键。
- Tauri [`Configuration / MacConfig.infoPlist`](https://v2.tauri.app/reference/config/#macconfig)：自定义 Info.plist 合并配置；本地锁定版本为 Tauri 2.10.3/tauri-build 2.5.6。
