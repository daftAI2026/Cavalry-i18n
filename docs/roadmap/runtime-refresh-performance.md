<!--
[INPUT]: 依赖 docs/audits/runtime-refresh-performance-2026-05-21.md 的根因报告，以及 injector/CavalryTranslatorInjector.mm 的 dirty-object、aboutToShow、full refresh 与 inventory 导出路径
[OUTPUT]: 对外提供 Runtime 刷新性能优化 roadmap，记录后续实施阶段、验收标准与风险边界
[POS]: docs/roadmap 的 runtime 性能主题入口，链接 audit 事实报告并为后续实现计划提供范围
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Runtime Refresh Performance Roadmap

状态: Proposed  
问题: 点击或打开动态 UI 时，用户可见整窗闪烁，能感知到 runtime 注入刷新过程。  
依据: [`docs/audits/runtime-refresh-performance-2026-05-21.md`](../audits/runtime-refresh-performance-2026-05-21.md)

## 目标

让普通交互不触发全局 UI refresh。菜单打开只处理当前菜单，动态 widget 只处理 dirty object，全局扫描与 runtime inventory 导出只在启动、语言切换或显式审计模式运行。

## 非目标

- 不改变翻译表内容。
- 不回滚 Time Editor niceName 英文保护。
- 不用更长 debounce 伪装问题。
- 不删除 live capture / inventory 能力，只把它移出普通交互路径。

## 阶段

### R1 — 收敛合同测试

状态: Not started

把现有 contract 中的矛盾收敛成同一条规则：runtime events 只能 enqueue dirty object，不能触发 full `refreshQtUiTranslations`。Add Layers 的动态补翻译必须由 dirty-object path 或菜单 aboutToShow path 覆盖，而不是依赖交互后的全局扫描。

验收:

- contract 明确禁止 `eventFilter -> scheduleInteractiveRefresh -> refreshQtUiTranslations`。
- contract 保留 Add Layers 空 item pruning 与动态标签翻译保护。
- contract 明确 full refresh 只允许启动 warmup / audit capture 使用。

### R2 — 移除普通交互全局刷新

状态: Not started

从 `RuntimeUiEventFilter` 的普通事件路径移除 `scheduleInteractiveRefresh(m_lang)`。`Show`、`ActionAdded`、`MouseButtonRelease`、`ChildAdded` 只 enqueue 相关 QObject；菜单仍通过 `aboutToShow` 处理当前菜单树。

验收:

- 普通点击不增加 `gRefreshCount`。
- dirty enqueue/drain counters 正常增加。
- 动态 Attribute Editor 标签仍能翻译。
- Add Layers 空白卡片 pruning 仍生效。

### R3 — Runtime inventory 导出 gate

状态: Not started

把 `dumpQtMenuInventory(lang)` 从普通 dirty drain 末尾移出，或加显式 capture env gate。用户正常运行时不写 JSON；`run_live_full_ui_matrix.js`、dump-only、item model capture 仍能写出完整 inventory。

验收:

- 无 capture env 时，普通点击不写 runtime inventory。
- 有 session/capture env 时，live capture 产物保持同构。
- full-ui gate 不退化为 weak capture。

### R4 — 重复写回规避

状态: Not started

在已有 `translated != current` 检查基础上，评估是否给 QObject 写入轻量 property/hash，记录最近一次处理的语言与源文本。源文本未变时跳过 setText/setTitle，降低 repaint/layout 成本。

验收:

- 重复点击同一 UI 时 dirty-object translate count 可增加，但实际 write-back 次数下降。
- QLineEdit signal-blocked 写回仍不污染模型值。
- Time Editor item model 英文保护不受影响。

### R5 — 现场验证

状态: Not started

在安装态 Cavalry.app 同步 repo injector 后做手动验证和必要的 live capture。

验收:

- repo dylib 与 app dylib hash 一致。
- `codesign --verify --deep --strict /Applications/Cavalry.app` 通过。
- Cavalry 重启后，连续点击普通 UI 不出现整窗闪烁。
- 菜单打开前翻译仍及时。
- `npm run test:contracts` 通过。

## 风险

- 某些动态控件只靠历史 full refresh 才被翻译；R2 后可能暴露遗漏，需要补到 dirty-object path 或更精确的事件 hook。
- capture 能力不能被误删；R3 必须保留显式审计入口。
- 如果 contract 只做源码正则，仍需人工视觉 canary 验证“闪一下”是否改善。

## 下一步

先执行 R1 和 R2。只有当普通交互不再触发全局 refresh 后，再判断是否需要 R4 的对象级 hash。
