#!/bin/bash
set -euo pipefail

# [INPUT]: 依赖磁盘上的 DMG 文件、icon.icns、hdiutil、Rez 与 SetFile
# [OUTPUT]: 写入卷宗图标后的 DMG 文件，本机再附加 Finder 文件图标
# [POS]: tools/ 下的高鲁棒性 DMG 卷宗图标修饰脚本
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

DIST_DIR="${1:-dist}"
ICNS="src-tauri/icons/icon.icns"
TMPRSRC=""
WORKDIR=""
mount_point=""

cleanup() {
  if [ -n "$mount_point" ]; then
    hdiutil detach "$mount_point" -quiet >/dev/null 2>&1 || true
  fi
  if [ -n "$TMPRSRC" ]; then
    rm -f "$TMPRSRC"
  fi
  if [ -n "$WORKDIR" ]; then
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT

# 1. 检查基础资源
if [ ! -f "$ICNS" ]; then
  echo "Icon not found: $ICNS" >&2
  exit 1
fi

# 2. 准备图标资源 (DeRez/Rez 逻辑)
TMPRSRC=$(mktemp /tmp/dmg-icon-XXXXXX.rsrc)

sips -i "$ICNS" >/dev/null 2>&1
DeRez -only icns "$ICNS" > "$TMPRSRC"

embed_volume_icon() {
  local dmg="$1"
  local dmg_name
  local rw_base
  local rw_dmg
  local final_base
  local final_dmg

  dmg_name="$(basename "$dmg" .dmg)"
  WORKDIR=$(mktemp -d /tmp/dmg-volume-icon-XXXXXX)
  rw_base="$WORKDIR/$dmg_name-rw"

  hdiutil convert "$dmg" -format UDRW -o "$rw_base" >/dev/null
  rw_dmg="$rw_base.dmg"
  if [ ! -f "$rw_dmg" ]; then
    rw_dmg="$rw_base"
  fi

  mount_point=$(
    hdiutil attach "$rw_dmg" -nobrowse -readwrite -noverify -noautoopen |
      awk '/\/Volumes\// { print substr($0, index($0, "/Volumes/")); exit }'
  )
  if [ -z "$mount_point" ] || [ ! -d "$mount_point" ]; then
    echo "Unable to mount writable DMG: $dmg" >&2
    exit 1
  fi

  cp "$ICNS" "$mount_point/.VolumeIcon.icns"
  SetFile -a V "$mount_point/.VolumeIcon.icns"
  SetFile -a C "$mount_point"
  sync
  hdiutil detach "$mount_point" -quiet
  mount_point=""

  final_base="$WORKDIR/$dmg_name-final"
  hdiutil convert "$rw_dmg" -format UDZO -imagekey zlib-level=9 -o "$final_base" >/dev/null
  final_dmg="$final_base.dmg"
  if [ ! -f "$final_dmg" ]; then
    final_dmg="$final_base"
  fi
  mv "$final_dmg" "$dmg"
  rm -rf "$WORKDIR"
  WORKDIR=""
}

found=0
for dmg in "$DIST_DIR"/*.dmg; do
  [ -f "$dmg" ] || continue
  echo "Processing $(basename "$dmg")..."

  # 盖章 (DMG 卷宗图标)
  # Tauri 原生 DMG 配置已处理背景图、窗口尺寸与图标坐标
  # (tauri.conf.json > bundle > macOS > dmg)，
  # 此脚本补充挂载后可见、可随裸 DMG 发布存活的卷宗图标。
  embed_volume_icon "$dmg"
  echo "  - Embedded mounted volume icon (Success)"

  # 本机 Finder 文件图标是 resource fork，GitHub 裸 DMG 下载不保证保留。
  # 保留这个 best-effort 步骤只为本地产物体验，不把它当发布契约。
  Rez -append "$TMPRSRC" -o "$dmg"
  SetFile -a C "$dmg"
  echo "  - Stamped local Finder file icon (Best effort)"

  found=1
done

if [ "$found" -eq 0 ]; then
  echo "No DMG files found in $DIST_DIR" >&2
  exit 1
fi

echo "DMG processing complete!"
