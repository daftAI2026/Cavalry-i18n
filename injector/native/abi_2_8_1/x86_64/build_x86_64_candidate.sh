#!/usr/bin/env bash
# [INPUT]: 依赖Cavalry 2.8.1 Intel ABI profile、同bundle fmt11/spdlog1.15和Qt6.9.2公开头。
# [OUTPUT]: 核x86身份与owner合同，链接同bundle Core并生成隔离native dylib；失败时回显Popup runner原文。
# [POS]: Intel native编译入口；不构建Tauri，不启动或部署Cavalry。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1

if [[ "$#" -ne 2 ]]; then
  echo "usage: CAVALRY_QT_PREFIX=<Qt-6.9.2-prefix> $0 <readonly-Cavalry-2.8-Contents/Frameworks> <new-output-dir>" >&2
  exit 2
fi

FRAMEWORKS_DIR="$(cd "$1" && pwd -P)"
OUT_DIR="$2"
if [[ -e "$OUT_DIR" ]]; then
  echo "输出目录必须是新目录: $OUT_DIR" >&2
  exit 2
fi
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd -P)"
if [[ "$FRAMEWORKS_DIR" != */Contents/Frameworks ]]; then
  echo "输入必须是官方App的Contents/Frameworks目录。" >&2
  exit 1
fi
if [[ -z "${CAVALRY_QT_PREFIX:-}" || ! -d "$CAVALRY_QT_PREFIX" ]]; then
  echo "显式提供Qt 6.9.2公开头前缀: CAVALRY_QT_PREFIX=<Qt-6.9.2-prefix>" >&2
  exit 1
fi
QT_PREFIX="$(cd "$CAVALRY_QT_PREFIX" && pwd -P)"
QT_HEADERS="$QT_PREFIX/include"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
NATIVE_DIR="$REPO_ROOT/injector/native"
SOURCE_MANIFEST="$OUT_DIR/native-source-manifest.json"
python3 "$NATIVE_DIR/native_source_manifest_x86_64.py" \
  "$REPO_ROOT" "$SOURCE_MANIFEST"

python3 "$NATIVE_DIR/check_dependency_node_font_abi.py" "$FRAMEWORKS_DIR" "$OUT_DIR/dependency-node-abi.json"

python3 "$NATIVE_DIR/check_locale_popup_contract.py" "$FRAMEWORKS_DIR" >"$OUT_DIR/locale-popup-abi-contract.log"

# -- 锁定五个官方链接输入的x86_64 slice ------------------------------
for image in libApi.dylib libfmt.11.dylib libCavalryUI.dylib \
             libspdlog.1.15.dylib platforms/libqcocoa.dylib \
             libCore.dylib libExtensionLayer.dylib libskia.dylib; do
  path="$FRAMEWORKS_DIR/$image"
  if [[ ! -f "$path" ]]; then
    echo "缺少官方2.8 x86_64 ABI输入: $path" >&2
    exit 1
  fi
  arches="$(xcrun lipo -archs "$path")"
  if [[ " $arches " != *" x86_64 "* ]]; then
    echo "官方ABI输入缺少x86_64 slice: $path ($arches)" >&2
    exit 1
  fi
done

