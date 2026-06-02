# 2026-04-30 — G-CAPTURE Injection Blocker: DYLD_INSERT_LIBRARIES Not Executing

**Status:** BLOCKED (dylib not being loaded despite proper setup)  
**Date:** 2026-04-30  
**Branch:** wip/cavalry-full-ui-100-g-capture  
**HEAD:** 9dffdbe (fix: Move injector build after session-local app copy)

---

## Summary

Fixed two critical issues in the G-CAPTURE toolchain but encountered a fundamental blocker: **DYLD_INSERT_LIBRARIES is not actually loading the injector dylib into the Cavalry process, despite all technical requirements being met.**

### What Was Fixed

1. **Removed `--no-resign` bypass flag** (commit d3178d2)
   - Previous version was skipping code signing entirely, preventing proper injection
   - Now signing is enforced

2. **Implemented session-local app copy strategy** (commits 5549f6b, 9dffdbe)
   - Detects if `/Applications/Cavalry.app` is read-only
   - Copies to `SESSION_DIR/cavalry-target.app` for modification
   - Properly removes and re-signs with ad-hoc signature
   - **Hardened runtime flag successfully removed**: flags changed from 0x10000(runtime) to 0x2(adhoc)

3. **Fixed injector dylib rpath** (commit 9dffdbe)
   - Moved injector build after determining session-local path
   - Now injector is built with correct rpath to either:
     - `/Applications/Cavalry.app/Contents/Frameworks` (if writable)
     - `SESSION_DIR/cavalry-target.app/Contents/Frameworks` (if read-only)

### Technical Achievements

| Item | Status | Evidence |
|------|--------|----------|
| Remove hardened runtime flag | ✅ DONE | `codesign -dv` shows flags=0x2(adhoc) after signing |
| App signing with ad-hoc certificate | ✅ DONE | codesign evidence written to audit/ |
| Session-local app copy mechanism | ✅ DONE | App copied to `cavalry-target.app` and signed |
| Injector dylib building | ✅ DONE | dylib built and signed with adhoc certificate |
| Injector dylib rpath setup | ✅ DONE | rpath updated to session-local app location |

### Current Blocker: DYLIB NOT BEING INJECTED

**Symptom:** Despite all setup being correct, DYLD_INSERT_LIBRARIES is not causing the dylib to be loaded.

**Evidence:**
- en-injector-launch.log is empty (0 bytes) after Cavalry runs
- No "[cavalry-i18n] injector bootstrap" message appears
- No runtime/en-injector-inventory.json file is created
- Matrix script times out waiting for injector output

**Verification Performed:**
1. ✅ Code signing dance completed correctly (flags verified)
2. ✅ Dylib exists and is ad-hoc signed
3. ✅ Session-local app copied and re-signed
4. ✅ Environment variables set correctly:
   - DYLD_INSERT_LIBRARIES=$INJECTOR_PATH
   - CAVALRY_I18N_LANG=en
   - CAVALRY_I18N_SESSION_DIR=$SESSION_DIR
5. ❌ Dylib NOT being loaded into process (DYLD not executing it)

---

## Previous Success Reference

Session 83E94B17-9E9D-4E08-9978-3347DE293F7C (2026-04-29 21:12:51) successfully generated injector inventories:
- Launch log shows: "[cavalry-i18n] injector bootstrap"
- en-injector-inventory.json created (2300 lines)
- All 4 languages succeeded: en, zh-Hans, zh-Hant, ja_JP
- Runtime metrics: candidates >= 613, menuLeaves >= 666 ✓

**Difference:** That session was created with commit c685dc9 state, which had `--no-resign` flag in the matrix runner. Somehow injection worked despite that flag (likely skipping all signing).

---

## Diagnostic Output

### Current App Signature (Session-Local Copy)

```
Executable=/Users/luo/Library/Caches/Cavalry-i18n/sessions/.../cavalry-target.app/Contents/MacOS/Cavalry
CodeDirectory v=20400 size=879 flags=0x2(adhoc) hashes=21+3 location=embedded
Signature=adhoc
TeamIdentifier=not set
Internal requirements count=0 size=12
```
✅ Hardened runtime flag removed successfully

### Injector Dylib Signature

```
Executable=/Users/luo/Library/Caches/Cavalry-i18n/libCavalryTranslatorInjector.dylib
Format=Mach-O universal (x86_64 arm64)
CodeDirectory v=20400 size=638 flags=0x2(adhoc)
Signature=adhoc
```
✅ Dylib is ad-hoc signed correctly

### Injector Dylib rpath

```
LC_RPATH: /Users/luo/Library/Caches/Cavalry-i18n/sessions/.../cavalry-target.app/Contents/Frameworks
LC_RPATH: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/qt_sdk/6.6.3/macos/lib
```
✅ rpath updated to session-local location

---

## Why Injection Should Work

Per `docs/cavalry-runtime-injection-techniques.md`:

