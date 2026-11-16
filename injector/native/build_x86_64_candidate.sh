#!/usr/bin/env bash
# [INPUT]: 同架构官方2.8.1 Frameworks、Qt6.9.2头与新输出目录。
# [OUTPUT]: 使用共享composer选择Intel281合同，构建同源x86_64运行时。
# [POS]: Intel生产入口；不安装或启动Cavalry。
# [PROTOCOL]: 变更时更新CLAUDE.md与CI输入合同。
set -euo pipefail
if [[ "$#" -ne 2 ]]; then
  echo "usage: $0 <readonly-Cavalry-2.8.1-Contents/Frameworks> <new-output-dir>" >&2
  exit 2
fi
exec python3 "$(dirname "$0")/build_candidate_2_8_1.py" "$1" --architecture x86_64 --output "$2"
