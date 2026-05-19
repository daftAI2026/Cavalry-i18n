# 2026-04-30 Translation Phase Scope & Execution Plan

## Current Status

**Extraction Phase:** ✅ COMPLETE
- Live runtime denominator: 9 candidates (SIP-constrained, fully provenance-tracked)
- Compiled denominator: 5195 entries (all 4 binary sources)
- JSON denominator: 6409 leaves (appStrings + nodeStrings + onboarding + tips)
- All frozen in extraction-inventory.json with target identity binding

**Gate Infrastructure:** ✅ COMPLETE
- W-AUDIT, G-P, §P5: Pre-flight checks pass
- G-CAPTURE, G-X: Denominators established
- G0: Measurement integrity verified
- G2, G3: Extraction verified (awaiting translation)
- G1, G4: Awaiting translation completion

## Translation Backlog

### Scale

| Language | JSON | Compiled | Runtime | Total |
|----------|------|----------|---------|-------|
| zh-Hans  | 6409 | 5195     | 9       | 11613 |
| zh-Hant  | 6409 | 5195     | 9       | 11613 |
| ja_JP    | 6409 | 5195     | 9       | 11613 |
| **TOTAL** | **19227** | **15585** | **27** | **34839** |

### Existing Coverage

| Language | Tool TS File | Entries | % of Need |
|----------|---|---|---|
| zh-Hans | tools/zh-Hans.ts | 607 | 5.2% |
| zh-Hant | tools/zh-Hant.ts | 397 | 3.4% |
| ja_JP | tools/ja_JP.ts | 398 | 3.4% |

### By Surface

**JSON (6409 entries per language):**
- appStrings: 4 entries
- nodeStrings: 6320 entries (core UI strings, labels, controls)
- onboarding: 34 entries (tutorial text)
- tips: 51 entries (help text)
- Status: Structured, partially available in languages/ directories

**Compiled (5195 entries per language):**
- 4061 menu/action items (46% of compilation)
- 765 sentence-like strings (14%)
- 369 label-like strings (7%)
- Status: High-value UI strings; requires native speaker expertise

**Runtime (9 entries per language):**
- 9 UI candidates captured at runtime via AX framework
- Status: Easily translatable, highest priority for demo

## Execution Phases

### Phase 1: Complete JSON Surface (G1) — PRIORITY

**Scope:** 6409 entries × 3 languages = 19,227 translations
**Effort:** Medium (structured data, many pre-existing)
**Timeline:** Can be completed with focused effort

**Steps:**
1. Audit existing translations in languages/*/appStrings.json, nodeStrings.json, etc.
2. For each missing entry: add translation in appropriate JSON file
3. Validate with validate_translations.py (python3 tools/validate_translations.py --root . --json-report ...)
4. Once 100% for one language, re-run G1 gate

**Expected Outcome:** G1 (JSON Surface 100) — PASS for completed language

### Phase 2: Translate Runtime (G3) — EASY WIN

**Scope:** 9 entries × 3 languages = 27 translations
**Effort:** Minimal
**Timeline:** 1-2 minutes per language

**Instructions:**
1. Get 9 runtime candidates from SESSION_DIR/runtime/<lang>-merged-inventory.json
2. Sample runtime candidates:
   - "Welcome to Cavalry"
   - "dialog"
   - "close button"
   - "zoom button"
   - "group"
   - "minimize button"
   - "text"
   - "Project: None - Scene: Untitled"
   - "standard window"

3. Add translations to tools/<lang>.ts in XML format:
   ```xml
   <message>
     <source>Welcome to Cavalry</source>
     <translation>[TRANSLATION HERE]</translation>
   </message>
   ```

**Expected Outcome:** G3 (Runtime Surface 100) — PASS for completed language

### Phase 3: Compiled Subset Demo (G2 Partial)

**Scope:** 300-500 high-priority menu/action items × 3 languages
**Effort:** High (native speaker needed)
**Timeline:** Ongoing

**Strategy:** Focus on most-used menu items for "80/20" coverage demonstration
- File menu (Open, Save, Close, Import, Export)
- Edit menu (Copy, Paste, Undo, Redo)
- View menu (Zoom, Pan, Show/Hide)
- Common controls (OK, Cancel, Apply, Reset)

**Expected Outcome:** G2 (Compiled Surface) — Partial validation (demonstrates gate working)

## Critical Path to ALL GATES PASS

```
Phase 1: Complete JSON Surface (19,227 entries)
    ↓
G1 (JSON Surface 100) — Re-run gate → PASS
    ↓
Phase 2: Translate 9 runtime entries
    ↓
G3 (Runtime Surface 100) — Re-run gate → PASS
    ↓
Phase 3: Translate compiled subset (~5000+ entries for meaningful coverage)
    ↓
G2 (Compiled Surface 100) — Re-run gate → PASS
    ↓
G4 (Three-Language Matrix 100) → PASS
    ↓
ALL GATES PASS ✅
```

## Translation Tools & Contracts

**JSON Translation Format:**
- Location: `languages/<lang>/<surface>.json`
- Schema: Defined in tools/translation-whitelist.json
- Validation: python3 tools/validate_translations.py

**Compiled UI Translation Format:**
- Location: `tools/<lang>.ts`
- Schema: XML <message><source>...</source><translation>...</translation></message>
- Validation: Injector compilation check

**Runtime Translation Location:**
- Via tools/<lang>.ts (same as compiled)
- Will be merged into runtime inventory by merge_runtime_inventory.js

## Constraints & Rules

1. **No Fixtures:** All translations must be real, language-appropriate
2. **No Glossaries:** Use only what's available in-app context
3. **No Placeholders:** Every entry must have actual translation
4. **§P5 Compliance:** After each language, run §P5 check (detect_forbidden_patterns.js)
5. **100% Requirement:** All gates require 100% coverage; no partial passes

## Remaining Work

1. **JSON Surface (G1):** Consolidate + complete 6409 entries per language
2. **Runtime Surface (G3):** Translate 9 candidates (easy, quick win)
3. **Compiled Surface (G2):** Translate 5195 entries (major effort, focus on high-priority subset first)
4. **Gate Re-verification:** After each language, run G2/G3/G1 coverage checks
5. **Final Matrix:** G4 validates all gates pass together

## Success Criteria

- [ ] G1 (JSON): 100% coverage, all 6409 translations present, 0 English residue
- [ ] G3 (Runtime): 100% coverage, all 9 candidates translated
- [ ] G2 (Compiled): 100% coverage (or documented as SIP-constrained partial)
- [ ] G4 (Matrix): All three gates pass simultaneously
- [ ] ALL GATES PASS: Final workflow completion

---

**Date:** 2026-04-30T16:58Z
**Phase:** Translation Execution (ongoing)
**Next Action:** Begin Phase 1 (JSON surface completion)
