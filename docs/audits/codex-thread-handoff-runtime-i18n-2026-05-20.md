# Codex Thread Handoff: Cavalry Runtime I18n

日期: 2026-05-20  
范围: 本文压缩记录本轮长对话的上下文、根因判断、已做修改、验证结果、阻塞点与后续接手原则。  
状态: 仓库侧修复已完成并通过合同测试；安装态 Cavalry.app 同步被 macOS 权限阻止。

## 最高优先级不变量

1. Time Editor 右侧自绘条里的模型名必须保持英文。
   - 不要把 `languages/*/nodeStrings.json` 的 `niceName` 批量改回中文/日文。
   - `Camera`、`Duplicator`、`Extrude`、`Particle Shape`、`Forge Dynamics` 等作为 Time Editor item-model 文本时必须保留英文。
   - Qt 可控显示层可以翻译这些模型名，例如属性编辑器浮动标题、左侧树、菜单显示层。
2. ExtensionLayer / viewport shortcut overlay 不支持 CJK，翻译后会变成 `????` 或空白。
   - `S + click path`、`Hold S`、`Space`、`Shift` 等 viewport overlay 应保持英文。
3. 翻译必须遵守 `docs/translation-guidelines.md` 与 `docs/cavalry-glossary.md`。
   - 零混杂语言原则仍然有效。
   - 允许保留的品牌、格式、缩写必须在术语表/FP-9 保留词里有依据。
4. 不要用截图肉眼猜测直接改结构文件。
   - 先判断来源是 JSON nodeStrings、Qt/TS injector、runtime dynamic fallback、item model、还是 ExtensionLayer 自绘层。
   - 能抓 live runtime 就抓；不能抓时，至少用截图、OCR、repo source、generated table 和合同测试互证。

## 对话主线压缩

### 1. CJK 显示为问号

用户最初发现部分 CJK 文案显示为 `????`。排查后区分为两条路径:

- Qt 控件路径: 支持 CJK，可通过 TS / injector 翻译。
- ExtensionLayer / 自绘 overlay 路径: Latin-only 或字体路径不支持 CJK，翻译后显示问号。

设计结论:

- 自绘 overlay 保持英文。
- Qt 控件继续翻译。
- 不要用一刀切的 C 字符串补丁覆盖所有英文。

### 2. Time Editor 右侧模型名必须英文

用户指出 Time Editor 右侧条目中 CJK 会显示 `???`，但左侧树和属性面板可以显示中文。这里存在三条显示路径:

- 模型数据 `niceName`: 被 Time Editor 复用，必须保持英文。
- Qt 显示层: 可以由 injector 翻译。
- Time Editor item-model / 自绘条: 必须跳过模型名翻译。

已形成的保护:

- `tools/check_app_contracts.js` 中有 `model-backed niceName text stays English for Time Editor and item-model reuse`。
- `tools/model_display_translations.json` 只给显示层使用，不回写 JSON 模型数据。
- `CavalryTranslatorInjector.mm` 中通过 model-backed item text preservation 在 `QListWidgetItem` / `QTreeWidgetItem` mutation 前跳过模型词。

### 3. 属性编辑器浮动标题

用户指出属性编辑器顶部浮动框以前会显示中文，后来因为 `niceName` 改回英文而显示 `Camera` / `Duplicator` / `Particle Shape` 等英文。

结论:

- 不是翻译丢失，而是以前靠 JSON `niceName` 中文误打误撞显示。
- 正确做法不是把 `niceName` 改回中文，而是让 Qt 显示层走 `model_display_translations.json` / injector。
- 该修复路径不应污染 Time Editor 右侧自绘条。

### 4. 动态菜单与状态栏

用户指出:

- `Add Keyframe on frame 113` 中数字动态。
- `8 selected` 中数字动态。
- 右键菜单标题可能是模型名 + 省略号。
- `Un-Parent` 曾被误译成“非家长”。

结论:

