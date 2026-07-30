<!--
[INPUT]: 依赖 PR #3 Windows 候选 commit 0710dc5、Cavalry 2.7.2/Qt 6.6.3 disposable clone、Windows Onboarding ready/ack driver、exact-PID/HWND helper、15 张最终 PNG 与人工逐图复核
[OUTPUT]: 对外提供 Windows firstLaunch 三语 15/15 PASS 的候选身份、语义/像素证据、清理结果、失败边界与未声明范围
[POS]: full-ui-100 的 Windows Onboarding 定向 release-gate run note；关闭此前 PENDING-NO-WINDOWS-HOST，但不替代 Windows 邻接 producer 或 repository-wide G0-G4
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-07-30 Windows Onboarding live 验证

## Status

PASS

本状态只证明 PR #3 候选在真实 Windows Cavalry 2.7.2 中完成
`zh-Hans`、`zh-Hant`、`ja_JP` 的 firstLaunch steps 1–5：

```text
Windows Onboarding zh-Hans = PASS (5/5)
Windows Onboarding zh-Hant = PASS (5/5)
Windows Onboarding ja_JP   = PASS (5/5)
Windows Onboarding total   = PASS (15/15)
Windows adjacent producers = PENDING-WINDOWS-PRODUCER
repository-wide G0-G4      = NOT CLAIMED
```

## Candidate identity

- Implementation commit: `0710dc5` (`test(windows): add reusable onboarding live gate`)
- Target: Cavalry `2.7.2`, Qt `6.6.3`, Windows x64
- Internal app version: `0.6.0`
- Windows generic injector SHA-256:
  `ab47accb5e55d8b163eefaf3acd584a55db4ecc8388f273d6d4d1aea10e99472`
- Windows QPA proxy SHA-256:
  `b9b11a25e835bedc907c2ca1f34ec548af5df6b0511e6e468b95682cfe05495e`
- Final evidence run id:
  `windows-live-15840-1785416023039116700-0`
- 验收只修改带 sentinel 的 disposable `%TEMP%` clone；未修改真实 Cavalry 安装。
- Onboarding 为复用登录态继承当前 Windows profile，但没有复制、记录或提交账号缓存；证据目录只保存 marker、ACK 与 PNG。

本记录不保存机器绝对路径、临时 PID、登录信息或原始日志。候选身份由 commit、目标版本、injector hash、run id 与逐图 hash 共同绑定。

## Driver contract

每种语言都执行同一条真实产品路径：

```text
apply language to disposable clone
→ launch exact Cavalry.exe and bind PID
→ Transform exact-HWND foreground proof
→ runtime reads installed assets/Learn/Guides/strings.json
→ unique semantic showGuides QAction
→ guideSelected(std::string("firstLaunch"))
→ ready(step N, exact title QLabel, exact body QTextBrowser, native HWND)
→ helper verifies exact PID/HWND and captures PNG
→ external step-N ACK
→ steps 1–4 invoke nextClicked()
→ step 5 records complete without Done/Cancel/close invocation
→ helper posts WM_CLOSE only to all top-level HWNDs owned by the exact PID
→ restore English and audit zero Cavalry processes
```

硬边界：

- catalog metadata 必须保留 Cavalry 固定 loader slot `language: "en"`；
- `guideSelected` 参数必须由 meta-object 精确证明为 `std::string`；
- title 只能由唯一可见 `QLabel` 命中，body 只能由唯一可见 `QTextBrowser` 命中；
- HTML body 先经 `QTextDocument::toPlainText()` 归一化，再与安装 catalog 精确比较；
- screenshot helper 不重选主窗口，必须消费 runtime 发布的十进制 native HWND，并复核它仍可见、未 cloaked、属于 exact PID；
- 第 5 步只 ACK，不调用 `nextClicked`、Done、Cancel 或任何登录弹窗按钮；
- Close 不发送盲键、不调用 `keybd_event`、不强杀进程。

## Final screenshot evidence

下表 15 张图来自同一个最终 run。最终 run 的 PNG hash 与人工逐张复核通过的简中、繁中、日文图完全一致；可见结果没有乱码、截断、按钮遮挡或正文缺失。

