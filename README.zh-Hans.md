<div align="center">
  <img src="./src-tauri/icons/icon.png" width="120" />
  <h1>Cavalry-i18n</h1>
  <p>直接在原始应用中，将 <a href="https://cavalry.scenegroup.co/">Cavalry</a> 2.7.2 切换为 English、简体中文、繁體中文或日本語。</p>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/stargazers"><img src="https://img.shields.io/github/stars/daftAI2026/Cavalry-i18n?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/releases"><img src="https://img.shields.io/github/v/tag/daftAI2026/Cavalry-i18n?label=version&style=flat-square" alt="Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
</div>

语言： [English](README.md) | 简体中文 | [繁體中文](README.zh-Hant.md) | [日本語](README.ja_JP.md)

## 功能

- 🎯 **一键切换**：选择语言，点击应用，重新启动后 Cavalry 即以目标语言打开
- 🔌 **运行时注入**：通过 `DYLD_INSERT_LIBRARIES` 加载 compiled UI 翻译，不改写 Cavalry 的 UI 字符串
- 📦 **双翻译面**：JSON 资源文件 + 编译进 Qt/UI 的字符串，自动统一处理
- 🔑 **Keychain 安全**：对 `libExtensionLayer.dylib` 做二进制补丁，避免语言切换后登录凭据失效
- 🔐 **重新签名并清除隔离标记**：重新签名补丁后的 app bundle，并清除 Gatekeeper 标记，避免 macOS 阻止启动
- 🌐 **四种语言**：English、简体中文、繁體中文、日本語

## 安全与权限

Cavalry-i18n 是独立的社区工具。它不是 Scene Group、Cavalry 或 Canva 制作、认可或关联的官方工具。

这个工具会修改你本机 `Cavalry.app` bundle 内的文件，让 Cavalry 能以翻译后的资源启动。在 macOS 上，这需要 **App Management** 权限：

1. 打开 **System Settings → Privacy & Security → App Management**
2. 启用 **Cavalry Language Switcher**
3. 回到应用，再次应用语言包

macOS 要求这个权限，是因为修改另一个 `.app` bundle 属于受保护操作。只有在你信任此构建，并理解它会补丁、重新签名并重新启动本机 Cavalry 安装时，才授予权限。请保留干净的 Cavalry 安装器或备份；重新安装 Cavalry 是恢复到未修改官方 bundle 的最安全方式。

## 快速开始

```bash
npm install
npm run tauri:dev        # 开发模式
npm run build            # 生产构建
npm run build:tauri      # 生产 DMG + 打包后检查
```

> **注意**：injector（`libCavalryTranslatorInjector.dylib`）必须基于 Qt 6.6.3 构建，以匹配 Cavalry 2.7.2 随附的 Qt 分支。CI 和本地构建通过 `tools/cavalry_qt_target.json` 固定该版本。可用 `CAVALRY_QT_PREFIX` 或 `QT_ROOT_DIR` 覆盖。

## 工作原理

1. **检测** 本机 `Cavalry.app` 安装
2. **提取** 当前英文 JSON 资源，作为带版本的快照
3. **补丁** 将 `languages/` 中的翻译 JSON 文件写入 app bundle
4. **安装** launcher wrapper、运行时 injector 与语言标记
5. **重新签名** 修改后的 bundle，并清除 Gatekeeper 隔离标记

补丁完成后，原来的 `Cavalry.app` 路径仍然可用。launcher wrapper 会设置 `DYLD_INSERT_LIBRARIES`，让 injector 在运行时加载翻译。恢复 English 时使用提取出的快照，而不是仓库内置副本。

## 支持语言

| 语言 | 代码 |
|----------|------|
| English | `en` |
| 简体中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## 开发

```bash
# 构建
npm run build                  # Tauri 生产构建
npm run build:tauri            # 完整流水线：构建 + DMG 图标标记 + 打包后检查
npm run build:injector         # 编译 libCavalryTranslatorInjector.dylib
npm run prepare:qt-sdk         # 下载/解析 Qt 6.6.3 SDK

# 开发
npm run tauri:dev              # Tauri 开发服务器
npm run check:tauri            # Rust 类型检查

# 测试
npm run test:contracts         # Node：app、renderer、bridge、SOP 合同测试
npm run test:tauri             # cargo test（Rust 单元测试 + 合同测试）
npm run test:tauri:packaged    # 打包后资源完整性
npm run test:tauri:ui          # 打包后窗口回归
npm run check:app              # 检查所有 JS 语法
npm run check:full-ui          # 完整 JSON + compiled + runtime UI gate（100%）
```

## 翻译面

本项目有 **两个** 翻译面：

1. **JSON-backed assets** —— `nodeStrings`、`appStrings`、`tips`、`onboarding`、definitions、metadata、guide、style 和 plugin 文件。它们会直接补丁进 app bundle。
2. **Compiled Qt/UI text** —— Cavalry 二进制内嵌的菜单标签、action、面板标题、widget 文本、按钮和 tab。它们由 injector dylib 在运行时翻译。

Surface 2 以三种形式追踪：
- `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json` —— 生成的归属映射（JSON vs compiled binary）
- `tools/*.ts` —— Qt Linguist XML 翻译源
- `$SESSION_DIR/runtime/<language>-merged-inventory.json` —— 由 injector 与 accessibility capture 合并出的 live runtime UI inventory

```bash
export SESSION_DIR="$HOME/Library/Caches/Cavalry-i18n/sessions/<session-id>"
npm run extract:compiled-ui                         # 从 Cavalry.app 刷新 source map
# 启动并捕获每个目标语言的 Cavalry             # 生成 runtime inventories
npm run check:full-ui                               # Gate：必须达到 100%
```

## 仓库结构

```
Cavalry-i18n/
├── renderer/                     # UI（vanilla HTML/CSS/JS + Tauri bridge）
├── injector/                     # Objective-C++ runtime translator + generated table
├── src-tauri/                    # Tauri v2 shell（Rust）
│   └── src/
│       ├── commands.rs           # Tauri IPC commands（业务核心）
│       ├── keychain_patch.rs     # Mach-O 二进制补丁
│       ├── privilege.rs          # 系统命令边界
│       └── ...
├── languages/                    # JSON 语言包（en、zh-Hans、zh-Hant、ja_JP）
├── tools/                        # 构建、测试、覆盖率脚本与 gate contracts
├── doc/                          # 架构计划、翻译规则、workflow evidence
├── output/                       # 派生审计产物与 JSON surface evidence
└── .github/workflows/            # CI：contract → packaging → release
```

## CI/CD

| Job | Runner | What |
|-----|--------|------|
| **build** | ubuntu | 语法检查、合同测试、翻译验证 |
| **package_macos** | macos | Qt SDK 准备、Tauri 构建、Rust contracts、打包后检查 |
| **release** | ubuntu | 由 `v*` tag 触发，将 DMG 发布到 GitHub Releases |

## 支持

- 如果 Cavalry-i18n 帮到了你，可以把它[分享](https://twitter.com/intent/tweet?url=https://github.com/daftAI2026/Cavalry-i18n&text=Cavalry-i18n%20-%20Switch%20Cavalry%E2%80%99s%20UI%20between%20English,%20Chinese,%20and%20Japanese%20with%20one%20click.)给朋友，或点一个 star。
- 有想法或 bug？欢迎开 issue 或 PR，也欢迎贡献你最好的 AI model。

## 许可证

MIT License。欢迎使用 Cavalry-i18n 并参与贡献。
