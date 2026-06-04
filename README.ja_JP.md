<div align="center">
  <img src="./src-tauri/icons/icon.png" width="120" />
  <h1>Cavalry-i18n</h1>
  <p>macOS の元のアプリのまま、<a href="https://cavalry.scenegroup.co/">Cavalry</a> 2.7.2 を English、简体中文、繁體中文、日本語に切り替えます。</p>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/stargazers"><img src="https://img.shields.io/github/stars/daftAI2026/Cavalry-i18n?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/releases"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FdaftAI2026%2FCavalry-i18n%2Fmain%2Fdocs%2Fbadges%2Frelease.json&style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>

  <p>Languages: <a href="README.md">English</a> | <a href="README.zh-Hans.md">简体中文</a> | <a href="README.zh-Hant.md">繁體中文</a> | 日本語</p>
</div>

## プレビュー

![Cavalry UI 日本語](docs/img/ui-ja_JP.png)

## 機能

- 🎯 **ワンクリック切り替え**：言語を選び、適用をクリックして再起動すると、Cavalry が翻訳済み UI で開きます
- 🍎 **macOS 専用ランタイム**：macOS の `Cavalry.app` bundle、その Qt runtime、`DYLD_INSERT_LIBRARIES` 注入パスを前提にしています
- 🔌 **ランタイム注入**：`DYLD_INSERT_LIBRARIES` で compiled UI 翻訳を読み込み、Cavalry の UI 文字列を書き換えません
- 📦 **2 つの翻訳サーフェス**：JSON アセットファイルと compiled Qt/UI 文字列を自動で処理します
- 🧩 **動的 UI 正規化**：shape 名、Attribute Editor フィールド、コロン付きラベル、`No ...` fallback text など、実行時に生成されるラベルを翻訳します
- 🔑 **Keychain-safe**：`libExtensionLayer.dylib` にバイナリパッチを適用し、言語切り替え後もログイン認証情報を維持します
- 🔐 **再署名と quarantine 解除**：パッチ済み bundle を再署名し、Gatekeeper フラグを消して macOS にブロックされないようにします
- 🌐 **4 言語対応**：English、简体中文、繁體中文、日本語

## 安全性と権限

Cavalry-i18n は独立したコミュニティツールです。Scene Group、Cavalry、Canva が制作、承認、提携しているものではありません。

このプロジェクトは現在 **macOS のみ** をサポートしています。アプリの shell は Tauri で構築されていますが、実際に動作する language switcher は macOS 固有の app bundle 構造、コード署名、Keychain の挙動、dynamic library injection に依存しています。Windows と Linux build はサポートしていません。

このツールは、翻訳済みリソースで Cavalry を起動できるように、ローカルの `Cavalry.app` bundle 内のファイルを変更します。macOS では、この操作に **App Management** 権限が必要です。

1. **System Settings → Privacy & Security → App Management** を開く
2. **Cavalry Language Switcher** を有効にする
3. アプリに戻り、もう一度 language pack を適用する

macOS がこの権限を求めるのは、別の `.app` bundle を変更する操作が保護対象だからです。このビルドを信頼し、ローカルの Cavalry インストールにパッチ、再署名、再起動が行われることを理解した場合にのみ許可してください。クリーンな Cavalry インストーラーまたはバックアップを保持してください。未変更の公式 bundle に戻す最も安全な方法は Cavalry を再インストールすることです。

## Release からインストール

GitHub Releases から macOS DMG をダウンロードしてください。DMG は ad-hoc 署名されていますが、Apple Developer ID notarization はまだ行っていません。app を Applications にドラッグした後に macOS が "Apple could not verify Cavalry Language Switcher is free of malware" と表示する場合は、ブラウザダウンロード由来の quarantine フラグを一度だけ削除してください。

```bash
xattr -dr com.apple.quarantine "/Applications/Cavalry Language Switcher.app"
open "/Applications/Cavalry Language Switcher.app"
```

開発者はソースからローカルビルドすることもできます。ローカルビルドは [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md) に従い、ブラウザダウンロードの quarantine フラグを持ちません。

AI agent にこのプロンプトを渡すこともできます。

```text
Build Cavalry Language Switcher locally from source:

1. Open the repository at /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n.
2. Follow LOCAL_BUILD_SOP.md exactly.
3. Run the standard Tauri build, stamp the DMG icon, and run the packaged checks described in the SOP.
4. Confirm the final DMG path when done.
```

## クイックスタート

```bash
npm install
npm run tauri:dev        # 開発モード
npm run build            # 本番ビルド
npm run build:tauri      # 本番 DMG + packaged checks
```

> **注意**：injector（`libCavalryTranslatorInjector.dylib`）は、Cavalry 2.7.2 に同梱されている Qt ブランチと一致する Qt 6.6.3 に対してビルドする必要があります。CI とローカルビルドは `tools/cavalry_qt_target.json` でこれを固定しています。`CAVALRY_QT_PREFIX` または `QT_ROOT_DIR` で上書きできます。

## 仕組み

1. ローカルの `Cavalry.app` インストールを **検出**
2. 現在の English JSON アセットをバージョン付きスナップショットとして **抽出**
3. `languages/` の翻訳 JSON ファイルを app bundle に **パッチ適用**
4. launcher wrapper、runtime injector、language marker を **インストール**
5. 変更後の bundle を **再署名** し、Gatekeeper quarantine を解除

