#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: launch_cavalry_with_injector.sh --app <Cavalry.app> --lang <lang> [options]

Options:
  --app <path>           Target Cavalry.app bundle to launch
  --lang <code>          Language code, e.g. zh-Hans
  --qm-dir <path>        Directory containing cavalry_<lang>.qm and qtbase_<lang>.qm
  --injector <path>      Output path for the built injector dylib
  --no-resign            Skip ad-hoc re-signing before launch
  --help                 Show this help text
EOF
}

APP_PATH=""
LANG_CODE=""
QM_DIR=""
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
    --qm-dir)
      QM_DIR="${2:-}"
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

if [ -z "$QM_DIR" ]; then
  QM_DIR="$APP_PATH/Contents/Resources/translations"
fi

if [ -z "$INJECTOR_PATH" ]; then
  CACHE_ROOT="${HOME}/Library/Caches/Cavalry-i18n"
  mkdir -p "$CACHE_ROOT"
  INJECTOR_PATH="$CACHE_ROOT/libCavalryTranslatorInjector.dylib"
fi

"$REPO_ROOT/tools/build_translator_injector.sh" "$INJECTOR_PATH"

if [ "$RESIGN_APP" -eq 1 ]; then
  codesign --force --deep --sign - "$APP_PATH"
fi

echo "Launching $APP_PATH with injected translator for $LANG_CODE"
exec env \
  DYLD_INSERT_LIBRARIES="$INJECTOR_PATH" \
  CAVALRY_I18N_LANG="$LANG_CODE" \
  CAVALRY_I18N_QM_DIR="$QM_DIR" \
  "$APP_BIN"
