/**
 * [INPUT]: 依赖 injector/cavalry_i18n_search_policy.h 及其 cavalry_i18n_quick_add_context.h、QT_NO_KEYWORDS 下的 Qt 6.6.3 model/view、FastQuickAddWindow/Model 的本地可控 fixture 与三语 alias 数据
 * [OUTPUT]: 对外提供不触碰真实 Cavalry 的 Quick Add 搜索合同；验证 owner/模型边界、Unicode-safe role 257 过滤、英文+当前语言匹配、role 0/256/其他角色透传、vendor source/index/排序/生命周期
 * [POS]: tools 的 vendor-free 共享搜索回归；只证明 helper 的数据行为和接线前提，不冒充 macOS/Windows 生产 UI 证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "../injector/cavalry_i18n_search_policy.h"
#include <QtCore/QAbstractListModel>
#include <QtCore/QRegularExpression>
#include <QtCore/QVector>
#include <QtGui/QStandardItemModel>
#include <QtWidgets/QApplication>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QListView>
#include <QtWidgets/QStackedWidget>
#include <QtWidgets/QTreeView>
#include <cstdio>
namespace cavalry {
struct FastQuickAddItem {
    int id = 0;
};
} // 命名空间 cavalry
Q_DECLARE_METATYPE(cavalry::FastQuickAddItem)
struct ModelRow {
    QString name;
    QString search;
    QString opaque;
    int id = 0;
};
struct VideoAliasCase {
    const char *source;
    const char *zhHans;
    const char *zhHant;
    const char *jaJp;
};
// 视频回归词条来自现有翻译源；Circle 是正常的模型行，不在生产代码中做词条特判。
constexpr VideoAliasCase kVideoAliasCases[] = {
    {"Text", "文字", "文字", "テキスト"},
    {"Shape", "形状", "形狀", "シェイプ"},
    {"Box", "盒形", "盒形", "ボックス"},
    {"Circle", "圆形", "圓形", "円"},
};
const char *videoAliasCandidate(
    const QString &language,
    const VideoAliasCase &item)
{
    if (language == QStringLiteral("zh-Hans")) {
        return item.zhHans;
    }
    if (language == QStringLiteral("zh-Hant")) {
        return item.zhHant;
    }
    if (language == QStringLiteral("ja_JP")) {
        return item.jaJp;
    }
    return nullptr;
}
QStringList aliasesForLanguage(
    const QString &language,
    const QString &source)
{
    for (const VideoAliasCase &item : kVideoAliasCases) {
        if (source != QString::fromLatin1(item.source)) {
            continue;
        }
        const char *alias = videoAliasCandidate(language, item);
        return alias == nullptr || *alias == '\0'
            ? QStringList{}
            : QStringList{QString::fromUtf8(alias)};
    }
    if (source == QStringLiteral("Add Divisions")
        && language == QStringLiteral("zh-Hans")) {
        return {QStringLiteral("添加分割")};
    }
    if (source == QStringLiteral("Text Shape")) {
        if (language == QStringLiteral("zh-Hans")) {
            return {QStringLiteral("文本形状")};
        }
        if (language == QStringLiteral("zh-Hant")) {
            return {QStringLiteral("文字形狀")};
        }
        if (language == QStringLiteral("ja_JP")) {
            return {QStringLiteral("テキストシェイプ")};
        }
    }
    if (source == QStringLiteral("Alias Pair")
        && language == QStringLiteral("zh-Hans")) {
        return {QStringLiteral("第一候选"), QStringLiteral("第二候选")};
    }
    if (source == QStringLiteral("Fresh Widget")
        && language == QStringLiteral("zh-Hans")) {
        return {QStringLiteral("新鲜部件")};
    }
    if (source == QStringLiteral("Caf\u00e9 Widget")
        && language == QStringLiteral("zh-Hans")) {
        return {QStringLiteral("咖啡部件✨")};
    }
    if (source == QStringLiteral("Combining Widget")
        && language == QStringLiteral("zh-Hans")) {
        return {QStringLiteral("Cafe\u0301 部件")};
    }
    return {};
}
QString candidateAliasForLanguage(
    const QString &language,
    const QString &source)
{
    const QStringList aliases = aliasesForLanguage(language, source);
    return aliases.isEmpty() ? QString() : aliases.constFirst();
}
class ModelFixtureBase : public QAbstractListModel {
public:
    explicit ModelFixtureBase(QObject *parent = nullptr)
        : QAbstractListModel(parent)
    {
    }
    int rowCount(const QModelIndex &parent = QModelIndex()) const override
    {
        return parent.isValid() ? 0 : rows_.size();
    }
    int columnCount(const QModelIndex &parent = QModelIndex()) const override
    {
        return parent.isValid() ? 0 : 1;
    }
    QVariant data(
        const QModelIndex &index,
        int role = Qt::DisplayRole) const override
    {
        if (!index.isValid() || index.row() < 0 || index.row() >= rows_.size()) {
            return {};
        }
        const ModelRow &row = rows_.at(index.row());
        if (role == Qt::DisplayRole || role == Qt::EditRole) {
            return row.name;
        }
        if (role == cavalry_i18n::kFastQuickAddIdentityRole) {
            return QVariant::fromValue(cavalry::FastQuickAddItem{row.id});
        }
        if (role == cavalry_i18n::kFastQuickAddSearchRole) {
            return row.search;
        }
        if (role == 999) {
            return row.opaque;
        }
        return {};
    }
    Qt::ItemFlags flags(const QModelIndex &index) const override
    {
        if (!index.isValid()) {
            return Qt::NoItemFlags;
        }
        return Qt::ItemIsEnabled | Qt::ItemIsSelectable | Qt::ItemIsEditable;
    }

    bool setData(
        const QModelIndex &index,
        const QVariant &value,
        int role = Qt::EditRole) override
    {
        if (!index.isValid() || index.row() < 0 || index.row() >= rows_.size()) {
            return false;
        }

        ModelRow &row = rows_[index.row()];
        if (role == Qt::DisplayRole || role == Qt::EditRole) {
            row.name = value.toString();
        } else if (role == cavalry_i18n::kFastQuickAddSearchRole) {
            row.search = value.toString();
        } else if (role == 999) {
            row.opaque = value.toString();
        } else {
            return false;
        }

        Q_EMIT dataChanged(index, index, {role});
        return true;
    }

    void appendRow(
        const QString &name,
        int id,
        const QString &search = QString(),
        const QString &opaque = QString())
    {
        const int row = rows_.size();
        beginInsertRows(QModelIndex(), row, row);
        rows_.append(ModelRow{name, search.isEmpty() ? name : search, opaque, id});
        endInsertRows();
    }

    void removeRow(int row)
    {
        if (row < 0 || row >= rows_.size()) {
            return;
        }
        beginRemoveRows(QModelIndex(), row, row);
        rows_.removeAt(row);
        endRemoveRows();
    }

private:
    QVector<ModelRow> rows_;
};

void appendNamedRow(
    ModelFixtureBase *model,
    const QString &name,
    int id,
    const char *opaque)
{
    model->appendRow(name, id, name, QString::fromLatin1(opaque));
}

namespace cavalry {

class FastQuickAddModel final : public ModelFixtureBase {
    Q_OBJECT
public:
    using ModelFixtureBase::ModelFixtureBase;
};

} // namespace cavalry

namespace cavalry {

class FastQuickAddWindow final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

} // namespace cavalry

class QuickAddWindow final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

class TabBar final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

class SearchBar final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

class Widget final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

class CompleterLineEdit final : public QLineEdit {
    Q_OBJECT
public:
    using QLineEdit::QLineEdit;
};

// 生产 FastQuickAddProxyModel 的已采证清理：\W 默认不是 Unicode property，CJK query 会被清成空串。
QString vendorFastQuickAddStrip(const QString &value)
{
    static const QRegularExpression separator(QStringLiteral("[\\s\\-_\\W]"));
    return value.toLower().remove(separator);
}

bool vendorFastQuickAddMatches(
    const QString &query,
    const QString &candidate)
{
    const QString normalizedQuery = vendorFastQuickAddStrip(query);
    if (normalizedQuery.isEmpty()) {
        return true;
    }
    qsizetype queryIndex = 0;
    for (const QChar codeUnit : candidate.toLower()) {
        if (codeUnit == normalizedQuery.at(queryIndex)) {
            ++queryIndex;
            if (queryIndex == normalizedQuery.size()) {
                return true;
            }
        }
    }
    return false;
}

namespace cavalry {

class FastQuickAddProxyModel final : public QSortFilterProxyModel {
    Q_OBJECT
public:
    using QSortFilterProxyModel::QSortFilterProxyModel;

protected:
    bool filterAcceptsRow(
        int sourceRow,
        const QModelIndex &sourceParent) const override
    {
        const QAbstractItemModel *model = sourceModel();
        if (model == nullptr) {
            return false;
        }

        const QString query = vendorFastQuickAddStrip(
            filterRegularExpression().pattern());
        if (query.isEmpty()) {
            return true;
        }

        const QModelIndex index = model->index(sourceRow, 0, sourceParent);
        const QString display = model->data(index, Qt::DisplayRole).toString();
        const QString search = model->data(
            index,
            cavalry_i18n::kFastQuickAddSearchRole).toString();
        return vendorFastQuickAddMatches(query, display)
            || vendorFastQuickAddMatches(query, search);
    }

    bool lessThan(
        const QModelIndex &left,
        const QModelIndex &right) const override
    {
        const QAbstractItemModel *model = sourceModel();
        if (model == nullptr) {
            return false;
        }

        const QString leftOriginal = model->data(left, Qt::DisplayRole)
                                         .toString()
                                         .toLower();
        const QString rightOriginal = model->data(right, Qt::DisplayRole)
                                          .toString()
                                          .toLower();
        const QString query = filterRegularExpression().pattern().toLower();
        const QString leftNormalized = vendorFastQuickAddStrip(leftOriginal);
        const QString rightNormalized = vendorFastQuickAddStrip(rightOriginal);
        const QString queryNormalized = vendorFastQuickAddStrip(query);

        // 与 Cavalry 2.7.2 lessThan 的可观测排序保持一致：规范化 exact 优先，再是 query prefix，最后原始 lexical。
        const bool leftExact = leftNormalized == queryNormalized;
        const bool rightExact = rightNormalized == queryNormalized;
        if (leftExact != rightExact) {
            return leftExact;
        }

        const bool leftPrefix = leftOriginal.startsWith(query);
        const bool rightPrefix = rightOriginal.startsWith(query);
        if (leftPrefix != rightPrefix) {
            return leftPrefix;
        }
        return leftOriginal.compare(rightOriginal, Qt::CaseSensitive) < 0;
    }
};

} // namespace cavalry

cavalry::FastQuickAddProxyModel *makeFastQuickAddFilter(
    QObject *parent,
    QAbstractItemModel *source,
    int role = cavalry_i18n::kFastQuickAddSearchRole)
{
    auto *filter = new cavalry::FastQuickAddProxyModel(parent);
    filter->setFilterRole(role);
    filter->setFilterCaseSensitivity(Qt::CaseInsensitive);
    filter->setDynamicSortFilter(true);
    filter->setSourceModel(source);
    return filter;
}

void appendVideoRows(ModelFixtureBase *model, int firstId)
{
    int id = firstId;
    for (const VideoAliasCase &item : kVideoAliasCases) {
        appendNamedRow(model, QString::fromLatin1(item.source), id++, "video-row");
    }
}
int consumeVendorIdentity(const QModelIndex &index)
{
    // doCommand 的实测入口：index.model()->data(index, 256)，不读取 source index 或缓存指针。
    if (!index.isValid() || index.model() == nullptr) {
        return -1;
    }
    const QVariant value = index.model()->data(
        index,
        cavalry_i18n::kFastQuickAddIdentityRole);
    return value.value<cavalry::FastQuickAddItem>().id;
}
bool require(bool condition, const char *expression, int line)
{
    if (condition) {
        return true;
    }
    std::fprintf(stderr, "check_quick_add_search: %s (line %d)\n", expression, line);
    return false;
}
#define REQUIRE(expression) \
    do { \
        if (!require((expression), #expression, __LINE__)) { \
            return 1; \
        } \
    } while (false)
int main(int argc, char **argv)
{
    QApplication application(argc, argv);
    REQUIRE(cavalry_i18n::matchesFastQuickAddSubsequence(QStringLiteral("box+blur"), QStringLiteral("Box Blur")));
    REQUIRE(!cavalry_i18n::matchesFastQuickAddSubsequence(QString::fromUtf8("😀"), QStringLiteral("Box Blur")));
    application.setQuitOnLastWindowClosed(false);
    cavalry::FastQuickAddWindow window;
    auto *tabBar = new TabBar(&window);
    auto *searchBar = new SearchBar(&window);
    auto *widget = new Widget(searchBar);
    auto *lineEdit = new CompleterLineEdit(widget);
    auto *stack = new QStackedWidget(tabBar);
    auto *view = new QListView(stack);
    stack->addWidget(view);
    QuickAddWindow dockWindow;
    auto *dockOuterWidget = new Widget(&dockWindow);
    auto *dockSearchBar = new SearchBar(dockOuterWidget);
    auto *dockSearchWidget = new Widget(dockSearchBar);
    auto *dockLineEdit = new CompleterLineEdit(dockSearchWidget);
    REQUIRE(window.inherits(cavalry_i18n::kFastQuickAddOwnerClass));
    REQUIRE(cavalry_i18n::hasExactFastQuickAddOwner(view));
    REQUIRE(cavalry_i18n::findFastQuickAddSearchBox(view) == lineEdit);
    REQUIRE(cavalry_i18n::hasExactQuickAddOwner(dockLineEdit));
    REQUIRE(!cavalry_i18n::hasExactFastQuickAddOwner(dockLineEdit));
    REQUIRE(cavalry_i18n::isQuickAddSearchBox(lineEdit));
    REQUIRE(cavalry_i18n::isQuickAddSearchBox(dockLineEdit));
    auto *plainLineEdit = new QLineEdit(widget);
    auto *wrongLineEdit = new CompleterLineEdit(&window);
    REQUIRE(!cavalry_i18n::isQuickAddSearchBox(plainLineEdit));
    REQUIRE(!cavalry_i18n::isQuickAddSearchBox(wrongLineEdit));
    auto *treeView = new QTreeView(stack);
    REQUIRE(!cavalry_i18n::isFastQuickAddView(treeView));
    int providerCalls = 0;
    const QString primaryLanguage = QStringLiteral("zh-Hans");
    const cavalry_i18n::FastQuickAddAliasProvider provider =
        [&providerCalls, primaryLanguage](const QString &source) {
            ++providerCalls;
            return aliasesForLanguage(primaryLanguage, source);
        };
    auto *source = new cavalry::FastQuickAddModel(&window);
    appendNamedRow(source, QStringLiteral("Add Divisions"), 1, "opaque-one");
    appendNamedRow(source, QStringLiteral("Other"), 2, "opaque-two");
    appendNamedRow(source, QStringLiteral("Text"), 10, "opaque-text");
    appendNamedRow(source, QStringLiteral("Shape"), 11, "opaque-shape");
    appendNamedRow(source, QStringLiteral("Box"), 12, "opaque-box");
    appendNamedRow(source, QStringLiteral("Circle"), 13, "opaque-circle");
    appendNamedRow(source, QStringLiteral("Text Shape"), 14, "opaque-text-shape");
    appendNamedRow(source, QStringLiteral("Alias Pair"), 15, "opaque-alias-pair");
    appendNamedRow(source, QStringLiteral("Caf\u00e9 Widget"), 16, "opaque-unicode");
    appendNamedRow(source, QStringLiteral("Combining Widget"), 18, "opaque-combining");
    appendNamedRow(source, QStringLiteral("Behaviour Mixer"), 19, "opaque-fuzzy");
    auto *filter = makeFastQuickAddFilter(&window, source);
    view->setModel(filter);
    REQUIRE(cavalry_i18n::isFastQuickAddSourceModel(source));
    REQUIRE(cavalry_i18n::attachFastQuickAddAliases(view, provider, dockLineEdit)
            == nullptr);
    REQUIRE(filter->rowCount() == source->rowCount());
    // 红色对照：原厂清理器把 CJK query 清成空串，故会放行全部行，而不是正确命中 alias。
    filter->setFilterFixedString(QStringLiteral("文本"));
    REQUIRE(vendorFastQuickAddStrip(QStringLiteral("文本")).isEmpty());
    REQUIRE(vendorFastQuickAddStrip(QStringLiteral("text"))
                == QStringLiteral("text"));
    REQUIRE(filter->rowCount() == source->rowCount());
    int sourceModelChangedCount = 0;
    QObject::connect(
        filter,
        &QAbstractProxyModel::sourceModelChanged,
        filter,
        [&sourceModelChangedCount] { ++sourceModelChangedCount; });
    const int callsBeforeAttach = providerCalls;
    lineEdit->setText(QStringLiteral("文本"));
    auto *search = cavalry_i18n::attachFastQuickAddAliases(view, provider);
    REQUIRE(search != nullptr);
    REQUIRE(providerCalls > callsBeforeAttach);
    REQUIRE(sourceModelChangedCount >= 2);
    REQUIRE(filter->sourceModel() == search);
    REQUIRE(search->parent() == filter);
    REQUIRE(search->sourceModel() != nullptr);
    auto *alias = dynamic_cast<cavalry_i18n::FastQuickAddAliasProxy *>(
        search->sourceModel());
    REQUIRE(alias != nullptr);
    REQUIRE(alias->parent() == filter);
    REQUIRE(source->parent() == &window);
    REQUIRE(view->model() == filter);
    REQUIRE(search->rowCount() == 1);
    REQUIRE(filter->rowCount() == 1);
    const QModelIndex searchIndex = search->index(0, 0);
    REQUIRE(search->data(searchIndex, Qt::DisplayRole).toString()
            == QStringLiteral("Text Shape"));
    const QVariant identity = search->data(
        searchIndex,
        cavalry_i18n::kFastQuickAddIdentityRole);
    REQUIRE(identity.metaType().name() != nullptr);
    REQUIRE(QByteArray(identity.metaType().name())
            == QByteArray("cavalry::FastQuickAddItem"));
    REQUIRE(identity.value<cavalry::FastQuickAddItem>().id == 14);
    REQUIRE(search->data(searchIndex, 999).toString()
            == QStringLiteral("opaque-text-shape"));
    REQUIRE(search->flags(searchIndex)
            == source->flags(source->index(6, 0)));
    // Fast doCommand 只消费 vendor view index 的 role 256；外层 vendor 未被替换，selection/currentIndex 保持同构。
    const QModelIndex vendorIndex = filter->index(0, 0);
    view->setCurrentIndex(vendorIndex);
    REQUIRE(view->currentIndex().isValid());
    REQUIRE(view->currentIndex().model() == filter);
    REQUIRE(consumeVendorIdentity(view->currentIndex()) == 14);
    REQUIRE(consumeVendorIdentity(searchIndex) == 14);
    REQUIRE(alias->data(alias->index(6, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Text Shape"));
    REQUIRE(alias->data(alias->index(6, 0), cavalry_i18n::kFastQuickAddSearchRole)
                .toString()
            == QStringLiteral("Text Shape 文本形状"));
    REQUIRE(search->data(searchIndex, cavalry_i18n::kFastQuickAddSearchRole)
                .toString()
                .contains(QStringLiteral("文本")));
    REQUIRE(search->setData(searchIndex, QStringLiteral("opaque-updated"), 999));
    REQUIRE(source->data(source->index(6, 0), 999).toString()
            == QStringLiteral("opaque-updated"));
    // vendor 保持自己的 query/排序；绑定的原始 QLineEdit 驱动 Unicode-safe helper。
    auto setQuery = [&](const QString &query) {
        lineEdit->setText(query);
        filter->setFilterFixedString(query);
    };
    setQuery(QStringLiteral("text"));
    REQUIRE(search->searchText() == QStringLiteral("text"));
    REQUIRE(search->rowCount() == 2);
    lineEdit->setText(QStringLiteral("添加分割"));
    REQUIRE(search->rowCount() == 1);
    REQUIRE(search->data(search->index(0, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Add Divisions"));
    filter->setFilterFixedString(QStringLiteral("添加分割"));
    setQuery(QStringLiteral("TEXT"));
    REQUIRE(search->rowCount() == 2);
    setQuery(QStringLiteral("tex"));
    REQUIRE(search->rowCount() == 2);
    setQuery(QStringLiteral("box"));
    REQUIRE(search->rowCount() == 2);
    REQUIRE(search->data(search->index(0, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Box"));
    REQUIRE(search->data(search->index(1, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Behaviour Mixer"));
    setQuery(QStringLiteral("添加分割"));
    REQUIRE(search->searchText() == QStringLiteral("添加分割"));
    REQUIRE(search->rowCount() == 1);
    REQUIRE(search->data(search->index(0, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Add Divisions"));
    setQuery(QStringLiteral("Circle"));
    REQUIRE(search->rowCount() == 1);
    REQUIRE(search->data(search->index(0, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Circle"));
    setQuery(QStringLiteral("圆形"));
    REQUIRE(search->rowCount() == 1);
    REQUIRE(search->data(search->index(0, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Circle"));
    setQuery(QStringLiteral("圆"));
    REQUIRE(search->rowCount() == 1);
    setQuery(QStringLiteral("形"));
    REQUIRE(search->rowCount() == 4);
    // 多语言与任意新条目均走同一个 provider/filter，不为视频词条写特判。
    setQuery(QStringLiteral("文字"));
    REQUIRE(search->rowCount() == 1);
    setQuery(QStringLiteral("テキスト"));
    REQUIRE(search->rowCount() == 0); // 当前语言是 zh-Hans，日文不是本轮 alias。
    setQuery(QStringLiteral("第一候选"));
    REQUIRE(search->rowCount() == 1);
    setQuery(QStringLiteral("第二候选"));
    REQUIRE(search->rowCount() == 1);
    REQUIRE(alias->data(alias->index(7, 0), cavalry_i18n::kFastQuickAddSearchRole)
                .toString()
                == QStringLiteral("Alias Pair 第一候选 第二候选"));
    setQuery(QStringLiteral("✨"));
    REQUIRE(search->rowCount() == 1);
    setQuery(QStringLiteral("咖啡部件"));
    REQUIRE(search->rowCount() == 1);
    setQuery(QStringLiteral("Cafe\u0301"));
    REQUIRE(search->rowCount() == 2);
    REQUIRE(search->data(search->index(0, 0), Qt::DisplayRole).toString()
                == QStringLiteral("Caf\u00e9 Widget"));
    REQUIRE(search->data(search->index(1, 0), Qt::DisplayRole).toString()
                == QStringLiteral("Combining Widget"));
    setQuery(QString());
    REQUIRE(search->rowCount() == source->rowCount());
    REQUIRE(filter->rowCount() == source->rowCount());
    // vendor lessThan 仍在 view 外层：helper 不复制/重写排序语义，只过滤其 source。
    filter->sort(0, Qt::AscendingOrder);
    REQUIRE(filter->data(filter->index(0, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Add Divisions"));
    auto *attachment = cavalry_i18n::findFastQuickAddAttachment(view);
    REQUIRE(attachment != nullptr);
    REQUIRE(attachment->bindSearchBox(nullptr));
    lineEdit->setText(QStringLiteral("文本"));
    filter->setFilterFixedString(QStringLiteral("文本"));
    REQUIRE(search->rowCount() == 1);
    REQUIRE(attachment->bindSearchBox(lineEdit));
    appendNamedRow(source, QStringLiteral("Fresh Widget"), 17, "opaque-fresh");
    application.processEvents();
    setQuery(QStringLiteral("新鲜"));
    REQUIRE(search->rowCount() == 1);
    REQUIRE(search->data(search->index(0, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Fresh Widget"));
    source->removeRow(source->rowCount() - 1);
    application.processEvents();
    REQUIRE(search->rowCount() == 0);
    constexpr const char *kLanguages[] = {"zh-Hans", "zh-Hant", "ja_JP"};
    int categoryId = 100;
    for (const char *languageName : kLanguages) {
        const QString language = QString::fromLatin1(languageName);
        auto *categorySource = new cavalry::FastQuickAddModel(&window);
        appendVideoRows(categorySource, categoryId);
        categoryId += 10;
        auto *categoryFilter = makeFastQuickAddFilter(
            &window,
            categorySource);
        auto *categoryView = new QListView(stack);
        categoryView->setModel(categoryFilter);
        const auto categoryProvider =
            [&providerCalls, language](const QString &sourceName) {
                ++providerCalls;
                return aliasesForLanguage(language, sourceName);
            };
        const QString shapeAlias = candidateAliasForLanguage(
            language,
            QStringLiteral("Shape"));
        REQUIRE(!shapeAlias.isEmpty());
        lineEdit->setText(shapeAlias);
        categoryFilter->setFilterFixedString(shapeAlias);
        REQUIRE(categoryFilter->rowCount() == categorySource->rowCount());
        auto *categorySearch = cavalry_i18n::attachFastQuickAddAliases(
            categoryView,
            categoryProvider);
        REQUIRE(categorySearch != nullptr);
        REQUIRE(categorySearch->parent() == categoryFilter);
        REQUIRE(categorySearch->sourceModel() != nullptr);
        REQUIRE(categorySource->parent() == &window);
        REQUIRE(categorySearch->rowCount() == 1);
        REQUIRE(categoryFilter->rowCount() == 1);
        REQUIRE(categoryFilter->data(categoryFilter->index(0, 0), Qt::DisplayRole)
                    .toString()
                == QStringLiteral("Shape"));
        for (const VideoAliasCase &item : kVideoAliasCases) {
            const QString sourceName = QString::fromLatin1(item.source);
            const QString aliasName = candidateAliasForLanguage(
                language,
                sourceName);
            REQUIRE(!aliasName.isEmpty());
            REQUIRE(aliasesForLanguage(language, sourceName)
                        == QStringList{aliasName});
            lineEdit->setText(aliasName);
            categoryFilter->setFilterFixedString(aliasName);
            REQUIRE(categorySearch->rowCount() == 1);
            REQUIRE(categorySearch->data(categorySearch->index(0, 0), Qt::DisplayRole)
                        .toString()
                    == sourceName);
        }
        lineEdit->setText(QStringLiteral("TEXT"));
        categoryFilter->setFilterFixedString(QStringLiteral("TEXT"));
        REQUIRE(categorySearch->rowCount() == 1);
        lineEdit->setText(QStringLiteral("shap"));
        categoryFilter->setFilterFixedString(QStringLiteral("shap"));
        REQUIRE(categorySearch->rowCount() == 1);
        lineEdit->clear();
        categoryFilter->setFilterFixedString(QString());
        REQUIRE(categorySearch->rowCount() == 4);
    }
    setQuery(QStringLiteral("添加分割"));
    REQUIRE(search->rowCount() == 1);
    view->setCurrentIndex(filter->index(0, 0));
    REQUIRE(view->currentIndex().isValid());
    auto *sameSearch = cavalry_i18n::attachFastQuickAddAliases(
        view,
        provider);
    REQUIRE(sameSearch == search);
    REQUIRE(filter->sourceModel() == search);
    REQUIRE(view->currentIndex().isValid());
    REQUIRE(view->currentIndex().model() == filter);
    auto *replacement = new cavalry::FastQuickAddModel(&window);
    appendNamedRow(replacement, QStringLiteral("Shape"), 40, "opaque-replacement-shape");
    appendNamedRow(replacement, QStringLiteral("Circle"), 41, "opaque-replacement-circle");
    QPointer<cavalry_i18n::FastQuickAddAliasProxy> oldAlias = alias;
    filter->setSourceModel(replacement);
    application.processEvents();
    REQUIRE(oldAlias.isNull());
    REQUIRE(filter->sourceModel() == search);
    REQUIRE(search->sourceModel() != nullptr);
    auto *replacementAlias = dynamic_cast<cavalry_i18n::FastQuickAddAliasProxy *>(
        search->sourceModel());
    REQUIRE(replacementAlias != nullptr);
    REQUIRE(replacementAlias->parent() == filter);
    REQUIRE(replacement->parent() == &window);
    setQuery(QStringLiteral("形状"));
    REQUIRE(search->rowCount() == 1);
    REQUIRE(search->data(search->index(0, 0), Qt::DisplayRole).toString()
            == QStringLiteral("Shape"));
    setQuery(QStringLiteral("圆形"));
    REQUIRE(search->rowCount() == 1);
    REQUIRE(consumeVendorIdentity(filter->index(0, 0)) == 41);
    appendNamedRow(replacement, QStringLiteral("Other"), 42, "opaque-replacement-other");
    replacement->removeRow(0);
    application.processEvents();
    REQUIRE(search->rowCount() == 1);
    replacement->removeRow(0);
    application.processEvents();
    REQUIRE(search->rowCount() == 0);

    // 整个 view 换用新的 vendor filter 时，旧 filter 必须恢复原 source，新 filter 同步获得 alias 链。
    appendNamedRow(replacement, QStringLiteral("Text"), 50, "opaque-view-replacement-text");
    auto *replacementViewFilter = makeFastQuickAddFilter(&window, replacement);
    view->setModel(replacementViewFilter);
    auto *reboundSearch = cavalry_i18n::attachFastQuickAddAliases(view, provider);
    REQUIRE(reboundSearch != nullptr && view->model() == replacementViewFilter
            && reboundSearch->parent() == replacementViewFilter
            && filter->sourceModel() == replacement
            && replacementViewFilter->sourceModel() == reboundSearch);
    auto *reboundAlias = dynamic_cast<cavalry_i18n::FastQuickAddAliasProxy *>(reboundSearch->sourceModel());
    REQUIRE(reboundAlias != nullptr && reboundAlias->parent() == replacementViewFilter);
    lineEdit->setText(QStringLiteral("文字"));
    replacementViewFilter->setFilterFixedString(QStringLiteral("文字"));
    REQUIRE(reboundSearch->rowCount() == 1
            && reboundSearch->data(reboundSearch->index(0, 0), Qt::DisplayRole).toString()
                == QStringLiteral("Text")
            && consumeVendorIdentity(replacementViewFilter->index(0, 0)) == 50);
    filter->setFilterFixedString(QString());
    REQUIRE(filter->sourceModel() == replacement && filter->rowCount() == replacement->rowCount());

    // 未知 model 必须 fail-closed，不能删除或重写仍存活的 vendor filter。
    auto *unknownViewModel = new QStandardItemModel(1, 1, &window);
    unknownViewModel->setData(unknownViewModel->index(0, 0), QStringLiteral("Unknown View Model"));
    view->setModel(unknownViewModel);
    REQUIRE(cavalry_i18n::attachFastQuickAddAliases(view, provider) == nullptr
            && view->model() == unknownViewModel
            && filter->sourceModel() == replacement
            && replacementViewFilter->sourceModel() == replacement);

    // 再换回 trusted filter，必须重新挂接而不是被旧 attachment 卡住。
    view->setModel(replacementViewFilter);
    auto *reboundAgain = cavalry_i18n::attachFastQuickAddAliases(view, provider);
    REQUIRE(reboundAgain != nullptr && replacementViewFilter->sourceModel() == reboundAgain
            && reboundAgain->parent() == replacementViewFilter
            && cavalry_i18n::attachFastQuickAddAliases(view, provider) == reboundAgain);

    auto *untrusted = new QStandardItemModel(1, 1, &window);
    untrusted->setData(
        untrusted->index(0, 0),
        QVariant::fromValue(cavalry::FastQuickAddItem{99}),
        cavalry_i18n::kFastQuickAddIdentityRole);
    untrusted->setData(
        untrusted->index(0, 0),
        QStringLiteral("Some Qt List"),
        cavalry_i18n::kFastQuickAddSearchRole);
    auto *untrustedFilter = makeFastQuickAddFilter(&window, untrusted);
    auto *untrustedView = new QListView(stack);
    untrustedView->setModel(untrustedFilter);
    REQUIRE(!cavalry_i18n::isFastQuickAddSourceModel(untrusted));
    REQUIRE(cavalry_i18n::attachFastQuickAddAliases(untrustedView, provider)
            == nullptr);
    REQUIRE(untrustedFilter->sourceModel() == untrusted);
    auto *wrongRoleFilter = makeFastQuickAddFilter(
        &window,
        source,
        Qt::DisplayRole);
    auto *wrongRoleView = new QListView(stack);
    wrongRoleView->setModel(wrongRoleFilter);
    auto *wrongRoleSearch = cavalry_i18n::attachFastQuickAddAliases(
        wrongRoleView,
        provider);
    REQUIRE(wrongRoleSearch != nullptr);
    REQUIRE(wrongRoleFilter->sourceModel() == wrongRoleSearch);
    auto *dockFilter = makeFastQuickAddFilter(&dockWindow, source);
    auto *dockView = new QListView(&dockWindow);
    dockView->setModel(dockFilter);
    REQUIRE(cavalry_i18n::findFastQuickAddSearchBox(dockView) == nullptr);
    REQUIRE(cavalry_i18n::attachFastQuickAddAliases(dockView, provider)
            == nullptr);
    REQUIRE(dockFilter->sourceModel() == source);
    untrustedView->setModel(nullptr);
    wrongRoleView->setModel(nullptr);
    dockView->setModel(nullptr);
    view->setModel(nullptr);
    delete untrustedFilter;
    delete wrongRoleFilter;
    delete dockFilter;
    REQUIRE(replacement->parent() == &window);
    delete filter;
    REQUIRE(source->parent() == &window);
    REQUIRE(oldAlias.isNull());
    std::fprintf(stdout, "check_quick_add_search: PASS\n");
    return 0;
}
#include "check_quick_add_search.moc"
