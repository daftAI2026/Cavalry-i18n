#!/bin/bash
set -euo pipefail

# [INPUT]: 依赖磁盘上的 DMG 文件、icon.icns 和 dmg_background.png
# [OUTPUT]: 修改后的 DMG 文件（图标打桩固定完成，美化视权限而定）
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

  # 盖章 (DMG 磁盘图标)
  # Tauri 原生 DMG 配置已处理背景图、窗口尺寸与图标坐标
  # (tauri.conf.json > bundle > macOS > dmg)，
  # 此脚本仅补充 Tauri 不支持的卷宗磁盘图标嵌入。
  Rez -append "$TMPRSRC" -o "$dmg"
  SetFile -a C "$dmg"
  echo "  - Stamped volume icon (Success)"

  found=1
done

if [ "$found" -eq 0 ]; then
  echo "No DMG files found in $DIST_DIR" >&2
  exit 1
fi

echo "DMG processing complete!"
