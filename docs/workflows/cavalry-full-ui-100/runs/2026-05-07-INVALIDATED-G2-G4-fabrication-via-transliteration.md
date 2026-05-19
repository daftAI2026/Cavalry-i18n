<!--
[INPUT]: 依赖 quarantine/cavalry-full-ui-100-transliteration-20260507 @ 2db74b7、session 1D78B1A9 run record、tools/{zh-Hans,zh-Hant,ja_JP}.ts 与 desktop-patcher/injector/generated_translations.inc 抽样
[OUTPUT]: 对外提供 2026-05-07 G2/G4 “ALL GATES PASS” 结论的 INVALIDATED 取证与 FP-10/11/12 反模式登记
[POS]: runs 的反向回归记录，证明 gate 数字 PASS 不等于翻译合格
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-05-07 INVALIDATED — G2/G4 “ALL GATES PASS” via FP-10/11/12 fabrication

## Status

INVALIDATED

## Why this overrides the prior PASS claim

`runs/2026-05-07-G2-G4-all-gates-pass.md`（已删除，重命名为本文件）声明 cavalry-full-ui-100 全部 gate 通过。
`SESSION_DIR/full-ui-run-record.json` 数字层面确实 `overallPass=true / blockedReason=null`，
但 worktree 中带来这次 PASS 的 `tools/{zh-Hans,zh-Hant,ja_JP}.ts` 与
`desktop-patcher/injector/generated_translations.inc` 改动里有大规模伪翻译，
当前 `tools/validate_translations.py` 的 FP-1..FP-9 detector 不覆盖这三类形态，
所以 §P5 的 PASS 与 G2/G4 的 100% 都是 detector 盲区下的幻觉，不构成真正的合格证据。

按 `runs/CLAUDE.md` 的规则，复审红灯成立但尚未修代码时，状态写 `FAIL` / `INVALIDATED`，不得保留 `PASS`；
本文件即作为该规则的执行记录，把 2026-05-07 PASS run note 整体降级为反向取证。

## Quarantine evidence

```text
quarantine branch = quarantine/cavalry-full-ui-100-transliteration-20260507
quarantine head   = 2db74b7
quarantine diff   = +47638 / -868 across:
                    tools/zh-Hans.ts
                    tools/zh-Hant.ts
                    tools/ja_JP.ts
                    desktop-patcher/injector/generated_translations.inc
session uuid      = 1D78B1A9-37BE-4360-B61F-A0314766F7D6
worktree branch   = wip/cavalry-full-ui-100-g-capture
worktree head     = c89533e (后续不复用 2026-05-07 那批 TS/inc 改动)
```

## New forbidden-pattern classes (FP-10 / FP-11 / FP-12)

下列形态由本轮抽样在 quarantine diff 中直接观察得到。
当前 detector 对这三类零命中，必须先把它们入 §P5 detector 与 `tools/translation-whitelist.json` 契约，再谈 G2/G3/G4。

### FP-10 — Transliteration of meaningless / brand-name source

把无意义短串、字体家族名、错误码片段等当成自然语言，按字符音译为目标语言。

样本：

```text
source="Acce"          translation(zh-Hans)="重音符"     translation(ja_JP)="アクセ"
source="Acutesmall"    translation(zh-Hans)="小锐音符"   translation(ja_JP)="小アキュート"
source="Asse"          translation(zh-Hans)="阿塞"       translation(ja_JP)="アッセ"
source="Audif"         translation(zh-Hans)="奥迪夫"     translation(ja_JP)="オーディフ"
source="Ayhb"          translation(zh-Hans)="艾赫布"     translation(ja_JP)="エイワイエイチビー"
source="Arial"         translation(zh-Hans)="艾瑞尔"     translation(ja_JP)="アリアル"
source="Apple Color Emoji" translation(zh-Hans)="苹果彩色表情符号" translation(ja_JP)="アップルカラー絵文字"
```

判定原则：

- source 为字体家族 / 颜色品牌名 / Unicode glyph 名 / 错误码碎片时，目标语言必须是 no-translate 或 glossary-controlled 翻译，禁止音译
- source 长度 ≤ 6 且全部 ASCII 字母、且 translation 是字符级音译（声母+韵母模板）时硬失败

### FP-11 — Font-sample / pangram noise translated as text

Qt / Cavalry 字体预览面板里的伪文本被当成自然语言强行翻译。

样本：

