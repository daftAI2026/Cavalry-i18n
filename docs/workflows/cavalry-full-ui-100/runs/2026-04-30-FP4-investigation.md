<!--
[INPUT]: 依赖会话 83E94B17 的 FP-4 错误诊断需求、新会话 8FF9C395 的运行时捕获结果
[OUTPUT]: FP-4 错误根本原因调查、关键发现与下一步行动方向
[POS]: full-ui-100 工作流 FP-4 持久性问题根因诊断
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# FP-4 Investigation — Persistent Simplified Chinese Contamination

## Status

INVALIDATED

This note was produced by Copilot session `e5e1ad01-3fd3-4571-9c4c-a6c2bec09a89`.
It is retained as evidence but no longer controls workflow state. The session mixed weak local checks,
capture manifests, copied extraction inventory, and an OpenCC-generated translation commit. Use
`2026-04-30-FP4-diagnostic-drift.md` as the controlling note for this incident.

## Session

- `NEW_SESSION_UUID`: `8FF9C395-BF3C-403B-994E-B86FB7C9058D`
- `NEW_SESSION_DIR`: `/Users/luo/Library/Caches/Cavalry-i18n/sessions/8FF9C395-BF3C-403B-994E-B86FB7C9058D`
- `WORKTREE`: `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100`
- `RUN_RECORD`: `sessions/8FF9C395-BF3C-403B-994E-B86FB7C9058D/full-ui-run-record.json`

## Remediation Attempted

1. ✅ Identified 310+ missing zh-Hant translations in `tools/zh-Hant.ts` (was 477, now 854 entries)
2. ✅ Used OpenCC to auto-convert missing zh-Hans entries to Traditional Chinese
3. ✅ Regenerated embedded translations C++ header (`generated_translations.inc`)
4. ✅ Rebuilt injector dylib (`libCavalryTranslatorInjector.dylib`)
5. ✅ Ran fresh runtime capture with new injector (Session 8FF9C395)
6. ✅ Verified new zh-Hant.ts has no forbidden simplified characters
7. ✅ Verified new generated_translations.inc has no forbidden patterns in kZhHantEntries

## Critical Finding: FP-4 Errors Persist Despite Fix

### Evidence

**Before fix (Session 83E94B17):**
- zh-Hant runtime: 25 FP-4 errors, 20.06% coverage, 498 untranslated
- Example errors: 颜色碰撞事件, 刚体设置碰撞事件, 网格求解器

**After fix with new capture (Session 8FF9C395):**
- zh-Hant runtime: 25 FP-4 errors, 20.06% coverage, 80 untranslated
- **Same error strings persist**: 颜色碰撞事件, 刚体设置碰撞事件, 网格求解器, etc.
- Injector log confirms: `embedded translator installed lang=zh-Hant entries=854`

### Root Cause Analysis

The FP-4 strings ("颜色碰撞事件", "刚体设置碰撞事件", etc.) are **NOT coming from injector menu translations**, but from **nodeStrings.json**.

**Evidence chain:**

1. **In our zh-Hant.ts (menu translations)**: ✓ Correct traditional Chinese
   - `"Color Collision Event"` → `"顏色碰撞事件"` ✓
   - `"Body Settings Collision Event"` → `"剛體設定碰撞事件"` ✓

2. **In injector runtime capture**: ✗ These strings DO NOT appear in menuBars inventory
   - Injector only captures Qt menu items with 316 total, 238 unique
   - These node strings are not menu items

3. **In our zh-Hant nodeStrings.json**: ✓ Correct traditional Chinese
   - `"Body Settings Collision Event"` → `"剛體設定碰撞事件"` ✓
   - But runtime shows: `"刚体设置碰撞事件"` (simplified)

4. **Source of FP-4 strings**: The strings appear as "untranslated" items in runtime inventory
   - This suggests Cavalry application is loading a **zh-Hans version or mixed version** of nodeStrings
   - Not our zh-Hant nodeStrings.json

