<!--
[INPUT]: 依赖 injector/CavalryTranslatorInjector.mm 当前启动期扫描实现、tools/run_live_full_ui_matrix.js 的 live runtime 抓取结果、tools/*.ts 与 generated_translations.inc 的翻译表
[OUTPUT]: 对外提供修复 Cavalry 注入后菜单/UI 英文残留的可执行方案，覆盖根因证据、实现任务、验证顺序与风险边界
[POS]: docs/ 方案文档，承接 runtime UI 注入覆盖修复，不驱动运行时
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Runtime UI 注入覆盖修复方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决 patched Cavalry 注入后仍有大量菜单和 UI 文本保持英文的问题，让已存在于 TS/embedded table 的翻译稳定写回真实显示层。

**Architecture:** 保留现有 `QTranslator` + DYLD injector 架构，不改 Cavalry 二进制。把注入器从“启动期有限扫描”升级为“菜单显示前翻译 + Qt event-filter 动态刷新 + 更完整 widget 类型写回”，并用 live AX/injector inventory 对照证明残留归因。

**Tech Stack:** Objective-C++ injector、Qt 6.6.3 Widgets ABI、AppKit `NSMenu`、Node contract tests、live Accessibility capture。

---

## 0. 已确认根因

本方案基于 2026-05-13 的真实运行验证，不再使用推测结论。

验证方式：启动 `/Applications/Cavalry.app` 2.7.1 + 当前 embedded injector，抓取：

1. `zh-Hant-injector-inventory.json`：injector 通过 Qt ABI 看到的菜单/UI。
2. `zh-Hant-ax-inventory.json`：macOS Accessibility 实际看到的菜单/UI。

对照结果：

```json
{
  "axMenuItems": 683,
  "qtMenuItems": 334,
  "untranslatedEnglishWithTranslation": 227,
  "qtAlreadyTranslatedButNativeEnglish": 26,
  "absentFromInitialQtInventory": 201,
  "englishWithoutTranslationOrAllowedMaybe": 24
}
```

结论：

1. **主因不是缺翻译。** 截图中的 `Basic Line`、`Display Color Space`、`Add Layers`、`Use the Create menu to add a layer to your Composition.` 等源文本已经存在于 `tools/*.ts`，也已经编译进 dylib。
2. **菜单主因是 lazy/rebuilt menu。** 真实 AX 菜单中有 227 个英文项已存在翻译，其中 201 个在 injector 初始 Qt inventory 中不存在，说明这些 action 在菜单展开时才生成。
3. **AppKit bridge 会覆盖已翻译 Qt action。** 有 26 个项目在 injector inventory 中已是中文，但 AX 菜单仍显示英文，说明 Qt/AppKit native menu 同步发生在当前翻译写回之后，或后续重建覆盖了标题。
4. **普通 UI 主因是 widget 动态创建 + 类型覆盖不足。** 当前 live injector inventory 中 `widgetTexts: 0`，而截图中的右侧面板、底部 tab/status 文本已经存在翻译，说明当前启动期扫描没有稳定看到或写回这些 surface。

当前代码证据：

- `injector/CavalryTranslatorInjector.mm` 只在安装成功后调用一次 `translateQtWidgets()`、`dumpQtMenuInventory()`、`refreshNativeMenuBar()`，再调度 8 次固定刷新。
- `kMaxRefreshAttempts = 8`、`kRefreshDelayMs = 1000`，8 秒后永久停止刷新。
- `translateQtWidgetTexts()` 只覆盖基础类型：`QLabel`、`QAbstractButton`、`QGroupBox`、`QLineEdit`、`QComboBox`、`QTabBar`、`QTabWidget`、`QStatusBar` 与 widget-owned `QAction`。
- 没有 `QMenu::aboutToShow` hook。
- 没有 `QObject::eventFilter()` / `QEvent::Show` / `QEvent::ChildAdded` 动态刷新。

---

## 1. 目标与非目标

### 1.1 必须解决

- [ ] 打开二级/三级菜单时，懒加载出来的 action 在显示前被翻译。
- [ ] Qt action 翻译后，AppKit `NSMenu` 同步刷新，不再出现 Qt 已中文但 macOS 菜单仍英文。
- [ ] 启动 8 秒后新出现的 panel、popover、dock、tab、list/table/tree item 仍能被翻译。
- [ ] runtime inventory 能看到更多 widget surface，不再出现常规运行时 `widgetTexts: 0` 但截图中明显有 UI 文本的情况。
- [ ] contract tests 能阻止回退到“启动期 8 秒扫描即停止”的旧模型。

### 1.2 不在本轮解决

- [ ] 不做 OCR 文本替换。
- [ ] 不 hook CoreGraphics / QTextLayout / paintEvent 绘制路径。
- [ ] 不直接 patch Cavalry Mach-O。
- [ ] 不把技术词、品牌词、ID 强行翻译。
- [ ] 不大范围修改 `QAbstractItemModel::data()`，避免把业务数据误当 UI 文案写回。

---

## 2. 文件边界

### 修改文件

- `injector/CavalryTranslatorInjector.mm`
  - 增加 Qt event filter 类。
  - 增加 `QMenu::aboutToShow` hook。
  - 增加 menu/widget hook 去重集合。
  - 增加更多 widget 类型文本写回。
  - 增强 runtime inventory，记录 hook/refresh 计数与更多 widget item 文本。

- `tools/check_app_contracts.js`
  - 增加源码级 contract，禁止回退到仅 8 次刷新。
  - 增加 contract 确认 `QMenu::aboutToShow`、event filter、动态 widget 类型覆盖存在。

- `tools/check_runtime_ui_coverage.js`
  - 如果 runtime inventory 新增 `actionTexts`、`listItems`、`treeItems`、`tableItems`、`headerTexts` 等 evidence 字段，必须同步让 coverage collector 消费这些字段。
  - 否则 injector 即使写出了新证据，`check:ui-coverage` 仍然看不到，验证会产生假阴性/假阳性。

### 只读参考文件

- `tools/zh-Hans.ts`
- `tools/zh-Hant.ts`
- `tools/ja_JP.ts`
- `tools/generate_embedded_translations.js`
- `tools/run_live_full_ui_matrix.js`
- `tools/capture_accessibility_inventory.js`
- `tools/check_runtime_ui_coverage.js`
- `docs/cavalry-runtime-injection-techniques.md`

---

## 3. 设计总览

```diagram
╭──────────────────────────────╮
│ EmbeddedTranslator installed │
╰───────────────┬──────────────╯
                │
                ▼
╭──────────────────────────────╮
│ Initial full refresh          │
│ - QMenuBar / QMenu / QAction  │
│ - QApplication::allWidgets    │
│ - AppKit NSMenu sync          │
╰───────────────┬──────────────╯
                │
                ├──────────────╮
                ▼              ▼
╭──────────────────────╮   ╭─────────────────────────╮
│ QMenu aboutToShow    │   │ Global Qt event filter   │
│ translate just-in-   │   │ Show/ChildAdded/Polish/  │
│ time before display  │   │ ActionAdded/LayoutRequest│
╰──────────┬───────────╯   ╰───────────┬─────────────╯
           │                           │
           ▼                           ▼
╭──────────────────────────────────────────────╮
│ Debounced refreshQtUiTranslations(lang)       │
│ - coalesce bursts                             │
│ - hook newly discovered menus                 │
│ - translate newly visible widgets             │
│ - refreshNativeMenuBar(lang)                  │
╰──────────────────────────────────────────────╯
```

关键原则：

1. **翻译时机前移到显示前。** 菜单内容可能在 `aboutToShow` 才真实生成，所以必须在这一刻翻译。
2. **动态刷新不断开。** 用 event filter 监听新增/显示事件，替代固定 8 秒窗口。
3. **刷新必须合并。** Qt 会在布局和创建阶段发出大量事件，不能每个事件全量扫描；使用 debounce 合并为一次 main queue refresh。
4. **优先改 UI surface，不改业务 model。** 对 `QTreeWidgetItem` / `QTableWidgetItem` / `QListWidgetItem` 可以写 item text；对通用 `QAbstractItemModel` 只先处理 header，避免污染业务数据。

---

## 4. 任务清单

### Task 1: 加 contract 锁定菜单显示前翻译机制

**Files:**

- Modify: `tools/check_app_contracts.js`

- [ ] **Step 1: 写失败测试**

在 `embedded injector translates Qt-owned menus before AppKit sync can overwrite them` 之后增加测试：

```js
test('embedded injector hooks menus before they are shown so lazy submenus are translated', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /aboutToShow/,
    'injector should connect QMenu::aboutToShow because Cavalry creates many submenu actions lazily when menus open'
  );
  assert.match(
    injectorSource,
    /hookQtMenu|installMenuHooks|ensureMenuHooked/,
    'injector should have a named menu hook pass so newly discovered menus are hooked exactly once'
  );
  assert.match(
    injectorSource,
    /QSet<QMenu \*>|hookedMenus/,
    'menu hooks should be de-duplicated to avoid repeated signal connections on every refresh'
  );
  assert.match(
    injectorSource,
    /refreshNativeMenuBar\(lang\)/,
    'menu show-time translation should refresh the native AppKit menu after Qt action text is updated'
  );
});
```

- [ ] **Step 2: 确认红灯**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected: FAIL，失败信息包含 `aboutToShow` 或 `menu hook pass`。

- [ ] **Step 3: 暂不实现，进入 Task 2**

本任务只建立红灯，Task 2 负责最小实现。

---

### Task 2: 实现 `QMenu::aboutToShow` hook

**Files:**

- Modify: `injector/CavalryTranslatorInjector.mm`
- Test: `tools/check_app_contracts.js`

- [ ] **Step 1: 增加 include 与全局状态**

在 include 区确认已有 `#include <QtWidgets/qmenu.h>`，并新增：

```cpp
#include <qpointer.h>
```

在当前全局变量附近新增：

```cpp
QSet<QMenu *> gHookedMenus;
```

说明：这里仍用 `QSet<QMenu *>` 做快速去重，但必须在菜单销毁时移除指针，避免 Cavalry 重建菜单后地址复用导致新菜单被误判为已 hook。

- [ ] **Step 2: 增加 hook 函数声明**

在 `void translateQtAction(QAction *action, const QString &lang);` 附近新增：

```cpp
void hookQtMenu(QMenu *menu, const QString &lang);
void hookQtMenus(const QString &lang);
```

- [ ] **Step 3: 实现单个菜单 hook**

在 `translateQtMenu()` 前后加入：

```cpp
void hookQtMenu(QMenu *menu, const QString &lang)
{
    if (menu == nullptr || lang.isEmpty() || gHookedMenus.contains(menu)) {
        return;
    }

    gHookedMenus.insert(menu);
    QPointer<QMenu> guardedMenu(menu);
    QObject::connect(
        menu,
        &QObject::destroyed,
        menu,
        [menu]() {
            gHookedMenus.remove(menu);
        }
    );
    QObject::connect(
        menu,
        &QMenu::aboutToShow,
        menu,
        [guardedMenu, lang]() {
            if (guardedMenu.isNull()) {
                return;
            }
            translateQtMenu(guardedMenu, lang);
            for (QAction *action : guardedMenu->actions()) {
                if (action != nullptr) {
                    hookQtMenu(action->menu(), lang);
                }
            }
            dispatch_async(dispatch_get_main_queue(), ^{
                refreshNativeMenuBar(lang);
            });
        }
    );
}
```

说明：

- 不要依赖 `Qt::UniqueConnection` 给 lambda 去重；Qt 对 lambda/functor 的 unique connection 语义不可靠。本方案用 `gHookedMenus` 做唯一去重。
- `refreshNativeMenuBar(lang)` 必须排到下一轮 main queue。根因验证里已经出现“Qt inventory 中文、AX 菜单英文”，说明 AppKit bridge 可能在 Qt 写回后再次同步；立即同步不一定晚于 AppKit 覆盖。
- 如果 live 验证仍出现 Qt 中文但 AX 英文，再在 queued pass 后追加一个 50ms second pass，而不是立刻扩大到更深层 hook。

如果编译提示 `translateQtMenu` 或 `refreshNativeMenuBar` 尚未声明，在 `hookQtMenu()` 前加入：

```cpp
void translateQtMenu(QMenu *menu, const QString &lang);
void refreshNativeMenuBar(const QString &lang);
```

- [ ] **Step 4: 在翻译 action 时递归 hook submenu**

修改 `translateQtAction()` 结尾：

```cpp
    QMenu *submenu = action->menu();
    hookQtMenu(submenu, lang);
    translateQtMenu(submenu, lang);
```

替换现有：

```cpp
    translateQtMenu(action->menu(), lang);
```

- [ ] **Step 5: 实现全量菜单 hook pass**

在 `translateQtMenuBar()` 之后加入：

```cpp
void hookQtMenus(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr || lang.isEmpty()) {
        return;
    }

    const auto widgets = QApplication::allWidgets();
    for (QWidget *widget : widgets) {
        if (QMenu *menu = qobject_cast<QMenu *>(widget)) {
            hookQtMenu(menu, lang);
        }
        if (QMenuBar *menuBar = qobject_cast<QMenuBar *>(widget)) {
            for (QAction *action : menuBar->actions()) {
                hookQtMenu(action != nullptr ? action->menu() : nullptr, lang);
            }
        }
    }
}
```

- [ ] **Step 6: 在刷新入口调用 hook pass**

修改 `refreshQtUiTranslations()`：

```cpp
void refreshQtUiTranslations(const QString &lang)
{
    if (lang.isEmpty()) {
        return;
    }

    hookQtMenus(lang);
    translateQtMenuBar(lang);
    translateQtWidgets(lang);
    refreshNativeMenuBar(lang);
}
```

- [ ] **Step 7: 运行合同测试**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected: PASS Task 1 新增测试；其它测试保持 PASS。

- [ ] **Step 8: 编译 injector**

Run:

```bash
npm run build:injector
```

Expected: `Built translator injector -> injector/libCavalryTranslatorInjector.dylib`。

- [ ] **Step 9: Commit**

```bash
git add injector/CavalryTranslatorInjector.mm tools/check_app_contracts.js
git commit -m "fix: translate lazy Qt menus before display"
```

---

### Task 3: 加 contract 禁止固定 8 秒刷新模型

**Files:**

- Modify: `tools/check_app_contracts.js`

- [ ] **Step 1: 写失败测试**

在 widget 翻译相关测试后增加：

```js
test('embedded injector uses a Qt event filter for widgets created after startup', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /eventFilter/,
    'injector should install a Qt event filter because Cavalry creates panels and widgets after the startup refresh window'
  );
  assert.match(
    injectorSource,
    /QEvent::Show|QEvent::ChildAdded|QEvent::Polish|QEvent::ActionAdded|QEvent::LayoutRequest/,
    'event filter should react to widget creation, show, polish, action, or layout events'
  );
  assert.match(
    injectorSource,
    /scheduleCoalescedRefresh|gRefreshPending/,
    'dynamic refresh should be coalesced so bursty Qt events do not trigger one full scan per event'
  );
  assert.doesNotMatch(
    injectorSource,
    /constexpr int kMaxRefreshAttempts = 8;/,
    'injector should not rely on the old fixed 8-second refresh window as the only dynamic UI mechanism'
  );
});
```

- [ ] **Step 2: 确认红灯**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected: FAIL，失败信息包含 `event filter` 或 `old fixed 8-second refresh window`。

---

### Task 4: 实现全局 Qt event filter + debounce 刷新

**Files:**

- Modify: `injector/CavalryTranslatorInjector.mm`
- Test: `tools/check_app_contracts.js`

- [ ] **Step 1: 增加 Qt event include**

在 include 区增加：

```cpp
#include <qevent.h>
#include <qobject.h>
```

- [ ] **Step 2: 替换固定刷新状态**

保留启动后短暂 refresh 可以作为 warm-up，但不能作为唯一机制。把全局状态扩展为：

```cpp
bool gRefreshScheduled = false;
bool gRefreshPending = false;
QObject *gEventFilter = nullptr;
```

把：

```cpp
constexpr int kMaxRefreshAttempts = 8;
constexpr int kRefreshDelayMs = 1000;
```

替换为：

```cpp
constexpr int kWarmupRefreshAttempts = 3;
constexpr int kRefreshDelayMs = 1000;
constexpr int kCoalescedRefreshDelayMs = 75;
```

- [ ] **Step 3: 增加 coalesced refresh**

在 `refreshQtUiTranslations()` 后加入：

```cpp
void scheduleCoalescedRefresh(const QString &lang)
{
    if (lang.isEmpty() || gRefreshPending) {
        return;
    }

    gRefreshPending = true;
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(kCoalescedRefreshDelayMs) * NSEC_PER_MSEC),
        dispatch_get_main_queue(),
        ^{
            gRefreshPending = false;
            refreshQtUiTranslations(lang);
        }
    );
}
```

- [ ] **Step 4: 增加 event filter 类**

在 namespace 内增加：

```cpp
class RuntimeUiEventFilter final : public QObject {
public:
    explicit RuntimeUiEventFilter(const QString &lang)
        : QObject(QCoreApplication::instance()), m_lang(lang)
    {
    }

protected:
    bool eventFilter(QObject *watched, QEvent *event) override
    {
        if (watched == nullptr || event == nullptr || m_lang.isEmpty()) {
            return QObject::eventFilter(watched, event);
        }

        const bool isRelevantObject = qobject_cast<QWidget *>(watched) != nullptr ||
            qobject_cast<QAction *>(watched) != nullptr ||
            qobject_cast<QMenu *>(watched) != nullptr;
        if (!isRelevantObject) {
            return QObject::eventFilter(watched, event);
        }

        switch (event->type()) {
        case QEvent::Show:
        case QEvent::ChildAdded:
        case QEvent::ActionAdded:
            scheduleCoalescedRefresh(m_lang);
            break;
        default:
            break;
        }

        return QObject::eventFilter(watched, event);
    }

private:
    QString m_lang;
};
```

如果编译提示 `scheduleCoalescedRefresh` 未声明，在 class 前增加：

```cpp
void scheduleCoalescedRefresh(const QString &lang);
```

- [ ] **Step 5: 安装 event filter**

增加函数：

```cpp
void installRuntimeUiEventFilter(const QString &lang)
{
    QCoreApplication *app = QCoreApplication::instance();
    if (app == nullptr || lang.isEmpty() || gEventFilter != nullptr) {
        return;
    }

    gEventFilter = new RuntimeUiEventFilter(lang);
    app->installEventFilter(gEventFilter);
}
```

在 `installTranslator()` 成功安装 translator 后、首次刷新前调用：

```cpp
    installRuntimeUiEventFilter(lang);
```

必须放在 `if (!translateQtMenuBar(lang)) { return false; }` 之前。当前 `installTranslator()` 会在 Qt menu bar 未 ready 时返回 false 并重试；如果 event filter 放在 readiness gate 后面，最需要监听动态 UI 的启动窗口期反而没有安装 filter。

- [ ] **Step 6: 调整 warm-up 刷新**

修改 `scheduleRefreshAttempt()`：

```cpp
void scheduleRefreshAttempt(const QString &lang, int attempt)
{
    if (lang.isEmpty() || attempt >= kWarmupRefreshAttempts) {
        return;
    }

    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(kRefreshDelayMs) * NSEC_PER_MSEC),
        dispatch_get_main_queue(),
        ^{
            refreshQtUiTranslations(lang);
            scheduleRefreshAttempt(lang, attempt + 1);
        }
    );
}
```

- [ ] **Step 7: 运行合同测试与编译**

Run:

```bash
node --test tools/check_app_contracts.js
npm run build:injector
```

Expected: tests PASS；injector dylib 构建成功。

- [ ] **Step 8: Commit**

```bash
git add injector/CavalryTranslatorInjector.mm tools/check_app_contracts.js
git commit -m "fix: refresh translated UI after runtime widget events"
```

---

### Task 5: 补齐低风险 widget 类型覆盖

**Files:**

- Modify: `injector/CavalryTranslatorInjector.mm`
- Modify: `tools/check_app_contracts.js`

- [ ] **Step 1: 写 contract**

在 widget 类型测试中增加断言：

```js
test('embedded injector covers item widgets, headers, docks, toolbars, and standard dialog surfaces', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /QListWidget|QTreeWidget|QTableWidget/,
    'injector should translate item-based list, tree, and table widgets without mutating arbitrary business models'
  );
  assert.match(
    injectorSource,
    /QHeaderView|setHorizontalHeaderItem|setVerticalHeaderItem/,
    'injector should translate table/tree header labels because Cavalry panels use column headers'
  );
  assert.match(
    injectorSource,
    /QDockWidget|QToolBar|QToolButton|QDialogButtonBox/,
    'injector should cover common dock, toolbar, tool button, and standard button box surfaces'
  );
  assert.match(
    injectorSource,
    /QSpinBox|QDoubleSpinBox|QProgressBar/,
    'injector should cover prefix, suffix, and progress format strings used by numeric widgets'
  );
});
```

- [ ] **Step 2: 确认红灯**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected: FAIL，失败信息包含缺失 widget 类型。

- [ ] **Step 3: 增加 include**

在 injector include 区增加：

```cpp
#include <QtWidgets/qdialogbuttonbox.h>
#include <QtWidgets/qdockwidget.h>
#include <QtWidgets/qheaderview.h>
#include <QtWidgets/qlistwidget.h>
#include <QtWidgets/qprogressbar.h>
#include <QtWidgets/qspinbox.h>
#include <QtWidgets/qtablewidget.h>
#include <QtWidgets/qtoolbar.h>
#include <QtWidgets/qtoolbutton.h>
#include <QtWidgets/qtreewidget.h>
```

- [ ] **Step 4: 增加 item 翻译 helper**

在 `translatedWidgetText()` 后加入：

```cpp
void translateListWidgetItems(QListWidget *listWidget, const QString &lang)
{
    if (listWidget == nullptr || lang.isEmpty()) {
        return;
    }
    for (int row = 0; row < listWidget->count(); ++row) {
        QListWidgetItem *item = listWidget->item(row);
        if (item == nullptr) {
            continue;
        }
        const QString translated = translatedWidgetText(lang, item->text());
        if (!translated.isEmpty()) {
            item->setText(translated);
        }
    }
}

void translateTreeWidgetItem(QTreeWidgetItem *item, const QString &lang)
{
    if (item == nullptr || lang.isEmpty()) {
        return;
    }
    for (int column = 0; column < item->columnCount(); ++column) {
        const QString translated = translatedWidgetText(lang, item->text(column));
        if (!translated.isEmpty()) {
            item->setText(column, translated);
        }
    }
    for (int index = 0; index < item->childCount(); ++index) {
        translateTreeWidgetItem(item->child(index), lang);
    }
}

void translateTableWidgetItems(QTableWidget *tableWidget, const QString &lang)
{
    if (tableWidget == nullptr || lang.isEmpty()) {
        return;
    }
    for (int row = 0; row < tableWidget->rowCount(); ++row) {
        for (int column = 0; column < tableWidget->columnCount(); ++column) {
            QTableWidgetItem *item = tableWidget->item(row, column);
            if (item == nullptr) {
                continue;
            }
            const QString translated = translatedWidgetText(lang, item->text());
            if (!translated.isEmpty()) {
                item->setText(translated);
            }
        }
    }
}
```

- [ ] **Step 5: 在 `translateQtWidgetTexts()` 加低风险类型写回**

在 `QStatusBar` 处理后、`translateQtWidgetActions()` 前加入：

```cpp
    if (QDockWidget *dockWidget = qobject_cast<QDockWidget *>(widget)) {
        translated = translatedWidgetText(lang, dockWidget->windowTitle());
        if (!translated.isEmpty()) {
            dockWidget->setWindowTitle(translated);
        }
    }

    if (QToolBar *toolBar = qobject_cast<QToolBar *>(widget)) {
        translated = translatedWidgetText(lang, toolBar->windowTitle());
        if (!translated.isEmpty()) {
            toolBar->setWindowTitle(translated);
        }
        for (QAction *action : toolBar->actions()) {
            translateQtAction(action, lang);
        }
    }

    if (QToolButton *toolButton = qobject_cast<QToolButton *>(widget)) {
        translated = translatedWidgetText(lang, toolButton->text());
        if (!translated.isEmpty()) {
            toolButton->setText(translated);
        }
        translateQtAction(toolButton->defaultAction(), lang);
    }

    if (QDialogButtonBox *buttonBox = qobject_cast<QDialogButtonBox *>(widget)) {
        for (QAbstractButton *button : buttonBox->buttons()) {
            translated = translatedWidgetText(lang, button->text());
            if (!translated.isEmpty()) {
                button->setText(translated);
            }
        }
    }

    if (QSpinBox *spinBox = qobject_cast<QSpinBox *>(widget)) {
        translated = translatedWidgetText(lang, spinBox->prefix());
        if (!translated.isEmpty()) {
            spinBox->setPrefix(translated);
        }
        translated = translatedWidgetText(lang, spinBox->suffix());
        if (!translated.isEmpty()) {
            spinBox->setSuffix(translated);
        }
    }

    if (QDoubleSpinBox *doubleSpinBox = qobject_cast<QDoubleSpinBox *>(widget)) {
        translated = translatedWidgetText(lang, doubleSpinBox->prefix());
        if (!translated.isEmpty()) {
            doubleSpinBox->setPrefix(translated);
        }
        translated = translatedWidgetText(lang, doubleSpinBox->suffix());
        if (!translated.isEmpty()) {
            doubleSpinBox->setSuffix(translated);
        }
    }

    if (QProgressBar *progressBar = qobject_cast<QProgressBar *>(widget)) {
        translated = translatedWidgetText(lang, progressBar->format());
        if (!translated.isEmpty()) {
            progressBar->setFormat(translated);
        }
    }

    if (QListWidget *listWidget = qobject_cast<QListWidget *>(widget)) {
        translateListWidgetItems(listWidget, lang);
    }

    if (QTreeWidget *treeWidget = qobject_cast<QTreeWidget *>(widget)) {
        for (int column = 0; column < treeWidget->columnCount(); ++column) {
            QTreeWidgetItem *header = treeWidget->headerItem();
            if (header != nullptr) {
                translated = translatedWidgetText(lang, header->text(column));
                if (!translated.isEmpty()) {
                    header->setText(column, translated);
                }
            }
        }
        for (int index = 0; index < treeWidget->topLevelItemCount(); ++index) {
            translateTreeWidgetItem(treeWidget->topLevelItem(index), lang);
        }
    }

    if (QTableWidget *tableWidget = qobject_cast<QTableWidget *>(widget)) {
        translateTableWidgetItems(tableWidget, lang);
        for (int column = 0; column < tableWidget->columnCount(); ++column) {
            QTableWidgetItem *header = tableWidget->horizontalHeaderItem(column);
            if (header != nullptr) {
                translated = translatedWidgetText(lang, header->text());
                if (!translated.isEmpty()) {
                    header->setText(translated);
                }
            }
        }
        for (int row = 0; row < tableWidget->rowCount(); ++row) {
            QTableWidgetItem *header = tableWidget->verticalHeaderItem(row);
            if (header != nullptr) {
                translated = translatedWidgetText(lang, header->text());
                if (!translated.isEmpty()) {
                    header->setText(translated);
                }
            }
        }
    }
```

- [ ] **Step 6: 运行合同测试与编译**

Run:

```bash
node --test tools/check_app_contracts.js
npm run build:injector
```

Expected: tests PASS；injector dylib 构建成功。

- [ ] **Step 7: Commit**

```bash
git add injector/CavalryTranslatorInjector.mm tools/check_app_contracts.js
git commit -m "fix: translate additional Qt widget surfaces"
```

---

### Task 6: 增强 runtime inventory，证明 widget surface 被看到

**Files:**

- Modify: `injector/CavalryTranslatorInjector.mm`
- Modify: `tools/check_app_contracts.js`
- Modify: `tools/check_runtime_ui_coverage.js`

- [ ] **Step 1: 写 contract**

增加测试：

```js
test('embedded injector inventory records dynamic refresh and expanded widget evidence', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /refreshCount|eventRefreshCount|menuHookCount/,
    'runtime inventory should expose refresh and hook counters so weak injection can be diagnosed from artifacts'
  );
  assert.match(
    injectorSource,
    /listItems|treeItems|tableItems|headerTexts|actionTexts/,
    'runtime inventory should include expanded widget/item evidence, not only QObject string properties'
  );
});
```

- [ ] **Step 2: 实现计数器**

在全局状态加入：

```cpp
int gRefreshCount = 0;
int gEventRefreshCount = 0;
```

在 `refreshQtUiTranslations()` 开头加入：

```cpp
    ++gRefreshCount;
```

在 `scheduleCoalescedRefresh()` 的 block 内、调用 refresh 前加入：

```cpp
            ++gEventRefreshCount;
```

- [ ] **Step 3: inventory 写入 metadata**

在 `dumpQtMenuInventory()` JSON payload 中增加：

```objc
        @"diagnostics" : @{
            @"refreshCount" : @(gRefreshCount),
            @"eventRefreshCount" : @(gEventRefreshCount),
            @"menuHookCount" : @(gHookedMenus.size()),
        },
```

- [ ] **Step 4: 动态刷新后重写 inventory**

当前 `dumpQtMenuInventory(lang)` 只在 `installTranslator()` 成功时写一次。如果不改，event filter 后续刷新即使真的翻译了动态 UI，诊断文件也不会更新。因此必须在 `refreshQtUiTranslations()` 末尾追加一次 dump：

```cpp
void refreshQtUiTranslations(const QString &lang)
{
    if (lang.isEmpty()) {
        return;
    }

    ++gRefreshCount;
    hookQtMenus(lang);
    translateQtMenuBar(lang);
    translateQtWidgets(lang);
    refreshNativeMenuBar(lang);
    dumpQtMenuInventory(lang);
}
```

说明：`dumpQtMenuInventory()` 在当前源码中已经定义在 `refreshQtUiTranslations()` 之前，因此这里不需要新增前向声明。若实现时调整了函数顺序，再补：

```cpp
bool dumpQtMenuInventory(const QString &lang);
```

- [ ] **Step 5: 扩展 `serializeWidget()` item evidence**

在 `serializeWidget()` 中增加 action 文本与 item 文本数组。最小实现：

```cpp
    NSMutableArray *actionTexts = [NSMutableArray array];
    for (QAction *action : widget->actions()) {
        if (action != nullptr) {
            const QString actionText = normalizeMenuText(action->text());
            if (!actionText.isEmpty()) {
                [actionTexts addObject:toNSString(actionText)];
            }
        }
    }
    if ([actionTexts count] > 0) {
        payload[@"actionTexts"] = actionTexts;
    }
```

然后把 early return 条件改成：

```cpp
    if (payload[@"strings"] == nil && payload[@"tabTexts"] == nil && payload[@"actionTexts"] == nil) {
        return [NSNull null];
    }
```

后续如果 live capture 仍然无法定位残留，再把 `listItems` / `treeItems` / `tableItems` 加入 inventory；本轮先用 `actionTexts` 和 diagnostics 证明动态刷新是否发生。

- [ ] **Step 6: 让 runtime coverage 消费新增 evidence 字段**

当前 `tools/check_runtime_ui_coverage.js` 只消费 `widget.strings` 和 `widget.tabTexts`。如果新增 `actionTexts` 但不改 coverage，`npm run check:ui-coverage` 不会看到这些证据。

在 `tools/check_runtime_ui_coverage.js` 的 widget text 收集逻辑中加入数组字段消费。实现时按现有 `tabTexts` 的处理方式增加：

```js
for (const field of ['tabTexts', 'actionTexts', 'listItems', 'treeItems', 'tableItems', 'headerTexts']) {
  for (const value of widget[field] || []) {
    addCandidate(value, `${widget.className}.${field}`);
  }
}
```

实际函数名以当前文件里的 collector 为准，但行为必须是：新增 inventory evidence 进入同一套 untranslated/allowlist/forbidden-pattern 判断。

- [ ] **Step 7: 运行测试与编译**

Run:

```bash
node --test tools/check_app_contracts.js
npm run build:injector
```

Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add injector/CavalryTranslatorInjector.mm tools/check_app_contracts.js tools/check_runtime_ui_coverage.js
git commit -m "test: record runtime injection diagnostics"
```

---

### Task 7: live 验证菜单根因已修复

**Files:**

- Runtime artifacts only under `$HOME/Library/Caches/Cavalry-i18n/sessions/<uuid>`

- [ ] **Step 1: 启动 zh-Hant live capture**

Run:

```bash
SESSION_UUID="MENU-HOOK-$(date +%Y%m%d-%H%M%S)"
SESSION_DIR="$HOME/Library/Caches/Cavalry-i18n/sessions/$SESSION_UUID"
LAUNCH_OUTPUT=$(bash tools/launch_cavalry_with_injector.sh \
  --app /Applications/Cavalry.app \
  --lang zh-Hant \
  --session-dir "$SESSION_DIR" \
  --session-uuid "$SESSION_UUID" \
  --no-resign)
echo "$LAUNCH_OUTPUT"
PID=$(printf '%s\n' "$LAUNCH_OUTPUT" | awk -F= '/^PID=/ { print $2 }')
test -n "$PID"
```

Expected: output contains `PID=<number>`。

- [ ] **Step 2: 手动展开问题菜单**

在 Cavalry 中展开：

```text
建立 > 形狀
```

Expected visible result: `Basic Line`、`Basic Shape`、`Connect Shape` 不再显示英文，显示 zh-Hant 译文。

- [ ] **Step 3: 抓 AX inventory**

Run:

```bash
node tools/capture_accessibility_inventory.js \
  --pid "$PID" \
  --language zh-Hant \
  --session-uuid "$SESSION_UUID" \
  --output "$SESSION_DIR/runtime/zh-Hant-ax-inventory.json" \
  --audit-log "$SESSION_DIR/audit/zh-Hant-ax-capture.json"
```

Expected: writes AX inventory with `menuBars: 1`。

- [ ] **Step 4: 检查截图问题词不再以英文出现**

Run:

```bash
node - <<'NODE' "$SESSION_DIR/runtime/zh-Hant-ax-inventory.json"
const fs = require('fs');
const inventory = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const blockers = ['Basic Line', 'Basic Shape', 'Connect Shape', 'Convex Hull', 'Custom Shape'];
const payload = JSON.stringify(inventory);
const found = blockers.filter((text) => payload.includes(text));
if (found.length) {
  console.error(`Still English: ${found.join(', ')}`);
  process.exit(1);
}
console.log('PASS: lazy shape submenu translated');
NODE
```

Expected: `PASS: lazy shape submenu translated`。

- [ ] **Step 5: 关闭测试进程**

Run:

```bash
pkill -TERM -f '/Applications/Cavalry.app/Contents/MacOS/Cavalry' || true
```

Expected: Cavalry exits。

---

### Task 8: live 验证普通 UI 动态刷新改善

**Files:**

- Runtime artifacts only under `$HOME/Library/Caches/Cavalry-i18n/sessions/<uuid>`

- [ ] **Step 1: 启动 zh-Hant live session**

Run:

```bash
SESSION_UUID="WIDGET-EVENT-$(date +%Y%m%d-%H%M%S)"
SESSION_DIR="$HOME/Library/Caches/Cavalry-i18n/sessions/$SESSION_UUID"
LAUNCH_OUTPUT=$(bash tools/launch_cavalry_with_injector.sh \
  --app /Applications/Cavalry.app \
  --lang zh-Hant \
  --session-dir "$SESSION_DIR" \
  --session-uuid "$SESSION_UUID" \
  --no-resign)
echo "$LAUNCH_OUTPUT"
PID=$(printf '%s\n' "$LAUNCH_OUTPUT" | awk -F= '/^PID=/ { print $2 }')
test -n "$PID"
```

- [ ] **Step 2: 手动触发截图中的动态 UI**

在 Cavalry 中打开或切换：

```text
右侧 Add Layers / Color panel
底部 Scene Window / JavaScript Editor / Dependency Graph / Time Editor / Graph Editor
```

Expected visible result: 已有翻译的 panel/tab/status 文案优先显示中文。

- [ ] **Step 3: 等待 injector 输出 inventory**

Run:

```bash
for i in {1..80}; do
  test -f "$SESSION_DIR/runtime/zh-Hant-injector-inventory.json" && break
  sleep 0.25
done
test -f "$SESSION_DIR/runtime/zh-Hant-injector-inventory.json"
```

Expected: command exits 0。

- [ ] **Step 4: 检查 diagnostics 表示 event refresh 已发生**

Run:

```bash
node - <<'NODE' "$SESSION_DIR/runtime/zh-Hant-injector-inventory.json"
const fs = require('fs');
const inventory = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const diagnostics = inventory.diagnostics || {};
console.log(diagnostics);
if (!Number.isInteger(diagnostics.eventRefreshCount) || diagnostics.eventRefreshCount < 1) {
  console.error('Event filter did not drive a runtime refresh');
  process.exit(1);
}
NODE
```

Expected: prints diagnostics with positive `eventRefreshCount`。只检查 `refreshCount` 或 `menuHookCount` 不够，因为 warm-up refresh 和初始 hook 也能让它们为正，不能证明 event filter 生效。

- [ ] **Step 5: 关闭测试进程**

Run:

```bash
pkill -TERM -f '/Applications/Cavalry.app/Contents/MacOS/Cavalry' || true
```

Expected: Cavalry exits。

---

### Task 9: 全矩阵回归

**Files:**

- Runtime artifacts only under `$HOME/Library/Caches/Cavalry-i18n/sessions/<uuid>`

- [ ] **Step 1: 跑 contract**

Run:

```bash
npm run test:contracts
```

Expected: PASS。

- [ ] **Step 2: 跑翻译质量 gate**

Run:

```bash
tmpdir=$(mktemp -d)
python3 tools/validate_translations.py \
  --json-report "$tmpdir/report.json" \
  --markdown-summary "$tmpdir/summary.md"
cat "$tmpdir/summary.md"
rm -rf "$tmpdir"
```

Expected: PASS；三语 `Translate leaves = 6028`、`Exact English = 0`、`English residue = 0`。

- [ ] **Step 3: 跑 live full UI matrix**

Run:

```bash
node tools/run_live_full_ui_matrix.js \
  --app /Applications/Cavalry.app \
  --languages en,zh-Hans,zh-Hant,ja_JP
```

Expected: writes `full-ui-run-record.json` and does not fail `WEAK-CAPTURE`。

- [ ] **Step 4: 对比剩余英文归因**

对每个非 English 语言运行：

```bash
SESSION_DIR="<printed sessionDir from full-ui-run-record>"
LANGUAGE=zh-Hant npm run check:ui-coverage
```

Expected: 如果仍失败，失败项必须可分入：

1. 翻译表无 source：补采集/补 TS。
2. 技术词/品牌/ID：加入现有 allowlist 规则前先写证据。
3. 翻译表有但仍英文：继续补 injector surface，不改翻译。

- [ ] **Step 5: Commit 验证记录**

如果实现中更新了 contract 或 docs：

```bash
git add tools/check_app_contracts.js docs/runtime-ui-injection-coverage-plan.md
git commit -m "docs: record runtime UI injection coverage plan"
```

---

## 5. 成功标准

### 5.1 菜单成功标准

- `建立 > 形狀` 子菜单中，`Basic Line`、`Basic Shape`、`Connect Shape`、`Convex Hull`、`Custom Shape` 在 zh-Hant/zh-Hans/ja_JP 中不再以英文显示。
- AX inventory 中这些源文案不再作为英文残留出现。
- `qtAlreadyTranslatedButNativeEnglish` 从 26 降到 0 或只剩明确 allowlist 项。
- `absentFromInitialQtInventory` 对 lazy 菜单不再造成最终显示英文，因为 `aboutToShow` 会补翻译。

### 5.2 普通 UI 成功标准

- 右侧 panel 与底部 tab 中，已存在 TS 翻译的文案优先显示目标语言。
- runtime injector inventory 不再在常规启动后只有 `widgetTexts: 0`；如果仍为 0，diagnostics 必须显示 event filter 已安装且 refresh 已触发，再进入 custom painted surface 调查。
- 新增 widget 类型 contract 全部 PASS。

### 5.3 质量 gate 成功标准

- `npm run test:contracts` PASS。
- `npm run build:injector` PASS。
- `python3 tools/validate_translations.py ...` PASS。
- live full UI matrix 不出现弱抓取。

---

## 6. 风险与回滚

| 风险 | 触发信号 | 处理 |
|---|---|---|
| Event filter 触发过于频繁 | Cavalry 启动卡顿、CPU 长时间高 | 增大 `kCoalescedRefreshDelayMs` 到 150ms，并缩小事件类型到 `Show/ChildAdded/ActionAdded` |
| 重复 signal connection | 菜单打开时重复刷新多次 | 确认 `gHookedMenus` 与 `Qt::UniqueConnection` 生效 |
| 写 item text 误改业务数据 | 项目/图层真实名称被翻译 | 只保留 `QListWidget/QTreeWidget/QTableWidget` item 类，避免通用 model data 写回；如果图层名被误翻，按 objectName/className 增加 denylist |
| AppKit 菜单仍覆盖 Qt 文本 | Qt inventory 中文、AX 英文 | 在 `aboutToShow` block 后增加延迟 0ms/50ms 的 `refreshNativeMenuBar(lang)` 二次同步 |
| 部分 UI 仍英文但 Qt/AX 都抓不到 | inventory 无该文本 | 标记为 custom painted surface，进入后续 paint-path/hook 调研，不在本方案内硬改 |

回滚方式：

```bash
git revert <menu-hook-commit> <event-filter-commit> <widget-surface-commit>
npm run build:injector
```

---

## 7. 后续调查入口

如果完成本方案后仍有明显英文残留，按下面顺序归因：

1. 用 AX/injector merged inventory 搜该英文。
2. 用 `rg` 搜 `tools/*.ts` 和 `languages/*` 是否存在 source。
3. 如果 source 存在：继续补 injector 对应 surface。
4. 如果 source 不存在：补 extraction/TS denominator。
5. 如果 source 存在但 UI 不在 AX/injector inventory：记录为 custom painted，单独立项，不在当前 plan 中扩大范围。

固定排查命令：

```bash
rg -n "<English Text>" tools languages injector/generated_translations.inc
node - <<'NODE' "$SESSION_DIR/runtime/zh-Hant-merged-inventory.json"
const fs = require('fs');
const inventory = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const needle = process.env.NEEDLE || '';
const payload = JSON.stringify(inventory);
console.log(payload.includes(needle) ? `FOUND ${needle}` : `MISSING ${needle}`);
NODE
```

---

## 8. 状态

- [x] 根因已通过 live AX/injector inventory 对照确认。
- [x] 方案已拆分为菜单、动态刷新、widget surface、runtime diagnostics、live 验证五条线。
- [x] Task 1-6 代码已实现并提交。
- [x] Task 7-8 live 验证：warmup 刷新确认正常工作（refreshCount=3+），event filter 触发的 coalesced refresh 已工作（eventRefreshCount>0）。
      AX inventory 抓取因 Qt 菜单栏 bridge 间歇性不可用未能完整验证；注入器诊断证明机制已生效。
      AX 枚举的 `aboutToShow` 触发依赖实际用户菜单展开，受 System Events 限制未能自动化验证。
- [x] Task 9: contract 测试 72/72 PASS，翻译质量 gate 三语 100% PASS。
- [x] 额外修正：warmup 刷新从 `installTranslator()` 移至 `NSApplicationDidFinishLaunching` handler，
      修复 dispatch_after 在 Qt 主 runloop 中不触发的问题，改用 dispatch_async 值捕获确保 lang 不悬空。

### 2026-05-13 修复记录

- **[BUGFIX] aboutToShow handler 未翻译 action text**：原 handler 只调 `translateQtMenu`（只设 menu title）和 `hookQtMenu(action->menu())`（只 hook 子 menu 的 aboutToShow），未调 `translateQtAction` 翻译 action 本身的 text/toolTip 等。懒加载创建出来的 action 始终英文。已修复：`hookQtMenu(action->menu(), lang)` → `translateQtAction(action, lang)`（后者内部递归调用 hookQtMenu + translateQtMenu）。

- **[BUGFIX] scheduleCoalescedRefresh 无延迟导致 100% CPU**：原实现用 `dispatch_async` 立即将 refresh block 派到 main queue，在 Cavalry 初始化嵌套 event loop（`ButtonGroup::setChecked` → `processEvents`）中让 CFRunLoop 持续服务 dispatch queue，无法退出嵌套循环。已修复：改用 `dispatch_after(75ms)` + cooldown `dispatch_after(75ms)` 确保 gRefreshPending 保持 true 直到刷新完成后再释放。

- **[BUGFIX] scheduleRefreshAttempts 一次性派发全部 warmup**：3 次 refresh 同时 dispatch_async，在嵌套 event loop 中同时触发。已修复：改用 `dispatch_after(i * 1000ms)` 间隔 1 秒发散。

- **[BUGFIX] event filter 安装过早**：原方案要求 event filter 装在 readiness gate 之前（L576）。但 early attempt 即使 `translateQtMenuBar` 返回 false，event filter 仍永久安装，开始拦截 Cavalry 初始化期的所有 Show/ChildAdded/ActionAdded 事件，触发额外 refresh。已修复：将 `installRuntimeUiEventFilter` 移至 `installTranslator` 成功路径末尾（`translateQtWidgets` 之后），early attempt 不安装 filter。

- **[SCOPE] 菜单英文已被抑制**：injector inventory 2026-05-13 实机截图确认顶层菜单全文已翻译。`建立 > 形狀` 子菜单在 inventory 中为 `dummy`（纯懒加载），`aboutToShow` 触发后方可验证。已知局限：Qt 菜单不创建原生 NSMenu，System Events 无法通过 AX click 触发 aboutToShow，需用户实机操作验证。
