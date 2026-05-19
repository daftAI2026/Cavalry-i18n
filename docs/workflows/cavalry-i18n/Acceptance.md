<!--
[INPUT]: 依赖 Project.md 的里程碑定义、plan-v3.md 的技术规格、translation-guidelines.md 的翻译约束
[OUTPUT]: 对外提供每个 gate 的通过/失败条件，作为验收判定依据
[POS]: cavalry-i18n 工作流的验收标准文档
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Acceptance — Cavalry i18n 验收标准

---

## M1 Content Ready Gate

### 通过条件

- [ ] `docs/cavalry-glossary.md` 有四列（en / zh-Hans / zh-Hant / ja_JP），>= 78 行数据，无空单元格。
- [ ] 简繁差异对存在：保存→儲存、文件→檔案、默认→預設、视频→影片、程序→程式、信息→資訊。
- [ ] 不翻译项在所有列保持英文：Cavalry、Canva、Lottie、RGB、JSON、FPS、GPU。
- [ ] `LanguageSwitcher_assets/languages/en/` 下有 `nodeStrings.json`、`appStrings.json`、`tips.json`、`onboarding.json`、`plugins/*.json`，全部合法 JSON，非空。
- [ ] `tools/extract_strings.py` 存在。
- [ ] `docs/translation-whitelist.json` 存在，合法 JSON，覆盖所有文件类型，每个类型有 `translate` + `no_translate` 列表。
- [ ] `LanguageSwitcher_assets/languages/zh-Hans/`、`zh-Hant/`、`ja_JP/` 各目录 JSON 文件数 = `en/` 文件数。
- [ ] 所有翻译 JSON 可解析，key 结构与 `en/` 一致。
- [ ] 白名单中 `no_translate` 字段 value 与 `en/` 一致。
- [ ] 术语抽查 >= 70% 匹配 glossary。
- [ ] 占位符（`{0}`、`%1`、`{{...}}`）全部保留。
- [ ] `tools/zh-Hans.ts`、`zh-Hant.ts`、`ja_JP.ts` 为合法 Qt Linguist XML。
- [ ] 每个语言目录下 `cavalry_*.qm` 和 `qtbase_*.qm` 存在且 size > 0。
- [ ] **零英文残留 UI 词**：whitelist 标记 `translate` 的叶子字符串中，不得残留未批准英文词片段；带空格的半翻译也算 FAIL（B9）。
- [ ] **叶子级翻译覆盖率**：whitelist 标记 `translate` 的叶子字符串，>= 90% 与英文原文不同；禁止按整个 `attributes/enums` 容器对象统计（B10）。
- [ ] **语言代码同步**：所有翻译 JSON 的 `language` 字段值 = 目标运行时代码（`zh-Hans` / `zh-Hant` / `ja_JP`）；workflow alias 不进入产物（B11）。
- [ ] **语言纯度一致性**：`zh-Hans` 不得混入繁体 / 港台 UI 用词，`zh-Hant` 不得混入简体 / 大陆 UI 用词，`ja_JP` 不得混入明显中文 UI 词而缺少对应日文界面术语（B12）。

### 失败条件

- 术语表有空单元格。
- 翻译 JSON 的 key 结构与 `en/` 不一致。
- 不翻译字段被翻译了。
- 术语抽查低于 70%。
- 占位符被翻译或丢失。
- `.qm` 文件缺失或为空。
- **翻译产物存在未批准英文残留**（如 `"滤色Gain"`、`"Export if 可见"`、`"Poly メッシュ"`）。
- **translate 分支叶子字符串覆盖率 < 90%**，或覆盖率算法只比较容器对象。
- **language 字段未改为目标运行时代码**，或把 workflow alias 误写入产物。
- **任一目标语言存在纯度污染**（如 `zh-Hans` 出现 `"檔案"`，`zh-Hant` 出现 `"开"` / `"在父级上方绘制"`，`ja_JP` 出现 `"图层"` 而非 `"レイヤー"`）。

