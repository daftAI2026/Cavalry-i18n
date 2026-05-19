<!--
[INPUT]: 依赖 Acceptance.md 的 W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0-G4 定义
[OUTPUT]: 对外提供 full-ui-100 的 gate 依赖与状态规范
[POS]: tests 层的 gate 契约
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Gate Check Contract

## Required Status Format

每个 markdown run note 的唯一状态真相源：

```markdown
## Status

PASS
```

允许状态：

- `PASS`
- `FAIL`
- `INVALIDATED`
- `BLOCKED`

禁止状态：

- `DONE`
- `OK`
- `looks good`

JSON session run record 是独立 artifact：

```text
SESSION_DIR/full-ui-run-record.json
```

## Gate Order

```text
W-AUDIT must convert reviewer red flags into failing tests before implementation starts
G-P provenance must pass before any gate input is trusted
§P5 detector wiring is only valid after G-P fixes the trusted input boundary
G-CAPTURE must pass before G-X freezes runtime denominator
G-X extraction inventory must pass before translation starts
G-P, §P5, G-CAPTURE and G-X must pass before any translation asset is trusted
G0 must pass before G1/G2/G3 are trusted
G2 and G3 must pass before translation-complete claims are trusted
G2/G3/G1 must all pass before G4 can pass
```

## Invalid Gate

gate 无效如果：

1. 对应 run note 缺失
2. status 不是标准值
3. 结果与最新基线冲突但未标记 `INVALIDATED`

## Final Rule

只有当：

```text
W-AUDIT = PASS
G-P = PASS
§P5 = PASS
G-CAPTURE = PASS
G-X = PASS
G0 = PASS
G2 = PASS
G3 = PASS
G1 = PASS
G4 = PASS
```

时，才能写：

```text
ALL GATES PASS
```
