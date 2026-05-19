# Next Steps: Completing the Cavalry Full-UI-100 Workflow

## Current Status

✅ **Workflow Infrastructure:** Fully functional and verified
- Session isolation working
- Gate verification automated
- Translation pipeline proven
- All 10 gates defined and structural integrity verified

⚠️ **Translation Execution:** 65% Complete
- 6 gates independent PASS
- 1 gate at 98% (functional)
- 2 gates blocked on compiled translation

## To Reach ALL GATES PASS

### 1. Complete JSON Surface (G1) — ~2 hours

**Remaining:** Only 1 untranslated entry per language (schema metadata)

**Action:** Verify these entries are in the no_translate whitelist
```bash
python3 tools/validate_translations.py --root . --json-report /tmp/report.json
```

**Expected:** G1 gate will automatically PASS once verified

### 2. Verify §P5 (Forbidden Patterns) — 5 minutes

After any translation batch:
```bash
node tools/detect_forbidden_patterns.js --session-dir $CAVALRY_I18N_SESSION_DIR
```

### 3. Translate Compiled Surface (G2) — 14,620 entries

**Use the translation template:**
```
docs/workflows/cavalry-full-ui-100/translation-backlog-template.csv
```

**Process:**

#### Option A: Batch Mode (Recommended)
```bash
# For each batch (500 entries):
1. Get English strings from template CSV
2. Translate to 3 languages
3. Add to tools/<lang>.ts in XML format
4. Run gate check: npm run check:full-ui
5. Commit batch
```

#### Option B: Tier-Based Mode
```bash
# Tier 1: Core UI (2000-2500 entries) — Highest impact
- File, Edit, View, Window menus
- Common actions: Add, Remove, Copy, Paste, Delete
- Status: ~1 week per language

# Tier 2: Common UI (1500-1800 entries)
- Buttons, dialogs, controls
- System messages
- Status: ~1 week per language

# Tier 3: Specialized (1300-1600 entries)
- Technical terms
- Plugin entries
- Advanced options
- Status: ~1 week per language
```

### 4. Format Translations to TS Files

Each translation should be added to `tools/<lang>.ts`:

```xml
<context>
  <name>Compiled::MenuItems</name>
  <message>
    <source>English String</source>
    <translation>Translated String</translation>
  </message>
  <!-- Repeat for each entry -->
</context>
```

Example:
```xml
<message>
  <source>File</source>
  <translation>文件</translation>
</message>
```

### 5. Validate Progress

After each 500 entries:
```bash
export CAVALRY_I18N_SESSION_DIR="/Users/luo/Library/Caches/Cavalry-i18n/sessions/24B1A045-0101-4859-B00F-63110A6D4B93"
npm run check:full-ui 2>&1 | grep -E 'language|coveragePct'
```

**Expected progression:**
- Start: ~6% coverage
- 500 entries: ~12% coverage
- 1000 entries: ~18% coverage
- ...
- 5195 entries: ~100% coverage

### 6. Parallel Translation Strategy

**For zh-Hans & zh-Hant:**
```bash
# Option 1: Translate zh-Hans first, then convert
# zh-Hant can leverage simplified→traditional conversion for some entries

# Option 2: Parallel translation
# Have separate translators work on both simultaneously
```

**For ja_JP:**
- Must be independent (different grammar, terminology)
- Start after zh-Hans to establish terminology glossary

### 7. Build Terminology Glossary

Before mass translation, create glossary:
```json
{
  "File": {"zh-Hans": "文件", "zh-Hant": "檔案", "ja_JP": "ファイル"},
  "Edit": {"zh-Hans": "编辑", "zh-Hant": "編輯", "ja_JP": "編集"},
  // ... etc for core UI terms
}
```

Use as reference to maintain consistency.

### 8. Run Final Verification

Once all translations complete:
```bash
npm run check:full-ui
```

Expected output:
```json
{
  "overallPass": true,
  "languages": [
    {"language": "ja_JP", "pass": true},
    {"language": "zh-Hans", "pass": true},
    {"language": "zh-Hant", "pass": true}
  ]
}
```

Then run G4 matrix:
```bash
npm run check:full-ui   # G4 gate passes automatically
```

## Effort Breakdown

| Phase | Duration | Effort | Blockers |
|-------|----------|--------|----------|
| G1 (JSON) | 30 min | Verification only | None |
| G2 Tier 1 | 2 weeks | 1 translator × 40 hrs | Translation expertise |
| G2 Tier 2 | 1 week | 1 translator × 25 hrs | Translation expertise |
| G2 Tier 3 | 1 week | 1 translator × 25 hrs | Translation expertise |
| G3 (Runtime) | COMPLETE | Done | None |
| G4 (Matrix) | 30 min | Verification only | G2 completion |

**Total:** 4-5 weeks with one dedicated translator per language

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Terminology inconsistency | Build glossary before starting, review every batch |
| Context loss | Reference Cavalry app for term usage, use existing translations |
| Translation drift | Run §P5 check after each language, validate with native speaker |
| Scale overwhelm | Use tier-based approach, parallelize languages, celebrate milestones |

## Files Ready for Translators

- **Template:** `docs/workflows/cavalry-full-ui-100/translation-backlog-template.csv`
- **Process:** This file (NEXT-STEPS.md)
- **Gate status:** See `WORKFLOW-EXECUTION-COMPLETE.md` for current metrics
- **Reference:** Look at existing translations in `tools/zh-Hans.ts` for examples

## Success Criteria

- [ ] G1 (JSON) independently PASS
- [ ] G3 (Runtime) independently PASS (already done)
- [ ] G2 (Compiled) independently PASS
- [ ] G4 (Matrix) independently PASS
- [ ] ALL GATES PASS declared in final run note
- [ ] Session 24B1A045 locked with 100% completion evidence

## Questions?

Refer to:
- `WORKFLOW-EXECUTION-COMPLETE.md` — Architecture & decisions
- `GATE-STATUS-PHASE-2-COMPLETE.md` — Phase 2 details
- `check_full_ui_matrix.js` — Gate verification logic
- Session RUN_RECORD.json — Artifact provenance

---

**Last Updated:** 2026-04-30T09:30Z
**Next Update:** After G2 first batch completion
**Target Completion:** 2026-05-21 (if 4-week timeline)
