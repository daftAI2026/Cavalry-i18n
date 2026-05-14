#!/bin/bash
set -euo pipefail

# [INPUT]: 依赖 Tauri 产出的 DMG、hdiutil 和 Finder 布局资源
# [OUTPUT]: 校验 DMG 内部背景图、.DS_Store、卷宗图标、Applications 链接与 app bundle
# [POS]: tools/ 下的 DMG 布局守门器，阻止 CI 发布未美化的安装镜像
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

DIST_DIR="${1:-src-tauri/target/release/bundle/dmg}"
APP_NAME="Cavalry Language Switcher.app"
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

  current_mount=$(
    hdiutil attach "$dmg" -nobrowse -readonly -noverify -noautoopen |
      awk '/\/Volumes\// { print substr($0, index($0, "/Volumes/")); exit }'
  )
  if [ -z "$current_mount" ] || [ ! -d "$current_mount" ]; then
    echo "Unable to mount DMG: $dmg" >&2
    exit 1
  fi

  test -f "$current_mount/.DS_Store"
  test -f "$current_mount/.background/background.png"
  test -f "$current_mount/.VolumeIcon.icns"
  test -L "$current_mount/Applications"
  test -d "$current_mount/$APP_NAME"
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
