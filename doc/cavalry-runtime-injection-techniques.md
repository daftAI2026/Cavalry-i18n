<!--
[INPUT]: 依赖 desktop-patcher/injector/CavalryTranslatorInjector.mm 的 ABI 选择、tools/launch_cavalry_with_injector.sh 的代码签名编排、Cavalry/Qt 的运行时行为
[OUTPUT]: 对外提供 Cavalry runtime UI 抽取与翻译注入的技术沉淀，作为后续 agent 与协作者的"为什么这么做"参考
[POS]: doc/ 知识沉淀位，与 cavalry-glossary*.md / cavalry-scripting-*.md 同级
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Cavalry 运行时 UI 抽取与翻译注入 — 技术沉淀

> Cavalry 是一个 macOS 桌面应用，UI 由 Qt（当前 6.6.3）+ AppKit native menu 混合构成。
> 这里记录我们从 v2.2/v2.3 时代开始打磨、至今仍在生产路径运行的"逆向 + 注入 + 抽取"链路：
> 它解决了什么问题、为什么选这条 ABI、关键技术点、代码签名 dance、以及容易被误解的 SIP 真相。

> 本文档不是规范，不参与 gate 通过/失败判定。规范以 [`doc/workflows/cavalry-full-ui-100/Acceptance.md`](workflows/cavalry-full-ui-100/Acceptance.md) 为准，反模式以 [`doc/workflows/cavalry-full-ui-100/Anti-Patterns.md`](workflows/cavalry-full-ui-100/Anti-Patterns.md) 为准。

---

## 1. 问题定义：为什么 AX 不够

macOS Accessibility (AX) 框架只能读到 AppKit 实际"画"出来的元素，对 Qt 自绘控件几乎全瞎：

| Cavalry UI 来源 | AX 可见性 | 备注 |
| --- | --- | --- |
| AppKit 主菜单栏（`NSApp.mainMenu`） | ✓ 部分可见 | 仅顶层 + 已展开层 |
| `QMenuBar`（被 macOS 桥接成 AppKit menu） | ◐ 桥接后才可见 | 未展开的子菜单不可枚举 |
| `QMenu` 二级 / 三级菜单 | ✗ 不可枚举 | 未实例化前 AX 看不到 |
| `QWidget`（Inspector / Library / Timeline / Render Queue 等面板） | ✗ 完全不可见 | Qt 自绘，不走 AppKit |
| `QTabBar` / `QPushButton` / `QComboBox` / `QLabel` 文本 | ✗ 完全不可见 | 同上 |
| `placeholderText` / `toolTip` / `whatsThis` 等 Qt 特有属性 | ✗ 完全不可见 | 必须读 `QObject::property()` |

这导致一个直接事实：**任何"只用 AX"的抓取方案都只能拿到 6–16 个元素**，远远低于 Cavalry 真实 UI 表面的 600+ candidates / 660+ menu leaves。

要拿到完整分母，必须接到 Qt 的 ABI 上。

---

## 2. ABI 选择：QTranslator 而不是 Mach-O 符号 hook

我们一开始评估过两条路：

### 候选 A — Mach-O 符号级 hook（拒绝）

把 Cavalry / Qt 二进制丢进 Hopper / Ghidra，找 `QObject::tr()` / `QString::fromUtf8()` 调用点，patch 跳转或 `DYLD_INTERPOSE` 替换。

问题：

- Qt 6 大量字符串走模板内联与 ABI 内私有 helper，符号粒度噪声极大
- 每次 Cavalry / Qt minor 版本变化都要重新逆，维护成本爆炸
- 二进制 patch 必然触发 `codesign --verify --strict` 失败，必须再处理签名
- 没有"源串 + 上下文 + 翻译"的语义信息，纯文本替换会破坏 placeholders

### 候选 B — 子类化 `QTranslator` + DYLD 注入（采纳）

Qt 的本地化总入口是：

```cpp
virtual QString QTranslator::translate(
    const char *context,
    const char *sourceText,
    const char *disambiguation = nullptr,
    int n = -1) const;
```

Qt 在每一处 `tr("English")` / `QObject::tr("...")` / `QCoreApplication::translate(ctx, "...")` 都会 fallback 到当前 `installTranslator()` 注册的 translator 链。**只要我们提供一个 `QTranslator` 子类并 install 到 `QCoreApplication::instance()`，就能拿到所有运行时 i18n 调用**。

这条路赢在三点：

