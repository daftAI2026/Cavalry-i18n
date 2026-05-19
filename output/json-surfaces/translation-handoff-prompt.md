# Translation Handoff Prompt

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

下面这段可以直接交给下一个接手翻译工作的人。

```markdown
哥，这是一份针对 Cavalry-i18n 新增 JSON surface 的翻译接手任务。请先不要改打包逻辑，也不要把未完成翻译直接塞进 `languages/`。当前阶段目标是：完成新增 JSON 的翻译分母、翻译、质量校验，为后续 38 个 JSON 全量打包做准备。

## 当前真实状态

项目路径：
`/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n`

已发现 Cavalry 当前版本共有 38 个 JSON asset：
`/Applications/Cavalry.app/Contents/assets/**/*.json`

当前正式语言包 `languages/{en,zh-Hans,zh-Hant,ja_JP}/` 只覆盖 16 个 JSON：

- `appStrings.json`
- `nodeStrings.json`
- `tips.json`
- `onboarding.json`
- 12 个 `plugins/*Filter.json` 的 `strings.json`

新增未覆盖 JSON 为 22 个，已经抓取并生成工作区：

- `output/json-surfaces/asset-map.json`
- `output/json-surfaces/translation-report.json`
- `output/json-surfaces/en/`
- `output/json-surfaces/draft/zh-Hans/`
- `output/json-surfaces/draft/zh-Hant/`
- `output/json-surfaces/draft/ja_JP/`

重要：`draft/` 不是完成翻译。它只是用已有 `injector/generated_translations.inc` 和既有语言包做了精确匹配预填，未命中的字符串仍保留英文。

## 当前统计

- Total JSON files: 38
- Already covered: 16
- Missing coverage: 22
- Total string leaves across 38 files: 24939
- 自动预填：
  - zh-Hans: 6086 leaves
  - zh-Hant: 6087 leaves
  - ja_JP: 6110 leaves
- 仍有大量英文残留，尤其在：
  - `Definitions/nodeDefinitions.json`
  - `Definitions/systemPresets.json`
  - `Learn/Guides/*.json`
  - `MetaData/*.json`
  - `plugins/*Definitions.json`
  - `Style/theme.json`

## 额外阻塞问题：compiled TS 三语数量不一致

这不是 38 个 JSON 引起的，但会影响 UI 注入效果，必须同步处理。

当前检查结果：

- `languages/*` 现有 16 个 JSON 三语叶子数一致：都是 6708。
- compiled/runtime 翻译源不一致：
  - `zh-Hans.ts`: 3605 messages
  - `zh-Hant.ts`: 3479 messages
  - `ja_JP.ts`: 3522 messages
- `generated_translations.inc` 与这些 `.ts` 数量一致，所以问题来自 `.ts` 源，不是生成脚本漏生成。
- `zh-Hant` 相比 `zh-Hans` 少 52 个 `MenuBarManager` source。
- `ja_JP` 相比 `zh-Hans` 少 878 个 `MenuBarManager` source，并且有 870 个本应属于 `MenuBarManager` 的条目跑到了 `QPrintDialog` context。
- `ja_JP.ts` 只有 10 个 context，而 `zh-Hans.ts` / `zh-Hant.ts` 有 11 个；`QPrintDialog` 正常应只有 3 条打印相关消息，但 `ja_JP.ts` 里有 881 条。

影响：

`QTranslator` 会按 exact `(context, source)` 查找。日文条目如果被放进 `QPrintDialog`，而运行时请求的是 `MenuBarManager`，即使译文存在也不会命中。

参考报告：

`output/json-surfaces/compiled-ts-parity-report.md`

## 参考提示词

如果需要语言风格/质量要求，请参考：

- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/workflows/cavalry-full-ui-100/prompts/08-translate-zh-hans.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/workflows/cavalry-full-ui-100/prompts/09-translate-zh-hant.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/workflows/cavalry-full-ui-100/prompts/10-translate-ja-jp.md`

## 任务目标

请完成新增 22 个 JSON surface 的三语翻译，不要改 injector，不要改 Tauri 打包，不要急着 patch `/Applications/Cavalry.app`。

同时，请把 compiled TS parity 作为并行 P0：

1. 修复 `tools/zh-Hant.ts` 缺失的 52 个 `MenuBarManager` 条目。
2. 修复 `tools/ja_JP.ts` 的 context 错位，把误放在 `QPrintDialog` 的 `MenuBarManager` 条目移回正确 context。
3. 保证三语 compiled UI source denominator 一致。
4. 修复后重新生成 `injector/generated_translations.inc`。

优先级：

1. P0: `Learn/Guides/*.json`
2. P0: `plugins/*Definitions.json`
3. P1: `Definitions/systemPresets.json`
4. P1: `Definitions/nodeDefinitions.json`
5. P2: `Style/theme.json`
6. P2: `MetaData/*.json`

原因：

- Guides、plugin definitions、presets 更可能直接影响 UI。
- MetaData 很多是 API/developer docs，体量大，第二轮处理。
- Style/layout 可能不是用户可见文本，先审查再决定是否翻译。

## 工作方式

1. 读取 `output/json-surfaces/asset-map.json`，确认 38 个 JSON 的资产路径和语言包路径。
2. 读取 `output/json-surfaces/translation-report.json`，按未翻译英文数量排序处理。
3. 在 `output/json-surfaces/draft/{lang}/` 中修改翻译草稿。
4. 保持 JSON 结构完全不变：不得删 key、不得改数组长度、不得改非字符串类型。
5. 只翻译用户可见文案；明显代码/API/type/id/path/enum key/颜色值/文件名/品牌名保留英文。
6. 对 `language` 字段保持 locale code：`zh-Hans` / `zh-Hant` / `ja_JP`。
7. 翻译完成后生成缺口报告，列出仍保留英文的原因。
8. 审核通过后，再把完成的 draft 复制到 `languages/{lang}/` 对应路径。
9. 修复 TS parity 后，运行生成脚本更新 `injector/generated_translations.inc`。
10. 最后再交给实现者修改 `src-tauri/src/patch.rs`，让 apply-language 覆盖 38 个 JSON。

## 必须避免

- 不要把未翻译 draft 直接复制进 `languages/`。
- 不要为了通过覆盖率把技术字段乱翻。
- 不要修改 `injector/generated_translations.inc`，它是生成产物。
- 不要修改 `/Applications/Cavalry.app`。
- 不要把 `MetaData/*.json` 里的函数名、参数名、类型名误翻。

## 已知历史质量问题，翻译时顺手避免

zh-Hant:

- `Back` 在 3D/visibility/back face 语境应为 `背面`，不是 `上一步`。
- `origin` 在坐标/效果中心语境应为 `原點`，不是 `來源`。
- `transform` 优先 `變換`，不要随意改成 `轉換`。
- `extrude` 优先 `擠出`。
- `quality` 优先 `品質`。
- 避免简体残留：设置/图层/颜色/节点/添加 等。

zh-Hans:

- 数学 operation 的 `Add` 用 `加法`，动作才用 `添加`。
- path/shape contour 语境优先 `轮廓`，不是地形的 `等高线`。
- 保持已有术语：图层、节点、关键帧、视口、属性、合成。

ja_JP:

- 严禁中文语法残留：`的`、`与`、`正在`、`情况下`、`影响`、`决定` 等。
- 避免中日混杂句。
- 技术术语可保留 Katakana，但句法必须自然日语。

## 交付物

请交付：

1. 修改后的 `output/json-surfaces/draft/zh-Hans/`
2. 修改后的 `output/json-surfaces/draft/zh-Hant/`
3. 修改后的 `output/json-surfaces/draft/ja_JP/`
4. 一份翻译缺口报告：
   - 每个语言还剩多少英文字符串
   - 哪些英文是允许保留的品牌/API/代码字段
   - 哪些文件尚未完成
5. 一份 compiled TS parity 修复报告：
   - 三语 TS message count
   - 三语 unique `(context, source)` count
   - `QPrintDialog` 是否恢复为打印相关消息
6. 不要提交 patch.rs 打包改动，等翻译审查通过后再做。

## 验收标准

- 新增 22 个 JSON 的用户可见字符串已翻译。
- JSON 结构与 `output/json-surfaces/en/` 同构。
- 没有 zh-Hant 简体污染。
- 没有 ja_JP 中文污染。
- 没有明显误翻。
- 英文残留都有明确保留理由。
- `tools/*.ts` 三语 source denominator 一致。
- `generated_translations.inc` 已从修复后的 `.ts` 重新生成。

结论：这次不是修一两个文件，而是两条线一起完成：Cavalry 38 个 JSON surface 的新增 22 个翻译面，以及 compiled/runtime `.ts` 三语分母一致性。先把翻译和分母做干净，再接入打包。
```
