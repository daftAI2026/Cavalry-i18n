/**
 * [INPUT]: 依赖 CavalryDisplayTranslator、嵌入式三语翻译表与 Qt Widgets 标准 item model
 * [OUTPUT]: 对外锁定已知基名数字后缀和 QComboBox DisplayRole 翻译的数据隔离合同
 * [POS]: injector/windows 的显示层单元回归，证明通用规则不会改写自定义名称、UserRole 或 currentIndex
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_display.h"

#include "cavalry_i18n_translator.h"

#include <QtCore/QList>
#include <QtCore/QString>
#include <QtCore/QVariant>
#include <QtGui/QStandardItemModel>
#include <QtWidgets/QApplication>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QLabel>

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

    return expectEqual(
               language + QStringLiteral(" dynamic Rectangle rewrite"),
               comboBox.itemText(0),
               rectangle)
        && expectEqual(
               language + QStringLiteral(" dynamic identity"),
               comboBox.itemData(0, Qt::UserRole).toString(),
               QStringLiteral("rectangle-identity"))
        && expectTrue(
               language + QStringLiteral(" dynamic currentIndex"),
               comboBox.currentIndex() == 2)
        && expectTrue(
               language + QStringLiteral(" dynamic DisplayRole-only write"),
               model.writtenRoles.size() == 1
                   && model.writtenRoles.constFirst() == Qt::DisplayRole);
}

} // namespace

int main(int argc, char *argv[])
{
    QApplication application(argc, argv);

    const LocaleExpectation expectations[] {
        { "zh-Hans", "合成", "矩形", "圆形" },
        { "zh-Hant", "合成", "矩形", "圓形" },
        { "ja_JP", "コンポジション", "長方形", "円" },
    };

    for (const LocaleExpectation &expectation : expectations) {
        if (!verifyLocale(expectation)) {
            return 1;
        }
    }

    return 0;
}
