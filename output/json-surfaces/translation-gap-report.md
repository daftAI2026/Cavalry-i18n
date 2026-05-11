# Translation Gap Report

[PROTOCOL]: Updated 2026-05-11 after integrating the audited 38 JSON surfaces into `languages/` and `src-tauri/src/patch.rs`.

## Current Status

The JSON surface work is now integrated, not just staged as draft:

- `languages/en/` is the 38-file English source truth.
- `languages/zh-Hans/`, `languages/zh-Hant/`, and `languages/ja_JP/` each contain the same 38 JSON paths.
- `output/json-surfaces/draft/{zh-Hans,zh-Hant,ja_JP}/` is synchronized from the checked-in language packages and remains an audit/workspace copy only.
- `src-tauri/src/patch.rs` maps the 14 non-plugin JSON files, the 12 plugin definition files, and the 12 discovered plugin `strings.json` files.
- `tools/validate_translations.py` treats plugin `*Definitions.json` as no-translate technical schemas and ordinary plugin `strings.json` tabs as user-visible text.

## Summary

| Metric | zh-Hans | zh-Hant | ja_JP |
|---|---:|---:|---:|
| Total JSON files | 38 | 38 | 38 |
| Previously covered files retained | 16 | 16 | 16 |
| New user-visible files translated | 7 | 7 | 7 |
| New zero-user-visible files preserved | 15 | 15 | 15 |
| Files deferred | 0 | 0 | 0 |

The file-count categories are non-overlapping: `16 + 7 + 15 + 0 = 38`.

## Translated User-Visible Surfaces

### Learn/Guides/strings.json

- 73 onboarding UI strings translated per language.
- zh-Hant `Back` is the navigation action `上一步`, not 3D `背面`.
- ja_JP `Done` is `完了`, not `ログイン`.
- `Notes` means annotations: zh-Hans `注释`, zh-Hant `註解`.

### Definitions/systemPresets.json

- 10 user-visible `name` fields translated per language.
- UUIDs, regex patterns, attrIds, enums, booleans, and other technical fields remain unchanged.

### Definitions/nodeDefinitions.json

- User-visible display names, placeholder hints, and companion action names translated.
- Technical definition fields remain unchanged.

### MetaData/*.json

| File | Description fields | Status |
|---|---:|---|
| api_function_metadata.json | 199 | Done |
| core_api_function_metadata.json | 164 | Done |
| gui_api_function_metadata.json | 80 | Done |
| widget_api_function_metadata.json | 35 | Done |
| **Total** | **478** | **Done in all 3 languages** |

Only documentation `description` strings are translated. API function names, argument names, return types, namespaces, and type declarations stay in English. The earlier prefill bug where `type` values such as `Object`, `Matrix`, and `String` were translated has been corrected.

### Plugin strings tabs

- `plugins/spheriseFilter.json` tabs are now covered by the translation whitelist.
- zh-Hans: `Settings` -> `设置`, `Lighting` -> `光照`.
- zh-Hant: `Settings` -> `設定`, `Lighting` -> `光照`.
- ja_JP: `Settings` -> `設定`, `Lighting` -> `ライティング`.

## Preserved Technical Surfaces

### plugins/*Definitions.json

The 12 plugin definition files are preserved byte-for-byte from the English baseline in each target language. They contain GPU filter schemas, not UI copy:

- Attribute IDs, conditions, triggers, and internal keys.
- Type declarations such as `double`, `bool`, `int`.
- Numeric defaults/ranges/steps.
- Shader paths, icon paths, separators, RGBA tuples, and hidden UI schema values.

Translating these values would break plugin behavior. `tools/translation-whitelist.json` now classifies them under `pluginDefinitions` as no-translate schema files.

### Learn/Guides/guides.json

Preserved as technical guide data: widget tags, category IDs, JavaScript snippets, and string-key references.

### Style/theme.json and Style/layout.json

Preserved as theme/layout configuration: colors, font paths, Qt palette roles, semantic color keys, and empty layout config.

## Quality Gates

- JSON structure parity: PASS.
- no_translate parity: PASS.
- placeholder parity: PASS.
- English residue: PASS.
- leaf coverage: PASS.
- locale_sync: PASS.
- language purity: PASS.
- forbidden patterns FP-1/2/3/4/5/7/8/9/10/11/12: PASS.

Latest direct validator command:

```bash
python3 tools/validate_translations.py --root . --json-report /tmp/cavalry-validate-report.json --markdown-summary /tmp/cavalry-validate-summary.md
```

Result: PASS, with 6028 translate leaves per language, 0 exact-English untranslated leaves, and 0 English residue.

## Remaining Handoff Notes

- Do not re-run the removed one-off `tools/translate_api_metadata.py`; it was a process artifact with absolute paths and has been deleted.
- `output/json-surfaces/` remains derived audit material. Runtime source truth is `languages/` plus the copy mapping in `src-tauri/src/patch.rs`.
- Before release, still run the broader app/build checks after any further edits.
