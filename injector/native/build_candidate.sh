#!/usr/bin/env bash
# [INPUT]: 官方Cavalry 2.8.1 Frameworks、Qt 6.9.2公开头与当前原生源码。
# [OUTPUT]: 复用已验281 composer生成隔离源树并运行完整ARM构建与ABI门。
# [POS]: 当前macOS ARM默认构建入口；2.8.0仅保留历史release，不参与本次生产。
# [PROTOCOL]: 目标升级时同步ABI profile、CI输入和injector/native/CLAUDE.md。
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo 'usage: CAVALRY_QT_PREFIX=<Qt-6.9.2-prefix> build_candidate.sh <official-Cavalry-2.8.1-Contents/Frameworks>' >&2
  exit 2
fi

exec python3 "$(cd "$(dirname "$0")" && pwd -P)/build_candidate_2_8_1.py" "$1"
