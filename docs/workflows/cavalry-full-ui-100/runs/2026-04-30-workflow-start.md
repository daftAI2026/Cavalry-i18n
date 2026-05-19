# 2026-04-30-full-ui-100-workflow-start

## Status: FAIL

## Session Info
- SESSION_DIR: /Users/luo/Library/Caches/Cavalry-i18n/sessions/7ad87ad8-2af5-46bf-b12f-410b0aed5adc
- SESSION_UUID: 7ad87ad8-2af5-46bf-b12f-410b0aed5adc
- Target: Cavalry 2.7.1 / Qt 6.6.3 / Bundle MD5: 13778f7641757dcb6268fbb7edc83fa7

## First Failing Gate: G-CAPTURE

### Missing Components
The G-CAPTURE (Capture Toolchain Readiness) gate requires:

1. **tools/launch_cavalry_with_injector.sh**: Must accept --session-dir, --session-uuid, --cache-root parameters
   - Current: Script exists but does not pass session directory parameters
   - Required by: Acceptance.md G-CAPTURE pass condition

2. **tools/capture_accessibility_inventory.js**: Must capture AX inventory and write to RUNTIME_DIR/<lang>-ax-inventory.json
   - Current: Script does not exist
   - Required by: Acceptance.md G-CAPTURE pass condition
   - Must record: menuDepthMax >= 2, submenu path samples >= 5

3. **tools/merge_runtime_inventory.js**: Must merge injector + AX inventories
   - Current: Script does not exist
   - Required by: Acceptance.md G-CAPTURE pass condition

4. **tools/run_live_full_ui_matrix.js**: Must orchestrate session creation and runtime capture for all languages
   - Current: Script does not exist
   - Required by: Acceptance.md G-CAPTURE pass condition
   - Must write: RUN_RECORD with target identity, artifact provenance, frozen baselines

5. **English dump-only mode**: injector must support CAVALRY_I18N_LANG=en
   - Current: Live injector English probe hits "unsupported language: en"
   - Required by: Acceptance.md G-CAPTURE pass condition

### Implementation Plan

1. Update tools/launch_cavalry_with_injector.sh to accept and pass session directory parameters
2. Implement tools/capture_accessibility_inventory.js to capture macOS AX tree with menu depth tracking
3. Implement tools/merge_runtime_inventory.js to merge injector and AX inventories
4. Implement tools/run_live_full_ui_matrix.js to orchestrate the full workflow
5. Fix injector to support English-only dump mode (CAVALRY_I18N_LANG=en)

### Next Step

Begin G-CAPTURE gate hardening by implementing the missing scripts in order.

## Artifacts Created
- SESSION_DIR initialized: /Users/luo/Library/Caches/Cavalry-i18n/sessions/7ad87ad8-2af5-46bf-b12f-410b0aed5adc
