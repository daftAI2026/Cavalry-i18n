<!--
[INPUT]: 依赖 Step 3 G2/G3 批译探针、/tmp/llm-translation-events/batch-001.jsonl、/tmp/codex-probe20-log.txt 与当前 G-X truth source
[OUTPUT]: 对外提供 G2/G3 LLM batch blocker 的 diagnostic drift note，冻结停止点与下一步恢复条件
[POS]: runs 的 Step 3 阻塞记录，阻止继续换模型/换口径伪造 G2/G3 PASS
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-05-07 G2/G3 — LLM batch diagnostic drift

## Status

BLOCKED

## Scope

- branch: `wip/cavalry-full-ui-100-g-capture`
- active G-X truth source: JSON `6292`, compiled freeze `3190`, runtime candidates `617`, menuLeaves `730`
- effective compiled coverage denominator in `check_full_ui_coverage.js`: `2996`
- current blocker: Step 3 LLM retranslation cannot produce a detector-clean batch

## Evidence

| Attempt | Change | Result |
| --- | --- | --- |
| `opencode` batch size 80, `openrouter/openai/gpt-5-nano` | Prompt included source/context/reason, glossary, whitelist constraints | FAIL: batch rejected before TS write; FP-9 residue (`Bounce Out`, `Alt`) and source mutation (`Can Canva auth...`) |
| `opencode` batch size 20, stricter glossary for `Bounce`, `Alt-Click`, `auth`, `esc` | Batch size reduced and prompt tightened | FAIL/BLOCKED: no token output after >5 minutes; `/tmp/llm-translation-events/batch-001.jsonl` stayed empty |
| `codex exec` fallback, read-only temp dir | Same first 10 strings, JSON-only prompt | FAIL/BLOCKED: usage limit, no model message written to `/tmp/codex-probe20-output.json` |

No failed LLM batch was written to `tools/{zh-Hans,zh-Hant,ja_JP}.ts` or `desktop-patcher/injector/generated_translations.inc`.

## Current Gate State

```text
G-X preflight          PASS
runtime surface        100% before Step 3 edits
JSON surface           100% before Step 3 edits
compiled untranslated  zh-Hans 768 / zh-Hant 798 / ja_JP 755 of 2996
§P5 forbidden          zh-Hans 261 / zh-Hant 273 / ja_JP 380
overallPass            false
```

## Diagnosis

The blocker is not detector logic, denominator provenance, or TS/inc contamination. The blocker is the LLM production channel:

- The first model batch produced translations that violated the newly required FP-9 constraints.
- The tightened second batch did not return output.
- The fallback Codex channel is quota-blocked.

Continuing by switching models, shrinking batches further, using Argos/OpenCC/local MT, or hand-waving batch validation would violate the fixed Step 3 rule and recreate the §F failure mode.

## Stop Rule

Per `runs/CLAUDE.md`, the same Step 3 blocker reproduced after two fixes. Stop here.

Resume only when a reliable LLM translation channel is available that can:

1. return exact-source JSON for small batches,
2. produce all three target languages per source,
3. pass local FP-1..FP-12 batch validation before TS write,
4. then allow `python3 tools/validate_translations.py --root . --extraction-inventory "$SESSION_DIR/extraction-inventory.json"` to reach zero forbidden hits.

Workflow state: `NOT COMPLETE`.
