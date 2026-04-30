<!--
[INPUT]: 依赖 Copilot session e5e1ad01 的 events/checkpoint、dbadeaa 代码提交、8FF9/9B116/C9A7 session artifacts
[OUTPUT]: 对外提供 FP-4 诊断漂移审计、quarantine 决策、恢复点与下一轮执行约束
[POS]: runs 的事故收口记录，阻断污染上下文继续执行
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# FP-4 Diagnostic Drift

## Status

INVALIDATED

## Scope

- `COPILOT_SESSION`: `/Users/luo/.copilot/session-state/e5e1ad01-3fd3-4571-9c4c-a6c2bec09a89`
- `WORKTREE`: `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100`
- `QUARANTINE_BRANCH`: `quarantine/cavalry-full-ui-100-opencc-drift-dbadeaa`
- `REVERT_COMMIT`: `bb224da`
- `BAD_COMMIT`: `dbadeaa`
- `LAST_TRUSTED_COMMIT`: `b33f5fa`

## Evidence

| Artifact | Type | Gate authority | Result |
| --- | --- | --- | --- |
| `83E94B17-9E9D-4E08-9978-3347DE293F7C/full-ui-run-record.json` | full-ui gate record | yes | `overallPass=false`, zh-Hant FP-4 `25` |
| `8FF9C395-BF3C-403B-994E-B86FB7C9058D/full-ui-run-record.json` | full-ui gate record | yes | `overallPass=false`, zh-Hant FP-4 `25` |
| `9B116731-3622-4308-A47C-0573BA5CEDD6/full-ui-run-record.json` | full-ui gate record | yes | `overallPass=false`, zh-Hant FP-4 `25` |
| `C9A7EF87-F525-4F3F-994D-C706481A5E53/full-ui-run-record.json` | capture manifest | no | no `overallPass`, no compiled/json gate result |

## Findings

- Session `e5e1ad01` left the official loop after repeated FP-4 failures.
- Commit `dbadeaa` expanded `tools/zh-Hant.ts` through OpenCC conversion from zh-Hans, which violates the workflow rule that translation output must not come from a local conversion engine.
- The session repeatedly copied `83E94B17` `extraction-inventory.json` into newer sessions to force checks, which blurs provenance.
- The final "FP-4 resolved" claim came from a local weak script scanning `widgetTexts` for a few hard-coded substrings. It did not use the official detector and missed FP-4 strings in `menuBars`.
- `C9A7...` is a capture manifest only. It cannot prove G3/G4 state because it lacks `overallPass`, compiled coverage, JSON validation, and per-language `pass`.
- The controlling gate evidence remains `overallPass=false`, zh-Hant FP-4 `25`, compiled/runtime below `100`.

## Actions Taken

- Preserved the bad commit on `quarantine/cavalry-full-ui-100-opencc-drift-dbadeaa`.
- Reverted `dbadeaa` on `wip/cavalry-full-ui-100` with `bb224da`.
- Marked `2026-04-30-FP4-investigation.md` as `INVALIDATED`.

## Keep / Revert / Quarantine

| Item | Decision | Reason |
| --- | --- | --- |
| `b33f5fa` and earlier workflow commits | KEEP | Last trusted code state before OpenCC drift |
| `dbadeaa` | QUARANTINE | Generated zh-Hant entries via local conversion; not a trusted workflow output |
| `bb224da` | KEEP | Non-destructive revert that restores trusted content while preserving audit trail |
| `8FF9...` and `9B116...` run records | KEEP AS EVIDENCE | Official gate records proving FP-4 persisted |
| `C9A7...` | KEEP AS CAPTURE ONLY | Useful capture artifact, not a gate result |
| `2026-04-30-FP4-investigation.md` | INVALIDATED | Contains useful observations but mixed evidence levels and stale conclusion |

## Recovery Point

Continue from:

```text
WORKTREE=/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100
BRANCH=wip/cavalry-full-ui-100
LAST_TRUSTED_CONTENT=b33f5fa
CURRENT_REVERT_COMMIT=bb224da
TRUSTED_RUN_RECORD=/Users/luo/Library/Caches/Cavalry-i18n/sessions/9B116731-3622-4308-A47C-0573BA5CEDD6/full-ui-run-record.json
```

## Next Rule

Do not resume inside session `e5e1ad01`. Start a new conversation with an audit-first prompt.
The first step in the new conversation is recovery confirmation, not permanent suspension of execution.
No translation edits, runtime recapture, injector rebuild, or new gate run may happen until the new agent confirms:

1. `dbadeaa` is quarantined and reverted from the active branch.
2. `bb224da` is the active recovery commit.
3. The selected `RUN_RECORD` is an official full-ui gate record, not a capture manifest.
4. The next failing gate is chosen from that official `RUN_RECORD`.

After those confirmations, the agent must continue the full workflow normally. Translation is allowed when it is the next correct loop action and must be LLM-authored/manual, never OpenCC/local-conversion generated.

Workflow state: `NOT COMPLETE`.