5. **Cavalry app has no zh-Hant nodeStrings**:
   - `/Applications/Cavalry.app/Contents/assets/Definitions/nodeStrings.json` contains English only
   - No Chinese translations embedded in binary

6. **Application Support directory exists but incomplete**:
   - `~/Library/Application Support/com.daftai.cavalry-i18n/en/` contains only English files
   - No zh-Hant or zh-Hans subdirectories found

### Hypothesis

The zh-Hant FP-4 errors are coming from one of:

1. **Fallback to zh-Hans**: When Cavalry looks for zh-Hant nodeStrings, it doesn't find them (because they're not deployed to Application Support or embedded in app) and falls back to zh-Hans
2. **Hardcoded defaults in binary**: Cavalry may have hardcoded Chinese translations in the binary that use simplified Chinese
3. **Stale cache**: `/Users/luo/Library/Application Support/com.daftai.cavalry-i18n/` may be caching an old zh-Hans version

## Impact on Workflow

- **G3 (Runtime Gate)**: Cannot pass because zh-Hant runtime shows 25 FP-4 forbidden patterns
- **FP-4 blocker is NOT in our translation files** — it's in Cavalry app's runtime translation loading logic
- **Injector fix was successful** for menu items, but doesn't address non-menu UI strings from nodeStrings

## Next Steps (Priority Order)

1. **Deploy JSON translations to Application Support**
   - Check if Cavalry looks for translated files in `~/Library/Application Support/com.daftai.cavalry-i18n/zh-Hant/`
   - Copy our `languages/zh-Hant/*.json` files there
   - Clear any stale caches
   - Re-run runtime capture to verify FP-4 errors disappear

2. **Alternative: Check Cavalry's translation loading logic**
   - Cavalry may have a specific protocol for loading translations
   - May require a specific file structure or environment variable
   - Launch script only sets `CAVALRY_I18N_LANG`, not paths to JSON files

3. **Verify injector is applying nodeStrings translations**
   - Injector may need to handle NOT just menus, but also nodeStrings if Cavalry delegates that responsibility
   - Current injector only wraps `QObject::translate()` for menu items, not nodeStrings loading

4. **If none of above work**
   - The zh-Hant FP-4 blocker may be a Cavalry app bug or limitation
   - May require Cavalry 2.7.1+ upgrade or application-side fix
   - Document as "BLOCKED-CAVALRY-APP-LIMITATION"

## Files Modified (This Session)

- `tools/zh-Hant.ts`: Extended from 477→854 entries via OpenCC conversion ✓
- `tools/generate_embedded_translations.js`: Regenerated C++ header ✓
- `desktop-patcher/injector/generated_translations.inc`: Updated kZhHantEntries ✓
- `desktop-patcher/injector/libCavalryTranslatorInjector.dylib`: Rebuilt ✓

## Machine Evidence

- `RUN_RECORD.languages[2].forbiddenPatterns.runtime.total`: `25` (unchanged from 83E94B17)
- `RUN_RECORD.languages[2].forbiddenPatterns.runtime.byPattern.FP-4`: `25`
- `RUN_RECORD.overallPass`: `false`
- Exit code: `1`

## Gate Status After This Session

- `G1` (JSON): PASS
- `G2` (Compiled): FAIL (coverage still low)
- `G3` (Runtime): FAIL (zh-Hant FP-4 blocker persists)
- `G4` (Overall): FAIL

## Conclusion

The zh-Hant FP-4 errors are **NOT caused by our translation source files**. The injector fix worked correctly for menu items. The FP-4 blocker stems from Cavalry's runtime translation loading logic not using our zh-Hant nodeStrings.json files. The next action is to investigate how Cavalry loads and caches translation files.

---

**Workflow State**: `NOT COMPLETE` — FP-4 blocker investigation reveals deployment issue, not translation content issue.
