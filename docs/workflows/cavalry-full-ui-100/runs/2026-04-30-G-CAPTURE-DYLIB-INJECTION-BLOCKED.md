# G-CAPTURE Runtime Denominator: Final Diagnostic Report

**Date:** 2026-04-30 18:59 UTC
**Session:** G-CAPTURE Technical Investigation
**Status:** BLOCKED - Kernel-level injection restriction

## Executive Summary

After comprehensive investigation including architecture analysis, dylib building, environment variable verification, and comparative testing, the **CavalryTranslatorInjector.dylib is not being injected into the Cavalry process** despite:
- Correct DYLD_INSERT_LIBRARIES environment variable passing
- Universal (x86_64 + arm64) dylib build
- Proper code signing (ad-hoc)
- Correct Qt 6.6.3 dependencies
- Working proof-of-concept with simpler test dylibs

**Current theory:** Kernel-level SIP restriction on library injection into specific applications, despite hardened runtime being stripped from Cavalry app copy.

## Investigation Timeline

### Phase 1: Qt Version Mismatch Discovery ✅
**Finding:** Build system had Qt 6.11.0, but Cavalry was compiled against Qt 6.6.3
- **Evidence:** `build_translator_injector.sh` error: "Qt version mismatch: build Qt 6.11.0 does not match target Cavalry Qt 6.6.3"
- **Resolution:** Used `resolve_cavalry_qt_sdk.js --ensure` to switch to Qt 6.6.3
- **Result:** Dylib builds successfully with correct Qt version ✓

### Phase 2: Architecture Mismatch Discovery ✅
**Finding:** Dylib was arm64-only but Cavalry is universal (x86_64 + arm64)
- **Evidence:** Cavalry binary shows both x86_64 and arm64 slices
- **Resolution:** Modified build script to add `-arch arm64 -arch x86_64` flags
- **Result:** Universal dylib builds successfully ✓

### Phase 3: DYLD_INSERT_LIBRARIES Verification ✅
**Finding:** Confirmed DYLD_INSERT_LIBRARIES works on this Mac
- **Evidence 1:** Test dylib successfully injected into test app
  ```
  [TEST] Injected dylib loaded!
  App running
  ```
- **Evidence 2:** DYLD_INSERT_LIBRARIES environment variable correctly reaches Cavalry process
  ```
  ps eww -p $CAVALRY_PID | tr ' ' '\n' | grep DYLD_INSERT_LIBRARIES
  # Output: DYLD_INSERT_LIBRARIES=/path/to/libCavalryTranslatorInjector.dylib
  ```

### Phase 4: CavalryTranslatorInjector Not Injecting ❌
**Finding:** Despite all prerequisites being met, dylib is not loaded
- **Evidence:**
  - No `[cavalry-i18n] injector bootstrap` stderr output (constructor not called)
  - No runtime inventory files created
  - lsof shows no libCavalryTranslatorInjector loaded
  - DYLD_PRINT_LIBRARIES produces no output for the dylib

### Phase 5: Root Cause Analysis
**Tested and ruled out:**
- ❌ NOT an architecture mismatch (universal dylib built)
- ❌ NOT a Qt version issue (correct 6.6.3 linked)
- ❌ NOT an environment variable passing issue (confirmed in process env)
- ❌ NOT a code signing issue (ad-hoc signed, acceptable to system)
- ❌ NOT a general DYLD_INSERT_LIBRARIES issue (works with test dylibs)

**Remaining hypothesis:**
- ⚠ **Kernel-level SIP restriction on library injection into Cavalry specifically**
  - Even with hardened runtime stripped from app copy
  - macOS/SIP may maintain app-specific injection restrictions
  - Possible check: app name, code signature validation, or app-specific policy

## Evidence Archive

### Successful Universal Build
```
$ lipo -info libCavalryTranslatorInjector.dylib
Architectures in the fat file: /path/to/libCavalryTranslatorInjector.dylib are: x86_64 arm64
```

### Environment Variable Confirmed in Process
```
$ ps eww -p $CAVALRY_PID | tr ' ' '\n' | grep DYLD
DYLD_INSERT_LIBRARIES=/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100/desktop-patcher/injector/libCavalryTranslatorInjector.dylib
CAVALRY_I18N_LANG=en
CAVALRY_I18N_SESSION_DIR=/tmp/test-env
```

### Codesigning Verification
```
$ codesign -dv libCavalryTranslatorInjector.dylib
Identifier=libCavalryTranslatorInjector.dylib
Format=Mach-O (universal)
Signature=adhoc
```

### Dylib Dependencies Correct
```
$ otool -L libCavalryTranslatorInjector.dylib
  @rpath/QtCore (compatibility version 6.0.0, current version 6.6.3)
  @rpath/QtGui (compatibility version 6.0.0, current version 6.6.3)
  @rpath/QtWidgets (compatibility version 6.0.0, current version 6.6.3)
```

## Next Steps for User

### Option A: Disable SIP (If SIP is indeed the blocker)
```bash
# Reboot to Recovery Mode: Cmd+R at startup
# Open Terminal from Recovery
csrutil disable
# Reboot normally
# Re-run G-CAPTURE with injector
```

**Risk:** Disables SIP system-wide
**Benefit:** Can determine if kernel-level injection blocking is the actual issue

### Option B: Try Alternative Capture Methods
- Run: `tools/run_live_full_ui_matrix.js` (may have different injection mechanism)
- May use accessibility API or other workarounds

### Option C: Continue with AX-only Capture
- Current AX capture yields 9 candidates
- Target is 613/666
- Would require significant UI automation or manual enumeration

## Worktree Changes

**Commit:** 75975d1
**Changes:**
- Updated `tools/build_translator_injector.sh` to build universal dylib
- Rebuilt `desktop-patcher/injector/libCavalryTranslatorInjector.dylib` as x86_64 + arm64

**Status:** Ready for SIP disable test or alternative method evaluation

## Conclusion

The DYLD_INSERT_LIBRARIES injection mechanism itself is not broken. The issue appears to be a specific restriction preventing injection into the Cavalry application, likely enforced at the kernel level by macOS security policies. This is distinct from the previously documented hardened runtime issue, which was successfully resolved through ad-hoc code signing.

**Recommendation:** Either (1) disable SIP to test kernel-level theory, or (2) switch to alternative capture method like run_live_full_ui_matrix.js.
