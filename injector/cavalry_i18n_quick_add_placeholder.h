/**
 * [INPUT]: 依赖 Classic exact owner 判定、Qt QListWidget/viewport 与平台验证后的 placeholder 读写回调
 * [OUTPUT]: 提供仅将 Classic 原厂 No Results 投影为译文的无缓存幂等策略
 * [POS]: Quick Add 空结果显示边界；平台拥有 ABI，策略不扫描候选、不调度绘制、不触碰模型与输入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include "cavalry_i18n_classic_search.h"

namespace cavalry_i18n {
struct QuickAddPlaceholderApi {
    QString (*read)(const QListWidget *) = nullptr;
    void (*write)(QListWidget *, const QString &) = nullptr;
};
inline QListWidget *quickAddPlaceholderList(QWidget *surface) noexcept
{
    if (surface == nullptr) return nullptr;
    auto *list = qobject_cast<QListWidget *>(surface);
    if (list == nullptr) {
        list = qobject_cast<QListWidget *>(surface->parent());
        if (list == nullptr || list->viewport() != surface) return nullptr;
    }
    return isClassicQuickAddListWidget(list) ? list : nullptr;
}
inline bool translateQuickAddPlaceholder(
    QWidget *surface, const QString &translated, QuickAddPlaceholderApi api)
{
    if (translated.isEmpty() || translated == QStringLiteral("No Results")
        || api.read == nullptr || api.write == nullptr) return false;
    QListWidget *list = quickAddPlaceholderList(surface);
    if (list == nullptr || api.read(list) != QStringLiteral("No Results")) return false;
    // 当前 vendor 字段本身即幂等凭据：译文不再触发 setter；原厂再次写英文后自然允许更新。
    api.write(list, translated);
    return true;
}
} // namespace cavalry_i18n
