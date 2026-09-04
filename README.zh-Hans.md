<!--
[INPUT]: 依赖当前发布配置、平台运行时边界与 LOCAL_BUILD_SOP
[OUTPUT]: 对外提供 macOS / Windows 用户安装、使用、开发与安全说明的简体中文版本
[POS]: 仓库简体中文用户入口；与英文及其他本地化 README 同步发布真相，不替代平台真机验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

<div align="center">
  <img src="./src-tauri/icons/icon.png" width="120" />
  <h1>Cavalry-i18n</h1>
  <p>直接在 macOS 或 Windows 原始应用中，将 <a href="https://cavalry.scenegroup.co/">Cavalry</a> 2.7.2 切换为 English、简体中文、繁體中文或日本語。</p>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/stargazers"><img src="https://img.shields.io/github/stars/daftAI2026/Cavalry-i18n?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/daftAI2026/Cavalry-i18n/releases"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FdaftAI2026%2FCavalry-i18n%2Fmain%2Fdocs%2Fbadges%2Frelease.json&style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>

  <p>Languages: <a href="README.md">English</a> | 简体中文 | <a href="README.zh-Hant.md">繁體中文</a> | <a href="README.ja_JP.md">日本語</a></p>
</div>

## 预览

![Cavalry UI 简体中文](docs/img/ui-zh-Hans.png)

## 功能

- **一步切换语言**：退出 Cavalry，选择语言并点击 **“切换”**；完成后 Cavalry 会自动打开。
- **四种界面语言**：English、简体中文、繁體中文和日本語。
- **双平台支持**：适用于 macOS 与 Windows x64 上的 Cavalry 2.7.2。
- **完整界面覆盖**：同时翻译 JSON 资源和编译进 Cavalry Qt 界面的文本。
- **自动发现与恢复**：查找常见安装位置、显示当前语言，并准备恢复英文所需的文件。
- **应用内更新**：发现后续 Switcher 版本时提醒用户，并在安装前完成验证。

## Switcher 窗口

选择目标语言，再点击 **“切换”** 或 **“恢复英文”**。当前语言仍会显示，但不可重复选择；操作进度和恢复指引显示在按钮下方。

## 安全与权限

Cavalry Language Switcher 是独立社区工具，不隶属于 Scene Group、Cavalry 或 Canva。

语言切换器会修改本机 Cavalry 安装。如果版本不受支持、无法验证安装或写入被拒绝，新语言不会生效。

在 macOS 上，它会先直接尝试切换。只有系统真实拒绝写入后，才会打开 **“系统设置 → 隐私与安全性 → App Management”**。仅在信任当前构建时授权；macOS 可能要求重新打开语言切换器后再试。修改后的 `Cavalry.app` 会在本地重新签名，以便正常启动。

在 Windows 上，当前用户可写的自定义目录会直接处理。UAC 提权仅用于系统 Program Files 目录中的 Cavalry 安装。未知 DLL 不会被删除或替换。

**“恢复英文”** 只承诺让 Cavalry 回到英文，不承诺所有曾被修改的旧安装都会与全新原厂安装逐字节一致。如需完全未经修改的官方安装，请使用官方安装器重新安装 Cavalry 2.7.2。

## 从 Release 安装

