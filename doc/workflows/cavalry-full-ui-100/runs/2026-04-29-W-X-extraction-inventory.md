# W-X / G-X — Extraction Inventory Freeze

## Status

BLOCKED

## Session

- `SESSION_UUID`: `099C88C6-F1A2-4F63-944B-97F7EC47EB3D`
- `SESSION_DIR`: `/Users/luo/Library/Caches/Cavalry-i18n/sessions/099C88C6-F1A2-4F63-944B-97F7EC47EB3D`
- `AX inventory`: `/Users/luo/Library/Caches/Cavalry-i18n/sessions/099C88C6-F1A2-4F63-944B-97F7EC47EB3D/runtime/en-ax-inventory.json`
- `RUN_RECORD`: `/Users/luo/Library/Caches/Cavalry-i18n/sessions/099C88C6-F1A2-4F63-944B-97F7EC47EB3D/full-ui-run-record.json`

## Evidence

- `node --test doc/workflows/cavalry-full-ui-100/tests/extraction-inventory-contract.test.js`
- `node --test doc/workflows/cavalry-full-ui-100/tests/capture-accessibility-contract.test.js`
- `node tools/capture_accessibility_inventory.js --app-name Cavalry --language en --session-uuid 099C88C6-F1A2-4F63-944B-97F7EC47EB3D --output /Users/luo/Library/Caches/Cavalry-i18n/sessions/099C88C6-F1A2-4F63-944B-97F7EC47EB3D/runtime/en-ax-inventory.json`
- Native AX probe against the same English Cavalry pid showed `AXChildren = 4` on both the main scene window and the Preferences window.
- Injector English probe reached `injector bootstrap` but still logged `unsupported language: en` before any runtime inventory dump.

## Findings

- `verify_gate_inputs.js` now hard-fails when `extraction-inventory.json` is missing and emits `WEAK-CAPTURE` when runtime counts miss frozen lower bounds.
- `tools/capture_accessibility_inventory.js` now writes session-scoped live AX artifacts, but the current English AX surface is far below G-X lower bounds:
  - recursive menu strings captured by the current live probe: `14`
  - `widgetTexts`: `7`
- Because the capture is far below the A9B11073 runtime baseline (`candidates >= 613`, `menuLeaves >= 666`), `SESSION_DIR/extraction-inventory.json` was **not** frozen for this session.

## Blocked Reason

`WEAK-CAPTURE`: live English Cavalry does not currently expose enough runtime widget text via AX to satisfy G-X, and the existing injector path cannot dump English runtime inventory without further code changes outside prompt `02`'s completed scope.

## Gate Impact

- `G-X`: BLOCKED
- Translation prompts `08/09/10` remain forbidden
- Workflow state: `NOT COMPLETE`
