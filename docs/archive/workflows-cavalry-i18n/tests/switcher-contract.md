<!--
[INPUT]: 依赖 docs/plan-v3.md 的切换逻辑规格、T1 产出的 languages/en/ 文件列表
[OUTPUT]: 对外提供 T4 LanguageSwitcher.js 的验证契约
[POS]: tests 层的 T4 contract，服务 M2
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Switcher Contract (T4)

## Goal

验证 `LanguageSwitcher.js` 存在、语法正确、包含所有必需 API 调用、使用官方 Script UI 运行时、双平台处理、版本检测、错误处理、覆写文件列表完整，并与隐藏资源结构保持一致。

## Behaviors

### B1: 文件存在且语法正确

RED：`LanguageSwitcher.js` 不存在或 `node --check` 报错。

```bash
SCRIPT="LanguageSwitcher.js"
if [ ! -f "$SCRIPT" ]; then
  echo "FAIL: $SCRIPT not found"; exit 1
fi
if ! node --check "$SCRIPT" 2>/dev/null; then
  echo "FAIL: $SCRIPT has syntax errors"; exit 1
fi
echo "PASS: B1"
```

GREEN：创建语法正确的 LanguageSwitcher.js。

### B2: 包含所有必需 API 调用

RED：缺少 api.writeToFile / api.readFromFile / api.getAppAssetsPath / api.runDetachedProcess / api.getCavalryVersion / api.getPlatform 中的任何一个。

```bash
SCRIPT="LanguageSwitcher.js"
REQUIRED_APIS=(
  "api.writeToFile"
  "api.readFromFile"
  "api.getAppAssetsPath"
  "api.runDetachedProcess"
  "api.getCavalryVersion"
  "api.getPlatform"
)
for API in "${REQUIRED_APIS[@]}"; do
  if ! grep -q "$API" "$SCRIPT"; then
    echo "FAIL: missing API call: $API"; exit 1
  fi
done
echo "PASS: B2"
```

GREEN：在脚本中使用所有必需 API。

### B3: 包含功能关键词

RED：缺少 cavalry-i18n.json / Apply / translations / nodeStrings / appStrings / plugins 中的任何一个。

```bash
SCRIPT="LanguageSwitcher.js"
FEATURES=(
  "cavalry-i18n.json"
  "Apply"
  "translations"
  "nodeStrings"
  "appStrings"
  "plugins"
)
for FEAT in "${FEATURES[@]}"; do
  if ! grep -q "$FEAT" "$SCRIPT"; then
    echo "FAIL: missing feature reference: $FEAT"; exit 1
  fi
done
echo "PASS: B3"
```

GREEN：实现 JSON 覆写 + .qm 写入 + 配置管理。

### B4: 双平台处理

RED：脚本中缺少 macOS 或 Windows 平台处理逻辑。

```bash
SCRIPT="LanguageSwitcher.js"
if ! grep -q "macOS" "$SCRIPT"; then
  echo "FAIL: missing macOS platform handling"; exit 1
fi
if ! grep -q "Windows" "$SCRIPT"; then
  echo "FAIL: missing Windows platform handling"; exit 1
fi
echo "PASS: B4"
```

GREEN：实现 macOS (`open -n` + `osascript quit`) 和 Windows (`start` + `taskkill`) 两套重启逻辑。

### B5: 版本检测逻辑

RED：脚本中缺少 `cavalryVersion` 关键词。

```bash
if ! grep -q "cavalryVersion" "LanguageSwitcher.js"; then
  echo "FAIL: missing version detection logic (cavalryVersion)"; exit 1
fi
echo "PASS: B5"
```

GREEN：实现启动时版本号比对，版本不一致提示重新应用。

### B6: 写入失败错误处理

RED：`writeToFile` 调用附近无错误处理逻辑。

```bash
SCRIPT="LanguageSwitcher.js"
if ! grep -B2 -A5 "writeToFile" "$SCRIPT" | grep -qiE "(if|false|fail|error|!result|!success)"; then
  echo "FAIL: writeToFile may lack error handling"; exit 1
fi
echo "PASS: B6"
```

GREEN：writeToFile 返回 false 时停止并通过 `ui.Modal` 弹窗。

### B7: 覆写文件列表与 en/ 一一对应

RED：`LanguageSwitcher_assets/languages/en/` 下的某个 JSON 文件名未在脚本中出现。

```bash
python3 -c "
import glob, os, sys

en_files = set()
for f in glob.glob('LanguageSwitcher_assets/languages/en/**/*.json', recursive=True):
    en_files.add(os.path.basename(f).replace('.json', ''))

with open('LanguageSwitcher.js') as f:
    script = f.read()

missing = []
for name in en_files:
    if name not in script:
        missing.append(name)

if missing:
        print(f'FAIL: script does not reference these runtime en/ files: {missing}')
    sys.exit(1)
print(f'PASS: B7 (all {len(en_files)} en/ files referenced)')
"
```

GREEN：确保脚本覆写列表覆盖 en/ 下所有文件。

### B8: 使用官方 Script UI `ui` 模块

RED：脚本使用 `api.UIWidget`、`api.alert`、`api.confirm`，或未使用 `ui.DropDown` / `ui.Button` / `ui.Modal` / `ui.show()`。

```bash
SCRIPT="LanguageSwitcher.js"
if grep -q "api.UIWidget" "$SCRIPT"; then
  echo "FAIL: uses api.UIWidget instead of Script UI runtime"; exit 1
fi
for BAD_TOKEN in "api.alert" "api.confirm"; do
  if grep -q "$BAD_TOKEN" "$SCRIPT"; then
    echo "FAIL: unsupported Script UI token present: $BAD_TOKEN"; exit 1
  fi
done
for TOKEN in "new ui.DropDown" "new ui.Button" "new ui.Modal" "ui.show()"; do
  if ! grep -q "$TOKEN" "$SCRIPT"; then
    echo "FAIL: missing Script UI token: $TOKEN"; exit 1
  fi
done
echo "PASS: B8"
```

GREEN：脚本基于官方 `ui` 运行时构建窗口和控件，并用 `ui.Modal` 处理消息/确认弹窗。

### B9: 运行时资源隐藏并基于脚本位置解析

RED：缺少 `LanguageSwitcher_assets`、`ui.scriptLocation`，或未使用 `api.filePathExists`。

```bash
SCRIPT="LanguageSwitcher.js"
for TOKEN in "LanguageSwitcher_assets" "ui.scriptLocation" "filePathExists"; do
  if ! grep -q "$TOKEN" "$SCRIPT"; then
    echo "FAIL: missing runtime asset token: $TOKEN"; exit 1
  fi
done
if [ ! -d "LanguageSwitcher_assets/languages" ]; then
  echo "FAIL: LanguageSwitcher_assets/languages not found"; exit 1
fi
echo "PASS: B9"
```

GREEN：运行时资源位于隐藏 `_assets` 目录，并通过脚本相对路径解析。

## Full Verification

执行者应将上述 B1-B9 的 bash/python 片段按顺序组合执行。全部通过即为 T4 PASS。

## Pass/Fail

- **PASS**: 所有 B1-B9 通过。
- **FAIL**: 任一 behavior 失败。
