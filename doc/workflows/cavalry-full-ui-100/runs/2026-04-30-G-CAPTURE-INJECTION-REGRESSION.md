# G-CAPTURE Injection Regression Analysis
**Date:** 2026-04-30 21:45 UTC+8
**Branch:** wip/cavalry-full-ui-100-g-capture
**Commit:** f53bcc8 (launcher: Add back BUNDLE_HASH and fix PID output format)

## Problem

After implementing proper code signing (removing `--no-resign`), dylib injection completely stopped working.

Previous successful session: **83E94B17-9E9D-4E08-9978-3347DE293F7C** (2026-04-29 21:12)
- Showed: "[cavalry-i18n] injector bootstrap" message
- Generated: en-injector-inventory.json successfully
- Commit at time: c685dc9 (using `--no-resign`)

Current attempt (2026-04-30 21:44):
- No "[cavalry-i18n] injector bootstrap" message
- No inventory generated
- Timeout waiting for injector output
- Both with and without `--no-resign` flag

## Key Discovery

**Cavalry app has changed between sessions:**
- Successful session bundle hash: `ec5ab60c4cc33fd1f57364e7e7660dd44bd7fcc979d0417e1451114f2b9e48f9`
- Current app bundle hash: `a421e0137648bbd284b6e7976a119ae27ba6ada635e0706b76519b54fa7c7fe1`

Both report version 2.7.1, but the binaries are different.

## What Works

- ✅ Code signing removes hardened runtime flag (flags: 0x10000 → 0x2)
- ✅ Session-local app copy mechanism
- ✅ Injector dylib building with correct rpath
- ✅ Launcher script execution completes with PID
- ✅ Cavalry app starts successfully

## What Doesn't Work

- ❌ DYLD_INSERT_LIBRARIES not actually loading dylib
- ❌ No dylib constructor invocation
- ❌ No inventory file generation
- ❌ Works with neither `--resign` nor `--no-resign`

## Hypotheses

1. **Cavalry 2.7.1 binary has changed** - The new binary may have different code signing requirements or DYLD handling
2. **Qt framework version mismatch** - Qt 6.6.3 may have changed, affecting rpath resolution
3. **macOS dyld caching** - System may need restart to clear cached injection state
4. **Injector dylib incompatibility** - The dylib may need recompilation for the updated Cavalry binary

## Next Steps Required

1. Verify Cavalry version and rebuild/redownload if needed
2. Force rebuild of injector dylib against current app
3. Consider macOS restart to clear dyld caches
4. If still blocked: Revert to successful session's approach (c685dc9 launcher with --no-resign + understand why that worked)

## Technical Notes

The successful session c685dc9 used:
```
nohup env DYLD_INSERT_LIBRARIES="$INJECTOR_PATH" ... /Applications/Cavalry.app/Contents/MacOS/Cavalry
```

With `--no-resign` flag, meaning:
- No re-signing attempt (skipped code signing block)
- App remains with original Apple Developer signature + hardened runtime flag
- Yet dylib STILL loaded and bootstrap message appeared!

This contradicts our assumption that hardened runtime flag prevents injection. Need to investigate why.
