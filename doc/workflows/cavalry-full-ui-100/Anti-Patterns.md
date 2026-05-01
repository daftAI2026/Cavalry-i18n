<!--
[INPUT]: 依赖 invalidated archive 分支、历史 runlog 与 cache 污染样本
[OUTPUT]: 对外提供 full-ui-100 工作流的反绕过模式库
[POS]: full-ui-100 的事故记忆，不是当前 gate 真相源
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Anti-Patterns — Cavalry Full UI 100% 反绕过档案

> 本文件按绕过类型组织，而不是按执行轮次组织。历史分支只作为案例来源；当前规范以 `Acceptance.md`、当前执行以 `EXECUTE.md`、当前代码真相以 `Project.md` / `TODO.md` 为准。

---

## A. Out-of-Band Truth

### 病灶

把 gate 的输入从真实系统中挪走，用 fixture、curated 清单、cache 残留或人工挑选语料替代。表面上 coverage 变绿，本质上测量对象已经换了。

### 禁止形态

- 仓库内 runtime fixture 写入 `~/Library/Caches/Cavalry-i18n/` 后冒充真机 capture
- curated keep-list 定义 compiled owner map 的输出边界
- CI 没有 Cavalry.app 时造 deterministic input 让 gate 通过
- 自动扫描 cache 根目录并消费旧 inventory

### 当前设计

- runtime 只信 `SESSION_DIR/runtime/*`
- compiled source map 必须来自 raw extraction，并记录 path/hash/mtime
- 缺 live Cavalry 只能输出 `BLOCKED-NO-LIVE-CAVALRY`
- 抽取分母由 `extraction-inventory.json` 冻结，后续 gate 不得换分母

### 发生过的案例

- `copilot/cavalry-full-ui-100-exec`: 用 `tools/full_ui_inventory_fixtures/` 和 `prepare:full-ui-gate` 垫 runtime input。
- `origin/archive/cavalry-full-ui-100-exec-invalidated-20260427`: 用 `doc/libExtensionLayer-curated-ui.txt` 把 compiled corpus 裁成手工子集。

---

## B. Counterfeit Form

### 病灶

把“看起来不像英文”伪装成“已经翻译”。这种绕过利用 detector 只看 ASCII 英文字母的弱口径，不关心翻译是否真实、可读、符合语义。

### 禁止形态

- `（译）` / `（訳）` / `（譯）` 占位后缀
- 全角拉丁字母冒充目标语言，例如 `Alpha → Ａｌｐｈａ`
- `页:1` / `頁:1` / `ページ:1` 这类错位填词
- zh-Hans / zh-Hant 简繁串味
- source 与 translation 只差一个伪翻译标记的自我递归条目
- 本地词表、启发式替换、离线脚本批量“翻译”

### 当前设计

- §P5 Forbidden-Translation Patterns 命中即 hard-fail
- detector 必须覆盖 repo 资产、runtime inventory、compiled audit 与 `.ts`
- 翻译只允许 LLM + guidelines + glossary + whitelist 四件套

### 发生过的案例

- `wip/cavalry-full-ui-100-v2`: `.ts` 文件被本地翻译器膨胀，出现占位标记、全角化、错位填词与自我递归。
- `archive/cavalry-full-ui-100-v2-invalidated-20260428`: 保存污染快照，用作 detector 反向回归样本。

---

## C. Denominator Shrink

### 病灶

不是把翻译做完，而是把“需要翻译的东西”悄悄变少。分母一缩，100% 就变成幻觉。

### 禁止形态

- merge 过程中静默丢失 source strings
- source map 只保留当前工具能处理的小子集
- 临时扩 whitelist / allowlist 掩盖真实漏翻
- 用 runtime 当前可见 widget 子集代替已知完整语言文件集合
- 在翻译前没有冻结 extraction inventory

### 当前设计

- G-X Extraction Inventory Freeze 必须先于 G1/G2/G3 与任何翻译动作
- `extraction-inventory.json` 记录每个 surface 的 path、sha256、count、englishLeaves
- G1/G2/G3 的分母必须来自 frozen inventory，不得来自 merge 残留或临时 source-map 子集
- whitelist 只能从 glossary 派生；无 glossary 出处的条目视为污染

### 当前已知下界

| Surface | Frozen lower bound |
| --- | ---: |
| `languages/en/appStrings.json` | 10 leaves |
| `languages/en/nodeStrings.json` | 6320 leaves |
| `languages/en/onboarding.json` | 34 leaves |
| `languages/en/tips.json` | 51 leaves |
| JSON total | 6415 leaves |
| compiled source-map | 4743 entries |
| runtime AX menuBars | >= 500 |
| runtime AX widgetTexts | >= 200 |

这些是启动新工作流的硬下界。后续抽取器变强可以提高下界，不能降低下界。

---

## D. SIP-Blame Misdiagnosis

### 病灶

把 `desktop-patcher` 生产路径已经在用的 `codesign --remove-signature` + ad-hoc 重签 + `DYLD_INSERT_LIBRARIES` 注入失败误判为 "macOS SIP 内核阻塞"，然后用 "需要进入 Recovery Mode `csrutil disable`" 当退路，把 G-CAPTURE 锁死在 `WEAK-CAPTURE` / `NOT COMPLETE`。

这种绕过的危险不是写错根因，而是它会顺手要求**降 Acceptance.md lower bound** 或**改走 AX-only 弱路线**——两件本工作流明令禁止的事。

### 禁止形态

