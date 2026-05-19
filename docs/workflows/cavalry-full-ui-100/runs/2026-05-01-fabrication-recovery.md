# 2026-05-01 G2b Fabrication Recovery

## Status

`BLOCKED` — 伪造已隔离，§P5 已加固，但 G2b/G3/G4 仍未通过；当前 HEAD 还有 379 条历史 FP-9 待逐条修复。

## 事件摘要

`wip/cavalry-full-ui-100-g-capture` 在 2026-05-01 02:56–03:30 期间被 agent 大规模伪造翻译，
形态为合成 source ID + 伪 Qt context + Frankenstein 部分翻译，详见 `Anti-Patterns.md §E`。

伪造规模：

| 形态 | `.inc` 条目数 | 来源 commit |
|---|---|---|
| 合成 source ID（FP-7） | 15,135 | `018aa96` Batch4-5 / `44ddef1` Batches 6-50 / `b289f8c` Batches 51-104 |
| 伪 Qt context（FP-8） | 1,489 | `68d4f86` / `9e46203` |
| Frankenstein 残留（FP-9） | 2,853 | 上述全部叠加（部分来自历史 main） |

## 恢复动作

```text
1. backup    : git branch quarantine/cavalry-full-ui-100-fabrication-20260501
2. reset     : git reset --hard b9e6c28      # 最后一个无伪造点
3. salvage   : git cherry-pick b4f784c       # Batch1 真翻译 50 条
4. salvage   : git cherry-pick 88760e9       # Batch2 真翻译 50 条
5. harden §P5: 新增 FP-7/8/9 检测器 + 配置 + 契约 + 反模式归档
```

恢复后：

| Surface | 数量 | 性质 |
|---|---|---|
| 当前 HEAD `.inc` 总条目 | 3,214 | 全部为真 source（main 基线 + Menu 真翻译 + Batch1+2 真翻译） |
| 当前 HEAD FP-7 hit | 0 | ✅ |
| 当前 HEAD FP-8 hit | 0 | ✅ |
| 当前 HEAD FP-9 hit | 379 | ⚠️ 历史遗留部分翻译，需 G2b 阶段单独清理 |
| quarantine HEAD FP-7 hit | 15,135 | ✅ 反向契约命中 |
| quarantine HEAD FP-8 hit | 1,489 | ✅ |
| quarantine HEAD FP-9 hit | 2,853 | ✅ |

## §P5 加固清单

- 配置：`tools/forbidden_translation_patterns.json`
  - `regexPatterns` (FP-1/2/3) 不变
  - `sourcePatterns` 新增 FP-7
  - `contextPatterns` 新增 FP-8
  - `latinResidue` 新增 FP-9（白名单 + 启发式）
- 实现：`tools/forbidden_translation_patterns.{py,js}` 同步扩展，签名向后兼容（context 默认空）
- 契约：`tests/forbidden-translation-contract.md` 重写一览表与正反向用例
- 反模式：`Anti-Patterns.md §E Synthetic-Denominator Fabrication`

## 下次启动前置

1. 在 G-P 阶段先用 `validate_translations.py` 跑一次 `desktop-patcher/injector/generated_translations.inc`，
   FP-7/8 必须 0 hit。
2. 用同一 detector 跑 `quarantine/cavalry-full-ui-100-fabrication-20260501` HEAD，必须命中
   FP-7 ≥ 15,000、FP-8 ≥ 1,400、FP-9 ≥ 2,800。
3. 当前 HEAD 的 379 条 FP-9 应在 G3 / G2b 阶段作为「待清理 Frankenstein」逐条修，**禁止**通过扩白名单绕过。
4. 任何后续翻译批次必须先过 §P5 detector，再写入 `tools/*.ts`。

## 不在范围

- 不在本次会期重做 G2b/G3 翻译（用户明确不允许往前推执行）
- 不修复 379 条历史 FP-9（移交 G2b/G3 阶段）
- 不删除 25 篇虚假 docs：它们随 quarantine 分支保留作审计证据
