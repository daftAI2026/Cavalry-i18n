<!--
[INPUT]: 依赖 PR #3 的 Windows Onboarding 调试 session、实现 commit 0710dc5、证据 commit 294acb6、三语 15/15 run note 与 GitHub Actions run 30544847020
[OUTPUT]: 对外提供恢复工作区与登录态干扰、Onboarding 语义 driver、exact-PID/HWND helper、step 5 关闭边界、证据封存和 macOS 复用方式的维护交接
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
为准。该记录绑定实现 commit `0710dc5`、证据 commit `294acb6`、15 张最终 PNG 的 hash 和三语 `15/15` 人工复核。本交接只保留推理、失败边界和复用方法。

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

最终路径不再操作这些通用对话框。runtime 从 Cavalry 自己的 `showGuides` 语义 action 进入 chooser，再调用真实 Guide 槽位；截图 helper 只接受 runtime 发布的 Onboarding native HWND，并复核它可见、未 cloaked 且属于 exact PID。并存的恢复工作区或登录窗口不会成为截图候选。

Onboarding 需要已有登录态才能稳定到达真实产品表面，因此这一种 capture 继承当前 Windows profile。它不复制、不清空、不删除 profile，也不把账号缓存写进证据目录。其他 full-surface capture 继续把 `LOCALAPPDATA` 和 `APPDATA` 指向 disposable profile，避免把 Onboarding 的例外扩大到整个 live-smoke。

## Driver 走产品语义，不模拟一串猜测点击

commit `0710dc5` 把 driver 放进
`injector/windows/cavalry_i18n_runtime.cpp`，外部编排放进
`src-tauri/tests/manual_windows_live_smoke.rs`。每种语言执行同一条状态机：

```text
apply language to disposable clone
→ launch exact Cavalry.exe and bind PID
→ establish exact-HWND foreground evidence
→ trigger unique showGuides QAction
→ invoke guideSelected(std::string("firstLaunch"))
→ wait for exact title and body
→ publish ready(step, native HWND)
→ external screenshot and ACK
→ steps 1-4 invoke nextClicked()
→ step 5 ACK-only
→ exact-PID cleanup
→ restore English
```

Chooser 的 `guideSelected` 会同步销毁 chooser。driver 在调用前冻结 class 和 owner identity，调用后不再解引用旧对象。Qt meta-object 暴露的参数必须精确为 `std::string`，只记录参数名而不阻止错误 ABI 仍可能造成未定义行为，因此 ABI 检查现在是调用前的硬门。

driver 还修正了两个时序问题。验收定时器必须由 `QApplication` 所在线程创建和驱动，不能在 event dispatcher 就绪前启动；产品内部阶段超时从 external foreground ACK 后开始，避免外部等待 Windows 前台所有权时提前消耗内部预算。

## 第 5 步只确认看见，不调用完成或取消

steps 1-4 的唯一真实前进动作是 `nextClicked()`。第 5 步没有经过证明的安全“完成”语义，`Done`、`Cancel`、关闭按钮或猜测出的槽位都可能进入登录、退出或恢复工作区流程。

因此第 5 步只做三件事：确认唯一标题与正文，截取 exact HWND，写 step 5 ACK。runtime 随后把状态记为 `complete`，不再点击任何完成或取消控件。测试清理由 helper 向 exact PID 拥有的全部顶层 HWND 投递 `WM_CLOSE`，不发送盲键、不强杀进程，也不等待某个可能已被其他弹窗遮住的“主窗口”。

这条边界来自真实失败，不是界面文案推断。以后若 Cavalry 增加了可证明的完成槽位，也要先独立取证其对象、调用语义和退出影响，再讨论是否修改 driver。

## Helper 绑定窗口身份和写入边界

commit `0710dc5` 同时提交了
`tools/capture_windows_pid_window.ps1`。Onboarding capture 不重新搜索最大窗口，也不按标题、坐标或焦点猜目标。它消费 runtime 给出的十进制 HWND，再核对：

