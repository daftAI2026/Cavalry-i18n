<!--
[INPUT]: 依赖 injector/CavalryTranslatorInjector.mm 的 item model dump、QuickAdd 空项修剪、tools/check_app_contracts.js 的回归合同，以及 /Applications/Cavalry.app 的 live capture 证据
[OUTPUT]: 对外提供 Add Layers 空白卡片、标签空白与 Time Editor 保护线的审计报告和后续排查准则
[POS]: docs/audits 的 dated runtime 审计记录，沉淀一次从截图症状到 Qt model 证据链的真实修复经验
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Add Layers Runtime Model Capture — 2026-05-20

## 结论

Add Layers 顶部空白卡片不是字体问题，也不是简单的 nodeStrings 漏翻。真实现场是 `QuickAddWindow` 里的 `QListWidget` 出现了空标题 item：`DisplayRole` / `EditRole` 都是空 `QString`。普通 AX 抓取看不到它，常规 QWidget 文本抓取也不会展开 item model，所以只看截图会一直误判。

本次修复选择运行时定点处理：只在 `QuickAddWindow` 祖先链下修剪空标题 `QListWidgetItem`。这比删除 `nodeStrings` 条目更稳，因为它处理的是最终 UI 模型里的坏行，不假设坏行一定来自某个 JSON 文件。

## 证据链

1. 先确认 `/Applications/Cavalry.app` 实际加载的是当前资源和当前 injector。
2. 截图只截 Cavalry 窗口，不用全屏坐标猜控件来源。
3. 用 `widgetAt(cursor)` 确认 Add Layers 面板是 Qt 自绘窗口，不是 Time Editor。
4. 启用 `CAVALRY_I18N_DUMP_ITEM_MODELS=1` 后，`runtime/*-injector-inventory.json` 会额外写入 `itemModels`。
5. `itemModels` 里可以看到 `QuickAddWindow` 下的 `QListWidget` 行模型；问题行的显示角色为空，而不是 CJK 渲染失败。
6. 同一轮检查还发现 Add Layers 标签 chip 依赖 `Definitions/nodeDefinitions.json.tags` 的英文分类 token。把 tags 翻成中文/日文会让 tag chip 变黑或空白。

## 修复边界

已落地的边界：

- `nodeStrings.json` 的 `niceName` 不批量改回中文，避免 Time Editor 右侧 Latin-only 自绘条再出现 `???` / 空白。
- `Definitions/nodeDefinitions.json.tags` 保持英文 source token，例如 `Distribution`、`Spiral`、`Bezier`。
- Add Layers 空行只在 `QuickAddWindow` 作用域删除，不全局清理所有空 `QListWidgetItem`。
- 左侧树、属性编辑器标题、浮动标题继续走 injector 的 Qt 显示层翻译。

不要做的事：

- 不要凭“nodeStrings 里看起来像旧节点”就删除条目。
- 不要把 Definitions 当翻译表；它也是 Cavalry 分类和筛选逻辑的数据源。
- 不要用截图里的一个空白项反推全局翻译策略。

## 验证

本次修复的最低验证组合：

```bash
npm run build:injector
npm run test:contracts
codesign --verify --deep --strict /Applications/Cavalry.app
```

视觉 canary：

- Add Layers 面板顶部不再出现空标题卡片。
- `基本线` / `基本形状` 等条目的右侧标签 chip 不再是空黑块。
- Time Editor 右侧 item 名仍保持英文，例如 `Camera`、`Particle Shape`、`Forge Dynamics`。
- 属性编辑器和左侧树仍可显示中文显示层翻译。

## 后续排查准则

遇到“截图可见但抓取不到”的 UI，先按显示路径分流：

| 现场 | 首选证据 | 处理方式 |
| --- | --- | --- |
| QLabel / QAction / QLineEdit | `widgetTexts` | 补 `tools/*.ts` 或 injector 写回 |
| QListWidget / QTreeWidget 行 | `itemModels` | 查角色值与 parentChain，不要只看 AX |
| Time Editor 条带 | 视觉 canary + model guard | 保持模型名英文，避免 CJK 自绘失败 |
| Viewport / panel overlay | `strings` / ExtensionLayer 二进制 | 不在 Qt 表里硬补 |
| 短 token 噪声 | provenance triage | 无来源证据先 quarantine |

## 文档分类建议

当前 `docs/` 可以按用途分四层看：

| 类别 | 位置 | 当前判断 |
| --- | --- | --- |
| 规范 | `translation-guidelines.md`、`cavalry-glossary.md` | 当前有效，不归档 |
| 操作流程 | `runtime-ui-live-capture-workflow.md`、`runtime-translation-noise-triage.md` | 当前有效，不归档 |
| 阶段报告 | `docs/audits/*.md`、`code-review-report.md` | 新报告放 `audits/`；`code-review-report.md` 仍被 changelog 引用，暂不移动 |
| 历史证据 | `docs/archive/*`、早期 workflow runs | 已归档或只读参考 |

暂不建议移动现有根目录文档。真正需要归档的标准应该是：文档描述的执行路径已经不再有效，且没有被 changelog、工作流或当前 CLAUDE 地图引用。否则只在分类报告里标注，不直接搬文件。
