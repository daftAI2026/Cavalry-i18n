#!/usr/bin/env python3
"""Contract check for the Cavalry translator injector prototype."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
SOURCE = REPO / "desktop-patcher" / "injector" / "CavalryTranslatorInjector.mm"
BUILD_SCRIPT = REPO / "tools" / "build_translator_injector.sh"


def main() -> int:
    if not SOURCE.exists():
        print(f"FAIL: injector source missing: {SOURCE}")
        return 1
    if not BUILD_SCRIPT.exists():
        print(f"FAIL: injector build script missing: {BUILD_SCRIPT}")
        return 1

    if sys.platform != "darwin":
        print("PASS: injector contract files exist (build skipped off macOS)")
        return 0

    if shutil.which("qmake") is None:
        print("FAIL: qmake not found")
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        output = Path(tmp) / "libCavalryTranslatorInjector.dylib"
        result = subprocess.run(
            [str(BUILD_SCRIPT), str(output)],
            cwd=REPO,
            capture_output=True,
            text=True,
            env=os.environ.copy(),
        )
        if result.returncode != 0:
            print("FAIL: build script exited non-zero")
            print(result.stdout)
            print(result.stderr)
            return 1
        if not output.exists():
            print(f"FAIL: expected injector dylib at {output}")
            return 1

    print("PASS: translator injector contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
