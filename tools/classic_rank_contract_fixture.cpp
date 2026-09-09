/**
 * [INPUT]: 依赖 cavalry_i18n_classic_rank.h 及其 Classic 搜索上下文、Qt 6.6.3 QListWidget/QLineEdit 公共 API 与可控 vendor item 评分回调
 * [OUTPUT]: 对外提供不触碰真实 Cavalry 的 Classic Quick Add 排序合同；验证本地化标题 exact 命中只在原厂 layout 排序期间借用 1000 分，随后经持久索引恢复原值
 * [POS]: tools 的 Classic 排序 vendor-free 回归；与已有 alias 投影同时挂接，覆盖中英/繁中/日语、碰撞、clear/English、自动排序、删除/reset、幂等与 ABI fail-closed
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_classic_rank.h"

#include <QtCore/QVariant>
#include <QtWidgets/QApplication>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QListWidget>
#include <QtWidgets/QVBoxLayout>

#include <cstdio>

class QuickAddWindow final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

class Widget : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

class SearchBar final : public Widget {
    Q_OBJECT
public:
    using Widget::Widget;
};

class CompleterLineEdit final : public QLineEdit {
    Q_OBJECT
public:
    using QLineEdit::QLineEdit;
};

class ListWidget final : public QListWidget {
    Q_OBJECT
public:
    using QListWidget::QListWidget;
};

class VendorItem final : public QListWidgetItem {
public:
    VendorItem(QString source, QString id, int rank, bool supportsRank = true)
        : QListWidgetItem(std::move(source))
        , identity(std::move(id))
        , priority(rank)
        , sortsByPriority(supportsRank)
    {
        setData(Qt::UserRole, QStringLiteral("opaque:") + identity);
        setData(Qt::UserRole + 1, QStringLiteral("stable-role"));
    }

    bool operator<(const QListWidgetItem &other) const override
    {
        const auto *rhs = dynamic_cast<const VendorItem *>(&other);
        if (rhs == nullptr || priority == rhs->priority) {
            return QListWidgetItem::operator<(other);
        }
        // 模拟原厂 comparator：分数越高越靠前；helper 只借用该分数。
        return priority > rhs->priority;
    }

    QString identity;
    int priority;
    bool sortsByPriority;
};

namespace {

bool accepts(const QListWidgetItem *item)
{
    return dynamic_cast<const VendorItem *>(item) != nullptr;
}

int getPriority(const QListWidgetItem *item)
{
    const auto *vendor = dynamic_cast<const VendorItem *>(item);
    return vendor == nullptr ? 0 : vendor->priority;
}

void setPriority(QListWidgetItem *item, int value)
{
    auto *vendor = dynamic_cast<VendorItem *>(item);
    if (vendor != nullptr) {
        vendor->priority = value;
    }
}

bool sortsByPriority(const QListWidgetItem *item)
{
    const auto *vendor = dynamic_cast<const VendorItem *>(item);
    return vendor != nullptr && vendor->sortsByPriority;
}

QStringList aliasesFor(const QString &language, const QString &source)
{
    if (source == QStringLiteral("Text")) {
        if (language == QStringLiteral("zh-Hans")) return {QStringLiteral("文本")};
        if (language == QStringLiteral("zh-Hant")) return {QStringLiteral("文字")};
        if (language == QStringLiteral("ja_JP")) return {QStringLiteral("テキスト")};
    }
    if (source == QStringLiteral("Box")) {
        if (language == QStringLiteral("zh-Hans")) return {QStringLiteral("盒")};
        if (language == QStringLiteral("zh-Hant")) return {QStringLiteral("盒")};
        if (language == QStringLiteral("ja_JP")) return {QStringLiteral("ボックス")};
    }
    if (source == QStringLiteral("Collision A")
        || source == QStringLiteral("Collision B")) {
        return {QStringLiteral("共同")};
    }
    return {};
}

bool require(bool condition, const char *expression, int line)
{
    if (condition) return true;
    std::fprintf(stderr, "classic_rank_contract_fixture: %s (line %d)\n",
        expression, line);
    return false;
}

#define REQUIRE(expression) \
    do { \
        if (!require((expression), #expression, __LINE__)) return 1; \
    } while (false)

VendorItem *addItem(ListWidget *list, const QString &source,
    const QString &identity, int priority, bool supportsRank = true)
{
    auto *item = new VendorItem(source, identity, priority, supportsRank);
    list->addItem(item);
    return item;
}

QVector<QString> identities(const ListWidget *list)
{
    QVector<QString> result;
    for (int row = 0; row < list->count(); ++row) {
        const auto *item = dynamic_cast<const VendorItem *>(list->item(row));
        result.append(item == nullptr ? QString() : item->identity);
    }
    return result;
}

void emitLayout(QListWidget *list)
{
    QAbstractItemModel *model = list->model();
    Q_EMIT model->layoutAboutToBeChanged();
    Q_EMIT model->layoutChanged();
}

} // namespace

int main(int argc, char **argv)
{
    QApplication application(argc, argv);
    application.setQuitOnLastWindowClosed(false);

    QuickAddWindow owner;
    auto *outer = new Widget(&owner);
    auto *outerLayout = new QVBoxLayout(outer);
    auto *list = new ListWidget(outer);
    outerLayout->addWidget(list);
    auto *searchBar = new SearchBar(&owner);
    auto *search = new CompleterLineEdit(searchBar);

    // Exact owner/list/search guard；同名的非 attachment child 不能吞掉幂等挂接。
    auto *decoy = new QObject(list);
    decoy->setObjectName(QString::fromLatin1(
        cavalry_i18n::kClassicQuickAddPriorityAttachmentName));
    REQUIRE(cavalry_i18n::isClassicQuickAddListWidget(list));
    REQUIRE(cavalry_i18n::findClassicQuickAddSearchBox(list) == search);

    auto *text = addItem(list, QStringLiteral("Text"), QStringLiteral("text"), 20);
    auto *box = addItem(list, QStringLiteral("Box"), QStringLiteral("box"), 30);
    auto *collisionA = addItem(list, QStringLiteral("Collision A"),
        QStringLiteral("collision-a"), 40);
    auto *collisionB = addItem(list, QStringLiteral("Collision B"),
        QStringLiteral("collision-b"), 50);
    auto *vendorNoRank = addItem(list, QStringLiteral("No Rank"),
        QStringLiteral("no-rank"), 60, false);
    auto *alreadyExact = addItem(list, QStringLiteral("Already Exact"),
        QStringLiteral("already-exact"), 1000);
    auto *aboveExact = addItem(list, QStringLiteral("Above Exact"),
        QStringLiteral("above-exact"), 1200);

    QString language = QStringLiteral("zh-Hans");
    const auto aliases = [&language](const QString &source) {
        return aliasesFor(language, source);
    };
    auto *aliasAttachment = cavalry_i18n::attachClassicQuickAddAliases(
        list, aliases);
    REQUIRE(aliasAttachment != nullptr);
    const cavalry_i18n::ClassicQuickAddPriorityApi api{
        accepts, getPriority, setPriority, sortsByPriority};
    auto *priority = cavalry_i18n::attachClassicQuickAddPriority(
        list, aliases, api);
    REQUIRE(priority != nullptr);
    REQUIRE(cavalry_i18n::attachClassicQuickAddPriority(list, aliases, api)
        == priority);

    const QVariant textRole = text->data(Qt::UserRole);
    const QVariant boxRole = box->data(Qt::UserRole);
    const QVector<QString> initialOrder = identities(list);

    // English source and clear query are intentionally not localized-title hits.
    language = QStringLiteral("en");
    search->setText(QStringLiteral("Text"));
    emitLayout(list);
    REQUIRE(text->priority == 20);
    search->clear();
    emitLayout(list);
    REQUIRE(text->priority == 20);

    // Three target languages: exact alias gets the temporary rank, then restores.
    for (const QString &locale : {QStringLiteral("zh-Hans"),
                                  QStringLiteral("zh-Hant"),
                                  QStringLiteral("ja_JP")}) {
        language = locale;
        const QString query = aliasesFor(locale, QStringLiteral("Text")).constFirst();
        search->setText(query);
        list->sortItems(Qt::AscendingOrder);
        // 已有 1000/以上分数属于原厂状态，不能被覆盖；本次命中只须越过较低分项。
        REQUIRE(list->row(text) < list->row(box));
        REQUIRE(list->row(text) < list->row(collisionA));
        REQUIRE(text->priority == 20);
        REQUIRE(box->priority == 30);
        REQUIRE(alreadyExact->priority == 1000);
        REQUIRE(aboveExact->priority == 1200);
        REQUIRE(text->data(Qt::UserRole) == textRole);
        REQUIRE(box->data(Qt::UserRole) == boxRole);
    }

    // Two items may share one localized alias; both are valid exact matches.
    language = QStringLiteral("zh-Hans");
    search->setText(QStringLiteral("共同"));
    list->sortItems(Qt::AscendingOrder);
    REQUIRE(list->row(collisionA) < list->row(vendorNoRank));
    REQUIRE(list->row(collisionB) < list->row(vendorNoRank));
    REQUIRE(collisionA->priority == 40);
    REQUIRE(collisionB->priority == 50);
    REQUIRE(vendorNoRank->priority == 60);

    // Nested layout signals must restore only the borrowed 1000 values.
    language = QStringLiteral("zh-Hans");
    search->setText(QStringLiteral("文本"));
    QAbstractItemModel *model = list->model();
    Q_EMIT model->layoutAboutToBeChanged();
    Q_EMIT model->layoutAboutToBeChanged();
    REQUIRE(text->priority == cavalry_i18n::kClassicQuickAddExactTitlePriority);
    Q_EMIT model->layoutChanged();
    REQUIRE(text->priority == cavalry_i18n::kClassicQuickAddExactTitlePriority);
    Q_EMIT model->layoutChanged();
    REQUIRE(text->priority == 20);

    // autoSorting and a vendor item without priority comparator fail open.
    list->setSortingEnabled(true);
    search->setText(QStringLiteral("盒"));
    emitLayout(list);
    REQUIRE(box->priority == 30);
    list->setSortingEnabled(false);
    search->setText(QStringLiteral("no rank"));
    emitLayout(list);
    REQUIRE(vendorNoRank->priority == 60);

    // Deletion/reset must not dereference stale indexes or leak a borrowed rank.
    search->setText(QStringLiteral("共同"));
    Q_EMIT model->layoutAboutToBeChanged();
    REQUIRE(collisionB->priority == cavalry_i18n::kClassicQuickAddExactTitlePriority);
    delete list->takeItem(list->row(collisionB));
    REQUIRE(collisionA->priority == 40);
    list->clear();
    REQUIRE(list->count() == 0);
    REQUIRE(initialOrder.size() > 0);

    // Empty API is fail-closed; no runtime hook is installed for unknown ABI.
    auto *unknownList = new ListWidget(&owner);
    auto *unknownBar = new SearchBar(&owner);
    auto *unknownSearch = new CompleterLineEdit(unknownBar);
    Q_UNUSED(unknownSearch);
    const cavalry_i18n::ClassicQuickAddPriorityApi unknownApi{};
    REQUIRE(cavalry_i18n::attachClassicQuickAddPriority(
                unknownList, aliases, unknownApi)
            == nullptr);

    delete priority;
    delete aliasAttachment;
    return 0;
}

#include "classic_rank_contract_fixture.moc"
