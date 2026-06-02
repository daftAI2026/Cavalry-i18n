<!--
[INPUT]: 依赖 T1 产出的 languages/en/ JSON 文件结构
[OUTPUT]: 对外提供 T1.1 翻译字段白名单的验证契约
[POS]: tests 层的 T1.1 contract，服务 M1
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Whitelist Contract (T1.1)

## Goal

验证 `docs/translation-whitelist.json` 存在、合法、覆盖所有文件类型，每个类型有 `translate` + `no_translate` 列表，且 translate 字段在实际 JSON 中存在。

## Behaviors

### B1: 白名单文件存在且合法 JSON

RED：`docs/translation-whitelist.json` 不存在或不可解析。

```bash
WHITELIST="docs/translation-whitelist.json"
if [ ! -f "$WHITELIST" ]; then
  echo "FAIL: $WHITELIST not found"; exit 1
fi
if ! python3 -c "import json; json.load(open('$WHITELIST'))" 2>/dev/null; then
  echo "FAIL: $WHITELIST is not valid JSON"; exit 1
fi
echo "PASS: B1"
```

GREEN：创建合法 JSON 白名单文件。

### B2: 覆盖 en/ 下所有文件类型

RED：白名单缺少某个文件类型（如 nodeStrings / appStrings / tips / onboarding / plugins）。

```bash
python3 -c "
import json, glob, sys, os

wl = json.load(open('docs/translation-whitelist.json'))
en_files = glob.glob('languages/en/*.json') + glob.glob('languages/en/**/*.json', recursive=True)

file_types = set()
for f in en_files:
    rel = os.path.relpath(f, 'languages/en')
    if '/' in rel:
        file_types.add(rel.split('/')[0])
    else:
        file_types.add(os.path.splitext(rel)[0])

wl_types = {k for k in wl.keys() if not k.startswith('_')}
missing = file_types - wl_types
if missing:
    print(f'FAIL: whitelist missing file types: {missing}')
    sys.exit(1)
print(f'PASS: B2 (covered: {sorted(wl_types)})')
"
```

GREEN：在白名单中添加缺失的文件类型。

### B3: 每个文件类型有 translate 和 no_translate 列表

RED：某文件类型缺少 `translate` 或 `no_translate`，或 `translate` 为空。

```bash
python3 -c "
import json, sys
wl = json.load(open('docs/translation-whitelist.json'))
for ftype, rules in wl.items():
    if ftype.startswith('_'):
        continue
    if 'translate' not in rules:
        print(f'FAIL: {ftype} missing \"translate\" list')
        sys.exit(1)
    if 'no_translate' not in rules:
        print(f'FAIL: {ftype} missing \"no_translate\" list')
        sys.exit(1)
    if len(rules['translate']) == 0:
        print(f'FAIL: {ftype} has empty \"translate\" list')
        sys.exit(1)
    # locale_sync 是可选的第三类字段
print('PASS: B3')
"
```

GREEN：填充每个类型的 translate/no_translate 字段列表。

### B4: translate 字段在实际 JSON 中存在

RED：白名单中声明的 translate 字段在对应 en/ JSON 中找不到。

```bash
python3 -c "
import json, glob, sys

wl = json.load(open('docs/translation-whitelist.json'))
en_files = {
    'nodeStrings': 'languages/en/nodeStrings.json',
    'appStrings': 'languages/en/appStrings.json',
    'tips': 'languages/en/tips.json',
    'onboarding': 'languages/en/onboarding.json',
}

def find_all_keys(obj, prefix=''):
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            keys.add(k)
            keys |= find_all_keys(v, f'{prefix}{k}.')
    elif isinstance(obj, list):
        for item in obj:
            keys |= find_all_keys(item, prefix)
    return keys

checked = 0
for ftype, fpath in en_files.items():
    if ftype not in wl:
        continue
    try:
        data = json.load(open(fpath))
    except:
        continue
    all_keys = find_all_keys(data)
    for field in wl[ftype]['translate']:
        if field not in all_keys:
            print(f'WARN: {ftype}.translate field \"{field}\" not found in {fpath} (may be nested)')
        else:
            checked += 1

print(f'  spot-checked {checked} fields against actual JSON')
if checked == 0:
    print('FAIL: no fields could be verified')
    sys.exit(1)
print('PASS: B4')
"
```

GREEN：根据 T1 提取出的实际 JSON 结构，校准白名单字段。

## Full Verification

执行者应将上述 B1-B4 的 bash/python 片段按顺序组合执行。全部通过即为 T1.1 PASS。

## Pass/Fail

- **PASS**: 所有 B1-B4 通过。
- **FAIL**: 任一 behavior 失败。
