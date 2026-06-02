# 04 — Translate All Languages（T2）

## Must Read

- `REPO/docs/cavalry-glossary.md`（四语言版）
- `REPO/docs/translation-whitelist.json`
- `REPO/docs/translation-guidelines.md`

## Must Follow

- `tests/tdd-master-contract.md`
- `tests/translation-contract.md`

## Allowed Files

- `REPO/languages/zh-Hans/**`
- `REPO/languages/zh-Hant/**`
- `REPO/languages/ja_JP/**`
- `REPO/tools/zh-Hans.ts`
- `REPO/tools/zh-Hant.ts`
- `REPO/tools/ja_JP.ts`
- `REPO/.baoyu-skills/baoyu-translate/EXTEND.md`

## 前置 Gate

T0（01-expand-glossary）PASS + T1.1（03-define-translation-whitelist）PASS

## Task

使用 baoyu-translate skill 翻译全部语言的 JSON 文件和 Qt .ts 源文件。

### 翻译工具配置

- **Skill**: baoyu-translate
- **Mode**: refined（分析 → 翻译 → 审校 → 润色）
- **Config**: `.baoyu-skills/baoyu-translate/EXTEND.md`
- **Glossary**: `docs/cavalry-glossary.md`

> **前置**：EXTEND.md 的 `glossary_files` 当前指向旧文件 `cavalry-glossary-en-zh.md`，必须先更新为 `cavalry-glossary.md`（T0 产出的四语言版）。同时每翻一种语言前更新 `target_language`（zh-CN → zh-TW → ja）。

> **降级路径**：如果 baoyu-translate skill 不可用或调用失败，可直接使用 LLM 翻译，但必须严格遵循 glossary 术语约束和 whitelist 字段规则。翻译质量由 contract B1-B13 验证。

### 必须参考的标准软件多语言版本（CRITICAL）

Cavalry 是动效/动画/合成软件，用户群体同时使用以下软件。**翻译术语必须与这些软件的官方多语言版本对齐**，不得自造译法。

| 软件 | 参考价值 | 重点术语领域 |
|---|---|---|
| **After Effects** 中/日版 | 动效术语的权威标准 | 图层、关键帧、混合模式、缓动、表达式、蒙版 |
| **Cinema 4D** 中/日版 | 3D + 动效术语 | 复制器、变形器、节点、着色器 |
| **Blender** 中/日版 | 开源标准翻译 | 修改器、材质、渲染、视口 |
| **DaVinci Resolve** 中/日版 | 色彩/视频术语 | 色度键、滤镜、模糊、锐化、噪点 |
| **Nuke / Fusion** | 合成术语 | 通道、Alpha、Despill、Chroma Key |
| **Houdini** 中/日版 | 节点/程序化术语（补充） | 实例化、属性传递、层级、求解器（AE/C4D 没有的概念时参考） |

#### 翻译决策优先级

```
1. 术语表已有 → 直接用术语表的翻译
2. 术语表没有 → 查 AE/C4D/Blender/DaVinci 官方多语言版本
3. 以上都没有 → 查 Microsoft Terminology Search
4. 以上都没有 → 完整保留英文（宁可不翻也不要翻错或半翻）
```

#### 各语言的参考策略

| 语言 | 首选参考 | 次选参考 | 注意事项 |
|---|---|---|---|
| zh-Hans | AE 简中版 + C4D 简中版 | Blender 简中版 | 用大陆标准术语，不用港台用法 |
| zh-Hant | AE 繁中版 + C4D 繁中版 | Blender 繁中版 | 用台湾标准术语（如 算繪/遮罩/檔案），不是简中转繁中 |
| ja_JP | AE 日文版 + C4D 日文版 | Blender 日文版 | カタカナ 优先用于外来语术语 |

> **示例**：翻译 `"Screen Gain"` 时：
> - ❌ 错误：`"滤色Gain"`（半翻半留的杂交体）
> - ❌ 错误：`"屏幕增益"`（不符合合成软件上下文）
> - ✅ 正确：查 Nuke/AE 的 Chroma Key 面板 → `"滤色增益"` / `"スクリーンゲイン"`

