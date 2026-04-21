#!/usr/bin/env python3
"""Contract check for compiled-menu translation structure."""

from __future__ import annotations

import json
import sys
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
MANIFEST = REPO / "doc" / "compiled-menu-contexts.json"
TS_FILES = [
    REPO / "tools" / "zh-Hans.ts",
    REPO / "tools" / "zh-Hant.ts",
    REPO / "tools" / "ja_JP.ts",
]


def main() -> int:
    if not MANIFEST.exists():
        print(f"FAIL: compiled menu manifest missing: {MANIFEST}")
        return 1

    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    menu_bar_strings = data.get("MenuBarManager")
    if not isinstance(menu_bar_strings, list) or "New Scene" not in menu_bar_strings or "Preferences" not in menu_bar_strings:
        print("FAIL: MenuBarManager manifest does not contain required menu strings")
        return 1

    for ts_file in TS_FILES:
        content = ts_file.read_text(encoding="utf-8")
        if "<name>MenuBarManager</name>" not in content:
            print(f"FAIL: {ts_file.name} missing MenuBarManager context")
            return 1
        if "<source>New Scene</source>" not in content:
            print(f"FAIL: {ts_file.name} missing New Scene source in compiled menu context")
            return 1
        if "<source>Preferences</source>" not in content:
            print(f"FAIL: {ts_file.name} missing Preferences source in compiled menu context")
            return 1

    print("PASS: compiled menu translation structure")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
