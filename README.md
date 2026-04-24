<div align="center">
  <img src="./src-tauri/icons/icon.png" width="120" />
  <h1>Cavalry-i18n</h1>
  <p>Switch <a href="https://cavalry.scenegroup.co/">Cavalry</a> 2.7.0 between English, Simplified Chinese, Traditional Chinese, and Japanese — right from the original app.</p>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/stargazers"><img src="https://img.shields.io/github/stars/daftAI2026/Cavalry-i18n?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/releases"><img src="https://img.shields.io/github/v/tag/daftAI2026/Cavalry-i18n?label=version&style=flat-square" alt="Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
</div>

## Architecture

Tauri v2 desktop app (Rust + Tauri 2.10) with a vanilla HTML/CSS/JS renderer at `desktop-patcher/renderer/`. The renderer communicates with the Rust backend through `window.cavalryI18n` — a 6-method Promise API defined by `tauri-bridge.js`.

An Electron shell still exists in the repo but is being phased out (`npm run desktop`).

## How it works

1. Detect a local `Cavalry.app` installation
2. Extract the current English JSON assets into an app-specific state directory
3. Patch translated JSON files from `languages/` back into the app bundle
4. Install a launcher wrapper + runtime injector (`libCavalryTranslatorInjector.dylib`) + language marker inside the app
5. Re-sign the modified bundle and clear Gatekeeper quarantine

On macOS the original `Cavalry.app` path continues to work — the launcher wrapper sets `DYLD_INSERT_LIBRARIES` so the injector loads translations at runtime. English restoration uses the extracted snapshot from the selected install, not a bundled copy.

On Windows: direct JSON file replacement only (no runtime injection).

## Supported languages

| Language | Code |
|----------|------|
| English | `en` |
| 简体中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## Quick start

```bash
npm install
npm run tauri:dev        # dev mode
npm run build            # production DMG
```

