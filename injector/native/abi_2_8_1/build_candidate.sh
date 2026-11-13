#!/usr/bin/env bash
# [INPUT]: 依赖只读2.8.1 Frameworks、Qt 6.9.2头、批准源及Demo/Welcome ABI。
# [OUTPUT]: 失败时报告ABI实值与工具链；通过后编译并核vendor-free、Demo源、ABI及dyld合同。
# [POS]: 显式候选入口；不连接默认npm build，不签名、安装或启动App。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "usage: CAVALRY_QT_PREFIX=<Qt-6.9.2-prefix> $0 <readonly-Cavalry-2.8.1-Contents/Frameworks>" >&2
  exit 2
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "拒绝在非arm64主机生成候选；x86_64 ABI尚无证据。" >&2
  exit 1
fi

FRAMEWORKS_DIR="$(cd "$1" && pwd -P)"
if [[ -z "${CAVALRY_QT_PREFIX:-}" || ! -d "$CAVALRY_QT_PREFIX" ]]; then
  echo "显式提供Qt 6.9.2公开头前缀: CAVALRY_QT_PREFIX=<Qt-6.9.2-prefix>" >&2
  exit 1
fi
QT_PREFIX="$(cd "$CAVALRY_QT_PREFIX" && pwd -P)"
QT_HEADERS="$QT_PREFIX/include"
if [[ "$FRAMEWORKS_DIR" != */Contents/Frameworks ]]; then
  echo "输入必须是所选App的Contents/Frameworks目录。" >&2
  exit 1
fi
for header in QtCore/qglobal.h QtCore/qconfig.h QtCore/qregularexpression.h QtCore/qstring.h \
              QtGui/qfontmetrics.h QtGui/qaction.h QtWidgets/qwidget.h \
              QtWidgets/qlabel.h QtWidgets/qlayout.h \
              QtWidgets/qtextedit.h; do
  if [[ ! -f "$QT_HEADERS/$header" ]]; then
    echo "缺少显式Qt 6.9.2公开头: $QT_HEADERS/$header" >&2
    exit 1
  fi
done
QT_CONFIG="$QT_HEADERS/QtCore/qconfig.h"
for version in 'QT_VERSION_MAJOR 6' 'QT_VERSION_MINOR 9' 'QT_VERSION_PATCH 2'; do
  if ! grep -Eq "^[[:space:]]*#[[:space:]]*define[[:space:]]+$version$" "$QT_CONFIG"; then
    echo "Qt公开头版本必须是6.9.2: $QT_CONFIG" >&2
    exit 1
  fi
done
for image in libCore.dylib libExtensionLayer.dylib libskia.dylib libApi.dylib; do
  if [[ ! -f "$FRAMEWORKS_DIR/$image" ]]; then
    echo "缺少ABI输入: $FRAMEWORKS_DIR/$image" >&2
    exit 1
  fi
done
SPDLOG="$FRAMEWORKS_DIR/libspdlog.1.15.dylib"
EXTENSION="$FRAMEWORKS_DIR/libExtensionLayer.dylib"
if [[ ! -f "$SPDLOG" ]]; then
  echo "缺少Welcome生产者ABI输入: $SPDLOG" >&2
  exit 1
