#!/usr/bin/env python3
"""Contract check for the external Cavalry bundle patcher."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
HELPER = REPO / "tools" / "patch_cavalry_bundle.py"
SOURCE_ROOT = REPO / "LanguageSwitcher_assets" / "languages"


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    if not HELPER.exists():
        print(f"FAIL: helper script not found: {HELPER}")
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        fake_app = tmpdir / "Cavalry.app"
        assets = fake_app / "Contents" / "assets"

        write_json(assets / "Definitions" / "nodeStrings.json", {"value": "EN node"})
        write_json(assets / "Definitions" / "appStrings.json", {"value": "EN app"})
        write_json(assets / "Learn" / "tips.json", {"title": "EN tip", "text": "EN text"})
        write_json(assets / "Learn" / "onboarding.json", {"title": "EN onboarding"})
        write_json(
            assets / "Plugins" / "Gaussian Blur Filter" / "strings.json",
            {"niceName": "Gaussian Blur Filter", "language": "en"},
        )

        english_output = tmpdir / "english-snapshot"

        cmd = [
            sys.executable,
            str(HELPER),
            "--app",
            str(fake_app),
            "--lang",
            "zh-Hans",
            "--source-root",
            str(SOURCE_ROOT),
            "--refresh-en",
            "--english-output",
            str(english_output),
            "--qm-target",
            "none",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print("FAIL: helper exited non-zero")
            print(result.stdout)
            print(result.stderr)
            return 1

        extracted_node = english_output / "nodeStrings.json"
        if not extracted_node.exists():
            print(f"FAIL: expected extracted English file at {extracted_node}")
            return 1

        if read_json(extracted_node) != {"value": "EN node"}:
            print("FAIL: extracted English nodeStrings.json did not match bundle contents")
            return 1

        expected_node = read_json(SOURCE_ROOT / "zh-Hans" / "nodeStrings.json")
        actual_node = read_json(assets / "Definitions" / "nodeStrings.json")
        if actual_node != expected_node:
            print("FAIL: patched nodeStrings.json did not match zh-Hans language asset")
            return 1

        expected_plugin = read_json(SOURCE_ROOT / "zh-Hans" / "plugins" / "gaussianBlurFilter.json")
        actual_plugin = read_json(assets / "Plugins" / "Gaussian Blur Filter" / "strings.json")
        if actual_plugin != expected_plugin:
            print("FAIL: patched plugin strings did not match zh-Hans language asset")
            return 1

        cloned_app = tmpdir / "Cavalry Patched.app"
        clone_cmd = [
            sys.executable,
            str(HELPER),
            "--app",
            str(fake_app),
            "--output-app",
            str(cloned_app),
            "--lang",
            "zh-Hans",
            "--source-root",
            str(SOURCE_ROOT),
            "--qm-target",
            "resources",
        ]
        clone_result = subprocess.run(clone_cmd, capture_output=True, text=True)
        if clone_result.returncode != 0:
            print("FAIL: helper clone mode exited non-zero")
            print(clone_result.stdout)
            print(clone_result.stderr)
            return 1

        cloned_node = read_json(cloned_app / "Contents" / "assets" / "Definitions" / "nodeStrings.json")
        if cloned_node != expected_node:
            print("FAIL: cloned output app did not receive patched nodeStrings.json")
            return 1

        original_node_after_clone = read_json(fake_app / "Contents" / "assets" / "Definitions" / "nodeStrings.json")
        if original_node_after_clone != expected_node:
            print("FAIL: source app should stay in its already patched state after clone test")
            return 1

        qm_dir = cloned_app / "Contents" / "Resources" / "translations"
        for qm_name in ("cavalry_zh-Hans.qm", "qtbase_zh-Hans.qm"):
            if not (qm_dir / qm_name).exists():
                print(f"FAIL: expected cloned app QM file at {(qm_dir / qm_name)}")
                return 1

    print("PASS: external Cavalry bundle patcher contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
