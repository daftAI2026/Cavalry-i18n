<!--
[INPUT]: 依赖 2026-05-13 Cavalry 2.7.1 live 复现、sample 调用栈、injector/CavalryTranslatorInjector.mm 当前 event filter / translateQtWidgets / lookupEmbeddedTranslation 实现、tools/check_app_contracts.js 当前源码合同
[OUTPUT]: 对外提供 runtime UI event filter 卡死问题的 superpower implementation plan，覆盖复现证据、TDD 步骤、代码改造、验证顺序与回滚边界
[POS]: docs/ 性能修复计划文档，只记录方案与执行步骤，不驱动运行时
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Runtime UI Event Filter Performance Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Cavalry 注入器中 runtime Qt event filter 触发全量 widget 扫描导致的持续 100% CPU，同时保留启动后动态 panel/widget 的补翻译能力。

**Architecture:** 保留 `QTranslator` + DYLD injector 架构与 `QMenu::aboutToShow` 懒菜单翻译。把 runtime event 路径从 `eventFilter → scheduleCoalescedRefresh → refreshQtUiTranslations → QApplication::allWidgets()` 改为 `eventFilter → dirty object queue → budgeted local translation`，并为 widget 写回路径增加当前语言 `QHash` 翻译缓存。

**Tech Stack:** Objective-C++、Qt 6.6.3 Widgets ABI、AppKit `NSMenu`、Node `node:test` contract tests、macOS `sample` live profiling。

---

## Evidence Summary

2026-05-13 live 复现使用临时复制的 `/Applications/Cavalry.app`，避免修改原始 app：

```bash
SESSION_ROOT="$HOME/Library/Caches/Cavalry-i18n/repro-$(date +%Y%m%d-%H%M%S)"
ditto /Applications/Cavalry.app "$SESSION_ROOT/Cavalry.app"

bash tools/launch_cavalry_with_injector.sh \
  --app "$SESSION_ROOT/Cavalry.app" \
  --lang zh-Hans \
  --session-dir "$SESSION_ROOT/session" 2>&1 | tee "$SESSION_ROOT/launch.out"
PID="$(awk -F= '/^PID=/{print $2}' "$SESSION_ROOT/launch.out")"

ps -p "$PID" -o pid,stat,%cpu,%mem,time,command
sample "$PID" 5 -file "$SESSION_ROOT/cavalry.sample.txt"
```

Observed:

- Cavalry 启动后持续 `99%~100%` CPU；等待 60 秒后仍未回落。
- 启动初期 sample 落在 `scheduleRefreshAttempts → refreshQtUiTranslations → translateQtWidgets → lookupEmbeddedTranslation`。
- 60 秒后 sample 落在 `scheduleCoalescedRefresh → refreshQtUiTranslations → translateQtWidgets → lookupEmbeddedTranslation`。

Root cause:

- `RuntimeUiEventFilter` 监听 `Show` / `ChildAdded` / `ActionAdded` 后触发 full refresh。
- full refresh 内部调用 `QApplication::allWidgets()`。
- 每轮 `translateQtWidgets()` 对大量 widget/action/menu 文本重复调用线性 `lookupEmbeddedTranslation()`。

Non-goals:

- 不删除 `QMenu::aboutToShow`。
- 不把普通 runtime event 重新接回 full refresh。
- 不 hook paint/CoreGraphics/OCR。
- 不改 `tools/*.ts` 翻译内容。

---

## File Structure

- Modify: `tools/check_app_contracts.js`
  - 把“event filter 存在 + coalesced refresh”合同改成“event filter 入队 dirty object + 禁止 full refresh”。
  - 增加 translation cache 与 dirty diagnostics 的源码合同。

- Modify: `injector/CavalryTranslatorInjector.mm`
  - 增加 `QHash` / `QVector` / `QEvent` include。
  - 增加 `gTranslationBySource` 与 `rebuildTranslationCache()`。
  - 修改 `lookupEmbeddedTranslation()`，优先使用当前语言缓存。
  - 删除或停用 `scheduleCoalescedRefresh()` full refresh 路径。
  - 增加 dirty object queue、budgeted drain、`translateRuntimeObject()`。
  - 修改 `RuntimeUiEventFilter::eventFilter()`，只入队 dirty object。
  - 更新 inventory diagnostics counters。