# -- 锁定x86_64 Welcome链接身份；不推断调用者ABI ------------------------
EXTENSION="$FRAMEWORKS_DIR/libExtensionLayer.dylib"
SPDLOG="$FRAMEWORKS_DIR/libspdlog.1.15.dylib"
EXTENSION_UUID="$(xcrun dwarfdump --uuid "$EXTENSION" | awk '$3 == "(x86_64)" {print $2; exit}')"
SPDLOG_UUID="$(xcrun dwarfdump --uuid "$SPDLOG" | awk '$3 == "(x86_64)" {print $2; exit}')"
LOG_IT_SYMBOL="__ZN6spdlog6logger7log_it_ERKNS_7details7log_msgEbb"
LOG_IT_OFFSET="$(nm -arch x86_64 -gU "$SPDLOG" | awk -v symbol="$LOG_IT_SYMBOL" '$NF == symbol {print $1}')"
EXTENSION_IMPORT="$(dyld_info -arch x86_64 -imports "$EXTENSION" | grep -F "$LOG_IT_SYMBOL" || true)"
EXTENSION_FIXUP="$(dyld_info -arch x86_64 -fixups "$EXTENSION" | grep -F "$LOG_IT_SYMBOL" || true)"
if [[ "$EXTENSION_UUID" != "AEAD00DA-F97D-3DD0-9602-D5668F1341A2" ||
      "$SPDLOG_UUID" != "B2A4829C-F4AE-30AE-A15A-DB00BB634B61" ||
      "$LOG_IT_OFFSET" != "00000000000071f0" ||
      "$EXTENSION_IMPORT" != *"(from libspdlog.1.15)"* ||
      "$EXTENSION_FIXUP" != *"libspdlog.1.15/$LOG_IT_SYMBOL"* ]]; then
  echo "拒绝：官方x86_64 Extension/spdlog UUID、导出或导入关系偏离只读采样。" >&2
  exit 1
fi

for header in QtCore/qglobal.h QtCore/qconfig.h QtCore/qregularexpression.h \
              QtCore/qstring.h QtGui/qfontmetrics.h QtGui/qaction.h \
              QtWidgets/qwidget.h QtWidgets/qlabel.h QtWidgets/qlayout.h \
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

node "$REPO_ROOT/tools/build_native_help_description_table.js" \
  --metadata-dir "$(cd "$FRAMEWORKS_DIR/../assets/MetaData" && pwd -P)" \
  --cavalry-version 2.8.1 \
  --out "$OUT_DIR/help-description-table.inc" \
  >"$OUT_DIR/help-description-table-command.log"
node "$REPO_ROOT/tools/build_native_easing_display_table.js" \
  --out "$OUT_DIR/easing-display-table.inc" \
  >"$OUT_DIR/easing-display-table-command.log"
DG_CONTEXT_MENU_TABLE="$OUT_DIR/dg-context-menu-table.inc"
node "$REPO_ROOT/tools/build_native_dg_context_menu_table.js" \
  --assets-dir "$(cd "$FRAMEWORKS_DIR/../assets" && pwd -P)" \
  --out "$DG_CONTEXT_MENU_TABLE" >"$OUT_DIR/dg-context-menu-table-command.log"
DEMO_TEXT_TABLE="$OUT_DIR/demo-reader-texts.inc"
DEMO_FILES_TABLE="$OUT_DIR/demo-reader-files.inc"
node "$REPO_ROOT/tools/generate_demo_reader_tables.js" \
  --source "$REPO_ROOT/languages/native/official_demo_scripts.js" \
  --presets-root "$(cd "$FRAMEWORKS_DIR/../assets/Presets" && pwd -P)" \
  --texts-out "$DEMO_TEXT_TABLE" --files-out "$DEMO_FILES_TABLE" \
  >"$OUT_DIR/demo-reader-table-command.log"

# -- 禁止compile-only早退；该入口编译正常构造器与逐功能ABI门 -----------
for source in native_font_candidate.mm fast_search_unicode_adapter.mm \
              help_popup_layout_adapter.mm; do
  if grep -Fq 'NATIVE_CANDIDATE_X86_COMPILE_ONLY' "$NATIVE_DIR/$source"; then
    echo "拒绝：x86运行时源仍包含compile-only开关: $source" >&2
    exit 1
  fi
done

# -- 先用x86_64目标核对架构UUID表 ---------------------------------------
ARCH_PROFILE_TEST="$OUT_DIR/native_candidate_architecture_contract_test"
ARCH_PROFILE_BUILD=(xcrun --sdk macosx clang++ -std=c++17 -O0 -g -arch x86_64 \
  -mmacosx-version-min=12.0 -Wall -Wextra -Werror \
  "$NATIVE_DIR/native_candidate_architecture_contract_test.cpp" \
  -o "$ARCH_PROFILE_TEST")
