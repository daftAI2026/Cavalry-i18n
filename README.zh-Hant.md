<!--
[INPUT]: 依赖当前发布配置、平台运行时边界与 LOCAL_BUILD_SOP
[OUTPUT]: 对外提供 macOS / Windows 用户安装、使用、开发与安全说明的繁體中文版本
[POS]: 倉庫繁體中文使用者入口；與英文及其他本地化 README 同步發布真相，不替代平台真機驗收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

<div align="center">
  <img src="./src-tauri/icons/icon.png" width="120" />
  <h1>Cavalry-i18n</h1>
  <p>直接在 macOS 或 Windows 原始應用程式中，將 <a href="https://cavalry.scenegroup.co/">Cavalry</a> 2.7.2 切換為 English、簡體中文、繁體中文或日本語。</p>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/stargazers"><img src="https://img.shields.io/github/stars/daftAI2026/Cavalry-i18n?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/releases"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FdaftAI2026%2FCavalry-i18n%2Fmain%2Fdocs%2Fbadges%2Frelease.json&style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>

  <p>Languages: <a href="README.md">English</a> | <a href="README.zh-Hans.md">简体中文</a> | 繁體中文 | <a href="README.ja_JP.md">日本語</a></p>
</div>

## 預覽

![Cavalry UI 繁體中文](docs/img/ui-zh-Hant.png)

## 功能

- **一步切換語言**：結束 Cavalry，選擇語言並點選 **「切換」**；完成後 Cavalry 會自動開啟。
- **四種介面語言**：English、简体中文、繁體中文和日本語。
- **雙平台支援**：適用於 macOS 與 Windows x64 上的 Cavalry 2.7.2。
- **完整介面覆蓋**：同時翻譯 JSON 資源和編譯進 Cavalry Qt 介面的文字。
- **自動尋找與還原**：尋找常見安裝位置、顯示目前語言，並準備還原英文所需的檔案。
- **應用程式內更新**：發現後續 Switcher 版本時提醒使用者，並在安裝前完成驗證。

## Switcher 視窗

選擇目標語言，再點選 **「切換」** 或 **「還原英文」**。目前語言仍會顯示，但無法重複選取；操作進度和復原指引顯示在按鈕下方。

## 安全與權限

Cavalry Language Switcher 是獨立社群工具，不隸屬於 Scene Group、Cavalry 或 Canva。

語言切換器會修改本機 Cavalry 安裝。如果版本不受支援、無法驗證安裝或寫入遭拒，新語言不會生效。

在 macOS 上，它會先直接嘗試切換。只有系統實際拒絕寫入後，才會開啟 **「系統設定 → 隱私權與安全性 → App Management」**。僅在信任目前構建時授權；macOS 可能要求重新開啟語言切換器後再試。修改後的 `Cavalry.app` 會在本機重新簽名，以便正常啟動。

在 Windows 上，目前使用者可寫入的自訂目錄會直接處理。UAC 提權僅用於系統 Program Files 目錄中的 Cavalry 安裝。不明 DLL 不會被刪除或替換。

**「還原英文」** 只承諾讓 Cavalry 回到英文，不承諾所有曾被修改的舊安裝都會與全新原廠安裝逐位元組一致。如需完全未經修改的官方安裝，請使用官方安裝程式重新安裝 Cavalry 2.7.2。

## 從 Release 安裝