- Test/Build commands:
  - `node --test tools/check_app_contracts.js`
  - `npm run build:injector`
  - live repro: `tools/launch_cavalry_with_injector.sh` + `ps` + `sample`

---

### Task 1: Contract Tests For Dirty-Object Runtime Events

**Files:**

- Modify: `tools/check_app_contracts.js`
- Test: `tools/check_app_contracts.js`

- [ ] **Step 1: Replace the runtime event filter contract**

In `tools/check_app_contracts.js`, replace the test named `embedded injector uses a Qt event filter for widgets created after startup` with this stricter test:

```js
test('embedded injector handles runtime Qt events with dirty-object local translation only', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /eventFilter/,
    'injector should still observe runtime Qt object creation for panels and widgets created after startup'
  );
  assert.match(
    injectorSource,
    /enqueueRuntimeObject|scheduleDirtyObjectDrain|drainDirtyObjects|gDirtyObjects/,
    'runtime events should enqueue dirty objects for local translation instead of scheduling a full UI refresh'
  );
  assert.match(
    injectorSource,
    /QChildEvent|child\(\)/,
    'ChildAdded handling should enqueue the new child object instead of blindly refreshing the whole application'
  );
  assert.match(
    injectorSource,
    /translateRuntimeObject/,
    'dirty object draining should use a dedicated local translation entry point'
  );
  assert.doesNotMatch(
    injectorSource,
    /scheduleCoalescedRefresh[\s\S]*refreshQtUiTranslations/,
    'coalesced runtime event handling must not call refreshQtUiTranslations because that runs QApplication::allWidgets()'
  );
  assert.doesNotMatch(
    injectorSource,
    /eventFilter[\s\S]{0,1600}refreshQtUiTranslations/,
    'eventFilter must not directly or nearby indirectly trigger the full UI refresh path'
  );
});
```

- [ ] **Step 2: Add a translation cache contract**

Add this test near the widget translation tests:

```js
test('embedded injector caches source-text translation lookup for runtime widget writes', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /QHash<\s*QString\s*,\s*QString\s*>|QHash<QString, QString>/,
    'widget translation lookup should use a QHash cache instead of linearly normalizing every embedded entry for every widget string'
  );
  assert.match(
    injectorSource,
    /rebuildTranslationCache|gTranslationBySource/,
    'injector should build the per-language source text translation cache when the translator is installed'
  );
  assert.match(
    injectorSource,
    /lookupEmbeddedTranslation[\s\S]*gTranslationBySource/,
    'lookupEmbeddedTranslation should consult the cache before falling back to embedded table scanning'
  );
});
```

- [ ] **Step 3: Update diagnostics contract**

Replace the existing diagnostics assertion:

```js
assert.match(
  injectorSource,
  /refreshCount|eventRefreshCount|menuHookCount/,
  'runtime inventory should expose refresh and hook counters so weak injection can be diagnosed from artifacts'
);
```

with:

```js
assert.match(
  injectorSource,
  /refreshCount|menuHookCount|dirtyEnqueueCount|dirtyDrainCount|dirtyObjectTranslateCount/,
  'runtime inventory should expose full-refresh, menu-hook, and dirty-object counters so weak injection and runtime event behavior can be diagnosed from artifacts'
);
```

- [ ] **Step 4: Run the contract test and confirm red**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected: FAIL. The failure should mention missing dirty object queue symbols such as `enqueueRuntimeObject`, `translateRuntimeObject`, or missing `QHash` cache.

- [ ] **Step 5: Commit the failing contracts**

```bash
git add tools/check_app_contracts.js
git commit -m "test: require local runtime UI translation path"
```

---

### Task 2: Add Per-Language Source Text Translation Cache

**Files:**

- Modify: `injector/CavalryTranslatorInjector.mm`
- Test: `tools/check_app_contracts.js`