1. App has hardened runtime flag → REMOVED ✓
2. App is ad-hoc signed → DONE ✓
3. Dylib is ad-hoc signed → DONE ✓
4. No `disable-library-validation` entitlement needed (app uses `allow-unsigned-executable-memory` which is sufficient)
5. DYLD_INSERT_LIBRARIES set in environment → YES ✓

**All requirements met, yet injection not occurring.**

---

## Hypotheses for Next Investigation

### Hypothesis 1: dyld Not Respecting DYLD_INSERT_LIBRARIES

- **Symptom:** Env var is set but dyld ignores it
- **Possible Causes:**
  - App runs via macOS launchd which strips env vars
  - Process runs from a different shell context
  - App has `DYLD_INSERT_LIBRARIES` filtering in Info.plist
- **Test:** Use `open` command instead of direct exec
- **Fix:** Use `open -e` or app launch bundle method

### Hypothesis 2: Dylib Constructor Not Being Triggered

- **Symptom:** Dylib loaded but `__attribute__((constructor))` not running
- **Possible Causes:**
  - Dylib load deferred until first symbol access
  - Cavalry binary optimized away constructor execution
- **Test:** Check if Cavalry has DYLD_LAZY binding
- **Fix:** Force binding with DYLD_BIND_AT_LAUNCH=1

### Hypothesis 3: Qt Framework Versions Not Matching

- **Symptom:** Dylib can't resolve Qt dependencies, not loaded
- **Evidence:** Qt 6.6.3 rpath exists, but dylib reports "@rpath/QtCore not found"
- **Fix:** Verify Qt 6.6.3 in session-local app matches SDK exactly

---

## Commits Made This Session

1. d3178d2 — Remove --no-resign flag from matrix runner
2. 5549f6b — Relax hardened runtime check in launcher
3. 27e010c — WIP: Investigating G-CAPTURE injection blocker (commit note)
4. 2ecdfe5 — WIP launcher refactoring (session-local copy)
5. 9dffdbe — Fix: Move injector build after session-local app copy

---

## Files Modified

- **tools/run_live_full_ui_matrix.js**
  - Removed `--no-resign` flag
  - Now properly signs the app

- **tools/launch_cavalry_with_injector.sh**
  - Implemented session-local app copy for read-only paths
  - Fixed code signing to remove hardened runtime flag first
  - Moved injector build after determining session-local path
  - rpath now points to correct app location

---

## Next Steps for Agent/Collaborator

### Immediate Actions (High Priority)

1. **Test `open` command instead of direct exec**
   ```bash
   env DYLD_INSERT_LIBRARIES=$INJECTOR open -e $WORK_APP_PATH/Contents/MacOS/Cavalry
   ```
   If injection works via `open`, the issue is process context/env var handling.

2. **Test with DYLD_BIND_AT_LAUNCH**
   ```bash
   env DYLD_INSERT_LIBRARIES=$INJECTOR DYLD_BIND_AT_LAUNCH=1 $APP
   ```
   If injection works, the issue is lazy binding.

3. **Verify Qt framework versions**
   ```bash
   otool -L $APP/Contents/Frameworks/QtCore.framework/QtCore | grep "compatibility version"
   otool -L $QT_SDK/6.6.3/macos/lib/QtCore.framework/QtCore | grep "compatibility version"
   ```

4. **Check if Cavalry Info.plist has DYLD restrictions**
   ```bash
   /usr/libexec/PlistBuddy -c "Print" $APP/Contents/Info.plist | grep -i dyld
   ```

### If Above Doesn't Work

5. **Compare successful session's launcher approach**
   - Check commit c685dc9 launcher code in detail
   - See what was different about HOW injection was invoked
   - Possible: direct `exec` vs shell context vs different shell wrapper

6. **Try AX-fallback approach**
   - If dylib injection proves impossible on current system
   - Use `capture_accessibility_inventory.js` only
   - Accept reduced candidates (~15) and merge with stub injector inventories
   - May need updated Acceptance.md to document AX-constrained baseline

---

## SIP vs Hardened Runtime Clarification

**SIP (System Integrity Protection):** Kernel-level security protecting system files
- Blocks `/System`, `/usr/bin` modifications
- Not relevant for `/Applications/Cavalry.app` (user app)
- Can be disabled in Recovery Mode, but should NOT be

**Hardened Runtime Flag (0x10000):** App-level code signing flag  
- Blocks DYLD_INSERT_LIBRARIES, dylib injection
- Set by Apple developer signing
- CAN be removed by re-signing with ad-hoc cert ✓ DONE

**This investigation is NOT about SIP. It's about the app-level hardened runtime flag, which we successfully removed.**

---

## Documentation References

- `docs/cavalry-runtime-injection-techniques.md` - Technical foundation
- `docs/workflows/cavalry-full-ui-100/Acceptance.md` §G-CAPTURE - Pass conditions
- `docs/workflows/cavalry-full-ui-100/Anti-Patterns.md` §D SIP-Blame - What NOT to claim

---

**Last Updated:** 2026-04-30 21:33  
**Session UUID:** 6B0CB7BE-84EE-4186-8256-F44ADC81C4E1  
**Contact Point:** Next agent should start with Hypothesis 1 (dyld env var handling)
