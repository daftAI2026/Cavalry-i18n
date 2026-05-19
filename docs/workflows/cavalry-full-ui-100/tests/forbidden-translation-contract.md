<!--
[INPUT]: Acceptance.md §P5、Runbook.md Anti-Bypass Rule、Anti-Patterns.md §B/§E/§F、archive 污染样本与 quarantine fabrication/transliteration 反向样本
[OUTPUT]: §P5 Forbidden-Translation Patterns FP-1/2/3/4/5/7/8/9/10/11/12 detector 契约测试集合
[POS]: full-ui-100 反伪翻译契约
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Forbidden-Translation Contract — §P5 反伪翻译契约

> 本契约规定 `tools/check_runtime_ui_coverage.js` / `tools/validate_translations.py` / `tools/verify_gate_inputs.js` / `tools/validate_batch_translations.js` 在面对历史污染样本与 2026-05-01 伪造样本时 **必须 fail**。

## 适用范围

| Surface | 路径 | detector |
| --- | --- | --- |
| Runtime inventory | `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/runtime/<lang>-merged-inventory.json` | `tools/check_runtime_ui_coverage.js` |
| Compiled source-map / audit result | `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json` 及其审计输出 | `tools/verify_gate_inputs.js` |
| Derived injector translation output | `injector/generated_translations.inc` | `tools/validate_translations.py` |
| Qt translation source | `tools/zh-Hans.ts` / `tools/zh-Hant.ts` / `tools/ja_JP.ts` | `tools/validate_translations.py` |
| JSON 资产 | `languages/<lang>/**.json` | `tools/validate_translations.py` |
| 批次翻译输入 | LLM 批次产出（落盘前） | `tools/validate_batch_translations.js` |
| Pre-flight | 上述全部 | `tools/verify_gate_inputs.js` |

## Forbidden Pattern 一览

| ID | 判定对象 | 判定 | 说明 |
| --- | --- | --- | --- |
| FP-1 | translation | `（译）` / `（訳）` / `（譯）` | 占位标记 |
| FP-2 | translation | `[\uFF21-\uFF3A\uFF41-\uFF5A]` | 全角拉丁字母 |
| FP-3 | translation | `^(?:页|頁|ページ):?\d+$` | 错位填词 |
| FP-4 | translation in zh-Hant | 出现典型简体字符（含术语映射） | 简繁串味 |
| FP-5 | translation in zh-Hans | 出现典型繁体字符（含术语映射） | 繁简串味 |
| FP-7 | **source** | `^([A-Za-z]+_)?Batch\d+_\d+$` 或 `^(Element|Sample|Item|Generic|Final|Placeholder|Filler|Test|Dummy|String|Token|Entry)_\d+$` | **合成 source ID（伪造分母）** |
| FP-8 | **context** | `^Cavalry-(Compiled|Runtime)-UI-(Glossary|Complete|Generic|Synthetic)$` 或 `-Synthetic$` / `-Fabricated$` | **真实 Cavalry 二进制中不存在的 Qt context** |
| FP-9 | translation (zh-Hans / zh-Hant / ja_JP) | 翻译同时含 CJK 与「白名单外的普通英文词」（≥2 字母、非全大写缩写、非保留品牌/格式名） | **Frankenstein 中英夹杂残留** |
| FP-10 | source + translation | 字体/glyph/noise source（如 `Acce` / `Arial` / `Audif`）被翻成 CJK/Kana 且不等于 source | **无意义 source 音译** |
| FP-11 | source + translation | source 命中字体样本 pangram（如 `ahk ISK bhk DBX khk GNM nhk`）且 translation 不等于 source | **字体样本噪声被翻译** |
| FP-12 | aggregate translation reuse | 同一非受控 translation 跨超过 2 个不同 source 复用 | **占位/泛化翻译复用** |

### FP-9 白名单原则

合理保留英文的场景属于**白名单**，不触发 FP-9：

- 协议/格式/缩写：`SVG` `JSON` `RGB` `RGBA` `HSL` `HSV` `Alpha` `Beta` `UV` `IK` `FK` `2D` `3D` `FPS`
- 品牌/产品名：`Cavalry` `Canva` `Adobe` `Houdini` `Maya` `Blender` `Tauri` `Electron` `Qt`
- 单字母轴/参数：`x` `y` `z` `w` `A` `B` `R` `G` `H` `L`
- 数学/算法术语：`Bezier` `Catmull` `Hermite` `NURBS` `Voronoi` `Perlin` `Simplex`
- 文件格式：`MP4` `MOV` `WEBM` `GIF` `PRORES` `H264` `H265`

