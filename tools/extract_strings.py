#!/usr/bin/env python3
"""Extract English strings from Cavalry app bundle into LanguageSwitcher_assets/languages/en/."""

import json
import os
import re
import shutil
import sys


def to_camel_case(name: str) -> str:
    """Convert 'Gaussian Blur Filter' to 'gaussianBlurFilter'."""
    words = name.split()
    return words[0].lower() + "".join(w.capitalize() for w in words[1:])


def copy_json(src: str, dst: str) -> None:
    """Copy a JSON file, validating it is parseable."""
    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: extract_strings.py <cavalry-app-path>")
        print("  e.g. extract_strings.py /Applications/Cavalry.app")
        sys.exit(1)

    app_path = sys.argv[1]
    assets = os.path.join(app_path, "Contents", "assets")

    if not os.path.isdir(assets):
        print(f"ERROR: assets directory not found at {assets}")
        sys.exit(1)

    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    en_dir = os.path.join(repo, "LanguageSwitcher_assets", "languages", "en")
    plugins_dir = os.path.join(en_dir, "plugins")
    os.makedirs(plugins_dir, exist_ok=True)

    # Definitions
    defs = os.path.join(assets, "Definitions")
    copy_json(os.path.join(defs, "nodeStrings.json"), os.path.join(en_dir, "nodeStrings.json"))
    copy_json(os.path.join(defs, "appStrings.json"), os.path.join(en_dir, "appStrings.json"))

    # Learn
    learn = os.path.join(assets, "Learn")
    copy_json(os.path.join(learn, "tips.json"), os.path.join(en_dir, "tips.json"))
    copy_json(os.path.join(learn, "onboarding.json"), os.path.join(en_dir, "onboarding.json"))

    # Plugins
    plugins_src = os.path.join(assets, "Plugins")
    count = 0
    for name in sorted(os.listdir(plugins_src)):
        strings_path = os.path.join(plugins_src, name, "strings.json")
        if os.path.isfile(strings_path):
            dst_name = to_camel_case(name) + ".json"
            copy_json(strings_path, os.path.join(plugins_dir, dst_name))
            count += 1

    print(f"Extracted: nodeStrings, appStrings, tips, onboarding + {count} plugins → {en_dir}")


if __name__ == "__main__":
    main()
