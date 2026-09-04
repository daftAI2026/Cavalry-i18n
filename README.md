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

- 🎯 **One-click switch**: Close Cavalry, pick a language, and select Switch — the language changes and Cavalry opens automatically
- 🍎🪟 **macOS and Windows**: Supports the macOS `Cavalry.app` path and Windows Cavalry installation roots
- 🔌 **Platform-native runtime translation**: macOS uses `DYLD_INSERT_LIBRARIES`; Windows deploys a Qt generic translator behind a tiny vendor-QPA delegate
- 📦 **Two translation surfaces**: JSON asset files + compiled Qt/UI strings, both handled automatically
- 🧩 **Dynamic UI normalization**: Translates generated labels such as shape names, attribute editor fields, colon-suffixed labels, and `No ...` fallback text at runtime
- 🔑 **macOS Keychain-safe**: Binary-patches `libExtensionLayer.dylib` so login credentials survive language switching
- 🔐 **macOS signing path**: Re-signs the patched bundle and clears Gatekeeper flags so macOS does not block it
- 📍 **Windows discovery and selection**: Finds known installations when possible; otherwise choose `Cavalry.exe` or its installation folder
- 🛡️ **Automatic recovery baseline**: Before the first non-English switch, the backend creates or reuses a trusted baseline; if that cannot be completed, it writes nothing. Use one **Restore** action to return to official English—macOS restores the complete bundle, runtime, and signature, while Windows restores the vendor QPA and removes only manifest-owned generic runtime files.
- 🌐 **Four languages**: English, 简体中文, 繁體中文, 日本語

## Switcher Window

The Switcher uses a fixed 400×484 px window and does not scroll. Its compact flow is: choose a language, then select **Switch** or **Restore**; Switch starts directly, and result feedback appears below the actions.

## Safety & Permissions

Cavalry-i18n is an independent community tool. It is not made by, endorsed by, or affiliated with Scene Group, Cavalry, or Canva.

This project supports **macOS and Windows x64**. macOS patches and re-signs a `Cavalry.app` bundle. Windows applies the JSON overlay at the selected Cavalry installation root, installs a hash-locked QPA delegate, and keeps the exact vendor `qwindows.dll` as a durable backup. Existing Desktop, Start Menu, taskbar, and direct-EXE launch paths are not rewritten. Linux is not supported.

This tool modifies files inside your local `Cavalry.app` bundle so Cavalry can launch with translated resources. On macOS, the Switcher tries the safe transaction directly. If macOS denies that write, the app guides you to **System Settings → Privacy & Security → App Management**; allow Cavalry Language Switcher, reopen it if macOS requests that, and select Switch again.

macOS asks for this permission because changing another `.app` bundle is a protected operation. Only grant it if you trust this build and understand that the tool will patch and re-sign your local Cavalry installation, then open Cavalry when the transaction completes. Keep a clean Cavalry installer or backup available; reinstalling Cavalry is the safest way to return to an untouched official bundle.

On Windows, the app first tries to discover a local installation; if it cannot, select `Cavalry.exe` or its installation folder yourself. A custom location is supported only when the current user can write to it. Automatic UAC elevation is deliberately limited to an installation that is actually under Windows Program Files; it is not used for arbitrary custom paths. Closing Cavalry or the Switcher and same-version `/UPDATE` operations keep the selected language. Interactive uninstall asks whether to remove only the Switcher and keep the deployed translation, or first restore the official English state and remove the hash-owned generic/QPA runtime; silent, passive, and update uninstalls preserve translation. If Cavalry was reinstalled over a translated copy, the Switcher reports English only after all managed JSON and the exact vendor QPA prove that reality. Use **Restore** to return to the official English state; it removes only the manifest-owned generic/QPA runtime, and unknown DLLs are never deleted.

## Install From Release

Download the matching release asset from GitHub Releases. On macOS, use the Apple Silicon or Intel DMG. Releases that predate the updater closure may contain only the three manual installers and do not gain automatic-update support retroactively. An updater-enabled release produced by the current tag workflow is identifiable by `latest.json` and the six updater archive/signature assets: macOS DMGs are ad-hoc signed rather than Developer ID notarized, while updater archives are independently signed by the Tauri updater key embedded in the client. The workflow also publishes `SHA256SUMS`, `CycloneDX.json`, `toolchain-evidence.json`, and `release-asset-provenance.json`; publication stays private until every expected asset has been downloaded and compared byte-for-byte.

On Windows, download and run `Cavalry.Language.Switcher_Cavalry-2.7.2-pN_windows-x64-setup.exe`. The NSIS installer installs the switcher; it does not require end users to install Python, Rust, Qt, or PowerShell 7. After installation, choose the detected Cavalry copy or browse to a writable installation root. Windows Authenticode signing is tracked separately; always check `SHA256SUMS`.

Developers can also build locally from source. Local builds follow [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md), use ad-hoc signing for development only, and are not a substitute for GitHub Release assets.

Or paste this prompt to your AI agent:

```text
Build Cavalry Language Switcher locally from source:

1. Open the repository at <repository-path>.
2. Follow LOCAL_BUILD_SOP.md exactly.
3. Run the standard Tauri build, stamp the DMG icon, and run the packaged checks described in the SOP.
4. Confirm the final DMG path when done.
```

## Quick Start

```bash
npm install
npm run tauri:dev        # dev mode
npm run build            # production build
npm run build:tauri      # production DMG + packaged checks
```

Windows development build:

```powershell
npm run build:tauri:windows    # Windows NSIS installer
```

