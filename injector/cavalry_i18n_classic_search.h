/**
 * [INPUT]: 依赖 cavalry_i18n_quick_add_context.h 的共享 Quick Add 搜索框 guard、Qt 6 QListWidget/QListWidgetItem/QLabel/QLineEdit 公共 API、exact QuickAddWindow/ListWidget 父链和注入方提供的标题、别名、说明反查函数
 * [OUTPUT]: 对外提供 Classic QListWidget 的 DisplayRole 标题别名与按 query 命中的说明 token 投影、独立 itemWidget 标题显示投影、逐视图持久索引缓存与动态生命周期安全的幂等挂接入口；role0 使用 U+FFFE 合并分隔符保持 Qt localeAwareCompare 的原文前缀顺序
 * [POS]: injector 的 Classic Add Layer 双语搜索边界；只在 exact QuickAddWindow 下的 vendor ListWidget 生效，说明只从公开 QLabel 反查为 side data，并在原生 strong-match 命中当前清理 query 时追加该 query token，不改说明标签、command/flags 或未知 UserRole，不依赖私有 Qt 偏移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QAbstractItemModel>
#include <QtCore/QByteArray>
#include <QtCore/QPersistentModelIndex>
#include <QtCore/QPointer>
#include <QtCore/QTimer>
#include <QtCore/QStringList>
#include <QtCore/QVector>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QListWidget>

#include "cavalry_i18n_quick_add_context.h"

#include <algorithm>
#include <functional>
#include <utility>

namespace cavalry_i18n {

inline constexpr char kClassicQuickAddOwnerClass[] = "QuickAddWindow";
inline constexpr char kClassicQuickAddListWidgetClass[] = "ListWidget";
inline constexpr char kClassicQuickAddAttachmentName[] =
    "cavalry_i18n_classic_quick_add_search_attachment";

/*
 * +--------------------------------------------------------------------+
 * | U+FFFE 是 collation merge separator；它让 alias 投影仍按 source 的 |
 * | localeAwareCompare 排序，而普通控制符会在 source 前缀处丢失边界。 |
 * +--------------------------------------------------------------------+
 */
inline constexpr char16_t kClassicQuickAddAliasSeparator = 0xfffe;

using ClassicQuickAddAliasProvider =
    std::function<QStringList(const QString &)>;
using ClassicQuickAddTitleProvider =
    std::function<QString(const QString &)>;
// 输入 itemWidget QLabel 的完整当前说明文本，输出仅供 query 匹配的英文 side data。
using ClassicQuickAddDescriptionAliasProvider =
    std::function<QStringList(const QString &)>;

inline QChar classicQuickAddAliasSeparator() noexcept
{
    return QChar(kClassicQuickAddAliasSeparator);
}

inline bool hasExactClassicQuickAddOwner(const QObject *object) noexcept
{
    for (const QObject *candidate = object; candidate != nullptr;
         candidate = candidate->parent()) {
        if (candidate->inherits(kClassicQuickAddOwnerClass)
            && QByteArray(candidate->metaObject()->className())
                == QByteArray(kClassicQuickAddOwnerClass)) {
            return true;
        }
    }
    return false;
}

inline QObject *findExactClassicQuickAddOwner(QObject *object) noexcept
{
    for (QObject *candidate = object; candidate != nullptr;
         candidate = candidate->parent()) {
        if (candidate->inherits(kClassicQuickAddOwnerClass)
            && QByteArray(candidate->metaObject()->className())
                == QByteArray(kClassicQuickAddOwnerClass)) {
            return candidate;
        }
    }
    return nullptr;
}

inline bool isClassicQuickAddListWidget(const QListWidget *listWidget) noexcept
{
    return listWidget != nullptr
        && QByteArray(listWidget->metaObject()->className())
            == QByteArray(kClassicQuickAddListWidgetClass)
        && hasExactClassicQuickAddOwner(listWidget);
}

