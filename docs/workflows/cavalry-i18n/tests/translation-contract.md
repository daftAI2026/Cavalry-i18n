<!--
[INPUT]: 依赖 T0 术语表、T1 英文原文、T1.1 白名单、docs/translation-guidelines.md 翻译原则
[OUTPUT]: 对外提供 T2 翻译质量的验证契约
[POS]: tests 层的 T2 contract，服务 M1
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Translation Contract (T2)

## Goal

验证 zh-Hans / zh-Hant / ja_JP 三个语言目录的翻译 JSON 完整、结构正确、不翻译字段未被修改、术语匹配率 >= 70%、占位符保留、Qt .ts 合法 XML。

## Behaviors

### B1: 每个语言目录存在

RED：languages/zh-Hans/ 或 languages/zh-Hant/ 或 languages/ja_JP/ 不存在。

```bash
for LANG in zh-Hans zh-Hant ja_JP; do
  if [ ! -d "languages/$LANG" ]; then
    echo "FAIL: languages/$LANG/ not found"; exit 1
  fi
done
echo "PASS: B1"
```

GREEN：创建三个语言目录。

### B2: 每个语言目录的 JSON 文件数 = en/ 的数量

RED：某语言目录 JSON 文件数与 en/ 不一致。

```bash
EN_COUNT=$(find languages/en -name "*.json" | wc -l | tr -d ' ')
for LANG in zh-Hans zh-Hant ja_JP; do
  LANG_COUNT=$(find "languages/$LANG" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$LANG_COUNT" -ne "$EN_COUNT" ]; then
    echo "FAIL: languages/$LANG has $LANG_COUNT JSON files, expected $EN_COUNT"; exit 1
  fi
done
echo "PASS: B2"
```

GREEN：为每个语言创建与 en/ 一一对应的 JSON 文件。

### B3: 所有翻译 JSON 可解析

RED：任何翻译 JSON 不可解析。

```bash
for LANG in zh-Hans zh-Hant ja_JP; do
  for F in $(find "languages/$LANG" -name "*.json" 2>/dev/null); do
    if ! python3 -c "import json; json.load(open('$F'))" 2>/dev/null; then
      echo "FAIL: $F is not valid JSON"; exit 1
    fi
  done
done
echo "PASS: B3"
```

GREEN：确保翻译输出为合法 JSON。

### B4: JSON key 结构与 en/ 完全一致

RED：翻译 JSON 的 key 树与 en/ 的不同（只有 value 应该变化）。

```bash
python3 -c "
import json, glob, sys, os

def sorted_keys(obj):
    if isinstance(obj, dict):
        return {k: sorted_keys(v) for k, v in sorted(obj.items())}
    elif isinstance(obj, list):
        return [sorted_keys(i) for i in obj]
    return '__VALUE__'

langs = ['zh-Hans', 'zh-Hant', 'ja_JP']
en_files = sorted(glob.glob('languages/en/**/*.json', recursive=True))
fail = False

for en_f in en_files:
    rel = os.path.relpath(en_f, 'languages/en')
    en_skeleton = sorted_keys(json.load(open(en_f)))
    for lang in langs:
        lang_f = f'languages/{lang}/{rel}'
        if not os.path.exists(lang_f):
            continue
        lang_skeleton = sorted_keys(json.load(open(lang_f)))
        if en_skeleton != lang_skeleton:
            print(f'FAIL: key structure mismatch: {en_f} vs {lang_f}')
            fail = True

if fail:
    sys.exit(1)
print('PASS: B4')
"
```

GREEN：翻译时只修改 value，保持 key 结构不变。

### B5: 白名单中 no_translate 字段 value 与 en/ 一致

RED：不应翻译的字段（如 id / type / parameterType）被修改了。

