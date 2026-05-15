#!/bin/bash
set -euo pipefail

# [INPUT]: 依赖 Tauri 产出的 DMG、hdiutil、codesign 和 Finder 布局资源
# [OUTPUT]: 校验 DMG 内部背景图、.DS_Store、卷宗图标、Applications 链接、app bundle、安装态 app 与 bundle seal
# [POS]: tools/ 下的 DMG 布局与签名守门器，阻止 CI 发布未美化或被 Gatekeeper 判定 damaged 的安装镜像
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
