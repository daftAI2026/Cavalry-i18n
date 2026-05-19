# 2026-04-30 G-CAPTURE DYLD_INSERT_LIBRARIES Injection Failure Analysis

**Date**: 2026-04-30 22:05  
**Branch**: wip/cavalry-full-ui-100-g-capture  
**Current Commit**: a4668d7

## Problem Statement

DYLD_INSERT_LIBRARIES environment variable is not injecting the translator dylib into the Cavalry process, despite multiple approaches and environment configurations.

### Observable Behavior

- **Expected**: Cavalry stdout contains `[cavalry-i18n] injector bootstrap` and exports `*-injector-inventory.json` files
- **Actual**: Cavalry runs normally without any injector output or inventory files
- **Dylib Status**: Dylib loads and executes correctly when called directly via ctypes.CDLL()
- **Dylib Constructor**: __attribute__((constructor)) at line 661 of CavalryTranslatorInjector.mm executes successfully in direct load test

## Key Evidence

### 1. Dylib Direct Load WORKS
```bash
python3 -c "import ctypes; ctypes.CDLL('$HOME/Library/Caches/Cavalry-i18n/libCavalryTranslatorInjector.dylib')"
# Output: [cavalry-i18n] injector bootstrap
```

### 2. Direct env var Launch FAILS
```bash
DYLD_INSERT_LIBRARIES="$INJECTOR" "$APP_BIN"
# Output: No [cavalry-i18n] messages, no inventory files
```

### 3. nohup Launch FAILS
```bash
nohup env DYLD_INSERT_LIBRARIES="$INJECTOR" "$APP_BIN" > log.txt 2>&1 &
# Result: Log contains only "Cavalry will remind you..." and "Welcome to Cavalry"
# No injector bootstrap message
```

### 4. Session-local App Copy FAILS  
```bash
cp -r /Applications/Cavalry.app /tmp/cavalry-copy.app
DYLD_INSERT_LIBRARIES="$INJECTOR" /tmp/cavalry-copy.app/Contents/MacOS/Cavalry
# Result: Same failure - no injection
```

### 5. --no-resign Bypass FAILS
```bash
bash launcher.sh --app /Applications/Cavalry.app --no-resign --lang en
# Result: Same failure - no injection, no inventory
```

### 6. Proper Ad-hoc Signing FAILS
```bash
codesign --force --deep --sign - /Applications/Cavalry.app
# Result: "internal error in Code Signing subsystem" for crashpad_handler
# Even without this error, no injection occurs
```

## Previous Success Baseline

### Session 83E94B17 (Apr 29 21:12-21:14)
- **Status**: PASS - Injector worked, inventories generated for all 4 languages
- **Launcher Log**: Shows `[cavalry-i18n] injector bootstrap` and menu inventory exports
- **Dyld Error**: Shows dyld error about QtCore not found, but injection still succeeds
- **Result**: Full inventories with merging complete

### Session E32A6C8D (Apr 29 17:36-17:38)
- **Status**: PASS - Injector worked, inventories generated
- **Dylib Location**: /Users/luo/Library/Caches/Cavalry-i18n/sessions/E32A6C8D-33C3-4F7A-95F3-D87D594692E1/apps/Cavalry.app/Contents/Frameworks/libCavalryTranslatorInjector.dylib
- **Result**: Full inventories generated

## Analysis

### Theory 1: System/OS Change
- Possible macOS security policy update since Apr 29
- Amfid (Apple Mobile File Integrity Daemon) might have tightened restrictions  
- DYLD_INSERT_LIBRARIES might be blocked globally for code-signed binaries

### Theory 2: Cavalry App Update
- Cavalry binary changed (hash: a421e0137648bbd284b6e7976a119ae27ba6ada635e0706b76519b54fa7c7fe1)
- Previous success used hash: ec5ab60c4cc33fd1f57364e7e7660dd44bd7fcc979d0417e1451114f2b9e48f9
- New binary might have different security flags or entitlements

### Theory 3: Injector Dylib Issue
- Qt framework linking changed from @rpath/QtCore to @rpath/QtCore.framework/Versions/A/QtCore
- Direct load shows this works (dyld error is not fatal)
- But DYLD_INSERT_LIBRARIES approach might have stricter validation

### Theory 4: Nohup/Background Process Issue
- Environment variables might not be properly passed through nohup
- Process context might be different in background vs foreground
- TTY attachment might matter

## Attempts Made

1. ✗ Using `--no-resign` to bypass signing  
2. ✗ Proper ad-hoc signing with codesign --deep
3. ✗ Removing hardened runtime flag (0x10000 → 0x2)
4. ✗ Session-local app copy to /tmp
5. ✗ Qt framework linking changes (@rpath/QtCore vs @rpath/QtCore.framework/Versions/A/QtCore)
6. ✗ Different Qt SDK versions (6.6.3 vs 6.11.0)
7. ✗ Explicit DYLD_BIND_AT_LAUNCH=1
8. ✗ Direct launch vs nohup vs env command
9. ✗ Both signed and unsigned app configurations
10. ✗ Reverting launcher script changes to original from main

## Recommendations

### Immediate Next Steps

1. **Check Cavalry Version**: Compare Cavalry 2.7.1 binary from successful session vs current
2. **Check System Logs**: Use `log show` for detailed amfid/dyld debug output
3. **Manual Process Inspection**: Use lldb/gdb to trace dyld behavior
4. **Fallback Capture**: Implement AX-only dynamic menu/control capture with user interaction

### If Injection Cannot Be Restored

1. Use capture_accessibility_inventory.js as primary method
2. Implement interactive menu expansion script
3. Target minimum 613 candidates and 666 menu leaves from AX alone
4. Accept that this branch may not reach G-X without external intervention

## File References

- Main launcher: tools/launch_cavalry_with_injector.sh
- Build script: tools/build_translator_injector.sh
- Injector source: desktop-patcher/injector/CavalryTranslatorInjector.mm
- Matrix orchestrator: tools/run_live_full_ui_matrix.js
- AX fallback: tools/capture_accessibility_inventory.js

## Session Results

| Session | Date/Time | Injector | Inventory | Status |
|---------|-----------|----------|-----------|--------|
| 83E94B17 | 2026-04-29 21:12 | ✓ | ✓ | PASS |
| E32A6C8D | 2026-04-29 17:36 | ✓ | ✓ | PASS |
| 5E1D66C0 | 2026-04-30 21:56 | ✗ | ✗ | FAIL |
| 97B644CC | 2026-04-30 22:01 | ✗ | ✗ | FAIL |
| 6FC6BF5E | 2026-04-30 22:02 | ✗ | ✗ | FAIL |

