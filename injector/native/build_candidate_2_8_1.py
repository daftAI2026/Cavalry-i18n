#!/usr/bin/env python3
"""Build 2.8.1 with its ABI inputs while retaining the 2.8.0 build unchanged.
[INPUT]: Shared native sources, explicit 2.8.1 ABI profile and vendor Frameworks.
[OUTPUT]: Isolated 281 ABI inputs, including fmt11 pointer-only C strings, and build receipt.
[POS]: 2.8.1-only build entry; does not install, launch or modify Cavalry.
[PROTOCOL]: Update this header and CLAUDE.md when changing the contract.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def prepare_tree(root: Path, destination: Path) -> dict:
    profile = root / "injector/native/abi_2_8_1"
    for directory in ("injector", "languages", "tools"):
        shutil.copytree(root / directory, destination / directory,
                        ignore=shutil.ignore_patterns("node_modules", "__pycache__", "local", "runs"))
    native = destination / "injector/native"
    replaced = []
    for source in profile.iterdir():
        if source.suffix not in (".h", ".cpp", ".sh", ".py"):
            continue
        if source.name.startswith("verify_") or source.name == "contract_snapshot_test.py":
            continue
        shutil.copy2(source, native / source.name)
        replaced.append(source.name)

    # Only the selected target's entry names and byte windows differ here.
    title = native / "title_format_adapter.inc"
    text = title.read_text()
    if text.count('appFrameworkPath("libfmt.10.dylib"') != 1:
        raise RuntimeError("shared title adapter no longer has its expected library input")
    old_suffix = 'values[2].cstring.unused != 0 || suffix == nullptr'
    if text.count(old_suffix) != 1:
        raise RuntimeError("shared title adapter no longer has its expected 2.8.0 suffix input")
    # 280 writes both words (stp x8, xzr); 281 only writes the C-string pointer
    # (str x21). fmt11 does not define the second union word for a C string.
    text = text.replace(old_suffix, 'suffix == nullptr')
    title.write_text(text.replace('appFrameworkPath("libfmt.10.dylib"',
                                  'appFrameworkPath("libfmt.11.dylib"'))
    viewport = native / "viewport_font_adapter.inc"
    text = viewport.read_text()
    start = text.index("bool verifyViewportProbe(")
    end = text.index("viewport_owner::StackRange currentThreadStack", start)
    viewport.write_text(text[:start] + (profile / "viewport_probe.inc").read_text() + text[end:])

    bindings = native / "skia_original_bindings.inc"
    text = bindings.read_text()
    old_blob = "imageAddress(gSkiaImage, 0x1b40d8)"
    if text.count(old_blob) != 1:
        raise RuntimeError("shared Skia binding no longer has its expected 2.8.0 input")
    bindings.write_text(text.replace(old_blob,
        "imageAddress(gSkiaImage, observer_contract::kTextBlobSymbolOffset)"))

    build = native / "build_candidate.sh"
    text = build.read_text()
    text = text.replace("clang++ ", "clang++ -DCAVALRY_NATIVE_TARGET_281=1 ")
    build.write_text(text)
    receipt = {"target": "2.8.1", "sharedSource": str(root),
               "buildTree": str(destination), "profileFiles": sorted(replaced),
               "production280Modified": False,
               "profileSha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                  for p in sorted(profile.iterdir()) if p.is_file()}}
    (destination / "source-profile.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frameworks", type=Path)
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    destination = Path(tempfile.mkdtemp(prefix="cavalry-281-source.")).resolve()
    prepare_tree(root, destination)
    print(f"SOURCE_PROFILE: {destination / 'source-profile.json'}", flush=True)
    if args.prepare_only:
        return 0
    return subprocess.run(["bash", str(destination / "injector/native/build_candidate.sh"),
                           str(args.frameworks.resolve())], env=os.environ.copy()).returncode


if __name__ == "__main__":
    raise SystemExit(main())
