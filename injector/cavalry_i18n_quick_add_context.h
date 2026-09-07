/**
 * [INPUT]: 依赖 Qt 6 QObject/QAbstractItemView/QLineEdit/QListView 公共 API 与 cavalry_i18n_input_policy.h 的 CompleterLineEdit 值保护判定
 * [OUTPUT]: 对外提供 Quick Add 两种 exact owner、搜索框父链与 QListView context guard，以及唯一搜索框发现函数
 * [POS]: injector 的窄 Quick Add UI 上下文边界；只证明索引挂接位置，不读取 model 数据、不改用户输入，也不参与搜索过滤算法
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QByteArray>
#include <QtWidgets/QAbstractItemView>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QListView>

#include "cavalry_i18n_input_policy.h"

namespace cavalry_i18n {

inline constexpr char kFastQuickAddOwnerClass[] =
    "cavalry::FastQuickAddWindow";
inline constexpr char kQuickAddOwnerClass[] = "QuickAddWindow";
inline constexpr char kFastQuickAddSearchBarClass[] = "SearchBar";
inline constexpr char kFastQuickAddWidgetClass[] = "Widget";

inline bool isExactOwner(
    const QObject *candidate,
    const char *className) noexcept
{
    return candidate != nullptr
        && candidate->inherits(className)
        && QByteArray(candidate->metaObject()->className())
            == QByteArray(className);
}

inline const QObject *findExactOwner(
    const QObject *object,
    const char *className) noexcept
{
    for (const QObject *candidate = object; candidate != nullptr;
         candidate = candidate->parent()) {
        if (isExactOwner(candidate, className)) {
            return candidate;
        }
    }
    return nullptr;
}

inline bool hasExactFastQuickAddOwner(const QObject *object) noexcept
{
    return findExactOwner(object, kFastQuickAddOwnerClass) != nullptr;
}

inline bool hasExactQuickAddOwner(const QObject *object) noexcept
{
    for (const QObject *candidate = object; candidate != nullptr;
         candidate = candidate->parent()) {
        if (isExactOwner(candidate, kFastQuickAddOwnerClass)
            || isExactOwner(candidate, kQuickAddOwnerClass)) {
            return true;
        }
    }
    return false;
}

inline bool hasFastQuickAddAncestor(
    const QObject *object,
    const char *className) noexcept
{
    for (const QObject *candidate = object; candidate != nullptr;
         candidate = candidate->parent()) {
        if (candidate->inherits(className)) {
            return true;
        }
    }
    return false;
}

inline bool isQuickAddSearchBox(const QLineEdit *lineEdit) noexcept
{
    if (lineEdit == nullptr
        || !preservesCompleterInputValue(lineEdit)
        || !hasFastQuickAddAncestor(lineEdit, kFastQuickAddSearchBarClass)
        || !hasExactQuickAddOwner(lineEdit)) {
        return false;
    }

    return hasFastQuickAddAncestor(lineEdit, kFastQuickAddWidgetClass);
}

inline bool isFastQuickAddView(const QAbstractItemView *view) noexcept
{
    // FastQuickAdd 的原生 category view 是 QListView；owner 不能替代 view 类型门。
    return view != nullptr
        && qobject_cast<const QListView *>(view) != nullptr
        && hasExactFastQuickAddOwner(view);
}

inline QLineEdit *findFastQuickAddSearchBox(
    const QAbstractItemView *view)
{
    if (!isFastQuickAddView(view)) {
        return nullptr;
    }

    const QObject *owner = findExactOwner(view, kFastQuickAddOwnerClass);
    if (owner == nullptr) {
        return nullptr;
    }

    QLineEdit *match = nullptr;
    for (QLineEdit *lineEdit : owner->findChildren<QLineEdit *>()) {
        if (!isQuickAddSearchBox(lineEdit)
            || findExactOwner(lineEdit, kFastQuickAddOwnerClass) != owner) {
            continue;
        }
        if (match != nullptr) {
            return nullptr;
        }
        match = lineEdit;
    }
    return match;
}

} // namespace cavalry_i18n