```bash
python3 -c "
import json, glob, sys, os

wl = json.load(open('docs/translation-whitelist.json'))
langs = ['zh-Hans', 'zh-Hant', 'ja_JP']
fail = False
checked = 0

def check_no_translate(en_obj, lang_obj, no_translate_fields, path=''):
    global fail, checked
    if isinstance(en_obj, dict):
        for k in en_obj:
            if k in no_translate_fields:
                if en_obj[k] != lang_obj.get(k):
                    print(f'FAIL: no_translate field \"{path}{k}\" was modified')
                    fail = True
                checked += 1
            else:
                check_no_translate(en_obj.get(k, {}), lang_obj.get(k, {}), no_translate_fields, f'{path}{k}.')
    elif isinstance(en_obj, list):
        for i, (e, l) in enumerate(zip(en_obj, lang_obj if isinstance(lang_obj, list) else [])):
            check_no_translate(e, l, no_translate_fields, f'{path}[{i}].')

for ftype, rules in wl.items():
    no_tr = set(rules.get('no_translate', []))
    if ftype == 'plugins':
        en_files = glob.glob('languages/en/plugins/*.json')
    else:
        en_files = [f'languages/en/{ftype}.json']
    for en_f in en_files:
        if not os.path.exists(en_f):
            continue
        en_data = json.load(open(en_f))
        rel = os.path.relpath(en_f, 'languages/en')
        for lang in langs:
            lang_f = f'languages/{lang}/{rel}'
            if not os.path.exists(lang_f):
                continue
            lang_data = json.load(open(lang_f))
            check_no_translate(en_data, lang_data, no_tr)

if fail:
    sys.exit(1)
print(f'PASS: B5 (checked {checked} fields)')
"
```

GREEN：翻译时跳过 no_translate 字段。

### B6: 术语抽查 >= 70% 匹配 glossary

RED：从 glossary 随机抽 10 个术语，在 zh-Hans 翻译中匹配率低于 70%。

```bash
python3 -c "
import json, glob, sys, os, random

random.seed(42)

glossary = {}
with open('docs/cavalry-glossary.md') as f:
    lines = [l.strip() for l in f if l.strip().startswith('|') and not l.strip().startswith('|--')]
    header = [c.strip() for c in lines[0].split('|')[1:-1]]
    for line in lines[1:]:
        cols = [c.strip() for c in line.split('|')[1:-1]]
        if len(cols) >= 2:
            row = dict(zip(header, cols))
            glossary[row.get('en', '')] = row

translatable = {k: v for k, v in glossary.items() if v.get('zh-Hans', '') and v.get('zh-Hans') != k}
if len(translatable) < 10:
    sample = list(translatable.items())
else:
    sample = random.sample(list(translatable.items()), 10)

all_zh_cn = ''
for f in glob.glob('languages/zh-Hans/**/*.json', recursive=True):
    all_zh_cn += json.dumps(json.load(open(f)), ensure_ascii=False)

found = 0
for en_term, row in sample:
    zh_term = row.get('zh-Hans', '')
    if zh_term in all_zh_cn:
        found += 1
    else:
        print(f'WARN: glossary term \"{en_term}\" -> \"{zh_term}\" not found in zh-Hans translations')

print(f'  glossary spot-check: {found}/{len(sample)} terms found')
if found < len(sample) * 0.7:
    print('FAIL: less than 70% of sampled glossary terms found')
    sys.exit(1)
print('PASS: B6')
"
```

GREEN：翻译时严格引用 glossary 术语约束。

### B7: 占位符全部保留

RED：en/ 中的 `{0}` / `%1` / `{{...}}` 在翻译版本中丢失。

```bash
python3 -c "
import json, glob, re, sys, os

langs = ['zh-Hans', 'zh-Hant', 'ja_JP']
patterns = [r'\{[0-9]+\}', r'%[0-9]+', r'\{\{[^}]+\}\}']
fail = False

for en_f in glob.glob('languages/en/**/*.json', recursive=True):
    en_data = json.dumps(json.load(open(en_f)), ensure_ascii=False)
    rel = os.path.relpath(en_f, 'languages/en')
    for pat in patterns:
        en_placeholders = set(re.findall(pat, en_data))
        if not en_placeholders:
            continue
        for lang in langs:
            lang_f = f'languages/{lang}/{rel}'
            if not os.path.exists(lang_f):
                continue
            lang_data = json.dumps(json.load(open(lang_f)), ensure_ascii=False)
            lang_placeholders = set(re.findall(pat, lang_data))
            missing = en_placeholders - lang_placeholders
            if missing:
                print(f'FAIL: {lang_f} missing placeholders: {missing}')
                fail = True

if fail:
    sys.exit(1)
print('PASS: B7')
"
```

GREEN：翻译时保留所有占位符原样不动。

### B8: Qt .ts 文件存在且为合法 XML

