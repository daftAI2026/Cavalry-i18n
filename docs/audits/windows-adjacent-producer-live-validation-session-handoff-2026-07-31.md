<!--
 * [INPUT]: 依赖 PR #3 Windows Adjacent acceptance 源码、disposable clone live run、producer-side PNG、PID/HWND 锚点、ready/ack/done 与人工逐图复核
 * [OUTPUT]: 对外提供 Windows Tag/Assets 三语真实 producer 验证结论、Qt 测试档案登录/工作区隔离、发布隔离边界、失败路线与可复用维护经验
 * [POS]: docs/audits 的 dated 工程交接；绑定一次真实 Cavalry 2.7.2 Windows run，但不提交用户 profile、登录凭据或现场 PNG，也不替代 repository-wide full-ui gate
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Windows Tag / Assets 邻接 producer 真机验证交接（2026-07-31）

## 结论

PR #3 的 Windows Tag/Assets 邻接 producer 缺口已经关闭：

```text
target                         Cavalry 2.7.2 / Qt 6.6.3 / Windows x64
run                            windows-live-18396-1785457391693852000-0
languages                      zh-Hans / zh-Hant / ja_JP
logical producer points        6/6 PASS
producer-side PNG              9/9 PASS
exact PID/HWND anchor          9/9 PASS
manual visual review           9/9 PASS
English restore                PASS
remaining Cavalry PID          0
acceptance DLL after cleanup   absent
repository-wide G0-G4          NOT CLAIMED
```

被验证的不是翻译表里“有这些字符串”，而是 Cavalry 的真实 UI 生产链：

- `TagHeader` 的真实 GroupButton click 创建 `PopOverView`，精确显示“添加标签”和“为所选内容分配标签”；
- 两份带 run nonce 的 fixture 经真实 Drop 进入 `assets::Window`；
- driver 重新解析真实 Assets row，再向 exact viewport post `QContextMenuEvent`；
- parentless 菜单仅在同一 ContextMenu 事件轮携带真实 `assets::Window` producer bridge；
- 菜单精确显示 `Replace...` 与 `Create Composition based on <dynamic stem>`，同文但不具备 Assets producer 的菜单保持英文。

因此，产品修复和验收证据共同证明：翻译由真实 owner/producer 语义触发，不是扩大 source fallback 得到的假阳性。

## 第一性原理

这类 live gate 必须分别回答五个问题：

1. 产品路径：用户正常启动时到底是哪一枚产品 DLL 翻译该表面；
2. producer：哪个真实交互创建窗口、菜单或动态字符串；
3. oracle：哪一组精确原文、本地化文本、owner 和负例决定 PASS；
4. identity：截图是否来自本次 exact PID、目标 QWidget 与可审计 HWND 锚点；
5. cleanup：语言 marker、临时插件、进程和 disposable clone 是否回到干净终态。

只满足“截图看起来像”“测试表里有词条”或“进程加载了 hook”中的任意一项，都不能替代完整闭环。

## 登录与还原工作区怎么旁路

Windows acceptance 不复制登录数据库、不伪造 token，也不继承真实用户 profile。acceptance-only
plugin 在创建任何 driver 前调用 `QStandardPaths::setTestModeEnabled(true)`；Rust 每种语言
重建有固定 magic sentinel 的 `%LOCALAPPDATA%\qttest\Cavalry` 与
`%APPDATA%\qttest\Cavalry`，从标准路径层切断前一轮 workspace restore 状态。

受控 acceptance plugin 的 GUI timer 只在三重身份闭合后运行：

- exact plugin key/specification；
- 三种目标非英语 marker；
- marker 同目录下、无 symlink/junction 的 acceptance/evidence/fixture 根。

Adjacent timer 持续识别并隐藏 test profile 内的 `SignInDialog`、英文/本地化 Welcome
及 modal 干扰，并把身份写入临时 done JSON；本次三语 done 只记录 SignIn/Welcome，
没有工作区恢复框。Onboarding 使用更严格的另一条合同：MainDock 稳定后只要精确恢复
工作区框出现就失败，绝不点 `OK`/`Cancel`。

最终 run 前后真实 `%LOCALAPPDATA%\Cavalry\workspace.json` 的 SHA-256、长度和 mtime
保持 `442ADFA8…2FAE1`、507 bytes、`2026-07-31 07:24:13`；没有任何凭据、Cookie
或真实 profile 被读取、复制或写入证据。

