#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <output-dylib>" >&2
  exit 1
fi

OUTPUT="$1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$REPO_ROOT/desktop-patcher/injector/CavalryTranslatorInjector.mm"
APP_FRAMEWORKS="/Applications/Cavalry.app/Contents/Frameworks"
QTBASE_PREFIX="$(brew --prefix qtbase 2>/dev/null || true)"

if [ -z "$QTBASE_PREFIX" ]; then
  echo "qtbase headers not found via Homebrew" >&2
  exit 1
fi

QT_FRAMEWORKS="$QTBASE_PREFIX/lib"
QT_CORE_HEADERS="$QT_FRAMEWORKS/QtCore.framework/Versions/A/Headers"
QT_CORE_PRIVATE_HEADERS="$QT_FRAMEWORKS/QtCore.framework/Versions/A/Headers/6.11.0/QtCore"

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

echo "Built translator injector → $OUTPUT"
