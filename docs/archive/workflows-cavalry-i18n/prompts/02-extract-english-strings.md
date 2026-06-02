# 02 — Extract English Strings（T1）

## Must Read

- `REPO/docs/plan-v3.md`（第五节项目结构、第四节翻译范围）

## Must Follow

- `tests/tdd-master-contract.md`
- `tests/extraction-contract.md`

## Allowed Files

- `REPO/tools/extract_strings.py`
- `REPO/languages/en/**`

## Task

编写 `extract_strings.py`，从 Cavalry app bundle 提取英文原文，生成 `languages/en/` 下的所有 JSON 文件。

脚本要求：
- 接受 Cavalry app bundle 路径作为参数
- 提取以下文件到 `languages/en/`：
  - `nodeStrings.json` — 节点名、属性名、描述
  - `appStrings.json` — 应用 UI 字符串
  - `tips.json` — 提示文本
  - `onboarding.json` — 引导文本
  - `plugins/*.json` — 各插件的字符串（约 13 个文件）
- 输出合法 JSON，UTF-8 编码

> **注意**：此步骤需要 Cavalry app bundle 的实际路径。脚本应接受路径参数。如果没有 Cavalry 安装，可以先写脚本骨架，标记为 BLOCKED。
>
> macOS 标准路径：`/Applications/Cavalry.app`（bundle 内容在 `Contents/Resources/`）

## TDD Behaviors

| # | RED | GREEN |
|---|-----|-------|
| 1 | `extract_strings.py` 不存在 | 创建脚本，可执行 |
| 2 | `languages/en/` 目录不存在 | 运行脚本后创建目录 |
| 3 | 缺 `nodeStrings.json` | 提取并写入 |
| 4 | 缺 `appStrings.json` | 提取并写入 |
| 5 | 缺 `tips.json` | 提取并写入 |
| 6 | 缺 `onboarding.json` | 提取并写入 |
| 7 | `plugins/` 下缺 JSON 文件 | 提取所有插件文件 |
| 8 | 某 JSON 文件解析失败（`json.loads` 报错） | 修复提取逻辑，确保输出合法 JSON |

## Gate Check

按 `tests/extraction-contract.md` 中的验证命令全部通过。

## Run Log

写到 `runs/YYYY-MM-DD-T1-extract-english-strings.md`