这是测试环境控制，不是产品登录绕过。acceptance DLL 不进入发布 `generic/`、Tauri resources 或 NSIS。

## 验收 driver 为什么独立成插件

最初把 Adjacent driver 编进产品 `cavalryi18n.dll` 会把验收后门带进发布面，即使环境门默认关闭也不合格。最终结构是：

```text
cavalryi18n.dll                    产品 generic translator
qwindows.dll                       产品 QPA delegate
cavalryi18n_acceptance.dll         build tree 中的 acceptance-only generic plugin
```

Rust ignored gate 只把第三枚 DLL 临时复制到 disposable clone，显式设置 `QT_QPA_GENERIC_PLUGINS=cavalryi18n_acceptance:adjacent`；结束后删除它。`build.ps1` 仍只发布前两枚产品 DLL。

这个边界也使 acceptance-only 的 Qt test profile、窗口隐藏、fixture 和截图握手无法被普通用户路径触发。

## 事件循环经验

Assets 菜单会进入 Qt 的嵌套事件循环。用固定 sleep 或在同一重复 timer 上等待 ContextMenu，可能让后续 callback 永远丢失。

最终做法：

- GUI 驱动 timer 只负责 test profile 内的登录/Welcome/modal 干扰；
- 状态推进使用独立 single-shot state timer；
- ContextMenu 通过 `postEvent` 进入真实 viewport，而不是直接调用测试 seam；
- 每一步都等待可观察后置条件：row、菜单、精确 action、PNG ready 和外部 ACK；
- 两份 fixture stem 带 run nonce，避免恢复工作区或旧 Assets row 制造同名假命中。

这里的原则是等待状态，不是等待时间。

## 证据协议

瞬态 popup 不能靠外部屏幕扫描稳定捕获。producer 仍存活时由插件执行 exact `QWidget::grab()`，同时记录：

- Cavalry PID；
- producer QWidget 几何与 object/class identity；
- 同 PID native HWND，或 alien popup 对应的进程 HWND 锚点；
- surface、language、源文本、精确本地化文本和动态 stem。

插件以临时文件加原子 rename 发布 write-once `ready`；Rust 核验 PNG、PID/HWND、语言和表面元数据，计算 SHA-256 后写 write-once `ack`；插件收到 ACK 才推进。最终 `done` 也采用相同原子协议。

PowerShell exact-HWND helper 继续用于 Onboarding 和诊断回退；Adjacent 正式证据以 producer-side grab 为准，避免外部截图错过 popup 或截到并存登录窗口。

## 最终证据清单

| Language | Surface | SHA-256 | Pixels |
| --- | --- | --- | --- |
| zh-Hans | Tag add/assign | `60b14a2305c78fe06062813bc6343b03457d16096c171f37d8ef44758178e2a2` | 230×120 |
| zh-Hans | Assets Replace | `08b5a7011786ec992c613ffe1549c36234b2ff26588ee2eb6484e3d9385727d6` | 300×432 |
| zh-Hans | Assets dynamic Create | `d50c388479a85bd6d60ed9cc1ef2d76590a597b2ba3e660ea9920fe316f3fce9` | 325×432 |
| zh-Hant | Tag add/assign | `f9cc6e19bca856c0bca540aaee3c563bd952e6612a651e38898f726d3f2ddcdb` | 230×120 |
| zh-Hant | Assets Replace | `704a54148f4b1f41ddaec200832a7d29067c1d3da00fe9f8e4f665d9953eeb2c` | 290×432 |
| zh-Hant | Assets dynamic Create | `759f1e1049f241293e811df448d4d6d3d56d9755ff512e81cf282db50df57f0b` | 315×432 |
| ja_JP | Tag add/assign | `2d496fa804e27e48a0f9a382496b6feb2bd30bd53cc68fdbbc2c5f4c2ebe5bf6` | 230×120 |
| ja_JP | Assets Replace | `5d4d88937810c9cf593f3150e6b9613d989116cfcae1674e4d05c4da3419bcba` | 377×432 |
| ja_JP | Assets dynamic Create | `fb66b2047bd9c077e7d15d4b1dd99e1f19e75fb3658eee016a27ad55304088d6` | 402×432 |