---

## M2 Switcher Ready Gate

### 通过条件

- [ ] `LanguageSwitcher.js` 存在，`node --check` 无语法错误。
- [ ] 包含 `api.writeToFile`、`api.readFromFile`、`api.getAppAssetsPath`、`api.runDetachedProcess`、`api.getCavalryVersion`、`api.getPlatform`。
- [ ] 使用官方 Script UI `ui` 模块（例如 `ui.DropDown` / `ui.Button`），不得使用 `api.UIWidget`。
- [ ] 运行时语言资源位于 `LanguageSwitcher_assets/languages/`，并通过 `ui.scriptLocation` 解析。
- [ ] 包含 macOS 和 Windows 双平台处理。
- [ ] 包含版本检测逻辑（`cavalryVersion`）。
- [ ] 包含 `writeToFile` 错误处理。
- [ ] 覆写文件列表与 `LanguageSwitcher_assets/languages/en/` 一一对应。

### 失败条件

- 缺少任何必需 API 调用。
- 只处理一个平台。
- 没有错误处理。
- 覆写列表不完整。

---

## M3 Release Ready Gate

### 通过条件

- [ ] `.github/workflows/build.yml` 存在，合法 YAML，包含 `lrelease` 步骤、push/PR 触发、artifact/release 上传。
- [ ] `README.md` 包含安装 / 使用 / 语言 / 更新 / License 章节，安装步骤 >= 3 个。
- [ ] `LICENSE` 文件存在。

### 失败条件

- CI 缺 `lrelease` 或 release 步骤。
- README 缺必要章节。
- LICENSE 缺失。

---

## M_manual In-App Verification Gate

手动闸门，不阻塞 M1-M3，但必须记录结果。

- [ ] **M5**: 切中文 → 重启 → 节点名 / 属性名 / Tooltip 变中文；切回英文恢复。
- [ ] **M6**: 菜单栏 / 右键菜单 / 标准按钮被 `.qm` 翻译（不通过则降级为 JSON-only 版本）。
- [ ] **M7**: 全流程矩阵 — 切中 → 切日 → 切英 → 模拟更新 → 首次使用 → 写入失败（6 项全过）。
- [ ] **M8**: UI 溢出检查 — 各语言下检查面板标题、属性名是否因翻译过长导致截断或换行。日文カタカナ术语尤其注意（字符宽度大于英文）。发现溢出时优先用行业标准缩写形式，不得为缩短而自造非标准译法。

---

## Final Delivery Semantics

- `M1 + M2 + M3 = PASS` 且 `M_manual = PENDING/FAIL` 时，只能汇报 **DELIVERY COMPLETE / MANUAL PENDING**。
- 只有 `M1 + M2 + M3 + M_manual = PASS` 时，才能汇报 **ALL GATES PASS**。

---

## Final Artifact Hygiene Review

- [ ] 未跟踪或过程文件已清理，或已明确登记用途（例如 `trans_batch_*.py`、`strings_*.json`、`all_strings.json`、`__pycache__`、`.DS_Store`）。
- [ ] 删除前已确认文件不属于 Source of Truth、构建输入、发布产物或 `runs/` 证据。
- [ ] 无误删：`languages/*`、`tools/*.ts`、`LanguageSwitcher.js`、`README.md`、workflow `runs/*` 保持完整。

---

## Test Commands

每个 gate 收口必须执行的验证命令列表（对应到 `tests/` 下的各个 contract）：

| Gate | 验证命令 | 说明 |
|---|---|---|
| M1 | `tests/gate-check-contract.md` → M1 section | 术语表、JSON 结构、白名单、占位符、.qm 文件 |
| M2 | `tests/gate-check-contract.md` → M2 section | 脚本语法、API 覆盖、双平台、错误处理 |
| M3 | `tests/gate-check-contract.md` → M3 section | CI YAML、README 章节、LICENSE 存在性 |
| M_manual | 手动在 Cavalry 中执行 | 记录到 `runs/` 目录 |
