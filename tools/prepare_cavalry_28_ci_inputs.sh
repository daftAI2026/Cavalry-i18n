#!/usr/bin/env bash
# [INPUT]: 依赖经字节锁验证的官方2.8.1 DMG、Qt6.9.2头包和目标架构runner。
# [OUTPUT]: 在runner隔离目录生成production资源与同架构候选，成功后才导出产品路径。
# [POS]: 仅由显式2.8 macOS矩阵调用；不签名更新器、不发布，也不触碰旧p12资产。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
set -euo pipefail

readonly DMG_URL='https://cavalry.studio/downloads/latest/Cavalry.dmg'
readonly DMG_BYTES='257424425'
readonly DMG_SHA256='fcf372238c9983ebdecf6ff68858ed647323b6297c8008ad2befdcb7aae09271'
readonly QT_ARCHIVE_URL='https://download.qt.io/online/qtsdkrepository/mac_x64/desktop/qt6_692/qt6_692/qt.qt6.692.clang_64/6.9.2-0-202508181146qtbase-MacOS-MacOS_15-Clang-MacOS-MacOS_15-X86_64-ARM64.7z'
readonly QT_ARCHIVE_BYTES='34027496'
readonly QT_ARCHIVE_SHA256='d2a2a80de2e049dab5521318cc359ce2a02d1f3bc5235804de158b7342201e11'
readonly PLIST_BUDDY="${CAVALRY_PLIST_BUDDY:-/usr/libexec/PlistBuddy}"

fail() {
  echo "[native-2.8-ci-inputs] $1" >&2
  exit 1
}

[[ "${RELEASE_PROFILE_CONFIG:-}" == 'release-2.8.config.json' ]] || fail 'requires the selected 2.8 release profile'
readonly native_target="${CAVALRY_NATIVE_CI_TARGET:-}"
case "$native_target" in
  aarch64-apple-darwin)
    readonly expected_host_arch='arm64'
    readonly candidate_arch='arm64'
    readonly candidate_builder='injector/native/build_candidate.sh'
    ;;
  x86_64-apple-darwin)
    readonly expected_host_arch='x86_64'
    readonly candidate_arch='x86_64'
    readonly candidate_builder='injector/native/build_x86_64_candidate.sh'
    ;;
  *) fail 'target must be an explicit macOS production matrix architecture' ;;
esac
[[ "$(uname -m)" == "$expected_host_arch" ]] || fail "native $candidate_arch candidate requires a $expected_host_arch runner"
[[ -n "${PYTHON:-}" && -x "$PYTHON" ]] || fail 'reuse the pinned CI Python environment from requirements-ci.txt'
[[ -n "${RUNNER_TEMP:-}" && -n "${GITHUB_ENV:-}" ]] || fail 'GitHub runner temporary and environment paths are required'

readonly run_dir="$RUNNER_TEMP/cavalry-2.8-$candidate_arch-inputs"
readonly dmg="$run_dir/Cavalry-2.8.1.dmg"
readonly mountpoint="$run_dir/CavalryMount"
readonly qt_archive="$run_dir/qtbase-6.9.2.7z"
readonly qt_prefix="$run_dir/qt-6.9.2-headers"
readonly candidate_log="$run_dir/native-candidate.log"
mkdir -m 700 "$run_dir"
mkdir "$mountpoint"

cleanup() {
  if mount | grep -Fq " on $mountpoint ("; then
    hdiutil detach "$mountpoint" >/dev/null || true
  fi
  rm -f "$dmg" "$qt_archive"
}
trap cleanup EXIT

echo '[native-2.8-ci-inputs] Fetching the official latest alias under a fixed 2.8.1 byte pin.'
curl --fail --show-error --location --silent --output "$dmg" "$DMG_URL"
[[ "$(stat -f '%z' "$dmg")" == "$DMG_BYTES" ]] || fail 'official Cavalry DMG size drifted; keep the pin unchanged and stop'
actual_dmg_sha256="$(shasum -a 256 "$dmg" | awk '{print $1}')"
[[ "$actual_dmg_sha256" == "$DMG_SHA256" ]] || fail 'official Cavalry DMG SHA-256 drifted; keep the pin unchanged and stop'

