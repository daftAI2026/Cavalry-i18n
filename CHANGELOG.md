# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Qt Item Model Serialization**: Added `serializeItemViewModel` and `serializeModelRows` to serialize and capture Qt item model structures in the runtime inventory for downstream coverage auditing.
- **Debounced Dynamic Translation Refresh**: Implemented GCD-based coalescing (`scheduleInteractiveRefresh`) to debounce and schedule translation refreshes for dynamic widgets and late-loaded layouts during event-filter callbacks.
- **Quick-Add Empty Rows Pruning**: Implemented `pruneQuickAddEmptyItems` in the injector to clean up empty list rows inside `QuickAddWindow`, preventing blank card residues in the Add Layer dialog.
- **Add Layer UI & Attribute Translations**: Completed missing translation entries for the Add Layer dialog and dynamic attribute panels in both Simplified and Traditional Chinese, and Japanese translation files.
- **Forge Dynamics Attribute Translations**: Added localization support for *Ground Friction*, *Ground Bounce*, *Velocity Iterations*, *Position Iterations*, *Fields*, and *Un-Parent* in the translation catalogs and `forgeDynamicsShape` node properties.
- **Dynamic Status Bar Selection Translation**: Implemented regex-based status bar selection count localization (e.g. `([0-9]+) selected`) in the C++ injector to translate selection status displays dynamically across all locales.
- **Runtime Noise Quarantine**: Added `tools/runtime-noise-quarantine.json` containing 20 audited short tokens (e.g. `Rhu`) that lack translation provenance.
- **Contract Verification for Quarantine**: Added a contract test in `tools/check_app_contracts.js` to assert that quarantined noise tokens are filtered and do not enter compile-time tables.
- **Cavalry-i18n Code Review Report**: Added `docs/code-review-report.md` performing a thorough audit of dead code, redundant logic, and architecture detours.
- **Runtime Translation Noise Triage Audit**: Added `docs/audits/runtime-translation-noise-triage-2026-05-19.md` listing triage logs and evidence checkouts for 21 candidate tokens.
- **Runtime Translation Noise Triage Protocol**: Added `docs/runtime-translation-noise-triage.md` outlining the triage steps, evidence levels, and quarantine rules for runtime translation short tokens (e.g., `Rhu`), and linked it in `docs/CLAUDE.md`.
- **Dynamic Frame Keyframe Translation**: Implemented regex-based interceptor in `CavalryTranslatorInjector.mm` to localize Time Editor's "Add Keyframe on frame <n>" context-menu actions dynamically across all supported locales.
- **Animation and Timing Translations**: Added Japanese, Simplified Chinese, and Traditional Chinese translation support for animation/timing variables including *Copy Animated Attribute*, *Clip(s)*, *Start Frame*, *Seed*, *Lifespan*, *Emitters*, *Turbulence*, *Gravity*, *Drag Force*, *Mass*, *Timing Mode*, *Group By Parent*, *Parent Timing Mode*, and *Reverse Parent Order*.
- **Contract Verification for Animation Terms**: Added corresponding test assertions in `tools/check_app_contracts.js` to verify these newly added parameters and dynamic menu translation schemas exist in all language assets.
- **Ellipsis Menu Variant Generation**: Dynamically derive ellipsis (`...`) variants for `ModelDisplay` translation entries during compile-time header generation to cover context-menu actions while keeping NiceNames in English.

### Changed
- **Definition Tag Token Restoration**: Reverted localized tags back to standard English source tokens (e.g., `Distribution`, `Spiral`, `Bezier`) in Simplified Chinese, Traditional Chinese, and Japanese language packs to keep tag chips matching Cavalry's native tags rendering.
- **Smoother Node Elimination**: Purged obsolete, undefined `smoother` node definitions from JSON assets and translation lists to prevent orphan blank cards in the Add Layer dialog.
- **Directory Renaming & Path Migration**: Renamed the `doc` directory to `docs` to align with standard conventions, migrating all path references, contract tests (`check_app_contracts.js`), translation sources (`ja_JP.ts`, `zh-Hans.ts`, `zh-Hant.ts`), and configuration files (`translation-whitelist.json`).
- **Embedded Translation Filtering**: Updated `tools/generate_embedded_translations.js` to load the noise quarantine list and filter out unproven tokens, preventing bulk translation pollution (e.g., `Rhu -> 鲁/ログイン`) in `injector/generated_translations.inc`.
- **GEB Document Synchronization**: Updated L2 and L3 headers in `tools/CLAUDE.md` and `tools/check_app_contracts.js` to document the new quarantine config and test verification structures.

### Fixed
- **Model niceName Preservation**: Reverted `niceName` fields to English across all translation files to prevent Time Editor rendering issues and model key serialization errors in Cavalry.
- **Widget Mutation Boundary Protection**: Refactored the timeline-unsafe protection to intercept `QListWidgetItem` and `QTreeWidgetItem` values at the mutation boundary via `shouldPreserveModelBackedItemText` instead of using the global QTranslator.
- **Contract Enforcement**: Updated contract tests to verify that `niceName` values stay English in `nodeStrings.json` and all plugin translation files across Simplified Chinese, Traditional Chinese, and Japanese.
- **Whitelist Enforcement**: Configured `translation-whitelist.json` to move `niceName` from `translate` to `no_translate` to prevent future localization regressions.

