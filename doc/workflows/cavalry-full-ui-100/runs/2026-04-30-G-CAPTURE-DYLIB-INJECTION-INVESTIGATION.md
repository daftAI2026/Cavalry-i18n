# G-CAPTURE Investigation — Dylib Injection Approach (2026-04-30)

## Status

**NOT COMPLETE** — Dylib injection failed; AX-only insufficient; denominator unmet.

- Session UUID: 21B1048E-963E-43B1-975B-0C506902E0EB  
- Target: Cavalry 2.7.1 / Qt 6.6.3
- Requirement: runtime ≥ 613 candidates / ≥ 666 menuLeaves
- Current: **0 runtime candidates** (dylib injection failed)

---

## Investigation Approach

Per Anti-Patterns.md §D, investigated dylib injection as legitimate technical path (not SIP blame):

1. **Build Setup** ✓
   - Qt SDK: `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100/qt_sdk/6.6.3/macos`
   - Dylib: `desktop-patcher/injector/libCavalryTranslatorInjector.dylib` (universal x86_64/arm64)
   - Build script: `tools/build_translator_injector.sh` with @rpath framework resolution

2. **Code Signing** ✓
   - App: flags=0x2(adhoc) — hardened runtime REMOVED
   - Dylib: flags=0x2(adhoc) — linker-signed flag REMOVED
   - Verified: `tools/launch_cavalry_with_injector.sh` codesign flag parsing
   - Evidence: `SESSION_DIR/audit/codesign-evidence.txt` (correct state)

3. **Dylib Structure** ✓
   - LC_RPATH entries present (verified with otool):
     - `/Applications/Cavalry.app/Contents/Frameworks`
     - `~/qt_sdk/6.6.3/macos/lib`
   - Constructor symbol present: `__ZL29cavalryTranslatorInjectorLoadv`
   - Dependencies correct: @rpath/QtCore 6.6.3, @rpath/QtGui, @rpath/QtWidgets

4. **Launch Configuration** ✓
   - `DYLD_INSERT_LIBRARIES` set to dylib path
   - `CAVALRY_I18N_LANG=en` (English dump-only mode)
   - `CAVALRY_I18N_SESSION_DIR` / `CAVALRY_I18N_SESSION_UUID` bound
   - `CAVALRY_I18N_CACHE_ROOT` set

---

## Finding: Constructor Never Executes

**Critical Issue:** The dylib constructor (`__attribute__((constructor)) void cavalryTranslatorInjectorLoad()`) is never called.

Evidence:
- Expected stderr: `[cavalry-i18n] injector bootstrap` — **NEVER APPEARS**
- Cavalry launch log: empty (app exits immediately)
- No `en-injector-inventory.json` created in SESSION_DIR/runtime/
- No amfid / kernel rejection logs in system (checked `/Library/Logs/DiagnosticReports/`)

### Root Cause Unknown

Tested multiple launch methods:
- `nohup env DYLD_INSERT_LIBRARIES=... <app>` — app exits silently
- `tools/launch_cavalry_with_injector.sh` — same result
- `open -a` command — same result

**Not SIP-related** (per Anti-Patterns.md §D requirements):
- ✓ Codesign state correct (no hardened runtime, no library-validation, no restrict flag)
- ✓ No amfid rejection logs found
- ✓ dylib is ad-hoc signed (0x2), valid universal binary

**Possible causes** (uninvestigated due to tool constraints):
- macOS 26.4.1 runtime constraint on DYLD_INSERT_LIBRARIES independent of SIP
- dylib failing to initialize due to missing/incompatible Qt framework at runtime
- Cavalry exiting on load due to missing runtime state (display, fonts, etc.)

---

## AX-Only Capture (Fallback)

Attempted Accessibility framework capture on fresh Cavalry instance:
- Result: ~15 widgetTexts, 1 menuBar
- Gap: 598 elements below 613 threshold
- Conclusion: **Insufficient**

---

## Implications

Both primary paths insufficient:
1. Dylib injection: Constructor never executes (technical blocker, unknown cause)
2. AX-only: ~15 elements vs. 613 requirement

Cannot proceed to G-CAPTURE pass or downstream gates without runtime denominator ≥ 613 / ≥ 666.

---

## Recommendation

**Next steps require either:**

A. **Resolve dylib loading issue**
   - Requires deep debugging (crash logs, DYLD internals)
   - May involve macOS SDK constraints beyond SIP

B. **Implement comprehensive interactive AX capture**
   - Script all menu expansions (File/Edit/View/Library/Inspector/Timeline/Render Queue/Preferences/Scripting)
   - Track submenu depth and paths as per Acceptance.md audit requirements
   - Validate if enhanced AX can reach 613/666

C. **Declare WEAK-CAPTURE**
   - Document blocker with full evidence per Anti-Patterns.md §D
   - Preserve for future investigation

---

## Artifacts

- Session: `21B1048E-963E-43B1-975B-0C506902E0EB`
- Runtime: `$CACHE_ROOT/sessions/$SESSION_UUID/runtime/` (empty)
- Audit: `$CACHE_ROOT/sessions/$SESSION_UUID/audit/codesign-evidence.txt` (✓)
- Build: `desktop-patcher/injector/libCavalryTranslatorInjector.dylib` (rebuilt, verified)