- 动态帧号用正则翻译: `Add Keyframe on frame <n>` -> `在第 <n> 帧添加关键帧` 等。
- 动态选中计数用正则翻译: `<n> selected`。
- `Un-Parent` 正确翻译为“解除父级/解除父級/親子付けを解除”，不是“非家长”。
- 这些属于 runtime dynamic fallback，不要静态枚举每个数字。

### 5. Runtime 噪声与 Rhu

用户发现 `Rhu -> 鲁` 一类可疑翻译。排查方向:

- 对 token 做 provenance 分级。
- 如果只出现在 `tools/*.ts` 和 `generated_translations.inc`，没有 Cavalry 原始资源或 live capture 来源，判为 C 级证据。
- 这类短 token 应进 quarantine 或保持英文，不能当真实 UI 翻译。

已有文档:

- `docs/runtime-translation-noise-triage.md`
- `docs/audits/runtime-translation-noise-triage-2026-05-19.md`
- `tools/runtime-noise-quarantine.json`

### 6. Add Layers 空白卡片

用户发现 Add Layers 第一行空白卡片。重要纠偏:

- 不能仅靠 `Behavior` / `Smoother` 两个旧 nodeStrings 猜。
- 真实根因来自运行时 item model: QuickAddWindow 里存在 DisplayRole 为空的条目。
- 解决边界应作用于 QuickAddWindow 空 item pruning，而不是乱删 nodeStrings 或改 Definitions。

已有文档:

- `docs/audits/add-layers-runtime-model-capture-2026-05-20.md`

原则:

- Definitions 是节点结构真相源之一，但不是所有 runtime item 都等于 Definitions 里的节点。
- nodeStrings 可能包含旧节点或未展示节点；不能仅凭“没有在 Definitions 对上”就删。

### 7. Add Layers / Attribute Editor 大量英文残留

用户提供 `/Users/luo/Downloads/codex-thread-019e44ae-last-images`，共 104 张截图，并提醒“有的没画红框”。处理策略:

- 红框只作为优先级，不作为唯一分母。
- 逐张/原图检查，OCR 只作索引。
- 明确分类:
  - 应翻但缺 TS/injector fallback: runtime-generated label。
  - 已有翻译但未注入/安装态未同步: 需要检查 app dylib/hash。
  - 应保持英文: Time Editor 右侧模型名、Alpha/RGB/FPS/CMYK/Unicode/JavaScript 等术语、用户值或格式值。

已补 runtime-generated Attribute Editor / Add Layers 标签到三份 TS:

- `tools/zh-Hans.ts`
- `tools/zh-Hant.ts`
- `tools/ja_JP.ts`

重点补充包括:

- `Color Mode`
- `Blend Mode`
- `Gradient Mode`
- `Shape Style`
- `Particle Radius`
- `Scale Strength`
- `Rotation Scalar`
- `Scale Mode`
- `Sequence Mode`
- `Octaves`
- `Lacunarity`
- `Gain`
- `Curl`
- `Curl Amplitude`
- `Cyan Transform`
- `Magenta Transform`
- `Yellow Transform`
- `Black Transform`
- `Draw Capture Margin`
- `Draw Flow Margin`
- `Capture Margin`
- `Capture Force`
- `Capture Graph`
- `Flow Margin`
- `Flow Force`
- `Flow Variance`
- `No Mask`

同时补了大量第一批属性标签:

