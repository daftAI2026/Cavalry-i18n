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

found=0
for dmg in "$DIST_DIR"/*.dmg; do
  [ -f "$dmg" ] || continue
  echo "Processing $(basename "$dmg")..."

  # 卷宗图标：写进 DMG 文件系统本体，GitHub 裸 .dmg 下载后仍保留。
  WORKDIR=$(mktemp -d /tmp/dmg-volume-icon-XXXXXX)
  rw_dmg="$WORKDIR/readwrite.dmg"
  final_dmg="$WORKDIR/final.dmg"

  hdiutil convert "$dmg" -format UDRW -o "$rw_dmg" -quiet
  mount_point=$(
    hdiutil attach "$rw_dmg" -readwrite -nobrowse -noverify -noautoopen |
      awk '/\/Volumes\// { print substr($0, index($0, "/Volumes/")); exit }'
  )
  if [ -z "$mount_point" ] || [ ! -d "$mount_point" ]; then
    echo "Unable to mount writable DMG: $dmg" >&2
    exit 1
  fi

  cp "$ICNS" "$mount_point/.VolumeIcon.icns"
  SetFile -a C "$mount_point"
  SetFile -a V "$mount_point/.VolumeIcon.icns" || true
  hdiutil detach "$mount_point" -quiet
  mount_point=""

  hdiutil convert "$rw_dmg" -format UDZO -imagekey zlib-level=9 -o "$final_dmg" -quiet
  mv "$final_dmg" "$dmg"
  echo "  - Embedded DMG volume icon (Success)"

  # 文件图标：只对当前 Mac 文件系统 best-effort 生效，GitHub 上传不承诺保留。
  # Tauri 原生 DMG 配置已处理背景图、窗口尺寸与图标坐标
  # (tauri.conf.json > bundle > macOS > dmg)，
  # 此处仅补充 Tauri 不支持的 Finder 文件图标资源分叉。
  Rez -append "$TMPRSRC" -o "$dmg"
  SetFile -a C "$dmg"
  echo "  - Stamped local Finder file icon (Best effort)"

  rm -rf "$WORKDIR"
  WORKDIR=""
  found=1
done

if [ "$found" -eq 0 ]; then
  echo "No DMG files found in $DIST_DIR" >&2
  exit 1
fi

echo "DMG processing complete!"
