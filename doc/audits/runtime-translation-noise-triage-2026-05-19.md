# Runtime Translation Noise Triage — 2026-05-19

> 排查依据：`doc/runtime-translation-noise-triage.md`  
> 来源基线：`/Applications/Cavalry.app` (Cavalry 2.7.2)  
> 本次仅审计，未修改翻译源。不涉及 languages/*/nodeStrings.json niceName。

---

## 1. 排查 Token 清单

本次排查覆盖 21 个 token，分三组：

### 组 A：`doc/runtime-translation-noise-triage.md` 指名的 5 个核心可疑 token

| # | Source | zh-Hans | zh-Hant | ja_JP | 日语异常 |
|---|--------|---------|---------|-------|---------|
| 1 | Rfr | 发光 | 發光 | ログイン | ✅ (登录，无关) |
| 2 | Rhb 9 | 第9条 | 第9條 | ラフブ 9 | ✅ (无意义音译) |
| 3 | Rht | 调值 | 調值 | ログイン | ✅ (登录，无关) |
| 4 | Rhu | 鲁 | 魯 | ログイン | ✅ (登录，无关) |
| 5 | Ruw | 鲁 | 魯 | ログイン | ✅ (登录，无关) |

### 组 B：同一批量提交带入的 R-prefix 短 token（12 个）

| # | Source | zh-Hans | zh-Hant | ja_JP | 日语异常 |
|---|--------|---------|---------|-------|---------|
| 6 | Riv | 里弗 | 裏弗 | リヴ | — |
| 7 | Riz | 里兹 | 里茲 | ログイン | ✅ (登录，无关) |
| 8 | Rli | 瑞丽 | 瑞麗 | ログイン | ✅ (登录，无关) |
| 9 | Rmo | 罗莫 | 羅莫 | ログイン | ✅ (登录，无关) |
| 10 | Rps | 比例 | 比例 | フィードバック | ✅ (反馈，无关) |
| 11 | Rrn | 转 | 轉 | ログイン | ✅ (登录，无关) |
| 12 | Rrp | 转动 | 轉動 | ログイン | ✅ (登录，无关) |
| 13 | Rta | 常规 | 常規 | ログイン | ✅ (登录，无关) |
| 14 | Rub | 鲁布 | 魯布 | ルック | — |
| 15 | Rvo | 罗沃 | 羅沃 | ログイン | ✅ (登录，无关) |
| 16 | Rxp | 缩写 | 縮寫 | ログイン | ✅ (登录，无关) |
| 17 | Rzn | 兹恩 | 茲恩 | ログイン | ✅ (登录，无关) |

### 组 C：碎片式 token（3 个）

| # | Source | zh-Hans | zh-Hant | ja_JP | 备注 |
|---|--------|---------|---------|-------|------|
| 18 | rksheet H | 工作表高值 | 工作表高值 | ワークシート H | 似 worksheet 截断 |
| 19 | rmk RUK smk | 内部标识九 | 內部識別九 | 内部識別九 | 似内部掩码 |
| 20 | rtm WAM stm | 内部标识十 | 內部識別十 | 内部識別十 | 似内部掩码 |

---

## 2. 证据等级（全部为 C）

对照 `doc/runtime-translation-noise-triage.md` 证据等级定义：

| 等级 | 定义 | 本批次 |
|------|------|--------|
| A | live capture 命中，带 widget/action/menu path | 0/21 token |
| B | Cavalry 原始文本资源命中 (assets/*.json, Definitions, plugin strings) | 0/21 token |
| C | 只在 tools/*.ts 与 generated_translations.inc 命中 | **21/21 token ⬅️ 全部** |
| D | 只在 `rg -a` 二进制/图片/压缩数据里命中 | 0/21 token 符合 |

**All 21 tokens 均为 C 级证据。** 没有任何 token 能在 `languages/*.json`、`Cavalry.app/Contents/assets/`、`Cavalry.app/Contents/Resources/` 等可解析文本资源中找到。

---

## 3. 命中位置

### 3.1 tools/*.ts

| 文件 | 行号范围 | 行数 |
|------|---------|------|
| tools/zh-Hans.ts | 2108–2164 | ~58 行 (含中间正常词条) |
| tools/zh-Hant.ts | 2179–2235 | ~57 行 |
| tools/ja_JP.ts | 3133–3189 | ~57 行 |

### 3.2 injector/generated_translations.inc

| 语言 | 行号范围 | Context |
|------|---------|---------|
| zh-Hans | 1587–1643 | MenuBarManager |
| zh-Hant | 5928–5984 | MenuBarManager |
| ja_JP | 10295–10351 | MenuBarManager |

Context 均为 `{"MenuBarManager", "<source>", "<translation>"}`。

### 3.3 未命中位置（权威来源）

```
languages/en/nodeStrings.json          → 0 match (唯一命中 "Ruby" 为 subword)
languages/en/appStrings.json           → 0 match
languages/zh-Hans/*.json               → 0 match
languages/zh-Hant/*.json               → 0 match
languages/ja_JP/*.json                 → 0 match
output/                                → 0 match
doc/                                   → 仅 triage protocol 自身提及
/Applications/Cavalry.app/Contents/assets/   → 0 match
/Applications/Cavalry.app/Contents/Resources/ → 0 match
/Applications/Cavalry.app/Contents/MacOS/    → 0 match
```

### 3.4 二进制命中（D 级证据，无效来源）

`/Applications/Cavalry.app/Contents/Frameworks/` 下 `libskia.dylib`、`QtWidgets`、`libwebp.dylib` 在 `rg -a` 下出现 `Rht`、`Rhu` 等字节序列。**这属于 D 级证据**——不是可读文本资源，来自二进制压缩数据/字体表/机器码，不能据此翻译。

---

## 4. git blame 来源

| 来源 commit | 日期 | 作者 | 说明 | 可信度 |
|-------------|------|------|------|--------|
| **`8ca19870`** | 2026-05-07 | singkia | `chore(g-x): complete denominator scrub` — 15 files, +15755/−2204 lines | **低** ⬅️ 大批量自动化处理 |
| `3882b806` | 2026-05-08 | singkia | `feat(full-ui): translate cleaned full ui denominator` | **低** — 批量补翻 |

`8ca19870` 同时修改了 `tools/zh-Hans.ts`、`tools/zh-Hant.ts`、`tools/ja_JP.ts`、`injector/generated_translations.inc` 四个翻译源文件。该 commit 的大批量性质与日文翻译中 13 次出现 `ログイン`（登录）的荒谬翻译一致指向**非人工审核的批量 ML 翻译**。

### 确认证据：日语 `ログイン` 污染统计

| 文件 | token 总数 | 翻成 ログイン 的数量 | 占比 |
|------|-----------|-------------------|------|
| ja_JP.ts | 21 | 13 | **62%** |
| generated_translations.inc | 21 | 13 | **62%** |

---

## 5. 最终决策

| Token | 证据等级 | 决策 | 依据 |
|-------|---------|------|------|
| Rfr | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rhb 9 | C | **保持英文，加入 quarantine** | 无资源来源；非 UI 文案 |
| Rht | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rhu | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Ruw | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Riv | C | **保持英文，加入 quarantine** | 无资源来源 |
| Riz | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rli | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rmo | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rps | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rrn | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rrp | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rta | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rub | C | **保持英文，加入 quarantine** | 无资源来源 |
| Rvo | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rxp | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| Rzn | C | **保持英文，加入 quarantine** | 无资源来源；日语 ML 误译 |
| rksheet H | C | **保持英文，加入 quarantine** | 似 worksheet 截断碎片；无资源来源 |
| rmk RUK smk | C | **保持英文，加入 quarantine** | 似内部掩码 token；无资源来源 |
| rtm WAM stm | C | **保持英文，加入 quarantine** | 似内部掩码 token；无资源来源 |

### Quarantine 文件建议

按 triage protocol 推荐，应创建 `tools/runtime-noise-quarantine.json`，将这些 token 列入 `decision: "do_not_translate"`，使生成器跳过它们。

---

## 6. 不能处理的风险和原因

| 风险 | 原因 |
|------|------|
| 无法确认这些 token 的实际来源 | 所有 token 均为 `rg -a` 级碎片或截断片段，在 Cavalry 可解析资源中不存在。可能来自二进制中非文本段、序列化数据或加密资源。 |
| 无法确认这些 token 是否在 UI 中可见 | 没有 live capture widget/path 命中。如果它们在 ExtensionLayer 自绘区域或无法抓取的 Qt 控件中，当前工具链无法探测。 |
| 如果 Cavalry 未来升级暴露这些 token 为真实 UI | 届时需重新做 live capture 确认，再从 quarantine 移出并翻译。当前 quarantine 不删除条目，只阻止生成。 |
| 其他相似 token 可能在后续 denominator 更新中混入 | 需在 `denominator freeze` 和 `generate_embedded_translations.js` 环节加 whitelist/quarantine 对照。 |

---

## 7. `languages/*/nodeStrings.json` niceName 合规声明

**未触碰。** 所有排查和结论仅涉及：

- `tools/zh-Hans.ts`
- `tools/zh-Hant.ts`
- `tools/ja_JP.ts`
- `injector/generated_translations.inc`

未读取、未修改、未引用 `languages/*/nodeStrings.json` 中的任何 niceName 字段。Time Editor 模型名保护线完整。

---

## 8. 验证命令和结果

**本次仅审计，未修改任何代码或翻译表。** 因此不需要运行：

```bash
npm run build:injector
npm run test:contracts
npm run check:app
python3 tools/validate_translations.py ...
```

> 若后续执行 quarantine，上述命令应在生成 `tools/runtime-noise-quarantine.json` 并修改生成器跳过逻辑后运行。

---

## 附录：日语翻译污染全景图

| Source | ja_JP 翻译 | 是否为 ML 垃圾 | 合理翻译 |
|--------|-----------|--------------|---------|
| Rfr | ログイン | ✅ | 保持英文 (无法确定含义) |
| Rhb 9 | ラフブ 9 | ✅ (无意义) | 保持英文 |
| Rht | ログイン | ✅ | 保持英文 |
| Rhu | ログイン | ✅ | 保持英文 |
| Riv | リヴ | — | 保持英文 |
| Riz | ログイン | ✅ | 保持英文 |
| Rli | ログイン | ✅ | 保持英文 |
| Rmo | ログイン | ✅ | 保持英文 |
| Rps | フィードバック | ✅ | 保持英文 |
| Rrn | ログイン | ✅ | 保持英文 |
| Rrp | ログイン | ✅ | 保持英文 |
| Rta | ログイン | ✅ | 保持英文 |
| Rub | ルック | — | 保持英文 |
| Ruw | ログイン | ✅ | 保持英文 |
| Rvo | ログイン | ✅ | 保持英文 |
| Rxp | ログイン | ✅ | 保持英文 |
| Rzn | ログイン | ✅ | 保持英文 |

**13/21 = 62% 的日语翻译是 `ログイン`（"登录"）。** 这个模式强烈指向批次 AI 翻译时将无法识别的 token 全部替换为相同的占位值。