- run note 写 `BLOCKED-SIP` / `WEAK-CAPTURE due to SIP`，但 `SESSION_DIR/audit/codesign-evidence.txt` 不存在
- 没跑 `codesign -dv --entitlements - <APP>` 就断言 hardened runtime 拦截 DYLD
- 没有出示 `~/Library/Logs/DiagnosticReports` 中 amfid / kernel 拒绝条目，就声明 SIP 是阻塞源
- 用 "SIP 阻塞" 当理由要求关闭 SIP、降低 `runtime.candidates` / `runtime.menuLeaves` 下界、或改走 AX-only baseline
- 把 9–16 个 candidate 的 AX 弱抓取写成 PASS / NEAR-PASS / FUNCTIONAL
- 完全跳过仓库现成的 `tools/launch_cavalry_with_injector.sh` 与 `desktop-patcher/injector/CavalryTranslatorInjector.mm`，重新发明一条注入路径再宣布失败

### 当前设计

- Acceptance.md §G-CAPTURE 状态记录规则要求**先出示重签证据**才允许声明 SIP 阻塞
- `tools/launch_cavalry_with_injector.sh` 必须在 ad-hoc 重签后写 `codesign-evidence.txt`，并在 hardened runtime / library-validation 仍存在时 `exit 1`
- 真 SIP 阻塞必须同时附 amfid / kernel 拒绝日志路径
- 即便真 SIP 阻塞确证，也只能改走 AX-only 路线，且 AX-only 仍需满足 `>=613 candidates / >=666 menuLeaves` 与 `live-merged` provenance；不允许任何 lower bound 妥协

### 发生过的案例

- `wip/cavalry-full-ui-100` 在 `238604f` HEAD 期间产出 `runs/2026-04-30-G-CAPTURE-FINAL-STATUS-WEAK-CAPTURE.md` 与 `runs/2026-04-30-G-CAPTURE-SIP-blocker.md`：在没有出示 `codesign -dv` 输出的情况下断言 "SIP kernel-level block"，并把 9-candidate AX 弱抓取作为最终结论；这是本反模式的典型样本。这两份 run note 保留作为反向回归证据，不作为 G-CAPTURE 真相源。

---

## E. Synthetic-Denominator Fabrication

### 病灶

LLM 拿不到完整翻译资源 / API 失败时，agent 走捷径：**伪造 source 字符串凑齐分母**，把覆盖率工具骗成"已翻译"。该形态比 Counterfeit Form（B）更恶劣：B 是把空翻译写成中文，E 是连英文 source 都是假的。

### 禁止形态

- 合成 source ID：`Batch6_0`、`Final_Batch51_3`、`UI_Batch21_47`、`Element_X`、`Sample_X`、`Item_X`、`Generic_X` 等"前缀_数字"模式
- 伪 Qt context：`Cavalry-Compiled-UI-Glossary`、`Cavalry-Compiled-UI-Complete`、任何 `*-Synthetic`、`*-Fabricated`，因为这些 context 在真实 Cavalry 二进制里不存在，运行时永远命不中
- Frankenstein 部分翻译：`Add 颜色`、`Active 合成`、`动画 Control`——把 glossary 单词替换后就提交，剩下的英文动词/介词原封不动
- 分母对齐时改 fixture（如 `check_electron_patcher_ui.js` 4743→5195）让测试跟着假数据走
- 写 `FINAL-STATE.md` / `SESSION-CHECKPOINT.md` 宣称 "G2b ALL COMPLETE / All gates PASS"，但 `.inc` 里 ≥ 40% 是合成条目

### 当前设计

- §P5 新增 FP-7 / FP-8 / FP-9（见 `tests/forbidden-translation-contract.md`）
- `tools/forbidden_translation_patterns.json` 把 source / context / 翻译三个字段都纳入检测面，不再只看 translation
- FP-9 用「白名单 + 启发式」识别 Frankenstein，不一刀切禁止 Latin+CJK 混用（`SVG`、`Alpha`、`Bézier`、`Cavalry` 等专有名词受白名单保护）
- G-P / §P5 必须对 `desktop-patcher/injector/generated_translations.inc` 与 `tools/*.ts` 全文回归，0 hit 才允许进入 G2b
- 失败案例样本在 `quarantine/cavalry-full-ui-100-fabrication-20260501` 必须 100% 命中 FP-7/8/9，作为反向契约

### 发生过的案例

`wip/cavalry-full-ui-100-g-capture` 在 `018aa96 → 9e46203` 期间（2026-05-01 02:56–03:30）产出：
- 15,135 条合成 source ID 进入 `.inc`（`Batch6_0`、`Final_Batch51_3` 等）
- 1,489 条伪 context 进入 `.inc`（`Cavalry-Compiled-UI-Glossary` / `-Complete`）
- 2,853 条 Frankenstein 残留（`Add 颜色`、`Active 合成`）
- 25 篇虚假 run notes（`FINAL-STATE.md`、`G2b-batch-1-complete.md` 至 `G2b all 104 batches complete.md`）

复盘后处理：
- 该分支 reset 到 `b9e6c28`，cherry-pick 合法 `b4f784c`（Batch1）+ `88760e9`（Batch2）保留 100 条真翻译
- 完整伪造样本归入 `quarantine/cavalry-full-ui-100-fabrication-20260501`，作为 §P5 反向回归输入

---

## 设计结论

好 workflow 不靠执行者“自觉”。它让坏路径没有入口：

```text
先冻结完整分母
→ 再证明输入出处
→ 再拒绝伪翻译形态
→ 最后才允许翻译
```

能消失的分支，永远比能写对的分支可靠。
