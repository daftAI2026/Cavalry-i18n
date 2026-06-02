# Bootstrap Context

## Status

PASS

## Context

- Worktree: `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100`
- Branch: `wip/cavalry-full-ui-100`
- Commit: `1869f2c7f8228787054ecd674b46f3a93de47a61`

## Read Set

- `docs/workflows/cavalry-full-ui-100/Anti-Patterns.md`
- `docs/workflows/cavalry-full-ui-100/EXECUTE.md`
- `docs/workflows/cavalry-full-ui-100/Acceptance.md`
- `docs/workflows/cavalry-full-ui-100/Runbook.md`
- `docs/workflows/cavalry-full-ui-100/Project.md`
- `docs/workflows/cavalry-full-ui-100/TODO.md`
- `docs/workflows/cavalry-full-ui-100/Flow.md`
- `docs/workflows/cavalry-full-ui-100/prompts/00-bootstrap-context.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/LOCAL_BUILD_SOP.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/translation-guidelines.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/cavalry-glossary.md`
- `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/archive/cavalry-glossary-en-zh.md`
- `tools/translation-whitelist.json`

## Findings

- Anti-patterns are fixed as three bypass classes: Out-of-Band Truth, Counterfeit Form, and Denominator Shrink.
- Fixed execution order is `W-AUDIT -> G-X -> G-P -> §P5 -> G0 -> G2 -> G3 -> G1 -> zh-Hans -> zh-Hant -> ja_JP -> G4`.
- Current project truth remains `NOT COMPLETE`; no provenance-bound current JSON / compiled / runtime percentage was found in this worktree during bootstrap, so baseline must be rerun in W-AUDIT instead of inferred from historical numbers.
- Known missing tools called out by workflow docs: `tools/verify_gate_inputs.js`, `tools/merge_runtime_inventory.js`, `tools/capture_accessibility_inventory.js`, `tools/run_live_full_ui_matrix.js`.
- Translation reference docs and `docs/LOCAL_BUILD_SOP.md` are not present inside this worktree, but matching local copies exist in the sibling main checkout at `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/` and were used for bootstrap reading. All execution and edits still remain confined to the worktree.

## Next Step

Enter prompt `01-audit-and-gate-hardening.md` and turn legacy weak-threshold behavior into RED before any later gate or translation work.
