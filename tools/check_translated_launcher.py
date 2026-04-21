#!/usr/bin/env python3
"""Contract check for the translated launcher script."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
LAUNCHER = REPO / "tools" / "launch_cavalry_with_injector.sh"


def main() -> int:
    if not LAUNCHER.exists():
        print(f"FAIL: launcher script missing: {LAUNCHER}")
        return 1

    result = subprocess.run([str(LAUNCHER), "--help"], capture_output=True, text=True)
    if result.returncode != 0:
        print("FAIL: launcher --help exited non-zero")
        print(result.stdout)
        print(result.stderr)
        return 1

    if "--app" not in result.stdout or "--lang" not in result.stdout:
        print("FAIL: launcher help missing required arguments")
        return 1

    print("PASS: translated launcher contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
