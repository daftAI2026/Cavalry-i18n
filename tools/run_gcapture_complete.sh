#!/usr/bin/env bash
set -euo pipefail

# G-CAPTURE Complete Workflow
# Executes: copy app → codesign → injector capture (EN) → AX capture → merge → verify

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_ROOT="${HOME}/Library/Caches/Cavalry-i18n"
SESSION_UUID="${SESSION_UUID:-$(uuidgen)}"
SESSION_DIR="$CACHE_ROOT/sessions/$SESSION_UUID"
CAVALRY_APP="${1:-/Applications/Cavalry.app}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[G-CAPTURE]${NC} $*"; }
warn() { echo -e "${YELLOW}[G-CAPTURE]${NC} $*" >&2; }
err() { echo -e "${RED}[G-CAPTURE ERROR]${NC} $*" >&2; exit 1; }

# Setup session directories
info "Creating session directory: $SESSION_DIR"
mkdir -p "$SESSION_DIR/runtime" "$SESSION_DIR/audit"

# Copy Cavalry.app to session dir
TARGET_APP="$SESSION_DIR/cavalry-target.app"
if [ -d "$TARGET_APP" ]; then
  warn "Target app already exists, removing..."
  rm -rf "$TARGET_APP"
fi

info "Copying $CAVALRY_APP to $TARGET_APP"
cp -r "$CAVALRY_APP" "$TARGET_APP"

TARGET_BIN="$TARGET_APP/Contents/MacOS/Cavalry"
if [ ! -x "$TARGET_BIN" ]; then
  err "Target app binary not found: $TARGET_BIN"
fi

# Remove signatures to allow re-signing
info "Removing signatures from target app..."

# Remove signatures from all components first
find "$TARGET_APP" -type f -name crashpad_handler | while read f; do
  /usr/bin/codesign --remove-signature "$f" 2>/dev/null || true
done

/usr/bin/codesign --remove-signature "$TARGET_APP" 2>/dev/null || true

info "Re-signing app components..."
# Pre-sign all Mach-O binaries to avoid framework ambiguity errors
find "$TARGET_APP/Contents/MacOS" -type f | while read binary; do
  if file "$binary" | grep -q "Mach-O"; then
    /usr/bin/codesign --force --sign - "$binary" 2>/dev/null || true
  fi
done

find "$TARGET_APP/Contents/Frameworks" -type f | while read binary; do
  if file "$binary" | grep -q "Mach-O"; then
    /usr/bin/codesign --force --sign - "$binary" 2>/dev/null || true
  fi
done

# Now sign the whole bundle with --deep
/usr/bin/codesign --force --deep --sign - "$TARGET_APP" 2>&1 | head -3 || true

info "Verifying signature state..."
CODESIGN_OUT=$(/usr/bin/codesign -dv "$TARGET_APP" 2>&1 || true)
if echo "$CODESIGN_OUT" | grep -q "Identifier="; then
  info "✓ App re-signed successfully"
else
  err "Failed to sign app"
fi

# Verify codesign state
CODESIGN_EVIDENCE="$SESSION_DIR/audit/codesign-evidence.txt"
info "Verifying codesign state..."
/usr/bin/codesign -dv --entitlements - "$TARGET_APP" > "$CODESIGN_EVIDENCE" 2>&1 || true

if grep -q "runtime" "$CODESIGN_EVIDENCE"; then
  err "Hardened runtime flag still present - injection may fail"
fi

if grep -q "library-validation" "$CODESIGN_EVIDENCE"; then
  err "Library validation flag still present - injection may fail"
fi

info "Codesign verification PASS"
echo "- Hardened runtime: NOT present ✓"
echo "- Library validation: NOT present ✓"

# Build injector
info "Building injector dylib..."
eval "$(node "$REPO_ROOT/tools/resolve_cavalry_qt_sdk.js" --app "$TARGET_APP" --ensure --print-env)"
/bin/bash "$REPO_ROOT/tools/build_translator_injector.sh" \
  "$CACHE_ROOT/libCavalryTranslatorInjector.dylib" \
  "$TARGET_APP/Contents/Frameworks"

INJECTOR_PATH="$CACHE_ROOT/libCavalryTranslatorInjector.dylib"
if [ ! -f "$INJECTOR_PATH" ]; then
  err "Injector build failed: $INJECTOR_PATH not found"
fi
info "Injector built: $INJECTOR_PATH"

