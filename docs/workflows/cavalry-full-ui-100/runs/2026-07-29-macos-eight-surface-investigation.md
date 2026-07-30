<!--
[INPUT]: 依赖 Runbook.md 的跨平台可见表面证据协议、PR #3 release-candidate 冻结源码、acceptance-v2 的失败现场/机器记录/人工复核，以及后续 tracked producer 恢复记录
[OUTPUT]: 对外提供旧假绿失效、日语 Update 回归、验收器自校正、最终 macOS 48 点 PASS 与 producer 入库边界的完整证据谱系
[POS]: full-ui-100 的当前 macOS p4 定向验收 run note；只证明本候选的 macOS 范围，不替代 Windows producer 或 repository-wide G0-G4
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-07-29 macOS p4 release-candidate 定向验收

## Status

PASS

本状态只表示当前 release candidate 的 macOS 定向矩阵达到 `PASS-48-OF-48`：

```text
macOS requested 8 surfaces = PASS (24/24)
macOS adjacent 2 surfaces  = PASS (6/6)
macOS Onboarding steps 1–5 = PASS (15/15)
Transform self-painted UI  = PASS (3/3)
Windows live Onboarding    = PENDING-NO-WINDOWS-HOST
Windows adjacent producers = PENDING-WINDOWS-PRODUCER
repository-wide G0-G4      = NOT CLAIMED
```

其中两条 Windows 行是本记录于 2026-07-29 封存时的历史快照；后续 Windows Onboarding 三语 `15/15` 由
[`2026-07-30-windows-onboarding-live-validation.md`](./2026-07-30-windows-onboarding-live-validation.md)
承接，Windows 邻接 producer 仍未完成。不得把本记录自身改写成 Windows 或 repository-wide `ALL GATES PASS`，也不得用它给 detached/dirty PR head 直接打 tag。

## Candidate identity

- Worktree: `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-pr3-release`
- Source base: detached PR #3 head `af886e65c8ebe46a46e551aca8955a84f46ea747`
- Candidate: 上述 commit 加本 worktree 未提交修复；acceptance-v2 在 session 内冻结全部运行输入
- Target: Cavalry `2.7.2`, Qt `6.6.3`
- Internal app version: `0.6.0`
- Public release tag（尚未创建）: `cavalry-2.7.2-p4`
- Final disposable target: `/Users/luo/Library/Caches/Cavalry-i18n/acceptance-v2-targets/5bbc2099-b9a5-41ef-89ed-6c16ca08105f/Cavalry.app`
- Final target executable: universal `x86_64 + arm64`, SHA-256 `abf26fc13eb5f53384bf1bb3f6b7bdabcbdac29a25f4f9ffa88b30d30dab3fa8`
- Final product injector: universal `x86_64 + arm64`, SHA-256 `757d58a64208c5281cef4ee25ac7bf4ead65ecf6429862cbf45008f68568bef2`
- Canonical `/Applications/Cavalry.app` 未被验收器修改或终止；每轮只启动并清理 exact disposable clone PID。

## Evidence lineage

### 1. 旧工具假绿：INVALIDATED

旧 session `F6B7C533-D7EB-4B21-AC4B-FFE1EEBE963A` 曾报告 `24+6+15+3`，但审计发现：跨语言宽松匹配、Statistics 无真实文字硬断言、Onboarding 正文可被标题/tooltip 冒充、终态可多写、截图未逐张绑定、窗口/PID 身份不闭合。因此旧声明保持 `INVALIDATED`，只作为 producer/owner 调查材料。

### 2. 首轮完整机器矩阵：人工拒绝，未封存

Session `d0d7cf38-72a3-4b22-81ef-634447c59b73` 完成 21 次运行、48 个逻辑点和 54 张 OS 截图；机器记录：

```text
matrix-machine-record.json
SHA-256 fafde8147bf62511e8f4f4c37df9efd79dd0730fe12186cd4ef55924bfae35ef
status MACHINE-COMPLETE-MANUAL-PENDING
```

人工逐图检查发现 Scene Statistics 的日语圆形更新按钮显示 `ニュース`，而 source 是 `Update`。该 session 即使机器结构完整也被拒绝，没有创建 manual approval 或 final record。

根因与修复只有一条：

```text
tools/ja_JP.ts: Update -> ニュース   (错误)
tools/ja_JP.ts: Update -> 更新       (修复)
```

随后由 `tools/generate_embedded_translations.js` 重建 `injector/generated_translations.inc`，禁止手改生成表。

### 3. 验收器自身失败：先修证据工具，不刷绿

两个新 session 在 `zh-Hans/search` 立即失败，均未形成完整 matrix 或 final record：

