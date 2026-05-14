<div align="center">
  <img src="./src-tauri/icons/icon.png" width="120" />
  <h1>Cavalry-i18n</h1>
  <p>Switch <a href="https://cavalry.scenegroup.co/">Cavalry</a> 2.7.2 between English, Simplified Chinese, Traditional Chinese, and Japanese — right from the original app.</p>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/stargazers"><img src="https://img.shields.io/github/stars/daftAI2026/Cavalry-i18n?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/releases"><img src="https://img.shields.io/github/v/tag/daftAI2026/Cavalry-i18n?label=version&style=flat-square" alt="Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>

  <p>Languages: English | <a href="README.zh-Hans.md">简体中文</a> | <a href="README.zh-Hant.md">繁體中文</a> | <a href="README.ja_JP.md">日本語</a></p>
</div>

## Features

- 🎯 **One-click switch**: Pick a language, click apply, relaunch — Cavalry opens translated
- 🔌 **Runtime injection**: Loads compiled UI translations through `DYLD_INSERT_LIBRARIES` without rewriting Cavalry UI strings
- 📦 **Two translation surfaces**: JSON asset files + compiled Qt/UI strings, both handled automatically
- 🔑 **Keychain-safe**: Binary-patches `libExtensionLayer.dylib` so login credentials survive language switching
- 🔐 **Resigned & quarantine-cleared**: Re-signs the patched bundle and clears Gatekeeper flags so macOS doesn't block it
- 🌐 **Four languages**: English, 简体中文, 繁體中文, 日本語

## Safety & Permissions

Cavalry-i18n is an independent community tool. It is not made by, endorsed by, or affiliated with Scene Group, Cavalry, or Canva.

This tool modifies files inside your local `Cavalry.app` bundle so Cavalry can launch with translated resources. On macOS, that requires **App Management** permission:

1. Open **System Settings → Privacy & Security → App Management**
2. Enable **Cavalry Language Switcher**
3. Return to the app and apply the language pack again

macOS asks for this permission because changing another `.app` bundle is a protected operation. Only grant it if you trust this build and understand that the tool will patch, re-sign, and relaunch your local Cavalry installation. Keep a clean Cavalry installer or backup available; reinstalling Cavalry is the safest way to return to an untouched official bundle.

## Quick Start

```bash
npm install
npm run tauri:dev        # dev mode
npm run build            # production build
npm run build:tauri      # production DMG + packaged checks
```

> **Note**: The injector (`libCavalryTranslatorInjector.dylib`) must be built against Qt 6.6.3, matching Cavalry 2.7.2's shipped Qt branch. CI and local builds pin this via `tools/cavalry_qt_target.json`. Override with `CAVALRY_QT_PREFIX` or `QT_ROOT_DIR`.

## How It Works

1. **Detect** a local `Cavalry.app` installation
2. **Extract** the current English JSON assets as a versioned snapshot
3. **Patch** translated JSON files from `languages/` into the app bundle
4. **Install** a launcher wrapper, runtime injector, and language marker inside the app
5. **Resign** the modified bundle and clear Gatekeeper quarantine

After patching, the original `Cavalry.app` path continues to work — the launcher wrapper sets `DYLD_INSERT_LIBRARIES` so the injector loads translations at runtime. Restoring English uses the extracted snapshot, not a bundled copy.

## Supported Languages

| Language | Code |
|----------|------|
| English | `en` |
| 简体中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## Development

```bash
# Build
npm run build                  # Tauri production build
npm run build:tauri            # Full pipeline: build + stamp DMG + packaged check
npm run build:injector         # Compile libCavalryTranslatorInjector.dylib
npm run prepare:qt-sdk         # Download/resolve Qt 6.6.3 SDK

# Dev
npm run tauri:dev              # Tauri dev server
npm run check:tauri            # Rust type-check

# Test
npm run test:contracts         # Node: app contracts, renderer, bridge, SOP
npm run test:tauri             # cargo test (Rust unit + contract tests)
npm run test:tauri:packaged    # Post-build resource integrity
npm run test:tauri:ui          # Packaged window regression
npm run check:app              # Syntax-check all JS
npm run check:full-ui          # Full JSON + compiled + runtime UI gate (100%)
```

## Translation Surfaces

There are **two** translation surfaces in this project:

1. **JSON-backed assets** — `nodeStrings`, `appStrings`, `tips`, `onboarding`, definitions, metadata, guide, style, and plugin files. Patched directly into the app bundle.
2. **Compiled Qt/UI text** — menu labels, actions, panel titles, widget text, buttons, and tabs embedded in Cavalry binaries. Translated at runtime by the injector dylib.

Surface 2 is tracked in three forms:
- `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json` — generated ownership map (JSON vs compiled binary)
- `tools/*.ts` — Qt Linguist XML translation sources
- `$SESSION_DIR/runtime/<language>-merged-inventory.json` — live runtime UI inventory merged from injector and accessibility capture

```bash
export SESSION_DIR="$HOME/Library/Caches/Cavalry-i18n/sessions/<session-id>"
npm run extract:compiled-ui                         # Refresh source map from Cavalry.app
# Launch and capture Cavalry in each target language # Generates runtime inventories
npm run check:full-ui                               # Gate: must be 100%
```

## Repository

```
Cavalry-i18n/
├── renderer/                     # UI (vanilla HTML/CSS/JS + Tauri bridge)
├── injector/                     # Objective-C++ runtime translator + generated table
├── src-tauri/                    # Tauri v2 shell (Rust)
│   └── src/
│       ├── commands.rs           # Tauri IPC commands (business core)
│       ├── keychain_patch.rs     # Mach-O binary patching
│       ├── privilege.rs          # System command boundary
│       └── ...
├── languages/                    # JSON language packs (en, zh-Hans, zh-Hant, ja_JP)
├── tools/                        # Build, test, coverage scripts and gate contracts
├── doc/                          # Architecture plans, translation rules, workflow evidence
├── output/                       # Derived audit artifacts and JSON surface evidence
└── .github/workflows/            # CI: contract → packaging → release
```

## CI/CD

| Job | Runner | What |
|-----|--------|------|
| **build** | ubuntu | Syntax check, contract tests, translation validation |
| **package_macos** | macos | Qt SDK prepare, Tauri build, Rust contracts, packaged checks |
| **release** | ubuntu | Triggered on `v*` tags — publishes DMG to GitHub Releases |

## Support

- If Cavalry-i18n helped you, [share it](https://twitter.com/intent/tweet?url=https://github.com/daftAI2026/Cavalry-i18n&text=Cavalry-i18n%20-%20Switch%20Cavalry%E2%80%99s%20UI%20between%20English,%20Chinese,%20and%20Japanese%20with%20one%20click.) with friends or give it a star.
- Got ideas or bugs? Open an issue or PR, feel free to contribute your best AI model.

## License

MIT License. Feel free to use Cavalry-i18n and contribute.
