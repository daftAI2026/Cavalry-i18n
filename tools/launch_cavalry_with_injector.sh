#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: launch_cavalry_with_injector.sh --app <Cavalry.app> --lang <lang> [options]

Options:
  --app <path>       Target Cavalry.app bundle to launch
  --lang <code>      Language code, e.g. zh-Hant
  --injector <path>  Injector dylib path to use or build into
  --session-dir <path>
                     Session directory that will own runtime/audit artifacts
  --session-uuid <value>
                     Explicit session UUID for provenance metadata
  --cache-root <path>
                     Shared cache root for source-map and injector build outputs
  --no-resign        Skip ad-hoc re-signing before launch
  --help             Show this help text
EOF
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
INJECTOR_PATH=""
SESSION_DIR=""
SESSION_UUID=""
CACHE_ROOT="${HOME}/Library/Caches/Cavalry-i18n"
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
    --injector)
      INJECTOR_PATH="${2:-}"
      shift 2
      ;;
    --session-dir)
      SESSION_DIR="${2:-}"
      shift 2
      ;;
    --session-uuid)
      SESSION_UUID="${2:-}"
      shift 2
      ;;
    --cache-root)
      CACHE_ROOT="${2:-}"
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

if [ -z "$SESSION_UUID" ]; then
  SESSION_UUID="$(uuidgen)"
fi

if [ -z "$SESSION_DIR" ]; then
  SESSION_DIR="$CACHE_ROOT/sessions/$SESSION_UUID"
fi

mkdir -p "$SESSION_DIR/runtime" "$SESSION_DIR/audit"

if [ -z "$INJECTOR_PATH" ]; then
  INJECTOR_PATH="$CACHE_ROOT/libCavalryTranslatorInjector.dylib"
fi

eval "$(node "$REPO_ROOT/tools/resolve_cavalry_qt_sdk.js" --app "$APP_PATH" --ensure --print-env)"
/bin/bash "$REPO_ROOT/tools/build_translator_injector.sh" "$INJECTOR_PATH" "$APP_PATH/Contents/Frameworks"

if [ "$RESIGN_APP" -eq 1 ]; then
  while IFS= read -r crashpad_path; do
    if [ -n "$crashpad_path" ]; then
      remove_signature_if_present "$crashpad_path"
      /usr/bin/codesign --force --sign - "$crashpad_path"
    fi
  done < <(find "$APP_PATH" -type f -name crashpad_handler)

  /usr/bin/codesign --force --deep --sign - "$APP_PATH"
fi

echo "Launching $APP_PATH with embedded translator for $LANG_CODE"
LAUNCH_LOG="$SESSION_DIR/audit/${LANG_CODE}-injector-launch.log"
mkdir -p "$(dirname "$LAUNCH_LOG")"
nohup env \
  DYLD_INSERT_LIBRARIES="$INJECTOR_PATH" \
  CAVALRY_I18N_LANG="$LANG_CODE" \
  CAVALRY_I18N_CACHE_ROOT="$CACHE_ROOT" \
  CAVALRY_I18N_SESSION_DIR="$SESSION_DIR" \
  CAVALRY_I18N_SESSION_UUID="$SESSION_UUID" \
  "$APP_BIN" >>"$LAUNCH_LOG" 2>&1 &
echo "$!"