| Language | Step | SHA-256 | Dimensions |
| --- | ---: | --- | --- |
| zh-Hans | 1 | `95e79025c144101ebe5d75cd62d50c82f61914d5ff6ebcb2e45557b3a6285273` | 350×221 |
| zh-Hans | 2 | `11158df840c572b72a26cd9b8418ae5459363e40a18c77bb97ba59d260bb0170` | 350×221 |
| zh-Hans | 3 | `18ca463d53123d0bfc7670e6f2c38c9a2901576bf5957b2d97b546cd17779f6b` | 350×221 |
| zh-Hans | 4 | `3ae5568f0ee3c339759edda8016132b9d585b8d4957ca2aeadb615b7fc450468` | 350×221 |
| zh-Hans | 5 | `3d5378620d3e9e6b65d8aa048408e9b8db5ba23485cebeed8eb7dafd5a59e377` | 350×221 |
| zh-Hant | 1 | `3083e208fa5db73d893cf880d4611b9f6ba3aee19caecae0e01627d15aa3322f` | 350×221 |
| zh-Hant | 2 | `fb25fd9e58d246a7628d5809754ec121822a29d6de8fc7d425820190ba5da354` | 350×221 |
| zh-Hant | 3 | `87a50068ad606f7aa37ce4afc68d112d6e1542cd0f983caf65be01155370b6b2` | 350×221 |
| zh-Hant | 4 | `10f517fcdba1b5cdffa0c0a2537273478ca786328f221264f0d0aa7c43287f78` | 350×221 |
| zh-Hant | 5 | `62b28798fd8cace334b2f1b245ab77e3d15bb04a7f3293ec2167e3c8ddf25b13` | 350×221 |
| ja_JP | 1 | `78c037b43b16bbc9e360230bf511a1fc6d45434ce529a052f4773b931c2981b3` | 350×243 |
| ja_JP | 2 | `fbf5af661622c51f396e8b8b944c282cd4a50289ed57ba5840923e14f5fa34b4` | 350×243 |
| ja_JP | 3 | `55cdbd9bad120a4283ee1911c0ec25592147b3c101014fd122d139b74689775c` | 350×243 |
| ja_JP | 4 | `62a7e268ebd8029a073c29c9a79398571b69a2569ca23dd2e424ca9105421399` | 350×243 |
| ja_JP | 5 | `0fd72f7eadc618849435c05bafc5e1d8aeb5ff0b61b5b34cb3148ec12e45e5bb` | 350×265 |

三语进入 Onboarding 前的 Transform exact-HWND 前台证据：

| Language | SHA-256 |
| --- | --- |
| zh-Hans | `ec60c38ff6b05e269fa083587a448780c14544e022caff986fed84587d054748` |
| zh-Hant | `03c97d7516c25f47729c9f82a8bf65488f74f54afe35b23bc9cff8eb81680a03` |
| ja_JP | `6724004ab753086b5eb3d97066514ebb550532de2a5ed1acb749bd21308c2661` |

## Cleanup and terminal state

- 三种语言的 runtime marker 都到达
  `status=complete`, `step=5`, `titleMatches=true`, `bodyMatches=true`。
- terminal message 精确为
  `All five firstLaunch steps were acknowledged.`。
- 测试最后显示 `FAILED` 是预设的 `MANUAL SCREENSHOT REVIEW REQUIRED` 人工闸门；自动语义、窗口、截图、English restore 或 PID cleanup 任一失败都会走另一条 `Windows live-clone automated evidence failed` 路径。
- 最终 disposable clone marker 为 `en`。
- 最终 `Cavalry`、`cargo`、`rustc` 进程审计为零。

## Verification

- Windows Qt injector Release build: PASS
- Native injector contracts: `9/9` PASS
- Node/Tauri contracts: `165/165` PASS
- Rust test suite: `171/171` library tests PASS；其余 integration/contract tests 全部 PASS，ignored live/manual tests保持显式 opt-in
- PowerShell 5.1 parser and UTF-8 BOM: PASS
- `git diff --check`: PASS

## Diagnostic evidence kept separate

一次旧 full-surface 单语诊断在 `EditShape Tool preparation` 的 exact foreground 条件超时。它发生在 Close 之前，不改变本记录的 Onboarding 15/15，也不能证明 full-surface 失败或通过。该门仍要求操作系统实际授予目标 HWND 前台权；本轮没有放宽为坐标、全局键盘或假绿色重试。

## Not claimed

- Windows Tag/Assets 两条邻接 producer 仍是 `PENDING-WINDOWS-PRODUCER`。
- 本记录不替代 macOS 48 点记录。
- 本记录不声明 repository-wide `ALL GATES PASS`。
- PR 合并、`main` 身份、公开 `cavalry-2.7.2-p4` tag 与 release 均未执行。