三语 done 状态分别绑定 PID 28124、8104、19976；每种语言都报告
`captureCount=3`、`logicalResultCount=2` 和 `status=OK`。人工逐图确认没有乱码、
截断、遮挡或登录窗口误入。

测试最后故意 panic `MANUAL SCREENSHOT REVIEW REQUIRED`，因此命令退出码为 1；这是防止无人逐图复核就把 live gate 写成绿色的设计，不是自动核验失败。上面的 PASS 只在人工审图完成后成立。

PNG、fixture 副本、ready/ack/done、trace、Qt test profile 与真实 Cavalry clone
都是 session artifact，不进入 Git。仓库只提交可复用 driver/helper、产品边界、自动合同和本交接。

## 清理与退出

点击 Onboarding 的 Cancel 会触发厂商整应用退出，所以 Onboarding 第五步只记录 ACK，不点击任何完成/取消语义。

Adjacent 的 `done=OK` 和三张 PNG/ACK 冻结后，driver 不再把“厂商能否正常退出”混入
Tag/Assets PASS。外部 gate 按 macOS exact-child 经验执行：

1. 再次证明 executable 位于 sentinel clone，PID 与路径一致；
2. 向该 PID 的全部 exact top-level HWND 投递 `WM_CLOSE`；
3. Cavalry 2.7.2 在无登录 test profile 下若由 `closeEvent` 拒绝退出，5 秒后再次复核同一
   executable/PID，再执行唯一受限 `ForceStop`；
4. 恢复 English、删除 acceptance DLL/qttest 目录并审计 Cavalry PID 为零。

ForceStop 是 disposable child 的清理兜底，不生成或补写 ready/ack/done，不参与翻译
PASS，也不能作用于其他 PID。最终实跑确认无 Cavalry 进程、marker 为 `en`、临时
acceptance DLL 与两个 qttest 目录均已删除。

## 被证伪的做法

- 复制登录态或真实 profile：扩大隐私面，并把测试结果绑定个人机器；
- 点击 Cancel 清理 Onboarding：会直接关闭整个软件；
- 只改 `APPDATA`/`LOCALAPPDATA` 环境变量：Cavalry 走 Qt 标准路径，不能证明真实 profile 已隔离；
- 坐标、UIA 或盲键驱动 Tag/Assets：不能证明 owner，也会受布局和语言影响；
- 固定 sleep：无法覆盖 nested event loop 与机器负载差异；
- 外部全屏截图：容易截到登录窗口，且可能错过 parentless popup；
- 把 acceptance driver 编进产品 DLL：测试后门污染发布面；
- `closeAllWindows()` 或要求 driver 自退出：无登录 test profile 的厂商 closeEvent 会拒绝，
  且退出能力不是 producer 翻译证据；
- 未复核路径/PID 的进程强杀：可能误伤真实 Cavalry；只允许 helper 的 exact identity 兜底；
- 把 raw PNG 提交进 Git：混淆可复用程序与单次机器证据。

## 从 macOS 经验迁移了什么

迁移的是验证纪律，不是平台实现：

- producer/owner/visible surface 分开证明；
- driver/helper 作为长期维护资产提交；
- session artifact 与源码分层；
- 截图必须绑定 exact process/native window；
- 自动 gate 不能冒充人工视觉复核；
- 正例必须带同文负例，防止为了“看起来翻译了”扩大语义范围。

macOS 的 CGWindow/AppKit/DYLD 不能照搬到 Windows；Windows 的 HWND/QPA/PE 也不能成为 macOS 模板。两端共享的是翻译策略与证据协议。

## 维护者最短重跑路径

1. 构建 Windows injector，确认 acceptance DLL 只在 build tree；
2. 指向真实 Cavalry 2.7.2 的 disposable source；
3. 设置唯一 evidence 根并运行 ignored Adjacent exact test；
4. 看到 `MANUAL SCREENSHOT REVIEW REQUIRED` 后逐图检查 9 张 PNG；
5. 核对每语三次 ready/ack、两逻辑结果、PID/HWND 和 SHA-256；
6. 核对 English restore、零 PID、临时 acceptance DLL 删除；
7. 只提交 driver/helper/合同/文档，不提交 session artifact；
8. 若候选 commit 改变，旧 run 只能作为历史经验，不能证明新 head。
