<!--
[INPUT]: 依赖当前发布配置、平台运行时边界与 LOCAL_BUILD_SOP
[OUTPUT]: 对外提供 macOS / Windows 用户安装、使用、开发与安全说明的日本語版
[POS]: リポジトリの日本語ユーザー入口。英語と他のローカライズ README に公開の事実を同期し、実機検証の代替にはしない
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

<div align="center">
  <img src="./src-tauri/icons/icon.png" width="120" />
  <h1>Cavalry-i18n</h1>
  <p>macOS または Windows の元のアプリのまま、<a href="https://cavalry.scenegroup.co/">Cavalry</a> 2.7.2 を English、简体中文、繁體中文、日本語に切り替えます。</p>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/stargazers"><img src="https://img.shields.io/github/stars/daftAI2026/Cavalry-i18n?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/releases"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FdaftAI2026%2FCavalry-i18n%2Fmain%2Fdocs%2Fbadges%2Frelease.json&style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>

  <p>Languages: <a href="README.md">English</a> | <a href="README.zh-Hans.md">简体中文</a> | <a href="README.zh-Hant.md">繁體中文</a> | 日本語</p>
</div>

## プレビュー

![Cavalry UI 日本語](docs/img/ui-ja_JP.png)

## 機能

- **1 ステップの言語切り替え**：Cavalry を終了し、言語を選んで **「切り替える」** を選択します。完了すると Cavalry が自動で開きます。
- **4 つの UI 言語**：English、简体中文、繁體中文、日本語。
- **2 つのプラットフォーム**：macOS と Windows x64 上の Cavalry 2.7.2。
- **UI 全体を翻訳**：JSON アセットと Cavalry の Qt UI に組み込まれたテキストを処理します。
- **自動検出と復旧**：一般的なインストール先を検出し、現在の言語を表示して、英語へ戻すためのファイルを準備します。
- **アプリ内更新**：新しい Switcher バージョンを通知し、インストール前に検証します。

## Switcher ウィンドウ

切り替え先の言語を選び、**「切り替える」** または **「英語に戻す」** を選択します。現在の言語は表示されたままですが再選択はできません。進行状況と復旧案内はボタンの下に表示されます。

## 安全性と権限

Cavalry Language Switcher は独立したコミュニティツールであり、Scene Group、Cavalry、Canva とは提携していません。

Switcher はローカルの Cavalry インストールを変更します。バージョンが未対応、インストールを検証できない、または書き込みが拒否された場合、新しい言語は適用されません。

macOS では、まず切り替えを直接試します。macOS が実際に書き込みを拒否した場合にだけ、**システム設定 → プライバシーとセキュリティ → App Management** を開きます。このビルドを信頼できる場合にのみ許可してください。再試行前に Switcher を開き直すよう求められる場合があります。変更後の `Cavalry.app` は、起動できるようローカルで再署名されます。

Windows では、現在のユーザーが書き込めるカスタムインストール先を直接処理します。UAC 昇格はシステムの Program Files 配下にある Cavalry だけに限定されます。不明な DLL は削除も置換もしません。

**「英語に戻す」** は Cavalry を英語に戻しますが、以前に変更されたすべてのインストールが新規の公式インストールとバイト単位で同一になるとは保証しません。完全に未変更の公式インストールへ戻すには、公式インストーラーから Cavalry 2.7.2 を再インストールしてください。

## Release からインストール