printf '$' >"$OUT_DIR/x86-architecture-profile-build.log"
printf ' %q' "${ARCH_PROFILE_BUILD[@]}" >>"$OUT_DIR/x86-architecture-profile-build.log"
printf '\n' >>"$OUT_DIR/x86-architecture-profile-build.log"
set +e
"${ARCH_PROFILE_BUILD[@]}" >>"$OUT_DIR/x86-architecture-profile-build.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-architecture-profile-build.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86_64 architecture profile contract build ($RESULT)" >&2
  exit "$RESULT"
fi
ARCH_PROFILE_RUN=(arch -x86_64 "$ARCH_PROFILE_TEST")
printf '$' >"$OUT_DIR/x86-architecture-profile-run.log"
printf ' %q' "${ARCH_PROFILE_RUN[@]}" >>"$OUT_DIR/x86-architecture-profile-run.log"
printf '\n' >>"$OUT_DIR/x86-architecture-profile-run.log"
set +e
"${ARCH_PROFILE_RUN[@]}" >>"$OUT_DIR/x86-architecture-profile-run.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-architecture-profile-run.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86_64 architecture profile contract run ($RESULT)" >&2
  exit "$RESULT"
fi

# -- 验官方Timeline call window及独立寄存器/return-PC合同 -----------------
TIMELINE_OUT="$OUT_DIR/timeline-owner-contract"
TIMELINE_COMMAND=(python3 "$NATIVE_DIR/check_timeline_owner_observer_x86_64.py" \
  "$FRAMEWORKS_DIR" "$TIMELINE_OUT" \
  "$SOURCE_MANIFEST")
printf '$' >"$OUT_DIR/timeline-owner-contract-runner.log"
printf ' %q' "${TIMELINE_COMMAND[@]}" >>"$OUT_DIR/timeline-owner-contract-runner.log"
printf '\n' >>"$OUT_DIR/timeline-owner-contract-runner.log"
set +e
"${TIMELINE_COMMAND[@]}" >>"$OUT_DIR/timeline-owner-contract-runner.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/timeline-owner-contract-runner.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: official x86_64 Timeline contract ($RESULT)" >&2
  exit "$RESULT"
fi

# -- 核官方x86 Viewport TextBlob与FPS owner窗口 -------------------------
FONT_ABI_OUT="$OUT_DIR/x86-font-abi-contract.json"
FONT_ABI_COMMAND=(python3 "$NATIVE_DIR/check_font_abi_x86_64.py" \
  "$FRAMEWORKS_DIR" "$FONT_ABI_OUT")
printf '$' >"$OUT_DIR/x86-font-abi-contract-runner.log"
printf ' %q' "${FONT_ABI_COMMAND[@]}" >>"$OUT_DIR/x86-font-abi-contract-runner.log"
printf '\n' >>"$OUT_DIR/x86-font-abi-contract-runner.log"
set +e
"${FONT_ABI_COMMAND[@]}" >>"$OUT_DIR/x86-font-abi-contract-runner.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-font-abi-contract-runner.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: official x86_64 Viewport/FPS ABI contract ($RESULT)" >&2
  exit "$RESULT"
fi

# -- 核缓存GetPath两帧与固定ToolHelp/质量生产者 -----------------------
CACHE_ABI_OUT="$OUT_DIR/x86-getpath-cache-abi-contract.json"
CACHE_ABI_COMMAND=(python3 "$NATIVE_DIR/check_getpath_cache_x86_64.py" \
  "$FRAMEWORKS_DIR" "$CACHE_ABI_OUT")
printf '$' >"$OUT_DIR/x86-getpath-cache-abi-contract-runner.log"
printf ' %q' "${CACHE_ABI_COMMAND[@]}" >>"$OUT_DIR/x86-getpath-cache-abi-contract-runner.log"
printf '\n' >>"$OUT_DIR/x86-getpath-cache-abi-contract-runner.log"
set +e
"${CACHE_ABI_COMMAND[@]}" >>"$OUT_DIR/x86-getpath-cache-abi-contract-runner.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-getpath-cache-abi-contract-runner.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: official x86_64 cached GetPath owner contract ($RESULT)" >&2
  exit "$RESULT"