# English capture (injector)
info "Launching Cavalry with English dump-only capture..."
LAUNCH_LOG="$SESSION_DIR/audit/en-injector-launch.log"
PID=$(
  nohup env \
    DYLD_INSERT_LIBRARIES="$INJECTOR_PATH" \
    CAVALRY_I18N_LANG="en" \
    CAVALRY_I18N_CACHE_ROOT="$CACHE_ROOT" \
    CAVALRY_I18N_SESSION_DIR="$SESSION_DIR" \
    CAVALRY_I18N_SESSION_UUID="$SESSION_UUID" \
    "$TARGET_BIN" >>"$LAUNCH_LOG" 2>&1 &
  echo "$!"
)
echo "$PID" > "$SESSION_DIR/audit/capture-pid.txt"
info "Cavalry launched with PID $PID"

# Wait for injector capture
info "Waiting for injector to capture English runtime (up to 60 seconds)..."
EN_INJECTOR_INVENTORY="$SESSION_DIR/runtime/en-injector-inventory.json"
ATTEMPT=0
while [ $ATTEMPT -lt 60 ]; do
  if [ -f "$EN_INJECTOR_INVENTORY" ]; then
    info "Injector capture complete: $EN_INJECTOR_INVENTORY"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done

if [ ! -f "$EN_INJECTOR_INVENTORY" ]; then
  warn "Injector inventory not found after 60 seconds"
  warn "Launch log:"
  cat "$LAUNCH_LOG" >&2
  echo "PID $PID may still be running - kill with: kill $PID"
fi

# AX capture for all languages
for LANG in en zh-Hans zh-Hant ja_JP; do
  info "Capturing accessibility tree for $LANG..."
  node "$REPO_ROOT/tools/capture_accessibility_inventory.js" \
    --pid "$PID" \
    --language "$LANG" \
    --session-uuid "$SESSION_UUID" \
    --bundle-hash "$(shasum -a 256 "$TARGET_BIN" | cut -d' ' -f1)" \
    --output "$SESSION_DIR/runtime/${LANG}-ax-inventory.json" \
    --audit-log "$SESSION_DIR/audit/${LANG}-ax-capture.json" \
    || warn "AX capture for $LANG failed or incomplete"
done

# Give Cavalry time to stabilize
sleep 2

# Kill Cavalry instance
info "Terminating Cavalry (PID $PID)..."
PID_NUM=$(cat "$SESSION_DIR/audit/capture-pid.txt" 2>/dev/null || echo "0")
if [ "$PID_NUM" -gt 0 ]; then
  kill "$PID_NUM" 2>/dev/null || true
fi

# Wait for process to die
sleep 2

# Merge inventories
for LANG in en zh-Hans zh-Hant ja_JP; do
  INJECTOR_INV="$SESSION_DIR/runtime/${LANG}-injector-inventory.json"
  AX_INV="$SESSION_DIR/runtime/${LANG}-ax-inventory.json"
  MERGED_INV="$SESSION_DIR/runtime/${LANG}-merged-inventory.json"
  
  if [ -f "$INJECTOR_INV" ] && [ -f "$AX_INV" ]; then
    info "Merging $LANG inventories..."
    node "$REPO_ROOT/tools/merge_runtime_inventory.js" \
      --injector "$INJECTOR_INV" \
      --accessibility "$AX_INV" \
      --output "$MERGED_INV" \
      --audit-log "$SESSION_DIR/audit/${LANG}-merge.json"
  else
    warn "Cannot merge $LANG: missing injector or AX inventory"
  fi
done

# Generate run record
info "Generating run record..."
BUNDLE_HASH=$(shasum -a 256 "$TARGET_BIN" | cut -d' ' -f1)
cat > "$SESSION_DIR/full-ui-run-record.json" << EOFRECORD
{
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sessionUuid": "$SESSION_UUID",
  "sessionDir": "$SESSION_DIR",
  "target": {
    "cavalryVersion": "2.7.1",
    "qtVersion": "6.6.3",
    "bundleHash": "$BUNDLE_HASH",
    "appPath": "$TARGET_APP"
  },
  "codesignEvidence": "audit/codesign-evidence.txt",
  "languages": ["en", "zh-Hans", "zh-Hant", "ja_JP"],
  "finishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOFRECORD

info "G-CAPTURE workflow complete"
info "Session: $SESSION_UUID"
info "Results:"
echo "  Runtime dir: $SESSION_DIR/runtime"
echo "  Audit dir: $SESSION_DIR/audit"
echo "  Run record: $SESSION_DIR/full-ui-run-record.json"
echo ""

# Display what we captured
if [ -f "$EN_INJECTOR_INVENTORY" ]; then
  info "English injector inventory summary:"
  node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('$EN_INJECTOR_INVENTORY')); console.log('  menuBars:', d.menuBars?.length || 0); console.log('  widgetTexts:', d.widgetTexts?.length || 0);"
fi
