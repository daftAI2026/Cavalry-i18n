# Cavalry i18n

Desktop-only JSON patcher for [Cavalry](https://cavalry.scenegroup.co/).

The project now has a single supported path:

1. Detect a local `Cavalry.app`
2. Extract the current English JSON assets into the app-specific state directory
3. Copy a selected language pack back into `Contents/assets/...`
4. Relaunch Cavalry

Qt `.qm` loading, DYLD injector experiments, and the old Script UI entrypoint are removed.

## Supported languages

| Language | Code |
| --- | --- |
| English | `en` |
| 简体中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## Run the desktop patcher

```bash
npm install
npm run desktop
```

The app will try these paths automatically:

1. the last path saved in `state.json`
2. `/Applications/Cavalry.app`
3. `~/Applications/Cavalry.app`

If none are found, use the folder button to browse manually.

## Runtime state

Electron stores runtime data under `app.getPath('userData')`.

- `state.json` tracks the selected app path, the last patched Cavalry version, the active language, and the last patch timestamp
- `en/` stores the extracted English JSON snapshot for the selected Cavalry version

At runtime, restoring English uses the extracted snapshot from the selected install, not a bundled repo copy.

## Repository layout

```text
Cavalry-i18n/
├── desktop-patcher/
│   ├── main.js
│   ├── preload.js
│   ├── lib/
│   │   ├── detect.js
│   │   ├── patch.js
│   │   └── sudo.js
│   └── renderer/
├── languages/
│   ├── en/          # tracked English baseline for translation QA
│   ├── zh-Hans/
│   ├── zh-Hant/
│   └── ja_JP/
├── doc/
│   ├── cavalry-glossary.md
│   ├── translation-guidelines.md
│   └── translation-whitelist.json
└── tools/
    ├── check_electron_patcher_ui.js
    └── validate_translations.py
```

`languages/en` stays in git for translation validation and review, but the running patcher does not depend on it for restore operations.

## Translation validation

```bash
python3 tools/validate_translations.py \
  --root . \
  --json-report /tmp/cavalry-i18n-report.json \
  --markdown-summary /tmp/cavalry-i18n-runlog.md
```

Validation rules are defined in `doc/translation-whitelist.json`.

## Risk note

Patching files inside `Cavalry.app` can affect how macOS code-signature verification reports the app bundle. The patcher surfaces that warning after apply, but it does not block the language switch.
