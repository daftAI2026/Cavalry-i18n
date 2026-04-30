# 07 — Build CI（T8）

## Must Read

无。

## Must Follow

- `tests/tdd-master-contract.md`
- `tests/ci-contract.md`

## Allowed Files

- `REPO/.github/workflows/build.yml`

## 前置 Gate

T3（05-compile-qm）PASS

## Task

搭建 GitHub CI，自动编译 `.ts` → `.qm` 并发布 Release。

### CI 流程

1. **触发条件** — push to main / PR to main
2. **编译步骤** — 安装 Qt 工具链，运行 `lrelease` 编译所有 `.ts` 文件
3. **产物上传** — 将 `.qm` 文件作为 artifact 上传
4. **Release** — tag push 时自动创建 GitHub Release，附带语言包

## TDD Behaviors

| # | RED | GREEN |
|---|-----|-------|
| 1 | `build.yml` 不存在 | 创建 GitHub Actions workflow 文件 |
| 2 | 缺触发条件 | 添加 push / PR trigger |
| 3 | 缺 `lrelease` 编译步骤 | 添加 Qt 工具链安装和编译步骤 |
| 4 | 缺 artifact / release 步骤 | 添加 upload-artifact 和 release 步骤 |

## Gate Check

按 `tests/ci-contract.md` 中的验证命令全部通过。

## Run Log

写到 `runs/YYYY-MM-DD-T8-build-ci.md`
