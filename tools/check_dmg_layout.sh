#!/bin/bash
set -euo pipefail

# [INPUT]: 依赖 Tauri 产出的架构后缀 DMG、dmg_volume_identity.js、hdiutil、diskutil、codesign 和 Finder 布局资源
# [OUTPUT]: 校验版本/架构卷标、背景图、.DS_Store 的 400px 左锚与非正 bottom-origin、卷宗图标、Applications 链接、app bundle、安装态 app 与 bundle seal
# [POS]: tools/ 下的 DMG 身份、布局与签名守门器，阻止本地或 CI 发布身份模糊、未美化、丢失参考安装盘贴底行为或被 Gatekeeper 判定 damaged 的安装镜像
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

DIST_DIR="${1:-src-tauri/target/release/bundle/dmg}"
APP_NAME="Cavalry Language Switcher.app"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
VOLUME_IDENTITY_TOOL="$SCRIPT_DIR/dmg_volume_identity.js"
current_mount=""

cleanup() {
  if [ -n "$current_mount" ]; then
    hdiutil detach "$current_mount" -quiet >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

found=0
for dmg in "$DIST_DIR"/*.dmg; do
  [ -f "$dmg" ] || continue
  found=1
  echo "Checking DMG layout: $(basename "$dmg")"
  expected_volume_name=$(node "$VOLUME_IDENTITY_TOOL" --dmg "$dmg")

  attach_output=$(hdiutil attach "$dmg" -nobrowse -readonly -noverify -noautoopen)
  mount_line=$(printf '%s\n' "$attach_output" | awk '/\/Volumes\// { print; exit }')
  current_device=$(printf '%s\n' "$mount_line" | awk '{ print $1 }')
  current_mount=$(printf '%s\n' "$mount_line" | awk '{ print substr($0, index($0, "/Volumes/")) }')
  if [ -z "$current_mount" ] || [ ! -d "$current_mount" ]; then
    echo "Unable to mount DMG: $dmg" >&2
    exit 1
  fi
  actual_volume_name=$(
    /usr/sbin/diskutil info "$current_device" |
      awk -F: '/Volume Name/ { sub(/^[[:space:]]+/, "", $2); print $2; exit }'
  )
  if [ "$actual_volume_name" != "$expected_volume_name" ]; then
    echo "DMG volume title mismatch: expected '$expected_volume_name', got '$actual_volume_name'" >&2
    exit 1
  fi

  test -f "$current_mount/.DS_Store"
  window_bounds=$(
    strings -a "$current_mount/.DS_Store" |
      grep -E '^\{\{400, -?[0-9]+\}, \{800, 476\}\}$' |
      head -n 1 || true
  )
  if [ -z "$window_bounds" ]; then
    echo "DMG Finder WindowBounds does not preserve the 400px left anchor and 800x476 frame: $dmg" >&2
    exit 1
  fi
  window_bottom_origin=$(printf '%s\n' "$window_bounds" | sed -E 's/^\{\{400, (-?[0-9]+)\}.*/\1/')
  if [ "$window_bottom_origin" -gt 0 ]; then
    echo "DMG Finder window is not bottom-constrained: $window_bounds" >&2
    exit 1
  fi
  test -f "$current_mount/.background/background.png"
  test -f "$current_mount/.VolumeIcon.icns"
  test -L "$current_mount/Applications"
  test -d "$current_mount/$APP_NAME"
  test -f "$current_mount/$APP_NAME/Contents/_CodeSignature/CodeResources"
  if ! codesign --verify --deep --strict --verbose=4 "$current_mount/$APP_NAME" >/dev/null 2>&1; then
    echo "DMG app bundle signature is invalid: $dmg" >&2
    codesign --verify --deep --strict --verbose=4 "$current_mount/$APP_NAME" >&2 || true
    exit 1
  fi
  install_probe=$(mktemp -d)
  ditto "$current_mount/$APP_NAME" "$install_probe/$APP_NAME"
  test -f "$install_probe/$APP_NAME/Contents/_CodeSignature/CodeResources"
  if ! codesign --verify --deep --strict --verbose=4 "$install_probe/$APP_NAME" >/dev/null 2>&1; then
    echo "Installed app bundle signature is invalid after copying from DMG: $dmg" >&2
    codesign --verify --deep --strict --verbose=4 "$install_probe/$APP_NAME" >&2 || true
    rm -rf "$install_probe"
    exit 1
  fi
  rm -rf "$install_probe"
  if ! GetFileInfo "$current_mount" | grep -q "attributes: .*C"; then
    echo "DMG volume custom icon bit is missing: $dmg" >&2
    exit 1
  fi

  hdiutil detach "$current_mount" -quiet
  current_mount=""
done

if [ "$found" -eq 0 ]; then
  echo "No DMG files found in $DIST_DIR" >&2
  exit 1
fi

echo "DMG layout check complete!"
