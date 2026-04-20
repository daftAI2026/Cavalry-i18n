#!/usr/bin/env python3
"""
apply_translations.py — Apply translation dictionaries to Cavalry i18n JSON files.

Reads en/ JSON, applies translations from dict files, writes to target language dirs.
Handles translate/no_translate/locale_sync per translation-whitelist.json.
"""

import json, os, sys, glob, copy, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ['zh-Hans', 'zh-Hant', 'ja_JP']

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

def load_whitelist():
    return load_json(os.path.join(REPO, 'doc', 'translation-whitelist.json'))

def load_dict(lang):
    dict_path = os.path.join(REPO, 'tools', f'dict_{lang}.json')
    if os.path.exists(dict_path):
        return load_json(dict_path)
    return {}

def translate_value(val, trans_dict):
    """Translate a single string value using the dictionary."""
    if not isinstance(val, str):
        return val
    if val in trans_dict:
        return trans_dict[val]
    return val  # fallback: keep original

def translate_tree(en_obj, lang_obj, trans_dict, translate_fields, no_translate_fields, locale_sync_fields, target_lang):
    """Recursively translate a JSON tree."""
    if isinstance(en_obj, dict) and isinstance(lang_obj, dict):
        result = {}
        for k in en_obj:
            if k in locale_sync_fields:
                result[k] = target_lang
            elif k in no_translate_fields:
                result[k] = en_obj[k]  # preserve English
            elif k in translate_fields:
                result[k] = translate_subtree(en_obj[k], lang_obj.get(k, en_obj[k]), trans_dict)
            else:
                result[k] = translate_tree(
                    en_obj[k], lang_obj.get(k, en_obj[k]),
                    trans_dict, translate_fields, no_translate_fields,
                    locale_sync_fields, target_lang
                )
        return result
    elif isinstance(en_obj, list) and isinstance(lang_obj, list):
        result = []
        for i, en_item in enumerate(en_obj):
            lang_item = lang_obj[i] if i < len(lang_obj) else en_item
            result.append(translate_tree(
                en_item, lang_item, trans_dict,
                translate_fields, no_translate_fields,
                locale_sync_fields, target_lang
            ))
        return result
    else:
        return lang_obj  # non-dict/list: keep as-is

def translate_subtree(en_obj, lang_obj, trans_dict):
    """Translate all leaf strings in a translate subtree."""
    if isinstance(en_obj, str):
        translated = translate_value(en_obj, trans_dict)
        if translated != en_obj:
            return translated
        # If dict doesn't have it, use existing translation if different from English
        if isinstance(lang_obj, str) and lang_obj != en_obj:
            return lang_obj
        return en_obj
    elif isinstance(en_obj, dict):
        result = {}
        lang_dict = lang_obj if isinstance(lang_obj, dict) else {}
        for k in en_obj:
            result[k] = translate_subtree(en_obj[k], lang_dict.get(k, en_obj[k]), trans_dict)
        return result
    elif isinstance(en_obj, list):
        result = []
        lang_list = lang_obj if isinstance(lang_obj, list) else []
        for i, en_item in enumerate(en_obj):
            lang_item = lang_list[i] if i < len(lang_list) else en_item
            result.append(translate_subtree(en_item, lang_item, trans_dict))
        return result
    else:
        return en_obj

def process_file(en_path, lang, trans_dict, whitelist, file_type):
    """Process a single JSON file."""
    rel = os.path.relpath(en_path, os.path.join(REPO, 'languages', 'en'))
    lang_path = os.path.join(REPO, 'languages', lang, rel)

    en_data = load_json(en_path)
    if os.path.exists(lang_path):
        lang_data = load_json(lang_path)
    else:
        lang_data = copy.deepcopy(en_data)

    rules = whitelist.get(file_type, {})
    tr = set(rules.get('translate', []))
    no_tr = set(rules.get('no_translate', []))
    sync = set(rules.get('locale_sync', []))

    result = translate_tree(en_data, lang_data, trans_dict, tr, no_tr, sync, lang)
    save_json(lang_path, result)
    return lang_path

def main():
    whitelist = load_whitelist()

    for lang in LANGS:
        print(f'\n=== Processing {lang} ===')
        trans_dict = load_dict(lang)
        print(f'  Dictionary: {len(trans_dict)} entries')

        # nodeStrings
        en_path = os.path.join(REPO, 'languages', 'en', 'nodeStrings.json')
        out = process_file(en_path, lang, trans_dict, whitelist, 'nodeStrings')
        print(f'  Written: {out}')

        # appStrings
        en_path = os.path.join(REPO, 'languages', 'en', 'appStrings.json')
        out = process_file(en_path, lang, trans_dict, whitelist, 'appStrings')
        print(f'  Written: {out}')

        # tips
        en_path = os.path.join(REPO, 'languages', 'en', 'tips.json')
        out = process_file(en_path, lang, trans_dict, whitelist, 'tips')
        print(f'  Written: {out}')

        # onboarding
        en_path = os.path.join(REPO, 'languages', 'en', 'onboarding.json')
        out = process_file(en_path, lang, trans_dict, whitelist, 'onboarding')
        print(f'  Written: {out}')

        # plugins
        for en_path in sorted(glob.glob(os.path.join(REPO, 'languages', 'en', 'plugins', '*.json'))):
            out = process_file(en_path, lang, trans_dict, whitelist, 'plugins')
            print(f'  Written: {out}')

    print('\n=== Done ===')

if __name__ == '__main__':
    main()
