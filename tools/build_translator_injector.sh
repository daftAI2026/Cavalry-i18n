#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: $0 <output-dylib> [cavalry-frameworks-dir]" >&2
  exit 1
fi

find_qt_prefix() {
  if command -v qmake >/dev/null 2>&1; then
    local prefix
    prefix="$(qmake -query QT_INSTALL_PREFIX 2>/dev/null || true)"
    if [ -n "$prefix" ] && [ -d "$prefix" ]; then
      printf '%s\n' "$prefix"
      return 0
    fi
  fi

  if command -v brew >/dev/null 2>&1; then
    local formula
    for formula in qt qt@6 qtbase; do
      local prefix
      prefix="$(brew --prefix "$formula" 2>/dev/null || true)"
      if [ -n "$prefix" ] && [ -d "$prefix" ]; then
        printf '%s\n' "$prefix"
        return 0
      fi
    done
  fi

  return 1
}

OUTPUT="$1"
APP_FRAMEWORKS="${2:-/Applications/Cavalry.app/Contents/Frameworks}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$REPO_ROOT/desktop-patcher/injector/CavalryTranslatorInjector.mm"
QT_PREFIX="$(find_qt_prefix || true)"

if [ ! -f "$SOURCE" ]; then
  echo "injector source not found: $SOURCE" >&2
  exit 1
fi

if [ ! -d "$APP_FRAMEWORKS" ]; then
  echo "Cavalry frameworks not found: $APP_FRAMEWORKS" >&2
  exit 1
fi

if [ -z "$QT_PREFIX" ]; then
  echo "Qt headers not found. Install qt or qtbase (for example: brew install qt)." >&2
  exit 1
fi

QT_FRAMEWORKS="$QT_PREFIX/lib"
QT_CORE_HEADERS="$(ls -d "$QT_FRAMEWORKS/QtCore.framework/Versions/"*/Headers 2>/dev/null | head -n 1)"
QT_CORE_PRIVATE_HEADERS="$(ls -d "$QT_CORE_HEADERS"/*/QtCore 2>/dev/null | head -n 1)"

if [ -z "$QT_CORE_HEADERS" ] || [ -z "$QT_CORE_PRIVATE_HEADERS" ]; then
  echo "QtCore headers not found under $QT_PREFIX" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

clang++ \
  -std=c++17 \
  -fobjc-arc \
  -DQT_NO_VERSION_TAGGING \
  -dynamiclib \
  "$SOURCE" \
  -o "$OUTPUT" \
  -I"$QT_FRAMEWORKS" \
  -I"$QT_CORE_HEADERS" \
  -I"$QT_CORE_PRIVATE_HEADERS" \
  -F"$QT_FRAMEWORKS" \
  "$APP_FRAMEWORKS/QtCore.framework/Versions/A/QtCore" \
  "$APP_FRAMEWORKS/QtGui.framework/Versions/A/QtGui" \
  "$APP_FRAMEWORKS/QtWidgets.framework/Versions/A/QtWidgets" \
  -framework Foundation \
  -framework AppKit

echo "Built translator injector -> $OUTPUT"
