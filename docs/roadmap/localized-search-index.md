<!--
[INPUT]: 依赖 docs/audits/add-layer-localized-search-2026-05-21.md 的调研结论、injector/CavalryTranslatorInjector.mm 的 QLineEdit/QListWidget runtime hook、tools/model_display_translations.json 与 tools/*.ts 的显示层翻译源
[OUTPUT]: 对外提供本地化搜索索引 roadmap，拆分 Add Layer 中文搜索、反向索引、live capture 与回归验收阶段
[POS]: docs/roadmap 的 localized search 主题入口，把“中文显示但英文搜索”的问题收敛成可实施路线
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Localized Search Index Roadmap

状态: Proposed  
问题: Add Layer 等 runtime 搜索框显示为中文后，仍只能按英文 source token 检索。  
依据: [`docs/audits/add-layer-localized-search-2026-05-21.md`](../audits/add-layer-localized-search-2026-05-21.md)

## 目标

让用户能用当前界面语言搜索 Add Layer 条目，同时保留英文搜索、模型身份字段、tag chip 和 Time Editor 英文保护线。

## 非目标

- 不翻译 `nodeType` / `superType` / `defaultSubnodeType`。
- 不把 `nodeStrings.niceName` 批量改中文。
- 不翻译 `Definitions.tags`。
- 不全局改变资源名、图层名、用户自定义名称的搜索语义。
- 不用模糊拼音搜索作为第一阶段目标。

## 阶段

### R1 - QuickAdd 搜索现场抓取

状态: Not started

用 `CAVALRY_I18N_DUMP_ITEM_MODELS=1` 和 cursor widget capture 抓 `QuickAddWindow` 下搜索框、列表、model class、role values、输入前后 row count。目标是确认过滤器到底吃 `QLineEdit::text()`、DisplayRole、EditRole、UserRole，还是内部 source token。

验收:

- 报告里记录 `QuickAddWindow` parentChain、`QLineEdit` class/objectName/properties。
- 报告里记录列表 view/model class 与 `DisplayRole` / `EditRole` / `UserRole+*`。
- 至少对比一次英文 query 和中文 query 的 row count / visible rows。

### R2 - 反向翻译索引

状态: Not started

从 `tools/*.ts` 与 `tools/model_display_translations.json` 派生 localized -> English reverse index。索引只服务 runtime 搜索，不回写 JSON 语言包，不进入 `nodeStrings.niceName`。

验收:

- `添加分割 -> Add Divisions`、`对齐 -> Align`、`动画控制 -> Animation Control` 可查。
- 英文 source 本身仍保留。
- 同一个中文命中多个英文 source 时返回候选集合，不用最后写入覆盖前者。

### R3 - Scoped query bridge

状态: Not started

只在 `QuickAddWindow` 搜索框中启用中文 query bridge：用户看到中文 query，Cavalry 原生过滤器收到对应英文 source。优先尝试 queued English filter + signal-blocked localized restore，避免破坏用户输入体验。

验收:

- 输入 `分割` 或 `添加分割` 能命中 `Add Divisions`。
- 输入 `对齐` 能命中 `Align`。
- 输入 `align` / `Add Divisions` 的英文路径不退化。
- 用户输入框最终仍显示用户输入的中文。

### R4 - 合同与 live canary

状态: Not started

补源码合同和 live canary，锁定作用域与不可触碰字段。

验收:

- contract 要求 query bridge 仅在 `QuickAddWindow` parentChain 下启用。
- contract 要求 `Definitions.tags` 与英文基线一致。
- contract 要求 `nodeStrings.niceName` 与英文基线一致。
- live canary 覆盖中文 query、英文 query、Time Editor 英文模型名。

### R5 - 扩展评估

状态: Not started

Add Layer 稳定后，再评估属性搜索、命令搜索、资源搜索、图层搜索是否应该共享同一套策略。每类搜索必须先分清“系统条目”还是“用户数据”。

验收:

- 属性/命令搜索若使用系统翻译表，可加入 localized alias。
- 资源名、图层名、用户自定义名称不自动翻译。
- 每个新搜索面都有独立现场报告，不把 Add Layer 经验盲目复制。

## 风险

- Qt signal 顺序可能导致短暂空结果或递归，需要 queued 调度与 signal blocker 控制。
- 中文到英文可能一对多，必须保留候选集合或按当前列表上下文裁剪。
- 如果 Cavalry 过滤器不吃 `QLineEdit::text()` 而吃内部 token，R3 需要改为 model role 注入或放弃 runtime 修复。
- 过度扩大作用域会误伤用户数据搜索。

## 下一步

先执行 R1。没有 QuickAdd 现场模型证据前，不进入实现。