1. **稳定 ABI**：Qt 6 整个 minor 周期 `QTranslator::translate` 签名不变
2. **语义完整**：拿到 `(context, sourceText)` 元组，可以精确路由翻译
3. **不动二进制**：Cavalry 本身不需要 patch，只需要在它的 `QApplication` 起来后注入一个 dylib

代价：必须用 **与 Cavalry 编译相同 Qt minor 版本** 的 SDK 编译 dylib，否则 `installTranslator()` 静默失败。这条约束由 [`tools/build_translator_injector.sh`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/build_translator_injector.sh) 与 [`tools/cavalry_qt_target.json`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/cavalry_qt_target.json) 集中管理。

---

## 3. 架构总图

```diagram
╭──────────────────────────────────────────────────────────────────────╮
│  desktop-patcher 生产路径（用户机器 + agent 工作流共用）            │
╰──────────────────────────────────────────────────────────────────────╯

  Cavalry.app  ──╮
                 │  1. codesign --remove-signature  (剥 hardened runtime)
                 │  2. codesign --force --deep --sign -  (ad-hoc 重签)
                 │     ↑ 同时处理嵌套 crashpad_handler
                 ▼
  ad-hoc Cavalry.app
                 │
                 │  3. env DYLD_INSERT_LIBRARIES=libCavalryTranslatorInjector.dylib \
                 │        CAVALRY_I18N_LANG=zh-Hans|zh-Hant|ja_JP|en \
                 │        CAVALRY_I18N_SESSION_DIR=$SESSION_DIR \
                 │        Cavalry
                 ▼
  ╭────────────────────────────╮  __attribute__((constructor))
  │ libCavalryTranslator       │  → bootstrapInjector()
  │ Injector.dylib             │       └─ dispatch_once
  │                            │           ├─ scheduleInstallAttempt(0)
  │  EmbeddedTranslator         │           └─ NSNotification 监听
  │   : public QTranslator     │              NSApplicationDidFinishLaunching
  ╰────────┬───────────────────╯
           │ installTranslator() to QCoreApplication
           ▼
  ╭────────────────────────────╮
  │ Qt runtime                 │
  │  - tr() / translate() 转发 │ → 命中我们子类，返回翻译或原文
  │  - QMenuBar 重绘           │
  │  - QWidget property 改写   │
  ╰────────┬───────────────────╯
           │
           ▼
  ╭────────────────────────────╮
  │ dumpQtMenuInventory(lang)  │ → SESSION_DIR/runtime/<lang>-injector-inventory.json
  │   QApplication::allWidgets │   {menuBars, widgetTexts, formatVersion=2}
  │   QMenuBar::actions()      │
  │   QMenu / QAction 递归     │
  │   QTabBar::tabText()       │
  │   QObject::property()      │
  ╰────────────────────────────╯
```

---

## 4. 关键技术点

### 4.1 子类化 QTranslator

```cpp
class EmbeddedTranslator final : public QTranslator {
public:
    QString translate(const char *context,
                      const char *sourceText, ...) const override {
        // 在 generated_translations.inc 里查 (context, sourceText)
        // 命中返回译文，否则返回 QString() 让 Qt 走默认链
    }
};
```

要点：

- `generated_translations.inc` 是从 `tools/{zh-Hans,zh-Hant,ja_JP}.ts` 通过 [`tools/generate_embedded_translations.js`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/generate_embedded_translations.js) 生成的 C 数组，编译期固化进 dylib
- 返回 `QString()` 让 Qt 继续 fallback，**不能返回原文** —— 否则会把 `&` 等 Qt 占位标记吞掉
- 必须 override `const char *` 版本，不要去 override `QString` 版本（Qt 内部走 char\* 路径）

### 4.2 文本归一化

Qt 文案有几个 i18n 工具不友好的特征：

```cpp
QString normalizeMenuText(const QString &text) {
    QString normalized = text;
    normalized.replace(QChar('&'), QString());            // 剥掉 mnemonic
    normalized.replace("…", "...");                       // 统一省略号
    // 再剥 Other_Format 与 BOM
    // 再 trim
}
```

这一步必须**所有路径共用**：lookup 比对、dumpInventory 输出、translate 写回。否则 `&File` 与 `File` 比不上。

### 4.3 多层抓取（dumpQtMenuInventory）

注入器写 `<lang>-injector-inventory.json` 时同时抓 4 个层面：

