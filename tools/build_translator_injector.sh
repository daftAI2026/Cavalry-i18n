#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: $0 <output-dylib> [frameworks-dir]" >&2
  exit 1
fi

find_qt_prefix() {
  if [ -n "${CAVALRY_QT_PREFIX:-}" ] && [ -d "${CAVALRY_QT_PREFIX}" ]; then
    printf '%s\n' "${CAVALRY_QT_PREFIX}"
    return 0
  fi

  if [ -n "${QT_ROOT_DIR:-}" ] && [ -d "${QT_ROOT_DIR}" ]; then
    printf '%s\n' "${QT_ROOT_DIR}"
    return 0
  fi

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

read_plist_value() {
  local plist="$1"
  local key="$2"
  /usr/libexec/PlistBuddy -c "Print :$key" "$plist" 2>/dev/null || true
}

major_minor_version() {
  printf '%s\n' "$1" | awk -F. '{ print $1 "." $2 }'
}

OUTPUT="$1"
LINK_FRAMEWORKS="${2:-/Applications/Cavalry.app/Contents/Frameworks}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$REPO_ROOT/injector/CavalryTranslatorInjector.mm"
GENERATED="$REPO_ROOT/injector/generated_translations.inc"
QT_PREFIX="$(find_qt_prefix || true)"
TARGET_QT_VERSION="${CAVALRY_QT_VERSION:-}"

if [ ! -f "$SOURCE" ]; then
  echo "injector source not found: $SOURCE" >&2
  exit 1
fi

if [ -z "$QT_PREFIX" ]; then
  echo "Qt headers not found. Install qt or qtbase (for example: brew install qt)." >&2
  exit 1
fi

QT_FRAMEWORKS="$QT_PREFIX/lib"
QT_CORE_HEADERS="$(ls -d "$QT_FRAMEWORKS/QtCore.framework/Versions/"*/Headers 2>/dev/null | head -n 1)"
QT_CORE_LINK=""
LINK_INPUTS=()
BUILD_QT_VERSION=""

if [ -z "$QT_CORE_HEADERS" ]; then
  echo "QtCore headers not found under $QT_PREFIX" >&2
  exit 1
fi

BUILD_QT_VERSION="$(read_plist_value "$QT_FRAMEWORKS/QtCore.framework/Resources/Info.plist" "CFBundleVersion")"

if [ -z "$BUILD_QT_VERSION" ] && command -v qmake >/dev/null 2>&1; then
  BUILD_QT_VERSION="$(qmake -query QT_VERSION 2>/dev/null || true)"
fi

if [ -z "$TARGET_QT_VERSION" ] && [ -f "$LINK_FRAMEWORKS/QtCore.framework/Resources/Info.plist" ]; then
  TARGET_QT_VERSION="$(read_plist_value "$LINK_FRAMEWORKS/QtCore.framework/Resources/Info.plist" "CFBundleVersion")"
fi

if [ -z "$TARGET_QT_VERSION" ]; then
  echo "Target Qt version not found. Set CAVALRY_QT_VERSION or provide a Cavalry frameworks dir with QtCore.framework." >&2
  exit 1
fi

if [ -z "$BUILD_QT_VERSION" ]; then
  echo "Build Qt version not found under $QT_PREFIX" >&2
  exit 1
fi

if [ "$(major_minor_version "$BUILD_QT_VERSION")" != "$(major_minor_version "$TARGET_QT_VERSION")" ]; then
  echo "Qt version mismatch: build Qt $BUILD_QT_VERSION does not match target Cavalry Qt $TARGET_QT_VERSION" >&2
  exit 1
fi

if [ -f "$LINK_FRAMEWORKS/QtCore.framework/Versions/A/QtCore" ]; then
  QT_CORE_LINK="$LINK_FRAMEWORKS/QtCore.framework/Versions/A/QtCore"
elif [ -f "$QT_FRAMEWORKS/QtCore.framework/Versions/A/QtCore" ]; then
  QT_CORE_LINK="$QT_FRAMEWORKS/QtCore.framework/Versions/A/QtCore"
else
  echo "QtCore framework binary not found under $LINK_FRAMEWORKS or $QT_FRAMEWORKS" >&2
  exit 1
fi

LINK_INPUTS+=("$QT_CORE_LINK")

for framework in QtGui QtWidgets; do
  if [ -f "$LINK_FRAMEWORKS/${framework}.framework/Versions/A/${framework}" ]; then
    LINK_INPUTS+=("$LINK_FRAMEWORKS/${framework}.framework/Versions/A/${framework}")
  elif [ -f "$QT_FRAMEWORKS/${framework}.framework/Versions/A/${framework}" ]; then
    LINK_INPUTS+=("$QT_FRAMEWORKS/${framework}.framework/Versions/A/${framework}")
  fi
done

mkdir -p "$(dirname "$OUTPUT")"
node "$REPO_ROOT/tools/generate_embedded_translations.js" "$GENERATED"

clang++ \
  -std=c++17 \
  -fobjc-arc \
  -DQT_NO_VERSION_TAGGING \
  -dynamiclib \
  -arch arm64 \
  -arch x86_64 \
  -install_name "@rpath/$(basename "$OUTPUT")" \
  -Wl,-rpath,"$LINK_FRAMEWORKS" \
  -Wl,-rpath,"$QT_FRAMEWORKS" \
  "$SOURCE" \
  -o "$OUTPUT" \
  -I"$QT_FRAMEWORKS" \
  -I"$QT_CORE_HEADERS" \
  -F"$QT_FRAMEWORKS" \
  -F"$LINK_FRAMEWORKS" \
  -framework QtCore \
  -framework QtGui \
  -framework QtWidgets \
  -framework Foundation \
  -framework AppKit

# Strip clang's linker-signed flag and re-sign as proper ad-hoc.
# DYLD_INSERT_LIBRARIES injection is silently rejected by amfid when the dylib
# carries flags=0x20002(adhoc,linker-signed); proper ad-hoc (flags=0x2) is required.
/usr/bin/codesign --force --sign - "$OUTPUT"

# Verify the dylib has the expected ad-hoc-only signature.
DYLIB_FLAGS="$(/usr/bin/codesign -dv "$OUTPUT" 2>&1 | awk -F'[()]' '/^CodeDirectory.*flags=/ { for (i=1;i<=NF;i++) if ($i ~ /,/) print $i }')"
case "$DYLIB_FLAGS" in
  *linker-signed*)
    echo "FATAL: dylib is still linker-signed after codesign --force --sign -. Check Xcode CLT version." >&2
    /usr/bin/codesign -dv "$OUTPUT" >&2
    exit 1
    ;;
esac

echo "Built translator injector -> $OUTPUT"