- `f377b5a6-b4b8-4225-9025-93f518506b7d`：旧 driver 用固定 `700ms` 猜 Add Layer 已就绪；改为最多 5 秒、每 100ms 检查目标控件本身，满足即继续。
- `459cca15-a72e-406d-9866-46c2ceda2c4b`：初版 sibling guard 错把可见 `Update` 当作 `QAbstractButton::text()`；已有 Windows/macOS runtime inventory 证明真实结构是 `ProjectStatisticsWindow > GroupButton > QLabel`，遂按 exact owner/parent/visibility/text 重写。

最终 driver 在 Statistics 三项截图前要求同窗中恰有一个可见、启用、文字等于当前语言 `更新` 的 `GroupButton` 子标签。它不增加第九个逻辑点，只阻断同窗相邻回归。

### 4. 最终封存矩阵：PASS-48-OF-48

Session: `/Users/luo/Library/Caches/Cavalry-i18n/acceptance-v2/5bbc2099-b9a5-41ef-89ed-6c16ca08105f`

```text
21/21 product runs
48/48 unique logical points
54/54 exact OS screenshots
```

记录身份：

```text
matrix-machine-record.json
SHA-256 03a000a91fc8dacb56a6b1f6727ee42837c1fb4d8d79c1782f975e8c481420c0

manual-review.json
SHA-256 6b6007d6eb7710c5f81278bc353e830a0f49c859f3c89d5fe3dcbb3d39af07ad

matrix-final-record.json
SHA-256 f00fc8b65af5e8454361d757300ea6046e89588e55e426c93a164e39094b4168
status PASS-48-OF-48
```

`matrix-machine-record.json` 保持 `MACHINE-COMPLETE-MANUAL-PENDING` 是协议设计；最终状态由只读 manual review 与 machine identity 共同封入 `matrix-final-record.json`。

## 8 × 3 requested surfaces

| # | Exact source | zh-Hans | zh-Hant | ja_JP |
| --- | --- | --- | --- | --- |
| 1 | `Add a layer to your Composition (%1)` | `向合成添加图层 (⌘.)` | `向合成新增圖層 (⌘.)` | `コンポジションにレイヤーを追加 (⌘.)` |
| 2 | `Add Tag:` | `添加标签：` | `新增標籤：` | `タグを追加：` |
| 3 | `Save...` | `保存…` | `儲存…` | `保存…` |
| 4 | `Replace...` | `替换…` | `取代…` | `置換…` |
| 5 | `Compute Time:` | `计算时间：` | `計算時間：` | `計算時間：` |
| 6 | `Draw Time:` | `绘制时间：` | `繪製時間：` | `描画時間：` |
| 7 | `Total Nodes:` | `节点总数：` | `節點總數：` | `ノード総数：` |
| 8 | `Tracking...` / `Cancel` | `正在跟踪…` / `取消` | `正在追蹤…` / `取消` | `トラッキング中…` / `キャンセル` |

每项同时要求当前语言唯一命中、真实 owner/producer、owner-external 同文负例和 exact native-window OS pixels。Scene Statistics 同窗 `Update -> 更新` sibling guard 在三语 search run 中同时通过。

## Adjacent dynamic surfaces

- `Assign Tag to Selection: `：三语 `3/3`。
- `Create Composition based on %1`：三语 `3/3`，且每语同时使用 `replace-source` 与 `dynamic-proof-two` 两个真实素材 stem。

两个 stem 是运行时素材 identity，不是产品或译者写死的字符串；验收要求模板本地化、`%1` 原样保留。两个 stem 带来每个 create/replace 逻辑点各两张截图，因此 48 个逻辑点对应 54 张原图。

## Onboarding blank-step regression

产品侧把三语 `Learn/Guides/strings.json` 的 `language` metadata 保持为 Cavalry loader 固定读取的 catalog slot `en`，同时保留各语言 value；静态合同锁定 98 keys 和全部 guide reference。

实机路径不是合成弹窗：

```text
Getting Started Guides QAction
  -> onboarding::OnboardingChoiceView
  -> guideSelected("firstLaunch")
  -> steps 1,2,3,4,5
```

调查同时修正了两类验收器假象：

1. `guideSelected` 会同步销毁 chooser；emit 后再读取 widget 是 driver UAF，现先冻结 class identity 再 emit。
2. 旧截图器阻塞产品主线程，导致异步正文没有绘制；现采用 ready → 外部 OS screenshot → ack 的非阻塞事务。

最终 15 张图逐张确认三语 step 1–5 的标题、独立正文、Back/Next/Done 与字形均可见；用户截图中 `4 / 5` 只剩按钮、正文被吞的问题已关闭。

## TransformTool self-painted help

