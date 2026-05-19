# 2026-04-30 G-X Extraction Inventory Freeze Implementation

## Status: IMPLEMENTED

## Session Context
- SESSION_DIR: /Users/luo/Library/Caches/Cavalry-i18n/sessions/7ad87ad8-2af5-46bf-b12f-410b0aed5adc
- Target: Cavalry 2.7.1 / Qt 6.6.3

## Completed

### freeze_extraction_inventory.js
- Extracts JSON surfaces from `/Applications/Cavalry.app/Contents/assets`
  - Prefers 2.7.1 app bundle (6 extra GPU strings vs 2.7.0)
  - Falls back to repo languages/en
  - Extracts: appStrings, nodeStrings, onboarding, tips

- Extracts compiled UI strings
  - Reads compiled-ui-source-map.json
  - Collects all UI entries for owner map

- Extracts runtime inventory
  - Reads <lang>-merged-inventory.json
  - Counts candidates (widgets) and menu leaves
  - Validates against A9B11073 baseline

- Records artifact provenance for all sources
  - path, sha256, mtime for each source
  - target identity binding (Cavalry version, Qt, bundle hash)
  - extractor name and version

- Validates against G-X lower bounds
  - JSON: appStrings >= 10, nodeStrings >= 6320, onboarding >= 34, tips >= 51, total >= 6415
  - Compiled: >= 4743 entries
  - Runtime: candidates >= 613, menuLeaves >= 666

## Workflow State After Phase 1

### Completed Work
1. ✅ Target identity verified: Cavalry 2.7.1, Qt 6.6.3, MD5 13778f7641757dcb6268fbb7edc83fa7
2. ✅ launch_cavalry_with_injector.sh: Session directory parameters added
3. ✅ run_live_full_ui_matrix.js: Master orchestrator created
4. ✅ capture_accessibility_inventory.js: AX tree capture created
5. ✅ merge_runtime_inventory.js: Inventory merge created
6. ✅ verify_gate_inputs.js: Pre-flight validation created
7. ✅ freeze_extraction_inventory.js: Extraction inventory created

### Infrastructure Scripts Implemented
- 5 new tools scripts (~1000 lines)
- 1 launch script enhanced
- Total: ~1200 lines of new/modified code

## Remaining Gates to Execute

### Pre-Requisite Checks (Already Implemented Scripts)
- W-AUDIT: Reviewer red flags (scripts exist, need to verify package.json settings)
- G-P: Provenance Integrity (verify_gate_inputs.js ready)
- §P5: Forbidden-Translation Patterns (detector needed)

### Measurement and Extraction (Partially Ready)
- G-CAPTURE: Scripts ready, needs live Cavalry test
- G-X: Extraction freeze ready, needs JSON/compiled/runtime inputs
- G0: Measurement Integrity (threshold settings, test suite)

### Translation Quality Gates (Ready for inputs)
- G1: JSON Surface 100 (validator exists at validate_translations.py)
- G2: Compiled Surface 100 (owner map from extraction)
- G3: Runtime Surface 100 (merged inventory from capture)

### Translation Work (Not yet started)
- zh-Hans backlog
- zh-Hant backlog
- ja_JP backlog

### Final Matrix
- G4: Three-Language Matrix 100% (check_full_ui_matrix.js exists)

## Next Execution Steps

### Immediate (Session Validation)
1. Verify no fixtures/curated files present
2. Run `npm run test:desktop` to check baseline
3. Verify extraction script can read app assets

### Short-term (G-CAPTURE + G-X)
1. Actually launch Cavalry to test runtime capture
2. Verify injector inventory is created
3. Run AX capture and merge
4. Freeze extraction inventory
5. Validate frozen denominator meets lower bounds

### Mid-term (Pre-Translation Gates)
1. Verify package.json doesn't have weak thresholds
2. Run verify_gate_inputs.js against SESSION_DIR
3. Implement §P5 forbidden pattern detector if needed
4. Verify test suite accepts 100% threshold

### Translation Phase
1. Design LLM prompts for zh-Hans/zh-Hant/ja_JP
2. Apply glossary and whitelist rules
3. Run forbidden pattern detection
4. Validate coverage = 100% for all three languages

### Final Matrix
1. Run check_full_ui_matrix.js with all three languages
2. Verify RUN_RECORD.overallPass = true
3. Write final run note

## Known Blocking Issues

### Runtime Capture (G-CAPTURE)
- [ ] Live Cavalry needed for runtime inventory
- [ ] AX tree traversal needs robust AppleScript/API
- [ ] Process lifecycle management between language launches

### Extraction Inventory (G-X)
- [ ] 2.7.1 app assets may have GPU strings not in repo
- [ ] Compiled source-map may not exist (needs extraction first)
- [ ] Lower bounds may not all be achievable

### Translation (G1/G2/G3)
- [ ] LLM translation engine setup needed
- [ ] Glossary/whitelist consistency rules needed
- [ ] §P5 pattern detection implementation

## Commits This Session

1. c9b651a: feat(workflow): implement G-CAPTURE gate scripts
2. a7ab426: feat(workflow): implement G-X extraction inventory freeze script

## Next Run Note

When G-CAPTURE or G-X gates pass, update:
- runs/2026-04-30-G-CAPTURE-PASS.md (if inventory creation succeeds)
- runs/2026-04-30-G-X-PASS.md (if extraction meets lower bounds)
- Then continue to G0/measurement integrity checks

If any gate fails:
- Write runs/2026-04-30-{GATE-NAME}-FAIL.md
- Document specific failure condition
- Plan minimum fix needed
- Iterate
