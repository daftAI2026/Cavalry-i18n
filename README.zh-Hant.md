<div align="center">
  <img src="./src-tauri/icons/icon.png" width="120" />
  <h1>Cavalry-i18n</h1>
  <p>直接在原始應用程式中，將 <a href="https://cavalry.scenegroup.co/">Cavalry</a> 2.7.2 切換為 English、簡體中文、繁體中文或日本語。</p>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/stargazers"><img src="https://img.shields.io/github/stars/daftAI2026/Cavalry-i18n?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/releases"><img src="https://img.shields.io/github/v/tag/daftAI2026/Cavalry-i18n?label=version&style=flat-square" alt="Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>

  <p>Languages: <a href="README.md">English</a> | <a href="README.zh-Hans.md">简体中文</a> | 繁體中文 | <a href="README.ja_JP.md">日本語</a></p>
</div>

## 功能

- 🎯 **一鍵切換**：選擇語言，點擊套用，重新啟動後 Cavalry 即以目標語言開啟
- 🔌 **執行階段注入**：透過 `DYLD_INSERT_LIBRARIES` 載入 compiled UI 翻譯，不改寫 Cavalry 的 UI 字串
- 📦 **雙翻譯面**：JSON 資源檔案 + 編譯進 Qt/UI 的字串，皆自動統一處理
- 🔑 **Keychain 安全**：對 `libExtensionLayer.dylib` 做二進位補丁，避免語言切換後登入憑證失效
- 🔐 **重新簽名並清除隔離標記**：重新簽名補丁後的 app bundle，並清除 Gatekeeper 標記，避免 macOS 阻止啟動
- 🌐 **四種語言**：English、簡體中文、繁體中文、日本語

## 安全與權限

Cavalry-i18n 是獨立的社群工具。它不是 Scene Group、Cavalry 或 Canva 製作、認可或關聯的官方工具。

這個工具會修改你本機 `Cavalry.app` bundle 內的檔案，讓 Cavalry 能以翻譯後的資源啟動。在 macOS 上，這需要 **App Management** 權限：

1. 開啟 **System Settings → Privacy & Security → App Management**
2. 啟用 **Cavalry Language Switcher**
3. 回到應用程式，再次套用語言包

macOS 要求這個權限，是因為修改另一個 `.app` bundle 屬於受保護操作。只有在你信任此構建，並理解它會補丁、重新簽名並重新啟動本機 Cavalry 安裝時，才授予權限。請保留乾淨的 Cavalry 安裝器或備份；重新安裝 Cavalry 是恢復到未修改官方 bundle 的最安全方式。

## 快速開始

```bash
npm install
npm run tauri:dev        # 開發模式
npm run build            # 生產構建
npm run build:tauri      # 生產 DMG + 打包後檢查
```

> **注意**：injector（`libCavalryTranslatorInjector.dylib`）必須基於 Qt 6.6.3 構建，以匹配 Cavalry 2.7.2 隨附的 Qt 分支。CI 和本地構建透過 `tools/cavalry_qt_target.json` 固定該版本。可用 `CAVALRY_QT_PREFIX` 或 `QT_ROOT_DIR` 覆蓋。

## 工作原理

1. **偵測** 本機 `Cavalry.app` 安裝
2. **擷取** 目前英文 JSON 資源，作為帶版本的快照
3. **補丁** 將 `languages/` 中的翻譯 JSON 檔案寫入 app bundle
4. **安裝** launcher wrapper、執行階段 injector 與語言標記
5. **重新簽名** 修改後的 bundle，並清除 Gatekeeper 隔離標記

補丁完成後，原來的 `Cavalry.app` 路徑仍然可用。launcher wrapper 會設定 `DYLD_INSERT_LIBRARIES`，讓 injector 在執行階段載入翻譯。恢復 English 時使用擷取出的快照，而不是倉庫內建副本。

## 支援語言

| 語言 | 代碼 |
|----------|------|
| English | `en` |
| 簡體中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## 開發

