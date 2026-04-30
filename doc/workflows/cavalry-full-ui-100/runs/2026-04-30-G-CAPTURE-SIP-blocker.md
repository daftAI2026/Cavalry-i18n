<!--
[INPUT]: G-CAPTURE execution attempt, SIP status check, code signing verification
[OUTPUT]: BLOCKED status with external blocker evidence
[POS]: runs directory BLOCKED record
[PROTOCOL]: See Runbook.md § Anti-Bypass Rule / BLOCKED semantics
-->

# G-CAPTURE SIP Blocker

## Status

`BLOCKED`

## Session

```text
Execution attempts:
- /Users/luo/.copilot/session-state/current
- Test sessions in ~/Library/Caches/Cavalry-i18n/sessions/{8758E32D-*,test-debug}
```

## Blocker

System Integrity Protection (SIP) is **enabled** and blocks `DYLD_INSERT_LIBRARIES` injection into code-signed binaries.

```text
$ csrutil status
System Integrity Protection status: enabled.
```

## What Happened

1. G-CAPTURE script (`tools/run_live_full_ui_matrix.js`) attempts to:
   - Build injector dylib: ✅ SUCCESS
   - Launch Cavalry with `DYLD_INSERT_LIBRARIES=$injector`: ❌ BLOCKED

2. Launch script (`tools/launch_cavalry_with_injector.sh`) tries to work around SIP by:
   - Removing app code signature (lines 126-127)
   - Re-signing with ad-hoc cert (line 131): `codesign --force --deep --sign - /Applications/Cavalry.app`
   - Setting `DYLD_INSERT_LIBRARIES` environment variable (line 138)

3. Result: Cavalry app launches normally, but injector dylib is NOT loaded.

**Evidence**: Injector bootstrap messages (e.g., `[cavalry-i18n] injector bootstrap`) do NOT appear in launch logs.

```text
$ cat ~/Library/Caches/Cavalry-i18n/sessions/test-debug/audit/en-injector-launch.log
[16:01:56.917 info    ] Cavalry will remind you every 10 minutes to save your scene.
[16:02:00.813 info    ] Welcome to Cavalry.
(no cavalry-i18n messages)
```

## Why This Blocks G-CAPTURE

G-CAPTURE.G-C-1 requires:

> `injector supports English dump-only mode: CAVALRY_I18N_LANG=en only exports English runtime, does not require translation table`

The injector dylib must be loaded for this to work. With SIP enabled, the dylib cannot be injected, so:

- Runtime inventory file is never created
- `waitForFile()` times out after 30 seconds
- G-CAPTURE.G-X and all downstream gates cannot proceed

## Acceptance Criteria Impact

| Criterion | Status | Reason |
| --- | --- | --- |
| `injector supports English dump-only mode` | ❌ BLOCKED | DYLD_INSERT_LIBRARIES injection blocked by SIP |
| `RUNTIME_DIR/<lang>-injector-inventory.json` | ❌ BLOCKED | Injector never loaded to produce file |
| `RUNTIME_DIR/<lang>-merged-inventory.json` | ❌ BLOCKED | Cannot merge without injector inventory |
| `RUN_RECORD.target` | ❌ BLOCKED | Session never produces RUN_RECORD |

## Workarounds / Unblocking

To unblock G-CAPTURE, one of:

1. **Disable SIP** (requires reboot into Recovery Mode):
   ```
   csrutil disable
   ```
   Then retry G-CAPTURE.

2. **Use unsigned app copy** (not /Applications):
   - Copy `/Applications/Cavalry.app` to writable location
   - Modify launch script to use copy instead
   - SIP does not restrict DYLD_INSERT_LIBRARIES on non-system-protected copies

3. **Different injection mechanism** (future work):
   - Replace DYLD_INSERT_LIBRARIES with Accessibility framework hooks
   - Or use process tracing / attach mechanism instead of library injection
   - Out of scope for current G-CAPTURE gate definition

## Current Workflow State

```text
NOT COMPLETE
First failing gate: G-CAPTURE
Blocked reason: SIP prevents injector dylib loading
Next action: Disable SIP or relocate app copy
```

## Artifacts

- **Injector dylib**: `~/Library/Caches/Cavalry-i18n/libCavalryTranslatorInjector.dylib` (built successfully)
- **Test sessions**: `~/Library/Caches/Cavalry-i18n/sessions/{8758E32D-8FFC-4DAD-AEA4-B794FD50468B,test-debug}/`
- **Launch logs**: `*/audit/en-injector-launch.log` (show no injector messages)

## Implementation Notes

The injector code (desktop-patcher/injector/CavalryTranslatorInjector.mm) was updated to add a retry loop for English dump-only mode (commit pending). This ensures the injector tries up to 20 times to export the inventory as the app initializes. However, this retry mechanism cannot activate unless the dylib is first successfully loaded, which SIP prevents.