fi

# -- Rosetta验证Viewport短/长名、unknown透传与FPS双帧owner -----------
FONT_LANE_TEST="$OUT_DIR/x86_font_viewport_lane_contract_test"
FONT_LANE_COMMAND=(xcrun --sdk macosx clang++ -std=c++17 -O0 -g -arch x86_64 \
  -mmacosx-version-min=12.0 -Wall -Wextra -Werror -fno-omit-frame-pointer \
  -I "$NATIVE_DIR" "$NATIVE_DIR/native_font_x86_64_abi_contract_test.cpp" \
  -o "$FONT_LANE_TEST")
printf '$' >"$OUT_DIR/x86-font-viewport-lane-build.log"
printf ' %q' "${FONT_LANE_COMMAND[@]}" >>"$OUT_DIR/x86-font-viewport-lane-build.log"
printf '\n' >>"$OUT_DIR/x86-font-viewport-lane-build.log"
set +e
"${FONT_LANE_COMMAND[@]}" >>"$OUT_DIR/x86-font-viewport-lane-build.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-font-viewport-lane-build.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86 Viewport/FPS owner contract build ($RESULT)" >&2
  exit "$RESULT"
fi
FONT_LANE_RUN=(arch -x86_64 "$FONT_LANE_TEST")
printf '$' >"$OUT_DIR/x86-font-viewport-lane-run.log"
printf ' %q' "${FONT_LANE_RUN[@]}" >>"$OUT_DIR/x86-font-viewport-lane-run.log"
printf '\n' >>"$OUT_DIR/x86-font-viewport-lane-run.log"
set +e
"${FONT_LANE_RUN[@]}" >>"$OUT_DIR/x86-font-viewport-lane-run.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-font-viewport-lane-run.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86 Viewport/FPS owner contract run ($RESULT)" >&2
  exit "$RESULT"
fi

# -- Rosetta负例：缓存层与生产者必须完整匹配，否则原样透传一次 ---------
CACHE_TEST="$OUT_DIR/x86_getpath_cache_contract_test"
CACHE_TEST_BUILD=(xcrun --sdk macosx clang++ -std=c++17 -O0 -g -arch x86_64 \
  -mmacosx-version-min=12.0 -Wall -Wextra -Werror -fno-omit-frame-pointer \
  -I "$NATIVE_DIR" "$NATIVE_DIR/getpath_cache_x86_64_contract_test.cpp" \
  -o "$CACHE_TEST")
printf '$' >"$OUT_DIR/x86-getpath-cache-contract-build.log"
printf ' %q' "${CACHE_TEST_BUILD[@]}" >>"$OUT_DIR/x86-getpath-cache-contract-build.log"
printf '\n' >>"$OUT_DIR/x86-getpath-cache-contract-build.log"
set +e
"${CACHE_TEST_BUILD[@]}" >>"$OUT_DIR/x86-getpath-cache-contract-build.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-getpath-cache-contract-build.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86 cached GetPath contract build ($RESULT)" >&2
  exit "$RESULT"
fi
CACHE_TEST_RUN=(arch -x86_64 "$CACHE_TEST")
printf '$' >"$OUT_DIR/x86-getpath-cache-contract-run.log"
printf ' %q' "${CACHE_TEST_RUN[@]}" >>"$OUT_DIR/x86-getpath-cache-contract-run.log"
printf '\n' >>"$OUT_DIR/x86-getpath-cache-contract-run.log"
set +e
"${CACHE_TEST_RUN[@]}" >>"$OUT_DIR/x86-getpath-cache-contract-run.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-getpath-cache-contract-run.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86 cached GetPath contract run ($RESULT)" >&2
  exit "$RESULT"
fi

# -- Rosetta合同：Popup只改精确return PC，其它caller只透传一次 ----------
POPUP_TEST="$OUT_DIR/help_popup_layout_x86_64_abi_contract_test"
POPUP_TEST_BUILD=(xcrun --sdk macosx clang++ -std=c++17 -O0 -g -arch x86_64 \
  -mmacosx-version-min=12.0 -Wall -Wextra -Werror \
  -I "$NATIVE_DIR" \
  "$NATIVE_DIR/help_popup_layout_x86_64_abi_contract_test.cpp" \
  -o "$POPUP_TEST")