- [ ] **Step 1: Add Qt containers include**

In `injector/CavalryTranslatorInjector.mm`, add these includes after the existing Qt includes:

```cpp
#include <qhash.h>
#include <qvector.h>
```

- [ ] **Step 2: Add cache globals**

Near the existing globals `gRefreshCount` and `gEventRefreshCount`, add:

```cpp
QHash<QString, QString> gTranslationBySource;
QString gTranslationCacheLang;
```

- [ ] **Step 3: Add cache rebuild function**

Place this function after `normalizeMenuText()` and before `lookupEmbeddedTranslation()`:

```cpp
void rebuildTranslationCache(const QString &lang)
{
    gTranslationBySource.clear();
    gTranslationCacheLang.clear();

    int count = 0;
    const TranslationEntry *entries = entriesForLanguage(lang, &count);
    if (entries == nullptr) {
        return;
    }

    for (int index = 0; index < count; ++index) {
        const QString source = normalizeMenuText(QString::fromUtf8(entries[index].sourceText));
        const QString translation = QString::fromUtf8(entries[index].translation);
        if (!source.isEmpty() && !translation.isEmpty()) {
            gTranslationBySource.insert(source, translation);
        }
    }

    gTranslationCacheLang = lang;
}
```

- [ ] **Step 4: Update lookupEmbeddedTranslation**

Replace `lookupEmbeddedTranslation()` with:

```cpp
QString lookupEmbeddedTranslation(const QString &lang, const QString &sourceText)
{
    const QString normalizedSource = normalizeMenuText(sourceText);
    if (normalizedSource.isEmpty()) {
        return QString();
    }

    if (gTranslationCacheLang == lang && !gTranslationBySource.isEmpty()) {
        const auto cached = gTranslationBySource.constFind(normalizedSource);
        if (cached != gTranslationBySource.constEnd()) {
            return cached.value();
        }
        return QString();
    }

    int count = 0;
    const TranslationEntry *entries = entriesForLanguage(lang, &count);
    if (entries == nullptr) {
        return QString();
    }

    for (int index = 0; index < count; ++index) {
        const QString candidate = normalizeMenuText(QString::fromUtf8(entries[index].sourceText));
        if (candidate == normalizedSource) {
            return QString::fromUtf8(entries[index].translation);
        }
    }

    return QString();
}
```

- [ ] **Step 5: Build the cache during install**

In `installTranslator()`, after the translator is installed and before `translateQtMenuBar(lang)`, add:

```cpp
    rebuildTranslationCache(lang);
```

The call belongs after this block succeeds:

```cpp
    if (gTranslator == nullptr) {
        if (!dumpOnlyEnglish) {
            gTranslator = new EmbeddedTranslator(lang, app);
            app->installTranslator(gTranslator);
        }
    }
```

Do not call `rebuildTranslationCache()` in English dump-only mode because `entriesForLanguage("en")` intentionally returns `nullptr`.

- [ ] **Step 6: Run contract test**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected: translation cache assertions PASS; dirty queue assertions still FAIL.

- [ ] **Step 7: Commit cache implementation**

```bash
git add injector/CavalryTranslatorInjector.mm
git commit -m "perf: cache embedded widget translations"
```

---

### Task 3: Replace Event-Driven Full Refresh With Dirty Object Queue

**Files:**

- Modify: `injector/CavalryTranslatorInjector.mm`
- Test: `tools/check_app_contracts.js`

- [ ] **Step 1: Add QEvent include**

Add this include near the existing Qt includes:

```cpp
#include <qevent.h>
```

- [ ] **Step 2: Replace full-refresh pending state with dirty queue state**

Replace these globals:

```cpp
bool gRefreshPending = false;
QObject *gEventFilter = nullptr;
int gRefreshCount = 0;
int gEventRefreshCount = 0;
```

with:

