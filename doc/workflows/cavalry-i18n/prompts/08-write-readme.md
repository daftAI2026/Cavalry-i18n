# 08 — Write README + LICENSE（T9）

## Must Read

无。

## Must Follow

- `tests/tdd-master-contract.md`
- `tests/readme-contract.md`

## Allowed Files

- `REPO/README.md`
- `REPO/LICENSE`

## 前置 Gate

T8（07-build-ci）PASS

## Task

编写项目 README 和 LICENSE。

### README 内容

1. **项目简介** — Cavalry 第三方多语言切换器，支持 zh-Hans / zh-Hant / ja_JP
2. **安装步骤**（≥ 3 步） — 下载、复制到 Scripts 目录、在 Cavalry 中打开
3. **使用说明** — 选择语言、点击 Apply、自动重启
4. **支持的翻译覆盖范围** — 第一层 JSON + 第二层 Qt .qm
5. **开发者指南** — 如何贡献翻译、如何编译 .qm
6. **致谢 / Credits**

### LICENSE

MIT License。

## TDD Behaviors

| # | RED | GREEN |
|---|-----|-------|
| 1 | `README.md` 不存在 | 创建 README |
| 2 | 缺安装章节 | 写安装步骤 |
| 3 | 缺使用章节 | 写使用说明 |
| 4 | 安装步骤 < 3 步 | 补充步骤，确保 ≥ 3 步 |
| 5 | `LICENSE` 不存在 | 创建 MIT LICENSE |

## Gate Check

按 `tests/readme-contract.md` 中的验证命令全部通过。

## Run Log

写到 `runs/YYYY-MM-DD-T9-write-readme.md`
