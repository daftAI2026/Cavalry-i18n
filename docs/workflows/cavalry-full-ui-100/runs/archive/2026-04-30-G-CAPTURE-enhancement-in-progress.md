# G-CAPTURE Enhancement In Progress

<!--
[INPUT]: 依赖 current session 24B1A045, improved AX depth, appStrings GPU entries
[OUTPUT]: 对外提供 G-CAPTURE 下界缺口分析、SIP 阻塞确认、与改进方向
[POS]: runs 目录中的 FAIL + PLAN 记录，为 G-CAPTURE / G-X 突破做准备
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

## Status

`FAIL + IN-PROGRESS`

## Evidence

### Current Bounds (after appStrings GPU entries and AX depth improvement)

| Surface | Lower Bound | Current | Status |
| --- | ---: | ---: | --- |
| runtime candidates | 613 | 9 | ❌ FAIL |
| runtime menuLeaves | 666 | 0 | ❌ FAIL |
| appStrings.json | 10 | 10 | ✓ PASS |
| nodeStrings.json | 6320 | 6320 | ✓ PASS |
| onboarding.json | 34 | 34 | ✓ PASS |
| tips.json | 51 | 51 | ✓ PASS |
| JSON total | 6415 | 6415 | ✓ PASS |

### Change Summary

1. **appStrings.json**: Added 6 GPU-related error messages (auth.error: 2, gpu.unsupported: 6) = 8 total entries
   - Source: `/Applications/Cavalry.app/Contents/assets/Definitions/appStrings.json`
   - Extracted from live Cavalry 2.7.1 bundle

2. **AX Capture Depth**: Increased from 8 to 25 for deeper UI tree traversal
   - Modified `tools/capture_accessibility_inventory.js` line 324
   - Committed as: `779a868 fix(g-capture): Add GPU appStrings entries and improve AX depth traversal`

3. **Injector Status**: Confirmed SIP blocker prevents DYLD_INSERT_LIBRARIES injection
   - `run_live_full_ui_matrix.js` times out waiting for injector output
   - AX-only capture fallback yields 7-15 widgetTexts

## Root Cause Analysis

### SIP Blocker Confirmed
- System Integrity Protection (macOS kernel-level) prevents DYLD_INSERT_LIBRARIES injection for code signing enforcement
- This is a permanent OS-level constraint, not a configuration issue
- Only bypass: User manually disables SIP (security risk, not recommended workflow)

### Incomplete AX Traversal
- Current AX capture only finds main window + ~7-15 UI elements
- Does not interact with application to expand panels (Library, Inspector, Timeline, Render Queue, Preferences)
- Depth limit increase (8→25) helps but insufficient without active panel exploration

## Interpretation

- JSON lower bounds are now MET (appStrings 10/10 ✓)
- Runtime lower bounds are BLOCKED by SIP + incomplete panel discovery
- Per Runbook rule: "AX-only 弱抓取低于已知 A9B11073 基线却继续进入 G-X" = FAIL
- Per Runbook rule: "不允许 fixture / curated / root-cache runtime inventory" = cannot fake it

## Next Gate

G-CAPTURE requires implementation of **Interactive AX Capture** to:
1. Launch Cavalry with full UI initialization
2. Use AppleScript to open all major panels
3. Perform deep AX traversal (depth > 20)
4. Collect runtime menuLeaves via recursive menu walk
5. Reach 613+ candidates and 666+ menuLeaves

This aligns with Acceptance.md requirement:
> "runtime 抽取必须主动覆盖：Library / Inspector / Timeline / Render Queue / Preferences"

## Blockers

- **G-CAPTURE lower bounds** not met (runtime candidates 9 << 613, menuLeaves 0 << 666)
- **SIP constraint** requires creative non-injection approach (interactive AX)
- **Effort**: Medium to High (complex AppleScript choreography needed)

## Final Workflow State

```text
NOT COMPLETE
First blocker: G-CAPTURE denominator lower bounds unmet
```
