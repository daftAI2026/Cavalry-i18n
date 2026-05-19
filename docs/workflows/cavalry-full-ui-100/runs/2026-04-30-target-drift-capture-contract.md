<!--
[INPUT]: 依赖 Runbook.md Target Version Drift Rule、Acceptance.md G-CAPTURE/G-X、Cavalry 2.7.1 target refresh run note
[OUTPUT]: 对外提供 target identity 与 AX submenu capture evidence 的 workflow hardening 记录
[POS]: runs 目录中的 workflow 规范变更 run note
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Target Drift + Capture Contract Hardening

## Status

`PASS`

## Evidence

- `Runbook.md`: added target version drift rule.
- `Acceptance.md`: added target identity contract and submenu capture evidence requirements.
- Cavalry 2.7.1 app bundle check: `appStrings.json` has 10 leaves; old repo baseline had 4, so JSON lower bound is now 6415 total leaves.
- `TODO.md` / `Project.md`: recorded remaining code gaps for target identity and AX menu depth audit.
- `prompts/07-runtime-capture-toolchain.md`: requires `menuDepthMax` and submenu path samples.
- `prompts/02-extraction-inventory-freeze.md`: requires target identity in frozen denominator.
- `Flow.md` / `EXECUTE.md`: target identity check is now explicit before baseline/gate work, and G-CAPTURE now names submenu evidence as a failure condition.

2.7.1 app-only `appStrings` keys include:

- `gpu.unsupported.title`
- `gpu.unsupported.intro`
- `gpu.unsupported.contactSupport`

## Result

Workflow now treats target identity as part of the denominator:

- Cavalry version
- Qt version
- app bundle hash
- app path

If any target identity field changes, old source maps, extraction inventories, runtime captures and run records become historical evidence only.

Workflow also now requires runtime capture evidence for submenu recursion:

- `menuDepthMax >= 2`
- at least 5 submenu path samples
- audit samples traceable back to `RUNTIME_DIR/<lang>-ax-inventory.json`

## Next

Current workflow state remains `NOT COMPLETE`.

Next execution must:

1. Re-extract compiled source-map from `/Applications/Cavalry.app` 2.7.1.
2. Re-run live runtime capture and emit menu depth/path audit evidence.
3. Re-run G-X and freeze a new 2.7.1 `SESSION_DIR/extraction-inventory.json`.
4. Only then resume translation backlog against the new frozen denominator.
