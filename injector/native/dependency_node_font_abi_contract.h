/**
 * [INPUT]: 依赖显式281 arm64目标宏与abi_2_8_1下的NodeView合同。
 * [OUTPUT]: 仅为281 arm64暴露Dependency Graph NodeView字体ABI。
 * [POS]: 2.8.0默认没有NodeView准入合同。
 * [PROTOCOL]: ABI变化时更新profile快照与CLAUDE.md
 */
#pragma once
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
#include "abi_2_8_1/dependency_node_font_abi_contract.h"
#endif  // CAVALRY_NATIVE_TARGET_281 && __aarch64__
