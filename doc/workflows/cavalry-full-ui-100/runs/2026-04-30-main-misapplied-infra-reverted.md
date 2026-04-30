<!--
[INPUT]: 依赖 Copilot session 89db6c1a、main commits c9b651a/a7ab426/94b4364、Runbook.md Stop Conditions
[OUTPUT]: 对外提供误提交归档、quarantine 分支与 main 清理结果
[POS]: runs 目录中的 INVALIDATED 记录，阻止后续 agent 复用错误 session 结论
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Main Misapplied Infrastructure Reverted

## Status

`INVALIDATED`

## Session

Copilot session:

```text
/Users/luo/.copilot/session-state/89db6c1a-fb4c-4a4d-8a90-7fffd661abac
```

## What Happened

The session was instructed to execute code work in:

```text
/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100
```

But it operated in main repo:

```text
/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n
```

It created three commits on `main`:

- `c9b651a` - G-CAPTURE scripts
- `a7ab426` - G-X freeze script
- `94b4364` - §P5 detector

The session then stopped with `Task complete` while workflow state was still `NOT COMPLETE`.

## Why Invalidated

- It did not run live G-CAPTURE.
- It did not produce `SESSION_DIR/full-ui-run-record.json`.
- It did not produce `SESSION_DIR/extraction-inventory.json`.
- It did not prove `menuDepthMax >= 2`.
- It did not produce submenu path samples.
- It used non-standard run note statuses such as `IMPLEMENTED` / `INFRASTRUCTURE PHASE COMPLETE`.
- It modified the wrong code worktree.

## Preservation

The mistaken main tip was preserved as:

```text
quarantine/main-misapplied-full-ui-infra-94b4364
```

## Cleanup

Main was cleaned with a non-destructive revert commit:

```text
e1f663b Revert misapplied full-ui infrastructure commits
```

The correct execution worktree remains:

```text
/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100
```

Do not use session `89db6c1a` as proof of G-CAPTURE, G-X, or workflow completion.
