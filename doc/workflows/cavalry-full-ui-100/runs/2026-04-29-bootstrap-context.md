# Bootstrap Context

## Status

PASS

## Context

- Worktree: `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100`
- Branch: `wip/cavalry-full-ui-100`
- Commit: `1869f2c7f8228787054ecd674b46f3a93de47a61`

## Read Set

- `doc/workflows/cavalry-full-ui-100/Anti-Patterns.md`
- `doc/workflows/cavalry-full-ui-100/EXECUTE.md`
- `doc/workflows/cavalry-full-ui-100/Acceptance.md`
- `doc/workflows/cavalry-full-ui-100/Runbook.md`
- `doc/workflows/cavalry-full-ui-100/Project.md`
- `doc/workflows/cavalry-full-ui-100/TODO.md`
- `doc/workflows/cavalry-full-ui-100/Flow.md`
- `doc/workflows/cavalry-full-ui-100/prompts/00-bootstrap-context.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/doc/LOCAL_BUILD_SOP.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/doc/translation-guidelines.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/doc/cavalry-glossary.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/doc/cavalry-glossary-en-zh.md`
- `tools/translation-whitelist.json`

## Findings

- Anti-patterns are fixed as three bypass classes: Out-of-Band Truth, Counterfeit Form, and Denominator Shrink.
- Fixed execution order is `W-AUDIT -> G-X -> G-P -> §P5 -> G0 -> G2 -> G3 -> G1 -> zh-Hans -> zh-Hant -> ja_JP -> G4`.
- Current project truth remains `NOT COMPLETE`; no provenance-bound current JSON / compiled / runtime percentage was found in this worktree during bootstrap, so baseline must be rerun in W-AUDIT instead of inferred from historical numbers.
- Known missing tools called out by workflow docs: `tools/verify_gate_inputs.js`, `tools/merge_runtime_inventory.js`, `tools/capture_accessibility_inventory.js`, `tools/run_live_full_ui_matrix.js`.
- Translation reference docs and `doc/LOCAL_BUILD_SOP.md` are not present inside this worktree, but matching local copies exist in the sibling main checkout at `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/doc/` and were used for bootstrap reading. All execution and edits still remain confined to the worktree.

## Next Step

Enter prompt `01-audit-and-gate-hardening.md` and turn legacy weak-threshold behavior into RED before any later gate or translation work.
