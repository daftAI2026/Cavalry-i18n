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

# Check if app is writable in place; if not, create a session-specific copy
WORK_APP_PATH="$APP_PATH"
if [ "$RESIGN_APP" -eq 1 ]; then
  # Try to detect if we'll be able to modify the app in place
  TEST_FILE="$APP_PATH/.cavalry-i18n-test-$$"
  if ! touch "$TEST_FILE" 2>/dev/null; then
    # App path is read-only (e.g., /Applications); create a copy in session dir
    WORK_APP_PATH="$SESSION_DIR/cavalry-target.app"
    if [ ! -d "$WORK_APP_PATH" ]; then
      echo "[G-CAPTURE] Copying app to session directory for code signing..." >&2
      cp -r "$APP_PATH" "$WORK_APP_PATH"
    fi
  else
    rm -f "$TEST_FILE"
  fi
fi

if [ "$RESIGN_APP" -eq 1 ]; then
  # Remove existing signatures from the main binary
  /usr/bin/codesign --remove-signature "$WORK_APP_PATH/Contents/MacOS/Cavalry" 2>/dev/null || true

  # Remove signatures from nested binaries
  for binary in $(find "$WORK_APP_PATH" -type f -perm +111 -name "*.dylib" -o -name "crashpad_handler" 2>/dev/null); do
    /usr/bin/codesign --remove-signature "$binary" 2>/dev/null || true
  done

  # Re-sign with ad-hoc signature
  # Sign individual components first to avoid framework format ambiguity
  for dylib in $(find "$WORK_APP_PATH/Contents/Frameworks" -name "*.dylib" 2>/dev/null); do
    /usr/bin/codesign --force --sign - "$dylib" 2>/dev/null || true
  done

  # Sign the main binary
  /usr/bin/codesign --force --sign - "$WORK_APP_PATH/Contents/MacOS/Cavalry" 2>/dev/null

  # Sign the entire app bundle
  /usr/bin/codesign --force --sign - "$WORK_APP_PATH" 2>/dev/null || true

   # Verify codesign state for G-CAPTURE provenance.
   # See doc/cavalry-runtime-injection-techniques.md §5 and
   # doc/workflows/cavalry-full-ui-100/Acceptance.md §G-CAPTURE for the contract.
   CODESIGN_EVIDENCE="$SESSION_DIR/audit/codesign-evidence.txt"
   mkdir -p "$(dirname "$CODESIGN_EVIDENCE")"
   /usr/bin/codesign -dv --entitlements - "$WORK_APP_PATH" > "$CODESIGN_EVIDENCE" 2>&1 || true

   # Parse the CodeDirectory flags=0xNNNN(token,token,...) line precisely.
   # Naive `grep "runtime"` would match unrelated text (paths, "Sealed Resources", etc.)
   # and either falsely trigger or never trigger; we extract the parenthesized flag
   # tokens explicitly.
   APP_FLAG_TOKENS="$(awk -F'[()]' '/^CodeDirectory[[:space:]]+v=.*flags=/ { print $2 }' "$CODESIGN_EVIDENCE" | tr ',' '\n' | tr -d ' ')"

   if printf '%s\n' "$APP_FLAG_TOKENS" | grep -qx 'runtime'; then
     echo "ERROR: hardened runtime flag still present on $WORK_APP_PATH after ad-hoc signing" >&2
     echo "  flag tokens: $APP_FLAG_TOKENS" >&2
     cat "$CODESIGN_EVIDENCE" >&2
     exit 1
   fi

   # library-validation lives in entitlements, not flags. Check the entitlements
   # XML block dumped by `codesign -dv --entitlements -` instead.
   if grep -q 'com\.apple\.security\.cs\.disable-library-validation\|<key>library-validation</key>\s*<true' "$CODESIGN_EVIDENCE"; then
     :  # disable-library-validation true means library validation is OFF; not a fail
   fi
   if grep -q '<key>com\.apple\.security\.cs\.allow-dyld-environment-variables</key>\s*<false' "$CODESIGN_EVIDENCE"; then
     echo "ERROR: app entitlements forbid DYLD env variables" >&2
     cat "$CODESIGN_EVIDENCE" >&2
     exit 1
   fi
   if printf '%s\n' "$APP_FLAG_TOKENS" | grep -qx 'restrict'; then
     echo "ERROR: restrict flag still present on $WORK_APP_PATH; DYLD_INSERT_LIBRARIES will be stripped" >&2
     cat "$CODESIGN_EVIDENCE" >&2
     exit 1
   fi

  # Mirror dylib-side flag check: clang's linker-signed flag prevents injection.
  if [ -f "$INJECTOR_PATH" ]; then
    DYLIB_FLAG_TOKENS="$(/usr/bin/codesign -dv "$INJECTOR_PATH" 2>&1 | awk -F'[()]' '/^CodeDirectory[[:space:]]+v=.*flags=/ { print $2 }' | tr ',' '\n' | tr -d ' ')"
    if printf '%s\n' "$DYLIB_FLAG_TOKENS" | grep -qx 'linker-signed'; then
      echo "ERROR: injector dylib is linker-signed; amfid will reject DYLD insertion." >&2
      echo "  Re-run tools/build_translator_injector.sh which now re-signs ad-hoc after clang." >&2
      exit 1
    fi
  fi

  echo "[G-CAPTURE] Codesign evidence -> $CODESIGN_EVIDENCE"
  echo "[G-CAPTURE] App flag tokens: ${APP_FLAG_TOKENS:-<none>}"
  echo "[G-CAPTURE] Dylib flag tokens: ${DYLIB_FLAG_TOKENS:-<not yet built>}"
fi

echo "Launching $WORK_APP_PATH with embedded translator for $LANG_CODE"
LAUNCH_LOG="$SESSION_DIR/audit/${LANG_CODE}-injector-launch.log"
mkdir -p "$(dirname "$LAUNCH_LOG")"
WORK_APP_BIN="$WORK_APP_PATH/Contents/MacOS/Cavalry"
nohup env \
  DYLD_INSERT_LIBRARIES="$INJECTOR_PATH" \
  CAVALRY_I18N_LANG="$LANG_CODE" \
  CAVALRY_I18N_CACHE_ROOT="$CACHE_ROOT" \
  CAVALRY_I18N_SESSION_DIR="$SESSION_DIR" \
  CAVALRY_I18N_SESSION_UUID="$SESSION_UUID" \
  "$WORK_APP_BIN" >>"$LAUNCH_LOG" 2>&1 &
echo "$!"