### Changed
- **Localization Enhancements**: Unified and corrected terminology translations across Simplified Chinese, Traditional Chinese, and Japanese.
  - Refined *Duplicator* translation in Japanese to "デュプリケーター" (previously "複製器") and *Grid Layout* in Traditional Chinese to "網格佈局".
  - Synchronized *Schedule Stagger* translation to "错开排程" / "錯開排程" / "スケジュールスタッガー" across all languages.
  - Aligned node display translations in `tools/model_display_translations.json` for *Align*, *Animation Control*, *Cel Animation Shape*, *Rubber Hose Limb*, *Shape Skew*, *Text Shape*, and *Vertical/Horizontal Layout Groups*.
  - Added missing translations for *Notes...* ("备注..." / "備註...") and other standard node items.

## [0.2.0] - 2026-05-17

### Added
- **ExtensionLayer Mach-O Patching**: Implemented direct `__cstring` patching for `ExtensionLayer.dylib` to translate hardcoded UI strings (e.g., "Empty State" prompts) that are inaccessible via standard Qt property hooks.
- **Compound Widget Translation**: Added line-by-line translation support for multiline widgets and tooltips, ensuring partial matches succeed when exact full-string matches fail.
- **Expanded UI Coverage**: Implemented QLineEdit value translation (e.g., default "Keyframe Layer" names) and added missing translations for 11 critical UI sources.
- **Live Capture Orchestrator**: Added `--help` support and refined coverage allowlists (regex-based noise filtering) for the automated UI capture workflow.

### Fixed
- **Menu Translation Reliability**: Improved `aboutToShow` menu interception using `CFRunLoopPerformBlock` with `kCFRunLoopCommonModes` to ensure translations apply reliably during active menu tracking.
- **Shortcuts & Symbols**: Corrected semantic errors in shortcut key tokens and fixed exact-source matching for specialized symbols.

### Documentation & Tooling
- **Architecture Cleanup**: Archived 5 completed implementation plans, merged multi-language glossaries, and synchronized localized README previews.
- **Contract Enforcement**: Updated `check_app_contracts.js` to lock down new Mach-O patching and compound translation architectural requirements.

## [0.1.11] - 2026-05-15

### Fixed
- Fixed packaged GitHub builds so Tauri runtime resource resolution finds bundled `languages` and `injector` assets when `resource_dir()` points at either `Contents/Resources` or its `_up_` resource base.

## [0.1.10] - 2026-05-15

### Documentation
- Added macOS first-launch quarantine guidance and local agent build prompts to public READMEs, GitHub Release notes, and the local build SOP.

### Fixed
- Fixed packaged GitHub builds so `get_status` and language application read bundled `Contents/Resources/languages` instead of the compile-time repository path.

## [0.1.9] - 2026-05-15

### Fixed
- **macOS Quarantine Launch**: Added explicit Tauri ad-hoc bundle signing with `bundle.macOS.signingIdentity = "-"` and `APPLE_SIGNING_IDENTITY="-"`, then gated the packaged `.app`, DMG-contained `.app`, and installed-copy `.app` with `codesign --verify --deep --strict` to prevent browser-downloaded builds from opening as damaged.

## [0.1.8] - 2026-05-15

### Fixed
- **DMG Volume Icon Persistence**: `tools/stamp_dmg_icon.sh` now writes `src-tauri/icons/icon.icns` into the DMG filesystem as `.VolumeIcon.icns`, sets the mounted volume custom-icon bit, and recompresses the direct `.dmg` so GitHub Release downloads preserve the mounted volume icon without zip wrapping.
- **DMG Layout Gate**: `tools/check_dmg_layout.sh` now verifies the mounted volume custom-icon bit in addition to `.DS_Store`, background image, Applications link, and the app bundle.

## [0.1.7] - 2026-05-15

### Fixed
- **GitHub DMG Finder Layout**: The macOS packaging step now unsets `CI` before `npm run tauri:build`, allowing Tauri/create-dmg to run Finder layout automation for DMG background, window sizing, and icon placement.
- **DMG Layout Gate**: Added `tools/check_dmg_layout.sh` and `npm run test:tauri:dmg-layout` to mount the real DMG and verify `.DS_Store`, `.background/background.png`, `.VolumeIcon.icns`, the Applications link, and the packaged app before upload.
- **GitHub Release Notes**: Release automation now writes a product-named title and explicit macOS Apple Silicon download notes instead of publishing only an auto-generated changelog link.

## [0.1.5] - 2026-05-15

### Changed
- **GitHub Release Asset Shape**: GitHub tag releases now publish the macOS Apple Silicon installer directly as a `.dmg` asset, matching the common desktop-app release structure instead of adding an extra `.dmg.zip` wrapper.

## [0.1.4] - 2026-05-14

### Added
- **Project Version Synchronizer**: Added `tools/sync_project_version.js` to use the latest formal `CHANGELOG.md` release as the single source of truth and propagate it to `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.lock`.
- **Git Version Hook**: Added `tools/git-hooks/pre-commit` and npm hook installation commands so local commits automatically restage synchronized npm, Cargo, and Tauri version metadata.
- **GitHub Manual Packaging**: Added `workflow_dispatch` to the GitHub Actions Tauri workflow so macOS packaging can be started manually from GitHub.

### Changed
- **CI Version Gate**: Added `npm run check:version` to both the Linux validation job and macOS packaging job, preventing drifted version metadata from entering CI artifacts or GitHub Releases.
- **macOS Qt SDK Bootstrap**: Updated the GitHub macOS packaging job to install `aqtinstall` in an isolated Python venv, pass that interpreter to the Qt SDK resolver, and mirror `LOCAL_BUILD_SOP.md` with explicit `npm run tauri:build`, DMG stamping, and all non-local SOP verification gates.
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

