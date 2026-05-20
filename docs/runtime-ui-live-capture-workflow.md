<!--
[INPUT]: 依赖 tools/run_live_full_ui_matrix.js、injector/CavalryTranslatorInjector.mm 的 live inventory / cursorWidget / itemModels 诊断能力，以及 macOS Accessibility 窗口截图证据
[OUTPUT]: 对外提供 Cavalry 运行中 UI 文本抓取、坐标反查、Qt item model 诊断、覆盖率复抓与 canary 验证流程
[POS]: docs 的运行时抓取主流程文档，连接 injector 诊断能力、语言资源同步和 audits 实跑报告
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Runtime UI Live Capture Workflow

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## 定位

这份文档只描述一件事：如何抓取真实 Cavalry 注入后的 UI 文本分母，并按 session 增量修复残留英文。2026-05-19 补充：截图证据必须限定 Cavalry 窗口；对属性编辑器中滚动后才出现的工具浮动标题/标签，必须用 `widgetAt(cursor)` 反查 Qt 控件链，不再按全屏坐标或 Time Editor 画面猜测来源。

核心原则：截图只是 canary，不是分母。真实分母来自 live session。

## 两种抓取

`zh-Hans` / `zh-Hant` / `ja_JP` 抓取是注入后现场：

```bash
node tools/run_live_full_ui_matrix.js \
  --app /Applications/Cavalry.app \
  --languages zh-Hans \
  --session-uuid AMP-TAIL-ZH-HANS-YYYYMMDD
```

`en` 抓取是英文 dump-only 基线，不代表中文注入效果：

```text
NSApplicationDidFinishLaunching lang=en
english dump-only inventory exported
```

判断中文覆盖率时，不要拿 `en-*` inventory 当残留报告。

## AMP 实战结论

AMP 那轮经验不是“跑一次脚本看数字”，而是一套闭环：

1. 先用 Language Switcher 把目标语言 JSON 资源写进 `/Applications/Cavalry.app`
2. 再用 `run_live_full_ui_matrix.js` 启动真实 Cavalry，并注入当前构建的 dylib
3. 抓 injector inventory 与 AX inventory
4. 合并成 merged inventory
5. 用 coverage 报告分类残留
6. 只修一类根因
7. 重新生成 embedded table、重建 injector、重新 Apply 语言资源
8. 再开新 session 全量复抓，用数字和 canary 证明修复

关键点：注入只负责运行时 compiled UI / QWidget / menu refresh；JSON-backed 资源必须已经被 patcher 写入 app bundle。抓取脚本不会替你把 `languages/zh-Hans` 复制进 Cavalry.app。

## 打开软件

入口是 `tools/run_live_full_ui_matrix.js`。它不是只读脚本，会启动真实 Cavalry。

流程：

1. 调用 `tools/launch_cavalry_with_injector.sh`
2. 构建 `libCavalryTranslatorInjector.dylib`
3. 必要时 ad-hoc 重新签名 `/Applications/Cavalry.app`
4. 通过 `DYLD_INSERT_LIBRARIES` 启动 Cavalry
5. 传入 `CAVALRY_I18N_LANG=<lang>`、`CAVALRY_I18N_SESSION_DIR=<session>`

先看帮助，不启动软件：

```bash
node tools/run_live_full_ui_matrix.js --help
```

## 启动路径校验

有两条启动路径，必须先分清，否则会把“抓取现场”和“用户实际打开现场”混在一起。

`run_live_full_ui_matrix.js` 走调试路径：

1. 重新构建当前 repo 的 injector。
2. 把 injector 写到 cache。
3. 通过 `DYLD_INSERT_LIBRARIES=<cache>/libCavalryTranslatorInjector.dylib` 直接启动 Cavalry 二进制。

用户双击 `/Applications/Cavalry.app` 走安装包路径：

1. `Info.plist` 的 `CFBundleExecutable` 应该是 `CavalryLauncher`。
2. `CavalryLauncher` 读取 `Contents/Resources/cavalry-i18n-lang.txt`。
3. `CavalryLauncher` 注入 `Contents/Frameworks/libCavalryTranslatorInjector.dylib`。

所以遇到“抓取正常、实际打开异常”时，先比对 app 内 injector 是否等于当前 repo 构建产物：

