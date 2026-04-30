# 2026-04-30 — G-CAPTURE Work in Progress

## Summary

Fixed critical issues blocking G-CAPTURE, but signature signing process is still stalling on nested binaries. Previous successful sessions exist (e.g., `83E94B17-9E9D-4E08-9978-3347DE293F7C`) showing that the injector CAN produce valid runtime inventories when properly deployed.

## Changes Made

1. **Removed `--no-resign` flag** from `tools/run_live_full_ui_matrix.js` (line 131)
   - Previous implementation was bypassing code signing entirely, preventing proper injection
   - This was the root cause of failure to generate runtime inventories

2. **Updated launcher script** (`tools/launch_cavalry_with_injector.sh`)
   - Now detects if app is in read-only location (/Applications)
   - Creates session-local copy for proper code signing
   - Improved signature removal and re-signing logic
   - Relaxed hardened runtime check per specification (specification allows it per prompts/07)

3. **Architecture decision**: Session-local app copy
   - `/Applications/Cavalry.app` is read-only and can't be modified
   - Launcher now cp's the app to `$SESSION_DIR/cavalry-target.app` for signing
   - This isolation ensures G-CAPTURE session independence

## Current Blocker

The nested codesign operation is stalling during signing loop on many dylibs:
- Removing signatures from 100+ dylibs works fine
- Re-signing each dylib individually works (seen via parallel codesign output)
- But the signing loop appears to stall indefinitely

## Evidence

Previous successful session `83E94B17-9E9D-4E08-9978-3347DE293F7C`:
- Generated `en-injector-inventory.json` (2300 lines)
- Generated zh-Hans, zh-Hant, ja_JP injector inventories
- Merged inventories for all 4 languages
- Runtime lower bounds: candidates >= 613, menuLeaves >= 666 ✓

## Next Steps

1. **Debug signature stalling**
   - Option A: Simplify signing to avoid individual dylib re-signing (use `--deep --sign - app`)
   - Option B: Add timeout and graceful fallback to AX-only mode
   - Option C: Pre-sign all dylibs in a background thread

2. **Run matrix capture** once signing is fixed
   - `node tools/run_live_full_ui_matrix.js --languages en,zh-Hans,zh-Hant,ja_JP`
   - Should generate runtime inventories in `$SESSION_DIR/runtime/`

3. **Verify inventory metrics**
   - `tools/check_runtime_ui_coverage.js` to validate candidates >= 613, menuLeaves >= 666

4. **Proceed to G-X** once G-CAPTURE passes

## Spec References

- `doc/workflows/cavalry-full-ui-100/Acceptance.md` §G-CAPTURE
- `doc/workflows/cavalry-full-ui-100/prompts/07-runtime-capture-toolchain.md`
- `doc/cavalry-runtime-injection-techniques.md` §5 (code signing dance)

## Commits

- d3178d2: Remove --no-resign flag from matrix runner
- 5549f6b: Relax hardened runtime check in launcher
- 2ecdfe5: WIP launcher refactoring with session-local app copy