真实拓扑来自 Windows 经验与 macOS inventory 交叉确认：

```text
StateButton (current-language Transform Tool tooltip)
  -> GraphicsViewportWindow
  -> GraphicsViewportBase hover target
```

三语最终 run 均满足：

```text
vendorContractVerified = true
callerBoundaryVerified = true
translatedSourceCalls  = [1,1,1,1,1]
translatedSourceMask   = 31
canonicalCalls         = 5
cjkPathSuccess         = 5
fallbackSourceCalls    = [0,0,0,0,0]
fallbackSourceMask     = 0
rendererFailure        = 0
evidenceMode           = startup-cumulative
```

本次五条文字在 driver 操作前已由产品首帧完整绘制，因此不伪造“点击后必须再次增长”的 delta。正确规则是：

- 若启动时尚未累计五条，则要求真实 action 后逐 source delta；
- 若启动时已精确累计五条，则要求 exact per-source count/mask、零 fallback/renderer failure、caller/ABI 边界和最终 OS pixels；driver 仍通过 off/on 双切恢复目标状态。

人工确认三语五行全部可读。第一行与 Cavalry 原有白色画布边界相交，但文字未丢失、未变英文、未出现缺字框。

## Producer 恢复与入库（2026-07-30）

本次 live matrix 执行时，acceptance producer 位于机器 Cache，并由 harness 冻结进每个 session；它没有随产品修复一起进入 Git。Cache 后来被正常清理，暴露出一个证据工程缺口：最终 record 能证明当次结果，但下一台机器拿不到生成该结果的 driver/helper。

补救没有从 run note 反向手写“差不多”的工具，而是从 Codex 任务
`019faaa4-501d-7802-ae83-7bb494dd0995` 的 JSONL 事件流恢复：

1. 只重放同一日志中存在 `patch_apply_end.success=true` 的补丁；
2. 对 harness 与 exact-window helper 使用最终完整 heredoc，再叠加后续成功补丁；
3. 以 final `5bbc2099-...` 结束后的源码行数核对并发分片；
4. 对 `macos_main_save_replace.inc` 从完整 stdout 基线精确重放，恢复为 725 行；
5. 按保留的 ffmpeg 命令再生三份媒体，并与 final frozen fixture SHA-256 逐项一致；
6. 在 Qt 6.6.3 下重新编译主/补充 driver，执行 Swift parse、Node syntax 与独立静态合同。

稳定源码现在位于
[`tools/macos-acceptance/`](../../../../tools/macos-acceptance/)。
从 JSONL 精确恢复的基线身份如下；它们证明恢复过程，不把后续安全加固伪装成历史 live 输入：

```text
acceptance_harness.js       1f89ab1ce9695f240d0a6f9affe3dbdfb2a57a1dd647d0d1abbb41d1f9332903
cgwindow_exact.swift        09434a03c9385bec8c404e4840e6dad417e34549736313d3af0a5e84ba2e1fdc
macos_main_save_replace.inc 0e2af678f6d12cebc152c2a0ae3fd599794af59ea31191b3ec9d7a60b5a3efd0
replace-source.png          6aa5145e9b04c05f8127e00b98917be02d7c014c004cbc19f6ca7b3fec1a07b2
dynamic-proof-two.png       8198f751d1924c346d1f187ab4ebe7be694f06085437af495265ee8fb34d2add
replace-source.mp4          35e723f8c3a8bd0818b3619d305c6db90e730f2cb1ee59c2fd02502f6d5a41ca
```

源码入库后额外把 build/session 输出强制移到仓库外，阻断 clone 内部 symlink 越界、review symlink 外部改权和 PID reuse 误杀，并以 matrix/v5 绑定 target contract、入口 executable hash 及每次 deep-sign 后的 executable/Qt runtime stage；这些维护性加固会改变当前 harness 字节，但不重写历史。上方
`PASS-48-OF-48` 仍只绑定当时冻结的 candidate、injector、clone、machine record 与人工 seal；本节证明 producer 已可交接，不声称重新运行了一轮 live matrix。

## Release boundary

当前剩余动作不是继续刷验收，而是发布事务：

1. 保持内部版本 `0.6.0` 在 `CHANGELOG.md`、`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`Cargo.lock` 与 `tauri.conf.json` 同步；
2. 完成 L3 → L2 → L1 文档回环和 diff hygiene；
3. 仅在用户明确授权后提交/推送候选并合并 PR 到 `main`；
4. 确认 exact merge SHA 已包含于 `origin/main`；
5. 只从该 merge SHA 创建并推送 `cavalry-2.7.2-p4`。

禁止给 PR head、detached HEAD、dirty tree 或未进入 `origin/main` 的 commit 打 tag。
