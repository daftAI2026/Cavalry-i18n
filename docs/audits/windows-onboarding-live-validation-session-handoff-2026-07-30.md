<!--
[INPUT]: 依赖 PR #3 的 Windows Onboarding 调试 session、2026-07-31 当前候选三语 15/15 run、同 PR 的 tracked macOS producer 与 Qt 测试档案实现
[OUTPUT]: 对外提供登录/工作区隔离、Onboarding 语义 driver、真实页面转场确认、exact-PID/HWND helper、step 5 清理边界、证据封存和 macOS 对应实现方式
[POS]: docs/audits 的 dated session handoff；解释本轮怎样得到可信结论，但不替代 live run note、当前代码或 GitHub 实时状态
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Windows Onboarding live 验证 session 复盘

> 日期：2026-07-30
>
> 目标：Cavalry 2.7.2、Qt 6.6.3、Windows x64
>
> 工作项：[PR #3](https://github.com/daftAI2026/Cavalry-i18n/pull/3)

## 文档边界

本轮先看到真实界面已经出现中文，旧验收却仍报告正文缺失。随后又遇到恢复工作区确认框、登录弹窗与 Onboarding 并存，点击 `Cancel` 还会直接退出 Cavalry。这些现象改变了验证方法，也解释了为什么 driver 和 helper 必须作为代码进入 PR，不能只留下截图和聊天记录。

当前状态以
[`2026-07-30-windows-onboarding-live-validation.md`](../workflows/cavalry-full-ui-100/runs/2026-07-30-windows-onboarding-live-validation.md)
为准。该记录已由 2026-07-31 当前 PR 候选的
`windows-live-6612-1785457815698618300-0` 重验证，绑定 15 张最终 PNG 的 hash
和三语 `15/15` 人工复核；历史 `0710dc5`/`294acb6` 只保留为谱系，不再证明当前 head。

## 用户看到的界面推翻了旧 oracle

第一次启动完成后，从“入门帮助”打开的内容已经是中文。旧工具仍说 body 缺失，问题因此转向验收器：它把正文控件想成了 `QLabel`、tooltip 或按钮文本，真实正文却在 `QTextBrowser` 中。

最终 oracle 分开验证两个独立表面：

- 标题只能由唯一可见 `QLabel` 命中；
- 正文只能由唯一可见 `QTextBrowser` 命中；
- HTML 正文经 `QTextDocument::toPlainText()` 归一化后，与已安装 `assets/Learn/Guides/strings.json` 精确比较；
- catalog metadata 必须保留 Cavalry 固定 loader slot `language: "en"`，本地化只发生在 value。

用户可见中文是重要反证，但单张肉眼观察不能代替五步、三语、候选身份和清理状态。旧 oracle 被真实界面证伪后，修的是验收工具，没有为迎合错误工具改产品翻译。

## 恢复工作区和登录弹窗不能靠 Cancel 处理

测试启动时可能出现恢复工作区确认框，也可能同时出现登录弹窗和 Onboarding。`Cancel` 在这条产品路径中带有退出语义，实际点击会关闭整个软件。按按钮文字猜语义会把“关闭干扰窗口”变成“终止被测进程”，也可能误把登录窗口截成 Onboarding。

最终路径在 acceptance-only QPA 插件创建 driver 前调用
`QStandardPaths::setTestModeEnabled(true)`。Cavalry 因而只读写 Qt 的
`%LOCALAPPDATA%\qttest\Cavalry` / `%APPDATA%\qttest\Cavalry` 测试档案，
不读取、不复制、不伪造真实登录 token，也不接触真实工作区。Rust gate 只创建带固定
magic sentinel 的这两个目录；既有目录没有 sentinel、路径链出现 reparse point 或
cleanup 身份不一致时都 fail closed。

driver 等真实 `MainDock` 连续启动稳定 15 秒后才触发 `firstLaunch`。这之后若精确
“重置工作区？”消息框仍出现，测试立即失败，既不点 `OK`，也不点 `Cancel`。登录/Welcome
可以并存，但 Onboarding helper 只接受 runtime 发布、属于 exact PID、可见且未 cloaked
的真实 Guide HWND，因此登录窗不会成为截图候选。

最终两次当前候选 run 前后，真实
`%LOCALAPPDATA%\Cavalry\workspace.json` 均保持 SHA-256
`442ADFA89A1434E8FBA8A4B6CDDD0CB87ED13A4C6284900D22A5CBC66802FAE1`、
507 bytes、最后写入 `2026-07-31 07:24:13`。这才是“没有碰真实 profile”的外部证明。

## Driver 走产品语义，不模拟一串猜测点击

PR #3 把 driver 放进
`injector/windows/cavalry_i18n_runtime.cpp`，外部编排放进
`src-tauri/tests/manual_windows_live_smoke.rs`。每种语言执行同一条状态机：

```text
apply language to disposable clone
→ launch exact Cavalry.exe and bind PID
→ establish exact-HWND foreground evidence
→ resolve OnboardingManager first, with unique showGuides/choice fallback
→ invoke showGuide/guideSelected(std::string("firstLaunch"))
→ wait for exact title and body
→ publish ready(step, native HWND)
→ external screenshot and ACK
→ steps 1-4 click the unique localized Next button
→ confirm the next page's unique title and body before advancing state
→ step 5 ACK-only
→ exact-PID cleanup
→ restore English
```

Chooser 的 `guideSelected` 会同步销毁 chooser。driver 在调用前冻结 class 和 owner identity，调用后不再解引用旧对象。Qt meta-object 暴露的参数必须精确为 `std::string`，只记录参数名而不阻止错误 ABI 仍可能造成未定义行为，因此 ABI 检查现在是调用前的硬门。

driver 还修正了三个时序问题。验收定时器必须由 `QApplication` 所在线程创建和驱动；
首次触发必须等真实 `MainDock` 稳定；每次 Next 点击后进入独立
`waiting-for-transition` 状态，只有下一页唯一标题和正文都出现才推进 step。旧页稳定
1.5 秒才允许重试，最多三次，既不把“发过 click”当作成功，也避免无界连点跳页。

## 第 5 步只确认看见，不调用完成或取消

steps 1-4 的唯一真实前进动作是唯一可见、可用、本地化 `Next` 按钮的
`QAbstractButton::click()`；它走产品连接的 `nextClicked`，并由下一页真实标题/正文确认。
第 5 步没有经过证明的安全“完成”语义，`Done`、`Cancel`、关闭按钮或猜测出的槽位都可能进入登录、退出或恢复工作区流程。

因此第 5 步只做三件事：确认唯一标题与正文，截取 exact HWND，写 step 5 ACK。runtime
随后把状态记为 `complete`，不再点击任何完成或取消控件。逻辑证据完成后，测试清理由
helper 向 exact PID 拥有的全部顶层 HWND 投递 `WM_CLOSE`；若无登录态的厂商
`closeEvent` 拒绝退出，才在再次复核同一 executable/PID 后执行 `ForceStop`。该兜底
只负责回收 disposable child，不参与翻译 PASS。

这条边界来自真实失败，不是界面文案推断。以后若 Cavalry 增加了可证明的完成槽位，也要先独立取证其对象、调用语义和退出影响，再讨论是否修改 driver。

## Helper 绑定窗口身份和写入边界

PR #3 同时提交了
`tools/capture_windows_pid_window.ps1`。Onboarding capture 不重新搜索最大窗口，也不按标题、坐标或焦点猜目标。它消费 runtime 给出的十进制 HWND，再核对：

- HWND 非零、可见且未 cloaked；
- HWND 属于 exact Cavalry PID；
- 输出位于带 sentinel 的 disposable evidence root；
- clone 和 evidence 路径链没有 reparse point；
- 已存在证据不被覆盖。

Rust live-smoke 只修改带 sentinel 的 `%TEMP%` clone 和带独立 sentinel 的 Qt test
profile，结束时恢复 English marker、删除临时 acceptance DLL/qttest 目录，并审计
Cavalry 进程归零。marker、ACK 和 PNG 只进入临时证据目录；账号、缓存、绝对机器路径
和原始日志不进入 Git。

## 证据怎样封存

当前 PR commit 同时携带 reusable driver/helper、合同、run note 和 GEB 地图；raw PNG、
fixture 副本、ready/ack/done 与用户临时目录仍只属于 session artifact。这样仓库保留
“怎么重跑、怎么判断”，又不会把一次机器现场当作长期源码。

最终矩阵在实现 commit 冻结后，从 fresh disposable clone 连续跑完 `zh-Hans`、`zh-Hant`、`ja_JP` 的 steps 1-5。每张图都有独立 SHA-256，人工逐图确认没有乱码、截断、遮挡和正文缺失。测试末尾显示 `FAILED` 是预设的人工复核闸门；自动失败使用另一条明确错误消息，不能把这两个状态混写。

一次旧 full-surface 诊断在 `EditShape Tool preparation` 的 exact foreground 条件超时。它发生在另一条 capture path，既没有被算进 Onboarding `15/15`，也没有被写成 full-surface 通过或失败。失败 session 和未完成范围留在记录中，不能靠重跑洗掉。

## Review 拦住的回归

收口审阅发现并修正了几处容易留下长期债的问题：

- 历史 Onboarding 曾继承真实 profile；当前已改为 acceptance-only Qt test profile；
- `guideSelected` 曾只记录 ABI，没有在调用前 fail closed；
- full-surface scenario 顺序被无意改变，合同测试把它恢复；
- PowerShell `ValidateSet` 和旧 `ConfirmDiscard` 预期没有跟 helper 新边界同步；
- runtime 等待没有加入裸 `thread::sleep`，继续用有界状态和 channel timeout。

这些都说明 driver/helper 也是产品级维护代码。它们必须经过 L3、L2、合同、目标平台编译和 review，不能放在机器临时目录中成为一次性脚本。

## macOS 复用同一套证明结构

macOS 已有的验证经验记录在
[`pr3-macos-release-hardening-session-handoff-2026-07-30.md`](./pr3-macos-release-hardening-session-handoff-2026-07-30.md)。
本轮已把实际使用的 macOS driver/helper、对应合同、GEB 地图和冻结媒体恢复到
[`tools/macos-acceptance/`](../../tools/macos-acceptance/)，并把恢复 provenance 追加到原 macOS run note。源码进入 Git，编译产物与截图仍留在 session；这正是 Windows 工具落库经验在 Mac 上的完成态，而不是再写一套抽象框架。

两端可以共享这些规则：

- 从唯一语义 action 进入 `firstLaunch`；
- `guideSelected` 调用前验证真实参数 ABI，调用后不读取已销毁 chooser；
- 标题和正文使用独立 oracle；
- 产品写 ready，外部按 exact native window 截图，外部再写 ACK；
- steps 1-4 前进，step 5 只 ACK；
- 登录态不复制、不伪造；Onboarding/Adjacent 共用有 sentinel 的 Qt test profile；
- Next 点击和 step 推进分离，后者只由真实下一页标题/正文确认；
- 每张最终截图绑定 candidate、language、step 和 hash；
- 候选或 oracle 改变后，从 fresh clone 重跑最终矩阵。

平台实现各自保留。Windows 用 PID、HWND、DWM、Qt test profile 与
`WM_CLOSE`/exact-PID 清理；macOS 继续用隔离 HOME、bundle clone、PID、
CGWindow/AppKit、签名、quarantine 与 exact child SIGTERM。共享的是状态机、身份校验
和证据纪律，不是把 Windows API 翻写成 macOS API。

## 这次留下的判断

Onboarding 的可信证明由五类身份共同组成：已安装 catalog 是文字来源，语义 action 和 Guide 槽位是产品路径，PID 和 native window 是窗口身份，PNG 是最终像素，English restore 与零进程是清理结果。缺少任何一类时，只能声明对应局部证据。

恢复工作区、登录和最后一步都带有产品状态语义。自动化遇到语义不明且可能退出软件的动作时，应停止猜按钮，转向更稳定的产品对象和外部精确清理。这样留下的 driver/helper 才能在下一次 Cavalry 或 PR 验证中直接复用。
