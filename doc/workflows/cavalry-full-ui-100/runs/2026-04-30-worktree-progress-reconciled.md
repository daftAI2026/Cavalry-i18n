<!--
[INPUT]: 依赖 main repo 401c32a、backup branch codex/misapplied-main-full-ui-20260430、worktree commit 23aa613、session 24B1A045-0101-4859-B00F-63110A6D4B93
[OUTPUT]: 对外提供错投 main 后的恢复记录、worktree 当前进度与正式 blocker
[POS]: runs 目录中的 INVALIDATED + FAIL 复合记录，阻止后续 agent 把误投 completion report 当作 PASS 证据
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Worktree Progress Reconciled

## Status

`FAIL`

## What Happened

The latest execution again wrote useful full-ui progress to `main` instead of the execution worktree.
The mistaken `main` tip was preserved as:

```text
codex/misapplied-main-full-ui-20260430
```

`main` was restored to:

```text
401c32a docs: Complete G-CAPTURE SIP blocker investigation and analysis
```

Useful runtime/menu translation progress was moved into the execution worktree:

```text
/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100
branch: wip/cavalry-full-ui-100
commit: 23aa613 fix(workflow): move runtime translation progress to wip
```

## Current Evidence

Session:

```text
24B1A045-0101-4859-B00F-63110A6D4B93
```

`verify_gate_inputs.js` still fails:

```text
languages/en/appStrings.json: 4 < 10
json-total: 6409 < 6415
runtime-candidates: 9 < 613
runtime-menuLeaves: 0 < 666
```

Worktree matrix with explicit session binding reports:

| Language | Runtime | JSON | Compiled | Pass |
| --- | ---: | ---: | ---: | --- |
| `ja_JP` | 100% | 100% | 7.36% | false |
| `zh-Hans` | 100% | 100% | 12.32% | false |
| `zh-Hant` | 100% | 100% | 7.36% | false |

## Interpretation

- The moved work is useful: runtime translations for the current 9-candidate weak denominator now verify at 100%.
- JSON reports 100% under the current worktree reader.
- This is not formal `G-CAPTURE`, `G-X`, `G3`, or `G4` PASS evidence because G-X preflight still rejects the denominator.
- The completion reports from the mistaken main commits are invalid as workflow completion evidence.

## Next Gate

First formal blocker remains:

```text
G-CAPTURE / G-X: current runtime and JSON denominator lower bounds are not met.
```

After that, `G2` remains blocked by compiled translation coverage below 100%.

Final workflow state:

```text
NOT COMPLETE
```