RED：`tools/zh-Hans.ts` / `tools/zh-Hant.ts` / `tools/ja_JP.ts` 不存在或非合法 XML。

```bash
for LANG in zh-Hans zh-Hant ja_JP; do
  TS="tools/${LANG}.ts"
  if [ ! -f "$TS" ]; then
    echo "FAIL: $TS not found"; exit 1
  fi
  if ! python3 -c "import xml.etree.ElementTree as ET; ET.parse('$TS')" 2>/dev/null; then
    echo "FAIL: $TS is not valid XML"; exit 1
  fi
done
echo "PASS: B8"
```

GREEN：创建合法的 Qt Linguist XML .ts 文件。

### B9: 未批准英文残留检测

RED：whitelist 标记 `translate` 的**叶子字符串**中，存在未批准英文词片段。无论英文与目标语言是紧邻还是被空格分隔，都算 FAIL。

```bash
python3 -c "
import json, glob, os, re, sys

wl = json.load(open('docs/translation-whitelist.json'))
langs = ['zh-Hans', 'zh-Hant', 'ja_JP']
latin = re.compile(r'[A-Za-z][A-Za-z0-9./+-]*')
non_ascii = re.compile(r'[^\x00-\x7F]')
allowed = {
  'Alpha', 'RGB', 'CMYK', 'SVG', 'JSON', 'CSV', 'FPS', 'BPM', 'GPU',
  'Lottie', 'Cavalry', 'Canva', 'UV', 'Bezier', 'Forge', 'Dynamics',
  'APNG', 'QuickTime', 'ProRes', 'WebM', 'HEVC', 'HVEC', 'H.265', 'H.264',
  'PNG', 'JPEG', 'WebP', 'GIF', 'MP4', 'PCM', 'NFT', 'ERC-1155',
  'sRGB', 'OkLab', 'OKLab', 'Oklab', 'Ctrl', 'Shift', 'Alt', 'OK',
  '2D', '2.5D', '3D', 'AE', 'AI', 'ASCII', 'CPU', 'CSS', 'EXR', 'HDR',
  'HSL', 'HSV', 'HTTP', 'HTTPS', 'ID', 'JPG', 'LCH', 'LUT', 'Lab', 'MIDI',
  'PDF', 'RGBA', 'SDR', 'UI', 'URL', 'XML', 'XYZ', 'YUV', 'Math', 'Math2',
  'Math3', 'Value2', 'Value3'
}
fail = False
violations = 0

def walk_translate_leaves(obj, translate_fields, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            next_path = f'{path}.{k}' if path else k
            if k in translate_fields:
                yield from walk_leaves(v, next_path)
            else:
                yield from walk_translate_leaves(v, translate_fields, next_path)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from walk_translate_leaves(item, translate_fields, f'{path}[{i}]')

def walk_leaves(obj, path):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            next_path = f'{path}.{k}' if path else k
            yield from walk_leaves(v, next_path)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from walk_leaves(item, f'{path}[{i}]')

for ftype, rules in wl.items():
    if ftype == '_schema':
        continue
    translate_fields = set(rules.get('translate', []))
    if ftype == 'plugins':
        lang_files = lambda lang: glob.glob(f'languages/{lang}/plugins/*.json')
    else:
        lang_files = lambda lang: [f'languages/{lang}/{ftype}.json']
    for lang in langs:
        for f in lang_files(lang):
            if not os.path.exists(f):
                continue
            for path, value in walk_translate_leaves(json.load(open(f)), translate_fields):
                if not isinstance(value, str) or not non_ascii.search(value):
                    continue
                bad = [w for w in latin.findall(value) if w not in allowed and len(w) > 1]
                if bad:
                    print(f'FAIL: unapproved English residue in {f} at {path}: {bad} :: \"{value}\"')
                    fail = True
                    violations += 1

if fail:
    print(f'FAIL: B9 ({violations} residue violations)')
    sys.exit(1)
print('PASS: B9')
"
```

GREEN：确保每个翻译字符串要么是纯目标语言，要么仅保留批准的英文术语/标准名词。像 `Export if 可见`、`Poly メッシュ` 这类带空格半翻译也必须判 FAIL。

### B10: translate 分支叶子级翻译覆盖率

RED：whitelist 中标记 `translate` 的**叶子字符串**与英文原文完全相同（说明未翻译）。禁止只比较整个 `attributes` / `enums` / `tabs` 容器对象。

