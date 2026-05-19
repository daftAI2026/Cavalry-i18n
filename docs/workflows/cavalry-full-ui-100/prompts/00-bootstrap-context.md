<!--
[INPUT]: 依赖 cavalry-full-ui-100/ 所有入口文档 + docs/ 翻译准则
[OUTPUT]: 对外提供冷启动上下文加载协议
[POS]: prompts 的第一步，纯阅读，建立全局认知
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 00 — Bootstrap Context

## Must Read

按以下顺序阅读（顺序即优先级）：

**绕过历史（先读，建立防御意识）**

1. `WORKFLOW/Anti-Patterns.md` — fixture / curated、伪翻译、分母缩水三类绕过路径全览

**执行协议**

2. `WORKFLOW/EXECUTE.md` — 绝对禁止清单（7 类）+ 冷启动命令 + Launch Protocol
3. `WORKFLOW/Acceptance.md` — W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0-G4 gate 通过/失败条件
4. `WORKFLOW/Runbook.md` — Non-Stop Rule、Anti-Bypass Rule、循环执行规则
5. `WORKFLOW/Project.md` — 项目宪法：目标、基线、真相源、完成语义
6. `WORKFLOW/TODO.md` — 当前任务队列与基线状态
7. `WORKFLOW/Flow.md` — 端到端流程图与 gate ownership

**翻译准则（执行翻译任务前必读）**

8. `REPO/docs/translation-guidelines.md` — 翻译原则：术语对齐、零混合语言、简繁差异
9. `REPO/docs/cavalry-glossary.md` — 四语言术语表（en/zh-Hans/zh-Hant/ja_JP，~50 条）
10. `REPO/docs/cavalry-glossary-en-zh.md` — 英简中双语术语表（带翻译决策注释）
11. `REPO/tools/translation-whitelist.json` — JSON 字段分类（translate/no_translate/locale_sync）

## Must Follow

无。

## Allowed Files

- `WORKFLOW/runs/YYYY-MM-DD-bootstrap-context.md`（仅允许写本步骤 run note）

除上述 run note 外，不创建或修改任何文件。

## Task

读取所有入口文档，理解项目全貌。完成后应能回答以下所有问题：

### 绕过历史

- Out-of-Band Truth 怎么绕？（fixture 目录 + curated 清单 + `prepare:full-ui-gate` 垫数据）
- Counterfeit Form 怎么绕？（本地翻译引擎 + `（译）`占位 + 全角拉丁 + `页:1` 错位填词 + 合成 source / 伪 context / Frankenstein 残留）
- Denominator Shrink 怎么绕？（merge 丢项 + source-map 子集 + allowlist 污染）
- 这些绕过为什么能成功？（detector 只用 `/[A-Za-z]/` 判断、阈值 99 而非 100、没有 provenance 校验）

### 当前状态

- 当前仓库 JSON coverage？（必须引用 `Project.md` / `TODO.md` / 最新 run note / `RUN_RECORD` 中**带日期、commit/branch、artifact path、provenance** 的记录，不能背诵旧数字）
- 当前 compiled coverage？（必须引用当前 source-map / `RUN_RECORD` 的带出处记录，不能复述历史快照）
- 当前 runtime inventory？（必须区分“规范目标的 session-scoped contract”与“当前代码仍是 root-cache 模式”的实现真相，并引用对应证据）
- 哪些工具不存在？（verify_gate_inputs / capture_accessibility / merge_runtime / run_live_full_ui_matrix）
- 这些工具在哪里有骨架？（`archive/cavalry-full-ui-100-v2-invalidated-20260428` 分支）

### Gate 顺序

- 固定执行顺序？（W-AUDIT → G-P → §P5 → G-CAPTURE → G-X → G0 → G2 → G3 → G1 → backlog → G4）
- 完成语义？（`ALL GATES PASS` vs `NOT COMPLETE`，无中间态）

### 翻译原则

- 术语对齐哪些软件？（AE、C4D、Blender、DaVinci Resolve）
- 零混合语言三种合法形态？（纯目标语言 / 纯英文术语 / 英文术语+空格+目标语言）
- zh-Hant 与 zh-Hans 的关系？（独立翻译，不是简转繁）
- 翻译决策优先级？（术语表 → AE/C4D → Microsoft Terminology → 保留英文）

## TDD Behaviors

无（纯阅读步骤）。

## Gate Check

无（直接进入下一步）。

## Run Note

写到 `runs/YYYY-MM-DD-bootstrap-context.md`
