# 00 — Bootstrap Context

## Must Read

- `REPO/docs/workflows/cavalry-i18n/Runbook.md`
- `REPO/docs/workflows/cavalry-i18n/Flow.md`
- `REPO/docs/workflows/cavalry-i18n/Project.md`
- `REPO/docs/workflows/cavalry-i18n/Acceptance.md`
- `REPO/docs/workflows/cavalry-i18n/TODO.md`

## Must Follow

无。

## Allowed Files

无（纯阅读步骤，不创建或修改任何文件）。

## Task

读取所有入口文档，理解项目全貌：

1. 阅读 Runbook.md — 了解整体工作流、步骤编号、前置关系
2. 阅读 Flow.md — 了解数据流、文件流转路径
3. 阅读 Project.md — 了解项目背景、技术栈、目标语言
4. 阅读 Acceptance.md — 了解每个里程碑的验收标准和 Gate Check
5. 阅读 TODO.md — 了解当前进度、阻塞项

完成后应能回答：
- 项目产出什么？（LanguageSwitcher.js + 多语言包）
- 支持哪些语言？（en / zh-Hans / zh-Hant / ja_JP）
- 翻译分几层？（第一层 JSON 覆写 + 第二层 Qt .qm 注入）
- 里程碑顺序？（T0 → T1 → T1.1 → T2 → T3 → T4 → T8 → T9 → Final）

## TDD Behaviors

无（纯阅读步骤）。

## Gate Check

无（直接进入下一步）。

## Run Log

写到 `runs/YYYY-MM-DD-bootstrap-context.md`
