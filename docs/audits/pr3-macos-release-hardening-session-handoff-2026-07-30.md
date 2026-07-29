<!--
[INPUT]: 依赖 PR #3 当前候选、Codex 任务 019faaa4-501d-7802-ae83-7bb494dd0995、Windows 移植复盘、macOS 48 点 run note 与 acceptance-v2 机器/人工证据
[OUTPUT]: 对外提供 PR #3 macOS 发布加固的决策记录、踩坑复盘、可迁移验收方法、发布边界与下一位维护者最短路径
[POS]: docs/audits 的 dated 工程交接；压缩本轮长对话但不替代 Runbook、当前 run note、代码合同或 GitHub 实时状态
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# PR #3 macOS 发布加固复盘与维护交接

> 审计日期：2026-07-30
>
> 目标：Cavalry 2.7.2、Qt 6.6.3、Cavalry Language Switcher 0.6.0
>
> 公开工作项：[PR #3](https://github.com/daftAI2026/Cavalry-i18n/pull/3)
>
> 内部来源：Codex 任务 `019faaa4-501d-7802-ae83-7bb494dd0995`

## 文档边界

本文压缩本轮从“macOS 八条是否应该先适配、PR 还是 tag 在前”到最终定向验收封存的工程经验。它回答：

- 哪些问题是产品缺陷，哪些只是证据工具缺陷；
- Windows 经验中什么可以迁移到 macOS，什么不能照搬；
- 为什么真实可见证据不能被合同、hook marker 或自动截图数量替代；
- PR、内部版本、公开 patch tag、Windows 待验证项应如何分层；
- 下一位维护者怎样避免重新踩同一批坑。

本文不是第二份状态真相源：

- 当前 macOS 验收状态以
  [`2026-07-29-macos-eight-surface-investigation.md`](../workflows/cavalry-full-ui-100/runs/2026-07-29-macos-eight-surface-investigation.md)
  为准；
- 稳定执行规则以
  [`Runbook.md`](../workflows/cavalry-full-ui-100/Runbook.md)
  为准；
- Windows 架构与真机债以
  [`windows-port-session-handoff-2026-07-29.md`](./windows-port-session-handoff-2026-07-29.md)
  为准；
- 实现、合同或 GitHub 状态与本文冲突时，以当前代码、当前候选和远端状态为准。

## 当前真相快照

本轮候选建立在 PR #3 head `af886e65c8ebe46a46e551aca8955a84f46ea747` 之上，并加入尚待提交的 macOS、共享翻译、Rust 和发布门禁修复。

截至本文形成时：

```text
macOS requested 8 surfaces = PASS (24/24)
macOS adjacent 2 surfaces  = PASS (6/6)
macOS Onboarding steps 1–5 = PASS (15/15)
macOS Transform help       = PASS (3/3)
final macOS status         = PASS-48-OF-48
Windows live Onboarding    = PENDING-NO-WINDOWS-HOST
Windows adjacent producers = PENDING-WINDOWS-PRODUCER
repository-wide G0-G4      = NOT CLAIMED
PR merge                   = NOT EXECUTED
public p4 tag              = NOT CREATED
```

最终 macOS session：

```text
session
5bbc2099-b9a5-41ef-89ed-6c16ca08105f

matrix-machine-record.json
SHA-256 03a000a91fc8dacb56a6b1f6727ee42837c1fb4d8d79c1782f975e8c481420c0

manual-review.json
SHA-256 6b6007d6eb7710c5f81278bc353e830a0f49c859f3c89d5fe3dcbb3d39af07ad

matrix-final-record.json
SHA-256 f00fc8b65af5e8454361d757300ea6046e89588e55e426c93a164e39094b4168
status PASS-48-OF-48
```

这组 PASS 只证明当前候选的 macOS 定向范围。它不证明 Windows 真机、不证明 repository-wide `ALL GATES PASS`，也不授权给 detached 或 dirty PR head 打 tag。

## 首要决策：先形成可发布候选，再谈 tag

本轮最早的问题是：先给 PR 打 tag，还是适配、ChangeLog、版本、合并后再打 tag。

答案只有一条：

```text
验证真实候选
→ 只修真实失败
→ 同步生成物、ChangeLog 与文档
→ 提交并让 CI 验证同一组字节
→ 合并到 main
→ 确认 exact merge SHA 已属于 origin/main
→ 只给该 main SHA 创建公开 tag
```

禁止：

- 给 PR head 打公开 tag；
- 给 detached HEAD 或 dirty tree 打 tag；
- 先 tag，之后移动 tag 吸收修复；
- 用旧 CI、旧二进制或旧截图证明新 commit；
- 因为内部版本已经是 `0.6.0` 就误以为公开发布已经完成。

内部 SemVer 与公开 Cavalry patch tag 是两条坐标：

- `0.6.0` 描述本轮尚未发布的应用功能集合，当前不再增加为 `0.6.1`；
- `cavalry-2.7.2-p4` 描述 Cavalry 2.7.2 的下一次公开 patch 发布；
- 只有 `0.6.0` 真正发布后又出现新的修复，才讨论新的内部 patch 版本。

## PR 边界：补原 PR，不制造 stacked PR

当前修复直接建立在仍开放的 PR #3 之上，属于其验收反馈和发布加固。另开一个依赖 PR #3 的 stacked PR 会带来：

- 两条 head 身份和两组 CI 状态；
- 合并顺序、retarget 和冲突处理；
- 验收候选与发布候选可能分叉；
- ChangeLog 和 tag 难以明确绑定哪一条代码线。

因此本轮代码、证据和文档继续进入 PR #3。PR 标题或说明必须诚实反映它已经不仅是 Windows x64 代码，还包含 shared-runtime 与 macOS release hardening。

Windows 真机证据与代码 PR 分层：

- 自动 Windows 合同、原生测试、安装包与静态资源一致性属于 PR gate；
- 真实 Windows Cavalry 的 Onboarding 五步和邻接 producer 属于 release gate；
- 没有 Windows 主机时写 `PENDING-NO-WINDOWS-HOST`，不得写 PASS；
- 以后应验证准备发布的 exact `main` 候选；若失败，再开小而聚焦的修复 PR。

## 八条首先是验收项，不是八个预设 bug

Runbook 中的八条文本最初只是 Windows 改动带来的 macOS 真机验收债。正确顺序是：

1. 在真实 Cavalry 2.7.2 中找到 producer、owner 和可见表面；
2. 判断当前候选是否已经正确；
3. 只对实际失败项写最小修复；
4. 同时证明同文负例没有被扩大翻译；
5. 绑定当前候选的像素证据。

如果一开始把八条全部当作缺陷，会自然走向全局 source fallback、广泛事件扫描和无边界 hook。那些实现看似覆盖更多，实际把用户文本、模型身份和无关窗口一起纳入风险面。

## Windows 经验怎样迁移到 macOS

可以迁移的是问题分解方法：

- 先找语义 producer 和 owner，再找绘制入口；
- `hook=installed`、词条存在、控件树命中都不等于用户看见了正确文字；
- source 中的冒号、空格、省略号、快捷键前缀和分行都属于身份；
- 区分 translator 安装前已存在的表面与安装后新建的表面；
- 每个正例都要有 owner-external 同文负例；
- 真实候选、进程、窗口、截图和记录必须形成 provenance 闭环；
- 模型身份与动态用户/素材 identity 只在显示模板中投影，不回写数据层。

不能照搬的是平台机制：

- Windows 的 PE/IAT、QPA delegate、UAC、HWND 与 Program Files 不是 macOS 实现模板；
- macOS 的 DYLD、Objective-C++ interpose、bundle 重签、CGWindow 与 AppKit 也不是 Windows 实现模板；
- 共享的是 `(context, source)` 语义表和验证纪律，不是二进制注入手段。

## 产品根因与永久经验

### Onboarding：`language` 是 loader slot，不是内容 locale

三份本地化 `Learn/Guides/strings.json` 曾把 metadata 写成 `zh-Hans`、`zh-Hant`、`ja_JP`。Cavalry 实际固定从 `en` catalog slot 读取 Guide；metadata 被本地化后，整个 catalog 被忽略，造成第 4/5 步只剩按钮、正文为空。

正确状态：

```text
metadata language = "en"
localized values  = 当前目标语言
```

永久规则：

- 不能按字段名字面含义猜 loader 协议；
- metadata 和内容语言必须分别取证；
- 静态合同锁定 98 keys 与全部 guide reference；
- live 验收必须分别断言标题和独立正文，不能让 tooltip、按钮或步骤号冒充 body。

### Parentless QMenu：对象父链不总是语义所有者

Assets 的 `Replace...` 与动态 `Create Composition based on %1` 来自 parentless transient menu。只沿 QObject parent 链无法恢复 `assets::Window` 语义。

正确修法是：

- 从真实 ContextMenu producer 承接 owner；
- 只把弱引用绑定到本次 transient menu；
- 生命周期限定为一个 event-loop turn；
- owner 或 menu identity 不成立时 fail closed。

永久规则：不要用 cursor、`widgetAt`、全局 active window 或全局 source fallback 猜 owner。

### Add Layer：具体快捷键变体不能污染全局 fallback

`Add a layer to your Composition (%1)` 在 Search Bar 中应翻译，但具体 `MenuBarManager` 快捷键变体不能因此进入全局 source fallback。

正确边界：

- exact context 命中目标表面；
- owner-scoped startup backfill 只补安装前已有对象；
- 普通控件中的同文 source 保持原文。

### 动态素材名是 identity

`Create Composition based on replace-source` 中：

- `Create Composition based on %1` 是可本地化模板；
- `replace-source` 和 `dynamic-proof-two` 是测试运行时创建的素材名；
- 它们不是产品硬编码文案，也不是译者起的名字。

验收必须使用至少两个不同 stem，证明实现保留 `%1`，而不是把一条完整样例硬编码进翻译表。

### Scene Statistics：机器结构完整仍可能翻错

首轮完整 matrix 达到 21 runs、48 points、54 screenshots，但日语 `Update` 被译成 `ニュース`。自动工具没有把同窗更新按钮作为文字 oracle，因此结构性绿色无法发现语义错误。

纠偏：

- source catalog 改为 `Update -> 更新`；
- 重新生成 `injector/generated_translations.inc`，不手改生成表；
- 静态合同锁定三语 exact translation；
- live guard 按真实拓扑
  `ProjectStatisticsWindow > GroupButton > QLabel`
  要求同窗唯一可见、启用的 `更新`。

曾经猜测 `QAbstractButton::text()`，真实 inventory 证明文字在子 `QLabel`。经验是：控件看起来像按钮，不代表文字存储在按钮的 `text` 属性中。

### Transform Tool：自绘翻译需要 caller、ABI、字体与像素共同成立

Transform 五条帮助文本不是普通 QLabel。它们必须同时满足：

- 精确 vendor、Core、ExtensionLayer 和 Skia 身份；
- canonical caller 与 ABI guard；
- 五个 approved source 各命中一次，mask 为 `31`；
- CJK path 成功，fallback 与 renderer failure 为零；
- 物理快捷键 token 保持英文；
- 最终原生窗口像素可读。

启动首帧可能已经累计五条调用。此时强制每次 driver click 都再次增长计数会制造假失败。正确规则：

- 启动未累计完整时，要求真实 action delta；
- 启动已精确累计完整时，接受 startup-cumulative，但仍要求 exact per-source count、零 fallback、caller/ABI 边界与 pixels。

### 跨平台模块边界应在装配层表达

PR #3 的平台拆分曾让 macOS Rust 编译暴露三类问题：

- 子模块移动后相对 `super` 层级仍沿用旧路径；
- `windows_runtime` 在非 Windows 上被无条件装配，却依赖已被 `cfg(windows)` 删除的类型；
- Unix 分支调用 `Permissions::mode()`，却未引入 `PermissionsExt`。

正确经验：

- 在模块装配层用 `cfg` 表达平台边界；
- 不要为 macOS 伪造一套 Windows 类型来让编译器安静；
- 文件移动后重新验证 import 深度与平台 trait；
- 跨平台 PR 必须在两端编译，单平台 CI 绿不能证明模块边界正确。

## 证据工具踩坑

### Computer Use、AX、Qt harness 与真实像素各自证明不同事情

- Computer Use/AX 擅长发现可访问控件和进行人工探索，但抓不到所有 parentless、tooltip、modal 或自绘表面；
- Qt harness 能快速验证 context、owner、时序和负例，但不能冒充 Cavalry 产品路径；
- runtime inventory 能告诉我们对象拓扑和文字来源，但不能证明最后像素没有缺字；
- exact OS screenshot 能证明目标窗口的最终显示，但必须绑定 PID、native window、语言和候选；
- 人工逐图复核能发现 `ニュース` 这类“有字、结构也对、语义却错”的问题。

没有单一工具能够替代整条证据链。工具选择由表面决定，而不是为了统一操作方式强迫所有表面走 Computer Use。

### 不要在持续产生日志/dirty 事件时无界泵事件

验收器曾在主线程回调中调用无截止的
`processEvents(AllEvents)`。Injector 持续投递 refresh/dirty 事件后，队列永远不空，调用不会返回。

正确做法：

- 对首帧过滤器直接发送一次目标 `QPaintEvent`；
- 或使用有界、带完成谓词的异步事务；
- 不把“事件队列暂时为空”当成完成信号。

### 同步 modal action 要先注册观察，再 trigger

`Scene Statistics` QAction 会进入同步嵌套事件循环。如果在 `trigger()` 返回后才注册观察回调，目标窗口可能已经出现并阻塞，driver 永远等不到。

顺序必须是：

```text
注册有界观察
→ 触发真实 action
→ 在嵌套事件循环中观察目标
→ 完成或超时
```

### 会销毁自己的信号不能在 emit 后继续读对象

Onboarding chooser 的 `guideSelected("firstLaunch")` 会同步销毁 chooser。旧 driver emit 后继续读取 widget，形成 use-after-free。

正确做法：emit 前冻结 class/owner identity；emit 后只观察新页面，不再解引用旧 chooser。

### 截图不能阻塞产品主线程

旧 Onboarding 截图路径在产品主线程同步等待外部截图，异步正文尚未绘制就被冻结，制造出“正文被吞”的假象。

最终事务：

```text
产品写 ready
→ 外部进程按 exact PID/window 截图
→ 外部写 ack
→ 产品继续
```

产品事件循环始终可绘制。

### CGWindow API 名字不能按自然语言猜

`.optionIncludingWindow` 不是“只枚举这个窗口”。单独使用它无法获得目标窗口列表。正确做法是枚举屏幕窗口，再以 native window ID、PID、owner、layer 和 bounds 做唯一过滤；tooltip/shadow 窗口还可能存在 WindowServer 发布延迟，需要有界重试而不是固定长睡眠。

### 固定 sleep 是脆弱的环境假设

Add Layer readiness 最初固定等待 `700ms`。慢机或窗口调度变化会失败，快机又浪费时间。

最终改为：

- 每 `100ms` 检查目标控件本身；
- 最多等待 `5s`；
- 谓词成立立即继续；
- 超时记录具体未满足条件。

等待必须绑定可观察状态，不能绑定“作者机器上大概够用”的时间。

## 证据卫生：失败不能靠重跑洗掉

本轮保留了三类不成功 session：

- 旧宽松工具产生的假绿：`INVALIDATED`；
- 机器完整但人工发现日语错误：`REJECTED`，不封存；
- 验收器固定等待或拓扑假设失败：未完成、不封存。

正式 PASS 只由：

```text
冻结候选
+ 21/21 product runs
+ 48/48 unique logical points
+ 54/54 exact OS screenshots
+ manual review
+ final record
```

共同成立。

永久规则：

- 工具失败先修证据工具，不改产品迎合错误 oracle；
- 产品失败先保留现场，再做最小修复；
- 候选字节改变后必须新建 fresh clone 和新 session；
- 诊断 session 不续写为正式 PASS；
- machine record 保持机器状态，人工批准通过独立记录封入 final record；
- 真实 `/Applications/Cavalry.app` 不作为实验目标，只使用 disposable exact clone，并只清理该 clone 的精确 PID。

## 验证策略：少跑，但每次都回答一个问题

本轮曾出现反复验证倾向。最终收敛为：

1. 静态/合同失败先按失败名定向运行；
2. 区分产品回归、旧合同、fixture 漂移和环境问题；
3. 只修根因；
4. 已通过的 156 条不因 9 条失败而机械重复；
5. 验收 driver 先单独编译，不浪费 live session；
6. 明确诊断点用一次最小 live 启动定位；
7. 冻结源码后只构建一次产品 injector；
8. 最终从 fresh clone 跑一轮完整 matrix；
9. 完整 matrix 只有在候选或 oracle 发生实质变化后才从零重跑。

这不是“少测试”，而是让每次测试拥有唯一问题和明确证据价值。

### 合同应锁语义，不锁偶然数字

Guide fixture 增加第五个合法叶子后，旧测试把覆盖率分母硬编码为 `75`，实际变成 `80`。正确合同不是更新魔法数字，而是断言：

- exact English untranslated leaf 数量符合场景；
- coverage 确实低于 100%；
- 结构与引用闭合。

同类经验：

- `/var` 与 `/private/var` 可能是同一 macOS 文件路径，比较前要 canonicalize；
- 平台构建时生成且明确不入 Git 的 Windows DLL，不应在 macOS 源码树中被断言“预先存在”；
- 生成链应验证配置声明、输入闭包和构建产物 provenance，而不是验证偶然工作区残留。

### 跨平台语义 oracle 必须随词条一起同步

PR 首次更新后的 Windows CI 成功构建两枚 DLL，并通过 8/9 个 CTest；唯一失败的
`cavalryi18n_extension_layer_hook` 仍把三条已纠正译文写成旧期望：

```text
zh-Hans Enable Snapping         启用抓取     -> 启用吸附
zh-Hant Direct Layer Selection  項目圖層選取 -> 直接選取圖層
zh-Hant Enable Snapping         啓用抓取     -> 啟用吸附
```

产品 TS、生成表和 macOS 验收已经使用右侧译文，失败来自 Windows 独立语义 oracle 漂移，不是 runtime 实现回归。macOS 无法执行该 Windows CTest，所以本地 Node 合同全绿也不能替代目标平台编译执行。

永久规则：

- 修改共享 TS 后，除生成表外还要 grep 各平台独立预期；
- 独立 oracle 不应改成从被测生成表读取，否则测试会退化成自证；
- 第一轮 CI 若暴露目标平台独有漏项，修复后的第二轮 CI 是必要证据，不属于可避免的重复验证；
- 只有没有候选变化却分批 push 才是浪费 CI。

## 生成翻译包不是可选步骤

修改 `tools/{zh-Hans,zh-Hant,ja_JP}.ts` 或 display translation 后，必须：

```text
修改 source catalog
→ 运行 tools/generate_embedded_translations.js
→ 检查 injector/generated_translations.inc
→ 构建对应平台 native injector
→ 用该构建进行 live 验收
```

禁止：

- 手改 `generated_translations.inc`；
- 改了共享翻译只在一个平台构建；
- 用旧 dylib/DLL 截图证明新 TS；
- 把 JSON 语言包和 compiled/runtime Qt 表面混为一谈。

## 协作工具经验

Grok CLI 适合作为独立工程伙伴做失败归因、diff 审阅和发布顺序复核，但不应与主执行者并行重复跑同一套昂贵 matrix。它的全局 `pre_tool_use` hook 曾返回 `127`；CLI 以 fail-open 继续工作。该问题属于伙伴工具配置，不应被包装成产品失败或阻塞 Cavalry 证据。

正确分工：

- 主执行者维护候选、证据身份和最终判断；
- Grok 做独立只读复核或互补分析；
- Computer Use 只用于适合的可见交互，不承担所有 runtime 取证；
- 任一工具结论都必须回到代码、记录或真实界面自证。

## Commit、push 与 CI

本轮收口保留两个逻辑 commit：

1. 产品、合同、生成物、ChangeLog、run note 与 GEB 同构；
2. 本经验文档、文档地图和 Windows live pending 口径。

两个 commit 在本地形成后一次性 push 到 PR #3 head。GitHub CI 按 push 事件验证最终 head，因此不会因为本地有两个 commit 自动跑两遍；不要先 push 第一个、等待 CI，再 push 第二个制造一轮必然过时的验证。

本地 pre-commit 可能对两个 commit 分别运行，这是 index 边界检查，不等于远端 CI 两次。不得为了省本地检查而用 `git add .`、覆盖其他 worktree，或把两个逻辑边界压成无法审阅的提交。

## Windows 未验证项如何处理

Onboarding 修复位于 macOS/Windows 共用语言包，macOS 真实五步已经 `15/15 PASS`；Windows 仍缺真实 Cavalry 可见证据。

当前处理：

```text
代码和共享资源        -> 留在 PR #3
Windows 自动合同      -> PR gate
Windows live Onboarding -> PENDING-NO-WINDOWS-HOST
Windows 邻接 producer -> PENDING-WINDOWS-PRODUCER
真实 Windows 验收     -> exact main release candidate 的 release gate
```

没有 Windows 主机时不搭建复杂体系伪造“真机”，也不无限扩大当前代码。发布前只有两个诚实选择：

1. 获得 Windows 环境并完成真实验收，再发布三资产 `p4`；
2. 把该 patch 明确调整为 macOS-only，同步缩小 ChangeLog、工作流和发布资产，Windows 延后。

未作出第二项决定前，默认保留三资产目标，但 Windows live 状态必须保持 pending。

## 下一位维护者的最短路径

1. 读本文，但把 run note、代码和远端状态当作当前真相；
2. 确认 worktree、HEAD、dirty/untracked 和 PR head 没有漂移；
3. 保持内部版本 `0.6.0`，不要为未发布候选再 bump；
4. 确认 TS、generated table 和 native injector 来源闭合；
5. 不重复已经封存的 macOS 48 点，除非候选字节或目标身份变化；
6. 把两个逻辑 commit 一次 push 到 PR #3；
7. 只用新 PR head 的 CI 判断可合并性；
8. Windows live pending 不冒充 PASS；
9. 合并与 tag 需维护者再次决定；
10. 若最终发布，先确认 exact main SHA，再创建 `cavalry-2.7.2-p4`。

## 一页避坑清单

### 必须做

- 先确认表面 producer/owner/caller，再写翻译；
- 对动态模板保留 identity 参数；
- 对 self-painted UI 同时验证 ABI、字体、fallback 和 pixels；
- 对 modal/异步 UI 使用有界、非阻塞握手；
- 失败 session 保留状态，候选变化后从 fresh clone 重来；
- generated translation 与平台 injector 一起重建；
- 用语义不变量替代魔法计数；
- 区分 PR gate 与 release gate；
- 文档、代码、证据和 Git 历史保持同构。

### 禁止做

- 全局 source-only fallback；
- 用 tooltip、按钮或步骤号冒充 Onboarding 正文；
- 用 harness、hook marker 或 AX tree 冒充最终像素；
- 用固定 sleep 猜异步完成；
- 在会销毁对象的 signal 后继续解引用；
- 在产品主线程同步等待外部截图；
- 看到完整机器矩阵就跳过人工语义复核；
- 重跑同一套验证掩盖未分析的失败；
- 给 dirty、detached、PR-only commit 打公开 tag；
- 没有 Windows 主机却宣称 Windows live PASS。