fi
EXPECTED_EXTENSION_UUID="AF1367BD-2D7E-3EC0-A111-935E4881C655"
EXPECTED_CORE_UUID="FEFE5F95-740D-374F-9413-2AF1173AD9E0"
EXPECTED_SPDLOG_UUID="43FC7DAB-6695-3EF6-B50B-B8189E170B09"
LOG_IT_SYMBOL="__ZN6spdlog6logger7log_it_ERKNS_7details7log_msgEbb"
TEXT_FROM_FILE_SYMBOL="__ZN7cavalry12textFromFileERKNSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE"
EXTENSION_UUID="$(xcrun dwarfdump --uuid "$EXTENSION" | awk '$3 == "(arm64)" {print $2; exit}')"
CORE_UUID="$(xcrun dwarfdump --uuid "$FRAMEWORKS_DIR/libCore.dylib" | awk '$3 == "(arm64)" {print $2; exit}')"
SPDLOG_UUID="$(xcrun dwarfdump --uuid "$SPDLOG" | awk '$3 == "(arm64)" {print $2; exit}')"
LOG_IT_OFFSET="$(nm -arch arm64 -gU "$SPDLOG" | awk -v symbol="$LOG_IT_SYMBOL" '$NF == symbol {print $1}')"
EXTENSION_IMPORT="$(dyld_info -arch arm64 -imports "$EXTENSION" | grep -F "$LOG_IT_SYMBOL" || true)"
EXTENSION_FIXUP="$(dyld_info -arch arm64 -fixups "$EXTENSION" | grep -F "$LOG_IT_SYMBOL" || true)"
TEXT_FROM_FILE_OFFSET="$(nm -arch arm64 -gU "$FRAMEWORKS_DIR/libCore.dylib" | awk -v symbol="$TEXT_FROM_FILE_SYMBOL" '$NF == symbol {print $1}')"
TEXT_FROM_FILE_IMPORT="$(dyld_info -arch arm64 -imports "$EXTENSION" | grep -F "$TEXT_FROM_FILE_SYMBOL" || true)"
TEXT_FROM_FILE_FIXUP="$(dyld_info -arch arm64 -fixups "$EXTENSION" | grep -F "$TEXT_FROM_FILE_SYMBOL" || true)"

report_abi_gate_diagnostics() {
  local dwarfdump_path
  local nm_path
  local dyld_info_path
  dwarfdump_path="$(xcrun --find dwarfdump 2>/dev/null || true)"
  nm_path="$(command -v nm 2>/dev/null || true)"
  dyld_info_path="$(command -v dyld_info 2>/dev/null || true)"

  printf 'ABI gate diagnostics (guard predicates unchanged):\n' >&2
  printf '  extension.uuid expected=%s actual=%q\n' "$EXPECTED_EXTENSION_UUID" "$EXTENSION_UUID" >&2
  printf '  core.uuid expected=%s actual=%q\n' "$EXPECTED_CORE_UUID" "$CORE_UUID" >&2
  printf '  spdlog.uuid expected=%s actual=%q\n' "$EXPECTED_SPDLOG_UUID" "$SPDLOG_UUID" >&2
  printf '  spdlog.log_it.offset expected=0000000000006f10 actual=%q\n' "$LOG_IT_OFFSET" >&2
  printf '  extension.log_it.import expected=%s actual=%q\n' 'contains (from libspdlog.1.15)' "${EXTENSION_IMPORT:-<empty>}" >&2
  printf '  extension.log_it.fixup expected=%q actual=%q\n' "libspdlog.1.15/$LOG_IT_SYMBOL" "${EXTENSION_FIXUP:-<empty>}" >&2
  printf '  core.text_from_file.offset expected=00000000004b175c actual=%q\n' "$TEXT_FROM_FILE_OFFSET" >&2
  printf '  extension.text_from_file.import expected=%s actual=%q\n' 'contains (from libCore)' "${TEXT_FROM_FILE_IMPORT:-<empty>}" >&2
  printf '  extension.text_from_file.fixup expected=%q actual=%q\n' "libCore/$TEXT_FROM_FILE_SYMBOL" "${TEXT_FROM_FILE_FIXUP:-<empty>}" >&2

  printf '  tool.xcrun.path=%s\n' "$(command -v xcrun 2>/dev/null || printf '<not-found>')" >&2
  printf '  tool.dwarfdump.path=%s\n' "${dwarfdump_path:-<not-found>}" >&2
  printf '  tool.nm.path=%s\n' "${nm_path:-<not-found>}" >&2
  printf '  tool.dyld_info.path=%s\n' "${dyld_info_path:-<not-found>}" >&2
  printf '  toolchain.developer_dir:\n' >&2
  xcode-select -p >&2 || true
  printf '  toolchain.xcodebuild_version:\n' >&2
  xcodebuild -version >&2 || true
  printf '  toolchain.macos_sdk_version:\n' >&2
  xcrun --sdk macosx --show-sdk-version >&2 || true
  printf '  tool.dwarfdump.version:\n' >&2
  xcrun dwarfdump --version >&2 || true
  printf '  tool.nm.version:\n' >&2
  nm --version >&2 || true
  printf '  tool.dyld_info.build_identity:\n' >&2
  if [[ -n "$dyld_info_path" ]]; then
    what "$dyld_info_path" >&2 || true
  else
    printf '    <unavailable: path not found>\n' >&2
  fi
}

