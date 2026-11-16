/**
 * [INPUT]: 依赖显式281目标宏与abi_2_8_1下的分架构NodeView合同。
 * [OUTPUT]: 为281 arm64/x86_64暴露各自Dependency Graph NodeView字体ABI。
 * [POS]: 2.8.0默认没有NodeView准入合同。
 * [PROTOCOL]: ABI变化时更新profile快照与CLAUDE.md
 */
#pragma once
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__x86_64__)
#include "abi_2_8_1/x86_64/dependency_node_font_abi_contract.h"
#elif defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
#include "abi_2_8_1/dependency_node_font_abi_contract.h"
#endif  // CAVALRY_NATIVE_TARGET_281 && __aarch64__
