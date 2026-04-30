<!--
[INPUT]: 依赖 Cavalry app bundle 路径、doc/plan-v3.md 的项目结构定义
[OUTPUT]: 对外提供 T1 英文字符串提取的验证契约
[POS]: tests 层的 T1 contract，服务 M1
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Extraction Contract (T1)

## Goal

验证 `languages/en/` 下包含从 Cavalry app bundle 提取的完整英文原文 JSON，且 `tools/extract_strings.py` 存在。

## Behaviors

### B1: en/ 目录存在

RED：`languages/en/` 目录不存在。

```bash
if [ ! -d "languages/en" ]; then
  echo "FAIL: languages/en/ directory not found"; exit 1
fi
echo "PASS: B1"
```

GREEN：创建 `languages/en/` 目录。

### B2: 必需文件存在

RED：缺少 nodeStrings.json / appStrings.json / tips.json / onboarding.json 中的任何一个。

```bash
for F in "nodeStrings.json" "appStrings.json" "tips.json" "onboarding.json"; do
  if [ ! -f "languages/en/$F" ]; then
    echo "FAIL: missing languages/en/$F"; exit 1
  fi
done
echo "PASS: B2"
```

GREEN：从 Cavalry app bundle 复制对应 JSON 文件到 `languages/en/`。

### B3: plugins 子目录存在且含 JSON

RED：`languages/en/plugins/` 不存在或无 JSON 文件。

```bash
if [ ! -d "languages/en/plugins" ]; then
  echo "FAIL: languages/en/plugins/ not found"; exit 1
fi
PLUGIN_COUNT=$(ls languages/en/plugins/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$PLUGIN_COUNT" -lt 1 ]; then
  echo "FAIL: no JSON files in languages/en/plugins/"; exit 1
fi
echo "PASS: B3 ($PLUGIN_COUNT plugins)"
```

GREEN：从 Cavalry app bundle 复制插件 JSON。

### B4: 所有 JSON 文件可解析

RED：任何 JSON 文件解析失败。

```bash
for F in $(find languages/en -name "*.json"); do
  if ! python3 -c "import json; json.load(open('$F'))" 2>/dev/null; then
    echo "FAIL: $F is not valid JSON"; exit 1
  fi
done
echo "PASS: B4"
```

GREEN：确保所有文件是合法 JSON。

### B5: 所有 JSON 文件非空

RED：任何 JSON 文件 <= 2 bytes（空对象 `{}`）。

```bash
for F in $(find languages/en -name "*.json"); do
  SIZE=$(wc -c < "$F" | tr -d ' ')
  if [ "$SIZE" -le 2 ]; then
    echo "FAIL: $F is empty or trivial ($SIZE bytes)"; exit 1
  fi
done
echo "PASS: B5"
```

GREEN：确保提取到的文件有实际内容。

### B6: extract_strings.py 存在

RED：`tools/extract_strings.py` 不存在。

```bash
if [ ! -f "tools/extract_strings.py" ]; then
  echo "FAIL: tools/extract_strings.py not found"; exit 1
fi
echo "PASS: B6"
```

GREEN：编写提取脚本。

## Full Verification

执行者应将上述 B1-B6 的 bash 片段按顺序组合执行。全部通过即为 T1 PASS。

## Pass/Fail

- **PASS**: 所有 B1-B6 通过。
- **FAIL**: 任一 behavior 失败。
- **BLOCKED**: Cavalry 未安装，无法获取 app bundle 路径。
