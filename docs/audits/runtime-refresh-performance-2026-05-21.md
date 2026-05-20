<!--
[INPUT]: 依赖 injector/CavalryTranslatorInjector.mm 的 runtime event filter、dirty-object queue、menu aboutToShow hook、full refresh 与 runtime inventory 导出路径，以及 Codex thread 019e46b0-ff93-74a3-9f81-0291ad0c7ca1 的讨论上下文
[OUTPUT]: 对外提供点击闪烁/运行时刷新性能问题的根因报告、算法方案与后续实施边界
[POS]: docs/audits 的 dated runtime 性能审计记录，供 docs/roadmap/runtime-refresh-performance.md 引用为决策依据
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Runtime Refresh Performance Audit — 2026-05-21

## 结论

用户看到“点击一下整个软件闪一下”，主要不是机器性能问题，而是 runtime 翻译调度范围过大。当前 injector 已经有局部 dirty-object 队列，但普通交互事件仍会触发 100ms debounce 后的全局刷新。全局刷新会遍历菜单、`QApplication::allWidgets()`、native menu，并写出 runtime inventory；这些动作集中在主线程执行时，会造成可见重绘和短暂闪烁。

机器性能会放大或减轻体感，但根因是算法策略：交互路径把“局部新对象翻译”“全局兜底刷新”“审计 inventory 导出”混在一起。

## 当前证据

代码里的关键路径：

- `refreshQtUiTranslations(lang)` 会执行 `hookQtMenus`、`translateQtMenuBar`、`translateQtWidgets`、`refreshNativeMenuBar`、`dumpQtMenuInventory`。
- `translateQtWidgets(lang)` 会扫描 `QApplication::allWidgets()`。
- `scheduleInteractiveRefresh(lang)` 在 100ms 后调用 `refreshQtUiTranslations(lang)`。
- `RuntimeUiEventFilter` 在 `Show`、`ActionAdded`、`MouseButtonRelease`、`ChildAdded` 中既 enqueue dirty object，又 schedule interactive full refresh。
- `drainDirtyObjects(lang)` 处理完局部队列后仍会调用 `dumpQtMenuInventory(lang)`。

合同测试也暴露了路线矛盾：

- `embedded injector handles runtime Qt events with dirty-object local translation only` 要求 runtime events 走 dirty-object local translation，不触发 `refreshQtUiTranslations`。
- `QuickAdd runtime pruning removes only empty Add Layer rows` 仍要求 `scheduleInteractiveRefresh` 调用 `refreshQtUiTranslations`，用于 Add Layers 启动后兜底。

这说明当前实现处在“可靠兜底”和“局部刷新”之间，尚未完成性能路线收敛。

## 推荐算法

目标不是让刷新更频繁，而是让刷新只发生在变化所在的局部。

```text
╭──────────────╮
│ Qt Event     │
│ Show/Child…  │
╰──────┬───────╯
       │ enqueue relevant QObject
       ▼
╭──────────────╮       chunked drain       ╭────────────────────╮
│ Dirty Queue  │──────────────────────────▶│ translate object + │
╰──────────────╯                           │ direct children    │
                                           ╰────────────────────╯

╭──────────────╮       aboutToShow          ╭────────────────────╮
│ QMenu        │──────────────────────────▶│ translate current  │
╰──────────────╯                           │ menu tree only     │
                                           ╰────────────────────╯

╭──────────────╮       startup/audit only   ╭────────────────────╮
│ Warmup/Gate  │──────────────────────────▶│ full UI refresh +  │
╰──────────────╯                           │ inventory export   │
                                           ╰────────────────────╯
```

### Phase 1 — 切断交互全局刷新

普通交互事件只 enqueue dirty object，不再调用 `scheduleInteractiveRefresh`。菜单打开继续由 `QMenu::aboutToShow` 翻译当前菜单树。全局 `refreshQtUiTranslations` 只保留给启动 warmup、语言切换或明确 capture/audit 模式。

### Phase 2 — 审计导出加 gate

`dumpQtMenuInventory` 不应在用户普通交互后频繁运行。它应该只在存在 session/capture 环境时启用，例如 `CAVALRY_I18N_SESSION_DIR`、`CAVALRY_I18N_DUMP_ITEM_MODELS` 或新增显式 env。否则 dirty drain 只翻译，不写 JSON。

### Phase 3 — 减少重复写回

在 widget/action/menu 写回前继续保持 `translated != current` 检查，并进一步考虑对象级 property/hash：同一对象、同一语言、同一源文本已处理过时直接跳过。这个阶段收益更细，但能减少布局和 repaint。

### Phase 4 — 分帧预算

dirty queue 已有 `kDirtyDrainMaxObjects` 形态，应保持每轮处理上限。若现场仍闪，可把 drain 调度改成更明确的分帧预算：一次最多处理固定对象数，然后让出主线程，下一轮继续。

## 不建议的方案

- 单纯把 debounce 从 100ms 改成 250/500ms：只能让闪烁延后，不能消除全局扫描成本。
- 每次点击后重扫所有 widgets：可靠但代价太大，是当前可见闪烁的主要来源。
- 把所有翻译预先静态写死到 JSON：会重新污染 Time Editor niceName、ExtensionLayer 自绘层等已知边界。

## 成功标准

1. 普通点击不再触发 `refreshQtUiTranslations`。
2. 菜单打开前仍能翻译当前菜单，不出现明显英文闪现。
3. Add Layers / Attribute Editor 动态生成控件仍能通过 dirty-object path 翻译。
4. runtime inventory 只在 capture/audit 模式写出。
5. contract tests 明确锁定“交互局部刷新、启动/审计全局刷新”的边界。
6. 手动验证时，连续点击 UI 不出现整窗闪烁。

## 后续入口

执行路线记录在 `docs/roadmap/runtime-refresh-performance.md`。本报告只作为问题分析与设计依据，不直接驱动运行时。