Windows development requires Windows 10 x64 or newer, Node.js 24+, PowerShell 5.1+, Visual Studio 2022+ with x64 MSVC v143, and CMake 4.2+. The launcher prefers an installed `pwsh` host and otherwise uses the built-in Windows PowerShell.

> **Note**: Both platform injectors must be built against Qt 6.6.3, matching Cavalry 2.7.2's shipped Qt branch. `tools/cavalry_qt_target.json` is the single version source and maps it to macOS `clang_64` and Windows `msvc2019_64`; use `npm run prepare:qt-sdk:windows` for a clean Windows build.

## How It Works

1. **Detect** a local `Cavalry.app` on macOS, or discover/select a Windows `Cavalry.exe` installation root
2. Before the first non-English Switch, automatically **create or reuse** a trusted, versioned recovery baseline. If validation fails, the operation stops before any file is written.
3. **Patch** translated JSON files from `languages/` into the app assets
4. **Install** the macOS launcher wrapper and injector, or the Windows `generic/cavalryi18n.dll` translator plus root QPA delegate at the selected installation root
5. **Open** Cavalry with platform-specific runtime translation; macOS also re-signs the bundle and clears Gatekeeper quarantine

The baseline covers only the files required to reverse the managed transaction; it is not a full Cavalry backup, and users do not need to refresh it manually. After patching, the original launch path continues to work. macOS uses a launcher wrapper with `DYLD_INSERT_LIBRARIES`; Windows loads the same translation runtime from Cavalry's native QPA path without global or shortcut-specific environment variables. The original `qwindows.dll` remains in a hash-locked recovery directory. Normal exit and same-version updates leave the deployed translation untouched. **Restore** returns macOS to the complete official English bundle, runtime, and signature; on Windows it restores English assets and the verified vendor QPA, then removes only manifest-owned generic/QPA files. It never substitutes or deletes an unknown DLL.

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
npm run prepare:qt-sdk:windows # Download/verify Qt 6.6.3 msvc2019_64
npm run build:injector:windows # Build/test the Windows Qt generic translator + QPA delegate
npm run build:tauri:windows    # Build the Windows NSIS installer
npm run test:tauri:windows-nsis # Verify provenance, install, same-version update, and uninstall

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

Windows packaging writes a same-name `.exe.provenance.json` sidecar after the installer is built. It binds the installer bytes to the current renderer, language packs, Windows Tauri/Rust inputs, package manifests, and both packaged Windows injector DLLs; the NSIS smoke recomputes it before installation and verifies both are x64 without bundling a second Qt runtime. The build removes only the previous output for the current version and fails closed on any other stale installer or sidecar in the target bundle directory.

## AI / Agent Guide

This repository includes an agent-facing knowledge base:

- `AGENTS.md` — operational guide for AI coding agents: project map, conventions, anti-patterns, commands, build pipeline, and safety boundaries
- `CLAUDE.md` — root architecture map for the repository; update it when root/module structure changes
- Module-level `CLAUDE.md` files — local maps for directories such as `renderer/`, `src-tauri/`, `tools/`, and `docs/`

When using an AI agent, ask it to read `AGENTS.md`, `CLAUDE.md`, and the nearest module `CLAUDE.md` before changing code.

## Translation Surfaces

There are **two** translation surfaces in this project:

1. **JSON-backed assets** — `nodeStrings`, `appStrings`, `tips`, `onboarding`, definitions, metadata, guide, style, and plugin files. Patched directly into the app bundle.
2. **Compiled Qt/UI text** — menu labels, actions, panel titles, widget text, buttons, and tabs embedded in Cavalry binaries. Translated at runtime by the macOS injector or Windows generic translator.

The injector also normalizes UI text that Cavalry generates at runtime, including derived shape layer names, Attribute Editor labels, colon-suffixed labels, status counts, and mixed `No ...` fallback labels. This keeps generated UI readable without bloating the static translation table with every possible phrase.

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
├── injector/                     # macOS injector + Windows generic/QPA runtime + generated table
├── src-tauri/                    # Tauri v2 shell (Rust)
│   └── src/
│       ├── commands.rs           # Tauri IPC commands (business core)
│       ├── keychain_patch.rs     # Mach-O binary patching
│       ├── privilege.rs          # System command boundary
│       └── ...
├── languages/                    # JSON language packs (en, zh-Hans, zh-Hant, ja_JP)
├── tools/                        # Build, test, coverage scripts and gate contracts
├── docs/                          # Public translation rules, maintenance SOPs, images and badge data
├── output/                       # Derived audit artifacts and JSON surface evidence
└── .github/workflows/            # CI: contract → packaging → release
```

## CI/CD

| Job | Runner | What |
|-----|--------|------|
| **build** | ubuntu | Syntax check, contract tests, translation validation |
| **windows_check** | windows | Qt generic/QPA build/tests, Rust checks, Windows NSIS installer |
| **package_macos** | macos | Qt SDK prepare, Tauri build, Rust contracts, packaged checks |
| **release** | ubuntu | Triggered on `cavalry-*-p*` tags — publishes two DMGs and one Windows x64 NSIS EXE |

## Support

- If Cavalry-i18n helped you, [share it](https://twitter.com/intent/tweet?url=https://github.com/daftAI2026/Cavalry-i18n&text=Cavalry-i18n%20-%20Switch%20Cavalry%E2%80%99s%20UI%20between%20English,%20Chinese,%20and%20Japanese%20with%20one%20click.) with friends or give it a star.
- Got ideas or bugs? Open an issue or PR, feel free to contribute your best AI model.

## License

MIT License. Feel free to use Cavalry-i18n and contribute.