```bash
plutil -extract CFBundleExecutable raw \
  /Applications/Cavalry.app/Contents/Info.plist

cat /Applications/Cavalry.app/Contents/Resources/cavalry-i18n-lang.txt

shasum -a 256 \
  injector/libCavalryTranslatorInjector.dylib \
  /Applications/Cavalry.app/Contents/Frameworks/libCavalryTranslatorInjector.dylib
```

正确状态：

```text
CFBundleExecutable == CavalryLauncher
lang marker == 当前目标语言
repo injector hash == app injector hash
```

如果 hash 不一致，先通过 Language Switcher 重新 Apply & Restart。这个不一致会直接造成“抓取 session 已修好，但用户双击 Cavalry 仍看到旧行为”：例如 repo 当前 injector 已经能把属性编辑器里的 `RolloverLabel.text = Particle Shape` 显示为 `粒子形狀/粒子形状`，但 `/Applications/Cavalry.app` 仍加载旧 dylib 时，浮动标题会继续显示英文。

只有本机诊断时，才可以手动同步 app 内 injector：

```bash
cp injector/libCavalryTranslatorInjector.dylib \
  /Applications/Cavalry.app/Contents/Frameworks/libCavalryTranslatorInjector.dylib

codesign --force --sign - \
  /Applications/Cavalry.app/Contents/Frameworks/libCavalryTranslatorInjector.dylib

codesign --force --deep --sign - /Applications/Cavalry.app
codesign --verify --deep --strict /Applications/Cavalry.app
```

手动同步后必须重启 Cavalry。已运行的进程不会重新加载磁盘上刚替换的 dylib。

## 截图证据

截图只做 canary，不当覆盖率分母。截图时截 Cavalry 窗口，不截全屏，避免把 Codex、菜单栏或其他 app 干扰混进证据。

```bash
osascript -e 'tell application "Cavalry" to activate'
sleep 0.5

BOUNDS="$(
  osascript <<'APPLESCRIPT'
set AppleScript's text item delimiters to " "
tell application "System Events"
  tell process "Cavalry"
    tell window 1
      set p to position
      set s to size
      return {item 1 of p as integer, item 2 of p as integer, item 1 of s as integer, item 2 of s as integer} as text
    end tell
  end tell
end tell
APPLESCRIPT
)"

read X Y W H <<<"$BOUNDS"
screencapture -x -R"$X,$Y,$W,$H" /tmp/cavalry-window.png
```

只截 Cavalry 窗口，不截全屏。全屏截图会把 Codex、菜单栏、浮窗和其他应用混入证据，后续按坐标反查 QWidget 时会误判命中对象。Retina 屏幕上输出 PNG 像素尺寸可能是 AX bounds 的 2 倍，这是正常现象。若窗口 bounds 取不到，先确认系统设置里给 Terminal/Codex 所在宿主授予 Accessibility 权限。多窗口场景下，先关闭无关弹窗，或用 Accessibility inventory 定位目标窗口后再截图。

## 抓取链路

每个语言会生成一个 session：

```text
~/Library/Caches/Cavalry-i18n/sessions/<session-uuid>/
```

关键产物：

```text
runtime/<lang>-injector-inventory.json
runtime/<lang>-ax-inventory.json
runtime/<lang>-merged-inventory.json
audit/<lang>-injector-launch.log
audit/<lang>-ax-capture.json
audit/<lang>-merge.json
full-ui-run-record.json
```

两路来源：

1. `live-injector`
   进程内 injector 导出 Qt 菜单、widget、tooltip、line edit、action、坐标、父链、动态属性等 runtime inventory。

2. `live-accessibility`
   `capture_accessibility_inventory.js` 通过 macOS Accessibility / `osascript` 按 PID 抓菜单、窗口与 AX text nodes。

最后由 `merge_runtime_inventory.js` 合并成：

```text
runtime/<lang>-merged-inventory.json
```

后续分析一律以 merged inventory 为主。

## 坐标反查控件

当截图里能看到文字、但 `strings.text/title/currentText` 常规抓取没有命中时，不要猜类名。把鼠标放到目标文字或边框上，触发一次点击或显示刷新，然后读取 injector inventory 里的：

