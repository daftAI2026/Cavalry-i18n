# 🌐 Cavalry i18n — Multi-Language Switcher

Third-party multi-language switcher for [Cavalry](https://cavalry.scenegroup.co/) (Qt 6.6.3 2D animation software by Canva).

Switch Cavalry's UI language with one click — no terminal, no external tools, no admin privileges required.

## Supported Languages

| Language | Code | Status |
|----------|------|--------|
| English | `en` | ✅ Built-in (restore original) |
| 简体中文 (Simplified Chinese) | `zh-Hans` | ✅ |
| 繁體中文 (Traditional Chinese) | `zh-Hant` | ✅ |
| 日本語 (Japanese) | `ja_JP` | ✅ |

## Installation

1. Download the latest release from [GitHub Releases](https://github.com/nicedoc/Cavalry-i18n/releases), or clone this repository.
2. Copy `LanguageSwitcher.js` and the `LanguageSwitcher_assets/` folder into your Cavalry Scripts directory (in Cavalry, go to **Window → Scripts → Show Scripts Folder**).
3. In Cavalry, open **Window → Scripts → LanguageSwitcher**.
4. Select your preferred language from the dropdown and click **Apply & Restart**.
5. Cavalry will restart automatically with the new language applied.

## Usage

1. Open the LanguageSwitcher script from Cavalry's Window → Scripts menu.
2. Select a language from the dropdown.
3. Click **Apply & Restart** — the script will overwrite Cavalry's UI strings and restart the application.

To switch back to English, simply select "English" and click Apply & Restart.

## Translation Coverage

The switcher applies two layers of translation:

### Layer 1: JSON String Override

Covers all node names, attributes, descriptions, tips, onboarding text, and plugin strings:

- `nodeStrings.json` — Node types, attributes, enums, tabs (591+ strings)
- `appStrings.json` — Application-level strings
- `tips.json` — Learning tips
- `onboarding.json` — First-run onboarding screens
- 12 plugin files — Filter and effect names

### Layer 2: Qt .qm Translation

Covers Qt standard UI elements (menus, dialogs, buttons):

- `cavalry_xx.qm` — Custom Qt translations for Cavalry-specific menus
- `qtbase_xx.qm` — Official Qt translations (OK, Cancel, File, Edit, etc.)

**Current runtime note:** the repository still stores and validates `.qm` files, but the shipping `LanguageSwitcher.js` currently runs in **JSON-only mode**. Cavalry's public docs do not expose a supported runtime translator-loading API or a documented language preference key, and standard macOS installs also do not ship with a writable `translations/` directory in the app bundle. For now, the switcher applies the JSON string layer only.

## Update Detection

When Cavalry updates, the app bundle is replaced and translations are reset. The switcher detects this automatically:

- On script startup, it compares the saved Cavalry version with the current version
- If a mismatch is detected, it prompts you to re-apply your language pack
- Your language preference is stored in Cavalry's app data folder, and the language packs live in the script's hidden `_assets` directory, both safe from app updates

## Developer Guide

### External Bundle Patcher (Experimental)

If you want to patch a Cavalry bundle **outside** the in-app Script UI runtime, use:

```bash
python3 tools/patch_cavalry_bundle.py \
  --app /Applications/Cavalry.app \
  --output-app ~/Applications/Cavalry-zh-Hans.app \
  --lang zh-Hans \
  --refresh-en \
  --english-output /tmp/cavalry-en \
  --qm-target resources
```

What it does:

1. Extracts current English originals from the installed app bundle
2. Clones the source app to a writable output bundle if `--output-app` is provided
3. Applies the selected JSON language pack to the target bundle
4. Optionally installs `.qm` files to an experimental target directory

If you point `--app` at `/Applications/Cavalry.app`, prefer `--output-app` so the helper patches a writable copy instead of failing on macOS app-bundle permissions.

### Electron Desktop Patcher (Experimental)

If you want a local desktop UI instead of the raw CLI:

```bash
npm install
npm run desktop
```

The Electron app can:

1. auto-detect a local `Cavalry.app`
2. inspect whether the selected bundle actually contains `assets`, plugin strings, and translation directories
3. invoke `tools/patch_cavalry_bundle.py` with the selected language / QM target
4. optionally patch to a separate writable output bundle instead of editing the source app in place

### Reverse-Engineering Notes From the Local Install

Observed on the installed `Cavalry.app` used during development:

1. Cavalry 2.7.0 links Qt 6.6.3 frameworks, so Qt translation infrastructure is present in the process.
2. The shipped bundle still has **no bundled `translations/` directory** and no shipped `.qm` files.
3. App-specific menu labels like `New Scene`, `Import Assets...`, `Project Settings`, `Preferences`, and `About Cavalry` are compiled into `Contents/Frameworks/libExtensionLayer.dylib`, not stored in the JSON translation assets.
4. `strings` / `nm` / `otool` inspection still did **not** surface an obvious app-owned translator-loading path or bundled `cavalry_xx.qm` references.
5. A writable copied bundle was successfully patched with translated JSON files and experimental `.qm` files under `Contents/Resources/translations/`.

### Adding a New Language

1. Create a new directory under `LanguageSwitcher_assets/languages/` (e.g., `LanguageSwitcher_assets/languages/ko_KR/`)
2. Copy all JSON files from `LanguageSwitcher_assets/languages/en/` and translate the whitelisted fields (see `doc/translation-whitelist.json`)
3. Create a `.ts` file in `tools/` for Qt menu translations
4. Validate the translated JSON with `python3 tools/validate_translations.py --json-report /tmp/cavalry-i18n-report.json --markdown-summary /tmp/cavalry-i18n-runlog.md`
5. Compile with `lrelease tools/ko_KR.ts -qm LanguageSwitcher_assets/languages/ko_KR/cavalry_ko_KR.qm`
6. Add the language to `LANGUAGES` and `LANG_KEYS` in `LanguageSwitcher.js`

### Compiling .qm Files

```bash
# Requires Qt tools (lrelease)
# macOS: brew install qt
# Ubuntu: sudo apt-get install qttools5-dev-tools

lrelease tools/zh-Hans.ts -qm LanguageSwitcher_assets/languages/zh-Hans/cavalry_zh-Hans.qm
lrelease tools/zh-Hant.ts -qm LanguageSwitcher_assets/languages/zh-Hant/cavalry_zh-Hant.qm
lrelease tools/ja_JP.ts -qm LanguageSwitcher_assets/languages/ja_JP/cavalry_ja_JP.qm
```

### Project Structure

```
Cavalry-i18n/
├── LanguageSwitcher.js          # Main script (install this)
├── LanguageSwitcher_assets/     # Hidden at runtime in Cavalry Scripts menu
│   └── languages/
│       ├── en/                  # English originals (extracted from Cavalry)
│       ├── zh-Hans/             # Simplified Chinese translations
│       ├── zh-Hant/             # Traditional Chinese translations
│       └── ja_JP/               # Japanese translations
├── desktop-patcher/
│   ├── main.js                  # Electron main process
│   ├── preload.js               # Safe renderer bridge
│   ├── lib/patcher-config.js    # Shared path/language helpers
│   └── renderer/                # External patcher UI
├── tools/
│   ├── extract_strings.py       # Extract English strings from Cavalry
│   ├── patch_cavalry_bundle.py  # External experimental bundle patcher
│   ├── check_electron_patcher_ui.js # Electron patcher contract test
│   ├── validate_translations.py # Translation quality gates + runlog/report output
│   ├── zh-Hans.ts / zh-Hant.ts / ja_JP.ts  # Qt Linguist source files
├── doc/
│   ├── cavalry-glossary.md      # 94-term four-language glossary
│   └── translation-whitelist.json
├── package.json                 # Electron desktop patcher scripts
└── .github/workflows/build.yml  # CI: validate translations + desktop patcher + compile .qm + release
```

## Credits

- [Cavalry](https://cavalry.scenegroup.co/) by Scene Group (Canva) — the 2D animation software
- Qt translation files from the [Qt Project](https://www.qt.io/)
- Glossary based on Cavalry's official documentation and community conventions

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

This is a third-party community project and is not affiliated with or endorsed by Scene Group or Canva.
