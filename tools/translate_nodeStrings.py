#!/usr/bin/env python3
"""Translate nodeStrings.json for Cavalry i18n project.
Reads EN source and applies translations from trans_data.py dictionary."""

import json
import copy
import sys
import os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, 'tools')
from trans_data import TRANS

LANG_IDX = {'zh-Hans': 0, 'zh-Hant': 1, 'ja_JP': 2}
warnings = set()

def translate(s, lang):
    idx = LANG_IDX[lang]
    if s in TRANS:
        t = TRANS[s][idx]
        if t:
            return t
    warnings.add(f"[{lang}] {s[:100]}")
    return s

def translate_node(node_val, lang):
    if 'niceName' in node_val and node_val['niceName'] != 'N/A':
        node_val['niceName'] = translate(node_val['niceName'], lang)
    if 'nodeInfo' in node_val:
        node_val['nodeInfo'] = translate(node_val['nodeInfo'], lang)
    for key in list(node_val.get('attributes', {}).keys()):
        val = node_val['attributes'][key]
        if isinstance(val, str):
            node_val['attributes'][key] = translate(val, lang)
        elif isinstance(val, list):
            node_val['attributes'][key] = [translate(v, lang) for v in val]
    for enum_key in node_val.get('enums', {}):
        for k in node_val['enums'][enum_key]:
            node_val['enums'][enum_key][k] = translate(
                node_val['enums'][enum_key][k], lang)
    for tab_key in list(node_val.get('tabs', {}).keys()):
        node_val['tabs'][tab_key] = translate(node_val['tabs'][tab_key], lang)

with open('languages/en/nodeStrings.json', encoding='utf-8') as f:
    en_data = json.load(f)

for lang in ['zh-Hans', 'zh-Hant', 'ja_JP']:
    warnings.clear()
    data = copy.deepcopy(en_data)
    for item in data:
        if 'value' in item:
            translate_node(item['value'], lang)
        elif 'values' in item:
            for v in item['values']:
                translate_node(v, lang)
    
    output_path = f'languages/{lang}/nodeStrings.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    
    # Validate
    with open(output_path, encoding='utf-8') as f:
        json.load(f)
    
    print(f"✓ {output_path} ({len(warnings)} untranslated)")
    if warnings:
        for w in sorted(warnings)[:5]:
            print(f"  {w}", file=sys.stderr)
        if len(warnings) > 5:
            print(f"  ... and {len(warnings)-5} more", file=sys.stderr)

