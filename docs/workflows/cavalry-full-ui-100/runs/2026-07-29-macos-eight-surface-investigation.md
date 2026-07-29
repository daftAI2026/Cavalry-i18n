<!--
[INPUT]: 依赖 Runbook.md 的跨平台可见表面证据协议、PR #3 release-candidate 冻结源码，以及 acceptance-v2 的失败现场、机器记录、人工逐图复核与最终封存记录
[OUTPUT]: 对外提供旧假绿失效、日语 Update 回归、验收器自校正与最终 macOS 48 点 PASS 的完整证据谱系
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

不得把本记录改写为 Windows 真机 PASS、repository-wide `ALL GATES PASS`，也不得用它给 detached/dirty PR head 直接打 tag。

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

## Release boundary

当前剩余动作不是继续刷验收，而是发布事务：

1. 保持内部版本 `0.6.0` 在 `CHANGELOG.md`、`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`Cargo.lock` 与 `tauri.conf.json` 同步；
2. 完成 L3 → L2 → L1 文档回环和 diff hygiene；
3. 仅在用户明确授权后提交/推送候选并合并 PR 到 `main`；
4. 确认 exact merge SHA 已包含于 `origin/main`；
5. 只从该 merge SHA 创建并推送 `cavalry-2.7.2-p4`。

禁止给 PR head、detached HEAD、dirty tree 或未进入 `origin/main` 的 commit 打 tag。
