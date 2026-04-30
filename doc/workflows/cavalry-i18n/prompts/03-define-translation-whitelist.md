# 03 — Define Translation Whitelist（T1.1）

## Must Read

- `REPO/languages/en/` 下所有 JSON 文件的实际结构

## Must Follow

- `tests/tdd-master-contract.md`
- `tests/whitelist-contract.md`

## Allowed Files

- `REPO/doc/translation-whitelist.json`

## 前置 Gate

T1（02-extract-english-strings）PASS

## Task

基于 T1 提取出的 JSON 文件结构，定义翻译字段白名单。

具体工作：
1. 逐个读取 `languages/en/` 下所有 JSON 文件
2. 分析每个文件的字段结构
3. 为每个文件类型定义 `translate`（需要翻译的字段）和 `no_translate`（不翻译的字段）
4. 输出 `doc/translation-whitelist.json`

白名单格式示例：
```json
{
  "nodeStrings.json": {
    "translate": ["displayName", "description", "tooltip"],
    "no_translate": ["id", "type", "category"]
  },
  "appStrings.json": {
    "translate": ["..."],
    "no_translate": ["..."]
  }
}
```

## TDD Behaviors

| # | RED | GREEN |
|---|-----|-------|
| 1 | `translation-whitelist.json` 不存在 | 创建文件，合法 JSON |
| 2 | 缺少某文件类型（如 `tips.json` 未列出） | 补充该文件类型的 translate / no_translate |
| 3 | 某文件类型的 `translate` 列表为空 | 填入实际需要翻译的字段名 |
| 4 | 某 `translate` 字段名在对应 JSON 中不存在 | 校准字段名，确保与实际 JSON 结构一致 |

## Gate Check

按 `tests/whitelist-contract.md` 中的验证命令全部通过。

## Run Log

写到 `runs/YYYY-MM-DD-T1_1-define-translation-whitelist.md`