```text
diagnostics.cursorWidget
```

这个字段由 `QApplication::widgetAt(QCursor::pos())` 反查当前鼠标下的 QWidget，并带出：

```text
className
objectName
geometry
parentChain
dynamicProperties
strings
```

若 `cursorWidget` 命中的是子控件，再用同一份 `widgetTexts` 按 `geometry` 附近范围过滤，查看兄弟控件。比如属性编辑器浮动标题不是 Time Editor item，而是：

```text
QLabel.text -> Widget -> AttributeEditorTreeWidget -> AttributeEditorWindow
```

这类路径应该走 Qt 显示层翻译；Time Editor 的 `QTreeWidgetItem/QListWidgetItem` 模型名仍由 injector 的 model-backed guard 保持英文。

属性编辑器里“工具变多、向下滚动后才看到”的绿色描边浮动标题通常不是 Time Editor 条带，而是 Qt 控件链里的显示层标签。已见过的命中形态包括：

```text
RolloverLabel.text -> Widget -> Widget -> NodeRowWidget -> qt_scrollarea_viewport -> AttributeEditorTreeWidget -> AttributeEditorWindow
QLabel.text        -> Widget -> AttributeEditorTreeWidget -> AttributeEditorWindow
RowWidget.toolTip  -> qt_scrollarea_viewport -> SceneTreeWidget
```

这类控件可以渲染 CJK，应该通过 injector 的 display-only `ModelDisplay` 词典翻译，例如 `Particle Shape -> 粒子形狀/粒子形状`。不要把 `languages/*/nodeStrings.json` 或 plugin `niceName` 改回中文来修它；那会重新污染 Time Editor 共用模型名，让 Latin-only 自绘层回到方块/空白问题。若 inventory 中 `RolloverLabel.text` 仍是英文，优先检查 app 内 injector hash 是否等于 repo 构建产物，并确认 Cavalry 已重启。

## 抓取 Qt Item Model

Add Layers、Scene Tree、Time Editor 这类列表/树控件不一定把行文本暴露成 QLabel。截图里能看到一行，但 `widgetTexts` 和 AX 都搜不到时，下一步不是猜 JSON 文件，而是抓 `QAbstractItemView` 的 model roles。

启用 item model dump：

```bash
CAVALRY_I18N_DUMP_ITEM_MODELS=1 \
node tools/run_live_full_ui_matrix.js \
  --app /Applications/Cavalry.app \
  --languages zh-Hant \
  --session-uuid AMP-ITEM-MODEL-ZH-HANT-YYYYMMDD
```

抓完后查看：

```bash
jq '.itemModels[] | select((.parentChain // []) | tostring | contains("QuickAddWindow")) | {className, modelClassName, rootRowCount, rows}' \
  ~/Library/Caches/Cavalry-i18n/sessions/AMP-ITEM-MODEL-ZH-HANT-YYYYMMDD/runtime/zh-Hant-injector-inventory.json
```

判断方法：

1. `DisplayRole` / `EditRole` 有英文：说明是模型层文本，先判断是否必须保持英文，例如 Time Editor 条带。
2. `DisplayRole` / `EditRole` 有中文但 UI 空白：再查字体或自绘路径。
3. `DisplayRole` / `EditRole` 本身为空：这是空模型行，不是漏翻。
4. `parentChain` 命中 `QuickAddWindow`：这是 Add Layers 面板，不要拿 Time Editor 规则解释它。

2026-05-20 的 Add Layers 空白卡片就是第 3 类：`QuickAddWindow` 下 `QListWidget` 存在空标题 item。修复点是 injector 定点修剪空行，而不是删除 `nodeStrings` 或把 `niceName` 改中文。完整报告见 `docs/audits/add-layers-runtime-model-capture-2026-05-20.md`。

## 判断是否抓对

先查 run record：

```bash
node -e 'const r=require(process.env.HOME+"/Library/Caches/Cavalry-i18n/sessions/<session>/full-ui-run-record.json"); console.log(r.languages.map(x=>x.language))'
```

再查启动日志：

```bash
sed -n '1,40p' \
  ~/Library/Caches/Cavalry-i18n/sessions/<session>/audit/zh-Hans-injector-launch.log
```

