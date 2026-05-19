<!--
[INPUT]: 依赖 worktree wip/cavalry-full-ui-100@69d6bfc、session 21B1048E-963E-43B1-975B-0C506902E0EB、Acceptance.md 的 G-CAPTURE 规则
[OUTPUT]: 对外提供 G-CAPTURE 当前真实状态修正记录，撤销 active 文档中的 SIP 结论
[POS]: runs 的状态校正记录，连接机器证据与 workflow 文档
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 2026-04-30: G-CAPTURE Worktree State Correction

## Status: FAIL

G-CAPTURE 仍未通过。当前第一失败 gate 是 runtime live capture 分母未成立，不是 SIP 阻塞。

## Evidence

- Worktree: `/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100`
- Branch: `wip/cavalry-full-ui-100`
- HEAD: `69d6bfc`
- Session UUID: `21B1048E-963E-43B1-975B-0C506902E0EB`
- Codesign evidence: `~/Library/Caches/Cavalry-i18n/sessions/21B1048E-963E-43B1-975B-0C506902E0EB/audit/codesign-evidence.txt`
- Launch log: `~/Library/Caches/Cavalry-i18n/sessions/21B1048E-963E-43B1-975B-0C506902E0EB/audit/en-injector-launch.log`
- Runtime inventory: absent; no `runtime/en-injector-inventory.json` exists for this session.

## Worktree Truth

- `tools/build_translator_injector.sh` now builds a universal dylib, sets `@rpath`, re-signs ad-hoc, and rejects `linker-signed`.
- `tools/launch_cavalry_with_injector.sh` now writes session-scoped codesign evidence and passes `CAVALRY_I18N_SESSION_DIR` / `CAVALRY_I18N_SESSION_UUID`.
- `desktop-patcher/injector/CavalryTranslatorInjector.mm` has English dump-only logic and writes `<lang>-injector-inventory.json` under `SESSION_DIR/runtime`.
- `tools/capture_accessibility_inventory.js`, `tools/merge_runtime_inventory.js`, and `tools/run_live_full_ui_matrix.js` exist.
- `tools/run_live_full_ui_matrix.js` currently calls launcher with `--no-resign`; that breaks the required launcher evidence chain and is not acceptable for G-CAPTURE.

## Correction

Active workflow docs must not say `BLOCKED-SIP`, recommend `csrutil disable`, or treat AX weak capture as a route into G-X. There is no recorded amfid / kernel rejection evidence in the preserved session.

The correct state is:

```text
Workflow: NOT COMPLETE
First failing gate: G-CAPTURE
Runtime candidates: unmet
Runtime menuLeaves: unmet
Required lower bound: candidates >= 613, menuLeaves >= 666
Allowed next work: debug dylib/dyld path or implement real interactive AX capture
Forbidden next work: lower bounds, fixtures, --no-resign bypass, G-X freeze
```

## Next Action

Return to the worktree and make the live capture chain produce real session artifacts:

1. Re-run launcher without `--no-resign`.
2. If injection still produces no inventory, inspect dylib linkage and dyld load behavior with `lipo`, `otool -L`, `otool -l`, `codesign -dv`, launch log, and amfid log.
3. If using AX fallback, automate menu/panel/submenu expansion until the resulting `live-merged` inventory reaches `>=613 / >=666` and records `menuDepthMax` plus submenu samples.
