# 01 — Expand Glossary（T0）

## Must Read

- `REPO/doc/cavalry-glossary-en-zh.md`
- `REPO/doc/translation-guidelines.md`

## Must Follow

- `tests/tdd-master-contract.md`
- `tests/glossary-contract.md`

## Allowed Files

- `REPO/doc/cavalry-glossary.md`（新建四语言版）

## Task

扩展术语表，从现有的英中双语版扩展为四语言版（en / zh-Hans / zh-Hant / ja_JP）。

具体工作：
1. 读取 `cavalry-glossary-en-zh.md`，了解现有英中术语对照
2. 读取 `translation-guidelines.md`，了解术语翻译原则
3. 创建 `cavalry-glossary.md`，包含 en / zh-Hans / zh-Hant / ja_JP 四列
4. zh-Hant 列必须体现简繁差异（保存→儲存、文件→檔案、默认→預設 等）
5. ja_JP 列参考 After Effects / Blender 日语版术语
6. 不翻译项（Cavalry、RGB、SVG、Lottie 等）在所有语言列保持英文原文

## TDD Behaviors

| # | RED | GREEN |
|---|-----|-------|
| 1 | `cavalry-glossary.md` 文件不存在 | 创建文件，包含表头和至少一行数据 |
| 2 | 缺 zh-Hant 列 | 表格包含 zh-Hant 列，所有行有值 |
| 3 | 缺 ja_JP 列 | 表格包含 ja_JP 列，所有行有值 |
| 4 | 有空单元格 | 所有单元格已填满，无空值 |
| 5 | 简繁差异对缺失 | 确保 保存→儲存、文件→檔案、默认→預設、视频→影片 等差异对存在 |
| 6 | 不翻译项不一致 | Cavalry / RGB / SVG / Lottie / JSON / CSV 等在所有列保持英文 |

## Gate Check

按 `tests/glossary-contract.md` 中的验证命令全部通过。

## Run Log

写到 `runs/YYYY-MM-DD-T0-expand-glossary.md`
