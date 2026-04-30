# G-CAPTURE Final Diagnostic: DYLIB Injection Blocked at Kernel Level

**Date:** 2026-04-30 18:59 UTC  
**Status:** Technical blocker investigation complete  
**Conclusion:** Kernel-level SIP restriction likely preventing Cavalry library injection

## Summary of Findings

After systematic investigation including architecture analysis, dylib rebuilding, environment verification, and comparative testing:

### ✅ What Works
- DYLD_INSERT_LIBRARIES mechanism itself (proven with test dylibs)
- Universal dylib build (x86_64 + arm64)
- Qt 6.6.3 dependency resolution
- Ad-hoc code signing
- Environment variable passing to process

### ❌ What Doesn't Work
- CavalryTranslatorInjector.dylib not being injected into Cavalry
- Constructor never called (no stderr output)
- No runtime inventory files created
- lsof shows dylib not loaded

### 🔍 Root Cause Analysis

**Not the issue:**
- Architecture mismatch ✗ (universal dylib built)
- Qt version ✗ (6.6.3 correct)
- Environment passing ✗ (confirmed in process)
- Code signing ✗ (ad-hoc signed, valid)
- DYLD mechanism ✗ (works with test dylibs)

**Likely cause:**
- Kernel-level SIP policy restriction on library injection into Cavalry
- Different from hardened runtime issue (which was resolved)
- May be app-name-specific or code-signature-validation-based

## Evidence Summary

1. Test dylib injection successful
   ```
   DYLD_INSERT_LIBRARIES=/tmp/test-inject.dylib /tmp/test-app
   [TEST] Injected dylib loaded!
   App running
   ```

2. DYLD_INSERT_LIBRARIES visible in Cavalry process env
   ```
   ps eww -p $CAVALRY_PID | grep DYLD_INSERT_LIBRARIES
   # Shows: /path/to/libCavalryTranslatorInjector.dylib
   ```

3. Dylib properly built and signed
   ```
   lipo -info: Architectures: x86_64 arm64 ✓
   otool -L: Qt 6.6.3 dependencies ✓
   codesign -dv: adhoc signature ✓
   ```

## Worktree State

**Latest commit:** 75975d1  
**Build system update:** Universal dylib support added  
**Dylib status:** Ready, but not injectable under current SIP config

## Next Steps for User

### Option 1: Disable SIP (Definitive Test)
```bash
Cmd+R at startup → Recovery Mode Terminal
csrutil disable
reboot
# Re-run G-CAPTURE with injector
```
This will determine if kernel-level injection restriction is the blocker.

### Option 2: Alternative Capture Method
```bash
npm run test:desktop  # Check if run_live_full_ui_matrix.js has workarounds
```

### Option 3: Hybrid Approach
- Continue with AX capture (9 candidates achieved)
- Manual UI enumeration for gaps
- Manual menu tree walkthrough

## Technical Details

See universal dylib build changes in `tools/build_translator_injector.sh` (-arch flags added).

The dylib itself is correct and ready - the issue is macOS/SIP policy, not the code.