完整白名单见 `tools/forbidden_translation_patterns.json` 的 `latinResidue.reservedTokens`，可叠加 `tools/runtime_ui_allowlist.json`。

新增白名单条目时必须在本契约更新理由（哪个 source 出现、为什么不可翻译）。

## 正向契约（必须 fail）

1. `上传预设管理器（译）` → FP-1
2. `ＲＧＢ` / `Ａｌｐｈａ` → FP-2
3. `页:1` / `頁:2` / `ページ3` → FP-3
4. zh-Hant 中的简体字符 → FP-4
5. zh-Hans 中的繁体字符 → FP-5
6. `source = "Batch6_0"` / `"Final_Batch51_3"` / `"UI_Batch21_47"` / `"Element_12"` / `"Sample_4"` → **FP-7**
7. `context = "Cavalry-Compiled-UI-Glossary"` / `"Cavalry-Compiled-UI-Complete"` / `"FooBar-Synthetic"` → **FP-8**
8. zh-Hans `Add 颜色` / `Active 合成` / `动画 Control` / `添加 SVG to 合成`（`to` 是普通介词残留） → **FP-9**
9. `source = "Acce"` + zh-Hans `重音符`、`source = "Arial"` + ja_JP `アリアル` → **FP-10**
10. `source = "ahk ISK bhk DBX khk GNM nhk"` + zh-Hans `阿赫克 伊斯克 ...` → **FP-11**
11. ja_JP `文字列形式が正しくありません` 同时用于 3 个无关 source → **FP-12**

## 反向契约（必须不报）

1. zh-Hans `添加 SVG 到合成`（SVG 是协议名，受白名单保护） → 不触发 FP-9
2. zh-Hans `切换背景 Alpha`（Alpha 受白名单保护） → 不触发 FP-9
3. zh-Hans `2026 场景编组 Ltd.`（年份数字 + 公司名 Ltd 通过白名单或全大写规则） → 视配置不报或可显式允许
4. `context = "QMenuBar"` / `"MenuBarManager"` / `"AppName"` → 不触发 FP-8
5. `source = "Add Spacer"` / `"Add SVG to Composition"` / `"Cavalry"` → 不触发 FP-7
6. `source = "Acce"` + `translation = "Acce"` → 不触发 FP-10/11，因为 no-translate passthrough 是剔除前的保守状态
7. main 干净样本零误报；archive 污染样本与 quarantine 伪造样本 100% 命中

## 反向回归

- archive 污染样本：`archive/cavalry-full-ui-100-v2-invalidated-20260428` HEAD 的 `.inc` 与 `.ts`，FP-1/2/3/4/5 必须命中
- 伪造样本：`quarantine/cavalry-full-ui-100-fabrication-20260501` HEAD 的 `.inc` 与 `.ts`，FP-7 / FP-8 / FP-9 必须 100% 命中（合计 ≥ 16,000 条 hit）
- 音译样本：`quarantine/cavalry-full-ui-100-transliteration-20260507` HEAD 的 `.inc` 与 `.ts`，FP-10 / FP-11 / FP-12 必须各命中 > 0
- main 干净样本：必须零 hit

## 位置约束

- 本契约文档 = 真相源
- 配置文件 = `tools/forbidden_translation_patterns.json`
- 实现 = `tools/forbidden_translation_patterns.py` / `tools/forbidden_translation_patterns.js`
- 调用方 = `tools/validate_translations.py` / `tools/check_runtime_ui_coverage.js` / `tools/verify_gate_inputs.js` / `tools/validate_batch_translations.js`
- 实现与契约冲突时，以本契约与 `Acceptance.md` 为准

## 变更日志

- 2026-04-28: FP-1/2/3/4/5 初版；旧自我递归 ID 已弃用
- 2026-05-01: 新增 FP-7（合成 source ID）/ FP-8（伪 context）/ FP-9（Frankenstein 白名单+启发式），来源样本 `quarantine/cavalry-full-ui-100-fabrication-20260501`
- 2026-05-07: 新增 FP-10（音译）/ FP-11（pangram 噪声）/ FP-12（translation reuse cap），来源样本 `quarantine/cavalry-full-ui-100-transliteration-20260507`
