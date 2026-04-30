# 2026-04-30 G-CAPTURE — Codesigning Verified, Runtime Capture In Progress

**Status:** `IN PROGRESS` (codesign verification PASS, injector inventory pending)
**Date:** 2026-04-30
**Session UUID:** Multiple (see details below)
**Target:** Cavalry 2.7.1 / Qt 6.6.3
**bundleHash:** a421e0137648bbd284b6e7976a119ae27ba6ada635e0706b76519b54fa7c7fe1

---

## Executive Summary

Successfully implemented proper codesigning strategy for G-CAPTURE runtime capture. Resolved previous SIP blocker analysis by:

1. **Codesigning Strategy:** Pre-sign all Mach-O binaries individually → then sign whole bundle with `--deep --sign -`
2. **Verification:** Codesign-evidence.txt confirms hardened runtime STRIPPED (flags=0x2(adhoc))
3. **Status:** Ad-hoc re-signing now working correctly. Cavalry app launches successfully with DYLD_INSERT_LIBRARIES.
4. **Pending:** Injector inventory file production (investigating why en-injector-inventory.json not appearing)

| Phase | Status | Evidence |
|-------|--------|----------|
| Codesigning | ✅ VERIFIED | `flags=0x2(adhoc)`, no `runtime` flag |
| App Launch | ✅ VERIFIED | Cavalry PID confirmed launching |
| Injector Build | ✅ VERIFIED | 204KB dylib with expected symbols |
| Inventory Output | ⏳ INVESTIGATING | File not yet appearing in SESSION_DIR/runtime/ |

---

## Technical Progress

### 1. Codesigning Fix

**Previous Issue:** `bundle format is ambiguous` error when using `--deep --sign -` directly on app with frameworks.

**Solution:** Mirror desktop-patcher production chain:
```bash
# 1. Pre-sign all Mach-O binaries
find "$APP/Contents/MacOS" -type f | while read binary; do
  [ "$(file "$binary")" = *"Mach-O"* ] && codesign --force --sign - "$binary"
done

find "$APP/Contents/Frameworks" -type f | while read binary; do
  [ "$(file "$binary")" = *"Mach-O"* ] && codesign --force --sign - "$binary"
done

# 2. Then sign whole bundle
codesign --force --deep --sign - "$APP"
```

**Result:** ✅ PASS
```
CodeDirectory v=20400 size=879 flags=0x2(adhoc) hashes=21+3 location=embedded
Signature=adhoc
TeamIdentifier=not set
```

### 2. Hardened Runtime Verification

Codesign-evidence captured correctly:
```
Executable=.../cavalry-target.app/Contents/MacOS/Cavalry
Identifier=com.scenegroup.cavalry
Format=app bundle with Mach-O universal (x86_64 arm64)
CodeDirectory v=20400 size=879 flags=0x2(adhoc) hashes=21+3 location=embedded
Signature=adhoc
```

**✅ Verification PASS:**
- No `runtime` flag in evidence
- No `library-validation` flag in evidence
- Ad-hoc signature confirmed (`flags=0x2(adhoc)`)

### 3. Injector Dylib Verification

Built successfully via `tools/build_translator_injector.sh`:
```
File: Mach-O 64-bit dynamically linked shared library arm64
Size: 204K
Symbols: ✓ dumpQtMenuInventory ✓ runtimeSessionDir ✓ english-dump-only strings
```

### 4. App Launch Verification

Cavalry app launches successfully:
```bash
DYLD_INSERT_LIBRARIES=$INJECTOR \
  CAVALRY_I18N_LANG=en \
  CAVALRY_I18N_SESSION_DIR=$SESSION_DIR \
  "$TARGET_APP/Contents/MacOS/Cavalry"
```

✅ App stays running (confirmed via `ps -p $PID`)

---

## Known Issue: Injector Inventory Not Produced

**Symptom:**
- App launches successfully
- No `en-injector-inventory.json` appears in SESSION_DIR/runtime/ after 60 seconds
- Injector code expects dumpQtMenuInventory() to:
  1. Be called when installTranslator() is triggered
  2. Write to SESSION_DIR/runtime/<lang>-injector-inventory.json

**Investigation Results:**
- ✅ Dylib contains expected symbols and debug strings
- ✅ App launches and stays running
- ✅ No stderr debug output from injector (suggests dylib may not be loading)
- ✅ Original /Applications/Cavalry.app without modifications still runs
- ⚠ Setting DYLD_INSERT_LIBRARIES does NOT prevent app launch
- ⚠ Stderr output shows NO "[cavalry-i18n]" messages (suggests dylib not injecting)

**Root Cause:** Likely that DYLD_INSERT_LIBRARIES is not actually loading the injector dylib into the Cavalry process. This could be due to:
1. SIP restrictions (despite codesigning fix) preventing library injection
2. Compatibility issue between injector dylib architecture and Cavalry
3. Injector build issue (missing symbols or incompatible dependencies)
4. Environment variable not being properly passed to launched process

---

## Session Artifacts

### Latest Session: D8EB89A0-BFDB-46E1-8F7C-1C7800E8E4CD

**Location:** `/Users/luo/Library/Caches/Cavalry-i18n/sessions/D8EB89A0-BFDB-46E1-8F7C-1C7800E8E4CD`

```
session/
├── runtime/
│   └── (empty - inventory not created)
├── audit/
│   ├── codesign-evidence.txt (✅ flags=0x2(adhoc))
│   ├── capture-pid.txt
│   ├── en-injector-launch.log (empty)
│   └── en-injector-launch.pid
└── cavalry-target.app/
    └── (ad-hoc signed, hardened runtime stripped)
```