```bash
python3 -c "
import json, glob, sys, os

wl = json.load(open('docs/translation-whitelist.json'))
langs = ['zh-Hans', 'zh-Hant', 'ja_JP']
fail = False
untranslated = 0
checked = 0
allowed_same_as_en = {
  'Alpha', 'RGB', 'CMYK', 'SVG', 'JSON', 'CSV', 'FPS', 'BPM', 'GPU',
  'Lottie', 'Cavalry', 'Canva', 'UV', 'Bezier', 'Forge', 'Dynamics',
  'APNG', 'QuickTime', 'ProRes', 'WebM', 'HEVC', 'HVEC', 'H.265', 'H.264',
  'PNG', 'JPEG', 'WebP', 'GIF', 'MP4', 'PCM', 'NFT', 'ERC-1155',
  'sRGB', 'OkLab', 'OKLab', 'Oklab', 'Math', 'Math2', 'Math3', 'Value2',
  'Value3', 'Ctrl', 'Shift', 'Alt', 'OK', '2D', '2.5D', '3D', 'AE', 'AI',
  'ASCII', 'CPU', 'CSS', 'EXR', 'HDR', 'HSL', 'HSV', 'HTTP', 'HTTPS', 'ID',
  'JPG', 'LCH', 'LUT', 'Lab', 'MIDI', 'PDF', 'RGBA', 'SDR', 'UI', 'URL',
  'XML', 'XYZ', 'YUV'
}

def walk_translate_leaves(obj, translate_fields, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            next_path = f'{path}.{k}' if path else k
            if k in translate_fields:
                yield from walk_leaves(v, next_path)
            else:
                yield from walk_translate_leaves(v, translate_fields, next_path)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from walk_translate_leaves(item, translate_fields, f'{path}[{i}]')

def walk_leaves(obj, path):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            next_path = f'{path}.{k}' if path else k
            yield from walk_leaves(v, next_path)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from walk_leaves(item, f'{path}[{i}]')

for ftype, rules in wl.items():
    if ftype == '_schema':
        continue
    tr_fields = set(rules.get('translate', []))
    if ftype == 'plugins':
        en_files = glob.glob('languages/en/plugins/*.json')
    else:
        en_files = [f'languages/en/{ftype}.json']

    for en_f in en_files:
        if not os.path.exists(en_f):
            continue
        en_data = json.load(open(en_f))
        rel = os.path.relpath(en_f, 'languages/en')

        for lang in langs:
            lang_f = f'languages/{lang}/{rel}'
            if not os.path.exists(lang_f):
                continue
            en_values = list(walk_translate_leaves(en_data, tr_fields))
            lang_values = list(walk_translate_leaves(json.load(open(lang_f)), tr_fields))

            for (en_path, en_val), (_, lang_val) in zip(en_values, lang_values):
                checked += 1
                if isinstance(en_val, str) and en_val == lang_val and len(en_val) > 3:
                    if en_val in allowed_same_as_en:
                        continue
                    print(f'WARN: untranslated in {lang_f} at {en_path}: \"{en_val}\"')
                    untranslated += 1

if checked > 0:
    coverage = (checked - untranslated) / checked
    print(f'  translation coverage: {checked - untranslated}/{checked} ({coverage:.0%})')
    if coverage < 0.9:
        print(f'FAIL: B10 translation coverage {coverage:.0%} < 90%')
        fail = True

if fail:
    sys.exit(1)
print('PASS: B10')
"
```

GREEN：确保 `translate` 分支下的叶子字符串至少 90% 与英文原文不同；允许保留英文的标准名词必须显式列入 allowlist。

### B11: language 字段同步目标语言代码

RED：翻译 JSON 中 `language` 字段的值不是目标语言代码。

```bash
python3 -c "
import json, glob, sys

langs = {'zh-Hans': 'zh-Hans', 'zh-Hant': 'zh-Hant', 'ja_JP': 'ja_JP'}
fail = False

for lang, expected in langs.items():
    for f in glob.glob(f'languages/{lang}/**/*.json', recursive=True):
        data = json.load(open(f))
        # 递归查找 language 字段
        def check_lang(obj, path=''):
            global fail
            if isinstance(obj, dict):
                if 'language' in obj and obj['language'] != expected:
                    print(f'FAIL: {f} at {path}language = \"{obj[\"language\"]}\", expected \"{expected}\"')
                    fail = True
                for k, v in obj.items():
                    check_lang(v, f'{path}{k}.')
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    check_lang(item, f'{path}[{i}].')
        check_lang(data)

if fail:
    sys.exit(1)
print('PASS: B11')
"
```

