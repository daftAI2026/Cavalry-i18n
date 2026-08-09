#!/bin/zsh
# [INPUT]: 依赖同源 repo-root 的 Cavalry/Qt target contract、Qt 6.6.3 public/CorePrivate headers、仓库内 driver/helper 源码与系统 macOS frameworks；live 构建另要求显式 disposable Cavalry.app
# [OUTPUT]: 向显式仓库外空目录生成并 ad-hoc 签名两枚验收 dylib 与 exact-window helper；live 构建另验证 clone runtime Qt 与真实媒体，CI compile-only 不依赖 vendor app/ffprobe
# [POS]: macos-acceptance 的唯一原生构建边界；compile-only 只证明 producer 可链接，live 构建也不启动或修改 /Applications/Cavalry.app
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
set -euo pipefail
root=${0:A:h}; repo=""; clone=""; qt="${CAVALRY_QT_PREFIX:-}"; out=""; compile_only=0
source_repo=$(/usr/bin/git -C "$root" rev-parse --show-toplevel 2>/dev/null || true)
while (( $# )); do case "$1" in
  --compile-only)compile_only=1;shift;;
  --repo-root)repo=${2:?};shift 2;;
  --clone)clone=${2:?};shift 2;;
  --qt-prefix)qt=${2:?};shift 2;;
  --out)out=${2:?};shift 2;;
  *)print -u2 "usage: $0 [--repo-root <source-repo>] [--compile-only | --clone <new-Cavalry.app>] --qt-prefix <Qt> --out <external-dir>";exit 64;;
esac;done
[[ -n "$qt" && -n "$out" && -d "$qt/lib/QtCore.framework" ]] || { print -u2 'Qt prefix and external output directory required'; exit 64; }
[[ -n "$repo" ]] || repo="$source_repo"
[[ -n "$repo" && -f "$repo/tools/cavalry_qt_target.json" ]] || { print -u2 'source repo with Cavalry/Qt target contract required';exit 64; }
qt=${qt:A}; out=${out:A}; repo=${repo:A}
[[ "$out" != "$repo" && "$out" != "$repo/"* && "$out" != "$root" && "$out" != "$root/"* ]] ||
  { print -u2 'output must stay outside the repository and acceptance source';exit 64; }
if [[ -n "$source_repo" ]]; then
  source_repo=${source_repo:A}
  [[ "$out" != "$source_repo" && "$out" != "$source_repo/"* ]] ||
    { print -u2 'output must stay outside the source worktree';exit 64; }
fi
expected_qt=$(node -e 'const t=require(process.argv[1]);process.stdout.write(String(t.qtVersion||""))' "$repo/tools/cavalry_qt_target.json")
[[ "$expected_qt" == "6.6.3" ]] || { print -u2 'acceptance target must remain Qt 6.6.3';exit 64; }
sdk_qt=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$qt/lib/QtCore.framework/Resources/Info.plist" 2>/dev/null || true)
[[ "$sdk_qt" == "$expected_qt" ]] || { print -u2 "Qt SDK mismatch: expected $expected_qt, got ${sdk_qt:-missing}";exit 64; }
vendor_frameworks=()
if (( compile_only )); then
  [[ -z "$clone" ]] || { print -u2 'compile-only does not accept a Cavalry clone';exit 64; }
else
  [[ -n "$clone" && ! -L "$clone" ]] || { print -u2 'live build requires a non-symlink disposable clone';exit 64; }
  clone=${clone:A}
  [[ -d "$clone/Contents/Frameworks" && "$clone" != /Applications/* ]] || { print -u2 'clone must stay outside /Applications';exit 64; }
  runtime_qt=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$clone/Contents/Frameworks/QtCore.framework/Resources/Info.plist" 2>/dev/null || true)
  [[ "$runtime_qt" == "$expected_qt" ]] || { print -u2 "Clone Qt mismatch: expected $expected_qt, got ${runtime_qt:-missing}";exit 64; }
  vendor_frameworks=(-F"$clone/Contents/Frameworks")
fi
if [[ -e "$out" ]]; then
  [[ -d "$out" && ! -L "$out" && -z "$(find "$out" -mindepth 1 -maxdepth 1 -print -quit)" ]] ||
    { print -u2 'output must be a new or empty non-symlink directory';exit 64; }
else
  mkdir -m 700 "$out"
fi
qt_private="$qt/lib/QtCore.framework/Versions/A/Headers/$expected_qt"
qt_core_headers="$qt/lib/QtCore.framework/Versions/A/Headers"
[[ -f "$qt_private/QtCore/private/qobject_p.h" ]] || { print -u2 'Qt CorePrivate qobject_p.h is required';exit 64; }
common=(-dynamiclib -std=c++17 -fobjc-arc -I"$qt/include" -I"$qt_core_headers" -I"$qt_private" -I"$qt_private/QtCore" -F"$qt/lib" "${vendor_frameworks[@]}" -framework QtCore -framework QtGui -framework QtWidgets -framework Foundation -framework AppKit -framework QuartzCore -Wl,-rpath,@loader_path)
clang++ "${common[@]}" "$root/drivers/macos_main_acceptance_driver.mm" -o "$out/macos_main_acceptance_driver.dylib"
clang++ "${common[@]}" "$root/drivers/macos_supplemental_acceptance_driver.mm" -o "$out/macos_supplemental_acceptance_driver.dylib"
swiftc "$root/helpers/cgwindow_exact.swift" -o "$out/cgwindow_exact"
for f in "$out"/*.dylib; do
  [[ -z "$clone" ]] || { otool -l "$f" | grep -A2 LC_RPATH | grep -F "$clone" && { print -u2 "stale absolute clone RPATH in $f";exit 1; } || true; }
  codesign --force --sign - "$f"
  codesign --verify --strict "$f"
done
node --check "$root/acceptance_harness.js"
if (( ! compile_only )); then
  # Reject source-level fake fixtures before a live acceptance run can be prepared.
  node "$root/acceptance_harness.js" >/dev/null
fi