### 翻译顺序

1. **zh-Hans（简体中文）** — 先翻，作为基准
2. **zh-Hant（繁體中文）** — 独立翻译，**不是简转繁**，需体现繁中用语习惯
3. **ja_JP（日本語）** — 最后翻

### 每种语言的翻译内容

- `nodeStrings.json` — 节点名、属性名、描述
- `appStrings.json` — 应用 UI 字符串
- `tips.json` — 提示文本
- `onboarding.json` — 引导文本
- `plugins/*.json` — 各插件字符串
- `tools/{lang}.ts` — Qt Linguist XML 翻译源文件（用于第二层菜单翻译）

### Qt .ts 文件格式模板

```xml
<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE TS>
<TS version="2.1" language="zh-Hans">
  <context>
    <name>QMenuBar</name>
    <message>
      <source>File</source>
      <translation>文件</translation>
    </message>
    <message>
      <source>Edit</source>
      <translation>编辑</translation>
    </message>
  </context>
</TS>
```

> 每个 `<context>` 对应一个 Qt 类名（如 QMenuBar、QDialog），`<source>` 是英文原文，`<translation>` 是翻译。`lrelease` 编译时会检查此结构。

### 翻译原则

- 严格遵循 `cavalry-glossary.md` 术语表
- 严格遵循 `translation-guidelines.md` 翻译原则
- 按 `translation-whitelist.json` 三类字段分别处理：
  - `translate`：完整翻译为纯目标语言
  - `no_translate`：与 en/ 保持完全一致
  - `locale_sync`：改为目标语言代码（`zh-Hans` / `zh-Hant` / `ja_JP`）
- 不翻译项（Cavalry / RGB / SVG 等）保持英文

### 零英文残留规则（CRITICAL）

> **翻译产物中，不允许残留未批准英文词片段。**
>
> 每个字符串值只能是以下三种之一：
> 1. **完整的目标语言**（如 `"滤色增益"`）
> 2. **完整的英文术语**（术语表中标记为不翻译的，如 `"Alpha"`、`"RGB"`）
> 3. **纯数值/标识符**（如 `"0,0"`、`"1.33"`）
>
> 违规示例（**绝对禁止**）：
> - `"滤色Gain"` ❌ → `"滤色增益"` ✅
> - `"Alpha偏移"` ❌ → `"Alpha 偏移"` ✅（Alpha 是术语表允许的完整英文词）
> - `"スクリーンSoftness"` ❌ → `"スクリーン柔らかさ"` ✅
> - `"Despill強度"` ❌ → `"デスピル強度"` ✅
> - `"Always 匯出"` ❌ → `"始終匯出"` ✅
> - `"Poly メッシュ"` ❌ → `"ポリメッシュ"` / `"多边形网格"` / `"多邊形網格"` ✅

### zh-Hant 额外规则（CRITICAL）

> `zh-Hant` 必须是**稳定繁中 UI**，不能混入简体字形或简中词汇。
>
> 违规示例（**绝对禁止**）：
> - `"开"` ❌ → `"開啟"` ✅
> - `"在父级上方绘制"` ❌ → `"在父級上方繪製"` ✅
> - `"动态算繪"` ❌ → `"動態算繪"` ✅
> - `"Sheet 外边距"` ❌ → `"圖集外邊距"` / `"圖表外邊距"`（按上下文）✅

### Plugin JSON 字段级翻译规则

Plugin JSON 结构如下，每个字段的处理方式不同：

