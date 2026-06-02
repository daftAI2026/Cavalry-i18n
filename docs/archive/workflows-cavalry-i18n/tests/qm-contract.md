<!--
[INPUT]: 依赖 T2 产出的 tools/*.ts Qt 翻译源文件
[OUTPUT]: 对外提供 T3 .qm 编译的验证契约
[POS]: tests 层的 T3 contract，服务 M1
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# QM Contract (T3)

## Goal

验证每个语言目录下 `cavalry_*.qm` 和 `qtbase_*.qm` 存在且 size > 0。

## Behaviors

### B1: cavalry .qm 文件存在且非空

RED：`languages/{lang}/cavalry_{lang}.qm` 不存在或为空。

```bash
for LANG in zh-Hans zh-Hant ja_JP; do
  QM="languages/$LANG/cavalry_${LANG}.qm"
  if [ ! -f "$QM" ]; then
    echo "FAIL: $QM not found"; exit 1
  fi
  SIZE=$(wc -c < "$QM" | tr -d ' ')
  if [ "$SIZE" -le 0 ]; then
    echo "FAIL: $QM is empty"; exit 1
  fi
done
echo "PASS: B1"
```

GREEN：用 `lrelease` 编译 `tools/{lang}.ts` → `languages/{lang}/cavalry_{lang}.qm`。

### B2: qtbase .qm 文件存在且非空

RED：`languages/{lang}/qtbase_{lang}.qm` 不存在或为空。

```bash
for LANG in zh-Hans zh-Hant ja_JP; do
  QTBASE="languages/$LANG/qtbase_${LANG}.qm"
  if [ ! -f "$QTBASE" ]; then
    echo "FAIL: $QTBASE not found"; exit 1
  fi
  SIZE=$(wc -c < "$QTBASE" | tr -d ' ')
  if [ "$SIZE" -le 0 ]; then
    echo "FAIL: $QTBASE is empty"; exit 1
  fi
done
echo "PASS: B2"
```

GREEN：从 Qt 官方仓库下载 qtbase 翻译 .qm 文件。

### B3: file 命令识别为数据文件（可选 WARN）

```bash
for LANG in zh-Hans zh-Hant ja_JP; do
  QM="languages/$LANG/cavalry_${LANG}.qm"
  TYPE=$(file "$QM")
  if ! echo "$TYPE" | grep -qi "data\|Qt"; then
    echo "WARN: $QM type not recognized as Qt translation: $TYPE"
  fi
done
echo "PASS: B3 (informational)"
```

此行为为信息性检查，不影响 PASS/FAIL。

## Full Verification

执行者应将上述 B1-B3 的 bash 片段按顺序组合执行。B1 + B2 全部通过即为 T3 PASS。

## Pass/Fail

- **PASS**: B1 + B2 通过。
- **FAIL**: cavalry .qm 或 qtbase .qm 缺失或为空。