if [[ "$EXTENSION_UUID" != "$EXPECTED_EXTENSION_UUID" ||
      "$CORE_UUID" != "$EXPECTED_CORE_UUID" ||
      "$SPDLOG_UUID" != "$EXPECTED_SPDLOG_UUID" ||
      "$LOG_IT_OFFSET" != "0000000000006f10" ||
      "$EXTENSION_IMPORT" != *"(from libspdlog.1.15)"* ||
      "$EXTENSION_FIXUP" != *"libspdlog.1.15/$LOG_IT_SYMBOL"* ||
      "$TEXT_FROM_FILE_OFFSET" != "00000000004b175c" ||
      "$TEXT_FROM_FILE_IMPORT" != *"(from libCore)"* ||
      "$TEXT_FROM_FILE_FIXUP" != *"libCore/$TEXT_FROM_FILE_SYMBOL"* ]]; then
  echo "拒绝：Demo/Welcome Core、Extension、导出或two-level导入合同偏离。" >&2
  report_abi_gate_diagnostics
  exit 1
fi
if [[ ! -f "$FRAMEWORKS_DIR/QtCore.framework/Versions/A/QtCore" ]]; then
  echo "缺少目标bundle的QtCore 6.9.2映像: $FRAMEWORKS_DIR/QtCore.framework/Versions/A/QtCore" >&2
  exit 1
fi
for framework in QtGui QtWidgets; do
  if [[ ! -f "$FRAMEWORKS_DIR/$framework.framework/Versions/A/$framework" ]]; then
    echo "缺少目标bundle的Qt6.9.2映像: $FRAMEWORKS_DIR/$framework.framework/Versions/A/$framework" >&2
    exit 1
  fi
done
if [[ ! -f "$FRAMEWORKS_DIR/platforms/libqcocoa.dylib" ]]; then
  echo "隐藏布局fixture需要所选bundle的Cocoa QPA插件。" >&2
  exit 1
fi
if [[ ! -f "$FRAMEWORKS_DIR/libfmt.11.dylib" ]]; then
  echo "缺少标题格式化ABI输入: $FRAMEWORKS_DIR/libfmt.11.dylib" >&2
  exit 1
fi
if [[ ! -f "$FRAMEWORKS_DIR/libCavalryUI.dylib" ]]; then
  echo "缺少帮助注册ABI输入: $FRAMEWORKS_DIR/libCavalryUI.dylib" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
NATIVE_DIR="$REPO_ROOT/injector/native"
OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cavalry-native-candidate.XXXXXX")"
DYLIB="$OUT_DIR/libCavalryNativeFontCandidate.dylib"
TEST_BIN="$OUT_DIR/native_font_contract_test"
FAST_TEST_BIN="$OUT_DIR/fast_search_unicode_contract_test"
ABI_PROBE="$OUT_DIR/title-format-fmt11-abi.s"
HELP_TABLE="$OUT_DIR/help-description-table.inc"
HELP_TEST_BIN="$OUT_DIR/help_description_contract_test"
HELP_ABI_TEST_BIN="$OUT_DIR/help_description_veneer_contract_test"
HELP_LAYOUT_TABLE="$OUT_DIR/help-description-table.inc.layout.inc"
HELP_LAYOUT_TEST_BIN="$OUT_DIR/help_popup_layout_contract_test"
GUIDE_BODY_TEST_BIN="$OUT_DIR/guide_body_contract_test"
EASING_TABLE="$OUT_DIR/easing-display-table.inc"
EASING_TEST_BIN="$OUT_DIR/easing_menu_contract_test"
WELCOME_TEST_BIN="$OUT_DIR/welcome_log_it_contract_test"
WELCOME_VENEER_TEST_BIN="$OUT_DIR/welcome_log_it_veneer_contract_test"
SAVE_CAPTION_TEST_BIN="$OUT_DIR/save_scene_caption_contract_test"
DEMO_TEXT_TABLE="$OUT_DIR/demo-reader-texts.inc"
DEMO_FILES_TABLE="$OUT_DIR/demo-reader-files.inc"
DEMO_TEST_BIN="$OUT_DIR/demo_reader_contract_test"

