#!/usr/bin/env python3
"""Patch a Cavalry app bundle with a selected language pack.

This helper is intentionally external to Cavalry's Script UI runtime so it can:
1. refresh English originals from an installed app bundle
2. patch JSON string assets in-place
3. optionally try experimental QM installation paths
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE_ROOT = REPO / "LanguageSwitcher_assets" / "languages"
CORE_FILES = ("nodeStrings.json", "appStrings.json", "tips.json", "onboarding.json")


def to_camel_case(name: str) -> str:
    words = name.split()
    return words[0].lower() + "".join(word.capitalize() for word in words[1:])


def copy_json(src: Path, dst: Path) -> None:
    data = json.loads(src.read_text(encoding="utf-8"))
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def bundle_assets_root(app_path: Path) -> Path:
    return app_path / "Contents" / "assets"


def prepare_target_app(app_path: Path, output_app: Path | None) -> Path:
    if output_app is None:
        return app_path

    if output_app.exists():
        shutil.rmtree(output_app)

    shutil.copytree(app_path, output_app, symlinks=True)
    return output_app


def refresh_english_snapshot(app_path: Path, english_output: Path) -> None:
    assets = bundle_assets_root(app_path)
    defs = assets / "Definitions"
    learn = assets / "Learn"
    plugins_src = assets / "Plugins"

    copy_json(defs / "nodeStrings.json", english_output / "nodeStrings.json")
    copy_json(defs / "appStrings.json", english_output / "appStrings.json")
    copy_json(learn / "tips.json", english_output / "tips.json")
    copy_json(learn / "onboarding.json", english_output / "onboarding.json")

    plugin_output = english_output / "plugins"
    plugin_output.mkdir(parents=True, exist_ok=True)
    for plugin_dir in sorted(plugins_src.iterdir()):
        strings_path = plugin_dir / "strings.json"
        if not strings_path.is_file():
            continue
        copy_json(strings_path, plugin_output / f"{to_camel_case(plugin_dir.name)}.json")


def patch_json_assets(app_path: Path, source_root: Path, lang: str) -> None:
    assets = bundle_assets_root(app_path)
    lang_root = source_root / lang

    core_map = {
        "nodeStrings.json": assets / "Definitions" / "nodeStrings.json",
        "appStrings.json": assets / "Definitions" / "appStrings.json",
        "tips.json": assets / "Learn" / "tips.json",
        "onboarding.json": assets / "Learn" / "onboarding.json",
    }

    for filename, destination in core_map.items():
        copy_json(lang_root / filename, destination)

    plugins_src = assets / "Plugins"
    for plugin_dir in sorted(plugins_src.iterdir()):
        strings_path = plugin_dir / "strings.json"
        if not strings_path.is_file():
            continue
        asset_name = f"{to_camel_case(plugin_dir.name)}.json"
        asset_path = lang_root / "plugins" / asset_name
        if asset_path.is_file():
            copy_json(asset_path, strings_path)


def install_qm_assets(app_path: Path, source_root: Path, lang: str, qm_target: str) -> None:
    if qm_target == "none":
        return

    lang_root = source_root / lang
    target_dir = {
        "macos": app_path / "Contents" / "MacOS" / "translations",
        "resources": app_path / "Contents" / "Resources" / "translations",
    }[qm_target]
    target_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(lang_root / f"cavalry_{lang}.qm", target_dir / f"cavalry_{lang}.qm")
    shutil.copy2(lang_root / f"qtbase_{lang}.qm", target_dir / f"qtbase_{lang}.qm")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True, help="Path to Cavalry.app")
    parser.add_argument(
        "--output-app",
        help="Optional writable output bundle path. When set, clone --app there first and patch the copy.",
    )
    parser.add_argument("--lang", required=True, help="Language code, e.g. zh-Hans")
    parser.add_argument(
        "--source-root",
        default=str(DEFAULT_SOURCE_ROOT),
        help="Path to the language packs root (default: repo LanguageSwitcher_assets/languages)",
    )
    parser.add_argument(
        "--refresh-en",
        action="store_true",
        help="Extract English originals from the app bundle before patching",
    )
    parser.add_argument(
        "--english-output",
        help="Output directory for extracted English files (default: <source-root>/en)",
    )
    parser.add_argument(
        "--qm-target",
        choices=("none", "macos", "resources"),
        default="none",
        help="Optional experimental QM target directory",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    app_path = Path(args.app).expanduser().resolve()
    output_app = Path(args.output_app).expanduser().resolve() if args.output_app else None
    source_root = Path(args.source_root).expanduser().resolve()

    if not app_path.is_dir():
        print(f"ERROR: app bundle not found: {app_path}", file=sys.stderr)
        return 1
    if not source_root.is_dir():
        print(f"ERROR: source root not found: {source_root}", file=sys.stderr)
        return 1
    if not (source_root / args.lang).is_dir():
        print(f"ERROR: language pack not found: {source_root / args.lang}", file=sys.stderr)
        return 1

    target_app = prepare_target_app(app_path, output_app)
    english_output = (
        Path(args.english_output).expanduser().resolve()
        if args.english_output
        else (source_root / "en")
    )

    try:
        if output_app is not None:
            print(f"Cloned source bundle → {target_app}")

        if args.refresh_en:
            refresh_english_snapshot(app_path, english_output)
            print(f"Refreshed English snapshot → {english_output}")

        patch_json_assets(target_app, source_root, args.lang)
        print(f"Patched JSON assets → {target_app}")

        if args.qm_target != "none":
            install_qm_assets(target_app, source_root, args.lang, args.qm_target)
            print(f"Installed experimental QM files to {args.qm_target} translations directory")
        else:
            print("Skipped QM install (JSON-only patch).")
    except PermissionError as exc:
        print(f"ERROR: permission denied while patching bundle: {exc}", file=sys.stderr)
        if output_app is None:
            suggested = Path.home() / "Applications" / f"Cavalry {args.lang}.app"
            print(
                f"TIP: patch a writable cloned bundle instead, e.g. --output-app '{suggested}'",
                file=sys.stderr,
            )
        return 1
    except FileNotFoundError as exc:
        print(f"ERROR: missing required file: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
