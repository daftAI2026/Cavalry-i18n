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
2. Copy `LanguageSwitcher.js` and the `languages/` folder into your Cavalry Scripts directory (in Cavalry, go to **Window → Scripts → Show Scripts Folder**).
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

## Update Detection

When Cavalry updates, the app bundle is replaced and translations are reset. The switcher detects this automatically:

- On script startup, it compares the saved Cavalry version with the current version
- If a mismatch is detected, it prompts you to re-apply your language pack
- Your language preference and language packs are stored in the Scripts directory, safe from updates

## Developer Guide

### Adding a New Language

1. Create a new directory under `languages/` (e.g., `languages/ko_KR/`)
2. Copy all JSON files from `languages/en/` and translate the whitelisted fields (see `doc/translation-whitelist.json`)
3. Create a `.ts` file in `tools/` for Qt menu translations
4. Validate the translated JSON with `python3 tools/validate_translations.py --json-report /tmp/cavalry-i18n-report.json --markdown-summary /tmp/cavalry-i18n-runlog.md`
5. Compile with `lrelease tools/ko_KR.ts -qm languages/ko_KR/cavalry_ko_KR.qm`
6. Add the language to `LANGUAGES` and `LANG_KEYS` in `LanguageSwitcher.js`

### Compiling .qm Files

```bash
# Requires Qt tools (lrelease)
# macOS: brew install qt
# Ubuntu: sudo apt-get install qttools5-dev-tools

lrelease tools/zh-Hans.ts -qm languages/zh-Hans/cavalry_zh-Hans.qm
lrelease tools/zh-Hant.ts -qm languages/zh-Hant/cavalry_zh-Hant.qm
lrelease tools/ja_JP.ts -qm languages/ja_JP/cavalry_ja_JP.qm
```

### Project Structure

```
Cavalry-i18n/
├── LanguageSwitcher.js          # Main script (install this)
├── languages/
│   ├── en/                      # English originals (extracted from Cavalry)
│   ├── zh-Hans/                   # Simplified Chinese translations
│   ├── zh-Hant/                   # Traditional Chinese translations
│   └── ja_JP/                   # Japanese translations
├── tools/
│   ├── extract_strings.py       # Extract English strings from Cavalry
│   ├── validate_translations.py # Translation quality gates + runlog/report output
│   ├── zh-Hans.ts / zh-Hant.ts / ja_JP.ts  # Qt Linguist source files
├── doc/
│   ├── cavalry-glossary.md      # 94-term four-language glossary
│   └── translation-whitelist.json
└── .github/workflows/build.yml  # CI: validate translations + compile .qm + release
```

## Credits

- [Cavalry](https://cavalry.scenegroup.co/) by Scene Group (Canva) — the 2D animation software
- Qt translation files from the [Qt Project](https://www.qt.io/)
- Glossary based on Cavalry's official documentation and community conventions

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

This is a third-party community project and is not affiliated with or endorsed by Scene Group or Canva.
