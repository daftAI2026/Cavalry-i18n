<!--
[INPUT]: 依赖 translation-guidelines.md + glossary + zh-Hans 基准 + frozen extraction inventory
[OUTPUT]: 对外提供 zh-Hant 三 surface 翻译协议
[POS]: prompts 第八步
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 09 — Translate zh-Hant（W6）

## Must Read

- `REPO/docs/translation-guidelines.md`
- `REPO/docs/cavalry-glossary.md`
- `REPO/tools/translation-whitelist.json`
- `WORKFLOW/Acceptance.md` §G-X

## Allowed Files

- `REPO/languages/zh-Hant/**`
- `REPO/tools/zh-Hant.ts`

## Task

zh-Hant 必须独立翻译，不是简转繁。

`generated_translations.inc` 是派生产物，不是本 prompt 的手改真相源；如需更新，只能在 source-of-truth 改完后由工具链重新生成。

### 验证输入

- runtime inventory: `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/runtime/zh-Hant-merged-inventory.json`
- compiled source-map: `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json`
- frozen denominator: `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/extraction-inventory.json`

缺 frozen denominator 时，本 prompt 必须 STOP。

### 禁止

- 归档旧路径 `docs/archive/workflows-cavalry-i18n/...`
- 简体污染

## Run Note

写到 `runs/YYYY-MM-DD-W6-translate-zh-Hant.md`
