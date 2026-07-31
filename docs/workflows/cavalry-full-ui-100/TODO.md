<!--
[INPUT]: 依赖 Acceptance.md、Runbook.md、当前 release candidate 与最新 run note
[OUTPUT]: 对外提供本轮 macOS 定向验收、Windows Onboarding/Tag/Assets live 收口及明确未声明边界
[POS]: full-ui-100 当前任务索引；只列阻塞项，不复制证据系统实现
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# TODO — p4 定向验收收口

## 当前状态

```text
产品代码                 = IMPLEMENTED, TARGETED MACOS/WINDOWS LIVE-ACCEPTED
macOS 8 条 ordinary Qt   = PASS (24/24)
macOS 2 条邻接表面        = PASS (6/6)
macOS Onboarding 五步    = PASS (15/15)
Transform 自绘帮助        = PASS (3/3)
Windows Onboarding live  = PASS (15/15)
Windows 两条邻接 producer = PASS (6/6; 9/9 PNG)
repository-wide G0-G4    = NOT CLAIMED
```

旧 session `F6B7C533-D7EB-4B21-AC4B-FFE1EEBE963A` 的 PASS 已在
`runs/2026-07-29-macos-eight-surface-investigation.md` 判为 `INVALIDATED`；
它只用于定位 producer/owner，不能替代本轮验收。当前 macOS 真相源是
session `5bbc2099-b9a5-41ef-89ed-6c16ca08105f` 的
`matrix-final-record.json`，状态 `PASS-48-OF-48`。
当前 Windows Onboarding 真相源是
[`runs/2026-07-30-windows-onboarding-live-validation.md`](./runs/2026-07-30-windows-onboarding-live-validation.md)，
绑定当前 PR 候选 run `windows-live-6612-1785457815698618300-0` 的 15 张
exact-PID/HWND PNG hash。
当前 Windows Tag/Assets 真相源是
[`../../audits/windows-adjacent-producer-live-validation-session-handoff-2026-07-31.md`](../../audits/windows-adjacent-producer-live-validation-session-handoff-2026-07-31.md)，
绑定 final run `windows-live-18396-1785457391693852000-0` 的三语 6 个逻辑 producer 点、
9 张 producer-side PNG hash、PID/HWND 锚点、人工逐图复核与 English/零 PID 清理。

## 本轮只证明三件事

1. **真实产品路径**：在 disposable Cavalry 2.7.2 clone 内触发实际 Qt producer/slot，并验证产品后置状态；本轮不额外宣称 OS 鼠标路由覆盖。
2. **语言与边界**：每个表面必须唯一等于当前语言；英文和另外两种目标语不得误过；owner-scoped 普通 Qt 同文负例保持原文，Transform 则由 caller/ABI 负边界约束。
3. **图与候选一一对应**：每张人工复核图绑定语言、场景、PID、原生窗口、driver、product injector 和最终候选字节。

## 一次正式验收

冻结源码后只执行一次正式三语矩阵；只有针对明确失败的修复才允许重建并从零重跑。

### 8 条 ordinary Qt — 24 点

- [x] Search Bar `Add a layer to your Composition (%1)`。
- [x] Tag `Add Tag:`。
- [x] Color `Save...`。
- [x] Assets `Replace...`。
- [x] Statistics `Compute Time:` / `Draw Time:` / `Total Nodes:` 三个真实可见标签，并以同窗 `GroupButton > QLabel` 的唯一 `Update -> 更新` 阻断相邻回归。
- [x] Tracking `Tracking...` 与 `Cancel` 的真实 modal dialog。
- [x] 上述 8 个表面在简中、繁中、日语达到 `24/24`，并逐项满足 owner-external 同文负例。

### 邻接表面 — 6 点

- [x] Tag `Assign Tag to Selection: ` 三语 `3/3`。
- [x] Assets `Create Composition based on %1` 三语 `3/3`。
- [x] 用 `replace-source` 与 `dynamic-proof-two` 两个真实素材 stem 证明 `%1` 是动态 identity，不是硬编码名字。

### Onboarding — macOS 15 点 + Windows 15 点

- [x] 三语 `Learn/Guides/strings.json` 保持 Cavalry 固定读取的 `language: "en"` slot；98 keys 与 guide references 静态同构。
- [x] 每语真实显示 step 1–5；标题、正文、Back/Next/Done 拓扑与独立硬编码语言 oracle 完全相等。
- [x] 每步各一张绑定 exact native window 的截图，正文为空不能通过；合计 `15/15` 人工复核。
- [x] Windows 额外以独立 live gate 完成三语 `15/15`：acceptance-only 插件先启用 sentinel-owned Qt test profile，不复制/伪造登录态；等待 MainDock 稳定后以 manager-first `firstLaunch → steps 1–4 unique localized Next → real title/body transition confirmation → step 5 ACK-only` 驱动。重置工作区框一旦出现即失败，helper 只截 runtime 发布的 exact HWND，最终恢复 English 并清零 PID。

### Windows 邻接 producer — 6 点

- [x] 以真实 `TagHeader` GroupButton click 创建 `PopOverView`，三语精确验证 Add/Assign 两标签与 owner-external 负例。
- [x] 两份带 run nonce 的 fixture 真实 Drop 到 `assets::Window`，重新解析 exact row 后 post ContextMenu，三语精确验证 Replace 与动态 Create。
- [x] 9 张 producer-side QWidget PNG 均绑定 exact PID/HWND 锚点并完成人工复核；每语重建 sentinel-owned Qt test profile，登录/Welcome 不成为 producer，结束恢复 English、零 PID 并删除临时 acceptance DLL/qttest 目录。

### Transform — 3 点

- [x] 五条 approved source 达到 exact per-source count `[1,1,1,1,1]`、mask `31`、fallback `0`、renderer failure `0`；仅在启动时尚未完成累计时才要求真实 action delta。
- [x] `StateButton -> GraphicsViewportWindow -> GraphicsViewportBase` 拓扑、caller/ABI/source mask 只命中目标 Transform producer；快捷键 prefix 和无关自绘文本保持原文。
- [x] 三语 exact-window 图由人工确认 CJK glyph 与当前语言正确，合计 `3/3`。

## 发布收口

- [x] 冻结最终源码、acceptance driver/helper 与新 disposable clone。
- [x] Node/contracts、Rust、Tauri、版本与 release metadata 回归已通过；最终仅剩文档收口后的 `git diff --check`。
- [x] 完成 21/21 runs、48/48 points、54/54 OS screenshots，并保存机器记录、人工复核记录与最终封存记录。
- [x] 只在 48/48 后把 CHANGELOG 从候选描述确认为发布事实。
- [x] 完成 L3 → L2 → L1 文档回环。
- [ ] 合并 PR 到 `main`，确认 exact merge SHA 已在 `origin/main`。
- [ ] 只从该 merge SHA 创建并推送 `cavalry-2.7.2-p4`；禁止给 PR head、detached HEAD 或 dirty tree 打 tag。

## 明确不在本轮冒充完成

- Windows Onboarding 与 Tag/Assets 只关闭各自定向 live 缺口；它们不扩张为 Windows 全表面 PASS。
- Acceptance plugin、Qt test profile、窗口旁路和 exact-PID ForceStop 兜底只属于 ignored live gate，不进入产品 generic DLL、Tauri resources 或 NSIS，也不参与翻译 PASS。
- 本轮没有重跑 repository-wide W-AUDIT、G-P、§P5、G-CAPTURE、G-X、G0-G4，因此不声明 `ALL GATES PASS`。
