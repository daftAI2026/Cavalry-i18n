#!/bin/bash
set -euo pipefail

# [INPUT]: 依赖磁盘上的 DMG 文件、icon.icns、Rez/SetFile 与 ditto
# [OUTPUT]: 修改后的 DMG 文件，以及保留 Finder 图标资源分叉的 .dmg.zip
# [POS]: tools/ 下的高鲁棒性 DMG 修饰脚本
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

DIST_DIR="${1:-dist}"
ICNS="src-tauri/icons/icon.icns"

# 1. 检查基础资源
if [ ! -f "$ICNS" ]; then
  echo "Icon not found: $ICNS" >&2
  exit 1
fi

# 2. 准备图标资源 (DeRez/Rez 逻辑)
TMPRSRC=$(mktemp /tmp/dmg-icon-XXXXXX.rsrc)
trap 'rm -f "$TMPRSRC"' EXIT

sips -i "$ICNS" >/dev/null 2>&1
DeRez -only icns "$ICNS" > "$TMPRSRC"

found=0
for dmg in "$DIST_DIR"/*.dmg; do
  [ -f "$dmg" ] || continue
  echo "Processing $(basename "$dmg")..."

  # 盖章 (DMG 文件图标)
  # Tauri 原生 DMG 配置已处理背景图、窗口尺寸与图标坐标
  # (tauri.conf.json > bundle > macOS > dmg)，
  # 此脚本仅补充 Tauri 不支持的 Finder 文件图标资源分叉。
  Rez -append "$TMPRSRC" -o "$dmg"
  SetFile -a C "$dmg"
  echo "  - Stamped Finder file icon (Success)"

  # GitHub artifact/Release 上传裸 DMG 时只保留 data fork；
  # ditto zip 是跨下载链路保住资源分叉的唯一发布载体。
  rm -f "$dmg.zip"
  ditto -c -k --sequesterRsrc --keepParent "$dmg" "$dmg.zip"
  echo "  - Wrote resource-preserving archive: $(basename "$dmg.zip")"

  found=1
done

if [ "$found" -eq 0 ]; then
  echo "No DMG files found in $DIST_DIR" >&2
  exit 1
fi

echo "DMG processing complete!"