inline QLineEdit *findClassicQuickAddSearchBox(
    QListWidget *listWidget)
{
    if (!isClassicQuickAddListWidget(listWidget)) {
        return nullptr;
    }

    QObject *owner = findExactClassicQuickAddOwner(listWidget);
    if (owner == nullptr) {
        return nullptr;
    }

    QLineEdit *match = nullptr;
    for (QLineEdit *lineEdit : owner->findChildren<QLineEdit *>()) {
        if (!isQuickAddSearchBox(lineEdit)
            || findExactClassicQuickAddOwner(lineEdit) != owner) {
            continue;
        }
        if (match != nullptr) {
            // 共享 owner 下不唯一即 fail-closed，避免误接其他搜索输入。
            return nullptr;
        }
        match = lineEdit;
    }
    return match;
}

/*
 * +--------------------------------------------------------------------+
 * | vendor updateFilter 的 query 清理：simplified、移除 ASCII 空格， |
 * | 再移除 regex `[-[\]{}()*+?.,\^$|#\s]`；UTF-8 非 ASCII 字节保留。 |
 * +--------------------------------------------------------------------+
 */
inline QByteArray cleanClassicQuickAddQueryUtf8(const QString &query)
{
    const QByteArray normalized = query.simplified().toLower().toUtf8();
    QByteArray cleaned;
    cleaned.reserve(normalized.size());
    for (const unsigned char byte : normalized) {
        const bool asciiWhitespace =
            byte < 0x80 && (byte == ' ' || byte == '\t' || byte == '\n'
                            || byte == '\r' || byte == '\f' || byte == '\v');
        const bool regexPunctuation =
            byte == '-' || byte == '[' || byte == ']' || byte == '{'
            || byte == '}' || byte == '(' || byte == ')' || byte == '*'
            || byte == '+' || byte == '?' || byte == '.' || byte == ','
            || byte == '^' || byte == '$' || byte == '|' || byte == '#';
        if (!asciiWhitespace && !regexPunctuation) {
            cleaned.append(char(byte));
        }
    }
    return cleaned;
}

inline QString cleanClassicQuickAddQuery(const QString &query)
{
    return QString::fromUtf8(cleanClassicQuickAddQueryUtf8(query));
}

inline bool classicQuickAddDescriptionMatchesQuery(
    const QString &description,
    const QString &cleanedQuery)
{
    if (cleanedQuery.isEmpty()) {
        return false;
    }
    const QByteArray lowerDescription = description.toLower().toUtf8();
    return lowerDescription.contains(cleanedQuery.toUtf8());
}

inline bool classicQuickAddAliasMatchesQuery(
    const QString &alias,
    const QString &cleanedQuery)
{
    if (cleanedQuery.isEmpty()) {
        return false;
    }

    const QString foldedAlias = alias.toLower();
    // +----------------------------------------------------------------+
    // | filterStringMatch 的 regex 失败分支按顺序 memchr，下一轮从上次 |
    // | 命中位置继续（故不加一，重复字符可复用）；用 code point 复刻，|
    // | 避免把 UTF-8 的半个多字节字符当成可独立命中的 token。        |
    // +----------------------------------------------------------------+
    qsizetype candidatePosition = 0;
    for (qsizetype offset = 0; offset < cleanedQuery.size();) {
        const QChar high = cleanedQuery.at(offset++);
        char32_t codePoint = high.unicode();
        if (high.isHighSurrogate() && offset < cleanedQuery.size()) {
            const QChar low = cleanedQuery.at(offset);
            if (low.isLowSurrogate()) {
                ++offset;
                codePoint = static_cast<char32_t>(
                    QChar::surrogateToUcs4(high, low));
            }
        }
        const QString needle = QString::fromUcs4(&codePoint, 1);
        const qsizetype match = foldedAlias.indexOf(needle, candidatePosition);
        if (match < 0) {
            return false;
        }
        candidatePosition = match;
    }
    return true;
}

