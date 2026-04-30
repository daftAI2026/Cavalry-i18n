<!--
[INPUT]: 依赖 doc/plan-v3.md 的用户使用流程、Acceptance.md 的 M3 验收条件
[OUTPUT]: 对外提供 T9 README + Release 的验证契约
[POS]: tests 层的 T9 contract，服务 M3
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# README Contract (T9)

## Goal

验证 `README.md` 包含必要章节和安装步骤，`LICENSE` 文件存在。

## Behaviors

### B1: README.md 存在

RED：`README.md` 不存在。

```bash
if [ ! -f "README.md" ]; then
  echo "FAIL: README.md not found"; exit 1
fi
echo "PASS: B1"
```

GREEN：创建 README.md。

### B2: 包含必要章节

RED：缺少安装 / 使用 / 语言 / 更新 / License 中的任何一个章节。

```bash
SECTIONS=("安装\|Install" "使用\|Usage" "语言\|Language" "更新\|Update" "License\|许可")
for SEC in "${SECTIONS[@]}"; do
  if ! grep -qiE "$SEC" "README.md"; then
    echo "FAIL: README missing section matching: $SEC"; exit 1
  fi
done
echo "PASS: B2"
```

GREEN：在 README 中添加所有必要章节。

### B3: 安装步骤 >= 3 个

RED：编号步骤（`1.` `2.` `3.` ...）少于 3 个。

```bash
STEP_COUNT=$(grep -cE "^[0-9]+\." "README.md" || echo 0)
if [ "$STEP_COUNT" -lt 3 ]; then
  echo "FAIL: README has fewer than 3 numbered steps (got $STEP_COUNT)"; exit 1
fi
echo "PASS: B3 ($STEP_COUNT steps)"
```

GREEN：按 plan-v3.md 第六节的用户使用流程编写安装步骤。

### B4: LICENSE 文件存在

RED：`LICENSE` 文件不存在。

```bash
if [ ! -f "LICENSE" ]; then
  echo "FAIL: LICENSE not found"; exit 1
fi
echo "PASS: B4"
```

GREEN：创建 LICENSE 文件。

## Full Verification

执行者应将上述 B1-B4 的 bash 片段按顺序组合执行。全部通过即为 T9 PASS。

## Pass/Fail

- **PASS**: 所有 B1-B4 通过。
- **FAIL**: 任一 behavior 失败。
