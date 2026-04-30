<!--
[INPUT]: Acceptance.md §P5、Runbook.md Anti-Bypass Rule、Anti-Patterns.md Counterfeit Form、archive/cavalry-full-ui-100-v2-invalidated-20260428 污染样本
[OUTPUT]: §P5 Forbidden-Translation Patterns detector 的契约测试集合
[POS]: full-ui-100 反伪翻译契约
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Forbidden-Translation Contract — §P5 反伪翻译契约

> 本契约规定 `tools/check_runtime_ui_coverage.js` / `tools/validate_translations.py` / `tools/verify_gate_inputs.js` 在面对历史污染样本时 **必须 fail**。

## 适用范围

| Surface | 路径 | detector |
| --- | --- | --- |
| Runtime inventory | `~/Library/Caches/Cavalry-i18n/sessions/<uuid>/runtime/<lang>-merged-inventory.json` | `tools/check_runtime_ui_coverage.js` |
| Compiled source-map / audit result | `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json` 及其审计输出 | `tools/verify_gate_inputs.js` |
| Derived injector translation output | `desktop-patcher/injector/generated_translations.inc` | `tools/validate_translations.py` |
| Qt translation source | `tools/zh-Hans.ts` / `tools/zh-Hant.ts` / `tools/ja_JP.ts` | `tools/validate_translations.py` |
| JSON 资产 | `languages/<lang>/**.json` | `tools/validate_translations.py` |
| Pre-flight | 上述全部 | `tools/verify_gate_inputs.js` |

## Forbidden Pattern 一览

| ID | 判定 | 说明 |
| --- | --- | --- |
| FP-1 | `（译）` / `（訳）` / `（譯）` | 占位标记 |
| FP-2 | `[\uFF21-\uFF3A\uFF41-\uFF5A]` | 全角拉丁字母 |
| FP-3 | `^(?:页|頁|ページ):?\d+$` | 错位填词 |
| FP-4 | zh-Hant 中出现典型简体字符 | 简繁串味 |
| FP-5 | zh-Hans 中出现典型繁体字符 | 繁简串味 |
| FP-6 | source / translation 构成自我递归伪条目 | 伪翻译 |

## 正向契约

以下样本必须 fail：

1. `上传预设管理器（译）` → FP-1
2. `ＲＧＢ` / `Ａｌｐｈａ` → FP-2
3. `页:1` / `頁:2` / `ページ3` → FP-3
4. zh-Hant 中的简体字符 → FP-4
5. zh-Hans 中的繁体字符 → FP-5
6. `source == translation + forbidden suffix` → FP-6

## 反向回归

archive 污染样本必须 100% 命中，干净 main 样本必须零误报。

运行时 inventory 只允许使用 `sessions/<uuid>/runtime/` 下的样本；根目录 cache inventory 不属于合法测试输入。

## 位置约束

- 本契约文档 = 真相源
- detector 实现 = `tools/check_runtime_ui_coverage.js`、`tools/validate_translations.py`、`tools/verify_gate_inputs.js`
- 实现与契约冲突时，以本契约与 `Acceptance.md` 为准
