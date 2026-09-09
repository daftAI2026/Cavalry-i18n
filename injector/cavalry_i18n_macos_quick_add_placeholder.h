/**
 * [INPUT]: 依赖共享空结果显示策略与已加载 Cavalry 2.7.2/Qt 6.6.3 映像
 * [OUTPUT]: 提供经过双架构映像、setter 地址与完整函数字节验证的 placeholder API
 * [POS]: macOS ListWidget 私有布局边界；未知 ABI 返回空 API，不读取任何 vendor 字段
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include "cavalry_i18n_quick_add_placeholder.h"
namespace cavalry_i18n {
QuickAddPlaceholderApi macQuickAddPlaceholderApi() noexcept;
}
