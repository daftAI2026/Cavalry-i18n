<!--
[INPUT]: 依赖 translation-guidelines.md + glossary ja_JP 列 + frozen extraction inventory
[OUTPUT]: 对外提供 ja_JP 三 surface 翻译协议
[POS]: prompts 第九步
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 10 — Translate ja_JP（W7）

## Must Read

- `REPO/docs/translation-guidelines.md`
- `REPO/docs/cavalry-glossary.md`
- `REPO/tools/translation-whitelist.json`
- `WORKFLOW/Acceptance.md` §G-X

## Allowed Files

- `REPO/languages/ja_JP/**`
- `REPO/tools/ja_JP.ts`

## Task

ja_JP 采用日语 UI 术语与片假名规范，禁止日英半混合。

`generated_translations.inc` 是派生产物，不是本 prompt 的手改真相源；如需更新，只能在 source-of-truth 改完后由工具链重新生成。

### 验证输入

- runtime inventory: `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/runtime/ja_JP-merged-inventory.json`
- compiled source-map: `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json`
- frozen denominator: `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/extraction-inventory.json`

缺 frozen denominator 时，本 prompt 必须 STOP。

### 禁止

- 旧路径 `docs/workflows/cavalry-i18n/...`
- 中文 UI 术语污染

## Run Note

写到 `runs/YYYY-MM-DD-W7-translate-ja_JP.md`