正确中文注入应看到：

```text
NSApplicationDidFinishLaunching lang=zh-Hans
embedded translator installed lang=zh-Hans
```

如果看到 `lang=en` 或 `english dump-only inventory exported`，那是英文基线，不是中文注入后现场。

再查目标 app 资源是否真是当前语言。反复测试繁简切换时，最容易发生“state 显示简体，但 app bundle 里仍是繁体 JSON”：

```bash
shasum -a 256 \
  languages/zh-Hans/nodeStrings.json \
  /Applications/Cavalry.app/Contents/assets/Definitions/nodeStrings.json
```

正确的 `zh-Hans` 抓取必须满足：

```text
languages/zh-Hans/nodeStrings.json == /Applications/Cavalry.app/.../nodeStrings.json
languages/zh-Hans/appStrings.json == /Applications/Cavalry.app/.../appStrings.json
languages/zh-Hans/tips.json == /Applications/Cavalry.app/.../tips.json
languages/zh-Hans/onboarding.json == /Applications/Cavalry.app/.../onboarding.json
```

如果 app 侧 hash 等于 `languages/zh-Hant/*`，说明之前繁体 Apply 留在了 bundle 里；此时复抓只会得到混合语言现场，数字不能拿来评价简体修复。

直接写 `/Applications/Cavalry.app` 可能被 macOS 拦截为 `EPERM`。正确路径是通过 Language Switcher 的 Apply 流程触发 staging + privilege copy + resign，并确认管理员/App Management 授权弹窗。

## 覆盖率分析

```bash
node tools/check_runtime_ui_coverage.js \
  --inventory ~/Library/Caches/Cavalry-i18n/sessions/<session>/runtime/zh-Hans-merged-inventory.json \
  --threshold 0 \
  --max-report 200
```

报告里的 `untranslated` 不是天然都要翻译，必须分类。

分类：

1. source 缺失：TS 没有 exact source，补 `tools/*.ts`
2. 生成物缺失：TS 有但 `injector/generated_translations.inc` 或 dylib 没更新
3. runtime 未命中：翻译已嵌入，但 widget/action/line edit 没被 injector 写回
4. 组合字符串：多行 tooltip 或空格、斜杠、冒号等 exact 变体导致查表失败
5. 自绘 overlay：OpenGL / viewport helper 不在 QWidget 或 AX inventory
6. 假阳性：品牌、技术缩写、颜色、快捷键 token，进入 allowlist 或保留

AMP 那轮残留分析的一个教训：coverage 的 `untranslated` 名字偏误导。它实际包含三种东西：

1. 真英文残留
2. 禁止模式命中，比如简体包里混入繁体
3. 允许保留但还没进入 allowlist 的技术 token / AX role / 颜色样本

所以看数字前先抽样定位 surface。菜单路径里的 `顏色`、`著色器` 这类繁体，不是英文漏翻，而是语言资源污染或错误语言资源覆盖。

## 自绘提示盲区

如果截图里还有英文，但 merged inventory 完全搜不到，优先按自绘字面量处理，而不是继续补 TS。

典型例子：

```text
Double click here to import Assets.
Drag layers here to see their settings.
Use the Create menu to add a layer to your Composition.
S + click path / Insert Keyframe
Space + click + drag / Pan
```

这些字符串来自 `/Applications/Cavalry.app/Contents/Frameworks/libExtensionLayer.dylib` 的 `__TEXT,__cstring`，Cavalry 在 panel/viewport 内部绘制它们，不暴露为 `QLabel::text()`、`QAction::text()` 或 AX 文本节点。翻译表里有不等于会生效；Qt translator 和 widget 遍历都碰不到。

不要把所有 ExtensionLayer 字符串混成一类：

- Panel 空状态提示可以显示 CJK，但原生绘制不会按译文重新测量居中，补丁后可能从居中变成偏左。已确认的三句是 `Double click here to import Assets.`、`Drag layers here to see their settings.`、`Use the Create menu to add a layer to your Composition.`。
- Viewport 快捷键提示和 overlay 辅助文字更接近 Latin-only 自绘层，CJK 有显示为 `?` 的风险，例如 `S + click path / Insert Keyframe`、`Space + click + drag / Pan`。这批默认保持英文，除非有新的窗口级截图证明可读且不破坏布局。

