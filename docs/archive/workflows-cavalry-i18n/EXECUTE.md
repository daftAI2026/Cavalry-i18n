<!--
[INPUT]: 依赖 Runbook.md、Project.md、Acceptance.md、Flow.md、prompts/*、tests/*
[OUTPUT]: 对外提供 AI agent 冷启动执行协议
[POS]: cavalry-i18n 工作流的自动化执行入口
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# EXECUTE — cavalry-i18n 冷启动执行协议

## 任务

执行 cavalry-i18n workflow，持续推进直到 M1+M2+M3 全部通过。

## 工作目录

```
REPO     = /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n
WORKFLOW = REPO/docs/workflows/cavalry-i18n
```

## 入口文档（按顺序读）

```
WORKFLOW/Runbook.md     — 执行纪律
WORKFLOW/Flow.md        — 全链路流程图
WORKFLOW/Project.md     — 总协议
WORKFLOW/Acceptance.md  — 验收闸门
WORKFLOW/TODO.md        — 任务队列
```

## 当前代码状态

当前仓库**已存在** T0-T9 的主要产物与 `runs/` 证据。冷启动执行者默认从**审查现有产物**开始，而不是按“项目刚启动”覆盖现有成果。

- `languages/*`、`tools/*.ts`、`.qm`、`LanguageSwitcher.js`、`README.md`、`.github/workflows/build.yml`
- `docs/workflows/cavalry-i18n/runs/*.md`
- `docs/plan-v3.md`、`docs/translation-guidelines.md`、`docs/cavalry-glossary*.md`

重跑时先判断哪些 run log 仍有效，再从失效 stage 继续。

## 审查锚点（冷启动必做）

在相信任何 `runs/*.md` 之前，先按以下顺序做一次冲突检查：

1. 先读 `WORKFLOW/TODO.md` 的 **Active Milestones**
2. 再读 `WORKFLOW/TODO.md` 的 **Post-Audit Follow-ups**
3. 再读 `WORKFLOW/TODO.md` 的 **Full Audit Snapshot**
4. 最后才读取 `WORKFLOW/runs/*.md`

如果 `TODO.md` 的审查结论与历史 run log 矛盾，以 **TODO.md 的最新审查结论**为准，并将相关 run log 视为需要重置或失效。

当前审查优先级：

1. `languages/*/nodeStrings.json`
2. `languages/*/(appStrings|tips|onboarding|plugins/*.json)`
3. `tools/*.ts`
4. 过程文件与未跟踪残留

## 执行顺序

| Prompt | Task ID | 内容 |
|---|---|---|
| prompt 00 | bootstrap | bootstrap-context |
| prompt 01 | T0 | expand-glossary |
| prompt 02 | T1 | extract-english-strings |
| prompt 03 | T1.1 | define-translation-whitelist |
| prompt 04 | T2 | translate-all-languages |
| prompt 05 | T3 | compile-qm |
| prompt 06 | T4 | write-language-switcher |
| prompt 07 | T8 | build-ci |
| prompt 08 | T9 | write-readme |
| prompt 09 | final-gate | final-gate |

## 翻译工具配置

- **Skill**: baoyu-translate
- **Mode**: refined
- **Config**: `.baoyu-skills/baoyu-translate/EXTEND.md`
- **Glossary**: `docs/cavalry-glossary.md`（T0 产出的四语言版）
- **Validator**: `tools/validate_translations.py`（T2 完成后必跑，输出 JSON report + markdown summary）
- **繁中策略**: 独立翻译，不是简中转繁中

## Language Code Convention

- **Repo / runtime code**：`en` / `zh-Hans` / `zh-Hant` / `ja_JP`（BCP 47 script subtag）
- **Report alias**：`en` / `zh_Hans` / `zh_Hant` / `ja`（validate 报告中的短名）
- 目录名、JSON `language` 字段、.qm 文件名、CI 脚本统一使用 repo code。

## TDD 执行纪律

每个 prompt 按单行为原子循环执行：

```
写一个行为的失败测试 → 运行确认 RED → 最小实现 → 运行确认 GREEN → 下一个行为
```

详见 `WORKFLOW/tests/tdd-master-contract.md`。

## Gate 检查

每个 stage 完成后执行 gate 检查，确认所有契约通过后才进入下一个 stage。

详见 `WORKFLOW/tests/gate-check-contract.md`。

## Run Log 格式

```
runs/YYYY-MM-DD-{task-id}-{task-name}.md
```

示例：`runs/2026-04-20-T0-expand-glossary.md`

Status 取值：`PASS` / `FAIL` / `INVALIDATED` / `BLOCKED`

## 分段执行

推荐分段点：

| 轮次 | Prompt | 内容 |
|:---:|---|---|
| 第一轮 | 00-01 | bootstrap + glossary |
| 第二轮 | 02-03 | extract + whitelist |
| 第三轮 | 04-05 | translate + compile |
| 第四轮 | 06-08 | switcher + CI + README |
| 第五轮 | 09 | final gate |

## 禁止事项

- ❌ 跳过 prompt 顺序
- ❌ 批量 RED（一次写多个失败测试）
- ❌ GREEN 阶段修改测试
- ❌ 不写 run log
- ❌ M1 通过就汇报完成

## 完成定义

**M1 + M2 + M3 全 PASS**。M_manual 记录但不阻塞。

汇报时必须区分：

- **DELIVERY COMPLETE / M_manual PENDING**
- **ALL GATES PASS**

并且必须单独说明：

- `nodeStrings` 是否仍有大块英文叶子字符串
- `zh-Hant` 是否仍存在简繁混杂
- 是否还有未分类过程文件残留