The injector must be built against Qt 6.6.3 (Cavalry's shipped Qt branch). CI and local builds pin `CAVALRY_QT_VERSION=6.6.3` via `tools/cavalry_qt_target.json`. Override with `CAVALRY_QT_PREFIX` or `QT_ROOT_DIR`.

## Repository layout

```
Cavalry-i18n/
├── desktop-patcher/              # Shared patcher core
│   ├── main.js                   # Electron entry (legacy)
│   ├── i18n-handlers.js          # 5 IPC handlers (business logic)
│   ├── preload.js                # Electron IPC bridge (legacy)
│   ├── injector/
│   │   ├── CavalryTranslatorInjector.mm  # Obj-C++ runtime injector
│   │   └── generated_translations.inc    # Compiled translation table
│   ├── lib/
│   │   ├── detect.js             # Cavalry.app detection
│   │   ├── patch.js              # JSON file mapping & extraction
│   │   └── sudo.js               # Privileged copy (admin shell / Finder fallback)
│   ├── renderer/                 # UI truth source
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── app.js                # State-driven UI with i18n & modal system
│   │   └── tauri-bridge.js       # Tauri invoke() → window.cavalryI18n adapter
│   └── resources/                # Icons & DMG assets
│
├── src-tauri/                    # Tauri v2 shell
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Window 480×528, DMG bundle, resources
│   ├── src/
│   │   ├── lib.rs                # Builder assembly
│   │   ├── commands.rs           # 6 Tauri commands (business core)
│   │   ├── detect.rs             # Cavalry detection (Rust)
│   │   ├── patch.rs              # JSON file mapping (Rust)
│   │   ├── mac_runtime.rs        # Launcher wrapper, marker, injector staging
│   │   ├── keychain_patch.rs     # Mach-O binary patching for Keychain login persistence
│   │   ├── privilege.rs          # System command boundary (copy, resign, quarantine)
│   │   ├── state.rs              # Electron-compatible state.json
│   │   └── bridge.rs             # Pre-page-load JS bridge injection
│   ├── capabilities/             # Tauri v2 permission model
│   └── tests/                    # Rust contract tests
│
├── languages/                    # JSON language packs
│   ├── en/                       # English baseline (git-tracked)
│   ├── zh-Hans/
│   ├── zh-Hant/
│   └── ja_JP/
│
├── tools/                        # Build, test, coverage, & debug scripts
│   ├── cavalry_qt_target.json    # Cavalry 2.7.0 / Qt 6.6.3 version truth
│   ├── resolve_cavalry_qt_sdk.js # Qt SDK resolver (local + aqt download)
│   ├── build_translator_injector.sh
│   ├── generate_embedded_translations.js
│   ├── validate_translations.py  # Translation quality gates
│   ├── extract_compiled_ui_strings.js
│   ├── stamp_dmg_icon.sh         # DMG volume icon embedding
│   ├── *.ts                      # Qt Linguist translation sources (3 files)
│   ├── check_*.js                # Contract & coverage tests (15+)
│   └── fixtures/                 # Test fixtures
│
├── doc/                          # Migration plans, build SOP, glossary, source maps
└── .github/workflows/build.yml   # CI: contract validation → macOS packaging → release
```

## Build & test

```bash
# Build
npm run build                  # Tauri production DMG
npm run build:tauri            # Full pipeline: build + stamp DMG + packaged check
npm run build:injector         # Compile libCavalryTranslatorInjector.dylib
npm run prepare:qt-sdk         # Download/resolve Qt 6.6.3 SDK

# Dev
npm run tauri:dev              # Tauri dev server
npm run check:tauri            # Rust type-check

# Test
npm run test:desktop           # Node: patcher UI, renderer contract, snapshots
npm run test:tauri             # cargo test (all Rust unit + contract tests)
npm run test:tauri:packaged    # Post-build resource integrity check
npm run test:tauri:ui          # Tauri window regression
npm run check:desktop          # Syntax-check all JS
npm run check:ui-coverage      # Runtime UI translation coverage gate (≥99%)
```

## Translation surfaces

There are **two** translation surfaces:

1. **JSON-backed assets** — `nodeStrings`, `appStrings`, `tips`, `onboarding`, and plugin `strings.json` files. Patched directly into the app bundle.
2. **Compiled Qt/UI text** — menu labels, actions, panel titles, and widget text embedded in Cavalry binaries. Translated at runtime by the injector dylib using a compiled C translation table.

The repo tracks surface 2 in three forms:
- `doc/compiled-ui-source-map.json` — static ownership map (JSON asset vs compiled binary)
- `tools/*.ts` — Qt Linguist XML translation sources
- `~/Library/Caches/Cavalry-i18n/menu-inventory.json` — authoritative runtime UI inventory dumped by the injector on translated launch

## UI coverage workflow

```bash
npm run extract:compiled-ui                         # Refresh source map from Cavalry.app binaries
# Launch Cavalry once in target language            # Generates menu-inventory.json at runtime
npm run check:ui-coverage                           # Gate: must be ≥99%
npm run check:full-ui                               # Full matrix across all 3 target languages
```

Strings that intentionally stay in English (e.g. proper nouns) must be listed in `tools/runtime_ui_allowlist.json`.

## Runtime state

The app stores runtime data in an app-specific directory (`CAVALRY_I18N_STATE_DIR` overrides it):

- `state.json` — selected app path, Cavalry version, active language, patch timestamp
- `en/` — extracted English JSON snapshot (used for English restoration)
- The injector dylib may be cached here for local dev builds

On macOS the patcher also reads a bundle-local `cavalry-i18n-lang.txt` marker so the real language is recoverable even if `state.json` goes stale.

## Translation validation

```bash
python3 tools/validate_translations.py \
  --root . \
  --json-report /tmp/cavalry-i18n-report.json \
  --markdown-summary /tmp/cavalry-i18n-runlog.md
```

Rules are defined in `doc/translation-whitelist.json`.

## CI/CD

| Job | Runner | What |
|-----|--------|------|
| **build** | ubuntu | Syntax check, contract tests, translation validation |
| **package_macos** | macos | Qt SDK prepare, Tauri build, Rust contracts, packaged checks |
| **release** | ubuntu | Triggered on `v*` tags — publishes DMG to GitHub Releases |

## macOS release notes

End users launch the original `Cavalry.app` — the patcher modifies it in-place with a launcher wrapper that activates the injector. Tagged releases ship a prebuilt `libCavalryTranslatorInjector.dylib` inside the Tauri DMG; users do not need Qt or any external scripts.

The `tools/launch_cavalry_with_injector.sh` script is a manual debug utility only — not part of the normal patch flow.

## License

MIT © 2026 daftAI