- `Strength`
- `Falloffs`
- `Kill On Collision`
- `Set Sensor`
- `Set Friction`
- `Set Bounce`
- `Set Density`
- `Set Gravity Scale`
- `Input Shapes`
- `Projection Target`
- `Affect Only`
- `Affect Id`
- `Custom Color`
- `Draw Color`
- `Horizontal Alignment`
- `Vertical Alignment`
- `Initial Direction`
- `Initial Speed`
- `Override Lifespan`
- `Image Blend Mode`
- `Image Quality`
- `Fit To Lifespan`
- `Loop Sequence`
- `Image Index Offset`
- `World Scale`
- `Time Step`
- `Use Cache`
- `Cache File Path`
- `Base Layer`
- `Bidirectional`
- `Border`
- `Gap Type`
- `Line Mode`
- `Line Size`
- `Shadow Mask Scale`
- `Unlock Offset`
- `Frequency Scale`
- `Use Fixed Size`
- `Fixed Size`
- `Excel Sheet`
- `Shuffle Type`
- `Keep Punctuation`
- `Shuffle Text`
- `Style Behaviours`
- `Material Behaviours`
- `Vignette Shape`
- `Level 0 Color` 到 `Level 4 Color`
- `Force Velocity`
- `Adaptive Wave Counts`

合同测试:

- 新增/扩展 `runtime-generated Attribute Editor labels are translated without touching Time Editor model names`。
- 测试在三语言 TS 中锁定这些 source/translation。
- 名字明确说明不触碰 Time Editor model names。

### 8. Voronoi、Loop Length、Excel

用户问 `Voronoi` 是否翻译，以及 `Loop Length`。

结论:

- `Voronoi` 作为数学/图形术语保留英文，中文可形成 `Voronoi 着色器` 这种英文术语 + 空格 + 目标语言。
- `Loop Length` 是属性名，应翻译。

已做:

- `languages/en/nodeStrings.json`: `loopLength = Loop Length`
- `languages/zh-Hans/nodeStrings.json`: `循环长度`
- `languages/zh-Hant/nodeStrings.json`: `循環長度`
- `languages/ja_JP/nodeStrings.json`: `ループ長`
- `tools/check_app_contracts.js`: `Voronoi Shader nodeStrings include runtime loop length label`

用户后续指出三份 nodeStrings 已有翻译但 UI 没吃到的情况，这类要优先判断是否:

- 运行中的 app 没同步资源。
- UI 走的是 runtime generated label，而不是 nodeStrings。
- injector 没覆盖该控件路径。

Excel:

- `Excel Sheet` 用 `Excel 工作表` / `Excel シート`。
- 为避免 FP-9 误报，已把 Excel 加入:
  - `docs/translation-guidelines.md`
  - `docs/cavalry-glossary.md`
  - `tools/forbidden_translation_patterns.json`

### 9. Unsaved、Tips、裸文本

用户指出:

- `You are working in an unsaved scene.` 被误译成“没有保护”不对。
- `Click to see next message` 裸文本没有翻译。

已做:

- `unsaved` 语义固定为“未保存/未儲存/未保存”。
- `Click to see next message` 裸文本补入三份 TS。
- 相关断言在 `zh-Hans embedded runtime tail has exact translations for live-only widget strings` 中覆盖。

### 10. CJK empty-state 可显示但居左

用户指出:

- `Double click here to import Assets.`
- `Drag layers here to see their settings.`
- `Use the Create menu to add a layer to your Composition.`

这三句可以显示 CJK，只是翻译后可能不居中。

记录:

- `docs/runtime-ui-live-capture-workflow.md` 已记录 ExtensionLayer panel empty-state CJK 可显示但可能失去居中。
- 这和 viewport shortcut overlay 不同；后者仍保持英文。

## 当前工作区状态

截至本文创建前，仓库有以下变更:

- `docs/cavalry-glossary.md`
- `docs/translation-guidelines.md`
- `injector/generated_translations.inc`
- `injector/libCavalryTranslatorInjector.dylib`
- `tools/CLAUDE.md`
- `tools/check_app_contracts.js`
- `tools/forbidden_translation_patterns.json`
- `tools/ja_JP.ts`
- `tools/zh-Hans.ts`
- `tools/zh-Hant.ts`
- 本 handoff 文件与 `docs/audits/CLAUDE.md`

不要误以为运行中的 Cavalry.app 已经同步。仓库构建成功，不代表安装态 app 已更新。

## 验证结果

已通过:

```bash
npm run test:contracts
# 112/112 pass

npm run build:injector
# Built translator injector -> injector/libCavalryTranslatorInjector.dylib

git diff --check
# pass
```