printf '$' >"$OUT_DIR/help-popup-layout-x86_64-contract-build.log"
printf ' %q' "${POPUP_TEST_BUILD[@]}" >>"$OUT_DIR/help-popup-layout-x86_64-contract-build.log"
printf '\n' >>"$OUT_DIR/help-popup-layout-x86_64-contract-build.log"
set +e
"${POPUP_TEST_BUILD[@]}" >>"$OUT_DIR/help-popup-layout-x86_64-contract-build.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/help-popup-layout-x86_64-contract-build.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86 DocumentationPopup contract build ($RESULT)" >&2
  exit "$RESULT"
fi
POPUP_TEST_RUN=(arch -x86_64 "$POPUP_TEST")
printf '$' >"$OUT_DIR/help-popup-layout-x86_64-contract-run.log"
printf ' %q' "${POPUP_TEST_RUN[@]}" >>"$OUT_DIR/help-popup-layout-x86_64-contract-run.log"
printf '\n' >>"$OUT_DIR/help-popup-layout-x86_64-contract-run.log"
set +e
"${POPUP_TEST_RUN[@]}" >>"$OUT_DIR/help-popup-layout-x86_64-contract-run.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/help-popup-layout-x86_64-contract-run.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86 DocumentationPopup contract run ($RESULT)" >&2
  exit "$RESULT"
fi

# -- Intel fmt11标题地址证明与用户同名保全 -----------------------------
xcrun --sdk macosx clang++ -std=c++17 -arch x86_64 -Wall -Wextra -Werror \
  "$NATIVE_DIR/title_format_x86_64_contract_test.cpp" -o "$OUT_DIR/title-contract-test"
arch -x86_64 "$OUT_DIR/title-contract-test"

# -- 按producer顺序真实编译候选C++单元 -------------------------------
COMMON=(xcrun --sdk macosx clang++ -std=c++17 -arch x86_64 -O1 \
  -Wall -Wextra -Werror -Wno-frame-address -fno-omit-frame-pointer \
  -fno-optimize-sibling-calls -c \
  -I "$NATIVE_DIR" -I "$REPO_ROOT/injector" \
  -I "$QT_HEADERS" -I "$QT_HEADERS/QtCore" \
  -I "$QT_HEADERS/QtGui" -I "$QT_HEADERS/QtWidgets")
compile_unit() {
  local name="$1" source="$2" output="$3"
  shift 3
  local command=("${COMMON[@]}" "$@" "$source" -o "$output")
  local log="$OUT_DIR/compile-$name.log"
  printf '$' >"$log"
  printf ' %q' "${command[@]}" >>"$log"
  printf '\n' >>"$log"
  set +e
  "${command[@]}" >>"$log" 2>&1
  local result=$?
  set -e
  printf '%s\n' "$result" >"$OUT_DIR/compile-$name.exit"
  if [[ "$result" -ne 0 ]]; then
    echo "FAIL: x86_64 candidate unit $name compile ($result); see $log" >&2
    exit "$result"
  fi
}
compile_unit native-font-candidate \
  "$NATIVE_DIR/native_font_candidate.mm" \
  "$OUT_DIR/native_font_candidate.x86_64.o" \
  "-DNATIVE_HELP_DESCRIPTION_TABLE=\"$OUT_DIR/help-description-table.inc\"" \
  "-DNATIVE_HELP_LAYOUT_ROWS=\"$OUT_DIR/help-description-table.inc.layout.inc\"" \
  "-DNATIVE_EASING_DISPLAY_TABLE=\"$OUT_DIR/easing-display-table.inc\"" \
  "-DNATIVE_DG_CONTEXT_MENU_TABLE=\"$DG_CONTEXT_MENU_TABLE\"" \
  "-DNATIVE_DEMO_READER_TEXTS_TABLE=\"$DEMO_TEXT_TABLE\"" \
  "-DNATIVE_DEMO_READER_FILES_TABLE=\"$DEMO_FILES_TABLE\""