1. **`QMenuBar::actions()`** — 顶层菜单条
2. **`QMenu::actions()` 递归** — 子菜单 / 三级菜单（这是 AX 完全看不到的部分）
3. **`QApplication::allWidgets()`** — 所有 `QWidget` 实例
   - `windowTitle` / `toolTip` / `statusTip` / `whatsThis`
   - 通过 `QObject::property()` 读 `text` / `title` / `placeholderText` / `currentText`
4. **`QTabBar::tabText(index)`** — Tab 文本（不在 property 里）

`isVisible() == false` 的 widget 直接跳过，这避免输出几千个 dock-able 但隐藏的 Qt 内部 widget。

### 4.4 Native menu 桥接

Qt on macOS 把 `QMenuBar` 桥接成 AppKit `NSMenu`。仅靠 `installTranslator()` 改 Qt 内部 cache 还不够，**必须强制刷新桥接**：

```cpp
void refreshNativeMenuBar(const QString &lang) {
    translateNativeMenu([NSApp mainMenu], lang);  // 直接走 NSMenu API
}
```

这个步骤在 `installTranslator()` 主逻辑、`NSApplicationDidFinishLaunchingNotification`、以及 `dispatch_after 250ms` 各跑一次，覆盖 Qt → AppKit 桥接的不同时序窗口。

### 4.5 Bootstrap 时序（最容易翻车的部分）

DYLD 在 `dyld` 完成 image load 时就会触发 `__attribute__((constructor))`。但此时：

- `QCoreApplication::instance()` 可能还是 `nullptr`
- 即使非 null，`QApplication::allWidgets()` 也可能空
- `[NSApp mainMenu]` 可能没 build

我们的策略：

```cpp
__attribute__((constructor)) load() → bootstrapInjector()
                                         │
                                         ├─ scheduleInstallAttempt(0)
                                         │     └─ dispatch_after retry × 20
                                         │        each 250ms
                                         │
                                         └─ NSNotificationCenter 监听
                                            NSApplicationDidFinishLaunching
                                            → 再触发一次 install + refresh
```

`gInstallAttempted` flag 防止重复安装，`dispatch_once` 防止 bootstrap 被重入。

### 4.6 English Dump-Only 模式（G-CAPTURE 关键能力）

我们要的不只是"翻译给用户看"，还要"枚举完整英文 UI 分母"用于 G-X freeze。

实现方法：把"语言"伪装成 `en`，让 injector 跳过翻译表加载，**只跑 dumpInventory**：

```cpp
const bool dumpOnlyEnglish = lang == QStringLiteral("en");

if (!dumpOnlyEnglish && entriesForLanguage(lang, &count) == nullptr) {
    fprintf(stderr, "[cavalry-i18n] unsupported language: %s\n", ...);
    return;  // 翻译模式：不支持就退出
}

if (dumpOnlyEnglish) {
    // dump-only：循环重试直到 Qt 起来，不安装翻译表
    for (...) {
        if (dumpQtMenuInventory(lang)) { break; }
    }
    return;
}
```

这个分支**必须先于** `entriesForLanguage(en, ...)` 检查 —— 因为 `en` 永远没有翻译表（自己翻自己没意义）。

之前一个 agent 把这个分支搞错以后，直接看到 `[cavalry-i18n] unsupported language: en` 就断言 "injector 不支持 dump-only"，是错的。

---

## 5. 代码签名 Dance（决定能不能注入的真正机关）

`DYLD_INSERT_LIBRARIES` 在 macOS 上**默认会被拦截**，但拦截源不是 SIP，而是目标 app 的：

| 签名属性 | 作用 |
| --- | --- |
| `flags=runtime` (hardened runtime) | 拒绝 unsigned / 不在 entitlements 白名单的 dylib 注入 |
| `library-validation` entitlement | 进一步要求注入 dylib 必须由同 team-id 签名 |
| `restrict` flag | 阻止任何 `DYLD_*` env 生效 |
| Apple-signed system binary | SIP 直接拒绝 |

Cavalry 默认带 hardened runtime + Apple Developer 签名。这就是为什么"什么都不做直接注入"会被静默拦截。

### 我们的解法（自 v2.2/v2.3 起未变）

在 [`tools/launch_cavalry_with_injector.sh`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/launch_cavalry_with_injector.sh) 与 [`desktop-patcher/i18n-handlers.js`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/desktop-patcher/i18n-handlers.js) 中：