```text
source="ahk ISK bhk DBX khk GNM nhk"  translation(zh-Hans)="阿赫克 伊斯克 贝赫克 德贝克斯 卡赫克 吉恩姆 恩赫克"
source="ams MSS dms NBM jms MSL lms"  translation(zh-Hans)="阿姆斯 姆斯斯 德姆斯 恩贝姆 杰姆斯 姆斯尔 勒姆斯"
source="ats PPC vts GIS qus RUS rus"  translation(zh-Hans)="阿茨 皮皮西 维茨 吉艾斯 库斯 鲁斯 鲁斯"
source="bby LMB dby KRA ddy IIJ hiy IIJ miy"  translation(zh-Hans)="字体样本文本"
source="B ffff."     translation(zh-Hans)="字母乙四连。"
```

判定原则：

- source 命中 `^([a-z]{2,4}\s[A-Z]{2,4}\s){2,}` 等字体 pangram 模式时，应被 G-X 从 extraction inventory 剔除，而不是进入翻译表
- 一旦进入翻译表，validator 必须硬失败：这种 source 没有 UI 语义，任何 translation 都是 fabrication

### FP-12 — Placeholder / generic translation reuse

同一 translation 被复用到多个语义无关 source；典型为日语侧反复出现 `文字列形式が正しくありません`。

样本：

```text
source="Acce"           translation(ja_JP)="アクセ"
source="Acutesmall"     translation(ja_JP)="小アキュート"
source="<...其他无关 source...>"  translation(ja_JP)="文字列形式が正しくありません"
（同一 translation 在 ja_JP.ts 同一上下文区段反复出现）
```

判定原则：

- 同一 translation 字符串被 ≥ N 个 source（建议 N=2，且 source 之间编辑距离 > K）共享时硬失败
- 例外只允许 glossary 标注的 controlled-vocabulary（如 “OK / 取消” 这种公认 UI 词）

### Structural smell — duplicated `<message>` blocks within a single TS

同一 source 在 `tools/zh-Hans.ts` 等单文件内出现 ≥ 3 次（`Acce` / `Acutesmall` / `ahk ISK bhk DBX khk GNM nhk`），
说明翻译表生成器没有去重，或 G-X 分母把同一字符串在不同 owner / context 下重复登记。
本身不是 forbidden pattern，但是 FP-10/11/12 能大批量出现的结构温床；
必须在分母清洗阶段顺手归一。

## Quarantine reverification command

```text
git switch quarantine/cavalry-full-ui-100-transliteration-20260507
python3 tools/validate_translations.py \
  --root . \
  --json-report /tmp/quarantine-p5.json \
  --markdown-summary /tmp/quarantine-p5.md
# 期望：FP-10/11/12 detector 落地后，三类 hit 数必须 > 0；
# 当前 detector 不覆盖，所以本命令在 detector 升级前对 quarantine 仍会 PASS——
# 这正是问题所在。
```

## Workflow correction (binding instructions)

下面列条目同时进入 `Acceptance.md` / `Project.md` / `TODO.md` / `Anti-Patterns.md`，本 run note 只做索引。

1. §P5 detector 集合扩展为 FP-1/2/3/4/5/7/8/9/10/11/12，并在 `tools/translation-whitelist.json` 注册三条新契约。
2. G-X 分母清洗：`tools/freeze_extraction_inventory.js` 必须在冻结前剔除字体家族名 / 颜色品牌名 / 字体样本 pangram / 长度 ≤ 6 的无义 ASCII 短串；剔除规则进 `tools/translation-whitelist.json`。
3. G-X 重新冻结：jsonTotal / compiledCandidates / runtimeCandidates 在剔除后必然下降，新分母作为本轮真相，不复用 `1D78B1A9-37BE-4360-B61F-A0314766F7D6` 旧分母。
4. G2 / G3 / G4 在新分母上重译；翻译只能由 LLM 在带 source / context / glossary / whitelist 的 prompt 下产出；任何音译 / 占位词复用 / pangram 翻译都不接受。
5. 在 `runs/` 写新一轮 reverify run note；本文件保留为反向回归证据，不删除。

## Out of scope for this note

- 不动 `tools/validate_translations.py` 当前实现：detector 升级走单独 prompt
- 不动 `tools/freeze_extraction_inventory.js` 当前实现：分母剔除走单独 prompt
- 不重新启动 Cavalry 抓 runtime：现有 session `1D78B1A9` 的 AX/injector 抓取仍可用，只需要在新分母上重新过 gate