從 [GitHub Releases](https://github.com/daftAI2026/Cavalry-i18n/releases/latest) 下載對應安裝程式：Apple M DMG、Intel DMG 或 Windows x64 NSIS。

macOS 版本使用 ad-hoc 簽名，尚未經過 Apple 公證。將應用程式拖入「應用程式」後，如果 macOS 阻止首次開啟，請執行：

```bash
xattr -dr com.apple.quarantine "/Applications/Cavalry Language Switcher.app"
codesign --force --deep --sign - "/Applications/Cavalry Language Switcher.app"
open "/Applications/Cavalry Language Switcher.app"
```

應用程式內更新會安裝新的 app bundle，因此 macOS 可能要求再次執行這些步驟。Windows 安裝程式尚未進行 Authenticode 簽名，可能顯示「未知發行者」；請確認檔案來自本專案的 GitHub Release。

原始碼構建請遵循 [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md)。

## 快速開始

```bash
npm install
npm run tauri:dev              # 從原始碼執行
npm run build:tauri            # 構建 macOS DMG
npm run build:tauri:windows    # 在 Windows 上構建 NSIS
```

請使用儲存庫固定的 Node、Rust、Qt、Python 與 Windows CMake 工具鏈。平台相依項目和打包檢查以 [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md) 為準。

## 工作原理

1. 尋找 Cavalry 2.7.2；Windows 找不到時允許使用者手動選擇。
2. 驗證安裝，並儲存或重用還原英文所需的檔案。
3. 寫入所選 JSON 資源和對應平台的執行階段翻譯器。
4. 最後提交語言標記；macOS 隨後重新簽名修改後的 app bundle。
5. 以所選語言開啟 Cavalry。

Cavalry 原有啟動路徑保持不變。**「還原英文」** 使用同一套受管作業反向處理，並且只刪除語言切換器能夠證明屬於自己的檔案。

## 支援語言

| 語言 | 代碼 |
|----------|------|
| English | `en` |
| 簡體中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## 開發

```bash
npm run test:contracts         # Renderer、bridge、發布與打包合同
npm run test:tauri             # Rust 測試
npm run check:app              # JavaScript 語法
npm run build:injector         # macOS Qt 注入器
npm run build:injector:windows # Windows 翻譯器與 QPA 委託層
```

Qt 6.6.3 必須與 Cavalry 2.7.2 相符。發布套件不得依賴浮動工具版本；請遵循 [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md)。

## AI / Agent Guide

修改程式碼前，請閱讀 [AGENTS.md](AGENTS.md)、[CLAUDE.md](CLAUDE.md) 和目標模組最近的 `CLAUDE.md`。這些檔案定義架構地圖、職責邊界、命令和文件協定。

## 翻譯面

專案處理兩個翻譯面：

1. `languages/` 中的 **JSON 資源**，與 English 基線保持結構一致。
2. `tools/*.ts` 與 `tools/model_display_translations.json` 中的 **Qt/UI 文字**，嵌入對應平台的執行階段翻譯器。

`injector/generated_translations.inc` 是生成檔案，禁止手動修改。翻譯規則和實機驗證流程見 [docs/translation-guidelines.md](docs/translation-guidelines.md) 與 [docs/runtime-ui-live-capture-workflow.md](docs/runtime-ui-live-capture-workflow.md)。

## 倉庫結構

```text
Cavalry-i18n/
├── renderer/          # Tauri WebView 介面
├── src-tauri/         # Rust 命令與平台作業
├── injector/          # macOS 與 Windows Qt 執行階段翻譯器
├── languages/         # English 基線與三種 JSON 語言包
├── tools/             # 構建、驗證與發布工具
├── docs/              # 公開規則、可重複 SOP 與圖片
└── .github/workflows/ # CI、平台打包與 Release 發布
```

## CI/CD

| Job | 職責 |
| --- | --- |
| `build` | 語法、合同與翻譯驗證 |
| `windows_check` | Windows 翻譯器、Rust、NSIS 生命週期與更新包 |
| `package_macos` | Apple Silicon 與 Intel Tauri 打包及產物檢查 |
| `release` | 為 `cavalry-*-p*` tag 發布簽名更新清單與七項精確回讀資產 |

## 支援

- 如果 Cavalry-i18n 幫到了你，可以把它[分享](https://twitter.com/intent/tweet?url=https://github.com/daftAI2026/Cavalry-i18n&text=Cavalry-i18n%20-%20Switch%20Cavalry%E2%80%99s%20UI%20between%20English,%20Chinese,%20and%20Japanese%20with%20one%20click.)給朋友，或點一個 star。
- 有想法或 bug？歡迎開 issue 或 PR，也歡迎貢獻你最好的 AI model。

## 授權

MIT License。歡迎使用 Cavalry-i18n 並參與貢獻。