从 [GitHub Releases](https://github.com/daftAI2026/Cavalry-i18n/releases/latest) 下载对应安装包：Apple M DMG、Intel DMG 或 Windows x64 NSIS。

macOS 版本使用 ad-hoc 签名，尚未经过 Apple 公证。将应用拖入“应用程序”后，如果 macOS 阻止首次打开，请运行：

```bash
xattr -dr com.apple.quarantine "/Applications/Cavalry Language Switcher.app"
codesign --force --deep --sign - "/Applications/Cavalry Language Switcher.app"
open "/Applications/Cavalry Language Switcher.app"
```

应用内更新会安装新的 app bundle，因此 macOS 可能要求再次执行这些步骤。Windows 安装器尚未进行 Authenticode 签名，可能显示“未知发布者”；请确认文件来自本项目的 GitHub Release。

源码构建请遵循 [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md)。

## 快速开始

```bash
npm install
npm run tauri:dev              # 从源码运行
npm run build:tauri            # 构建 macOS DMG
npm run build:tauri:windows    # 在 Windows 上构建 NSIS
```

请使用仓库固定的 Node、Rust、Qt、Python 与 Windows CMake 工具链。平台依赖和打包检查以 [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md) 为准。

## 工作原理

1. 查找 Cavalry 2.7.2；Windows 未找到时允许用户手动选择。
2. 验证安装，并保存或复用恢复英文所需的文件。
3. 写入所选 JSON 资源和对应平台的运行时翻译器。
4. 最后提交语言标记；macOS 随后重新签名修改后的 app bundle。
5. 以所选语言打开 Cavalry。

Cavalry 原有启动路径保持不变。**“恢复英文”** 使用同一套受管事务反向处理，并且只删除语言切换器能够证明属于自己的文件。

## 支持语言

| 语言 | 代码 |
|----------|------|
| English | `en` |
| 简体中文 | `zh-Hans` |
| 繁體中文 | `zh-Hant` |
| 日本語 | `ja_JP` |

## 开发

```bash
npm run test:contracts         # Renderer、bridge、发布与打包合同
npm run test:tauri             # Rust 测试
npm run check:app              # JavaScript 语法
npm run build:injector         # macOS Qt 注入器
npm run build:injector:windows # Windows 翻译器与 QPA 委托层
```

Qt 6.6.3 必须与 Cavalry 2.7.2 匹配。发布包不得依赖浮动工具版本；请遵循 [LOCAL_BUILD_SOP.md](LOCAL_BUILD_SOP.md)。

## AI / Agent Guide

修改代码前，请阅读 [AGENTS.md](AGENTS.md)、[CLAUDE.md](CLAUDE.md) 和目标模块最近的 `CLAUDE.md`。这些文件定义架构地图、职责边界、命令和文档协议。

## 翻译面

项目处理两个翻译面：

1. `languages/` 中的 **JSON 资源**，与 English 基线保持结构一致。
2. `tools/*.ts` 与 `tools/model_display_translations.json` 中的 **Qt/UI 文本**，嵌入对应平台的运行时翻译器。

`injector/generated_translations.inc` 是生成文件，禁止手动修改。翻译规则和实机验证流程见 [docs/translation-guidelines.md](docs/translation-guidelines.md) 与 [docs/runtime-ui-live-capture-workflow.md](docs/runtime-ui-live-capture-workflow.md)。

## 仓库结构

```text
Cavalry-i18n/
├── renderer/          # Tauri WebView 界面
├── src-tauri/         # Rust 命令与平台事务
├── injector/          # macOS 与 Windows Qt 运行时翻译器
├── languages/         # English 基线与三种 JSON 语言包
├── tools/             # 构建、验证与发布工具
├── docs/              # 公开规则、可重复 SOP 与图片
└── .github/workflows/ # CI、平台打包与 Release 发布
```

## CI/CD

| Job | 职责 |
| --- | --- |
| `build` | 语法、合同与翻译验证 |
| `windows_check` | Windows 翻译器、Rust、NSIS 生命周期与更新包 |
| `package_macos` | Apple Silicon 与 Intel Tauri 打包及产物检查 |
| `release` | 为 `cavalry-*-p*` tag 发布签名更新清单与七项精确回读资产 |

## 支持

- 如果 Cavalry-i18n 帮到了你，可以把它[分享](https://twitter.com/intent/tweet?url=https://github.com/daftAI2026/Cavalry-i18n&text=Cavalry-i18n%20-%20Switch%20Cavalry%E2%80%99s%20UI%20between%20English,%20Chinese,%20and%20Japanese%20with%20one%20click.)给朋友，或点一个 star。
- 有想法或 bug？欢迎开 issue 或 PR，也欢迎贡献你最好的 AI model。

## 许可证

MIT License。欢迎使用 Cavalry-i18n 并参与贡献。