echo "OUT_DIR: $OUT_DIR"
echo "INPUT_FRAMEWORKS: $FRAMEWORKS_DIR"
echo "QT_PUBLIC_HEADERS: $QT_HEADERS"
node "$REPO_ROOT/tools/build_native_help_description_table.js" \
  --metadata-dir "$(cd "$FRAMEWORKS_DIR/../assets/MetaData" && pwd -P)" \
  --cavalry-version 2.8.1 \
  --out "$HELP_TABLE" >"$OUT_DIR/help-description-table-command.log"
node "$REPO_ROOT/tools/build_native_easing_display_table.js" \
  --out "$EASING_TABLE" >"$OUT_DIR/easing-display-table-command.log"
node "$REPO_ROOT/tools/generate_demo_reader_tables.js" \
  --source "$REPO_ROOT/languages/native/official_demo_scripts.js" \
  --presets-root "$(cd "$(dirname "$FRAMEWORKS_DIR")/assets/Presets" && pwd -P)" \
  --texts-out "$DEMO_TEXT_TABLE" --files-out "$DEMO_FILES_TABLE" \
  >"$OUT_DIR/demo-reader-table-command.log"

{
  xcrun --sdk macosx clang++ \
    -std=c++17 -arch arm64 -O1 -Wall -Wextra -Werror \
    -Wno-frame-address -fno-omit-frame-pointer -fno-optimize-sibling-calls \
    -dynamiclib -undefined dynamic_lookup -Wl,-twolevel_namespace \
    -Wl,-install_name,@rpath/libCavalryNativeFontCandidate.dylib \
    -Wl,-headerpad_max_install_names \
    -Wl,-rpath,@loader_path \
    -Wl,-rpath,@executable_path/../Frameworks \
    -I "$NATIVE_DIR" -I "$REPO_ROOT/injector" \
    -I "$QT_HEADERS" -I "$QT_HEADERS/QtCore" \
    -I "$QT_HEADERS/QtGui" -I "$QT_HEADERS/QtWidgets" \
    "-DNATIVE_HELP_DESCRIPTION_TABLE=\"$HELP_TABLE\"" \
    "-DNATIVE_HELP_LAYOUT_ROWS=\"$HELP_LAYOUT_TABLE\"" \
    "-DNATIVE_EASING_DISPLAY_TABLE=\"$EASING_TABLE\"" \
    "-DNATIVE_DEMO_READER_TEXTS_TABLE=\"$DEMO_TEXT_TABLE\"" \
    "-DNATIVE_DEMO_READER_FILES_TABLE=\"$DEMO_FILES_TABLE\"" \
    "$NATIVE_DIR/native_font_candidate.mm" \
    "$NATIVE_DIR/help_popup_layout_adapter.mm" \
    "$NATIVE_DIR/fast_search_unicode_adapter.mm" \
    "$NATIVE_DIR/timeline_owner_observer_arm64.S" \
    "$NATIVE_DIR/viewport_blob_veneer.S" \
    "$NATIVE_DIR/help_description_veneer.S" \
    "$NATIVE_DIR/welcome_log_it_veneer.S" \
    "$NATIVE_DIR/getpath_font_veneer.S" \
    -L "$FRAMEWORKS_DIR" -lskia "$FRAMEWORKS_DIR/libApi.dylib" \
    "$FRAMEWORKS_DIR/libCore.dylib" \
    "$FRAMEWORKS_DIR/libfmt.11.dylib" \
    "$FRAMEWORKS_DIR/libCavalryUI.dylib" \
    -lspdlog.1.15 \
    -F "$FRAMEWORKS_DIR" -framework QtCore -framework QtGui -framework QtWidgets \
    -framework CoreText -framework Foundation \
    -o "$DYLIB"
} >"$OUT_DIR/compile.log" 2>&1 || {
  cat "$OUT_DIR/compile.log" >&2
  exit 1
}

# --- QtCore动态依赖 ---------------------------------------------------------
# QtCore从候选所在目录或主程序目录的Frameworks解析。
install_name_tool -change @rpath/QtCore \
  @rpath/QtCore.framework/Versions/A/QtCore "$DYLIB"
install_name_tool -change @rpath/QtGui \
  @rpath/QtGui.framework/Versions/A/QtGui \
  -change @rpath/QtWidgets \
  @rpath/QtWidgets.framework/Versions/A/QtWidgets "$DYLIB"

xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -Wall -Wextra -Werror \
  -I "$NATIVE_DIR" -I "$REPO_ROOT/injector" \
  "$NATIVE_DIR/candidate_contract_test.cpp" -o "$TEST_BIN"
"$TEST_BIN"
echo "PASS: compiled and ran native getter/unknown-owner contract test"
xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -Wall -Wextra -Werror \
  -I "$NATIVE_DIR" "$NATIVE_DIR/dependency_node_font_contract_test.cpp" \
  -o "$OUT_DIR/dependency_node_font_contract_test"
"$OUT_DIR/dependency_node_font_contract_test"
echo "PASS: Dependency NodeView exact Measure/fill/stroke receiver frame contract"
xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -Wall -Wextra -Werror \
  -I "$NATIVE_DIR" "$NATIVE_DIR/guide_body_contract_test.cpp" \
  -o "$GUIDE_BODY_TEST_BIN"
"$GUIDE_BODY_TEST_BIN"
echo "PASS: Guide body caller/source/locale and single-forwarding contract test"
xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -Wall -Wextra -Werror \
  -I "$NATIVE_DIR" "$NATIVE_DIR/easing_menu_contract_test.cpp" \
  -o "$EASING_TEST_BIN"
"$EASING_TEST_BIN"
echo "PASS: Easing exact caller/source/locale and single-forwarding contract test"
xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -O1 -Wall -Wextra -Werror \
  -include arm_acle.h -I "$NATIVE_DIR" -I "$QT_HEADERS" \
  -I "$QT_HEADERS/QtCore" -I "$QT_HEADERS/QtGui" -I "$QT_HEADERS/QtWidgets" \
  -F "$FRAMEWORKS_DIR" -framework QtCore \
  -Wl,-rpath,"$FRAMEWORKS_DIR/QtCore.framework/Versions/A" \
  "$NATIVE_DIR/save_scene_caption_contract_test.cpp" \
  -o "$SAVE_CAPTION_TEST_BIN"
"$SAVE_CAPTION_TEST_BIN"
echo "PASS: Save Scene QString return/ref/lifetime and exact caller/source ABI contract"
xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -Wall -Wextra -Werror \
  -I "$NATIVE_DIR" "$NATIVE_DIR/demo_reader_contract_test.cpp" \
  -o "$DEMO_TEST_BIN"
"$DEMO_TEST_BIN"
echo "PASS: Demo optional<string> ABI, source hash, owner, and single-forwarding contract"
xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -Wall -Wextra -Werror \
  -I "$NATIVE_DIR" "$NATIVE_DIR/welcome_log_it_contract_test.cpp" \
  -o "$WELCOME_TEST_BIN"
"$WELCOME_TEST_BIN"
xcrun --sdk macosx clang++ -std=c++17 -O0 -g -arch arm64 \
  -mmacosx-version-min=12.0 \
  "$NATIVE_DIR/welcome_log_it_veneer_contract_test.cpp" \
  "$NATIVE_DIR/welcome_log_it_veneer_probe.S" \
  "$NATIVE_DIR/welcome_log_it_veneer.S" -o "$WELCOME_VENEER_TEST_BIN"
"$WELCOME_VENEER_TEST_BIN"
echo "PASS: Welcome exact payload/locale/single-forward and unknown-caller veneer contracts"
bash "$NATIVE_DIR/welcome_dyld_fixture.sh" green \
  "$NATIVE_DIR/welcome_log_it_veneer.S" \
  "$OUT_DIR/welcome-dyld-fixture-green"
echo "PASS: dyld early-constructor original-import call-through fixture"
xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -Wall -Wextra -Werror \
  -I "$NATIVE_DIR" \
  "$NATIVE_DIR/fast_search_unicode_contract_test.cpp" -o "$FAST_TEST_BIN"
"$FAST_TEST_BIN"
echo "PASS: Fast C1 options and original-forwarding contract test"
xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -Wall -Wextra -Werror \
  -I "$NATIVE_DIR" -I "$REPO_ROOT/injector" \
  "$NATIVE_DIR/help_description_contract_test.cpp" -o "$HELP_TEST_BIN"
"$HELP_TEST_BIN"
xcrun --sdk macosx clang++ -std=c++17 -O0 -g -arch arm64 \
  -mmacosx-version-min=12.0 \
  "$NATIVE_DIR/help_description_veneer_contract_test.cpp" \
  "$NATIVE_DIR/help_description_veneer_probe.S" \
  "$NATIVE_DIR/help_description_veneer.S" -o "$HELP_ABI_TEST_BIN"
