# Runtime Translation Noise Triage

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## 定位

这份文档给后续 Agent 一个可执行流程：当 `tools/*.ts` 或 `injector/generated_translations.inc` 里出现 `Rhu -> 鲁` 这类可疑短 token 翻译时，如何确认它来自哪里、是否应该翻译、怎样处理才不误伤真实 UI。

核心原则：不要按词面猜。翻译表里的字符串必须能回到来源证据；没有来源证据的短 token 先隔离，不要硬翻。

## 为什么 `Rhu` 被判为高风险

`Rhu` 不是因为“看起来奇怪”才被怀疑，而是因为证据链同时满足这些条件：

1. 只在运行时翻译源与生成表中出现：

```bash
rg -n '<source>Rhu</source>|\bRhu\b|鲁' \
  tools injector languages docs output
```

当前命中集中在：

```text
tools/zh-Hans.ts
tools/zh-Hant.ts
tools/ja_JP.ts
injector/generated_translations.inc
```

没有在 `languages/*` 的 JSON 资源、Definitions、plugin strings 或 workflow 证据中找到它作为真实 UI 文案的来源。

2. 它附近成组出现多个短 token：

```text
Rfr
Rhb 9
Rht
Rhu
Ruw
```

这些不像可读 UI 文案，更像二进制或字体/颜色/内部数据抽取时混入的碎片。

3. `git blame` 指向一次大规模 denominator scrub：

```bash
git blame -L 2108,2112 -- tools/zh-Hans.ts
git blame -L 3133,3136 -- tools/ja_JP.ts
```

该批提交不是人工逐词确认的业务翻译。周边还存在明显机器误译，例如日文里 `Rhu -> ログイン`，这与源词没有语义关系。

4. 二进制全文搜索不能当成真来源：

```bash
rg -a -n '\bRhu\b' /Applications/Cavalry.app/Contents
```

`-a` 会把图片、压缩数据、dylib 机器码里的随机字节也扫出来。只有当命中来自可解析文本资源、Qt action/widget inventory 或 Accessibility inventory，才算强证据。

结论：`Rhu` 这一类 token 是高风险翻译污染候选，不是已经确认的 UI 术语。

## 证据等级

处理任何可疑字符串前，先给它归类。

| 等级 | 证据 | 判断 |
|---|---|---|
| A | live capture 命中，带 widget/action/menu path、className、parentChain | 可翻译，按上下文处理 |
| B | Cavalry 原始文本资源命中，例如 `assets/**/*.json`、Definitions、plugin `strings.json` | 可翻译，但要核对界面上下文 |
| C | 只在 `tools/*.ts` 与 `generated_translations.inc` 命中 | 噪声候选，不能直接翻 |
| D | 只在 `rg -a` 的二进制/图片/压缩数据里命中 | 无效证据，不能据此翻译 |

只有 A/B 才能进入正常翻译。C/D 进入 quarantine 或保持原文。

## 排查流程

### 1. 查翻译表命中

```bash
TOKEN='Rhu'
rg -n "<source>${TOKEN}</source>|\"${TOKEN}\"|\\b${TOKEN}\\b" \
  tools injector languages docs output
```

记录：

```text
文件
context
source
translation
周边 10 行
```

如果只在 `tools/*.ts` 和 `injector/generated_translations.inc`，不要立刻修改，进入下一步。

### 2. 查原始资源

```bash
TOKEN='Rhu'
rg -n "\\b${TOKEN}\\b" \
  /Applications/Cavalry.app/Contents/assets \
  languages \
  output \
  docs 2>/dev/null
```

强来源包括：

```text
/Applications/Cavalry.app/Contents/assets/Definitions/nodeStrings.json
/Applications/Cavalry.app/Contents/assets/Definitions/appStrings.json
/Applications/Cavalry.app/Contents/assets/Plugins/*/strings.json
languages/en/**/*.json
live runtime inventory JSON
```

如果没有强来源，继续查 blame 和 capture，不要凭 `strings` 输出下结论。

### 3. 查历史来源

```bash
git blame -L <start>,<end> -- tools/zh-Hans.ts
git show --stat --oneline <commit>
git show --name-only --oneline <commit>
```

判断标准：

```text
人工小提交 + 有业务说明 -> 可信度较高
大批量 denominator/filter/scrub/LLM 批处理 -> 可信度较低
三语言翻译互相荒谬 -> 高风险污染
```

### 4. 查 live capture

如果用户能在界面上看到该词，必须用 live capture 对准控件，不能只用截图猜。

```bash
node tools/run_live_full_ui_matrix.js \
  --app /Applications/Cavalry.app \
  --languages zh-Hans \
  --session-uuid TRIAGE-ZH-HANS-YYYYMMDD
```