因此，恢复 `__cstring` 补丁时只能按 surface 分层：空状态提示可作为低风险候选；快捷键 overlay 不得跟着旧表整批恢复。

诊断命令：

```bash
strings -a -t x /Applications/Cavalry.app/Contents/Frameworks/libExtensionLayer.dylib \
  | rg -C 8 "Double click here|Drag layers here|Use the Create menu|Insert Keyframe|Space \\+ click \\+ drag"
```

正确修复路径是 injector 在 dyld 加载 `libExtensionLayer.dylib` 时扫描 Mach-O `__cstring`，用 `vm_protect(..., VM_PROT_COPY)` 做进程内 copy-on-write 字面量补丁。启动日志应出现：

```text
[cavalry-i18n] patched ExtensionLayer __cstring literals lang=zh-Hans patches=10
```

如果只看到 `embedded translator installed`，但没有 `patched ExtensionLayer`，这批自绘提示仍然会保持英文。

## 增量修复

这里的“增量”不是只抓 diff。每次都重新全量抓一个新 session，用 session 间差异证明修复有效。

推荐命名：

```text
AMP-TAIL-ZH-HANS-YYYYMMDD
AMP-TAIL-ZH-HANS-YYYYMMDD-FIX1
AMP-TAIL-ZH-HANS-YYYYMMDD-FIX2
```

循环：

1. 抓初始 session
2. 用 coverage 报告建立残留分母
3. 按类别只修一批根因
4. 重新生成嵌入表：

```bash
node tools/generate_embedded_translations.js
```

5. 重新构建 injector：

```bash
npm run build:injector
```

6. 跑合同测试：

```bash
node --test tools/check_app_contracts.js \
  --test-name-pattern "checked-in generated translation table matches|shortcut-token|compound multiline|QLineEdit values"
```

7. 复抓新 session
8. 对比 coverage 和关键 canary 是否下降或消失

每次复抓前先做四个 sanity check：

1. 没有残留 Cavalry 进程：

```bash
pgrep -fl "/Applications/Cavalry.app/Contents/MacOS/Cavalry|run_live_full_ui_matrix|capture_accessibility_inventory" || true
```

2. 目标 app JSON hash 与目标语言一致。
3. `node tools/run_live_full_ui_matrix.js --help` 只打印帮助，不启动 Cavalry。
4. 新 session 名不要复用旧 session，避免把新旧 inventory 混在一起。

## 对比样本

快速查看某些词在多个 session 中是否已经消失：

```bash
node <<'NODE'
const fs = require('fs');
const root = `${process.env.HOME}/Library/Caches/Cavalry-i18n/sessions`;
const sessions = ['AMP-TAIL-ZH-HANS-YYYYMMDD', 'AMP-TAIL-ZH-HANS-YYYYMMDD-FIX1'];
const probe = /Tracking Tool|跟踪工具|Default Keyframe Layer|默认关键帧图层/;

function collect(inv) {
  const rows = [];
  for (const w of inv.widgetTexts || []) {
    for (const [key, value] of Object.entries(w.strings || {})) {
      rows.push({ surface: `${w.className}.${key}`, value: String(value) });
    }
  }
  return rows;
}

for (const session of sessions) {
  const inv = JSON.parse(fs.readFileSync(`${root}/${session}/runtime/zh-Hans-merged-inventory.json`, 'utf8'));
  console.log(`\n${session}`);
  for (const hit of collect(inv).filter((row) => probe.test(row.value))) {
    console.log(JSON.stringify(hit));
  }
}
NODE
```

## 结束条件

一次修复结束必须同时满足：

1. 新 session 是目标语言，不是 `en`
2. `embedded translator installed lang=<target>` 存在
3. `/Applications/Cavalry.app` 的 JSON 资源 hash 等于目标语言资源
4. `merged-inventory.json` 存在且不是 weak capture
5. coverage 上升或目标 canary 消失
6. 合同测试通过
7. 剩余英文被分类，不把假阳性、繁简污染或 AX role 当真实缺陷

好流程不是补一个词，而是让残留英文的分母越来越小、原因越来越清楚。