安装态同步失败:

```bash
cp injector/libCavalryTranslatorInjector.dylib \
  /Applications/Cavalry.app/Contents/Frameworks/libCavalryTranslatorInjector.dylib

# cp: ... Operation not permitted
```

当前 repo dylib 与 app dylib hash 不一致:

```text
repo injector/libCavalryTranslatorInjector.dylib: 9c6c8cd799ead010a9d7b862099778d3aa47dcb6ab57d77519b0e8eaf9df7b16
app  /Applications/.../libCavalryTranslatorInjector.dylib: b20ea6ee9412a6b8f2abb7697eafc857d188fa27de44f13a898dfcc03b280508
```

含义:

- 仓库已修。
- 当前 `/Applications/Cavalry.app` 仍旧。
- 用户截图如果还是英文，优先检查 app 内 injector 是否同步，而不是回滚翻译策略。

## 接手时建议流程

1. 先读这些文件:
   - `docs/translation-guidelines.md`
   - `docs/cavalry-glossary.md`
   - `docs/runtime-ui-live-capture-workflow.md`
   - `docs/runtime-translation-noise-triage.md`
   - `docs/audits/add-layers-runtime-model-capture-2026-05-20.md`
   - `tools/check_app_contracts.js`
2. 再确认 app 同步:
   - 比较 repo dylib 与 `/Applications/Cavalry.app` dylib hash。
   - 如果 hash 不一致，不要把 UI 残留直接判为翻译没写。
3. 如果继续处理截图残留:
   - 使用原图，不要只看低分辨率 contact sheet。
   - OCR 只能作为定位索引，不能作为改动依据。
   - 红框不是完整分母。
4. 对每个英文残留先分类:
   - 模型名 / Time Editor item: 保持英文。
   - 品牌/缩写/格式/用户值: 按术语表保留。
   - nodeStrings 已翻但 UI 没吃: 查资源同步或控件路径。
   - runtime-generated label: 补 TS fallback，并加合同测试。
   - 自绘 ExtensionLayer viewport hint: 保持英文。
5. 每次改 TS:
   - 运行 `node tools/generate_embedded_translations.js`。
   - 运行 `npm run test:contracts`。
   - 运行 `npm run build:injector`。
6. 不要说“已在 app 里修好”，除非:
   - 成功写入 `/Applications/Cavalry.app`。
   - `codesign --verify --deep --strict /Applications/Cavalry.app` 通过。
   - hash 对齐，且 Cavalry 重启后验证。

## 已知敏感点

- 用户会截图验证，不接受“理论上修了”。
- 用户对“找错位置”“改掉不该改的”非常敏感。
- 不要把 `niceName` 改回中文来图快。
- 不要把 Time Editor 右侧条目当成普通 QLabel。
- 不要把 Add Layers 空白卡片归因到旧 nodeStrings，必须看 runtime item model。
- 不要把日文汉字一概当中文残留；只有简体中文表达或错误术语才是污染。
- 不要把所有英文都翻译。Alpha、RGB、CMYK、FPS、Unicode、JavaScript、Voronoi、Excel 等要按术语表处理。

## 最近一次实质改动摘要

最近一次改动解决的是 `/Users/luo/Downloads/codex-thread-019e44ae-last-images` 的 104 张截图中暴露的大量 Attribute Editor / Add Layers 英文残留:

- 补 TS runtime fallback。
- 生成 `injector/generated_translations.inc`。
- 构建新 `injector/libCavalryTranslatorInjector.dylib`。
- 加合同测试锁定这些 runtime-generated labels。
- 同步更新 `tools/CLAUDE.md`。
- 把 Excel 写入术语规范和 FP-9 保留词。

未完成:

- 没能把新 dylib 写入 `/Applications/Cavalry.app`，被系统权限阻止。
- 需要通过有权限的安装流程或用户手动授权后再验证运行中 Cavalry。