```bash
# 構建
npm run build                  # Tauri 生產構建
npm run build:tauri            # 完整流水線：構建 + DMG 圖示標記 + 打包後檢查
npm run build:injector         # 編譯 libCavalryTranslatorInjector.dylib
npm run prepare:qt-sdk         # 下載/解析 Qt 6.6.3 SDK

# 開發
npm run tauri:dev              # Tauri 開發伺服器
npm run check:tauri            # Rust 型別檢查

# 測試
npm run test:contracts         # Node：app、renderer、bridge、SOP 合同測試
npm run test:tauri             # cargo test（Rust 單元測試 + 合同測試）
npm run test:tauri:packaged    # 打包後資源完整性
npm run test:tauri:ui          # 打包後視窗回歸
npm run check:app              # 檢查所有 JS 語法
npm run check:full-ui          # 完整 JSON + compiled + runtime UI gate（100%）
```

## 翻譯面

本專案有 **兩個** 翻譯面：

1. **JSON-backed assets** —— `nodeStrings`、`appStrings`、`tips`、`onboarding`、definitions、metadata、guide、style 和 plugin 檔案。它們會直接補丁進 app bundle。
2. **Compiled Qt/UI text** —— Cavalry 二進位內嵌的選單標籤、action、面板標題、widget 文字、按鈕和 tab。它們由 injector dylib 在執行階段翻譯。

Surface 2 以三種形式追蹤：
- `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json` —— 生成的歸屬映射（JSON vs compiled binary）
- `tools/*.ts` —— Qt Linguist XML 翻譯源
- `$SESSION_DIR/runtime/<language>-merged-inventory.json` —— 由 injector 與 accessibility capture 合併出的 live runtime UI inventory

```bash
export SESSION_DIR="$HOME/Library/Caches/Cavalry-i18n/sessions/<session-id>"
npm run extract:compiled-ui                         # 從 Cavalry.app 刷新 source map
# 啟動並捕獲每個目標語言的 Cavalry             # 生成 runtime inventories
npm run check:full-ui                               # Gate：必須達到 100%
```

## 倉庫結構

```
Cavalry-i18n/
├── renderer/                     # UI（vanilla HTML/CSS/JS + Tauri bridge）
├── injector/                     # Objective-C++ runtime translator + generated table
├── src-tauri/                    # Tauri v2 shell（Rust）
│   └── src/
│       ├── commands.rs           # Tauri IPC commands（業務核心）
│       ├── keychain_patch.rs     # Mach-O 二進位補丁
│       ├── privilege.rs          # 系統命令邊界
│       └── ...
├── languages/                    # JSON 語言包（en、zh-Hans、zh-Hant、ja_JP）
├── tools/                        # 構建、測試、覆蓋率腳本與 gate contracts
├── doc/                          # 架構計畫、翻譯規則、workflow evidence
├── output/                       # 衍生審計產物與 JSON surface evidence
└── .github/workflows/            # CI：contract → packaging → release
```

## CI/CD

| Job | Runner | What |
|-----|--------|------|
| **build** | ubuntu | 語法檢查、合同測試、翻譯驗證 |
| **package_macos** | macos | Qt SDK 準備、Tauri 構建、Rust contracts、打包後檢查 |
| **release** | ubuntu | 由 `v*` tag 觸發，將 DMG 發布到 GitHub Releases |

## 支援

- 如果 Cavalry-i18n 幫到了你，可以把它[分享](https://twitter.com/intent/tweet?url=https://github.com/daftAI2026/Cavalry-i18n&text=Cavalry-i18n%20-%20Switch%20Cavalry%E2%80%99s%20UI%20between%20English,%20Chinese,%20and%20Japanese%20with%20one%20click.)給朋友，或點一個 star。
- 有想法或 bug？歡迎開 issue 或 PR，也歡迎貢獻你最好的 AI model。

## 授權

MIT License。歡迎使用 Cavalry-i18n 並參與貢獻。