然后查 merged inventory：

```bash
SESSION="$HOME/Library/Caches/Cavalry-i18n/sessions/TRIAGE-ZH-HANS-YYYYMMDD"
rg -n "\\bRhu\\b" "$SESSION/runtime/zh-Hans-merged-inventory.json"
```

如果截图能看到，inventory 没命中，把鼠标放到目标文字上，使用 `runtime-ui-live-capture-workflow.md` 的 `widgetAt(cursor)` 路径反查：

```text
diagnostics.cursorWidget
className
objectName
geometry
parentChain
dynamicProperties
strings
```

能拿到 QWidget/QAction/QMenu/QTreeWidgetItem 上下文，才算 A 级证据。

### 5. 决策

| 情况 | 处理 |
|---|---|
| A/B 级证据，且是用户可见 UI | 按 `translation-guidelines.md` 与 `cavalry-glossary.md` 翻译 |
| A/B 级证据，但是品牌、缩写、技术 token | 保持英文或按术语表规则处理 |
| C 级，短 token，无上下文 | 加入 quarantine，不进入生成表 |
| D 级 | 忽略，不作为翻译任务 |
| 不确定 | 保持英文，记录证据缺口，不造词 |

## Quarantine 规则

不要直接删除一大片。推荐先建立或扩展一个明确的 no-translate 清单，例如放在 `tools/translation-whitelist.json` 的 runtime noise 区域，或单独建立：

```text
tools/runtime-noise-quarantine.json
```

建议字段：

```json
{
  "tokens": [
    {
      "source": "Rhu",
      "reason": "short token only found in runtime TS/generated table; no live capture or resource provenance",
      "evidence": [
        "tools/zh-Hans.ts:2111",
        "tools/ja_JP.ts:3136",
        "git blame 8ca19870"
      ],
      "decision": "do_not_translate"
    }
  ]
}
```

生成器或校验器后续只应该跳过 `decision=do_not_translate` 的 token，不要把它们变成中文。

## 防误伤清单

短词不是一律噪声。以下类型不能因为短就删：

```text
RGB
HSV
CMYK
SVG
IK
UV
FPS
BPM
Hue
Red
Blue
X
Y
Z
```

保留依据：

1. 在 `docs/cavalry-glossary.md` 或 `docs/translation-guidelines.md` 有规则。
2. 在真实资源或 live capture 中有 UI 上下文。
3. 是技术缩写、轴向标签、颜色名、格式名、快捷键或单位。

禁止规则：

```text
不要用长度 <= 3 作为唯一删除条件。
不要把二进制 `strings` 或 `rg -a` 命中当成真实 UI。
不要为了消除英文残留，把不明 token 翻成音译。
不要改 `languages/*/nodeStrings.json` 的 niceName 来修运行时显示问题。
```

## Time Editor 保护线

这个排查流程不得破坏 Time Editor 的模型名保护。

必须保持：

```text
languages/*/nodeStrings.json 的 niceName 尽量保持英文
Time Editor 右侧自绘条保持英文模型名
display-only 翻译走 injector 的 ModelDisplay / QAction / QWidget 路径
```

如果某个字符串同时出现在 Time Editor 条带和 Qt 菜单/属性面板：

```text
Time Editor 条带 -> 保持英文
Qt 菜单/属性面板/浮动标题 -> 显示层翻译
```

不要用 JSON 模型层翻译去修 Qt 显示层问题。

## 最小执行模板

给其他 Agent 的最小任务可以这样写：

```text
请按 docs/runtime-translation-noise-triage.md 排查以下可疑 runtime 翻译：
Rhu, Rfr, Rht, Ruw, Rhb 9

要求：
1. 先给每个 token 标证据等级 A/B/C/D。
2. A/B 才允许翻译；C/D 只能进入 quarantine 或保持英文。
3. 不要按短词批量删除；保护 RGB/HSV/IK/Hue/Red 等真实短词。
4. 不要改 languages/*/nodeStrings.json 的 niceName。
5. 改完后跑：
   npm run build:injector
   npm run test:contracts
   npm run check:app
   python3 tools/validate_translations.py --json-report /tmp/cavalry-i18n-validate.json --markdown-summary /tmp/cavalry-i18n-validate.md
6. 输出每个 token 的来源证据、最终决策和未解决风险。
```

## 品味自检

好的处理不是多写几个 `if (source == "Rhu")`，而是让无 provenance 的字符串进不了翻译表。边界应该在提取/生成阶段收紧，运行时只消费可信表。

如果修复需要超过三个特殊分支，说明设计错了：应该回到 denominator freeze、whitelist、quarantine 和 generator contract，而不是继续堆例外。
