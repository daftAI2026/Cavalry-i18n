<!--
[INPUT]: Runbook.md § Target Version Drift Rule, Acceptance.md G-CAPTURE, BLOCKED-SIP diagnosis from 2026-04-30-G-CAPTURE-SIP-blocker.md
[OUTPUT]: Execution record attempting workaround via app copy; remains BLOCKED
[POS]: runs directory BLOCKED record
[PROTOCOL]: See Runbook.md § Anti-Bypass Rule / BLOCKED semantics
-->

# G-CAPTURE App Copy Attempt — Still BLOCKED-SIP

## Status

`BLOCKED`

## Session

```text
Execution attempt using app copy workaround:
- WORKTREE: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100
- CACHE_ROOT: ~/Library/Caches/Cavalry-i18n
- APP_COPY: ~/Library/Caches/Cavalry-i18n/app-copies/Cavalry-GCAPTURE.app
- Test sessions: multiple (see below)
```

## Approach Attempted

Per user guidance to "use non-/Applications app copy to bypass SIP":

1. **Created app copy** (449MB):
   - Source: `/Applications/Cavalry.app` (2.7.1, notarized)
   - Destination: `~/Library/Caches/Cavalry-i18n/app-copies/Cavalry-GCAPTURE.app`
   - Method: `ditto` (atomic copy outside protected system paths)

2. **Attempted code signing modifications**:
   - Tried `codesign --remove-signature`: Internal error (Code Signing subsystem)
   - Tried `codesign --force --deep --sign -`: Partial success, then error on crashpad_handler subcomponent
   - Result: App copy retains notarized signature; codesign operations fail

3. **Tested injector with app copy**:
   - Ran `tools/run_live_full_ui_matrix.js --app <copy>`
   - Ran `tools/launch_cavalry_with_injector.sh` directly
   - Result: Cavalry launches, but injector bootstrap messages do not appear

## Findings

### DYLD_INSERT_LIBRARIES Works (Confirmed)

Test with simple binaries confirms that `DYLD_INSERT_LIBRARIES` injection mechanism works:
```bash
gcc -shared -o /tmp/test.dylib <source>
DYLD_INSERT_LIBRARIES=/tmp/test.dylib /tmp/test
# Result: [test.dylib loaded] appears
```

### But App Copy Still Blocked

Despite:
- ✅ App copy located outside /Applications (~/Library/Caches/)
- ✅ App copy created successfully (ditto, 449MB)
- ✅ DYLD_INSERT_LIBRARIES mechanism confirmed working
- ✅ Cavalry.app binary verified as Mach-O universal (x86_64 + arm64)
- ❌ Codesign commands hit "internal error in Code Signing subsystem"
- ❌ Cavalry launches, but injector never loads
- ❌ Launch log contains normal Cavalry startup messages, zero injector bootstrap output

### Root Cause Analysis

The app copy, even when relocated to ~/Library/Caches/, retains the notarized code signature from the original. SIP may not directly block the path, but it prevents proper modification of the signature on a copy of a notarized app. Codesign operations fail with internal errors specifically on the crashpad_handler subcomponent.

## Impact on G-CAPTURE

| Criterion | Status | Reason |
| --- | --- | --- |
| injector English dump-only support | ❌ BLOCKED | Injector dylib never loaded to bootstrap |
| `RUNTIME_DIR/<lang>-injector-inventory.json` | ❌ BLOCKED | No injector output; file never created |
| runtime capture | ❌ BLOCKED | Cannot merge without live injector inventory |
| `RUN_RECORD.target` | ❌ BLOCKED | Session never produces artifacts |

## Acceptance Criteria Checkboxes Impact

All G-CAPTURE pass conditions remain unchecked:
- `injector supports English dump-only mode: CAVALRY_I18N_LANG=en only exports English runtime` → ❌ BLOCKED
- `launch script passes sessionDir/sessionUuid/cacheRoot` → ✅ Code exists, but injection blocked
- `capture_accessibility_inventory.js writes RUNTIME_DIR/<lang>-ax-inventory.json` → ✅ Code exists, but can't test without live Cavalry
- All `RUN_RECORD.target` metadata → ❌ Never reaches execution

## Unblocking Options

1. **Disable SIP** (requires Recovery Mode reboot):
   ```bash
   # Boot into Recovery Mode (Cmd+R)
   # Open Terminal
   csrutil disable
   # Restart normally
   # Then retry G-CAPTURE
   ```
   After disabling SIP, DYLD_INSERT_LIBRARIES should work on both /Applications and app copy.

2. **Alternative injection mechanisms** (future engineering):
   - Accessibility Framework hooks (out of scope for current gate)
   - Process tracing / attach (out of scope)
   - macOS private frameworks (unsupported)

## Current Workflow State

```text
NOT COMPLETE
First failing gate: G-CAPTURE
Blocked reason: SIP prevents DYLD_INSERT_LIBRARIES injection even with app copy workaround
Blocking condition: System Integrity Protection (enabled)
Dependencies blocked: G-X (frozen denominator), G0-G4 (all gates depend on runtime capture)
```

## Recommendations

1. **For immediate continuation**: Disable SIP in Recovery Mode, then re-run G-CAPTURE with app copy
2. **For CI/automation**: This workflow is not suitable for automated CI without SIP disabled or alternative injection mechanism
3. **For debugging**: Enable verbose codesign logging to understand signature modification failures

## Test Sessions Created

- `/Users/luo/Library/Caches/Cavalry-i18n/sessions/3F344F72-28F5-4EC1-B386-6B19643C40A4/` (first run-live-full-ui-matrix attempt)
- `/Users/luo/Library/Caches/Cavalry-i18n/sessions/E9E1424F-7D66-4F20-ADFA-520F85BE58D9/` (retry attempt)
- `/Users/luo/Library/Caches/Cavalry-i18n/sessions/test-debug-1777537135/` (manual launch script test)

All contain empty or near-empty artifacts due to injection failure.

## Artifacts

- **App copy**: `/Users/luo/Library/Caches/Cavalry-i18n/app-copies/Cavalry-GCAPTURE.app` (449MB, ready for reuse if SIP disabled)
- **Injector dylib**: `/Users/luo/Library/Caches/Cavalry-i18n/libCavalryTranslatorInjector.dylib` (built successfully, 204KB)
- **Test logs**: Various session audit directories (all show Cavalry startup, no injector messages)

## Next

Waiting for user action to unblock SIP. Once SIP is disabled, re-run:
```bash
cd /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100
node tools/run_live_full_ui_matrix.js \
  --app ~/Library/Caches/Cavalry-i18n/app-copies/Cavalry-GCAPTURE.app \
  --languages en,zh-Hans,zh-Hant,ja_JP
```
