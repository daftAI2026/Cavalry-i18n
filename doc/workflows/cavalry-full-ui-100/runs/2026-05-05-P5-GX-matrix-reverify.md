<!--
[INPUT]: 依赖 session B897FF97-D3E1-419C-94BC-38F1158F3BB7、compiled source-map、§P5 validator、quarantine detector 与 full-ui matrix run record
[OUTPUT]: 对外提供 2026-05-05 P5/G-CAPTURE/G-X/G0/G1/G3 复核证据与 G2/G4 失败结论
[POS]: runs 的本轮收口记录，证明 workflow 仍是 NOT COMPLETE 且失败点已推进到真实翻译缺口
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-05-05 P5 / G-X / matrix reverify

## Status

FAIL

## Scope

本轮目标是从 NOT COMPLETE 状态继续推进 `cavalry-full-ui-100`，先重跑基线，再清 §P5 FP-9，随后重新验证 G-P / G-CAPTURE / G-X / G0 / G1，并运行三语 full-ui matrix。

## Baseline

```text
npm run test:desktop
PASS: 85/85

node --test doc/workflows/cavalry-full-ui-100/tests/extraction-inventory-contract.test.js doc/workflows/cavalry-full-ui-100/tests/capture-accessibility-contract.test.js
PASS: 5/5
```

## §P5

Current HEAD 已清零历史 Frankenstein 残留：

```text
python3 tools/validate_translations.py --root .
PASS

forbiddenPatterns.total:
  zh-Hans = 0
  zh-Hant = 0
  ja_JP   = 0
```

同步项：
- JSON 语言包修复：`languages/zh-Hans`、`languages/zh-Hant`、`languages/ja_JP`
- compiled TS 翻译源修复：`tools/zh-Hans.ts`、`tools/zh-Hant.ts`、`tools/ja_JP.ts`
- generated table 已由 `node tools/generate_embedded_translations.js` 同步
- 复用已通过 §P5 的 JSON exact source→translation 到 TS：zh-Hans 311、zh-Hant 335、ja_JP 324
- 手工补齐 runtime node/filter/example 译文：zh-Hans 109、zh-Hant 120、ja_JP 123

Quarantine 反向回归仍命中：

```text
quarantine/cavalry-full-ui-100-fabrication-20260501
FP-7 = 30270
FP-8 = 2978
FP-9 = 5833
```

## G-CAPTURE

有效 session：

```text
SESSION_DIR=~/Library/Caches/Cavalry-i18n/sessions/B897FF97-D3E1-419C-94BC-38F1158F3BB7
target=Cavalry 2.7.1 / Qt 6.6.3
bundleHash=a421e0137648bbd284b6e7976a119ae27ba6ada635e0706b76519b54fa7c7fe1
```

Runtime live evidence:

```text
en      pid=44870 candidates=626 menuLeaves=734
zh-Hans pid=45868 candidates=626 menuLeaves=734
zh-Hant pid=46438 candidates=626 menuLeaves=734
ja_JP   pid=47504 candidates=626 menuLeaves=734
menuDepthMax=4
submenuPathSamples=5
capture.source=live-merged
```

弱抓取回归：
- session `6696676F-429B-45D1-A805-53A74EA49C57` 暴露 launcher PID 解析 bug，已用 contract test 固定。
- session `A765AC29-F2C4-42B0-BDD1-39EC8CFC8F14` 与 `05C0425C-9286-4EB2-9805-21F6CAB1A450` 因 Cavalry 未进入完整 UI 导致 0 candidates / 0 menu leaves；当前编排器已 hard-fail `WEAK-CAPTURE`，不得作为 PASS 证据。

## G-X

Frozen extraction inventory:

```text
path=~/Library/Caches/Cavalry-i18n/sessions/B897FF97-D3E1-419C-94BC-38F1158F3BB7/extraction-inventory.json
frozenAtUtc=2026-05-05T05:12:45Z
jsonTotal=6415
compiledSourceMapEntries=5195
runtimeCandidates=626
runtimeMenuLeaves=734
```

Top-level target is present:

```text
cavalryVersion=2.7.1
qtVersion=6.6.3
bundleHash=a421e0137648bbd284b6e7976a119ae27ba6ada635e0706b76519b54fa7c7fe1
appPath=/Applications/Cavalry.app
```

## Matrix Result

```text
SESSION_DIR="$SESSION_DIR" npm run check:full-ui
EXIT: 1
overallPass=false
blockedReason=One or more language runs failed.
```

G1 JSON:

```text
zh-Hans PASS, forbiddenPatterns=0
zh-Hant PASS, forbiddenPatterns=0
ja_JP   PASS, forbiddenPatterns=0
```

G2 compiled UI:

```text
zh-Hans 18.15%, untranslated=4026
zh-Hant 15.51%, untranslated=4156
ja_JP   17.22%, untranslated=4072
```

G3 runtime UI:

```text
zh-Hans 100%, untranslated=0
zh-Hant 100%, untranslated=0
ja_JP   100%, untranslated=0
```

## Conclusion

Current workflow state remains **NOT COMPLETE**.

PASS evidence now covers W-AUDIT, G-P, §P5, G-CAPTURE, G-X, G0, G1 and G3. The first real blocker is G2 compiled translation backlog. G4 cannot pass until zh-Hans / zh-Hant / ja_JP compiled coverage also reaches 100% in the same matrix run.
