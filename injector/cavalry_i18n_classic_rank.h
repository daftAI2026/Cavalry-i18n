/**
 * [INPUT]: 依赖 Classic 搜索的 exact owner/唯一输入框、query 清理与当前语言标题别名，Qt 持久索引及平台已验证的 ListItem 评分接口
 * [OUTPUT]: 对外提供幂等 attachClassicQuickAddPriority；仅在原厂显式排序期间按原厂 1000 exact / 900-UTF8-byte-length prefix 分级提升本地标题，随后归还原分数，不触发额外排序
 * [POS]: injector 的共享 Classic 排序补充；不改查询、model role、创建身份或 Fast 搜索，平台独自承担映像/类型/ABI 校验，未知环境保持原厂行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "cavalry_i18n_classic_search.h"

namespace cavalry_i18n {

// 平台必须先验证已加载映像与 primary-base ABI；共享策略不读取私有字段。
struct ClassicQuickAddPriorityApi {
    bool (*accepts)(const QListWidgetItem *) = nullptr;
    int (*get)(const QListWidgetItem *) = nullptr;
    void (*set)(QListWidgetItem *, int) = nullptr;
    bool (*sortsByPriority)(const QListWidgetItem *) = nullptr;

    explicit operator bool() const noexcept
    {
        return accepts && get && set && sortsByPriority;
    }
};

inline constexpr int kClassicQuickAddExactTitlePriority = 1000;
inline constexpr int kClassicQuickAddPartialTitlePriority = 900;
inline constexpr char kClassicQuickAddPriorityAttachmentName[] =
    "cavalry_i18n_classic_quick_add_priority_attachment";

class ClassicQuickAddPriorityAttachment final : public QObject {
public:
    ClassicQuickAddPriorityAttachment(QListWidget *list,
        ClassicQuickAddAliasProvider aliases, ClassicQuickAddPriorityApi api)
        : QObject(list), list_(list), model_(list->model()),
          aliases_(std::move(aliases)), api_(api)
    {
        setObjectName(QString::fromLatin1(kClassicQuickAddPriorityAttachmentName));
        QObject::connect(model_, &QAbstractItemModel::layoutAboutToBeChanged,
            this, [this] { beginSort(); });
        QObject::connect(model_, &QAbstractItemModel::layoutChanged,
            this, [this] {
                if (depth_ > 0 && --depth_ == 0) restore();
            });
        QObject::connect(model_, &QAbstractItemModel::rowsAboutToBeRemoved,
            this, [this] { restore(); });
        QObject::connect(model_, &QAbstractItemModel::modelAboutToBeReset,
            this, [this] { restore(); });
    }

    ~ClassicQuickAddPriorityAttachment() override { restore(); }

    void setProviders(ClassicQuickAddAliasProvider aliases,
        ClassicQuickAddPriorityApi api)
    {
        // 既有 provider 可能由同一翻译遍历重复提供；不刷新、不排序、不建第二份索引。
        // 当前借用尚未归还时不替换 API，避免使用另一映像的接口恢复。
        if (depth_ != 0) return;
        aliases_ = std::move(aliases);
        api_ = api;
    }

private:
    struct BorrowedPriority {
        QPersistentModelIndex index;
        int original;
        int applied;
    };

    bool ownsModel() const
    {
        return list_ && model_ && list_->model() == model_;
    }

    void beginSort()
    {
        if (++depth_ != 1 || !api_ || !aliases_ || !ownsModel()
            || !isClassicQuickAddListWidget(list_) || list_->isSortingEnabled()) {
            return;
        }
        // 排序后恢复分数会使行序不再满足常驻 comparator；自动排序/插入模式必须回退。
        QLineEdit *search = findClassicQuickAddSearchBox(list_);
        if (search == nullptr) return;
        const QString query = cleanClassicQuickAddQuery(search->text());
        if (query.isEmpty()) return;

        // 只随原厂实际排序读取当前数据；没有 textChanged 轮询或易陈旧的 item 指针缓存。
        for (int row = 0; row < list_->count(); ++row) {
            QListWidgetItem *item = list_->item(row);
            if (!item || !api_.accepts(item) || !api_.sortsByPriority(item)) continue;
            const QString source = item->text().section(classicQuickAddAliasSeparator(), 0, 0);
            if (cleanClassicQuickAddQuery(source) == query) continue;
            const int desired = localizedTitlePriority(source, aliases_(source), query);
            if (desired <= 0) continue;
            const int original = api_.get(item);
            if (original >= desired) continue;
            borrowed_.append({QPersistentModelIndex(list_->indexFromItem(item)), original, desired});
            api_.set(item, desired);
        }
    }

    static int localizedTitlePriority(
        const QString &source,
        const QStringList &aliases,
        const QString &query)
    {
        const QByteArray normalizedQuery = cleanClassicQuickAddQueryUtf8(query);
        if (normalizedQuery.isEmpty()) return 0;
        const QByteArray normalizedSource = cleanClassicQuickAddQueryUtf8(source);
        int best = 0;

        // 保留 source 已经命中时的原厂 English prefix 分数；完整本地
        // alias 仍可按既有合同升级为 exact 1000。
        for (const QString &rawAlias : aliases) {
            if (rawAlias.contains(classicQuickAddAliasSeparator())) continue;
            const QByteArray normalizedAlias = cleanClassicQuickAddQueryUtf8(rawAlias);
            if (normalizedAlias.isEmpty() || normalizedAlias == normalizedSource) {
                continue;
            }
            if (normalizedAlias == normalizedQuery) {
                return kClassicQuickAddExactTitlePriority;
            }
        }
        // vendor 在 prefix 分支前拒绝小于 3 byte 的 query；exact 分支
        // 已在上面保留，避免改变原厂短 query 的默认排序。
        if (normalizedQuery.size() < 3) return 0;
        if (normalizedSource.startsWith(normalizedQuery)) return 0;

        for (const QString &rawAlias : aliases) {
            if (rawAlias.contains(classicQuickAddAliasSeparator())) continue;
            const QByteArray normalizedAlias = cleanClassicQuickAddQueryUtf8(rawAlias);
            if (normalizedAlias.isEmpty() || normalizedAlias == normalizedSource) {
                continue;
            }
            if (!normalizedAlias.startsWith(normalizedQuery)) continue;

            // 原厂 prefix 分支写入 900 - normalized UTF-8 byte length；保留
            // 该分级语义，避免把任意 alias subsequence 冒充标题前缀。
            const qsizetype length = normalizedAlias.size();
            if (length >= kClassicQuickAddPartialTitlePriority) continue;
            best = qMax(
                best,
                kClassicQuickAddPartialTitlePriority
                    - static_cast<int>(length));
        }
        return best;
    }

    void restore()
    {
        if (ownsModel() && api_) {
            for (const BorrowedPriority &entry : borrowed_) {
                if (!entry.index.isValid() || entry.index.model() != model_) continue;
                QListWidgetItem *item = list_->itemFromIndex(entry.index);
                // 其他原厂回调已接管分数时不覆盖；删除/reset 后失效的索引不解引用。
                if (item && api_.accepts(item)
                    && api_.get(item) == entry.applied) {
                    api_.set(item, entry.original);
                }
            }
        }
        borrowed_.clear();
    }

    QPointer<QListWidget> list_;
    QPointer<QAbstractItemModel> model_;
    ClassicQuickAddAliasProvider aliases_;
    ClassicQuickAddPriorityApi api_;
    QVector<BorrowedPriority> borrowed_;
    int depth_ = 0;
};

inline QObject *attachClassicQuickAddPriority(QListWidget *list,
    ClassicQuickAddAliasProvider aliases, ClassicQuickAddPriorityApi api)
{
    if (!isClassicQuickAddListWidget(list) || !list->model()
        || !findClassicQuickAddSearchBox(list)) return nullptr;

    for (QObject *child : list->children()) {
        if (child->objectName()
            != QString::fromLatin1(kClassicQuickAddPriorityAttachmentName)) continue;
        if (auto *attachment = dynamic_cast<ClassicQuickAddPriorityAttachment *>(child)) {
            attachment->setProviders(std::move(aliases), api);
            return attachment;
        }
    }
    if (!api || !aliases) return nullptr;
    return new ClassicQuickAddPriorityAttachment(list, std::move(aliases), api);
}

} // namespace cavalry_i18n
