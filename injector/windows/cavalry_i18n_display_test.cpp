/**
 * [INPUT]: 依赖 CavalryDisplayTranslator、嵌入式三语翻译表与 Qt Widgets 的标准 item model、树和输入框信号
 * [OUTPUT]: 对外锁定已知基名数字后缀、QComboBox/QTreeWidget DisplayRole 与受词表约束 QLineEdit 显示翻译的数据隔离合同
 * [POS]: injector/windows 的显示层单元回归，证明通用规则不会改写自定义名称、UserRole、currentIndex 或未知用户输入，也不会产生输入框业务回写信号
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_display.h"

#include "cavalry_i18n_translator.h"

#include <QtCore/QList>
#include <QtCore/QSignalBlocker>
#include <QtCore/QString>
#include <QtCore/QStringList>
#include <QtCore/QVariant>
#include <QtGui/QStandardItemModel>
#include <QtWidgets/QApplication>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QTreeWidget>

#include <algorithm>
#include <cstdio>

namespace {

class RoleRecordingModel final : public QStandardItemModel
{
public:
    using QStandardItemModel::QStandardItemModel;

    bool setData(
        const QModelIndex &index,
        const QVariant &value,
        int role = Qt::EditRole) override
    {
        writtenRoles.append(role);
        return QStandardItemModel::setData(index, value, role);
    }

    QList<int> writtenRoles;
};

struct LocaleExpectation
{
    const char *language;
    const char *composition;
    const char *rectangle;
    const char *circle;
    const char *defaultKeyframeLayer;
};

bool fail(const QString &message)
{
    const QByteArray utf8 = message.toUtf8();
    std::fprintf(stderr, "%s\n", utf8.constData());
    std::fflush(stderr);
    return false;
}

bool expectEqual(
    const QString &surface,
    const QString &actual,
    const QString &expected)
{
    return actual == expected
        ? true
        : fail(
            QStringLiteral("%1 mismatch: expected '%2', got '%3'.")
                .arg(surface, expected, actual));
}

bool expectTrue(const QString &surface, bool condition)
{
    return condition
        ? true
        : fail(QStringLiteral("%1 contract failed.").arg(surface));
}

bool verifyTreeWidgetDisplay(const LocaleExpectation &expectation)
{
    const QString language = QString::fromLatin1(expectation.language);
    const QString composition =
        QString::fromUtf8(expectation.composition);

    CavalryEmbeddedTranslator translator(language);
    CavalryDisplayTranslator displayTranslator(translator);
    QTreeWidget treeWidget;
    treeWidget.setColumnCount(1);

    QTreeWidgetItem *header = treeWidget.headerItem();
    header->setData(0, Qt::DisplayRole, QStringLiteral("Composition 1"));
    header->setData(0, Qt::UserRole, QStringLiteral("header-identity"));

    auto *topLevelItem = new QTreeWidgetItem(&treeWidget);
    topLevelItem->setData(
        0,
        Qt::DisplayRole,
        QStringLiteral("Composition 1"));
    topLevelItem->setData(
        0,
        Qt::UserRole,
        QStringLiteral("top-level-identity"));

    auto *nestedItem = new QTreeWidgetItem(topLevelItem);
    nestedItem->setData(0, Qt::DisplayRole, QStringLiteral("Composition 1"));
    nestedItem->setData(0, Qt::UserRole, QStringLiteral("nested-identity"));

    auto *customItem = new QTreeWidgetItem(&treeWidget);
    customItem->setData(
        0,
        Qt::DisplayRole,
        QStringLiteral("Custom Composition 1"));
    customItem->setData(
        0,
        Qt::UserRole,
        QStringLiteral("custom-identity"));

    displayTranslator.translateWidget(&treeWidget);

    if (!expectEqual(
            language + QStringLiteral(" tree header"),
            header->data(0, Qt::DisplayRole).toString(),
            composition + QStringLiteral(" 1"))
        || !expectEqual(
            language + QStringLiteral(" tree top-level item"),
            topLevelItem->data(0, Qt::DisplayRole).toString(),
            composition + QStringLiteral(" 1"))
        || !expectEqual(
            language + QStringLiteral(" tree nested item"),
            nestedItem->data(0, Qt::DisplayRole).toString(),
            composition + QStringLiteral(" 1"))
        || !expectEqual(
            language + QStringLiteral(" tree custom item"),
            customItem->data(0, Qt::DisplayRole).toString(),
            QStringLiteral("Custom Composition 1"))
        || !expectEqual(
            language + QStringLiteral(" tree header UserRole"),
            header->data(0, Qt::UserRole).toString(),
            QStringLiteral("header-identity"))
        || !expectEqual(
            language + QStringLiteral(" tree top-level UserRole"),
            topLevelItem->data(0, Qt::UserRole).toString(),
            QStringLiteral("top-level-identity"))
        || !expectEqual(
            language + QStringLiteral(" tree nested UserRole"),
            nestedItem->data(0, Qt::UserRole).toString(),
            QStringLiteral("nested-identity"))
        || !expectEqual(
            language + QStringLiteral(" tree custom UserRole"),
            customItem->data(0, Qt::UserRole).toString(),
            QStringLiteral("custom-identity"))) {
        return false;
    }

    auto *dynamicItem = new QTreeWidgetItem(topLevelItem);
    dynamicItem->setData(0, Qt::DisplayRole, QStringLiteral("Composition 1"));
    dynamicItem->setData(0, Qt::UserRole, QStringLiteral("dynamic-identity"));
    if (!expectEqual(
            language + QStringLiteral(" tree dynamic insertion"),
            dynamicItem->data(0, Qt::DisplayRole).toString(),
            composition + QStringLiteral(" 1"))
        || !expectEqual(
            language + QStringLiteral(" tree dynamic UserRole"),
            dynamicItem->data(0, Qt::UserRole).toString(),
            QStringLiteral("dynamic-identity"))) {
        return false;
    }

    nestedItem->setData(0, Qt::DisplayRole, QStringLiteral("Composition 1"));
    if (!expectEqual(
            language + QStringLiteral(" tree dynamic English rewrite"),
            nestedItem->data(0, Qt::DisplayRole).toString(),
            composition + QStringLiteral(" 1"))) {
        return false;
    }

    return expectEqual(
        language + QStringLiteral(" tree dynamic UserRole"),
        nestedItem->data(0, Qt::UserRole).toString(),
        QStringLiteral("nested-identity"));
}

bool verifyLineEditDisplay(const LocaleExpectation &expectation)
{
    const QString language = QString::fromLatin1(expectation.language);
    const QString defaultKeyframeLayer =
        QString::fromUtf8(expectation.defaultKeyframeLayer);
    const QString placeholderSource = QStringLiteral("Search");

    CavalryEmbeddedTranslator translator(language);
    CavalryDisplayTranslator displayTranslator(translator);
    QLineEdit lineEdit(QStringLiteral("Default Keyframe Layer"));
    lineEdit.setPlaceholderText(placeholderSource);

    QStringList emittedTexts;
    QObject::connect(
        &lineEdit,
        &QLineEdit::textChanged,
        &lineEdit,
        [&emittedTexts](const QString &text) { emittedTexts.append(text); });

    displayTranslator.translateWidget(&lineEdit);
    const QString translatedPlaceholder =
        translator.translate(nullptr, "Search");
    const QString expectedPlaceholder = translatedPlaceholder.isEmpty()
        ? placeholderSource
        : translatedPlaceholder;
    if (!expectEqual(
            language + QStringLiteral(" line edit initial value"),
            lineEdit.text(),
            defaultKeyframeLayer)
        || !expectEqual(
            language + QStringLiteral(" line edit placeholder"),
            lineEdit.placeholderText(),
            expectedPlaceholder)
        || !expectTrue(
            language + QStringLiteral(" line edit initial signal isolation"),
            emittedTexts.isEmpty())) {
        return false;
    }

    lineEdit.setText(QStringLiteral("Default Keyframe Layer"));
    if (!expectEqual(
            language + QStringLiteral(" line edit dynamic rewrite"),
            lineEdit.text(),
            defaultKeyframeLayer)
        || !expectTrue(
            language + QStringLiteral(" line edit dynamic signal isolation"),
            emittedTexts.size() == 1
                && emittedTexts.constFirst()
                    == QStringLiteral("Default Keyframe Layer"))) {
        return false;
    }

    const QString userText = QStringLiteral("Custom user layer");
    const int signalCountBeforeUserInput = emittedTexts.size();
    lineEdit.setText(userText);
    if (!expectEqual(
            language + QStringLiteral(" line edit unknown user input"),
            lineEdit.text(),
            userText)
        || !expectTrue(
            language + QStringLiteral(" line edit unknown signal isolation"),
            emittedTexts.size() == signalCountBeforeUserInput + 1
                && emittedTexts.constLast() == userText)) {
        return false;
    }

    const int signalCountBeforePaintFallback = emittedTexts.size();
    {
        QSignalBlocker blocker(&lineEdit);
        lineEdit.setText(QStringLiteral("Default Keyframe Layer"));
    }
    displayTranslator.translatePaintWidget(&lineEdit);
    return expectEqual(
               language + QStringLiteral(" line edit paint fallback"),
               lineEdit.text(),
               defaultKeyframeLayer)
        && expectTrue(
            language + QStringLiteral(" line edit paint signal isolation"),
            emittedTexts.size() == signalCountBeforePaintFallback);
}

bool verifyLocale(const LocaleExpectation &expectation)
{
    const QString language = QString::fromLatin1(expectation.language);
    const QString composition =
        QString::fromUtf8(expectation.composition);
    const QString rectangle = QString::fromUtf8(expectation.rectangle);
    const QString circle = QString::fromUtf8(expectation.circle);

    CavalryEmbeddedTranslator translator(language);
    CavalryDisplayTranslator displayTranslator(translator);

    QLabel numberedComposition(QStringLiteral("Composition 1"));
    QLabel dottedCircle(QStringLiteral("Circle.12"));
    QLabel customName(QStringLiteral("Custom Composition 1"));
    QLabel localizedName(composition + QStringLiteral(" 1"));

    displayTranslator.translateWidget(&numberedComposition);
    displayTranslator.translateWidget(&dottedCircle);
    displayTranslator.translateWidget(&customName);
    displayTranslator.translateWidget(&localizedName);

    if (!expectEqual(
            language + QStringLiteral(" numbered Composition"),
            numberedComposition.text(),
            composition + QStringLiteral(" 1"))
        || !expectEqual(
            language + QStringLiteral(" dotted known base"),
            dottedCircle.text(),
            circle + QStringLiteral(".12"))
        || !expectEqual(
            language + QStringLiteral(" custom numbered name"),
            customName.text(),
            QStringLiteral("Custom Composition 1"))
        || !expectEqual(
            language + QStringLiteral(" already-localized name"),
            localizedName.text(),
            composition + QStringLiteral(" 1"))) {
        return false;
    }

    QComboBox comboBox;
    RoleRecordingModel model;
    comboBox.setModel(&model);
    comboBox.addItem(
        QStringLiteral("Rectangle"),
        QStringLiteral("rectangle-identity"));
    comboBox.addItem(
        QStringLiteral("Circle"),
        QStringLiteral("circle-identity"));
    comboBox.addItem(
        QStringLiteral("My Custom Shape"),
        QStringLiteral("custom-identity"));
    comboBox.setCurrentIndex(2);
    model.writtenRoles.clear();

    displayTranslator.translateWidget(&comboBox);

    if (!expectEqual(
            language + QStringLiteral(" Rectangle display"),
            comboBox.itemText(0),
            rectangle)
        || !expectEqual(
            language + QStringLiteral(" Circle display"),
            comboBox.itemText(1),
            circle)
        || !expectEqual(
            language + QStringLiteral(" custom combo display"),
            comboBox.itemText(2),
            QStringLiteral("My Custom Shape"))
        || !expectEqual(
            language + QStringLiteral(" Rectangle identity"),
            comboBox.itemData(0, Qt::UserRole).toString(),
            QStringLiteral("rectangle-identity"))
        || !expectEqual(
            language + QStringLiteral(" Circle identity"),
            comboBox.itemData(1, Qt::UserRole).toString(),
            QStringLiteral("circle-identity"))
        || !expectTrue(
            language + QStringLiteral(" currentIndex"),
            comboBox.currentIndex() == 2)
        || !expectTrue(
            language + QStringLiteral(" DisplayRole-only writes"),
            !model.writtenRoles.isEmpty()
                && std::all_of(
                    model.writtenRoles.cbegin(),
                    model.writtenRoles.cend(),
                    [](int role) { return role == Qt::DisplayRole; }))) {
        return false;
    }

    model.writtenRoles.clear();
    displayTranslator.translatePaintWidget(&comboBox);
    if (!expectTrue(
            language + QStringLiteral(" localized combo is idempotent"),
            model.writtenRoles.isEmpty())) {
        return false;
    }

    model.setData(
        model.index(0, comboBox.modelColumn()),
        QStringLiteral("Rectangle"),
        Qt::DisplayRole);
    model.writtenRoles.clear();
    displayTranslator.translatePaintWidget(&comboBox);

    if (!expectEqual(
            language + QStringLiteral(" dynamic Rectangle rewrite"),
            comboBox.itemText(0),
            rectangle)
        || !expectEqual(
            language + QStringLiteral(" dynamic identity"),
            comboBox.itemData(0, Qt::UserRole).toString(),
            QStringLiteral("rectangle-identity"))
        || !expectTrue(
            language + QStringLiteral(" dynamic currentIndex"),
            comboBox.currentIndex() == 2)
        || !expectTrue(
            language + QStringLiteral(" dynamic DisplayRole-only write"),
            model.writtenRoles.size() == 1
                && model.writtenRoles.constFirst() == Qt::DisplayRole)) {
        return false;
    }

    return verifyTreeWidgetDisplay(expectation)
        && verifyLineEditDisplay(expectation);
}

} // namespace

int main(int argc, char *argv[])
{
    QApplication application(argc, argv);

    const LocaleExpectation expectations[] {
        { "zh-Hans", "合成", "矩形", "圆形", "默认关键帧图层" },
        { "zh-Hant", "合成", "矩形", "圓形", "預設關鍵影格圖層" },
        { "ja_JP", "コンポジション", "長方形", "円", "既定キーフレームレイヤー" },
    };

    for (const LocaleExpectation &expectation : expectations) {
        if (!verifyLocale(expectation)) {
            return 1;
        }
    }

    return 0;
}