- HWND 非零、可见且未 cloaked；
- HWND 属于 exact Cavalry PID；
- 输出位于带 sentinel 的 disposable evidence root；
- clone 和 evidence 路径链没有 reparse point；
- 已存在证据不被覆盖。

Rust live-smoke 只修改带 sentinel 的 `%TEMP%` clone，结束时恢复 English marker，并审计 Cavalry、Cargo、Rust 进程归零。登录态只是运行上下文，marker、ACK 和 PNG 才能进入临时证据目录；账号、缓存、绝对机器路径和原始日志不进入 Git。

## 证据怎样封存

实现和证据分成两个 commit。`0710dc5` 包含 reusable driver/helper、合同和 GEB 地图，`294acb6` 只封存最终 run note 与状态地图。这样可以从证据记录回到 exact 实现，也能独立审阅“工具怎么证明”和“本次证明了什么”。

最终矩阵在实现 commit 冻结后，从 fresh disposable clone 连续跑完 `zh-Hans`、`zh-Hant`、`ja_JP` 的 steps 1-5。每张图都有独立 SHA-256，人工逐图确认没有乱码、截断、遮挡和正文缺失。测试末尾显示 `FAILED` 是预设的人工复核闸门；自动失败使用另一条明确错误消息，不能把这两个状态混写。

一次旧 full-surface 诊断在 `EditShape Tool preparation` 的 exact foreground 条件超时。它发生在另一条 capture path，既没有被算进 Onboarding `15/15`，也没有被写成 full-surface 通过或失败。失败 session 和未完成范围留在记录中，不能靠重跑洗掉。

## Review 拦住的回归

收口审阅发现并修正了几处容易留下长期债的问题：

- profile 继承一度扩散到 full-surface，后来收回为 Onboarding-only；
- `guideSelected` 曾只记录 ABI，没有在调用前 fail closed；
- full-surface scenario 顺序被无意改变，合同测试把它恢复；
- PowerShell `ValidateSet` 和旧 `ConfirmDiscard` 预期没有跟 helper 新边界同步；
- runtime 等待没有加入裸 `thread::sleep`，继续用有界状态和 channel timeout。

这些都说明 driver/helper 也是产品级维护代码。它们必须经过 L3、L2、合同、目标平台编译和 review，不能放在机器临时目录中成为一次性脚本。

## macOS 复用同一套证明结构

macOS 已有的验证经验记录在
[`pr3-macos-release-hardening-session-handoff-2026-07-30.md`](./pr3-macos-release-hardening-session-handoff-2026-07-30.md)。
拿到 Mac 后，应把实际使用的 driver/helper、对应合同、GEB 地图和 dated run note 一起 commit 到 PR，不只提交最终截图。

两端可以共享这些规则：

- 从唯一语义 action 进入 `firstLaunch`；
- `guideSelected` 调用前验证真实参数 ABI，调用后不读取已销毁 chooser；
- 标题和正文使用独立 oracle；
- 产品写 ready，外部按 exact native window 截图，外部再写 ACK；
- steps 1-4 前进，step 5 只 ACK；
- 登录态不复制进证据，其他场景保持 profile 隔离；
- 每张最终截图绑定 candidate、language、step 和 hash；
- 候选或 oracle 改变后，从 fresh clone 重跑最终矩阵。

平台实现各自保留。Windows 用 PID、HWND、DWM 和 `WM_CLOSE`；macOS 应继续用 bundle clone、PID、CGWindow/AppKit、签名与 quarantine 边界。共享的是状态机、身份校验和证据纪律，不是把 Windows API 翻写成 macOS API。

## 这次留下的判断

Onboarding 的可信证明由五类身份共同组成：已安装 catalog 是文字来源，语义 action 和 Guide 槽位是产品路径，PID 和 native window 是窗口身份，PNG 是最终像素，English restore 与零进程是清理结果。缺少任何一类时，只能声明对应局部证据。

恢复工作区、登录和最后一步都带有产品状态语义。自动化遇到语义不明且可能退出软件的动作时，应停止猜按钮，转向更稳定的产品对象和外部精确清理。这样留下的 driver/helper 才能在下一次 Cavalry 或 PR 验证中直接复用。