"$HELP_ABI_TEST_BIN"

# --- 同bundle Qt隐藏布局fixture --------------------------------------------
xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -O1 -Wall -Wextra -Werror \
  -Wno-unused-function -include arm_acle.h \
  -I "$NATIVE_DIR" -I "$REPO_ROOT/injector" \
  -I "$QT_HEADERS" -I "$QT_HEADERS/QtCore" \
  -I "$QT_HEADERS/QtGui" -I "$QT_HEADERS/QtWidgets" \
  -I "$OUT_DIR" \
  "-DNATIVE_HELP_DESCRIPTION_TABLE=\"$HELP_TABLE\"" \
  "-DNATIVE_HELP_LAYOUT_ROWS=\"$HELP_LAYOUT_TABLE\"" \
  "$NATIVE_DIR/help_popup_layout_contract_test.cpp" \
  -F "$FRAMEWORKS_DIR" -framework QtCore -framework QtGui -framework QtWidgets \
  -Wl,-headerpad_max_install_names -Wl,-rpath,"$FRAMEWORKS_DIR" \
  -o "$HELP_LAYOUT_TEST_BIN"
install_name_tool -change @rpath/QtCore \
  "$FRAMEWORKS_DIR/QtCore.framework/Versions/A/QtCore" \
  -change @rpath/QtGui "$FRAMEWORKS_DIR/QtGui.framework/Versions/A/QtGui" \
  -change @rpath/QtWidgets "$FRAMEWORKS_DIR/QtWidgets.framework/Versions/A/QtWidgets" \
  "$HELP_LAYOUT_TEST_BIN"
codesign --force --sign - --timestamp=none "$HELP_LAYOUT_TEST_BIN"
codesign --verify --strict "$HELP_LAYOUT_TEST_BIN"
QT_QPA_PLATFORM=cocoa \
QT_QPA_PLATFORM_PLUGIN_PATH="$FRAMEWORKS_DIR/platforms" \
QT_PLUGIN_PATH="$FRAMEWORKS_DIR" \
DYLD_FRAMEWORK_PATH="$FRAMEWORKS_DIR" \
  "$HELP_LAYOUT_TEST_BIN" >"$OUT_DIR/help-popup-layout-test.log" 2>&1 || {
    cat "$OUT_DIR/help-popup-layout-test.log" >&2
    exit 1
  }
cat "$OUT_DIR/help-popup-layout-test.log"

xcrun --sdk macosx clang++ -std=c++17 -arch arm64 -O0 \
  -fno-optimize-sibling-calls -DNATIVE_TITLE_FORMAT_ABI_PROBE_ONLY \
  -I "$NATIVE_DIR" -I "$REPO_ROOT/injector" \
  -S "$NATIVE_DIR/candidate_contract_test.cpp" -o "$ABI_PROBE"
echo "ABI_PROBE: $ABI_PROBE"

PYTHONDONTWRITEBYTECODE=1 python3 "$NATIVE_DIR/candidate_static_contract_test.py" \
  "$REPO_ROOT" "$FRAMEWORKS_DIR" "$DYLIB"
python3 "$NATIVE_DIR/check_candidate_contract.py" \
  "$REPO_ROOT" "$OUT_DIR" "$FRAMEWORKS_DIR" "$DYLIB"
python3 "$NATIVE_DIR/check_help_description_contract.py" \
  "$REPO_ROOT" "$OUT_DIR" "$FRAMEWORKS_DIR" "$DYLIB"
python3 "$NATIVE_DIR/check_help_popup_layout_contract.py" \
  "$REPO_ROOT" "$OUT_DIR" "$FRAMEWORKS_DIR" "$DYLIB"
python3 "$NATIVE_DIR/check_dependency_node_font_contract.py" \
  --app "$(cd "$FRAMEWORKS_DIR/../.." && pwd -P)"
printf 'PASS: arm64 combined candidate build; not loaded, installed, or consumed by product\n' \
  >"$OUT_DIR/candidate-build-summary.txt"
echo "ARTIFACT: $DYLIB"
echo "SUMMARY: $OUT_DIR/candidate-build-summary.txt"
