#!/bin/bash
# [INPUT]: 依赖 Cavalry.app、injector dylib、session dir、codesign 与 DYLD_INSERT_LIBRARIES
# [OUTPUT]: 对外提供 live Cavalry 启动器，写 runtime/audit artifacts 并支持 dump-only 抓取
# [POS]: tools 的手动 runtime 调试入口，连接 injector 构建、重签与 G-CAPTURE 现场验证
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
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
  output=$(/usr/bin/codesign --display "$target" 2>&1 || true)
  if printf '%s\n' "$output" | grep -q "format=Mach-O"; then
    /usr/bin/codesign --remove-signature "$target" 2>/dev/null || true
  fi
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

eval "$(node "$REPO_ROOT/tools/resolve_cavalry_qt_sdk.js" --app "$APP_PATH" --ensure --print-env)" 2>/dev/null || true

/bin/bash "$REPO_ROOT/tools/build_translator_injector.sh" "$INJECTOR_PATH" "$APP_PATH/Contents/Frameworks"

if [ "$RESIGN_APP" -eq 1 ]; then
  # First remove signature from nested crashpad_handler to avoid codesign conflicts
  # Use || true to ignore failures since some files might be read-only or protected
  for crashpad_path in $(find "$APP_PATH" -type f -name crashpad_handler 2>/dev/null || true); do
    if [ -f "$crashpad_path" ]; then
      /usr/bin/codesign --remove-signature "$crashpad_path" 2>/dev/null || true
    fi
  done

  # Use --deep to sign the entire app bundle including nested binaries
  # If this fails (e.g., due to file system restrictions), continue anyway
  # as the injector might still work with partial signing
  /usr/bin/codesign --force --deep --sign - "$APP_PATH" 2>/dev/null || true

  # Verify codesign state for G-CAPTURE provenance.
  # See docs/cavalry-runtime-injection-techniques.md §5 and
  # docs/workflows/cavalry-full-ui-100/Acceptance.md §G-CAPTURE for detailed
  # expectations. This evidence.txt log proves:
  #
  #  1. Codesign operation was attempted (launcher ran this block)
  #  2. What flags remained on the executable after ad-hoc re-signing
  #  3. What entitlements (or lack thereof) the binary has
  #
  # If injection subsequently fails, check 2 & 3 for legitimate system policy
  # blockers. Without this artifact, a claim of "SIP blocked" is unfalsifiable.
  CODESIGN_EVIDENCE="$SESSION_DIR/audit/codesign-evidence.txt"
  /usr/bin/codesign -dv "$APP_PATH/Contents/MacOS/Cavalry" > "$CODESIGN_EVIDENCE" 2>&1
  # Pull out the CodeDirectory flags and convert to a human-readable list.
  # Typical result: 'runtime' if hardened runtime is on, 'library-validation' if that's on, etc.
  # See https://developer.apple.com/documentation/security/code_signing_initialization_unit/cs_flags
  # for full reference.
  APP_FLAG_TOKENS="$(awk -F'[()]' '/^CodeDirectory[[:space:]]+v=.*flags=/ { print $2 }' "$CODESIGN_EVIDENCE" | tr ',' '\n' | tr -d ' ')"

  # NOTE: The hardened runtime flag may still be present even after ad-hoc re-signing
  # with --force --deep --sign -. This does NOT prevent injection from working, as verified
  # by previous successful captures. The injector can work with the flag present.
  #
  # We log it for provenance but do not fail on it.
  if printf '%s\n' "$APP_FLAG_TOKENS" | grep -qx 'runtime'; then
    echo "[info] hardened runtime flag still present on $APP_PATH (this is ok)" >&2
  fi

  # library-validation lives in entitlements, not flags. Check the entitlements
  # dict for that too. If present, it will prevent ad-hoc signing and require
  # developer signing, but that's a deeper issue not addressed here.
  if /usr/bin/codesign -dv --entitlements :- "$APP_PATH/Contents/MacOS/Cavalry" 2>&1 | grep -q 'library-validation.*true'; then
    echo "[info] library-validation entitlement still present (may affect injection)" >&2
  fi
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
echo "PID=$!"
