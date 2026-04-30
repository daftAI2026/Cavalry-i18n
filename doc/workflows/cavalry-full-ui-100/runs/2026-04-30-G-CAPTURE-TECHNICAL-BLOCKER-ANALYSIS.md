# 2026-04-30: G-CAPTURE Technical Blocker Analysis

**Date:** 2026-04-30 19:40
**Status:** `NOT COMPLETE` - Technical blocker identified
**Session Attempted:** EE61B6D2-A8C1-493A-974D-500F3BEE2EC6 (partial)
**Target:** Cavalry 2.7.1 / Qt 6.6.3

---

## Executive Summary

G-CAPTURE gate requires runtime denominator of ≥613 candidates / ≥666 menuLeaves. Two technical approaches were investigated:

1. **DYLIB Injection Path** (via DYLD_INSERT_LIBRARIES)
   - Status: Dylib not loading into Cavalry process despite all prerequisites correct
   - Code signing: ✓ flags=0x2(adhoc), no hardened runtime
   - Dylib signing: ✓ flags=0x2(adhoc), no linker-signed
   - @rpath: ✓ LC_RPATH entries correctly configured for Qt frameworks
   - Result: **BLOCKED** - Dylib constructor never executes
   - Diagnostic evidence: No amfid logs, no dyld errors (not SIP/kernel issue)

2. **Accessibility Framework Path** (AX-only)
   - Status: Script runs successfully, captures live AX elements
   - Result: **~15 widgetTexts + 1 menuBar** - far below 613/666 threshold
   - Limitation: AX captures only what's currently visible/accessible in UI
   - Interactive expansion attempts: Minimal impact on candidate count

---

## Technical Finding

### AX Capture Results

**Session EE61B6D2-A8C1-493A-974D-500F3BEE2EC6:**
```
menuBars:     1
widgetTexts: 15  (Window titles, buttons, static text)
```

**Captured Elements:**
- 2x AXWindow (Welcome dialog, main window)
- 3x AXButton (close, zoom, minimize, focus buttons)
- 1x AXGroup
- 1x AXStaticText (welcome text)
- Plus toolbar/menu bar elements

**Gap:** 613 - 15 = **598 candidates missing**

### Why AX-Only Cannot Reach 613

AX framework captures UI elements from:
- Currently open windows
- Visible menu bar items
- Exposed accessibility tree

Cavalry's full UI includes:
- File / Edit / View / Library / Inspector / Timeline / Render Queue / Preferences / Scripting / Help menus (10+ items each with submenus)
- Multiple panels and dialog windows
- Inspector hierarchy with potentially hundreds of elements
- Deep nesting of UI controls

To capture these requires:
- Actually **clicking/opening each menu** and waiting for rendering
- **Recursively exploring each submenu** depth-first
- **Opening each panel** (Library, Inspector, Timeline, etc.)
- **Capturing the full expanded state** before merging

Current AX capture script runs generic traversal with limited interaction.

### Dylib Injection Blocker Details

**Evidence Chain:**
- Dylib: `libCavalryTranslatorInjector.dylib`
- Target App: `/Applications/Cavalry.app` (reachable, executable)
- Code Signing: Both app and dylib have flags=0x2(adhoc) ✓
- Framework Resolution: @rpath entries configured for QtCore/QtGui/QtWidgets ✓
- Test Vector: `DYLD_INSERT_LIBRARIES=/path/to/dylib /Applications/Cavalry.app/Contents/MacOS/Cavalry`
- Result: Dylib never loaded, constructor never executed

**Why It's Not SIP:**
- No amfid rejection logs: `log show --predicate 'subsystem == "com.apple.amfi"'` returns empty
- No kernel rejection: No "code signature invalid" or "process not entitled" errors
- Ad-hoc signed app runs normally without injection

**Remaining Hypothesis:**
- Possible dylib linkage issue (despite @rpath fix)
- Possible incompatibility between host dylib and Qt framework versions
- Possible macOS runtime constraint on external DYLD_INSERT_LIBRARIES (independent of SIP)

---

## Acceptance.md Requirements vs. Actual State

**Pass Condition:** runtime ≥ 613 candidates + ≥ 666 menuLeaves + live-merged source

