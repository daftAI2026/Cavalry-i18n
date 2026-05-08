# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [Unreleased]

### Added
- **Qt Translator Injector**: Introduced `injector/` module (Objective-C++) for runtime Qt menu interception.
  - Implemented `EmbeddedTranslator` (QTranslator subclass) for high-performance string replacement.
  - Added support for "English dump-only" mode to capture runtime UI inventories.
  - Integrated GEB Fractal Documentation System (L1/L2/L3) for architectural integrity.
- **Tauri Native Bridge**: Enhanced Rust-to-JS bridge with better error handling and permission pre-checks.

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

[0.1.2]: https://github.com/daftAI2026/Cavalry-i18n/compare/v0.1.0...v0.1.2
[0.1.0]: https://github.com/daftAI2026/Cavalry-i18n/releases/tag/v0.1.0
