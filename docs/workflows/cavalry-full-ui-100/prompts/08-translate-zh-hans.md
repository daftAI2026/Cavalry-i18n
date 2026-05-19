<!--
[INPUT]: 依赖 translation-guidelines.md + glossary + whitelist + frozen extraction inventory + source-map
[OUTPUT]: 对外提供 zh-Hans 三 surface 翻译协议
[POS]: prompts 第七步
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 08 — Translate zh-Hans（W5）

## Must Read

- `REPO/docs/translation-guidelines.md`
- `REPO/docs/cavalry-glossary.md`
- `REPO/docs/cavalry-glossary-en-zh.md`
- `REPO/tools/translation-whitelist.json`
- `WORKFLOW/Acceptance.md` §G-X

## Allowed Files

- `REPO/languages/zh-Hans/**`
- `REPO/tools/zh-Hans.ts`

## Task

zh-Hans 是基准语言，按 JSON / compiled / runtime 三个 surface 清零。

`generated_translations.inc` 是派生产物，不是本 prompt 的手改真相源；如需更新，只能在 source-of-truth 改完后由工具链重新生成。

### 验证输入

- runtime inventory: `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/runtime/zh-Hans-merged-inventory.json`
- compiled source-map: `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json`
- frozen denominator: `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/extraction-inventory.json`

缺 frozen denominator 时，本 prompt 必须 STOP。

### 禁止

- 旧路径 `docs/workflows/cavalry-i18n/...`
- 本地词表 / 占位标记 / 全角化

## Run Note

写到 `runs/YYYY-MM-DD-W5-translate-zh-Hans.md`