inline QString projectClassicQuickAddDisplayText(
    const QString &source,
    const QStringList &aliases)
{
    const QChar separator = classicQuickAddAliasSeparator();
    if (source.contains(separator)) {
        return source;
    }

    QString projected = source;
    QStringList accepted;
    for (const QString &rawAlias : aliases) {
        const QString alias = rawAlias.trimmed();
        if (alias.isEmpty() || alias.contains(separator)
            || alias == source || accepted.contains(alias)) {
            continue;
        }
        projected += separator;
        projected += alias;
        accepted.append(alias);
    }
    return projected;
}

class ClassicQuickAddSearchAttachment final : public QObject {
public:
    ClassicQuickAddSearchAttachment(
        QListWidget *listWidget,
        ClassicQuickAddAliasProvider aliasProvider,
        ClassicQuickAddTitleProvider titleProvider,
        ClassicQuickAddDescriptionAliasProvider descriptionAliasProvider = {})
        : QObject(listWidget)
        , listWidget_(listWidget)
        , aliasProvider_(std::move(aliasProvider))
        , titleProvider_(std::move(titleProvider))
        , descriptionAliasProvider_(std::move(descriptionAliasProvider))
    {
        setObjectName(QString::fromLatin1(kClassicQuickAddAttachmentName));

        QAbstractItemModel *model = listWidget_->model();
        if (model == nullptr) {
            return;
        }

        QObject::connect(
            model,
            &QAbstractItemModel::rowsInserted,
            this,
            [this](const QModelIndex &, int, int) {
                refresh();
                scheduleRefresh();
            });
        QObject::connect(
            model,
            &QAbstractItemModel::rowsRemoved,
            this,
            [this](const QModelIndex &, int, int) {
                refresh();
            });
        QObject::connect(
            model,
            &QAbstractItemModel::modelReset,
            this,
            [this] {
                refresh();
                scheduleRefresh();
            });
        QObject::connect(
            model,
            &QAbstractItemModel::layoutChanged,
            this,
            [this](const QList<QPersistentModelIndex> &,
                   QAbstractItemModel::LayoutChangeHint) {
                refresh();
                scheduleRefresh();
            });
        QObject::connect(
            model,
            &QAbstractItemModel::dataChanged,
            this,
            [this](const QModelIndex &,
                   const QModelIndex &,
                   const QList<int> &roles) {
                if (roles.isEmpty() || roles.contains(Qt::DisplayRole)
                    || roles.contains(Qt::EditRole)) {
                    refresh();
                }
            });
    }

    void setProviders(
        ClassicQuickAddAliasProvider aliasProvider,
        ClassicQuickAddTitleProvider titleProvider,
        ClassicQuickAddDescriptionAliasProvider descriptionAliasProvider = {})
    {
        aliasProvider_ = std::move(aliasProvider);
        titleProvider_ = std::move(titleProvider);
        descriptionAliasProvider_ = std::move(descriptionAliasProvider);
        refresh();
        scheduleRefresh();
    }

    void refresh()
    {
        if (listWidget_.isNull() || refreshing_) {
            return;
        }

        refreshQueued_ = false;
        bindSearchBox();
        refreshing_ = true;
        pruneEntries();
        for (int row = 0; row < listWidget_->count(); ++row) {
            QListWidgetItem *item = listWidget_->item(row);
            if (item == nullptr) {
                continue;
            }
            Entry *entry = ensureEntry(item);
            if (entry != nullptr) {
                applyEntry(*entry);
            }
        }
        refreshing_ = false;
    }

private:
    struct Entry {
        QPersistentModelIndex index;
        QString source;
        QPointer<QLabel> title;
    };

    Entry *ensureEntry(QListWidgetItem *item)
    {
        const QModelIndex index = listWidget_->indexFromItem(item);
        if (!index.isValid()) {
            return nullptr;
        }

        const QPersistentModelIndex persistent(index);
        for (Entry &entry : entries_) {
            if (entry.index == persistent) {
                return &entry;
            }
        }

        QString source = item->text();
        const int separatorIndex =
            source.indexOf(classicQuickAddAliasSeparator());
        if (separatorIndex >= 0) {
            source = source.left(separatorIndex);
        }
        entries_.append(Entry{persistent, source, nullptr});
        return &entries_.last();
    }