```cpp
struct DirtyObject {
    QObject *key;
    QPointer<QObject> object;
};

QObject *gEventFilter = nullptr;
QVector<DirtyObject> gDirtyObjects;
QSet<QObject *> gDirtyObjectSet;
bool gDirtyDrainScheduled = false;
int gRefreshCount = 0;
int gDirtyEnqueueCount = 0;
int gDirtyDrainCount = 0;
int gDirtyObjectTranslateCount = 0;
```

Also replace the old delay constant:

```cpp
constexpr int kCoalescedRefreshDelayMs = 75;
```

with:

```cpp
constexpr int kDirtyDrainMaxObjects = 32;
```

- [ ] **Step 3: Add forward declarations**

Replace:

```cpp
void scheduleRefreshAttempts(QString lang);
void scheduleCoalescedRefresh(QString lang);
```

with:

```cpp
void scheduleRefreshAttempts(QString lang);
void enqueueRuntimeObject(QObject *object, const QString &lang);
void scheduleDirtyObjectDrain(QString lang);
void translateRuntimeObject(QObject *object, const QString &lang);
```

- [ ] **Step 4: Add local runtime translation entry point**

Add this after `refreshQtUiTranslations()` and before `RuntimeUiEventFilter`:

```cpp
void translateRuntimeObject(QObject *object, const QString &lang)
{
    if (object == nullptr || lang.isEmpty()) {
        return;
    }

    QSet<QAction *> seenActions;
    if (QAction *action = qobject_cast<QAction *>(object)) {
        translateQtAction(action, lang);
        ++gDirtyObjectTranslateCount;
        return;
    }

    if (QMenu *menu = qobject_cast<QMenu *>(object)) {
        hookQtMenu(menu, lang);
        translateQtMenu(menu, lang);
        ++gDirtyObjectTranslateCount;
        return;
    }

    if (QWidget *widget = qobject_cast<QWidget *>(object)) {
        translateQtWidgetTexts(widget, lang, seenActions);
        for (QWidget *child : widget->findChildren<QWidget *>(QString(), Qt::FindDirectChildrenOnly)) {
            translateQtWidgetTexts(child, lang, seenActions);
        }
        ++gDirtyObjectTranslateCount;
    }
}
```

- [ ] **Step 5: Add dirty queue functions**

Add these functions after `translateRuntimeObject()`:

```cpp
void drainDirtyObjects(QString lang)
{
    int processed = 0;
    while (!gDirtyObjects.isEmpty() && processed < kDirtyDrainMaxObjects) {
        DirtyObject entry = gDirtyObjects.takeFirst();
        gDirtyObjectSet.remove(entry.key);
        if (!entry.object.isNull()) {
            translateRuntimeObject(entry.object.data(), lang);
        }
        ++processed;
    }

    ++gDirtyDrainCount;
    if (!gDirtyObjects.isEmpty()) {
        dispatch_async(dispatch_get_main_queue(), ^{
            drainDirtyObjects(lang);
        });
        return;
    }

    gDirtyDrainScheduled = false;
}

void scheduleDirtyObjectDrain(QString lang)
{
    if (lang.isEmpty() || gDirtyDrainScheduled) {
        return;
    }

    gDirtyDrainScheduled = true;
    dispatch_async(dispatch_get_main_queue(), ^{
        drainDirtyObjects(lang);
    });
}

void enqueueRuntimeObject(QObject *object, const QString &lang)
{
    if (object == nullptr || lang.isEmpty() || gDirtyObjectSet.contains(object)) {
        return;
    }

    const bool isRelevantObject = qobject_cast<QWidget *>(object) != nullptr ||
        qobject_cast<QAction *>(object) != nullptr ||
        qobject_cast<QMenu *>(object) != nullptr;
    if (!isRelevantObject) {
        return;
    }

    gDirtyObjectSet.insert(object);
    gDirtyObjects.append(DirtyObject{ object, QPointer<QObject>(object) });
    ++gDirtyEnqueueCount;
    scheduleDirtyObjectDrain(lang);
}
```

- [ ] **Step 6: Rewrite RuntimeUiEventFilter event handling**

Replace the body of `RuntimeUiEventFilter::eventFilter()` with:

```cpp
    bool eventFilter(QObject *watched, QEvent *event) override
    {
        if (watched == nullptr || event == nullptr || m_lang.isEmpty()) {
            return QObject::eventFilter(watched, event);
        }

        switch (event->type()) {
        case QEvent::Show:
        case QEvent::ActionAdded:
            enqueueRuntimeObject(watched, m_lang);
            break;
        case QEvent::ChildAdded: {
            QChildEvent *childEvent = static_cast<QChildEvent *>(event);
            enqueueRuntimeObject(childEvent->child(), m_lang);
            break;
        }
        default:
            break;
        }

        return QObject::eventFilter(watched, event);
    }
```

- [ ] **Step 7: Remove scheduleCoalescedRefresh full-refresh function**

Delete the full function:

```cpp
void scheduleCoalescedRefresh(QString lang)
{
    if (lang.isEmpty() || gRefreshPending) {
        return;
    }

    gRefreshPending = true;
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(kCoalescedRefreshDelayMs) * NSEC_PER_MSEC),
        dispatch_get_main_queue(),
        ^{
            ++gEventRefreshCount;
            refreshQtUiTranslations(lang);
            dispatch_after(
                dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(kCoalescedRefreshDelayMs) * NSEC_PER_MSEC),
                dispatch_get_main_queue(),
                ^{
                    gRefreshPending = false;
                }
            );
        }
    );
}
```

After this deletion, `rg -n "scheduleCoalescedRefresh|gRefreshPending|gEventRefreshCount|kCoalescedRefreshDelayMs" injector/CavalryTranslatorInjector.mm` should return no matches.

- [ ] **Step 8: Run contract test**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected: runtime dirty-object assertions PASS; diagnostics assertions may still FAIL until Task 4 updates inventory fields.

- [ ] **Step 9: Commit dirty queue implementation**

```bash
git add injector/CavalryTranslatorInjector.mm
git commit -m "fix: translate runtime Qt events locally"
```

---

### Task 4: Update Runtime Diagnostics And Build

**Files:**

- Modify: `injector/CavalryTranslatorInjector.mm`
- Test: `tools/check_app_contracts.js`
- Build: `injector/libCavalryTranslatorInjector.dylib`

- [ ] **Step 1: Replace inventory diagnostics counters**

In `dumpQtMenuInventory()`, replace:

```objc
        @"diagnostics" : @{
            @"refreshCount" : @(gRefreshCount),
            @"eventRefreshCount" : @(gEventRefreshCount),
            @"menuHookCount" : @(gHookedMenus.size()),
        },
```

with:

```objc
        @"diagnostics" : @{
            @"refreshCount" : @(gRefreshCount),
            @"menuHookCount" : @(gHookedMenus.size()),
            @"dirtyEnqueueCount" : @(gDirtyEnqueueCount),
            @"dirtyDrainCount" : @(gDirtyDrainCount),
            @"dirtyObjectTranslateCount" : @(gDirtyObjectTranslateCount),
        },
```

- [ ] **Step 2: Run focused contract test**

Run:

```bash
node --test tools/check_app_contracts.js
```

Expected: PASS for all injector contract tests.

- [ ] **Step 3: Build injector**

Run:

```bash
npm run build:injector
```

Expected: command prints `Built translator injector -> injector/libCavalryTranslatorInjector.dylib` or the configured output path, and exits 0.

- [ ] **Step 4: Commit diagnostics and build-ready code**

```bash
git add injector/CavalryTranslatorInjector.mm tools/check_app_contracts.js
git commit -m "chore: expose dirty runtime UI diagnostics"
```

---

### Task 5: Live Performance Verification

**Files:**

- Read: `tools/launch_cavalry_with_injector.sh`
- Runtime artifact: `$HOME/Library/Caches/Cavalry-i18n/repro-*/session/runtime/zh-Hans-injector-inventory.json`

- [ ] **Step 1: Launch a copied Cavalry app**

Run:

