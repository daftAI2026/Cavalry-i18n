/**
 * [INPUT]: 依赖共享 Quick Add 类别 owner/source 边界，以及 macOS Classic ABI gate 对 Cavalry 2.7.2 映像身份的证明
 * [OUTPUT]: 对外提供 macQuickAddCategoryApi；只返回已通过双架构 dlsym/RVA 校验的 RolloverLabel 英文 source getter
 * [POS]: injector 的 macOS Quick Add 类别平台适配；只读取 vendor 完整 source，不修改 QLabel、分类身份或用户输入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>
#include <QtWidgets/QWidget>

namespace cavalry_i18n {

using MacQuickAddCategorySourceFunction =
    QString (*)(const QWidget *) noexcept;

struct MacQuickAddCategoryApi final {
    MacQuickAddCategorySourceFunction source = nullptr;

    explicit operator bool() const noexcept
    {
        return source != nullptr;
    }
};

MacQuickAddCategoryApi macQuickAddCategoryApi() noexcept;

} // namespace cavalry_i18n
