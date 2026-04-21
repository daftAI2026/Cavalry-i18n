# Cavalry i18n

Desktop patcher for [Cavalry](https://cavalry.scenegroup.co/).

The desktop patcher works against the original installed app:

1. Detect a local `Cavalry.app`
2. Extract the current English JSON assets into the app-specific state directory
3. Patch the selected language files back into that same app bundle
4. On macOS, install a small launcher wrapper plus the translator injector inside the same `Cavalry.app` so the original app path opens in the target language

On Windows, the patcher still applies the selected JSON files directly to the chosen install.

The automatic patch flow only replaces the language files it needs. On macOS it re-signs the modified bundle and clears the `com.apple.quarantine` attribute recursively so Gatekeeper is less likely to block the patched app on relaunch.
On macOS, if direct shell copy into `/Applications/...app` is blocked while restoring English, the patcher retries with a Finder-style replacement flow. Approve Finder control if macOS prompts for it.

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

To build the distributable macOS patcher app itself:

```bash
npm run build
```

The injector must be built against the same Qt minor branch that Cavalry ships. The current Cavalry.app bundle uses **Qt 6.6.3**, so local injector builds should use **Qt 6.6.x** as well. The build script now refuses to compile if the build-time Qt branch does not match the target Cavalry Qt branch, and the injector also checks the runtime Qt branch before installing translations. `npm run build` now pins `CAVALRY_QT_VERSION=6.6.3` by default, and you can override the Qt install root with `CAVALRY_QT_PREFIX` or `QT_ROOT_DIR` if needed.

The exact Qt string table that gets compiled into `libCavalryTranslatorInjector.dylib` is checked into `desktop-patcher/injector/generated_translations.inc`, and `npm run test:desktop` regenerates it from `tools/*.ts` to make sure the checked-in file stays in sync.

## UI text workflow

There are **two** translation surfaces in this project:

1. **JSON-backed assets** — `nodeStrings`, `appStrings`, `tips`, `onboarding`, and plugin `strings.json`
2. **Compiled Qt/UI text** — menu labels, actions, panel titles, and other strings that live in `Cavalry.app` binaries/frameworks rather than JSON files

The repo tracks the compiled UI surface in two forms:

1. `doc/compiled-ui-source-map.json` — a checked-in ownership map for what lives in JSON assets vs compiled UI binaries
2. `~/Library/Caches/Cavalry-i18n/menu-inventory.json` — the authoritative runtime menu tree dumped from the live app

Refresh the compiled binary inventory from a clean local install with:

```bash
npm run extract:compiled-ui
```

That command reads `/Applications/Cavalry.app`, inventories likely user-visible strings from:

- `Contents/MacOS/Cavalry`
- `Contents/Frameworks/libCavalryUI.dylib`
- `Contents/Frameworks/libCavalryFramework.dylib`

and rewrites `doc/compiled-ui-source-map.json`.

On translated macOS launches, the injector also exports the **real runtime Qt menu tree** from Cavalry itself to:

```text
~/Library/Caches/Cavalry-i18n/menu-inventory.json
```

That file is the authoritative runtime structure for menus and actions. It comes from the live `QMenuBar` / `QMenu` / `QAction` tree inside Cavalry after launch, not from a handwritten repo file.

Recommended workflow for full UI coverage:

1. Refresh the English JSON snapshot as before
2. Refresh the compiled UI source map with `npm run extract:compiled-ui`
3. Launch Cavalry once and inspect `~/Library/Caches/Cavalry-i18n/menu-inventory.json` for the exact runtime menu tree
4. Curate translations for any newly surfaced compiled UI strings
5. Regenerate embedded injector tables from the curated translation sources
6. Walk the actual UI and verify menus, submenus, dialogs, onboarding, tips, and plugin names against the source map and runtime inventory

This split is important because the existing JSON asset pipeline does **not** own the full menu bar or all Qt actions.

The app will try these paths automatically:

1. the last path saved in `state.json`
2. `/Applications/Cavalry.app`
3. `~/Applications/Cavalry.app`

If none are found, use the folder button to browse manually.

## Runtime state

Electron stores runtime data under `app.getPath('userData')`.

- `state.json` tracks the selected app path, the last patched Cavalry version, the active language, and the last patch timestamp
- `en/` stores the extracted English JSON snapshot for the selected Cavalry version
- `libCavalryTranslatorInjector.dylib` may be cached here for local developer builds when the repo does not already include a prebuilt injector binary

At runtime, restoring English uses the extracted snapshot from the selected install, not a bundled repo copy.
On macOS, the patcher also reads the bundle-local `cavalry-i18n-lang.txt` marker so it can recover the real installed language even if `state.json` goes stale.
On macOS, translated launches keep using the original `Cavalry.app` path. The patcher writes a bundle-local language marker, installs the injector into `Contents/Frameworks`, switches `CFBundleExecutable` to a launcher wrapper, re-signs nested Mach-O files such as `crashpad_handler` and injected dylibs first, re-signs the modified bundle, clears `com.apple.quarantine` from the app tree, updates the Qt-owned menu model after installing embedded translations, and then refreshes the native macOS menu bar so existing menus do not stay stuck in English. If macOS still reports the patched app as blocked, run `sudo xattr -dr com.apple.quarantine /Applications/Cavalry.app` manually and try launching again. Packaged Electron builds read the precompiled injector from `Contents/Resources/injector/`, while local unpackaged desktop runs rebuild the injector from source against the selected Cavalry frameworks so a stale checked-in dylib cannot silently target the wrong Qt branch.

## Repository layout

```text
Cavalry-i18n/
├── desktop-patcher/
│   ├── main.js
│   ├── injector/
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
│   ├── compiled-ui-source-map.json
│   ├── cavalry-glossary.md
│   ├── translation-guidelines.md
│   └── translation-whitelist.json
└── tools/
    ├── build_translator_injector.sh
    ├── check_electron_patcher_ui.js
    ├── extract_compiled_ui_strings.js
    ├── generate_embedded_translations.js
    ├── ja_JP.ts
    ├── launch_cavalry_with_injector.sh
    ├── validate_translations.py
    ├── zh-Hans.ts
    └── zh-Hant.ts
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

## macOS release note

End users should keep launching the original `Cavalry.app`. Tagged releases now build the packaged macOS patcher on macOS, prebuild `desktop-patcher/injector/libCavalryTranslatorInjector.dylib`, and publish the electron-builder DMG/ZIP so users do not need Qt or any external launcher script. The `tools/build_translator_injector.sh` fallback is for local development when that prebuilt dylib is missing, `tools/generate_embedded_translations.js` regenerates the embedded translation table directly from `tools/*.ts`, and `tools/launch_cavalry_with_injector.sh` is now only a manual debug utility rather than part of the normal patch flow.