compile_unit help-popup-layout \
  "$NATIVE_DIR/help_popup_layout_adapter.mm" \
  "$OUT_DIR/help_popup_layout_adapter.x86_64.o" \
  "-DNATIVE_HELP_LAYOUT_ROWS=\"$OUT_DIR/help-description-table.inc.layout.inc\""
compile_unit fast-search-unicode \
  "$NATIVE_DIR/fast_search_unicode_adapter.mm" \
  "$OUT_DIR/fast_search_unicode_adapter.x86_64.o"

# -- 编译x86_64 veneer对象 ---------------------------------------------
compile_assembly() {
  local name="$1" source="$2" output="$3"
  local command=(xcrun --sdk macosx clang -arch x86_64 -c "$source" -o "$output")
  local log="$OUT_DIR/compile-$name.log"
  printf '$' >"$log"
  printf ' %q' "${command[@]}" >>"$log"
  printf '\n' >>"$log"
  set +e
  "${command[@]}" >>"$log" 2>&1
  local result=$?
  set -e
  printf '%s\n' "$result" >"$OUT_DIR/compile-$name.exit"
  if [[ "$result" -ne 0 ]]; then
    echo "FAIL: x86_64 assembly $name compile ($result); see $log" >&2
    exit "$result"
  fi
}
compile_assembly timeline-veneer \
  "$NATIVE_DIR/timeline_owner_observer_x86_64.S" \
  "$OUT_DIR/timeline_owner_observer_x86_64.o"
compile_assembly getpath-veneer \
  "$NATIVE_DIR/getpath_font_veneer_x86_64.S" \
  "$OUT_DIR/getpath_font_veneer_x86_64.o"
compile_assembly viewport-blob-veneer \
  "$NATIVE_DIR/viewport_blob_veneer_x86_64.S" \
  "$OUT_DIR/viewport_blob_veneer_x86_64.o"
compile_assembly help-description-veneer \
  "$NATIVE_DIR/help_description_veneer_x86_64.S" \
  "$OUT_DIR/help_description_veneer_x86_64.o"
compile_assembly welcome-log-veneer \
  "$NATIVE_DIR/welcome_log_it_veneer_x86_64.S" \
  "$OUT_DIR/welcome_log_it_veneer_x86_64.o"

# -- Rosetta运行合成caller合同；不加载vendor dylib -----------------------
VENEER_TEST="$OUT_DIR/x86_64_owner_veneer_contract_test"
TEST_COMMAND=(xcrun --sdk macosx clang++ -std=c++17 -O0 -g -arch x86_64 \
  -mmacosx-version-min=12.0 -fno-omit-frame-pointer \
  -I "$NATIVE_DIR" \
  "$NATIVE_DIR/x86_64_owner_veneer_contract_test.cpp" \
  "$NATIVE_DIR/x86_64_owner_veneer_probe.S" \
  "$NATIVE_DIR/getpath_font_veneer_x86_64.S" \
  "$NATIVE_DIR/viewport_blob_veneer_x86_64.S" \
  "$NATIVE_DIR/help_description_veneer_x86_64.S" \
  "$NATIVE_DIR/welcome_log_it_veneer_x86_64.S" \
  -o "$VENEER_TEST")
printf '$' >"$OUT_DIR/x86-veneer-contract-build.log"
printf ' %q' "${TEST_COMMAND[@]}" >>"$OUT_DIR/x86-veneer-contract-build.log"
printf '\n' >>"$OUT_DIR/x86-veneer-contract-build.log"
set +e
"${TEST_COMMAND[@]}" >>"$OUT_DIR/x86-veneer-contract-build.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-veneer-contract-build.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86_64 veneer contract build ($RESULT); see $OUT_DIR/x86-veneer-contract-build.log" >&2
  exit "$RESULT"
