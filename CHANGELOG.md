# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Core (Tauri)**:
  - Granular Mach-O Keychain patch reporting with `KeychainPatchDetail`.
  - Added support for patching `valueExists` symbol in `libExtensionLayer.dylib`.
  - Integrated `open_privacy_security` command to guide users through macOS App Management permissions.
- **UI/Renderer**:
  - Full i18n support with runtime language detection for English, Simplified Chinese, Traditional Chinese, and Japanese.
  - Implemented a custom Modal interaction system for application confirmations and permission guidance.
  - Added visual feedback for "App Management" permission status (Retry Apply flow).
- **Tooling**:
  - `stamp_dmg_icon.sh` for embedding custom volume icons into DMG files.
  - Comprehensive contract tests for bridge commands and packaged resource integrity.

### Changed
- **Infrastructure**:
  - Finalized the transition from Electron to Tauri v2 as the primary distribution channel.
  - Refactored `app.js` into a state-driven localization and modal architecture.
- **Documentation**:
  - Seeded GEB Fractal Documentation System (L1/L2/L3) across the repository.

### Fixed
- Fixed a potential race condition during the "Apply & Restart" sequence by ensuring permission check-ins occur before file operations.
- Resolved incorrect symbol offset calculations for ARM64/x86_64 fat binaries in `keychain_patch.rs`.

---

[PROTOCOL]: 变更时更新此文件，确保与 L1 项目宪法同步。
