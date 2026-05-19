<!--
[INPUT]: 依赖 docs/cavalry-glossary-en-zh.md（初始术语表）、docs/translation-guidelines.md（翻译原则）
[OUTPUT]: 对外提供 T0 术语表扩展的验证契约
[POS]: tests 层的 T0 contract，服务 M1
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Glossary Contract (T0)

## Goal

验证 `docs/cavalry-glossary.md` 已扩展为四语言术语表（en / zh-Hans / zh-Hant / ja_JP），数据完整、简繁差异正确、不翻译项保持英文。

## Behaviors

### B1: 文件存在且表头包含四列语言

RED：`docs/cavalry-glossary.md` 不存在或表头缺列。

```bash
FILE="docs/cavalry-glossary.md"
if [ ! -f "$FILE" ]; then echo "FAIL: file not found"; exit 1; fi
HEAD=$(head -1 "$FILE")
for COL in "en" "zh-Hans" "zh-Hant" "ja_JP"; do
  if ! echo "$HEAD" | grep -q "$COL"; then
    echo "FAIL: header missing column '$COL'"; exit 1
  fi
done
echo "PASS: B1"
```

GREEN：创建包含四列表头的 glossary 文件。

### B2: 数据行数 >= 78

RED：数据行不足 78 行（原始 en→zh-Hans 术语数量）。

```bash
DATA_LINES=$(grep "^|" "docs/cavalry-glossary.md" | grep -v "^|--" | grep -v "^| en" | wc -l | tr -d ' ')
if [ "$DATA_LINES" -lt 78 ]; then
  echo "FAIL: expected >= 78 data rows, got $DATA_LINES"; exit 1
fi
echo "PASS: B2 ($DATA_LINES rows)"
```

GREEN：填充所有术语行，确保 >= 78 条。

### B3: 无空单元格

RED：存在连续两个 `|` 之间只有空格的行。

```bash
EMPTY=$(grep -E '\|[[:space:]]*\|' "docs/cavalry-glossary.md" | grep -v "^|--" | wc -l | tr -d ' ')
if [ "$EMPTY" -gt 0 ]; then
  echo "FAIL: found $EMPTY rows with empty cells"; exit 1
fi
echo "PASS: B3"
```

GREEN：补全所有空单元格。

### B4: 简繁差异对存在

RED：关键简繁差异对缺失。

```bash
FILE="docs/cavalry-glossary.md"
PAIRS=("儲存" "檔案" "預設" "影片" "程式" "資訊")
for ZH_TW in "${PAIRS[@]}"; do
  if ! grep -q "$ZH_TW" "$FILE"; then
    echo "FAIL: expected zh-Hant term '$ZH_TW' not found"; exit 1
  fi
done
echo "PASS: B4"
```

GREEN：确保保存→儲存、文件→檔案、默认→預設、视频→影片、程序→程式、信息→資訊 均在 glossary 中。

### B5: 不翻译项在所有列保持英文

RED：品牌名/缩写在 zh-Hant 或 ja_JP 列被翻译。

```bash
FILE="docs/cavalry-glossary.md"
for KEEP in "Cavalry" "Canva" "Lottie" "RGB" "JSON" "FPS" "GPU"; do
  LINE=$(grep "| $KEEP " "$FILE" || true)
  if [ -n "$LINE" ]; then
    COUNT=$(echo "$LINE" | grep -o "$KEEP" | wc -l | tr -d ' ')
    if [ "$COUNT" -lt 4 ]; then
      echo "FAIL: '$KEEP' should appear in all 4 language columns, found $COUNT"; exit 1
    fi
  fi
done
echo "PASS: B5"
```

GREEN：确保不翻译项在四列中值完全一致。

## Full Verification

执行者应将上述 B1-B5 的 bash 片段按顺序组合执行。全部通过即为 T0 PASS。

## Pass/Fail

- **PASS**: 所有 B1-B5 通过。
- **FAIL**: 任一 behavior 失败。
