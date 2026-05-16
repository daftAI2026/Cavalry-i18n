# Runtime UI Live Capture Workflow

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## 定位

这份文档只描述一件事：如何抓取真实 Cavalry 注入后的 UI 文本分母，并按 session 增量修复残留英文。

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
   进程内 injector 导出 Qt 菜单、widget、tooltip、line edit、action 等 runtime inventory。

2. `live-accessibility`
   `capture_accessibility_inventory.js` 通过 macOS Accessibility / `osascript` 按 PID 抓菜单、窗口与 AX text nodes。

最后由 `merge_runtime_inventory.js` 合并成：

```text
runtime/<lang>-merged-inventory.json
```

后续分析一律以 merged inventory 为主。

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
3. `merged-inventory.json` 存在且不是 weak capture
4. coverage 上升或目标 canary 消失
5. 合同测试通过
6. 剩余英文被分类，不把假阳性当真实缺陷

好流程不是补一个词，而是让残留英文的分母越来越小、原因越来越清楚。