```jsonc
[{
  "type": "layerStrings",           // ← no_translate: 不动
  "value": {
    "author": "sceneGroup",         // ← no_translate: 不动
    "layerType": "chromaKeyFilter",  // ← no_translate: 不动
    "niceName": "Chroma Key",       // ← translate: 完整翻译（如 "色度键"）
    "layerInfo": "Remove green...", // ← translate: 完整翻译
    "language": "en",               // ← locale_sync: 改为 "zh-Hans" / "zh-Hant" / "ja_JP"
    "attributes": {
      // key（如 "screenGain"）不翻译
      // value 是 [标题, 描述] 数组，两个元素都必须完整翻译
      "screenGain": [
        "Screen Gain",              // ← [0] 标题：翻译为纯目标语言
        "Control how aggressively..." // ← [1] 描述：翻译为纯目标语言
      ]
    },
    "enums": {
      // 外层 key（如 "viewMode"）不翻译
      // 内层 key（如 "0", "1"）不翻译
      // 内层 value 是 UI 显示文本，必须翻译
      "viewMode": {
        "0": "Final Result",        // ← 翻译为 "最终结果"
        "1": "Source"               // ← 翻译为 "源"
      }
    }
  }
}]
```

### nodeStrings JSON 字段级翻译规则

与 Plugin JSON 结构类似，共享相同规则：
- `niceName`、`nodeInfo`、`attributes`、`enums`、`tabs`：翻译
- `type`、`nodeType`：不翻译
- `language`：改为目标语言代码
- `attributes` 内部同样是 `[标题, 描述]` 数组结构

### appStrings / tips / onboarding

按 `translation-whitelist.json` 中对应类型的 `translate` / `no_translate` / `locale_sync` 列表处理。

## TDD Behaviors

| # | RED | GREEN |
|---|-----|-------|
| 1 | `zh-Hans/` 不存在 | 翻译简体中文，创建目录和所有 JSON |
| 2 | `zh-Hans/` 文件数 ≠ `en/` 文件数 | 补全缺失文件 |
| 3 | `zh-Hans/` 某文件 key 结构与 `en/` 不匹配 | 修复 key 结构，确保一一对应 |
| 4 | `zh-Hans/` 术语与 glossary 不匹配 | 修复术语，对齐术语表 |
| 5 | `zh-Hant/` 不存在 | 翻译繁體中文，创建目录和所有 JSON |
| 6 | `zh-Hant/` 文件数 ≠ `en/` 文件数 | 补全缺失文件 |
| 7 | `zh-Hant/` 某文件 key 结构与 `en/` 不匹配 | 修复 key 结构 |
| 8 | `zh-Hant/` 术语与 glossary 不匹配 | 修复术语 |
| 9 | `ja_JP/` 不存在 | 翻译日本語，创建目录和所有 JSON |
| 10 | `ja_JP/` 文件数 ≠ `en/` 文件数 | 补全缺失文件 |
| 11 | `ja_JP/` 某文件 key 结构与 `en/` 不匹配 | 修复 key 结构 |
| 12 | `ja_JP/` 术语与 glossary 不匹配 | 修复术语 |
| 13 | `.ts` 文件不存在 | 创建 Qt Linguist XML 翻译源文件 |
| 14 | `.ts` 文件不是合法 XML | 修复 XML 结构 |
| 15 | translate 叶子字符串中检测到未批准英文残留（含带空格半翻译） | 修复为纯目标语言或术语表允许的纯英文 |
| 16 | translate 字段叶子级覆盖率 < 90% | 翻译遗漏的字段（niceName、layerInfo、属性描述、enums 值） |
| 17 | `language` 字段仍为 `"en"` | 改为目标语言代码（`zh-Hans` / `zh-Hant` / `ja_JP`） |
| 18 | 任一目标语言检出脚本 / 术语纯度问题（zh-Hans 繁体污染、zh-Hant 简体污染、ja_JP 中文 UI 词污染） | 修复为对应语言的稳定本地界面术语 |
| 19 | `python3 tools/validate_translations.py ...` 返回非零退出码 | 修复剩余质量问题，直到 validator 返回 0 |

## Gate Check

按 `tests/translation-contract.md` 中的验证命令全部通过（含 B13 validator）。

## Run Log

写到 `runs/YYYY-MM-DD-T2-translate-all-languages.md`
