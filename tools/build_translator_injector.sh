#!/usr/bin/env bash
# [INPUT]: 依赖 Qt SDK、可选 Cavalry.app Frameworks、macOS injector 主源/TransformTool text-path ABI 适配器与 generated_translations.inc
# [OUTPUT]: 对外构建启用 -O2/-fno-omit-frame-pointer、以 @loader_path 绑定目标 app Qt/libskia 的 universal injector dylib；干净 CI 无 vendor app 时只生成同 install-name 的临时 Skia 链接桩
# [POS]: tools 的 injector 发布构建入口，以 Qt minor、双 slice caller-frame 保留、可搬移运行时链接和稳定优化级别连接源码与 Tauri bundle resource，同时把 vendor 二进制依赖留在用户运行时
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
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

SKIA_LINK_STUB_DIR=""

cleanup_skia_link_stub() {
  if [ -z "$SKIA_LINK_STUB_DIR" ]; then
    return
  fi
  rm -f \
    "$SKIA_LINK_STUB_DIR/skia_link_stub.cpp" \
    "$SKIA_LINK_STUB_DIR/libskia.dylib"
  rmdir "$SKIA_LINK_STUB_DIR"
}

create_skia_link_stub() {
  local temp_base="${TMPDIR:-/tmp}"
  SKIA_LINK_STUB_DIR="$(mktemp -d "$temp_base/cavalry-i18n-skia-link.XXXXXX")"
  cat > "$SKIA_LINK_STUB_DIR/skia_link_stub.cpp" <<'EOF'
#include <cstddef>

extern "C" void cavalryI18nSkiaGetPathLinkStub(
    const void *,
    std::size_t,
    int,
    float,
    float,
    const void *,
    void *)
    __asm("__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath");

extern "C" void cavalryI18nSkiaGetPathLinkStub(
    const void *,
    std::size_t,
    int,
    float,
    float,
    const void *,
    void *)
{
}
EOF
  clang++ \
    -std=c++17 \
    -dynamiclib \
    -arch arm64 \
    -arch x86_64 \
    -install_name "@rpath/libskia.dylib" \
    "$SKIA_LINK_STUB_DIR/skia_link_stub.cpp" \
    -o "$SKIA_LINK_STUB_DIR/libskia.dylib"
  SKIA_LINK="$SKIA_LINK_STUB_DIR/libskia.dylib"
}

trap cleanup_skia_link_stub EXIT

OUTPUT="$1"
LINK_FRAMEWORKS="${2:-/Applications/Cavalry.app/Contents/Frameworks}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$REPO_ROOT/injector/CavalryTranslatorInjector.mm"
TOOL_HELP_SOURCE="$REPO_ROOT/injector/cavalry_i18n_macos_tool_help_text_path.cpp"
GENERATED="$REPO_ROOT/injector/generated_translations.inc"
QT_PREFIX="$(find_qt_prefix || true)"
TARGET_QT_VERSION="${CAVALRY_QT_VERSION:-}"

if [ ! -f "$SOURCE" ]; then
  echo "injector source not found: $SOURCE" >&2
  exit 1
fi

if [ ! -f "$TOOL_HELP_SOURCE" ]; then
  echo "macOS tool-help text-path source not found: $TOOL_HELP_SOURCE" >&2
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

SKIA_LINK="$LINK_FRAMEWORKS/libskia.dylib"
if [ ! -f "$SKIA_LINK" ]; then
  echo "Cavalry libskia.dylib not found under $LINK_FRAMEWORKS; using a temporary link-only ABI stub." >&2
  create_skia_link_stub
fi

clang++ \
  -std=c++17 \
  -O2 \
  -fno-omit-frame-pointer \
  -fobjc-arc \
  -DQT_NO_VERSION_TAGGING \
  -dynamiclib \
  -arch arm64 \
  -arch x86_64 \
  -install_name "@rpath/$(basename "$OUTPUT")" \
  -Wl,-rpath,@loader_path \
  -Wl,-rpath,"$LINK_FRAMEWORKS" \
  "$SOURCE" \
  "$TOOL_HELP_SOURCE" \
  "$SKIA_LINK" \
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

if ! /usr/bin/otool -L "$OUTPUT" | grep -Fq $'@rpath/libskia.dylib'; then
  echo "FATAL: injector is not linked against the runtime @rpath/libskia.dylib identity." >&2
  exit 1
fi

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
