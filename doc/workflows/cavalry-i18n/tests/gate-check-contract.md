<!--
[INPUT]: 依赖 runs/ 运行记录、Runbook.md 的执行顺序与 Acceptance.md 的 gate 定义
[OUTPUT]: 对外提供可脚本化 gate 检查契约，防止执行者跳过前置 run log
[POS]: tests 层的 gate contract，约束 prompt 之间的前置条件必须可验证
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Gate Check Contract

## Goal

Gate 不能只写成自然语言。每个阶段的前置条件必须可检查。

## Required Gate Status Format

每个可作为前置条件的 run log 必须包含：

```markdown
## Status

PASS
```

禁止模糊状态：

```text
DONE
OK
looks good
passed maybe
```

失败或废止必须包含：

```markdown
## Status

FAIL
```

或：

```markdown
## Status

INVALIDATED
```

或：

```markdown
## Status

BLOCKED
```

### Source of Truth

`## Status` 块中的**裸状态行**是唯一真相源。

- 允许：run log 顶部保留面向人类的历史状态说明，例如 `- **Status**: ~~PASS~~ → **INVALIDATED**`
- 禁止：脚本解析顶部 header 的 status 文本
- gate-check 只能读取 `## Status` 标题后的第一条非空裸状态行

## Gate Check Template

执行者可用以下 shell 检查 gate：

```bash
check_gate() {
  pattern="$1"
  label="$2"
  file="$(ls doc/workflows/cavalry-i18n/runs/$pattern 2>/dev/null | sort | tail -1)"

  if [ -z "$file" ]; then
    echo "BLOCKED: $label run log missing"
    return 1
  fi

  status="$(awk '
    /^## Status$/ { capture=1; next }
    capture && /^## / { exit }
    capture && NF { print; exit }
  ' "$file")"

  if [ "$status" = "PASS" ]; then
    echo "PASS: $label via $file"
    return 0
  fi

  echo "BLOCKED: $label is $status in $file"
  return 1
}

check_gate '*T0*.md' 'T0 Glossary'
check_gate '*-T1-*.md' 'T1 Extraction'
check_gate '*T1_1*.md' 'T1.1 Whitelist'
check_gate '*T2*.md' 'T2 Translation'
check_gate '*T3*.md' 'T3 QM Compile'
check_gate '*T4*.md' 'T4 Switcher'
check_gate '*T8*.md' 'T8 CI'
check_gate '*T9*.md' 'T9 README'
```

## Stage Gates

```text
T1.1 requires T1 PASS
T2 requires T0 PASS + T1.1 PASS
T2 PASS means translation-contract.md B1-B13 all pass, including B13 validator (`tools/validate_translations.py`)
T3 requires T2 PASS
T4 requires T1 PASS
T8 requires T3 PASS
T9 requires T8 PASS
M1 requires T0 PASS + T1 PASS + T1.1 PASS + T2 PASS + T3 PASS
M2 requires T4 PASS
M3 requires T8 PASS + T9 PASS
M_manual requires T3 PASS + T4 PASS (parallel with M3)
```

## Invalid Gate

Gate fails if:

- run log missing.
- run log has no `## Status`.
- latest matching run log is `FAIL` or `INVALIDATED` or `BLOCKED`.
- run log uses non-standard status like `DONE` or `OK`.

## Regression

```bash
grep -rn '^## Status$\|^PASS$\|^FAIL$\|^INVALIDATED$\|^BLOCKED$' doc/workflows/cavalry-i18n/runs/
```
