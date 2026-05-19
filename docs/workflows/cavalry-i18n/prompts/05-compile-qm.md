# 05 — Compile .qm Files（T3）

## Must Read

无（输入文件已由上一步产出）。

## 前置环境

`lrelease` 工具是 Qt 开发工具链的一部分。如果未安装：

```bash
# macOS
brew install qt

# Ubuntu/Debian
sudo apt-get install qttools5-dev-tools
```

安装后验证：`lrelease -version`

## Must Follow

- `tests/tdd-master-contract.md`
- `tests/qm-contract.md`

## Allowed Files

- `REPO/languages/*/cavalry_*.qm`
- `REPO/languages/*/qtbase_*.qm`

## 前置 Gate

T2（04-translate-all-languages）PASS

## Task

将 Qt Linguist `.ts` 源文件编译为 `.qm` 二进制翻译文件，并下载 Qt 官方 `qtbase` 翻译文件。

### 编译 cavalry .qm

使用 `lrelease` 工具编译：

```bash
lrelease tools/zh-Hans.ts -qm languages/zh-Hans/cavalry_zh-Hans.qm
lrelease tools/zh-Hant.ts -qm languages/zh-Hant/cavalry_zh-Hant.qm
lrelease tools/ja_JP.ts -qm languages/ja_JP/cavalry_ja_JP.qm
```

### 下载 qtbase .qm

从 Qt 官方仓库下载标准按钮（OK / Cancel / Yes / No）的翻译文件：

- `qtbase_zh-Hans.qm` → `languages/zh-Hans/`
- `qtbase_zh-Hant.qm` → `languages/zh-Hant/`
- `qtbase_ja.qm` → `languages/ja_JP/`

Qt 版本对齐 Cavalry 使用的 Qt 6.6.3。下载地址（Qt 6.6 分支）：

```
https://raw.githubusercontent.com/nicedoc/qt/refs/tags/v6.6.3/qttranslations/translations/qtbase_zh-Hans.qm
https://raw.githubusercontent.com/nicedoc/qt/refs/tags/v6.6.3/qttranslations/translations/qtbase_zh-Hant.qm
https://raw.githubusercontent.com/nicedoc/qt/refs/tags/v6.6.3/qttranslations/translations/qtbase_ja.qm
```

> 如果上述 URL 不可用，备选：从本地 Qt 安装目录复制（`brew --prefix qt`/translations/），或从 [qt/qttranslations](https://github.com/nicedoc/qt) GitHub 仓库手动下载。

## TDD Behaviors

| # | RED | GREEN |
|---|-----|-------|
| 1 | `cavalry_zh-Hans.qm` 不存在 | `lrelease` 编译生成 |
| 2 | `cavalry_zh-Hant.qm` 不存在 | `lrelease` 编译生成 |
| 3 | `cavalry_ja_JP.qm` 不存在 | `lrelease` 编译生成 |
| 4 | `qtbase_*.qm` 不存在 | 从 Qt 官方仓库下载 |

## Gate Check

按 `tests/qm-contract.md` 中的验证命令全部通过。

## Run Log

写到 `runs/YYYY-MM-DD-T3-compile-qm.md`
