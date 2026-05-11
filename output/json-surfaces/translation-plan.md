# Cavalry JSON Surface Translation Plan

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## Scope

38 个 Cavalry JSON asset 已抓取到 `output/json-surfaces/en/`。
当前 `languages/*` 已覆盖 16 个，新增待翻译 surface 为 22 个。

## Current Denominator

- Total JSON files: 38
- Already covered by `languages/*`: 16
- Newly uncovered files: 22
- Total string leaves across 38 files: 24939
- Existing translation table prefilled leaves:
  - zh-Hans: 6086
  - zh-Hant: 6087
  - ja_JP: 6110

## Workflow

1. Review `output/json-surfaces/asset-map.json`.
2. Translate files under `output/json-surfaces/draft/{lang}/`.
3. Prioritize user-visible files first:
   - `Learn/Guides/*.json`
   - `plugins/*Definitions.json`
   - `Definitions/systemPresets.json`
   - `Definitions/nodeDefinitions.json`
4. Treat `MetaData/*.json` as second pass; many leaves are API docs or developer metadata.
5. After translation, copy approved draft files into `languages/{lang}/`.
6. Only then update `src-tauri/src/patch.rs` so apply-language copies all 38 JSON assets.
7. Run validation and package tests before applying to `/Applications/Cavalry.app`.

## Rule

Do not package untranslated drafts. English fallback in draft files is evidence of work remaining, not release-ready translation.
