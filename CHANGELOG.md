# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4] - 2026-05-14

### Added
- **Project Version Synchronizer**: Added `tools/sync_project_version.js` to use the latest formal `CHANGELOG.md` release as the single source of truth and propagate it to `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.lock`.
- **Git Version Hook**: Added `tools/git-hooks/pre-commit` and npm hook installation commands so local commits automatically restage synchronized npm, Cargo, and Tauri version metadata.
- **GitHub Manual Packaging**: Added `workflow_dispatch` to the GitHub Actions Tauri workflow so macOS packaging can be started manually from GitHub.

### Changed
- **CI Version Gate**: Added `npm run check:version` to both the Linux validation job and macOS packaging job, preventing drifted version metadata from entering CI artifacts or GitHub Releases.
- **macOS Qt SDK Bootstrap**: Updated the GitHub macOS packaging job to install `aqtinstall` in an isolated Python venv, pass that interpreter to the Qt SDK resolver, and mirror `LOCAL_BUILD_SOP.md` with explicit bundle cleanup, `npm run tauri:build`, DMG stamping, and all non-local SOP verification gates.
- **GEB Documentation Sync**: Updated `tools/CLAUDE.md`, `tools/git-hooks/CLAUDE.md`, and `.github/workflows/CLAUDE.md` so the document map mirrors the new version and packaging automation.

## [0.1.3] - 2026-05-14

### Fixed
- **Translation Quality (zh-Hans/zh-Hant/ja_JP)**: Batch terminology and quality corrections across 3 languages.
  - Reverted `pivot` translation back to `锚点`/`錨點` per glossary (was incorrectly changed to `轴心`/`軸心`).
  - Fixed zh-Hant `spheriseFilter.json`: restored English-leaked tabs back to Chinese, corrected `Back` → `背面`.
  - Fixed zh-Hant `zoomBlurFilter.json`: restored `origin` → `原點`.
  - Unified zh-Hant terminology: `質量` → `品質`, `圖像` → `影像`, `屏幕` → `螢幕`, `控製` → `控制`.
  - Fixed ja_JP Chinese-Japanese mixed-language strings in lattice deformers, fluid dynamics, and path operations.
  - Expanded `forbidden_translation_patterns.json` allowlist with `Forge`, `Dynamics`, `Shift`, `Ctrl` etc.
  - **Added `niceName` coverage**: Populated `niceName` fields for basic shapes (Rectangle, Ellipse, Polygon), lines (Bezier, Spiral, Straight), and background shapes in `nodeStrings.json` across all languages.

### Added

- **Qt Widget Translation & Periodic UI Refresh**:
  - Implemented automatic translation for non-menu QWidgets including `QLabel`, `QAbstractButton`, `QGroupBox`, `QLineEdit`, and `QTabBar` in `CavalryTranslatorInjector.mm`.
  - Added delayed periodic refresh attempts (`scheduleRefreshAttempts`) to capture dynamically spawned UI widgets after initial app launch.
  - Added comprehensive test assertions in `tools/check_app_contracts.js` validating widget translation coverage and scheduler actions.
- **Qt Translator Injector**: Introduced `injector/` module (Objective-C++) for runtime Qt menu interception.
  - Implemented `EmbeddedTranslator` (QTranslator subclass) for high-performance string replacement.
  - Added support for "English dump-only" mode to capture runtime UI inventories.
  - Integrated GEB Fractal Documentation System (L1/L2/L3) for architectural integrity.
- **Tauri Native Bridge**: Enhanced Rust-to-JS bridge with better error handling and permission pre-checks.
- **Build Infrastructure**:
  - Corrected `LOCAL_BUILD_SOP.md` path in `check_tauri_build_sop.js` after file relocation.
  - Stabilized AppleScript-based window detection in `window_contract_lib.js` by using safer process iteration and error handling.

### Changed
- **Tauri Transition**: Formally promoted Tauri as the exclusive runtime, completing the migration from Electron.
- **Test Infrastructure**: Refactored all contract tests to target the Tauri-only architecture.
  - Updated `check_app_contracts.js` to orchestrate full-stack validation.
  - Standardized on `~/Library/Caches/Cavalry-i18n/` for runtime session and inventory storage.

### Removed
- **Electron Deprecation**: Purged all legacy Electron artifacts and dependencies.
  - Removed `electron-builder`, `electron-rebuild`, and related development scripts.
  - Deleted legacy Electron testing harness (`electron_harness.js`, `capture_electron_contract.js`, etc.).
  - Purged Electron-specific UI snapshots and fixtures.


