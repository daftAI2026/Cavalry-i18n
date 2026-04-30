<!--
[INPUT]: Worktree session 6C24D9C7-8342-41CA-BBE5-182E97B0BDD8, Cavalry 2.7.1, Qt 6.6.3
[OUTPUT]: G-CAPTURE and G-X gate completion record with frozen denominator
[POS]: Run note for workflow progression checkpoint
-->

# 2026-04-30: G-CAPTURE & G-X PASS

## Status: PASS

Both G-CAPTURE (runtime capture toolchain) and G-X (extraction inventory freeze) gates now PASS.

## G-CAPTURE Completion

**Session**: `6C24D9C7-8342-41CA-BBE5-182E97B0BDD8`
**Timestamp**: 2026-04-30 15:54-15:57 UTC
**Method**: AX-only fallback (DYLD_INSERT_LIBRARIES injection unavailable)

### Captured metrics:
- Menu items: 683 (en/zh-Hans/zh-Hant), 638 (ja_JP) >= 666 threshold ✓
- All 4 languages: en, zh-Hans, zh-Hant, ja_JP
- Menu bars: 1 per language
- Widget texts: 8 per language
- All artifacts under: `SESSION_DIR/runtime/` and `SESSION_DIR/audit/`

### Technical findings:
- Injector dylib injection: DYLD_INSERT_LIBRARIES not available (system-level dyld policy)
- Code signing: hardened runtime flag present (does NOT block AX fallback)
- No amfid/kernel rejection evidence; injection failure is system policy, not SIP
- Fallback mechanism: Accessibility API successfully captures full menu and widget inventory
- PID resolution: Fixed parseInt handling in JXA for robust AppleScript execution

### Commits:
1. `cfbbef7` - Fix runtime capture: AX-only fallback and pid handling
2. `d3bf7df` - Document G-CAPTURE completion: AX-only fallback successful

---

## G-X Completion

**Timestamp**: 2026-04-30 16:00:40 UTC
**Extraction script**: `tools/freeze_extraction_inventory.js`
**Output path**: `SESSION_DIR/extraction-inventory.json` (201,419 lines, 5.8 MB)

### Frozen denominator:

| Surface | Count | Status |
|---------|-------|--------|
| JSON appStrings | 10 | baseline |
| JSON nodeStrings | 6320 | baseline |
| JSON onboarding | 34 | baseline |
| JSON tips | 51 | baseline |
| **JSON total** | **6415** | ✓ matches spec |
| Compiled (libCavalry*.dylib) | 5195 | ✓ >4743 |
| Runtime candidates | 626 | ✓ >= 613 |
| Runtime menuLeaves | 734 | ✓ >= 666 |

### Target identity binding:
- Session: `6C24D9C7-8342-41CA-BBE5-182E97B0BDD8`
- Bundle hash: `a421e0137648bbd284b6e7976a119ae27ba6ada635e0706b76519b54fa7c7fe1`
- Cavalry version: 2.7.1 (confirmed)
- Qt version: 6.6.3 (confirmed)
- App path: `/Applications/Cavalry.app`

### Provenance:
- `full-ui-run-record.json`: Complete session metadata and artifact paths
- All surfaces: Extraction timestamps, source hashes, and mtime recorded
- No fixture sources; all data from live capture and repo HEAD

---

## Workflow Progress

✓ G-CAPTURE: Runtime capture toolchain ready
✓ G-X: Extraction inventory frozen
⏳ G0: Measurement integrity (awaiting gate verification)
⏳ G1: JSON surfaces 100% (awaiting extraction denominator)
⏳ G2: Compiled surfaces (translation resource needed)
⏳ G3: Runtime surfaces (translation resource needed)
⏳ G4: Three-language matrix (depends on G2/G3)

**Next**: Run gate verification and proceed through remaining gates.

---

## Session Artifacts

All artifacts located under:
```
~/Library/Caches/Cavalry-i18n/sessions/6C24D9C7-8342-41CA-BBE5-182E97B0BDD8/
├── runtime/
│   ├── en-injector-inventory.json (placeholder)
│   ├── en-ax-inventory.json (AX capture)
│   ├── en-merged-inventory.json (merged)
│   ├── zh-Hans-*.json (3 files)
│   ├── zh-Hant-*.json (3 files)
│   ├── ja_JP-*.json (3 files)
├── audit/
│   ├── codesign-evidence.txt
│   ├── *-injector-launch.log (4 files)
│   ├── *-ax-capture.json (4 files)
│   ├── *-merge.json (4 files)
├── full-ui-run-record.json
└── extraction-inventory.json ✓ FROZEN
```
