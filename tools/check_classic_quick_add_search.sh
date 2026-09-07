#!/usr/bin/env bash
# [INPUT]: 依赖 CAVALRY_QT_PREFIX 或仓库 qt_sdk/6.6.3/macos、其 qmake/moc 与 tools/check_classic_quick_add_search.cpp、injector/cavalry_i18n_classic_search.h、injector/cavalry_i18n_quick_add_context.h
# [OUTPUT]: 在隔离临时目录生成并运行 vendor-free Classic Quick Add QListWidget 合同，不启动或修改真实 Cavalry.app
# [POS]: tools 的 Classic 搜索 fixture runner；以 Qt 6.6.3 moc/clang++ 验证 header-only helper 的 U+FFFE role0 投影、显示层、native filter、同 locale 排序与生命周期边界，不构成 vendor command/custom MIME 证据
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QT_PREFIX="${CAVALRY_QT_PREFIX:-$REPO_ROOT/qt_sdk/6.6.3/macos}"
QT_QMAKE="$QT_PREFIX/bin/qmake"
QT_MOC="$QT_PREFIX/libexec/moc"
QT_FRAMEWORKS="$QT_PREFIX/lib"
SOURCE="$REPO_ROOT/tools/check_classic_quick_add_search.cpp"

if [[ ! -x "$QT_QMAKE" ]]; then
  echo "Qt qmake not found: $QT_QMAKE (set CAVALRY_QT_PREFIX to a Qt 6.6.3 SDK)" >&2
  exit 1
fi
QT_VERSION="$($QT_QMAKE -query QT_VERSION)"
if [[ "$QT_VERSION" != "6.6.3" ]]; then
  echo "Qt 6.6.3 required, found: $QT_VERSION ($QT_PREFIX)" >&2
  exit 1
fi
if [[ ! -x "$QT_MOC" ]]; then
  echo "Qt 6.6.3 moc not found: $QT_MOC" >&2
  exit 1
fi
for framework in QtCore QtGui QtWidgets; do
  if [[ ! -d "$QT_FRAMEWORKS/$framework.framework" ]]; then
    echo "Qt framework not found: $QT_FRAMEWORKS/$framework.framework" >&2
    exit 1
  fi
done

BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cavalry-i18n-classic-search.XXXXXX")"
cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

"$QT_MOC" \
  -I"$QT_FRAMEWORKS" \
  -I"$QT_FRAMEWORKS/QtCore.framework/Headers" \
  -I"$QT_FRAMEWORKS/QtGui.framework/Headers" \
  -I"$QT_FRAMEWORKS/QtWidgets.framework/Headers" \
  "$SOURCE" \
  -o "$BUILD_DIR/check_classic_quick_add_search.moc"

clang++ \
  -std=c++17 \
  -O2 \
  -Wall \
  -Wextra \
  -Werror \
  -DQT_NO_VERSION_TAGGING \
  -DQT_CORE_LIB \
  -DQT_GUI_LIB \
  -DQT_WIDGETS_LIB \
  "$SOURCE" \
  -I"$REPO_ROOT/injector" \
  -I"$REPO_ROOT" \
  -I"$BUILD_DIR" \
  -I"$QT_FRAMEWORKS" \
  -I"$QT_FRAMEWORKS/QtCore.framework/Headers" \
  -I"$QT_FRAMEWORKS/QtGui.framework/Headers" \
  -I"$QT_FRAMEWORKS/QtWidgets.framework/Headers" \
  -F"$QT_FRAMEWORKS" \
  -Wl,-rpath,"$QT_FRAMEWORKS" \
  -framework QtCore \
  -framework QtGui \
  -framework QtWidgets \
  -o "$BUILD_DIR/check_classic_quick_add_search"

QT_QPA_PLATFORM=offscreen "$BUILD_DIR/check_classic_quick_add_search"
