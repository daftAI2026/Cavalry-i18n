#!/bin/bash
set -euo pipefail

DIST_DIR="${1:-dist}"
ICNS="desktop-patcher/resources/icon.icns"

if [ ! -f "$ICNS" ]; then
  echo "Icon not found: $ICNS" >&2
  exit 1
fi

TMPRSRC=$(mktemp /tmp/dmg-icon-XXXXXX.rsrc)
trap 'rm -f "$TMPRSRC"' EXIT

sips -i "$ICNS" >/dev/null 2>&1
DeRez -only icns "$ICNS" > "$TMPRSRC"

found=0
for dmg in "$DIST_DIR"/*.dmg; do
  [ -f "$dmg" ] || continue
  Rez -append "$TMPRSRC" -o "$dmg"
  SetFile -a C "$dmg"
  echo "Stamped icon: $(basename "$dmg")"
  found=1
done

if [ "$found" -eq 0 ]; then
  echo "No DMG files found in $DIST_DIR" >&2
  exit 1
fi