    void pruneEntries()
    {
        entries_.erase(
            std::remove_if(
                entries_.begin(),
                entries_.end(),
                [](const Entry &entry) { return !entry.index.isValid(); }),
            entries_.end());
    }

    static bool isDescendant(const QWidget *root, const QWidget *child) noexcept
    {
        for (const QWidget *candidate = child; candidate != nullptr;
             candidate = candidate->parentWidget()) {
            if (candidate == root) {
                return true;
            }
        }
        return false;
    }

    QLabel *findTitleLabel(Entry &entry, QWidget *itemWidget) const
    {
        if (entry.title != nullptr && isDescendant(itemWidget, entry.title)) {
            return entry.title.data();
        }

        const QList<QLabel *> labels = itemWidget->findChildren<QLabel *>();
        QList<QLabel *> matches;
        for (QLabel *label : labels) {
            if (label != nullptr && label->text() == entry.source) {
                matches.append(label);
            }
        }
        if (matches.size() != 1) {
            entry.title = nullptr;
            return nullptr;
        }
        entry.title = matches.constFirst();
        return entry.title.data();
    }

    bool descriptionMatchesQuery(
        QWidget *itemWidget,
        QLabel *title,
        const QString &source) const
    {
        if (descriptionAliasProvider_ == nullptr || itemWidget == nullptr
            || cleanedQuery_.isEmpty()) {
            return false;
        }

        // +----------------------------------------------------------------+
        // | Classic 的说明没有公开 model role；公开 QLabel 只作为精确     |
        // | 反查入口。只有反查出的英文说明命中 vendor 同款 strong-match  |
        // | query 时，给 role0 加当前 query token；未知 QLabel fail-closed。|
        // +----------------------------------------------------------------+
        for (QLabel *label : itemWidget->findChildren<QLabel *>()) {
            if (label == nullptr || label == title || label->text().isEmpty()
                || label->text() == source) {
                continue;
            }
            const QStringList matched = descriptionAliasProvider_(label->text());
            for (const QString &englishDescription : matched) {
                if (classicQuickAddDescriptionMatchesQuery(
                        englishDescription,
                        cleanedQuery_)) {
                    return true;
                }
            }
        }
        return false;
    }

    void applyEntry(Entry &entry)
    {
        QListWidgetItem *item = listWidget_->itemFromIndex(entry.index);
        if (item == nullptr) {
            return;
        }

        QWidget *itemWidget = listWidget_->itemWidget(item);
        QLabel *title = nullptr;
        if (itemWidget != nullptr
            && (titleProvider_ != nullptr
                || descriptionAliasProvider_ != nullptr)) {
            title = findTitleLabel(entry, itemWidget);
        }
        const QPointer<QWidget> guardedItemWidget(itemWidget);
        const QPointer<QLabel> guardedTitle(title);

        QStringList aliases;
        if (aliasProvider_ != nullptr && !cleanedQuery_.isEmpty()) {
            for (const QString &alias : aliasProvider_(entry.source)) {
                const QString normalizedAlias = alias.trimmed();
                if (normalizedAlias.isEmpty() || normalizedAlias == entry.source) {
                    continue;
                }
                if (classicQuickAddAliasMatchesQuery(
                        normalizedAlias,
                        cleanedQuery_)) {
                    aliases.append(cleanedQuery_);
                    break;
                }
            }
        }
        if (descriptionMatchesQuery(itemWidget, title, entry.source)) {
            // 只加入已经由 vendor 清理过的当前 query；不改 QLineEdit 文本。
            aliases.append(cleanedQuery_);
        }
        const QString projected =
            projectClassicQuickAddDisplayText(entry.source, aliases);
        if (item->text() != projected) {
            item->setText(projected);
        }

        if (titleProvider_ == nullptr || guardedItemWidget.isNull()) {
            return;
        }
        if (guardedTitle.isNull()) {
            return;
        }
        const QString translatedTitle = titleProvider_(entry.source);
        if (!translatedTitle.isEmpty()
            && translatedTitle != guardedTitle->text()) {
            guardedTitle->setText(translatedTitle);
        }
    }

