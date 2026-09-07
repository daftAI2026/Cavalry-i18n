/**
 * [INPUT]: 依赖 injector/cavalry_i18n_classic_search.h 及其 cavalry_i18n_quick_add_context.h、Qt 6.6.3 QListWidget/QLabel 公共 API 与可控的 QuickAddWindow/ListWidget fixture；标题/说明 provider 只提供 side data
 * [OUTPUT]: 对外提供不触碰真实 Cavalry 的 Classic Add Layer 双语搜索合同；验证 query 命中时仅投影清理 token、itemWidget 标题与说明显示层、三语视频词条、native filter/no-results、同 locale 原文/挂接后排序与比较器 source-only 探针、延后创建与动态生命周期、幂等与边界
 * [POS]: tools 的 vendor-free Classic 搜索回归；只证明共享 helper 的 Qt 数据行为和公共 MIME 结果，不冒充 vendor command/custom MIME 的真人证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "../injector/cavalry_i18n_classic_search.h"

#include <QtCore/QDataStream>
#include <QtCore/QIODevice>
#include <QtCore/QLocale>
#include <QtCore/QMap>
#include <QtCore/QMimeData>
#include <QtCore/QVariant>
#include <QtWidgets/QApplication>
#include <QtWidgets/QLabel>
#include <QtWidgets/QListWidget>
#include <QtWidgets/QStackedWidget>
#include <QtWidgets/QVBoxLayout>

#include <cstdio>
#include <regex>
#include <string>

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

    QMimeData *publicMimeData(const QList<QListWidgetItem *> &items) const
    {
        return mimeData(items);
    }
};

class VendorListItem final : public QListWidgetItem {
public:
    VendorListItem(
        const QString &source,
        const QString &identity,
        const QString &description)
        : QListWidgetItem(source)
        , identity(identity)
        , description(description)
    {
        setData(Qt::UserRole, QStringLiteral("opaque-role"));
    }

    QString identity;
    QString description;
};

struct VideoAliasCase {
    const char *source;
    const char *zhHans;
    const char *zhHant;
    const char *jaJp;
    bool sourcePresent;
};

struct DescriptionAliasCase {
    const char *english;
    const char *zhHans;
    const char *zhHant;
    const char *jaJp;
};

// 仅验证一般 collation/prefix 性质；不声称这些合成条目都存在于 vendor UI。
struct ClassicSortCase {
    const char *source;
    const char *zhHans;
    const char *zhHant;
    const char *jaJp;
};

constexpr ClassicSortCase kClassicSortCases[] = {
    {"Text", "文本", "文字", "テキスト"},
    {"Text Shape", "文本形状", "文字形狀", "テキストシェイプ"},
    {"TextEdit", "文本编辑", "文字編輯", "テキスト編集"},
    {"Text Editor", "文本编辑器", "文字編輯器", "テキストエディター"},
    {"Shape", "形状", "形狀", "シェイプ"},
    {"Shape Box", "形状盒", "形狀盒", "シェイプボックス"},
    {"Box", "盒", "盒", "ボックス"},
    {"Box Circle", "盒圆", "盒圓", "ボックスサークル"},
    {"Circle", "圆", "圓", "サークル"},
    {"Add", "添加", "新增", "追加"},
    {"Add Divisions", "添加分割", "新增分割", "除算を追加"},
    {"Accumulator", "累加器", "累加器", "アキュムレータ"},
    {"3D Matrix", "三维矩阵", "三維矩陣", "3Dマトリックス"},
    {"Z", "泽德", "澤德", "ゼッド"},
    {"A", "啊", "啊", "エー"},
    {"AB", "阿比", "阿比", "エービー"},
};

constexpr VideoAliasCase kVideoAliasCases[] = {
    {"Text", "文字", "文字", "テキスト", true},
    {"Shape", "形状", "形狀", "シェイプ", true},
    {"Box", "盒形", "盒形", "ボックス", true},
    {"Circle", "圆形", "圓形", "円", false},
};

// 说明索引按完整 QLabel 文本反查；它不从 niceName 猜 nodeType/layerType。
constexpr DescriptionAliasCase kDescriptionAliasCases[] = {
    {"Create and format rich text.", "创建和格式化富文本。", "建立並格式化富文字。", "リッチテキストを作成してフォーマット。"},
    {"Polygonal objects that can be drawn in the viewport", "可以在视口中绘制的多边形对象", "可以在檢視區中繪製的多邊形物件", "ビューポートに描画できるポリゴンオブジェクト"},
    {"Generate a Box end for the Arrow Primitive.", "为箭头图元生成方形末端。", "為箭頭基本形產生方框末端。", "矢印プリミティブ用のボックス端を生成します。"},
    {"Distribute points in a radial pattern.", "以径向模式分布点。", "以放射狀圖案分佈點。", "放射状にポイントを分布。"},
};

const char *aliasForLanguage(
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

QStringList aliasesFor(
    const QString &language,
    const QString &source)
{
    for (const VideoAliasCase &item : kVideoAliasCases) {
        if (source != QString::fromLatin1(item.source)) {
            continue;
        }
        if (!item.sourcePresent) {
            return {};
        }
        const char *alias = aliasForLanguage(language, item);
        return alias == nullptr
            ? QStringList{}
            : QStringList{QString::fromUtf8(alias)};
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
    if (source == QStringLiteral("A")) {
        return language == QStringLiteral("zh-Hans")
            ? QStringList{QStringLiteral("啊")}
            : QStringList{QStringLiteral("エー")};
    }
    if (source == QStringLiteral("AB")) {
        return language == QStringLiteral("zh-Hans")
            ? QStringList{QStringLiteral("阿比")}
            : QStringList{QStringLiteral("エービー")};
    }
    if (source == QStringLiteral("B")) {
        return language == QStringLiteral("zh-Hans")
            ? QStringList{QStringLiteral("吧")}
            : QStringList{QStringLiteral("ビー")};
    }
    if (source == QStringLiteral("Dynamic")) {
        return language == QStringLiteral("zh-Hans")
            ? QStringList{QStringLiteral("动态")}
            : QStringList{QStringLiteral("動態")};
    }
    if (source == QStringLiteral("Ambiguous")) {
        return {QStringLiteral("歧义")};
    }
    return {};
}

QString titleFor(
    const QString &language,
    const QString &source)
{
    const QStringList aliases = aliasesFor(language, source);
    return aliases.isEmpty() ? QString() : aliases.constFirst();
}

QStringList descriptionAliasesFor(
    const QString &language,
    const QString &description)
{
    for (const DescriptionAliasCase &item : kDescriptionAliasCases) {
        const char *localized = item.english;
        if (language == QStringLiteral("zh-Hans")) {
            localized = item.zhHans;
        } else if (language == QStringLiteral("zh-Hant")) {
            localized = item.zhHant;
        } else if (language == QStringLiteral("ja_JP")) {
            localized = item.jaJp;
        }
        if (description == QString::fromUtf8(item.english)
            || description == QString::fromUtf8(localized)) {
            return {QString::fromUtf8(item.english)};
        }
    }
    return {};
}

QString descriptionForLanguage(
    const QString &language,
    const QString &english)
{
    for (const DescriptionAliasCase &item : kDescriptionAliasCases) {
        if (english != QString::fromUtf8(item.english)) {
            continue;
        }
        const char *localized = item.english;
        if (language == QStringLiteral("zh-Hans")) {
            localized = item.zhHans;
        } else if (language == QStringLiteral("zh-Hant")) {
            localized = item.zhHant;
        } else if (language == QStringLiteral("ja_JP")) {
            localized = item.jaJp;
        }
        return QString::fromUtf8(localized);
    }
    return english;
}

QWidget *buildItemWidget(
    const QString &source,
    const QString &descriptionText,
    bool duplicateTitle = false)
{
    auto *itemWidget = new QWidget;
    auto *layout = new QVBoxLayout(itemWidget);
    layout->setContentsMargins(0, 0, 0, 0);
    auto *title = new QLabel(source, itemWidget);
    title->setObjectName(QStringLiteral("title"));
    layout->addWidget(title);
    if (duplicateTitle) {
        auto *duplicate = new QLabel(source, itemWidget);
        duplicate->setObjectName(QStringLiteral("duplicate-title"));
        layout->addWidget(duplicate);
    }
    auto *category = new QLabel(QStringLiteral("Behaviour"), itemWidget);
    category->setObjectName(QStringLiteral("category"));
    layout->addWidget(category);
    auto *description = new QLabel(descriptionText, itemWidget);
    description->setObjectName(QStringLiteral("description"));
    layout->addWidget(description);
    return itemWidget;
}

VendorListItem *addItem(
    ListWidget *listWidget,
    const QString &source,
    int id,
    bool duplicateTitle = false,
    const QString &descriptionText = QStringLiteral("Description"))
{
    auto *item = new VendorListItem(
        source,
        QStringLiteral("vendor-type-%1").arg(id),
        QStringLiteral("private-description-%1").arg(id));
    listWidget->addItem(item);
    listWidget->setItemWidget(
        item,
        buildItemWidget(source, descriptionText, duplicateTitle));
    return item;
}

QLabel *labelByName(
    QListWidget *listWidget,
    QListWidgetItem *item,
    const char *name)
{
    QWidget *itemWidget = listWidget->itemWidget(item);
    if (itemWidget == nullptr) {
        return nullptr;
    }
    return itemWidget->findChild<QLabel *>(QString::fromLatin1(name));
}

QString sourcePart(const QString &projected)
{
    const int separator = projected.indexOf(
        cavalry_i18n::classicQuickAddAliasSeparator());
    return separator < 0 ? projected : projected.left(separator);
}

QString sortAliasForLanguage(
    const ClassicSortCase &item,
    const char *language)
{
    const QString languageName = QString::fromLatin1(language);
    if (languageName == QStringLiteral("zh-Hans")) {
        return QString::fromUtf8(item.zhHans);
    }
    if (languageName == QStringLiteral("zh-Hant")) {
        return QString::fromUtf8(item.zhHant);
    }
    if (languageName == QStringLiteral("ja_JP")) {
        return QString::fromUtf8(item.jaJp);
    }
    return {};
}

// 比较器探针在 macOS 也直接捕捉索引泄漏，避免某个 collator 恰好同序而漏报。
class SortProbeItem final : public QListWidgetItem {
public:
    using QListWidgetItem::QListWidgetItem;
    static inline int projectedComparisons = 0;
    bool operator<(const QListWidgetItem &other) const override {
        if (text().contains(cavalry_i18n::classicQuickAddAliasSeparator())
            || other.text().contains(cavalry_i18n::classicQuickAddAliasSeparator()))
            ++projectedComparisons;
        return QListWidgetItem::operator<(other);
    }
};
QStringList orderedSources(QListWidget *listWidget)
{
    QStringList result;
    for (int row = 0; row < listWidget->count(); ++row)
        result.append(sourcePart(listWidget->item(row)->text()));
    return result;
}
bool sameLocaleProjectionSortMatrix()
{
    const QLocale savedLocale = QLocale();
    for (const char *localeName : {"en_US", "zh_CN", "zh_TW", "ja_JP"}) {
        QLocale::setDefault(QLocale(QString::fromLatin1(localeName)));
        for (const char *language : {"zh-Hans", "zh-Hant", "ja_JP"}) {
            for (const auto order : {Qt::AscendingOrder, Qt::DescendingOrder}) {
                for (const bool automatic : {false, true}) {
                    QuickAddWindow owner;
                    SearchBar bar(&owner);
                    CompleterLineEdit search(&bar);
                    ListWidget original;
                    ListWidget projected(&owner);
                    for (const ClassicSortCase &item : kClassicSortCases) {
                        original.addItem(new QListWidgetItem(QString::fromLatin1(item.source)));
                        projected.addItem(new SortProbeItem(QString::fromLatin1(item.source)));
                    }
                    original.sortItems(order);
                    projected.sortItems(order);
                    original.setSortingEnabled(automatic);
                    projected.setSortingEnabled(automatic);
                    auto *selected = projected.item(4);
                    projected.setCurrentItem(selected);
                    QPersistentModelIndex selection(projected.indexFromItem(selected));
                    int syntheticItemChanges = 0;
                    QObject::connect(&projected, &QListWidget::itemChanged, &projected,
                        [&] { ++syntheticItemChanges; });
                    cavalry_i18n::attachClassicQuickAddAliases(&projected,
                        [language](const QString &source) {
                            for (const auto &item : kClassicSortCases)
                                if (source == QString::fromLatin1(item.source))
                                    return QStringList{sortAliasForLanguage(item, language)};
                            return QStringList{};
                        });
                    auto equalOrder = [&] {
                        if (orderedSources(&original) == orderedSources(&projected)
                            && projected.isSortingEnabled() == automatic
                            && projected.currentItem() == selected
                            && projected.itemFromIndex(selection) == selected)
                            return true;
                        std::fprintf(stderr, "Classic sort drift: locale=%s aliases=%s order=%d auto=%d\n",
                                     localeName, language, int(order), automatic);
                        return false;
                    };
                    for (const auto &queryCase : kClassicSortCases) {
                        SortProbeItem::projectedComparisons = 0;
                        search.setText(sortAliasForLanguage(queryCase, language));
                        if (!equalOrder()) { QLocale::setDefault(savedLocale); return false; }
                        projected.sortItems(order);
                        if (!equalOrder() || SortProbeItem::projectedComparisons != 0
                            || syntheticItemChanges != 0) {
                            std::fprintf(stderr, "Classic sort/notification boundary violation\n");
                            QLocale::setDefault(savedLocale); return false;
                        }
                    }
                    // 活跃 query 下原生插入、新 item 与已有前缀均须收敛到未翻译顺序。
                    original.addItem(new QListWidgetItem(QStringLiteral("Text Shape Z")));
                    projected.addItem(new SortProbeItem(QStringLiteral("Text Shape Z")));
                    if (!equalOrder()) { QLocale::setDefault(savedLocale); return false; }
                    search.clear();
                    original.sortItems(order);
                    projected.sortItems(order);
                    if (!equalOrder()) { QLocale::setDefault(savedLocale); return false; }
                }
            }
        }
    }
    QLocale::setDefault(savedLocale);
    return true;
}

bool nativeFilter(ListWidget *listWidget, const QString &query)
{
    const QString needle = query.simplified().toLower();
    bool any = false;
    int firstMatch = -1;
    for (int row = 0; row < listWidget->count(); ++row) {
        QListWidgetItem *item = listWidget->item(row);
        const QString haystack = item->text().simplified().toLower();
        const bool match = needle.isEmpty() || haystack.contains(needle);
        listWidget->setRowHidden(row, !match);
        if (match) {
            any = true;
            if (firstMatch < 0) {
                firstMatch = row;
            }
        }
    }
    listWidget->setCurrentRow(firstMatch);
    return any;
}

QStringList visibleSources(ListWidget *listWidget)
{
    QStringList result;
    for (int row = 0; row < listWidget->count(); ++row) {
        QListWidgetItem *item = listWidget->item(row);
        if (!item->isHidden()) {
            result.append(sourcePart(item->text()));
        }
    }
    return result;
}

bool standardMimeUsesProjectedDisplay(
    ListWidget *listWidget,
    QListWidgetItem *item)
{
    QMimeData *mimeData = listWidget->publicMimeData({item});
    const QByteArray payload = mimeData->data(
        QStringLiteral("application/x-qabstractitemmodeldatalist"));
    delete mimeData;
    if (payload.isEmpty()) {
        return false;
    }

    QDataStream stream(payload);
    int row = -1;
    int column = -1;
    QMap<int, QVariant> roles;
    stream >> row >> column >> roles;
    return stream.status() == QDataStream::Ok
        && roles.value(Qt::DisplayRole).toString() == item->text();
}

bool require(bool condition, const char *expression, int line)
{
    if (condition) {
        return true;
    }
    std::fprintf(
        stderr,
        "check_classic_quick_add_search: %s (line %d)\n",
        expression,
        line);
    return false;
}

#define REQUIRE(expression) \
    do { \
        if (!require((expression), #expression, __LINE__)) { \
            return 1; \
        } \
    } while (false)

QString regexCleanReference(const QString &query)
{
    static const std::regex cleanup(R"([-[\]{}()*+?.,\^$|#\s])");
    QString simplified = query.simplified();
    simplified.replace(QStringLiteral(" "), QString());
    const QByteArray utf8 = simplified.toLower().toUtf8();
    const std::string input(utf8.constData(), std::size_t(utf8.size()));
    const std::string output = std::regex_replace(
        input,
        cleanup,
        std::string());
    return QString::fromUtf8(
        QByteArray(output.data(), static_cast<int>(output.size())));
}

int main(int argc, char **argv)
{
    QApplication application(argc, argv);
    application.setQuitOnLastWindowClosed(false);

    QuickAddWindow owner;
    auto *list = new ListWidget(&owner);
    auto *searchBar = new SearchBar(&owner);
    auto *search = new CompleterLineEdit(searchBar);
    auto *plainList = new QListWidget(&owner);
    QWidget wrongOwner;
    auto *wrongList = new ListWidget(&wrongOwner);

    REQUIRE(cavalry_i18n::isClassicQuickAddListWidget(list)
            && !cavalry_i18n::isClassicQuickAddListWidget(plainList)
            && !cavalry_i18n::isClassicQuickAddListWidget(wrongList));
    REQUIRE(cavalry_i18n::isQuickAddSearchBox(search));
    REQUIRE(cavalry_i18n::findClassicQuickAddSearchBox(list) == search);

    for (int code = 0; code < 128; ++code) {
        const QString query(QChar(static_cast<ushort>(code)));
        REQUIRE(cavalry_i18n::cleanClassicQuickAddQuery(query)
                == regexCleanReference(query));
    }
    REQUIRE(cavalry_i18n::cleanClassicQuickAddQuery(
                QStringLiteral("  !Rich-Text? "))
            == QStringLiteral("!richtext"));
    REQUIRE(cavalry_i18n::cleanClassicQuickAddQuery(QStringLiteral("中文。"))
            == QStringLiteral("中文。"));
    REQUIRE(cavalry_i18n::classicQuickAddAliasMatchesQuery(QStringLiteral("ab"), QStringLiteral("ab")));
    REQUIRE(!cavalry_i18n::classicQuickAddAliasMatchesQuery(QStringLiteral("ab"), QStringLiteral("ba")));
    REQUIRE(cavalry_i18n::classicQuickAddAliasMatchesQuery(QStringLiteral("ab"), QStringLiteral("aa")));
    auto *text = addItem(
        list,
        QStringLiteral("Text"),
        1,
        false,
        QStringLiteral("Create and format rich text."));
    auto *shape = addItem(
        list,
        QStringLiteral("Shape"),
        2,
        false,
        QStringLiteral(
            "Polygonal objects that can be drawn in the viewport"));
    auto *box = addItem(
        list,
        QStringLiteral("Box"),
        3,
        false,
        QStringLiteral("Generate a Box end for the Arrow Primitive."));
    auto *textShape = addItem(
        list,
        QStringLiteral("Text Shape"),
        4,
        false,
        QStringLiteral("Create and format rich text."));
    auto *circle = addItem(
        list,
        QStringLiteral("Circle"),
        5,
        false,
        QStringLiteral("Distribute points in a radial pattern."));

    QString language = QStringLiteral("zh-Hans");
    const auto aliases = [&language](const QString &source) {
        return aliasesFor(language, source);
    };
    const auto titles = [&language](const QString &source) {
        return titleFor(language, source);
    };
    const auto descriptions = [&language](const QString &text) {
        return descriptionAliasesFor(language, text);
    };
    auto localizeDescriptions = [&](const QString &name) {
        language = name;
        const auto set = [&](QListWidgetItem *item, const char *english) {
            labelByName(list, item, "description")->setText(
                descriptionForLanguage(
                    language,
                    QString::fromUtf8(english)));
        };
        set(text, "Create and format rich text.");
        set(shape, "Polygonal objects that can be drawn in the viewport");
        set(box, "Generate a Box end for the Arrow Primitive.");
        set(textShape, "Create and format rich text.");
        set(circle, "Distribute points in a radial pattern.");
    };

    auto *attachment = cavalry_i18n::attachClassicQuickAddAliases(
        list,
        aliases,
        titles,
        descriptions);
    REQUIRE(attachment != nullptr);
    REQUIRE(text->text()
            == cavalry_i18n::projectClassicQuickAddDisplayText(
                QStringLiteral("Text"), {}));
    REQUIRE(shape->text() == QStringLiteral("Shape"));
    REQUIRE(textShape->text()
            == QStringLiteral("Text Shape"));
    REQUIRE(box->text() == QStringLiteral("Box"));
    REQUIRE(circle->text() == QStringLiteral("Circle"));
    REQUIRE(text->identity == QStringLiteral("vendor-type-1"));
    REQUIRE(text->description == QStringLiteral("private-description-1"));
    REQUIRE(text->data(Qt::UserRole).toString()
            == QStringLiteral("opaque-role"));
    REQUIRE(labelByName(list, text, "title")->text() == QStringLiteral("文字"));
    REQUIRE(labelByName(list, text, "description")->text()
            == QStringLiteral("Create and format rich text."));
    REQUIRE(standardMimeUsesProjectedDisplay(list, text));

    // alias/description 均只在自身命中时投影当前清理 token，避免跨 alias 拼接。
    search->setText(QStringLiteral("文字"));
    REQUIRE(text->text()
            == cavalry_i18n::projectClassicQuickAddDisplayText(
                QStringLiteral("Text"), {QStringLiteral("文字")}));
    REQUIRE(nativeFilter(list, QStringLiteral("文字")));
    REQUIRE(visibleSources(list) == QStringList{QStringLiteral("Text")});
    search->setText(QStringLiteral("text"));
    REQUIRE(text->text()
            == cavalry_i18n::projectClassicQuickAddDisplayText(
                QStringLiteral("Text"), {QStringLiteral("text")}));
    REQUIRE(textShape->text().contains(QStringLiteral("text")));
    REQUIRE(!shape->text().contains(QStringLiteral("text")));
    REQUIRE(nativeFilter(list, QStringLiteral("text")));
    REQUIRE((visibleSources(list)
             == QStringList{QStringLiteral("Text"),
                             QStringLiteral("Text Shape")}));
    REQUIRE(search->text() == QStringLiteral("text"));

    search->setText(QStringLiteral("radial"));
    REQUIRE(circle->text()
            == cavalry_i18n::projectClassicQuickAddDisplayText(
                QStringLiteral("Circle"), {QStringLiteral("radial")}));
    REQUIRE(nativeFilter(list, QStringLiteral("radial")));
    REQUIRE(visibleSources(list) == QStringList{QStringLiteral("Circle")});
    search->setText(QStringLiteral("radial pattern"));
    REQUIRE(!circle->text().contains(QStringLiteral("radialpattern")));
    REQUIRE(!nativeFilter(list, QStringLiteral("radial pattern")));
    search->setText(QStringLiteral("RADIAL?"));
    REQUIRE(circle->text().contains(
        cavalry_i18n::classicQuickAddAliasSeparator()
        + QStringLiteral("radial")));
    search->setText(QString());
    REQUIRE(text->text() == QStringLiteral("Text"));
    REQUIRE(circle->text() == QStringLiteral("Circle"));
    REQUIRE(nativeFilter(list, QString()));
    REQUIRE(visibleSources(list).size() == list->count());

    const QString duplicateProjection =
        cavalry_i18n::projectClassicQuickAddDisplayText(
            QStringLiteral("Text"),
            {QStringLiteral("文字"), QStringLiteral(" 文字 "),
             QStringLiteral("Text"), QString(),
             QString(QChar(0xfffe)) + QStringLiteral("bad")});
    REQUIRE(duplicateProjection
            == QStringLiteral("Text")
                + cavalry_i18n::classicQuickAddAliasSeparator()
                + QStringLiteral("文字"));

    // 目标语言只提供反查 side data；完整说明不进入 DisplayRole。
    for (const char *name : {"zh-Hans", "zh-Hant", "ja_JP"}) {
        localizeDescriptions(QString::fromLatin1(name));
        attachment->setProviders(aliases, titles, descriptions);
        search->setText(QStringLiteral("text"));
        REQUIRE(text->text().contains(
            cavalry_i18n::classicQuickAddAliasSeparator()
            + QStringLiteral("text")));
        REQUIRE(textShape->text().contains(
            cavalry_i18n::classicQuickAddAliasSeparator()
            + QStringLiteral("text")));
        REQUIRE(!text->text().contains(
            QStringLiteral("Create and format rich text.")));
        search->setText(QStringLiteral("radial"));
        REQUIRE(circle->text().contains(
            cavalry_i18n::classicQuickAddAliasSeparator()
            + QStringLiteral("radial")));
        search->setText(QStringLiteral("创建"));
        REQUIRE(!text->text().contains(QStringLiteral("创建")));
        search->setText(QString());
        REQUIRE(text->text().count(
                    cavalry_i18n::classicQuickAddAliasSeparator())
                == 0);
    }
    localizeDescriptions(QStringLiteral("zh-Hans"));
    attachment->setProviders(aliases, titles, descriptions);

    auto *ambiguous = addItem(list, QStringLiteral("Ambiguous"), 6, true);
    application.processEvents();
    REQUIRE(labelByName(list, ambiguous, "title")->text()
            == QStringLiteral("Ambiguous"));
    REQUIRE(labelByName(list, ambiguous, "duplicate-title")->text()
            == QStringLiteral("Ambiguous"));
    auto *dynamic = addItem(list, QStringLiteral("Dynamic"), 7);
    application.processEvents();
    REQUIRE(dynamic->text() == QStringLiteral("Dynamic"));
    REQUIRE(labelByName(list, dynamic, "title")->text()
            == QStringLiteral("动态"));

    delete list->takeItem(list->row(shape));
    application.processEvents();
    attachment->refresh();
    REQUIRE(list->findItems(QStringLiteral("Shape"), Qt::MatchStartsWith)
            .isEmpty());
    list->sortItems(Qt::AscendingOrder);
    attachment->refresh();
    for (int row = 0; row < list->count(); ++row) {
        REQUIRE(!list->item(row)->text().contains(
            QStringLiteral("Create and format rich text.")));
    }

    auto *dynamicText = addItem(list, QStringLiteral("Text"), 8);
    application.processEvents();
    dynamicText->setText(QStringLiteral("文字"));
    application.processEvents();
    REQUIRE(dynamicText->text() == QStringLiteral("Text"));
    REQUIRE(cavalry_i18n::attachClassicQuickAddAliases(
                list, aliases, titles, descriptions)
            == attachment);

    int resetCount = 0;
    QObject::connect(
        list->model(),
        &QAbstractItemModel::modelReset,
        list,
        [&resetCount] { ++resetCount; });
    list->clear();
    application.processEvents();
    REQUIRE(list->count() == 0);
    REQUIRE(resetCount > 0);
    auto *fresh = addItem(list, QStringLiteral("Text"), 9);
    application.processEvents();
    REQUIRE(fresh->text() == QStringLiteral("Text"));
    REQUIRE(labelByName(list, fresh, "title")->text()
            == QStringLiteral("文字"));

    // 同一原生比较器只消费 source；升降序、自动排序和活跃查询均须同序。
    REQUIRE(sameLocaleProjectionSortMatrix());

    // itemWidget/search box 延后创建；销毁搜索框必须移除旧 token。
    QuickAddWindow delayedOwner;
    auto *delayedList = new ListWidget(&delayedOwner);
    auto *delayedAttachment = cavalry_i18n::attachClassicQuickAddAliases(
        delayedList, aliases, titles, descriptions);
    auto *delayed = new VendorListItem(
        QStringLiteral("Delayed"),
        QStringLiteral("vendor-type-12"),
        QStringLiteral("private-description-12"));
    delayedList->addItem(delayed);
    application.processEvents();
    delayedList->setItemWidget(
        delayed,
        buildItemWidget(
            QStringLiteral("Delayed"),
            QStringLiteral("Create and format rich text.")));
    delayedAttachment->refresh();
    REQUIRE(delayed->text() == QStringLiteral("Delayed"));
    auto *lateBar = new SearchBar(&delayedOwner);
    auto *lateSearch = new CompleterLineEdit(lateBar);
    lateSearch->setText(QStringLiteral("text"));
    delayedAttachment->refresh();
    REQUIRE(delayed->text().contains(
        cavalry_i18n::classicQuickAddAliasSeparator()
        + QStringLiteral("text")));
    delete lateSearch;
    application.processEvents();
    delayedAttachment->refresh();
    REQUIRE(!delayed->text().contains(QStringLiteral("text")));
    REQUIRE(delayed->data(Qt::UserRole).toString()
            == QStringLiteral("opaque-role"));

    std::fprintf(stdout, "check_classic_quick_add_search: PASS\n");
    return 0;
}

#include "check_classic_quick_add_search.moc"
