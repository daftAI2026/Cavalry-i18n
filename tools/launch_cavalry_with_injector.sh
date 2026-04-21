#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: launch_cavalry_with_injector.sh --app <Cavalry.app> --lang <lang> [options]

Options:
  --app <path>                 Target Cavalry.app bundle to launch
  --lang <code>                Language code, e.g. zh-Hant
  --ts-dir <path>              Directory containing <lang>.ts translation sources
  --translations-dir <path>    Directory where cavalry_<lang>.qm and qtbase_<lang>.qm will be prepared
  --injector <path>            Output path for the built injector dylib
  --no-resign                  Skip ad-hoc re-signing before launch
  --help                       Show this help text
EOF
}

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

find_lrelease() {
  if command -v lrelease >/dev/null 2>&1; then
    command -v lrelease
    return 0
  fi

  local prefix
  prefix="$(find_qt_prefix || true)"
  if [ -n "$prefix" ] && [ -x "$prefix/bin/lrelease" ]; then
    printf '%s\n' "$prefix/bin/lrelease"
    return 0
  fi

  return 1
}

find_qt_translations_dir() {
  local prefix="$1"
  local candidate
  for candidate in \
    "$prefix/share/qt/translations" \
    "$prefix/share/qt6/translations" \
    "$prefix/translations"; do
    if [ -d "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

remove_signature_if_present() {
  local target="$1"
  local output=""

  if output="$("/usr/bin/codesign" --remove-signature "$target" 2>&1)"; then
    return 0
  fi

  case "$output" in
    *"not signed at all"*|*"code object is not signed"*)
      return 0
      ;;
    *)
      echo "$output" >&2
      return 1
      ;;
  esac
}

APP_PATH=""
LANG_CODE=""
TS_DIR=""
TRANSLATIONS_DIR=""
INJECTOR_PATH=""
RESIGN_APP=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --app)
      APP_PATH="${2:-}"
      shift 2
      ;;
    --lang)
      LANG_CODE="${2:-}"
      shift 2
      ;;
    --ts-dir)
      TS_DIR="${2:-}"
      shift 2
      ;;
    --translations-dir)
      TRANSLATIONS_DIR="${2:-}"
      shift 2
      ;;
    --injector)
      INJECTOR_PATH="${2:-}"
      shift 2
      ;;
    --no-resign)
      RESIGN_APP=0
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$APP_PATH" ] || [ -z "$LANG_CODE" ]; then
  usage >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="$(cd "$(dirname "$APP_PATH")" && pwd)/$(basename "$APP_PATH")"
APP_BIN="$APP_PATH/Contents/MacOS/Cavalry"

if [ ! -x "$APP_BIN" ]; then
  echo "App binary not found: $APP_BIN" >&2
  exit 1
fi

if [ -z "$TS_DIR" ]; then
  TS_DIR="$REPO_ROOT/tools"
fi

if [ -z "$TRANSLATIONS_DIR" ]; then
  CACHE_ROOT="${HOME}/Library/Caches/Cavalry-i18n"
  TRANSLATIONS_DIR="$CACHE_ROOT/translations/$LANG_CODE"
fi

if [ -z "$INJECTOR_PATH" ]; then
  CACHE_ROOT="${HOME}/Library/Caches/Cavalry-i18n"
  INJECTOR_PATH="$CACHE_ROOT/libCavalryTranslatorInjector.dylib"
fi

TS_PATH="$TS_DIR/$LANG_CODE.ts"
if [ ! -f "$TS_PATH" ]; then
  echo "Translation source not found: $TS_PATH" >&2
  exit 1
fi

LRELEASE="$(find_lrelease || true)"
if [ -z "$LRELEASE" ]; then
  echo "lrelease not found. Install qt or qtbase (for example: brew install qt)." >&2
  exit 1
fi

mkdir -p "$TRANSLATIONS_DIR"
"$LRELEASE" "$TS_PATH" -qm "$TRANSLATIONS_DIR/cavalry_$LANG_CODE.qm" >/dev/null

QT_PREFIX="$(find_qt_prefix || true)"
if [ -n "$QT_PREFIX" ]; then
  QT_TRANSLATIONS_DIR="$(find_qt_translations_dir "$QT_PREFIX" || true)"
  if [ -n "$QT_TRANSLATIONS_DIR" ] && [ -f "$QT_TRANSLATIONS_DIR/qtbase_$LANG_CODE.qm" ]; then
    cp "$QT_TRANSLATIONS_DIR/qtbase_$LANG_CODE.qm" "$TRANSLATIONS_DIR/qtbase_$LANG_CODE.qm"
  else
    echo "warning: qtbase_$LANG_CODE.qm not found under $QT_PREFIX; standard Qt widgets may stay English" >&2
  fi
else
  echo "warning: Qt install prefix not found; standard Qt widgets may stay English" >&2
fi

"$REPO_ROOT/tools/build_translator_injector.sh" "$INJECTOR_PATH" "$APP_PATH/Contents/Frameworks"

if [ "$RESIGN_APP" -eq 1 ]; then
  while IFS= read -r crashpad_path; do
    if [ -n "$crashpad_path" ]; then
      remove_signature_if_present "$crashpad_path"
      /usr/bin/codesign --force --sign - "$crashpad_path"
    fi
  done < <(find "$APP_PATH" -type f -name crashpad_handler)

  /usr/bin/codesign --force --deep --sign - "$APP_PATH"
fi

echo "Launching $APP_PATH with injected translator for $LANG_CODE"
LAUNCH_LOG="${HOME}/Library/Caches/Cavalry-i18n/launcher.log"
mkdir -p "$(dirname "$LAUNCH_LOG")"
nohup env \
  DYLD_INSERT_LIBRARIES="$INJECTOR_PATH" \
  CAVALRY_I18N_LANG="$LANG_CODE" \
  CAVALRY_I18N_QM_DIR="$TRANSLATIONS_DIR" \
  "$APP_BIN" >>"$LAUNCH_LOG" 2>&1 &