パッチ後も、元の `Cavalry.app` パスはそのまま使えます。launcher wrapper が `DYLD_INSERT_LIBRARIES` を設定し、injector がランタイムで翻訳を読み込みます。English に戻すときは、同梱コピーではなく抽出済みスナップショットを使用します。

## 対応言語

| 言語 | コード |
|----------|------|
| English | `en` |
| 简体中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## 開発

```bash
# ビルド
npm run build                  # Tauri 本番ビルド
npm run build:tauri            # フルパイプライン：ビルド + DMG アイコン付与 + packaged check
npm run build:injector         # libCavalryTranslatorInjector.dylib をコンパイル
npm run prepare:qt-sdk         # Qt 6.6.3 SDK をダウンロード/解決

# 開発
npm run tauri:dev              # Tauri dev server
npm run check:tauri            # Rust type-check

# テスト
npm run test:contracts         # Node：app、renderer、bridge、SOP contract tests
npm run test:tauri             # cargo test（Rust unit + contract tests）
npm run test:tauri:packaged    # ビルド済みリソース整合性
npm run test:tauri:ui          # packaged window regression
npm run check:app              # すべての JS を構文チェック
npm run check:full-ui          # Full JSON + compiled + runtime UI gate（100%）
```

## AI / Agent Guide

このリポジトリには、AI agent 向けのナレッジベースがあります。

- `AGENTS.md` — AI coding agent の運用ガイド：project map、conventions、anti-patterns、commands、build pipeline、safety boundaries
- `CLAUDE.md` — リポジトリルートの architecture map。ルートまたはモジュール構造を変更した場合は更新してください
- モジュール単位の `CLAUDE.md` — `renderer/`、`src-tauri/`、`tools/`、`docs/` などのローカルマップ

AI agent を使う場合は、コード変更の前に `AGENTS.md`、`CLAUDE.md`、最寄りのモジュール単位 `CLAUDE.md` を読むよう依頼してください。

## 翻訳サーフェス

このプロジェクトには **2 つ** の翻訳サーフェスがあります。

1. **JSON-backed assets** — `nodeStrings`、`appStrings`、`tips`、`onboarding`、definitions、metadata、guide、style、plugin files。app bundle に直接パッチされます。
2. **Compiled Qt/UI text** — Cavalry バイナリ内に埋め込まれた menu labels、actions、panel titles、widget text、buttons、tabs。injector dylib によってランタイムで翻訳されます。

injector は、Cavalry がランタイムで生成する UI text も正規化します。対象には、派生 shape layer names、Attribute Editor labels、colon-suffixed labels、status counts、mixed `No ...` fallback labels が含まれます。これにより、考えられるすべての phrase を静的翻訳テーブルへ詰め込まずに、生成 UI を読みやすく保てます。

Surface 2 は 3 つの形式で追跡します。
- `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json` — 生成された ownership map（JSON vs compiled binary）
- `tools/*.ts` — Qt Linguist XML translation sources
- `$SESSION_DIR/runtime/<language>-merged-inventory.json` — injector と accessibility capture からマージされた live runtime UI inventory

```bash
export SESSION_DIR="$HOME/Library/Caches/Cavalry-i18n/sessions/<session-id>"
npm run extract:compiled-ui                         # Cavalry.app から source map を更新
# 各ターゲット言語で Cavalry を起動して capture    # runtime inventories を生成
npm run check:full-ui                               # Gate：100% 必須
```

## リポジトリ

```
Cavalry-i18n/
├── renderer/                     # UI（vanilla HTML/CSS/JS + Tauri bridge）
├── injector/                     # Objective-C++ runtime translator + generated table
├── src-tauri/                    # Tauri v2 shell（Rust）
│   └── src/
│       ├── commands.rs           # Tauri IPC commands（business core）
│       ├── keychain_patch.rs     # Mach-O binary patching
│       ├── privilege.rs          # system command boundary
│       └── ...
├── languages/                    # JSON language packs（en、zh-Hans、zh-Hant、ja_JP）
├── tools/                        # build、test、coverage scripts、gate contracts
├── docs/                          # architecture plans、translation rules、workflow evidence
├── output/                       # derived audit artifacts、JSON surface evidence
└── .github/workflows/            # CI：contract → packaging → release
```

## CI/CD

| Job | Runner | What |
|-----|--------|------|
| **build** | ubuntu | 構文チェック、contract tests、translation validation |
| **package_macos** | macos | Qt SDK preparation、Tauri build、Rust contracts、packaged checks |
| **release** | ubuntu | `cavalry-*-p*` tags で発火し、DMG を GitHub Releases に公開 |

## サポート

- Cavalry-i18n が役に立ったら、友人に[共有](https://twitter.com/intent/tweet?url=https://github.com/daftAI2026/Cavalry-i18n&text=Cavalry-i18n%20-%20Switch%20Cavalry%E2%80%99s%20UI%20between%20English,%20Chinese,%20and%20Japanese%20with%20one%20click.)するか star を付けてください。
- アイデアや bug があれば、issue または PR を開いてください。あなたの最高の AI model での貢献も歓迎します。

## ライセンス

MIT License。Cavalry-i18n を自由に使い、ぜひ貢献してください。
