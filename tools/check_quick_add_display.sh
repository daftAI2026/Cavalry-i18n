#!/usr/bin/env bash
# [INPUT]: 依赖显式 Qt 6.6.3 macOS SDK 与 tools/check_quick_add_display.cpp 、check_quick_add_display_tags.h 及隔离 payload/delegate fixture
# [OUTPUT]: 在临时目录编译并运行 Quick Add 显示副本合同，覆盖正向投影、所有 fail-open gate、非绘制路径转发、model reset 与 QObject 生命周期
# [POS]: tools 的 Quick Add 显示 ABI 测试入口；只使用 vendor-free fake，不加载、读取或修改真实 Cavalry.app，也不把 fixture 当作 vendor 证明
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ "$#" -gt 1 ]; then
  echo "usage: $0 [qt-prefix]" >&2
  exit 2
fi

QT_PREFIX="${1:-${CAVALRY_QT_PREFIX:-$ROOT/qt_sdk/6.6.3/macos}}"
QT_PREFIX="$(cd "$QT_PREFIX" && pwd)"
QT="$QT_PREFIX/lib"
QMAKE="$QT_PREFIX/bin/qmake"
MOC="$QT_PREFIX/libexec/moc"
SOURCE="$ROOT/tools/check_quick_add_display.cpp"

if [ ! -x "$QMAKE" ]; then
  echo "Qt qmake not found: $QMAKE" >&2
  exit 1
fi
if [ "$($QMAKE -query QT_VERSION)" != "6.6.3" ]; then
  echo "Qt 6.6.3 required: $QT_PREFIX" >&2
  exit 1
fi
if [ ! -x "$MOC" ]; then
  echo "Qt 6.6.3 moc not found: $MOC" >&2
  exit 1
fi
for framework in QtCore QtGui QtWidgets; do
  if [ ! -d "$QT/$framework.framework" ]; then
    echo "Qt framework not found: $QT/$framework.framework" >&2
    exit 1
  fi
done

BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cavalry-quick-add-display.XXXXXX")"
trap 'rm -rf "$BUILD_DIR"' EXIT

build_fixture() {
  local binary="$1"
  shift
  local -a defines=()
  if [ "$#" -gt 0 ]; then
    defines=("$@")
  fi

  "$MOC" -nw \
    ${defines[@]+"${defines[@]}"} \
    -I"$ROOT" \
    -I"$QT" \
    -I"$QT/QtCore.framework/Headers" \
    -I"$QT/QtGui.framework/Headers" \
    -I"$QT/QtWidgets.framework/Headers" \
    "$SOURCE" \
    -o "$BUILD_DIR/check_quick_add_display.moc"

  clang++ -std=c++17 -O2 -Wall -Wextra -Werror -fno-omit-frame-pointer \
    -DQT_NO_VERSION_TAGGING -DQT_CORE_LIB -DQT_GUI_LIB -DQT_WIDGETS_LIB \
    ${defines[@]+"${defines[@]}"} \
    "$SOURCE" \
    -I"$ROOT" \
    -I"$QT" \
    -I"$QT/QtCore.framework/Headers" \
    -I"$QT/QtGui.framework/Headers" \
    -I"$QT/QtWidgets.framework/Headers" \
    -iquote "$BUILD_DIR" \
    -F"$QT" \
    -Wl,-rpath,"$QT" \
    -framework QtCore -framework QtGui -framework QtWidgets \
    -o "$BUILD_DIR/$binary"
}

run_fixture() {
  DYLD_FRAMEWORK_PATH="$QT" \
  QT_QPA_PLATFORM=offscreen \
  QT_QPA_PLATFORM_PLUGIN_PATH="$QT_PREFIX/plugins/platforms" \
    "$BUILD_DIR/$1"
}

build_fixture check_quick_add_display
run_fixture check_quick_add_display

build_fixture \
  check_quick_add_display_bad_size \
  -DCAVALRY_QUICK_ADD_DISPLAY_BAD_SIZE
run_fixture check_quick_add_display_bad_size

build_fixture \
  check_quick_add_display_bad_align \
  -DCAVALRY_QUICK_ADD_DISPLAY_BAD_ALIGN
run_fixture check_quick_add_display_bad_align

printf 'GREEN: Quick Add display shadow fixture passed (Qt 6.6.3, vendor-free)\n'