```bash
SESSION_ROOT="$HOME/Library/Caches/Cavalry-i18n/repro-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SESSION_ROOT"
ditto /Applications/Cavalry.app "$SESSION_ROOT/Cavalry.app"
bash tools/launch_cavalry_with_injector.sh \
  --app "$SESSION_ROOT/Cavalry.app" \
  --lang zh-Hans \
  --session-dir "$SESSION_ROOT/session" 2>&1 | tee "$SESSION_ROOT/launch.out"
PID="$(awk -F= '/^PID=/{print $2}' "$SESSION_ROOT/launch.out")"
test -n "$PID"
```

Expected: `test -n "$PID"` exits 0.

- [ ] **Step 2: Check CPU after 60 seconds**

Run in the same shell used for Step 1:

```bash
sleep 60
ps -p "$PID" -o pid,stat,%cpu,%mem,time,command
```

Expected: CPU is not persistently near `100.0`. A brief spike during startup is acceptable; sustained `~100%` after 60 seconds fails this task.

- [ ] **Step 3: Capture sample after warmup**

Run:

```bash
sample "$PID" 5 -file "$SESSION_ROOT/cavalry-after60.sample.txt"
rg -n "scheduleCoalescedRefresh|refreshQtUiTranslations|translateQtWidgets|drainDirtyObjects|translateRuntimeObject" \
  "$SESSION_ROOT/cavalry-after60.sample.txt" -C 3
```

Expected:

- No stack contains `scheduleCoalescedRefresh → refreshQtUiTranslations → translateQtWidgets`.
- If runtime events are active, stacks may contain `drainDirtyObjects` or `translateRuntimeObject`.

- [ ] **Step 4: Inspect diagnostics artifact**

Run:

```bash
SESSION_ROOT_FOR_PY="$SESSION_ROOT" python3 - <<'PY'
import json
from pathlib import Path
session_root = Path(__import__('os').environ.get('SESSION_ROOT_FOR_PY', ''))
session = session_root / 'session/runtime/zh-Hans-injector-inventory.json'
data = json.load(open(session))
print(json.dumps(data.get('diagnostics', {}), ensure_ascii=False, indent=2))
PY
```

Expected: JSON contains `refreshCount`, `menuHookCount`, `dirtyEnqueueCount`, `dirtyDrainCount`, and `dirtyObjectTranslateCount`.

- [ ] **Step 5: Close test app and remove copied app**

Run:

```bash
kill "$PID" 2>/dev/null || true
rm -rf "$SESSION_ROOT/Cavalry.app"
```

Expected: copied app is removed; sample and session artifacts remain for evidence.

- [ ] **Step 6: Leave verification artifacts unstaged**

Run:

```bash
git status --short
```

Expected: no copied app appears in git status. Sample files remain under `$HOME/Library/Caches/Cavalry-i18n/repro-*`, outside the repository.

---

## Rollback Plan

If dirty-object local translation fails to build or causes worse runtime behavior:

1. Revert the implementation commits from Tasks 2-4.
2. Keep Task 1 contract commit only if the next implementation still targets local runtime translation.
3. Emergency product-safe rollback is to remove event filter installation entirely, accepting possible late-created QWidget untranslated text until local translation is fixed.

Emergency code rollback target:

```cpp
// installTranslator() success path should not call installRuntimeUiEventFilter(lang)
```

This emergency rollback removes the infinite full-scan trigger but may miss dynamic non-menu widget translations after warmup.

---

## Self-Review

- Spec coverage: the plan covers sample-proven CPU root cause, translation lookup cost, dynamic panel coverage, contract changes, build, live verification, and rollback.
- Placeholder scan: passed; all implementation steps include exact target files, commands, or code snippets.
- Type consistency: function names are consistent across tasks: `rebuildTranslationCache`, `lookupEmbeddedTranslation`, `translateRuntimeObject`, `enqueueRuntimeObject`, `scheduleDirtyObjectDrain`, and `drainDirtyObjects`.
- Scope check: this is one subsystem, `injector/CavalryTranslatorInjector.mm`, plus its existing contract tests. It does not include unrelated translation quality or UI coverage work.