```bash
# 1. 先把所有签名扒掉（包括嵌套的 crashpad_handler）
find "$APP_PATH" -type f -name crashpad_handler -exec \
    /usr/bin/codesign --remove-signature {} \;
/usr/bin/codesign --remove-signature "$APP_PATH"

# 2. ad-hoc 重签（identity = "-" 表示 ad-hoc）
find "$APP_PATH" -type f -name crashpad_handler -exec \
    /usr/bin/codesign --force --sign - {} \;
/usr/bin/codesign --force --deep --sign - "$APP_PATH"

# 3. 启动 + DYLD 注入
nohup env \
    DYLD_INSERT_LIBRARIES="$INJECTOR_PATH" \
    CAVALRY_I18N_LANG="$LANG_CODE" \
    "$APP_BIN" >>"$LAUNCH_LOG" 2>&1 &
```

**ad-hoc 重签的副作用是把 hardened runtime / library-validation / restrict 全部剥掉**。剥完之后注入畅通无阻，**不需要也不应该关 SIP**。

### 验证签名状态（G-CAPTURE 硬要求）

[`Acceptance.md` §G-CAPTURE](workflows/cavalry-full-ui-100/Acceptance.md) 要求 launcher 在重签后立即跑：

```bash
codesign -dv --entitlements - "$APP_PATH" 2>"$SESSION_DIR/audit/codesign-evidence.txt"
```

证据文件必须证明：

- `flags=` 中**没有** `runtime`
- entitlements 中**没有** `library-validation`
- signing identity = `-`（ad-hoc）

**没出示 `codesign-evidence.txt` 不允许声明 SIP 阻塞** —— 详见 [Anti-Patterns.md §D](workflows/cavalry-full-ui-100/Anti-Patterns.md)。

---

## 6. SIP 真相：什么时候才轮到 SIP 拦

只有两种情况下 SIP 会真出手：

1. 目标 binary 是 **Apple 自己签的**（`/System/Applications/...`、`/usr/bin/...`）
2. ad-hoc 重签 **失败** 但 launcher 没 fail-fast 就接着 DYLD 注入

第 2 种就是被那个 agent 误判的源头：他没验证签名状态，只看到 Cavalry 启动后没挂 dylib，就跳到"SIP kernel-level block"结论。

判定 SIP 是否真在拦截的硬证据：

```bash
log show --predicate 'subsystem == "com.apple.amfi"' --info --last 5m
ls -lt ~/Library/Logs/DiagnosticReports/ | head
```

`amfi` (Apple Mobile File Integrity) 守在内核态，每一次 SIP 拒绝都会落日志。**没 amfi 拒绝条目 = 没真 SIP 阻塞**，问题在我们自己的签名状态。

---

## 7. Build / 版本约束

### Qt minor 必须匹配

```cpp
// installTranslator() 内
if (majorMinorVersion(QT_VERSION_STR) != majorMinorVersion(qVersion())) {
    fprintf(stderr, "Qt version mismatch build=%s runtime=%s\n", ...);
    return;
}
```

Qt 6.6 与 Qt 6.7 的内部 vtable 不一致，跨 minor 注入会段错误或静默失败。

我们用 [`tools/cavalry_qt_target.json`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/cavalry_qt_target.json) 钉死当前目标：

```json
{
  "cavalryVersion": "2.7.2",
  "qtVersion": "6.6.3",
  ...
}
```

[`tools/resolve_cavalry_qt_sdk.js`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/resolve_cavalry_qt_sdk.js) 在本机校验已装 Cavalry，CI 上用 `aqt` 拉对应 SDK。

### Cavalry 版本变化的影响

升级 Cavalry minor / major 时三件事必须同步：

1. 更新 `cavalry_qt_target.json` 的 `cavalryVersion` / `bundleHash`
2. 重新跑 `extract_compiled_ui_strings.js` 生成新 compiled source-map
3. 在新 Cavalry 上重跑 dump-only injector 拿新 runtime 分母

旧 session 的 `extraction-inventory.json` / `<lang>-injector-inventory.json` 一律降级为历史证据。

---

## 8. 已知限制

### 8.1 nodeStrings.json 不走 QTranslator

Cavalry 的节点系统（粒子事件、刚体设置等）用自己的 JSON 资源文件加载，**不经过 `QTranslator::translate`**。

因此 injector 改不了 nodeStrings，必须靠 patcher 直接覆盖 `Cavalry.app/Contents/Resources/<lang>/nodeStrings.json`（这是 [`desktop-patcher/lib/patch.js`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/desktop-patcher/lib/patch.js) 的工作）。

历史上 FP-4 误判就源于"injector 装好了但 nodeStrings 没翻"，参见 [`runs/2026-04-30-FP4-investigation.md`](workflows/cavalry-full-ui-100/runs/2026-04-30-FP4-investigation.md)。

