<!--
[INPUT]: 依赖 docs/plan-v3.md 的技术方案、docs/translation-guidelines.md 的翻译原则、docs/cavalry-glossary-en-zh.md 的术语表
[OUTPUT]: 对外提供 Cavalry i18n workflow 总协议，约束执行顺序、翻译范围、禁止事项、验证方式
[POS]: cavalry-i18n 工作流的项目宪法
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Project — Cavalry i18n 项目宪法

---

## General Instruction

Cavalry 是基于 Qt 6.6.3 的 2D 动画软件（Canva 旗下，免费），我们要做**第三方多语言切换器**。纯 Cavalry 原生脚本，用户零依赖、下载即用。支持语言：`en` / `zh-Hans` / `zh-Hant` / `ja_JP`。

核心判断：

- **术语表是翻译质量的基础**，先建术语表再翻译。
- 翻译内容和工具脚本可以并行开发。
- 翻译术语必须与 AE / C4D / Blender 中文版对齐，**不自造词**。

---

## Language Code Convention

- **Repo / runtime code**：`en` / `zh-Hans` / `zh-Hant` / `ja_JP`
- **Workflow / human-facing alias**：`en` / `zh_Hans` / `zh_Hant` / `ja`
- Workflow 中提到 `zh_Hans` / `zh_Hant` / `ja` 时，执行与校验必须映射回仓库真实代码，不得擅自重命名目录、产物文件或 JSON 中的 `language` 字段。

---

## Translation Coverage

两层翻译覆盖：

| 层级 | 内容 | 方式 |
|:---:|------|------|
| **第一层** | 节点名、属性名、Tooltip、插件名描述、提示/引导 | JSON 替换 |
| **第二层** | 菜单栏、右键菜单、标准按钮（OK / Cancel） | Qt `.qm` 注入 |

---

## Translation Rules

只翻译「**面向用户展示的自然语言文本**」。以下内容**不翻译**：

- JSON key
- 专有名词：Lottie, Bezier, RGB, CMYK, SVG
- 品牌/产品名：Cavalry, Canva, Forge Dynamics
- 行业缩写：FPS, BPM, GPU, JSON, CSV
- 程序标识符、文件路径、数值、布尔、颜色值
- 占位符：`{0}`, `%1`, `{{name}}`
- HTML 标签

**繁中独立翻译**，不是简中转繁中（用词习惯不同，如：保存→儲存、文件→檔案、默认→預設、视频→影片、程序→程式、信息→資訊）。

---

## Milestones

| 里程碑 | 包含任务 | 说明 |
|---|---|---|
| **M1 Content Ready** | T0 + T1 + T1.1 + T2 + T3 | 所有翻译内容就绪 |
| **M2 Switcher Ready** | T4 | 切换脚本可用 |
| **M3 Release Ready** | T8 + T9 | CI + README 就绪 |
| **M_manual** | M5 - M7 | 在 Cavalry 中手动验证 |

---

## Solution to Work On

工作目录：

```
REPO     = /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n
WORKFLOW = REPO/docs/workflows/cavalry-i18n
```

各任务允许修改的文件：

| 任务 | 允许修改的文件 |
|---|---|
| T0 | `docs/cavalry-glossary.md` |
| T1 | `tools/extract_strings.py`, `languages/en/**` |
| T1.1 | `docs/translation-whitelist.json` |
| T2 | `languages/zh-Hans/**`, `languages/zh-Hant/**`, `languages/ja_JP/**`, `tools/*.ts`, `.baoyu-skills/**` |
| T3 | `languages/*/cavalry_*.qm`, `languages/*/qtbase_*.qm` |
| T4 | `LanguageSwitcher.js` |
| T8 | `.github/workflows/build.yml` |
| T9 | `README.md`, `LICENSE` |

---

## Evidence Sources

```
docs/plan-v3.md                           — 技术方案（架构、API、切换逻辑）
docs/translation-guidelines.md            — 翻译原则（术语对齐、简繁差异）
docs/cavalry-glossary-en-zh.md            — 初始术语表（en→zh-Hans，78 条）
.baoyu-skills/baoyu-translate/EXTEND.md  — 翻译 skill 项目配置
```

---

## Source of Truth

| 领域 | 真相源 | 说明 |
|---|---|---|
| 翻译术语 | `docs/cavalry-glossary.md`（四语言版，T0 产出） | 所有翻译必须严格匹配 |
| 翻译范围 | `docs/translation-whitelist.json`（T1.1 产出） | 定义哪些字段翻译/不翻译 |
| 英文原文 | `languages/en/`（T1 产出） | 翻译的源文件 |
| 工具行为 | `docs/plan-v3.md` | LanguageSwitcher.js 的功能规格 |
| 翻译原则 | `docs/translation-guidelines.md` | 跨语言的翻译约束 |

---

## Execution Protocol

1. 先读 `Runbook.md`
2. 再读 `Flow.md`
3. 再读 `Project.md`
4. 再读 `Acceptance.md`
5. 按 `TODO.md` 找到当前未完成任务
6. 进入 `prompts/` 执行对应 prompt
7. 每个 prompt 按单行为 RED → GREEN → REFACTOR 循环
8. 在 `runs/` 写运行记录

---

## Completion Protocol

默认完成定义：**M1 + M2 + M3 全 PASS**。

- `M_manual` 不阻塞完成，但结果必须记录。
- `M_manual` 未完成时，对外表述必须是 **DELIVERY COMPLETE / M_manual PENDING**，不能写 **All gates PASS**。
- 只有 `M1 + M2 + M3 + M_manual` 全 PASS 时，才可以写 **All gates PASS**。
- 不满足条件时回复 **NOT COMPLETE**。

---

## Commit Message Policy

允许：

```
feat(i18n): expand glossary with zh-Hant and ja_JP
feat(i18n): add language switcher script
build(ci): add qm compilation workflow
docs: add README and LICENSE
```

禁止：把翻译内容写进 commit message。