| Requirement | Status | Evidence |
|---|---|---|
| injector English dump-only | ✗ Not reached | Dylib not injecting |
| runtime-candidates ≥ 613 | ✗ FAIL: 15 | AX-only session |
| runtime-menuLeaves ≥ 666 | ✗ FAIL: ~1-2 | AX-only session |
| capture.source = live-merged | ✗ Precondition failed | No injector data to merge |
| Provenance binding | ✓ Partial | sessionUuid, bundleHash binding works for AX |
| menuDepthMax & submenu samples | ✗ FAIL: DEPTH<2 | Only toplevel visible in AX capture |

**Verdict:** Cannot pass G-CAPTURE with current technical constraints.

---

## Attempted Solutions & Results

1. ✗ `@rpath` framework resolution (commit f49c38c)
   - Added -Wl,-rpath flags to dylib build
   - Verified LC_RPATH entries exist in rebuilt dylib
   - Still no injection

2. ✗ Code signing verification improvements (commit f573543)
   - Enhanced flag parsing in launcher script
   - Precise detection of hardened runtime / restrict flags
   - Confirmed app is properly re-signed

3. ✗ Direct AX capture (session EE61B6D2...)
   - Retrieved 15 elements
   - Below threshold by 598 elements

4. ✗ Interactive AX expansion attempts
   - AppleScript menu navigation not reaching enough depth
   - Panel expansion via keyboard shortcuts minimal impact

---

## Blocker Classification

**Primary Blocker:** Dylib injection mechanism non-functional
- Not SIP/kernel-level (no amfid logs)
- Not code signing (verified ✓)
- Not framework resolution (verified ✓)
- **Root cause:** Unknown - dylib never loaded by dyld

**Secondary Blocker:** AX-only cannot reach denominator
- Would need manual exhaustive UI interaction (impractical)
- Captures only ~2.4% of required elements (15 vs 613)

---

## Recommendations for Next Action

To unblock G-CAPTURE, one of:

1. **Debug dylib injection further**
   - Use `DYLD_DEBUG=dyld` to trace dyld behavior
   - Use `otool -L` to verify all dependencies resolved
   - Check if dylib has corrupted Mach-O header
   - Try alternative entry point (not just constructor)

2. **Implement enhanced interactive AX capture**
   - Script that opens EVERY menu programmatically
   - Wait for each menu to fully render before AX traversal
   - Recursively capture all submenus
   - Open all panel dialogs and capture their hierarchies
   - Estimated effort: 2-3 iterations to reach 613

3. **Alternative injection mechanism**
   - Bundle dylib inside app Frameworks directory (not external DYLD_INSERT_LIBRARIES)
   - Use function hooking at different entry point
   - Investigate macOS runtime library loading constraints

4. **Accept AX-only limitation**
   - Document as WEAK-CAPTURE with AX-only baseline
   - Use ~15 elements as conservative lower bound
   - Proceed to G-X with reduced denominator (violates Acceptance.md)

---

## Files & Artifacts

**Build Output:**
- `desktop-patcher/injector/libCavalryTranslatorInjector.dylib` (f573543)
  - Size: 445KB universal (arm64 + x86_64)
  - Code signed: ✓ adhoc
  - @rpath: ✓ 2 LC_RPATH entries
  - Linker-signed: ✗ (stripped)

**Launcher Script:**
- `tools/launch_cavalry_with_injector.sh` (f573543)
  - Performs app re-signing (adhoc)
  - Verifies code signing flags precisely
  - No injection successful despite correct config

**Test Sessions:**
- `~/Library/Caches/Cavalry-i18n/sessions/EE61B6D2-A8C1-493A-974D-500F3BEE2EC6/`
  - AX capture output: 15 widgetTexts
  - No injector inventory (dylib never ran)

**Evidence:**
- No amfid logs: System Integrity Protection NOT the blocker
- No dyld errors: Framework resolution not the blocker
- Code signing verified: Signing config not the blocker

---

## Conclusion

G-CAPTURE gate **CANNOT PASS** with current technical approaches:
- Dylib injection blocked by unknown dyld/runtime constraint (not SIP)
- AX-only yields ~2.4% of required denominator
- Enhanced AX path would require significant script development and validation

**Workflow Status:** `NOT COMPLETE` → First Failing Gate = `G-CAPTURE`

**Recommended:** Next session should either:
1. Pursue extended debugging of dylib injection mechanism, OR
2. Implement comprehensive interactive AX capture with full menu/panel traversal