fi
RUN_COMMAND=(arch -x86_64 "$VENEER_TEST")
printf '$' >"$OUT_DIR/x86-veneer-contract-run.log"
printf ' %q' "${RUN_COMMAND[@]}" >>"$OUT_DIR/x86-veneer-contract-run.log"
printf '\n' >>"$OUT_DIR/x86-veneer-contract-run.log"
set +e
"${RUN_COMMAND[@]}" >>"$OUT_DIR/x86-veneer-contract-run.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/x86-veneer-contract-run.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86_64 veneer contract run ($RESULT); see $OUT_DIR/x86-veneer-contract-run.log" >&2
  exit "$RESULT"
fi

# -- 链接完整x86_64 native源码集；不构建Tauri或启动Cavalry -----------------
DYLIB="$OUT_DIR/libCavalryNativeFontCandidate.x86_64.dylib"
LINK_COMMAND=(xcrun --sdk macosx clang++ -std=c++17 -arch x86_64 -O1 \
  -Wall -Wextra -Werror -Wno-frame-address -fno-omit-frame-pointer \
  -fno-optimize-sibling-calls -dynamiclib -undefined dynamic_lookup \
  -Wl,-twolevel_namespace \
  -Wl,-install_name,@rpath/libCavalryNativeFontCandidate.dylib \
  -Wl,-headerpad_max_install_names -Wl,-rpath,@loader_path \
  -Wl,-rpath,@executable_path/../Frameworks \
  "$OUT_DIR/native_font_candidate.x86_64.o" \
  "$OUT_DIR/help_popup_layout_adapter.x86_64.o" \
  "$OUT_DIR/fast_search_unicode_adapter.x86_64.o" \
  "$OUT_DIR/timeline_owner_observer_x86_64.o" \
  "$OUT_DIR/getpath_font_veneer_x86_64.o" \
  "$OUT_DIR/viewport_blob_veneer_x86_64.o" \
  "$OUT_DIR/help_description_veneer_x86_64.o" \
  "$OUT_DIR/welcome_log_it_veneer_x86_64.o" \
  -L "$FRAMEWORKS_DIR" -lskia "$FRAMEWORKS_DIR/libApi.dylib" \
  "$FRAMEWORKS_DIR/libCore.dylib" \
  "$FRAMEWORKS_DIR/libfmt.11.dylib" "$FRAMEWORKS_DIR/libCavalryUI.dylib" \
  -lspdlog.1.15 -F "$FRAMEWORKS_DIR" \
  -framework QtCore -framework QtGui -framework QtWidgets \
  -framework CoreText -framework Foundation -o "$DYLIB")
printf '$' >"$OUT_DIR/link-x86_64-candidate.log"
printf ' %q' "${LINK_COMMAND[@]}" >>"$OUT_DIR/link-x86_64-candidate.log"
printf '\n' >>"$OUT_DIR/link-x86_64-candidate.log"
set +e
"${LINK_COMMAND[@]}" >>"$OUT_DIR/link-x86_64-candidate.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/link-x86_64-candidate.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: x86_64 candidate link ($RESULT); see $OUT_DIR/link-x86_64-candidate.log" >&2
  exit "$RESULT"
fi
install_name_tool -change @rpath/QtCore \
  @rpath/QtCore.framework/Versions/A/QtCore "$DYLIB"
install_name_tool -change @rpath/QtGui \
  @rpath/QtGui.framework/Versions/A/QtGui \
  -change @rpath/QtWidgets \
  @rpath/QtWidgets.framework/Versions/A/QtWidgets "$DYLIB"
xcrun lipo -archs "$DYLIB" >"$OUT_DIR/candidate-archs.log"
file "$DYLIB" >"$OUT_DIR/candidate-file.log"
otool -L "$DYLIB" >"$OUT_DIR/candidate-dependencies.log"
if [[ "$(cat "$OUT_DIR/candidate-archs.log")" != "x86_64" ]]; then
  echo "FAIL: output candidate does not contain only the requested x86_64 slice." >&2
  exit 1
fi