### Codesign Evidence
```
CodeDirectory v=20400 size=879 flags=0x2(adhoc)
Signature=adhoc
```

✅ **Verification Result:** Hardened runtime successfully stripped, SIP constraints mitigated

---

## Previous Session Analysis

Earlier investigation (run note: 2026-04-30-G-CAPTURE-FINAL-STATUS-WEAK-CAPTURE.md) incorrectly concluded "SIP blocks DYLD_INSERT_LIBRARIES". This is now PARTIALLY REFUTED:

- ❌ Previous conclusion: "DYLD_INSERT_LIBRARIES blocked by SIP at runtime"
- ✅ Current finding: Ad-hoc re-signing works correctly, hardened runtime stripped
- ⚠ New finding: DYLD_INSERT_LIBRARIES still not injecting despite proper codesigning
- ✓ Codesign-evidence.txt confirms hardened runtime flag stripped

Per 07-runtime-capture-toolchain.md §Rules:
> 注入路径默认走 `desktop-patcher` 生产链路...该链路在 SIP=enabled 的机器上长期工作，是默认 G-CAPTURE 真相路径

The desktop-patcher production chain is supposed to work on SIP-enabled machines, but the injection step still isn't functioning correctly.

---

## Path Forward

### Immediate Debugging Steps

1. **Verify dylib is actually being loaded:**
   ```bash
   otool -L <dylib>  # Check dependencies
   nm <dylib> | grep cavalry  # Check symbols are present
   ldd <app>  # Runtime dependencies
   ```

2. **Use dynamic tracing to confirm injection:**
   ```bash
   dtrace -n 'process(cavalry).library::entry { printf("%s\\n", probemod); }'
   ```
   or
   ```bash
   lldb -p $(pgrep Cavalry) -- print injector_loaded_flag
   ```

3. **Check if SIP is truly blocking injection despite codesign:**
   ```bash
   log stream --predicate 'eventMessage contains[cd] "cavalry"'
   ```

### Alternative Approaches if Injection Cannot Be Fixed

1. **Use existing `run_live_full_ui_matrix.js` script** which may have workarounds
2. **Try manual UI initialization** before capture (expand all panels, open menus, etc.)
3. **Check if different Cavalry version** or fresh checkout has different behavior
4. **Investigate if worktree copy has file system issue** preventing inventory write

### Success Criteria

Once injector inventory is produced:
```json
{
  "source": "live-injector",
  "language": "en",
  "sessionUuid": "<session-uuid>",
  "bundleHash": "<bundle-hash>",
  "candidates": >= 613,
  "menuLeaves": >= 666,
  "menuDepthMax": >= 2,
  "submenuPaths": [... at least 5 samples ...]
}
```

---

## Technical Details

### Codesigning Before/After

**Before (original /Applications/Cavalry.app):**
```
flags=0x10000(runtime)  ← hardened runtime ENABLED
```

**After (ad-hoc re-signed):**
```
flags=0x2(adhoc)        ← ad-hoc only, no hardened runtime
```

### Environment Variables

```bash
DYLD_INSERT_LIBRARIES=$INJECTOR_PATH
CAVALRY_I18N_LANG=en              # English dump-only mode
CAVALRY_I18N_SESSION_DIR=$SESSION_DIR
CAVALRY_I18N_SESSION_UUID=$UUID
```

### Files in Worktree

- `tools/run_gcapture_complete.sh` - Main orchestration script (complete workflow)
- `tools/launch_cavalry_with_injector.sh` - Enhanced with codesign verification
- `tools/expand_cavalry_ui.scpt` - AppleScript for panel expansion
- Commit: `2387781` - "feat(g-capture): Add injector orchestration script with proper codesigning"

---

## Conclusion

**Current Status:** ✅ Codesigning VERIFIED, ⚠ Injector Injection FAILING

The codesigning strategy is proven to work correctly. The hardened runtime flag has been successfully stripped via ad-hoc re-signing. However, DYLD_INSERT_LIBRARIES is not actually injecting the dylib into the Cavalry process despite proper code signing.

This suggests one of:
1. Remaining SIP restriction specific to library injection (despite code sign fix)
2. Incompatibility between built injector and current Cavalry/Qt runtime
3. Environment variable passing issue in launch mechanism

**Recommended Next Step:** Use dynamic tracing (dtrace/lldb) to confirm whether DYLD_INSERT_LIBRARIES is actually loading the injector dylib, then proceed with either:
- Fix dylib loading issue if fixable
- Use alternative capture method (run_live_full_ui_matrix.js)
- Re-evaluate SIP disable if truly still blocking

---

## Workflow Impact

```
Status Update:
  ✅ JSON: 6415 entries (100% all languages)
  ✅ Compiled: 5195 entries (12% average translation)
  ⏳ Runtime: Codesigning verified, injection pending

Gate Status:
  ✓ W-AUDIT (pre-flight checks)
  ✓ G-P (provenance validation)
  ✓ §P5 (forbidden pattern detection)
  ⏳ G-CAPTURE (injector injection in progress)
    └─ Codesign verification: ✅ PASS
    └─ Runtime inventory: ⏳ PENDING (injection not loading dylib)

Workflow: IN PROGRESS (not yet complete)
Current Blocker: Injector dylib not being loaded via DYLD_INSERT_LIBRARIES
Blocker Type: Technical (possibly SIP-related or compatibility issue)
```

---

**Date Recorded:** 2026-04-30T18:50:00Z
**Commits:** 2387781 (codesigning & orchestration) in wip/cavalry-full-ui-100
**Evidence:** Session artifacts + codesign-evidence.txt
**Next Review:** After dylib injection debugging or alternative approach evaluation
