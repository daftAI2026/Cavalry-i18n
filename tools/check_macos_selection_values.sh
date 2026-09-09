#!/usr/bin/env bash
# [INPUT]: 依赖显式 Qt 6.6.3 SDK、只读 vendor Frameworks/libskia.dylib、全部生产 ABI 适配器编译单元与生产注入器原生 fixture
# [OUTPUT]: 编译并运行隔离的 macOS Qt 选择值回归程序，返回真实测试退出码
# [POS]: tools 的本地原生测试入口；不启动/改写 Cavalry，强制 fixture 和 offscreen plugin 共用 SDK 的单套 Qt
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <qt-prefix> <vendor-frameworks>" >&2
  exit 2
fi
QT_PREFIX="$(cd "$1" && pwd)"
VENDOR="$(cd "$2" && pwd)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test "$("$QT_PREFIX/bin/qmake" -query QT_VERSION)" = "6.6.3"
test -f "$VENDOR/libskia.dylib"
OUT="$(mktemp -d "${TMPDIR:-/tmp}/cavalry-selection-test.XXXXXX")"
trap 'rm -f "$OUT/selection-test"; rmdir "$OUT"' EXIT
QT="$QT_PREFIX/lib"

clang++ -std=c++17 -O2 -fno-omit-frame-pointer -fobjc-arc -DQT_NO_VERSION_TAGGING \
  "$ROOT/tools/check_macos_selection_values.mm" \
  "$ROOT/injector/cavalry_i18n_macos_tool_help_text_path.cpp" \
  "$ROOT/injector/cavalry_i18n_macos_classic_rank.cpp" \
  "$ROOT/injector/cavalry_i18n_macos_quick_add_placeholder.cpp" \
  "$ROOT/injector/cavalry_i18n_macos_quick_add_category.cpp" \
  "$VENDOR/libskia.dylib" \
  -I"$QT" -I"$QT/QtCore.framework/Versions/A/Headers" -F"$QT" \
  -Wl,-rpath,"$QT" -Wl,-rpath,"$VENDOR" \
  -framework QtCore -framework QtGui -framework QtWidgets \
  -framework Foundation -framework AppKit -o "$OUT/selection-test"

# vendor Qt 未导出 offscreen plugin 所需 accessibility ABI；测试不混用它与 SDK plugin。
DYLD_FRAMEWORK_PATH="$QT" \
QT_QPA_PLATFORM=offscreen \
QT_QPA_PLATFORM_PLUGIN_PATH="$QT_PREFIX/plugins/platforms" \
  "$OUT/selection-test"