## [0.1.2] - 2026-04-25

### Added
- **Tauri v2**: Primary distribution shell with Rust business logic, replacing Electron as the default build path.
  - `commands.rs`: 6 Tauri IPC commands (`get_status`, `browse_app`, `extract_english`, `apply_language`, `restart_cavalry`, `open_privacy_security`).
  - `detect.rs` / `patch.rs` / `mac_runtime.rs` / `state.rs`: Rust ports of Electron patcher modules.
  - `keychain_patch.rs`: Mach-O binary patching for Keychain login persistence — NOP-patches `kSecAttrAccessGroup` and `kSecAttrSynchronizable` attribute writes in `libExtensionLayer.dylib` to prevent credential loss after patching. Supports arm64 and x86_64. Returns granular per-function `KeychainPatchDetail` reports.
  - `privilege.rs`: `CommandRunner` trait abstracting system calls (copy, resign, quarantine clear, restart) with `RecordingRunner` for test isolation.
  - `bridge.rs`: Pre-page-load JS bridge injection (`tauri-bridge.js` compiled via `include_str!`).
  - 10 Rust contract tests covering commands, detection, patch mapping, Mac runtime, privileges, state, Tauri config, bridge, and window regression.
- **Renderer**: Full i18n support with runtime locale detection (English, zh-Hans, zh-Hant, ja_JP). Modal interaction system for confirmations and permission guidance. "App Management" permission status feedback with retry flow.
- **UI text workflow**: Compiled Qt/UI translation surface with generated cache `compiled-ui-source-map.json`, runtime `menu-inventory.json`, and `runtime_ui_allowlist.json`. Coverage gate at ≥99%.
- **Tooling**: `stamp_dmg_icon.sh` for DMG volume icon embedding. `check_full_ui_coverage.js` and `check_full_ui_matrix.js` for per-language gate runs. `resolve_cavalry_qt_sdk.js` with `cavalry_qt_target.json` for centralized Cavalry/Qt SDK resolution.
- **CI/CD**: 3-job GitHub Actions pipeline (ubuntu contract validation, macos packaging, tag-triggered release). Translation quality gates in CI with markdown summary.

### Changed
- **Build system**: `npm run build` now defaults to `npm run tauri:build`. `npm run build:electron` is the explicit Electron fallback.
- **Window size**: Tauri window is 480×528 (vs Electron's 480×500 content area) to compensate for macOS titlebar height.
- **Renderer**: Refactored `app.js` into state-driven localization and modal architecture. `tauri-bridge.js` normalizes Tauri snake_case responses to camelCase for `app.js` compatibility.
- **Dependencies**: Pinned `tauri` to 2.10.3, `@tauri-apps/api` and `@tauri-apps/cli` to 2.10.1, `tauri-build` to 2.5.6.
- **CI**: macOS packaging uses `npm run prepare:qt-sdk` instead of inline Qt version in workflow YAML.

### Fixed
- Race condition during "Apply & Restart" — permission check-ins now occur before file operations.
- Incorrect symbol offset calculations for ARM64/x86_64 fat binaries in `keychain_patch.rs`.
- Added support for patching the `valueExists` Keychain symbol in `libExtensionLayer.dylib`.

### Removed
- Electron as default build target (retained as explicit fallback via `build:electron` / `desktop`).

---

## [0.1.0] - 2026-04-23

### Added
- Initial release: Electron-based desktop patcher for Cavalry i18n.
- JSON language pack patching for `nodeStrings`, `appStrings`, `tips`, `onboarding`, and plugin files.
- macOS runtime injection via `libCavalryTranslatorInjector.dylib` loaded through `DYLD_INSERT_LIBRARIES`.
- Launcher wrapper + `CFBundleExecutable` patching for transparent translated launches.
- Bundle re-signing and Gatekeeper quarantine clearing.
- Finder fallback for privileged copy operations.
- 4-language support: English, Simplified Chinese, Traditional Chinese, Japanese.
- Translation validation pipeline with `validate_translations.py`.
- Electron-builder DMG packaging with custom icon.

[Unreleased]: https://github.com/daftAI2026/Cavalry-i18n/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/daftAI2026/Cavalry-i18n/releases/tag/v0.1.4
[0.1.2]: https://github.com/daftAI2026/Cavalry-i18n/compare/v0.1.0...v0.1.2
[0.1.0]: https://github.com/daftAI2026/Cavalry-i18n/releases/tag/v0.1.0