# -- 对已链接候选复核Popup x86 source caller与QtWidgets导入 ---------------
POPUP_ABI_OUT="$OUT_DIR/help-popup-layout-x86_64-abi-contract.json"
POPUP_ABI_COMMAND=(python3 "$NATIVE_DIR/check_help_popup_layout_x86_64.py" \
  "$FRAMEWORKS_DIR" "$DYLIB" "$POPUP_ABI_OUT")
printf '$' >"$OUT_DIR/help-popup-layout-x86_64-abi-contract-runner.log"
printf ' %q' "${POPUP_ABI_COMMAND[@]}" >>"$OUT_DIR/help-popup-layout-x86_64-abi-contract-runner.log"
printf '\n' >>"$OUT_DIR/help-popup-layout-x86_64-abi-contract-runner.log"
set +e
"${POPUP_ABI_COMMAND[@]}" >>"$OUT_DIR/help-popup-layout-x86_64-abi-contract-runner.log" 2>&1
RESULT=$?
set -e
printf '%s\n' "$RESULT" >"$OUT_DIR/help-popup-layout-x86_64-abi-contract-runner.exit"
if [[ "$RESULT" -ne 0 ]]; then
  echo "FAIL: candidate x86 DocumentationPopup ABI contract ($RESULT); checker log: $OUT_DIR/help-popup-layout-x86_64-abi-contract-runner.log" >&2
  cat "$OUT_DIR/help-popup-layout-x86_64-abi-contract-runner.log" >&2
  exit "$RESULT"
fi
python3 "$NATIVE_DIR/check_title_contract.py" "$FRAMEWORKS_DIR" "$DYLIB" "$OUT_DIR/title-abi-contract.json"
# Reuse the existing QString contract for Intel Save/Open ABI and three locales.
xcrun --sdk macosx clang++ -std=c++17 -arch x86_64 -O1 \
  -Wall -Wextra -Werror -mmacosx-version-min=12.0 \
  -I "$NATIVE_DIR" -I "$QT_HEADERS" -I "$QT_HEADERS/QtCore" \
  -I "$QT_HEADERS/QtGui" -I "$QT_HEADERS/QtWidgets" \
  -F "$FRAMEWORKS_DIR" -framework QtCore \
  -Wl,-rpath,"$FRAMEWORKS_DIR/QtCore.framework/Versions/A" \
  "$NATIVE_DIR/save_scene_caption_contract_test.cpp" \
  -o "$OUT_DIR/save-scene-caption-contract-test"
arch -x86_64 "$OUT_DIR/save-scene-caption-contract-test" \
  >"$OUT_DIR/save-scene-caption-contract.log" 2>&1
# Same QAction identity/data/signal fixture used by the accepted ARM path.
xcrun --sdk macosx clang++ -std=c++17 -arch x86_64 -O1 \
  -Wall -Wextra -Werror -mmacosx-version-min=12.0 \
  -DNATIVE_DG_CONTEXT_MENU_TABLE=\"$OUT_DIR/dg-context-menu-table.inc\" \
  -I "$NATIVE_DIR" -I "$QT_HEADERS" -I "$QT_HEADERS/QtCore" \
  -I "$QT_HEADERS/QtGui" -F "$FRAMEWORKS_DIR" -framework QtCore -framework QtGui \
  -Wl,-rpath,"$FRAMEWORKS_DIR/QtCore.framework/Versions/A" \
  -Wl,-rpath,"$FRAMEWORKS_DIR/QtGui.framework/Versions/A" \
  "$NATIVE_DIR/dg_context_menu_contract_test.cpp" \
  -o "$OUT_DIR/dg-context-menu-contract-test"
QT_QPA_PLATFORM=cocoa QT_QPA_PLATFORM_PLUGIN_PATH="$FRAMEWORKS_DIR/platforms" \
  arch -x86_64 "$OUT_DIR/dg-context-menu-contract-test" \
  >"$OUT_DIR/dg-context-menu-contract.log" 2>&1
printf 'PASS_X86_64_FULL_NATIVE_SOURCE_COMPILE_LINK_NOT_LIVE\n' \
  >"$OUT_DIR/compile-summary.txt"
echo "ARTIFACT: $DYLIB"
