<!--
[INPUT]: 依赖 injector/CavalryTranslatorInjector.mm 的 QLineEdit/QListWidget 翻译路径、tools/generate_embedded_translations.js 的 TS 到嵌入表投影、tools/model_display_translations.json 的显示层词典、tools/check_app_contracts.js 的 Add Layer / niceName / tags 合同，以及用户在 Add Layer 搜索框中文检索失败的现场反馈
[OUTPUT]: 对外提供 Add Layer 本地化搜索调研结论、根因边界、不可触碰的数据层与后续实现路线
[POS]: docs/audits 的 dated runtime 审计记录，回答“中文显示已经存在但中文搜索为何不生效”这一搜索索引问题
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Add Layer Localized Search Audit - 2026-05-21

## 结论

Add Layer 当前不是“缺翻译”，而是“显示层翻译”和“搜索过滤索引”断开。

仓库已经能把 Add Layer 卡片、菜单项和搜索框 placeholder 翻成中文：`injector/generated_translations.inc` 里有 `Search for a layer to add -> 搜索要添加的图层`、`Add Divisions -> 添加分割`、`Align -> 对齐` 等条目。但 injector 只改 Qt 控件的可见文本，不改 Cavalry 内部用于过滤的 query/index。

因此用户看到 `添加分割`，却仍要输入 `Add Divisions` 或英文 token 才能搜到。这是符合当前代码结构的症状。

## 证据

1. `tools/generate_embedded_translations.js` 从 `tools/*.ts` 和 `tools/model_display_translations.json` 生成 `injector/generated_translations.inc`。这是一张 source text -> localized text 的显示层表。
2. `injector/CavalryTranslatorInjector.mm` 的 `translateLineEditDisplayText()` 只翻译 `QLineEdit::text()` 和 `placeholderText()`；`hookLineEditTextChanges()` 也只是把后续文本显示翻译后 `setText()`。
3. `translateListWidgetItems()` 只遍历 `QListWidgetItem` 并 `item->setText(translated)`；没有设置搜索专用 role，没有接触 `QSortFilterProxyModel`，也没有替换 Cavalry 的 filter string。
4. `nodeStrings.json` 的 `niceName` 被合同要求保持英文，用来保护 Time Editor / 模型复用路径。把 `niceName` 改中文会污染模型层，不是搜索修复路径。
5. `Definitions/nodeDefinitions.json.tags` 被合同要求保持英文 source token，因为 Add Layer tag chip 依赖原始 token。把 tag 翻译成中文会造成黑块或空 chip。

## 数据层分流

| 层 | 当前用途 | 是否能为搜索直接改中文 |
| --- | --- | --- |
| `nodeType` | 机器身份，如 `addDivisions` | 不能改 |
| `Definitions.tags` | Cavalry 分类 chip / 内部筛选 token | 不能改 |
| `nodeStrings.niceName` | 模型名，Time Editor 复用 | 不能批量改 |
| `tools/*.ts` | Qt/compiled/runtime 显示文本 | 可作为反向索引来源 |
| `model_display_translations.json` | display-only 模型名词典 | 可作为反向索引来源 |
| `QLineEdit` 用户输入 | 触发 Cavalry 过滤 | 需要 scoped bridge，不能全局改 |

## 根因判断

当前搜索框很可能仍把用户输入交给 Cavalry 原生过滤器。这个过滤器按英文 source token、`nodeType`、英文 display role 或 tag token 工作；injector 后置翻译可见文本时，过滤器的索引已经不是中文。

这解释了两个现象：

- 英文搜索仍然有效，因为原生索引没坏。
- 中文显示有效但中文搜索无效，因为显示文本不是过滤器的真相源。

还不能武断说过滤器一定是 `QSortFilterProxyModel`，需要一次 live item model / QObject capture 确认 `QuickAddWindow` 下搜索框、列表、model class、role values、输入前后 row count 与 parentChain。

## 不建议的修法

- 不要把 `languages/*/nodeStrings.json` 的 `niceName` 改回中文。
- 不要翻译 `Definitions/nodeDefinitions.json.tags`。
- 不要把 `nodeType`、`superType`、`defaultSubnodeType` 这类身份字段加中文。
- 不要全局拦截所有 `QLineEdit` 中文输入；资源名、图层名、属性名搜索有不同语义。
- 不要把用户可见 query 永久替换成英文；这解决机器，不解决人。

## 可行路线

首选方向是 Add Layer 作用域内的双语 query bridge：

1. 只在 parentChain 命中 `QuickAddWindow` 的搜索框启用。
2. 从 `generated_translations.inc` / `model_display_translations.json` 建立 localized -> English 的反向映射。
3. 用户输入中文时，匹配中文 query 对应的英文 source。
4. 用 queued signal 把英文 source 喂给 Cavalry 原生过滤器。
5. 再用 signal-blocked 写回中文 query，让用户仍看到中文。

这个方案的好处是保留 Cavalry 原生添加逻辑、排序、分类、回车行为和英文搜索能力。坏处是它依赖 Qt signal 顺序与 `QLineEdit` 事件时机，需要 live canary 验证。

备选方向是 item model search role 注入：如果 live capture 证明列表模型有可写 role，且过滤器使用 DisplayRole/EditRole，可以在 `QuickAddWindow` 下为 item 增加本地化 role 或提前写入双语 display string。但这比 query bridge 更容易碰到模型污染，优先级较低。

## 验收口径

- 在简体中文下，Add Layer 搜索 `分割` / `添加分割` 能命中 `Add Divisions`。
- 搜索 `align` / `Align` 仍能命中 `Align`。
- 搜索 `对齐` 能命中 `Align`，且不破坏属性编辑器里的 `对齐` 属性搜索语义。
- `Definitions.tags` 仍与英文基线一致。
- `nodeStrings.niceName` 仍与英文基线一致。
- Time Editor 右侧模型名仍保持英文，不出现 CJK 方块或空白。

## 代码坏味道

当前坏味道不是某个 if 写错，而是“显示层翻译承担了搜索层期待”。显示是结果，搜索是索引；让结果反向影响索引，必然脆弱。

正确设计应该让搜索索引显式存在：稳定英文 source 负责机器，localized alias 负责人类。能消失的特殊情况，是把“中文搜不到”从 UI 后处理里拿出来，变成 Add Layer 搜索模型的一等能力。
