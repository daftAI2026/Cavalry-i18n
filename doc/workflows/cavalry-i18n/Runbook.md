<!--
[INPUT]: 依赖 Project.md 的里程碑与完成协议、Acceptance.md 的闸门条件
[OUTPUT]: 对外提供执行顺序、停止条件、TDD 纪律、运行日志格式
[POS]: cavalry-i18n 工作流的运行手册
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Runbook — Cavalry i18n 运行手册

---

## Default Target

默认目标是 **M1 + M2 + M3**。不是只做 M1。

---

## Non Stop Rule

以下情况**不能停止并汇报完成**：

- 单个 task pass
- 单个 gate pass
- 单个 verify script pass

---

## Stop Conditions

允许停止的情况：

1. **M1 + M2 + M3 全部通过**，并写入 final gate run log。
2. **遇到无法自行修复的 blocker**（如缺 Cavalry 安装），写 BLOCKED run log。
3. **用户明确要求停止**。

---

## Completion Wording

- **DELIVERY COMPLETE** = `M1 + M2 + M3` 全 PASS。
- **ALL GATES PASS** = `M1 + M2 + M3 + M_manual` 全 PASS。
- 如果 `M_manual` 仍是 `PENDING` 或 `FAIL`，最终回复必须明确写出该状态，不能笼统写 “All gates PASS”。

---

## Execution Order

```
00-bootstrap-context.md
01-expand-glossary.md
02-extract-english-strings.md
03-define-translation-whitelist.md
04-translate-all-languages.md
05-compile-qm.md
06-write-language-switcher.md
07-build-ci.md
08-write-readme.md
09-final-gate.md
```

---

## Gate Checks

引用 `tests/gate-check-contract.md`。

每个里程碑闸门的验证逻辑和脚本定义在该 contract 中，执行时必须按 contract 规定的检查项逐一验证。

---

## TDD Discipline

引用 `tests/tdd-master-contract.md`。

- 每个 prompt 按**单行为原子循环**：RED → GREEN → REFACTOR。
- 同一时间**最多一个未修复 RED**。
- GREEN 阶段**禁止修改测试**。

---

## Run Log Format

路径：`runs/YYYY-MM-DD-{task-id}-{task-name}.md`

示例：`runs/2026-04-20-T0-expand-glossary.md`

> Task ID（T0 / T1 / T1_1 / T2 / T3 / T4 / T8 / T9）必须包含在文件名中，否则 gate-check glob 无法匹配。

Status 只能是以下四种之一：

| Status | 含义 |
|---|---|
| `PASS` | 验证通过 |
| `FAIL` | 验证失败 |
| `INVALIDATED` | 前置条件变化，结果作废 |
| `BLOCKED` | 无法自行修复的阻塞 |

**禁止**使用 `DONE` / `OK` / `looks good` 等非标准状态。

---

## Segmented Execution

推荐分段点：

| 轮次 | Prompt | 内容 |
|---|---|---|
| 第一轮 | 00 - 01 | bootstrap + glossary |
| 第二轮 | 02 - 03 | extract + whitelist |
| 第三轮 | 04 - 05 | translate + compile |
| 第四轮 | 06 - 08 | switcher + CI + README |
| 第五轮 | 09 | final gate |

---

## Final Audit Before Closing

收口前必须补做三类审查：

1. **翻译残留审查**：按 whitelist 的 `translate` 分支扫描叶子字符串，检查未批准英文残留；不能只检查 CJK+Latin 是否紧邻。
2. **过程文件审查**：确认临时脚本、分片 JSON、缓存文件、未跟踪文件是否应该保留；不确定时先标记，不擅自删除。
3. **误删审查**：确认 `languages/*`、`.qm`、`tools/*.ts`、`LanguageSwitcher.js`、`README.md`、`runs/*` 没有被错误删除。
4. **语言纯度审查**：`zh-Hans` 额外检查繁体 / 港台污染，`zh-Hant` 额外检查简体污染，`ja_JP` 额外检查明显中文 UI 词污染；不能因为字符串“看起来像本地语言”就算通过。

当前已知高风险面：

- `languages/*/nodeStrings.json` 是主战场，当前问题远多于 `appStrings` / `tips` / `onboarding` / `plugins`
- 风险优先级：**Help/Tooltip 整段英文** > **带空格半翻译** > **zh-Hant 简体污染** > **可接受的专业英文保留**

---

## Final Report Rule

最终回复必须包含以下五项：

1. **M1 / M2 / M3 result** — 每个里程碑的 PASS / FAIL 状态
2. **M_manual result** — 如有手动验证结果
3. **Remaining failures** — 未通过的检查项列表
4. **Next steps** — 后续需要执行的动作
5. **Artifact hygiene** — 过程文件是否已清理 / 标记，是否存在未分类残留
