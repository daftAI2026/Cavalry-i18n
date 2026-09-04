<!--
[INPUT]: 依赖当前发布配置、平台运行时边界与 LOCAL_BUILD_SOP
[OUTPUT]: 对外提供 macOS / Windows 用户安装、使用、开发与安全说明
[POS]: 仓库英文用户入口；与三份本地化 README 同步发布真相，不替代平台真机验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

<div align="center">
  <img src="./src-tauri/icons/icon.png" width="120" />
  <h1>Cavalry-i18n</h1>
  <p>Switch <a href="https://cavalry.scenegroup.co/">Cavalry</a> 2.7.2 on macOS and Windows between English, Simplified Chinese, Traditional Chinese, and Japanese.</p>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/stargazers"><img src="https://img.shields.io/github/stars/daftAI2026/Cavalry-i18n?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/releases"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FdaftAI2026%2FCavalry-i18n%2Fmain%2Fdocs%2Fbadges%2Frelease.json&style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>

  <p>Languages: English | <a href="README.zh-Hans.md">简体中文</a> | <a href="README.zh-Hant.md">繁體中文</a> | <a href="README.ja_JP.md">日本語</a></p>
</div>

## Preview

![Cavalry UI in Simplified Chinese](docs/img/ui-zh-Hans.png)

## Features

- **One-step language switching**: Quit Cavalry, choose a language, and select **Switch**. Cavalry opens automatically when the change is complete.
- **Four UI languages**: English, Simplified Chinese, Traditional Chinese, and Japanese.
- **Two platforms**: Cavalry 2.7.2 on macOS and Windows x64.
- **Complete UI coverage**: Translates JSON assets and text compiled into Cavalry's Qt interface.
- **Automatic discovery and recovery**: Finds common installations, keeps the current language visible, and prepares the files needed to restore English.
- **Built-in updates**: Notifies you when a later Switcher version is available and verifies it before installation.

## Switcher Window

Choose a target language, then select **Switch** or **Restore English**. The current language remains visible but cannot be selected again; progress and recovery guidance appear below the actions.

## Safety & Permissions

Cavalry Language Switcher is an independent community tool. It is not made by, endorsed by, or affiliated with Scene Group, Cavalry, or Canva.

The Switcher modifies the local Cavalry installation. If the version is unsupported, the installation cannot be verified, or a write is denied, the new language is not applied.

On macOS, it tries the change directly and opens **System Settings → Privacy & Security → App Management** only after macOS actually denies the write. Grant access only if you trust the build; macOS may ask you to reopen the Switcher before trying again. The changed `Cavalry.app` is locally re-signed so it can launch.

On Windows, writable custom locations are handled directly. UAC elevation is limited to Cavalry installations under the system Program Files directories. Unknown DLLs are never deleted or replaced.

**Restore English** returns Cavalry to English; it does not promise that every older modified installation becomes byte-for-byte identical to a fresh vendor install. To recover a completely untouched official installation, reinstall Cavalry 2.7.2 from the official installer.

## Install From Release

Download the matching installer from [GitHub Releases](https://github.com/daftAI2026/Cavalry-i18n/releases/latest): Apple M DMG, Intel DMG, or Windows x64 NSIS.

The macOS build is ad-hoc signed and not Apple-notarized. If macOS blocks the first launch after you drag the app into Applications, run:

```bash
xattr -dr com.apple.quarantine "/Applications/Cavalry Language Switcher.app"
codesign --force --deep --sign - "/Applications/Cavalry Language Switcher.app"
open "/Applications/Cavalry Language Switcher.app"
```

An app update installs a new app bundle, so macOS may require the same steps again. The Windows installer is not Authenticode-signed and may show an unknown-publisher warning; confirm that it came from this project's GitHub Release.

Source builds follow [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md).

## Quick Start

```bash
npm install
npm run tauri:dev              # Run from source
npm run build:tauri            # Build macOS DMG
npm run build:tauri:windows    # Build Windows NSIS on Windows
```

Use the repository's pinned Node, Rust, Qt, Python, and Windows CMake toolchain. Platform prerequisites and packaged checks are defined in [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md).

## How It Works

1. Detect a Cavalry 2.7.2 installation, or let the user choose one on Windows.
2. Validate the installation and save or reuse the files required to restore English.
3. Apply the selected JSON assets and platform runtime translator.
4. Commit the language marker last; macOS then re-signs the changed app bundle.
5. Open Cavalry in the selected language.

The original Cavalry launch path remains unchanged. **Restore English** runs the same managed transaction in reverse and removes only files that the Switcher can prove it owns.

## Supported Languages

| Language | Code |
|----------|------|
| English | `en` |
| 简体中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## Development

```bash
npm run test:contracts         # Renderer, bridge, release, and packaging contracts
npm run test:tauri             # Rust tests
npm run check:app              # JavaScript syntax
npm run build:injector         # macOS Qt injector
npm run build:injector:windows # Windows translator and QPA delegate
```

Qt 6.6.3 must match Cavalry 2.7.2. Do not build release packages from floating dependencies; use [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md).

## AI / Agent Guide

Before changing code, read [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), and the nearest module-level `CLAUDE.md`. These files define the architecture map, ownership boundaries, commands, and documentation protocol.

## Translation Surfaces

The project translates two surfaces:

1. **JSON assets** in `languages/`, kept structurally aligned with the English baseline.
2. **Compiled Qt/UI text** from `tools/*.ts` and `tools/model_display_translations.json`, embedded into the platform runtime translator.

Generated translations live in `injector/generated_translations.inc` and must not be edited by hand. Translation rules and live verification are documented in [docs/translation-guidelines.md](docs/translation-guidelines.md) and [docs/runtime-ui-live-capture-workflow.md](docs/runtime-ui-live-capture-workflow.md).

## Repository

```text
Cavalry-i18n/
├── renderer/          # Tauri WebView UI
├── src-tauri/         # Rust commands and platform transactions
├── injector/          # macOS and Windows Qt runtime translators
├── languages/         # English baseline and three translated JSON packs
├── tools/             # Build, validation, and release tooling
├── docs/              # Public rules, repeatable SOPs, and images
└── .github/workflows/ # CI, platform packaging, and Release publication
```

## CI/CD

| Job | Purpose |
| --- | --- |
| `build` | Syntax, contracts, and translation validation |
| `windows_check` | Windows translator, Rust, NSIS lifecycle, and updater package |
| `package_macos` | Apple Silicon and Intel Tauri packages with packaged checks |
| `release` | Signed updater manifest plus seven exact-readback public assets for `cavalry-*-p*` tags |

## Support

- If Cavalry-i18n helped you, [share it](https://twitter.com/intent/tweet?url=https://github.com/daftAI2026/Cavalry-i18n&text=Cavalry-i18n%20-%20Switch%20Cavalry%E2%80%99s%20UI%20between%20English,%20Chinese,%20and%20Japanese%20with%20one%20click.) with friends or give it a star.
- Got ideas or bugs? Open an issue or PR, feel free to contribute your best AI model.

## License

MIT License. Feel free to use Cavalry-i18n and contribute.
