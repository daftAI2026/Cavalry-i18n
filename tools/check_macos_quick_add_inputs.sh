#!/usr/bin/env bash
# [INPUT]: 依赖显式 Qt 6.6.3 SDK、只读 vendor Frameworks/libskia.dylib 与生产 macOS injector 源码
# [OUTPUT]: 编译并运行绿色 Quick Add 搜索输入合同，并在隔离临时副本移除两个 search guard 后验证红色回归
# [POS]: tools 的 macOS 原生搜索输入测试入口；moc fixture 使用精确 Cavalry owner 名称，不启动/改写 Cavalry 或 vendor Frameworks
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <qt-prefix> <vendor-frameworks>" >&2
  exit 2
fi

QT_PREFIX="$(cd "$1" && pwd)"
VENDOR="$(cd "$2" && pwd)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QT="$QT_PREFIX/lib"
QMAKE="$QT_PREFIX/bin/qmake"
MOC="$QT_PREFIX/libexec/moc"
SOURCE="$ROOT/tools/check_macos_quick_add_inputs.mm"

if [ ! -x "$QMAKE" ]; then
  echo "Qt qmake not found: $QMAKE" >&2
  exit 1
fi
if [ "$("$QMAKE" -query QT_VERSION)" != "6.6.3" ]; then
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
if [ ! -f "$VENDOR/libskia.dylib" ]; then
  echo "vendor libskia.dylib not found: $VENDOR/libskia.dylib" >&2
  exit 1
fi

BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cavalry-macos-quick-add-inputs.XXXXXX")"
trap 'rm -rf "$BUILD_DIR"' EXIT

"$MOC" \
  -I"$QT" \
  -I"$QT/QtCore.framework/Headers" \
  -I"$QT/QtGui.framework/Headers" \
  -I"$QT/QtWidgets.framework/Headers" \
  "$SOURCE" \
  -o "$BUILD_DIR/check_macos_quick_add_inputs.moc"

compile_fixture() {
  local source="$1"
  local output="$2"
  clang++ -std=c++17 -O2 -fno-omit-frame-pointer -fobjc-arc -DQT_NO_VERSION_TAGGING \
    "$source" \
    "$ROOT/injector/cavalry_i18n_macos_tool_help_text_path.cpp" \
    "$ROOT/injector/cavalry_i18n_macos_classic_rank.cpp" \
    "$VENDOR/libskia.dylib" \
    -I"$ROOT" -I"$ROOT/injector" -I"$BUILD_DIR" \
    -I"$QT" -I"$QT/QtCore.framework/Headers" \
    -I"$QT/QtGui.framework/Headers" -I"$QT/QtWidgets.framework/Headers" \
    -F"$QT" \
    -Wl,-rpath,"$QT" -Wl,-rpath,"$VENDOR" \
    -framework QtCore -framework QtGui -framework QtWidgets \
    -framework Foundation -framework AppKit \
    -o "$output"
}

GREEN="$BUILD_DIR/check_macos_quick_add_inputs"
compile_fixture "$SOURCE" "$GREEN"
DYLD_FRAMEWORK_PATH="$QT" \
QT_QPA_PLATFORM=offscreen \
QT_QPA_PLATFORM_PLUGIN_PATH="$QT_PREFIX/plugins/platforms" \
  "$GREEN"
printf 'GREEN: production search guards preserved all Quick Add queries\n'

# ---- 红测：只改临时生产副本，证明删除 guard 会被 fixture 拦截 ----------------
RED_ROOT="$BUILD_DIR/red-source"
mkdir -p "$RED_ROOT/tools" "$RED_ROOT/injector"
cp "$SOURCE" "$RED_ROOT/tools/check_macos_quick_add_inputs.mm"
cp "$ROOT/injector/CavalryTranslatorInjector.mm" \
  "$RED_ROOT/injector/CavalryTranslatorInjector.mm"
RED_SOURCE="$RED_ROOT/injector/CavalryTranslatorInjector.mm"
perl -0pi -e 's/ &&\n\s*!cavalry_i18n::preservesCompleterInputValue\(lineEdit\)//' "$RED_SOURCE"
perl -0pi -e 's/ \|\|\n\s*cavalry_i18n::preservesCompleterInputValue\(guardedLineEdit\.data\(\)\)//' "$RED_SOURCE"
if grep -Fq 'preservesCompleterInputValue(lineEdit)' "$RED_SOURCE" || \
   grep -Fq 'preservesCompleterInputValue(guardedLineEdit.data())' "$RED_SOURCE"; then
  echo "failed to remove search guards from temporary red source" >&2
  exit 1
fi

RED="$BUILD_DIR/check_macos_quick_add_inputs.red"
compile_fixture "$RED_ROOT/tools/check_macos_quick_add_inputs.mm" "$RED"
set +e
DYLD_FRAMEWORK_PATH="$QT" \
QT_QPA_PLATFORM=offscreen \
QT_QPA_PLATFORM_PLUGIN_PATH="$QT_PREFIX/plugins/platforms" \
  "$RED"
RED_STATUS=$?
set -e
if [ "$RED_STATUS" -eq 0 ]; then
  echo "RED: removing temporary search guards unexpectedly passed" >&2
  exit 1
fi
printf 'RED: expected failure after temporary search-guard removal (status=%d)\n' "$RED_STATUS"