### 8.2 Qt 懒加载面板

Inspector / Library / Timeline / Render Queue / Preferences 等面板是**懒实例化**的：用户点开才创建。dump-only 必须真的把这些面板"打开过一次"才能抓全。

操作方式：

- 手动：启动 Cavalry → 依次点开所有菜单 / 面板 → 等 inventory 写盘
- 脚本：用 AppleScript / `cliclick` 触发菜单与快捷键
- 进阶：在 injector 里强制 `QApplication::sendEvent` 模拟 `Cmd+1/2/3...`（暂未实现）

### 8.3 动态文本

`QLineEdit::placeholderText` 在某些场景是 runtime 计算的（例如 "Search 12 items..."），这种文本不会进 `tr()`，injector 抓不到。这部分目前**不计入分母**，是已知缺口。

---

## 9. 容易翻车的反模式（已写进 Anti-Patterns）

| 反模式 | 实际表现 | 正确做法 |
| --- | --- | --- |
| **SIP-blame**（详见 §D） | 看到 DYLD 注入失败就断言 "SIP 内核阻塞" | 先验签：`codesign -dv --entitlements -`，证据缺失不算 SIP |
| 重新发明 capture / merge | 不读 wip 分支已有 `tools/capture_accessibility_inventory.js` 等，自己写 `capture_full_ui_interactive.sh` | 先 `git ls-tree -r wip/cavalry-full-ui-100 -- tools/` |
| 跳过 ad-hoc 重签 | 只在原签名 Cavalry 上挂 DYLD | 必须先 `codesign --remove-signature` + `--sign -` |
| Qt 版本错配 | 用任意 Qt SDK 编 dylib | 必须用 `cavalry_qt_target.json` 指定的 minor |
| 把 `unsupported language: en` 当结论 | 看到这行就声明 dump-only 没实现 | 看代码：`dumpOnlyEnglish` 分支在该检查**之前** |
| AX-only 弱抓取写成 PASS | 9 candidates / 0 menuLeaves 写成 NEAR-PASS | AX-only 本质上不能命中 Qt 自绘 UI |

---

## 10. 路径资产索引

| 文件 | 角色 |
| --- | --- |
| [`desktop-patcher/injector/CavalryTranslatorInjector.mm`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/desktop-patcher/injector/CavalryTranslatorInjector.mm) | injector 主源，子类化 QTranslator + dump 引擎 |
| [`desktop-patcher/injector/generated_translations.inc`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/desktop-patcher/injector/generated_translations.inc) | 编译期固化的翻译表（自动生成） |
| [`tools/build_translator_injector.sh`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/build_translator_injector.sh) | dylib 构建 + Qt minor 校验 |
| [`tools/launch_cavalry_with_injector.sh`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/launch_cavalry_with_injector.sh) | 重签 + 启动 + DYLD 注入 |
| [`tools/generate_embedded_translations.js`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/generate_embedded_translations.js) | `.ts` → `generated_translations.inc` |
| [`tools/resolve_cavalry_qt_sdk.js`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/resolve_cavalry_qt_sdk.js) | 本机 / CI 解析 Qt SDK |
| [`tools/cavalry_qt_target.json`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/cavalry_qt_target.json) | Cavalry/Qt 目标版本真相源 |
| [`desktop-patcher/lib/patch.js`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/desktop-patcher/lib/patch.js) | JSON 资产覆盖（nodeStrings 这类 injector 抓不到的） |
| [`desktop-patcher/i18n-handlers.js`](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/desktop-patcher/i18n-handlers.js) | renderer ↔ patch / 重签 / 注入的 IPC 集线 |

---

## 11. 设计原则总结

1. **接 ABI，不接二进制偏移** — Qt 升级 minor 都不会破，偏移每次都得重抓
2. **重签即解锁** — hardened runtime 只是签名属性，ad-hoc 一签就剥；SIP 不在这条链上
3. **抽取与翻译共用同一注入路径** — dump-only 模式让"枚举分母"和"应用译文"复用 90% 代码
4. **签名状态必须留证据** — `codesign-evidence.txt` 把"能不能注入"从"agent 直觉判断"变成"机器可校验事实"
5. **AX 是补充不是主路** — 主路必须能看到 Qt 自绘控件，AX 只在 native menu 桥接层补漏
6. **版本变了就重抓** — 旧分母不能复用到新 Cavalry，否则 100% 是幻觉
