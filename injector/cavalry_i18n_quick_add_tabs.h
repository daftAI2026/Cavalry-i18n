/**
 * [INPUT]: 依赖 cavalry_i18n_quick_add_context.h 的 Quick Add exact owner 判定，以及 Qt 6.6.3 QLabel/QFontMetrics 公共显示 API
 * [OUTPUT]: 对外提供 RolloverLabel→TabItem→TabBarHeader→QuickAddWindow/FastQuickAddWindow 的类别标签边界与按控件宽度投影函数；不读取或改写 vendor 完整分类文本
 * [POS]: injector 的 Quick Add 顶部类别标签显示边界；平台实现负责以已验证 ABI 读取完整英文源，本文仅负责 owner 门与 QLabel 显示副本，普通 QLabel、QTabBar 与模型身份保持原路径
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "cavalry_i18n_quick_add_context.h"

#include <QtCore/QByteArray>
#include <QtCore/QString>
#include <QtGui/QFontMetrics>
#include <QtWidgets/QLabel>
#include <QtWidgets/QWidget>

namespace cavalry_i18n {

inline constexpr char kQuickAddCategoryLabelClass[] = "RolloverLabel";
inline constexpr char kQuickAddCategoryItemClass[] = "TabItem";
inline constexpr char kQuickAddCategoryHeaderClass[] = "TabBarHeader";

inline bool hasExactQuickAddCategoryAncestor(
    const QObject *object,
    const char *className) noexcept
{
    if (object == nullptr || className == nullptr) {
        return false;
    }

    for (const QObject *candidate = object;
         candidate != nullptr;
         candidate = candidate->parent()) {
        if (isExactOwner(candidate, className)) {
            return true;
        }
    }
    return false;
}

inline bool isQuickAddCategoryLabel(const QWidget *widget) noexcept
{
    if (widget == nullptr
        || qobject_cast<const QLabel *>(widget) == nullptr
        || !isExactOwner(widget, kQuickAddCategoryLabelClass)
        || !hasExactQuickAddCategoryAncestor(
            widget,
            kQuickAddCategoryItemClass)
        || !hasExactQuickAddCategoryAncestor(
            widget,
            kQuickAddCategoryHeaderClass)) {
        return false;
    }

    return hasExactQuickAddOwner(widget);
}

inline bool isQuickAddCategorySource(const QString &source) noexcept
{
    return source == QStringLiteral("All")
        || source == QStringLiteral("Shapes")
        || source == QStringLiteral("Behaviours")
        || source == QStringLiteral("Utilities")
        || source == QStringLiteral("Effects");
}

inline QString quickAddCategoryDisplayText(
    const QWidget *widget,
    const QString &translatedText)
{
    const auto *label = qobject_cast<const QLabel *>(widget);
    if (label == nullptr || translatedText.isEmpty()) {
        return QString();
    }

    const int width = label->contentsRect().width();
    if (width <= 0) {
        return translatedText;
    }

    // vendor RolloverLabel::resizeEvent 也会按同一 QLabel 宽度省略；
    // 这里只投影译文，保留 RolloverLabel 内部的完整 source text。
    return QFontMetrics(label->font()).elidedText(
        translatedText,
        Qt::ElideRight,
        width);
}

inline bool setQuickAddCategoryDisplayText(
    QWidget *widget,
    const QString &translatedText)
{
    if (!isQuickAddCategoryLabel(widget)) {
        return false;
    }

    auto *label = qobject_cast<QLabel *>(widget);
    const QString display = quickAddCategoryDisplayText(widget, translatedText);
    if (label == nullptr || display.isEmpty()) {
        return false;
    }

    if (label->text() != display) {
        // 直接调用 QLabel setter，不调用 vendor RolloverLabel::setText；
        // 分类完整文本仍留在 vendor 字段，业务分类 key 不随显示语言变化。
        label->setText(display);
    }
    return true;
}

} // namespace cavalry_i18n