GREEN：所有翻译 JSON 中的 `language` 字段值为对应的目标语言代码。

### B12: 三种语言的脚本 / 术语纯度检查

RED：任一目标语言产物出现明显的错语系 UI 词：

- `zh-Hans` 混入繁体 / 港台 UI 用词（如 `檔案`、`儲存`、`圖層`）
- `zh-Hant` 混入简体 / 大陆 UI 用词（如 `开`、`图层`、`绘制`）
- `ja_JP` 混入明显中文 UI 词而非日文界面术语（如 `图层` / `圖層` 而非 `レイヤー`）

```bash
python3 -c "
import json, glob, sys

patterns = {
  'zh-Hans': {
    '檔案': '文件', '儲存': '保存', '預設': '默认', '影片': '视频', '程式': '程序',
    '資訊': '信息', '繪製': '绘制', '圖層': '图层', '視埠': '视口', '視口': '视口',
    '節點': '节点', '標籤': '标签', '設定': '设置', '腳本': '脚本', '顏色': '颜色',
    '邊距': '边距', '匯出': '导出', '開啟': '打开/开启', '關閉': '关闭'
  },
  'zh-Hant': {
    '开': '開/開啟', '关': '關/關閉', '图层': '圖層', '父级': '父級', '子级': '子級',
    '绘制': '繪製', '动态': '動態', '滤镜': '濾鏡', '压缩': '壓縮', '边距': '邊距',
    '名称': '名稱', '标签': '標籤', '导出': '匯出/輸出', '视口': '視埠/檢視區',
    '网格': '網格', '轨道': '軌道', '约束': '約束', '帧率': '幀率', '帧': '幀',
    '颜色': '顏色', '级别': '層級/級別', '活动': '活動/作用中', '编码器': '編碼器',
    '画板': '畫板', '设置': '設定', '脚本': '腳本', '运算': '運算', '节点': '節點'
  },
  'ja_JP': {
    '图层': 'レイヤー', '圖層': 'レイヤー', '节点': 'ノード', '節點': 'ノード',
    '动画': 'アニメーション', '動畫': 'アニメーション', '关键帧': 'キーフレーム',
    '關鍵幀': 'キーフレーム', '渲染': 'レンダリング', '着色器': 'シェーダー',
    '著色器': 'シェーダー', '视口': 'ビューポート', '視埠': 'ビューポート'
  }
}

def walk(obj, path=''):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            np = f'{path}.{k}' if path else k
            yield from walk(v, np)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from walk(item, f'{path}[{i}]')

hits = 0
for lang, lang_patterns in patterns.items():
    for f in glob.glob(f'languages/{lang}/**/*.json', recursive=True):
        data = json.load(open(f))
        for path, value in walk(data):
            if not isinstance(value, str):
                continue
            bad = [term for term in lang_patterns if term in value]
            if bad:
                print(f'FAIL: {lang} purity residue in {f} at {path}: {bad} :: \"{value}\"')
                hits += 1

if hits:
    print(f'FAIL: B12 ({hits} purity-residue hits)')
    sys.exit(1)
print('PASS: B12')
"
```

GREEN：`zh-Hans` / `zh-Hant` / `ja_JP` 都使用稳定的本地界面术语，禁止混入错语系脚本或明显异地 UI 用词。

### B13: validate_translations.py 全量验证

RED：`tools/validate_translations.py` 返回非零退出码。

```bash
python3 tools/validate_translations.py \
  --root . \
  --json-report /tmp/cavalry-i18n-report.json \
  --markdown-summary /tmp/cavalry-i18n-summary.md
echo "EXIT: $?"
```

GREEN：脚本返回 0，并输出 JSON report + markdown summary；其 overall status 为 PASS。

## Full Verification

执行者应将上述 B1-B13 的 bash/python 片段按顺序组合执行。全部通过即为 T2 PASS。

## Pass/Fail

- **PASS**: 所有 B1-B13 通过。
- **FAIL**: 任一 behavior 失败。