    void scheduleRefresh()
    {
        if (refreshQueued_ || listWidget_.isNull()) {
            return;
        }
        refreshQueued_ = true;
        QTimer::singleShot(0, this, [this] {
            refreshQueued_ = false;
            refresh();
        });
    }

    void bindSearchBox()
    {
        if (listWidget_.isNull()) {
            return;
        }

        QLineEdit *candidate = findClassicQuickAddSearchBox(listWidget_);
        if (candidate == searchBox_.data()) {
            query_ = candidate == nullptr ? QString{} : candidate->text();
            cleanedQuery_ = cleanClassicQuickAddQuery(query_);
            return;
        }

        QObject::disconnect(searchBoxConnection_);
        QObject::disconnect(searchBoxDestroyedConnection_);
        searchBoxConnection_ = {};
        searchBoxDestroyedConnection_ = {};
        searchBox_ = candidate;
        query_ = candidate == nullptr ? QString{} : candidate->text();
        cleanedQuery_ = cleanClassicQuickAddQuery(query_);
        if (candidate == nullptr) {
            return;
        }

        searchBoxConnection_ = QObject::connect(
            candidate,
            &QLineEdit::textChanged,
            this,
            [this](const QString &query) {
                query_ = query;
                cleanedQuery_ = cleanClassicQuickAddQuery(query_);
                if (refreshing_) {
                    scheduleRefresh();
                    return;
                }
                refresh();
            });
        searchBoxDestroyedConnection_ = QObject::connect(
            candidate,
            &QObject::destroyed,
            this,
            [this] {
                searchBox_ = nullptr;
                query_.clear();
                cleanedQuery_.clear();
                scheduleRefresh();
            });
    }

    QPointer<QListWidget> listWidget_;
    QVector<Entry> entries_;
    ClassicQuickAddAliasProvider aliasProvider_;
    ClassicQuickAddTitleProvider titleProvider_;
    ClassicQuickAddDescriptionAliasProvider descriptionAliasProvider_;
    QPointer<QLineEdit> searchBox_;
    QMetaObject::Connection searchBoxConnection_;
    QMetaObject::Connection searchBoxDestroyedConnection_;
    QString query_;
    QString cleanedQuery_;
    bool refreshing_ = false;
    bool refreshQueued_ = false;
};

inline ClassicQuickAddSearchAttachment *findClassicQuickAddAttachment(
    QListWidget *listWidget)
{
    if (listWidget == nullptr) {
        return nullptr;
    }

    for (QObject *child : listWidget->children()) {
        if (child->objectName()
                != QString::fromLatin1(kClassicQuickAddAttachmentName)) {
            continue;
        }
        if (auto *attachment =
                dynamic_cast<ClassicQuickAddSearchAttachment *>(child);
            attachment != nullptr) {
            return attachment;
        }
    }
    return nullptr;
}

inline ClassicQuickAddSearchAttachment *attachClassicQuickAddAliases(
    QListWidget *listWidget,
    ClassicQuickAddAliasProvider aliasProvider,
    ClassicQuickAddTitleProvider titleProvider = {},
    ClassicQuickAddDescriptionAliasProvider descriptionAliasProvider = {})
{
    if (!isClassicQuickAddListWidget(listWidget)) {
        return nullptr;
    }

    if (auto *existing = findClassicQuickAddAttachment(listWidget);
        existing != nullptr) {
        existing->setProviders(
            std::move(aliasProvider),
            std::move(titleProvider),
            std::move(descriptionAliasProvider));
        return existing;
    }

    auto *attachment = new ClassicQuickAddSearchAttachment(
        listWidget,
        std::move(aliasProvider),
        std::move(titleProvider),
        std::move(descriptionAliasProvider));
    attachment->refresh();
    return attachment;
}

} // 命名空间 cavalry_i18n