[GitHub Releases](https://github.com/daftAI2026/Cavalry-i18n/releases/latest) から、Apple M DMG、Intel DMG、Windows x64 NSIS のいずれかをダウンロードします。

macOS 版は ad-hoc 署名で、Apple の公証は受けていません。アプリケーションへドラッグした後、macOS が初回起動をブロックした場合は次を実行します。

```bash
xattr -dr com.apple.quarantine "/Applications/Cavalry Language Switcher.app"
codesign --force --deep --sign - "/Applications/Cavalry Language Switcher.app"
open "/Applications/Cavalry Language Switcher.app"
```

アプリ内更新では新しい app bundle がインストールされるため、同じ手順が再度必要になる場合があります。Windows インストーラーは Authenticode 署名されておらず、「不明な発行元」と表示される場合があります。本プロジェクトの GitHub Release から取得したファイルであることを確認してください。

ソースビルドは [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md) に従います。

## クイックスタート

```bash
npm install
npm run tauri:dev              # ソースから実行
npm run build:tauri            # macOS DMG をビルド
npm run build:tauri:windows    # Windows 上で NSIS をビルド
```

リポジトリで固定された Node、Rust、Qt、Python、Windows CMake ツールチェーンを使用してください。プラットフォーム要件とパッケージ検証は [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md) が正本です。

## 仕組み

1. Cavalry 2.7.2 を検出します。Windows で見つからない場合はユーザーが選択できます。
2. インストールを検証し、英語へ戻すために必要なファイルを保存または再利用します。
3. 選択した JSON アセットとプラットフォーム用ランタイム翻訳を適用します。
4. 言語マーカーを最後に確定します。macOS では変更後の app bundle を再署名します。
5. 選択した言語で Cavalry を開きます。

Cavalry 本来の起動経路は変わりません。**「英語に戻す」** は同じ管理対象処理を逆向きに実行し、Switcher が所有を証明できるファイルだけを削除します。

## 対応言語

| 言語 | コード |
|----------|------|
| English | `en` |
| 简体中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## 開発

```bash
npm run test:contracts         # Renderer、bridge、Release、パッケージの契約
npm run test:tauri             # Rust テスト
npm run check:app              # JavaScript 構文
npm run build:injector         # macOS Qt injector
npm run build:injector:windows # Windows translator と QPA delegate
```

Qt 6.6.3 は Cavalry 2.7.2 と一致させる必要があります。Release パッケージで可変のツールバージョンを使わず、[LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md) に従ってください。

## AI / Agent Guide

コードを変更する前に、[AGENTS.md](AGENTS.md)、[CLAUDE.md](CLAUDE.md)、対象モジュールに最も近い `CLAUDE.md` を確認してください。これらはアーキテクチャ、責務境界、コマンド、ドキュメント規約を定義します。

## 翻訳サーフェス

プロジェクトは 2 つの翻訳面を扱います。

1. `languages/` の **JSON アセット**。English ベースラインと同じ構造を保ちます。
2. `tools/*.ts` と `tools/model_display_translations.json` の **Qt/UI テキスト**。プラットフォーム用ランタイム翻訳へ埋め込みます。

`injector/generated_translations.inc` は生成物であり、手動編集は禁止です。翻訳規則と実機検証は [docs/translation-guidelines.md](docs/translation-guidelines.md) と [docs/runtime-ui-live-capture-workflow.md](docs/runtime-ui-live-capture-workflow.md) を参照してください。

## リポジトリ

```text
Cavalry-i18n/
├── renderer/          # Tauri WebView UI
├── src-tauri/         # Rust コマンドとプラットフォーム処理
├── injector/          # macOS / Windows Qt ランタイム翻訳
├── languages/         # English ベースラインと 3 つの JSON 言語パック
├── tools/             # ビルド、検証、Release ツール
├── docs/              # 公開規則、再現可能な SOP、画像
└── .github/workflows/ # CI、プラットフォーム別パッケージ、Release 公開
```

## CI/CD

| Job | 役割 |
| --- | --- |
| `build` | 構文、契約、翻訳の検証 |
| `windows_check` | Windows 翻訳、Rust、NSIS ライフサイクル、更新パッケージ |
| `package_macos` | Apple Silicon / Intel Tauri パッケージと成果物検証 |
| `release` | `cavalry-*-p*` tag に対する署名付き更新マニフェストと 7 個の公開成果物 |

## サポート

- Cavalry-i18n が役に立ったら、友人に[共有](https://twitter.com/intent/tweet?url=https://github.com/daftAI2026/Cavalry-i18n&text=Cavalry-i18n%20-%20Switch%20Cavalry%E2%80%99s%20UI%20between%20English,%20Chinese,%20and%20Japanese%20with%20one%20click.)するか star を付けてください。
- アイデアや bug があれば、issue または PR を開いてください。あなたの最高の AI model での貢献も歓迎します。

## ライセンス

MIT License。Cavalry-i18n を自由に使い、ぜひ貢献してください。
