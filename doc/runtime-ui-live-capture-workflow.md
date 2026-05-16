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