hdiutil attach "$dmg" -readonly -nobrowse -noautoopen -mountpoint "$mountpoint"
readonly app="$mountpoint/Cavalry.app"
readonly assets="$app/Contents/assets"
readonly frameworks="$app/Contents/Frameworks"
[[ -d "$assets" && ! -L "$assets" ]] || fail 'verified DMG lacks Contents/assets'
[[ -d "$frameworks" && ! -L "$frameworks" ]] || fail 'verified DMG lacks Contents/Frameworks'
short_version="$("$PLIST_BUDDY" -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist")"
bundle_version="$("$PLIST_BUDDY" -c 'Print :CFBundleVersion' "$app/Contents/Info.plist")"
[[ "$short_version" == '2.8.1' && "$bundle_version" == '2.8.1' ]] || fail 'mounted official app is not exactly version 2.8.1'

echo '[native-2.8-ci-inputs] Building complete native language resources from official app assets.'
npm run build:native-resources -- --assets-root "$assets" --profile production-2.8

echo '[native-2.8-ci-inputs] Fetching the pinned official Qt 6.9.2 qtbase archive.'
curl --fail --show-error --location --silent --output "$qt_archive" "$QT_ARCHIVE_URL"
[[ "$(stat -f '%z' "$qt_archive")" == "$QT_ARCHIVE_BYTES" ]] || fail 'Qt 6.9.2 qtbase archive size drifted; keep the pin unchanged and stop'
actual_qt_sha256="$(shasum -a 256 "$qt_archive" | awk '{print $1}')"
[[ "$actual_qt_sha256" == "$QT_ARCHIVE_SHA256" ]] || fail 'Qt 6.9.2 qtbase archive SHA-256 mismatch'
"$PYTHON" tools/prepare_native_qt_headers.py --archive "$qt_archive" --output "$qt_prefix"

echo "[native-2.8-ci-inputs] Building the approved $candidate_arch candidate from the verified bundle frameworks."
export CAVALRY_QT_PREFIX="$qt_prefix"
if [[ "$candidate_arch" == 'arm64' ]]; then
  TMPDIR="$run_dir" bash "$candidate_builder" "$frameworks" 2>&1 | tee "$candidate_log"
else
  readonly candidate_output="$run_dir/native-candidate-output"
  bash "$candidate_builder" "$frameworks" "$candidate_output" 2>&1 | tee "$candidate_log"
fi
candidate="$(sed -n 's/^ARTIFACT: //p' "$candidate_log" | tail -n 1)"
[[ -n "$candidate" && -f "$candidate" && ! -L "$candidate" ]] || fail 'candidate builder did not return one regular dylib artifact'
lipo "$candidate" -verify_arch "$candidate_arch"
candidate_sha256="$(shasum -a 256 "$candidate" | awk '{print $1}')"
candidate_bytes="$(stat -f '%z' "$candidate")"
printf 'CAVALRY_I18N_NATIVE_INJECTOR_FILE=%s\n' "$candidate" >> "$GITHUB_ENV"
{
  echo "### 2.8 $candidate_arch native input preparation"
  echo
  echo "- Official Cavalry version: $short_version ($bundle_version)"
  echo "- DMG bytes/SHA-256: $DMG_BYTES / $actual_dmg_sha256"
  echo "- Qt 6.9.2 bytes/SHA-256: $QT_ARCHIVE_BYTES / $actual_qt_sha256"
  echo "- Candidate $candidate_arch dylib bytes/SHA-256: $candidate_bytes / $candidate_sha256"
  echo '- Source URL: mutable official latest alias; any byte/version drift fails without changing pins.'
  echo '- Scope: production resources and one architecture-bound macOS candidate; publication still requires the all-platform production build and signed updater closure.'
} >> "$GITHUB_STEP_SUMMARY"
