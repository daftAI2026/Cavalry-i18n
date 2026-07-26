/**
 * [INPUT]: 依赖 CavalryDisplayTranslator、嵌入式三语翻译表与 Qt Widgets 的 action tooltip、标准 item model、树和输入框信号
 * [OUTPUT]: 对外锁定 ToolBox/残留对话框标题、Exit/调色板动作、精确尾随空白工具标签、运行时逐行 tooltip、已知基名数字后缀、QComboBox/QTreeWidget DisplayRole 与受词表约束 QLineEdit 显示翻译的数据隔离合同
 * [POS]: injector/windows 的显示层单元回归，证明复合提示只改已知行，且通用规则不会改写自定义名称、UserRole、currentIndex 或未知用户输入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_display.h"

#include "cavalry_i18n_translator.h"

#include <QtCore/QList>
#include <QtCore/QSignalBlocker>
#include <QtCore/QString>
#include <QtCore/QStringList>
#include <QtCore/QVariant>
#include <QtGui/QAction>
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
    const char *toolBox;
    const char *exitAction;
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

bool verifyCompoundRuntimeTooltips(const LocaleExpectation &expectation)
{
    const QString language = QString::fromLatin1(expectation.language);
    CavalryEmbeddedTranslator translator(language);
    CavalryDisplayTranslator displayTranslator(translator);

    const QList<QStringList> tooltips {
        {
            QStringLiteral(" (c)"),
            QStringLiteral("Hold Alt/Option to Create a Camera"),
        },
        {
            QStringLiteral("Line Tool"),
            QStringLiteral(
                "Click and drag in the Viewport to create an Editable Shape "
                "or alt/option + click the icon to create a Basic Line."),
        },
        {
            QStringLiteral("Create a Duplicator"),
            QStringLiteral(
                "Any selected shapes will automatically be added as input "
                "shapes for the Duplicator."),
        },
        {
            QStringLiteral("Create an Extrusion"),
            QStringLiteral(
                "Any selected shapes will automatically be added as input "
                "shapes for the Extrude."),
        },
        {
            QStringLiteral("Create a Forge Dynamics Solver"),
            QStringLiteral(
                "Any selected shapes will automatically be added as input "
                "shapes."),
        },
        {
            QStringLiteral("Add a Rig Control"),
            QStringLiteral(
                "This is very useful for rigging facial animation."),
            QStringLiteral(
                "Connect its output to a keyframed attribute."),
        },
        {
            QStringLiteral("Add an Animation Control"),
            QStringLiteral(
                "This lets you drive animation in a non-linear way."),
            QStringLiteral(
                "Connect its output to a keyframed attribute."),
        },
        {
            QStringLiteral("Create a Rubber Hose Limb."),
            QStringLiteral(
                "Hold Alt/Option to add a Rubber Hose to the Selected "
                "Objects."),
        },
        {
            QStringLiteral("Create an Align Behaviour"),
            QStringLiteral(
                "This will automatically connect to any selected shapes."),
        },
        {
            QStringLiteral("Add an Auto-Animate Deformer"),
            QStringLiteral(
                "This will automatically connect to any selected shapes."),
        },
        {
            QStringLiteral("Top Align"),
            QStringLiteral(
                "Hold Alt/Option to align to the Composition"),
        },
        {
            QStringLiteral("Middle Align"),
            QStringLiteral(
                "Hold Alt/Option to align to the Composition"),
        },
        {
            QStringLiteral("Bottom Align"),
            QStringLiteral(
                "Hold Alt/Option to align to the Composition"),
        },
        {
            QStringLiteral("Left Align"),
            QStringLiteral(
                "Hold Alt/Option to align to the Composition"),
        },
        {
            QStringLiteral("Centre Align"),
            QStringLiteral(
                "Hold Alt/Option to align to the Composition"),
        },
        {
            QStringLiteral("Right Align"),
            QStringLiteral(
                "Hold Alt/Option to align to the Composition"),
        },
        {
            QStringLiteral("Horizontal Distribution"),
            QStringLiteral(
                "Hold Alt/Option to distribute across the Composition"),
        },
        {
            QStringLiteral("Vertical Distribution"),
            QStringLiteral(
                "Hold Alt/Option to distribute across the Composition"),
        },
        {
            QStringLiteral(
                "Enable the 'Update the UI during Playback'"),
            QStringLiteral("Viewport setting to preview."),
        },
        {
            QStringLiteral(
                "The resolution of {} is too large for H.264/MP4 and will be "
                "scaled."),
            QStringLiteral(
                "Please consider rendering to a different format."),
        },
        {
            QStringLiteral(
                "Materials are inherited by children - unless a child has "
                "their own material."),
            QStringLiteral(
                "You can override sub-mesh materials with a Sub-Mesh "
                "deformer."),
        },
        {
            QStringLiteral(
                "Strokes are inherited by children - unless a child has "
                "their own stroke."),
            QStringLiteral(
                "You can override sub-mesh strokes with a Sub-Mesh "
                "deformer."),
        },
        {
            QStringLiteral(
                "The number of verbs (draw instructions) in the Path, this "
                "excludes control points."),
            QStringLiteral(
                "This is useful to know when a feature requires matching "
                "verb counts between shapes (for example when using the "
                "Blend Shape)."),
        },
        {
            QStringLiteral("Run the current script."),
            QStringLiteral(
                "Hold Alt/Option to run just the selected text."),
        },
    };

    for (const QStringList &tooltipLines : tooltips) {
        QStringList expectedLines;
        expectedLines.reserve(tooltipLines.size());
        for (const QString &line : tooltipLines) {
            const QByteArray lineUtf8 = line.toUtf8();
            const QString translatedLine =
                translator.translate(nullptr, lineUtf8.constData());
            if (line == QStringLiteral(" (c)")) {
                expectedLines.append(line);
                continue;
            }
            if (!expectTrue(
                    language
                        + QStringLiteral(" compound source is translated: ")
                        + line,
                    !translatedLine.isEmpty() && translatedLine != line)) {
                return false;
            }
            expectedLines.append(translatedLine);
        }

        QAction action;
        action.setToolTip(tooltipLines.join(QChar('\n')));
        displayTranslator.translateAction(&action);

        if (!expectEqual(
                language + QStringLiteral(" compound toolbar tooltip"),
                action.toolTip(),
                expectedLines.join(QChar('\n')))) {
            return false;
        }
    }

    const QString customDetail = QStringLiteral("Custom user tooltip");
    const QString lineTool = QStringLiteral("Line Tool");
    const QByteArray lineToolUtf8 = lineTool.toUtf8();
    const QString translatedLineTool =
        translator.translate(nullptr, lineToolUtf8.constData());
    QAction partialAction;
    partialAction.setToolTip(lineTool + QChar('\n') + customDetail);
    displayTranslator.translateAction(&partialAction);
    return expectEqual(
        language + QStringLiteral(" compound unknown-line preservation"),
        partialAction.toolTip(),
        translatedLineTool + QChar('\n') + customDetail);
}

bool verifyEvidencedResidualWidgets(const QString &language)
{
    CavalryEmbeddedTranslator translator(language);
    CavalryDisplayTranslator displayTranslator(translator);
    const auto expectedTranslation =
        [&translator](const char *source) {
            return translator.translate(nullptr, source);
        };

    QLabel paletteName(QStringLiteral("Palette Name:"));
    QLabel missingAssets(QStringLiteral("This Scene has missing assets:"));
    QLabel softSelection(QStringLiteral("Soft Selection: "));
    QLabel strokeWidth(QStringLiteral("Stroke Width"));
    QLabel unprovenPitchRadius(QStringLiteral("Pitch Radius: "));
    QWidget renderDialog;
    renderDialog.setWindowTitle(QStringLiteral("Delete Render Item(s)"));
    QAction paletteAction;
    paletteAction.setText(QStringLiteral("Set W3C Name"));
    paletteAction.setToolTip(QStringLiteral("Reveal in Explorer..."));

    displayTranslator.translateWidget(&paletteName);
    displayTranslator.translateWidget(&missingAssets);
    displayTranslator.translateWidget(&softSelection);
    displayTranslator.translateWidget(&strokeWidth);
    displayTranslator.translateWidget(&unprovenPitchRadius);
    displayTranslator.translateWidget(&renderDialog);
    displayTranslator.translateAction(&paletteAction);

    return expectEqual(
               language + QStringLiteral(" palette input label"),
               paletteName.text(),
               expectedTranslation("Palette Name:"))
        && expectEqual(
               language + QStringLiteral(" scene issue label"),
               missingAssets.text(),
               expectedTranslation("This Scene has missing assets:"))
        && expectEqual(
               language + QStringLiteral(" exact tool label whitespace"),
               softSelection.text(),
               expectedTranslation("Soft Selection: "))
        && expectEqual(
               language + QStringLiteral(" direct QLabel source fallback"),
               strokeWidth.text(),
               expectedTranslation("Stroke Width"))
        && expectEqual(
               language + QStringLiteral(" render dialog title"),
               renderDialog.windowTitle(),
               expectedTranslation("Delete Render Item(s)"))
        && expectEqual(
               language + QStringLiteral(" palette action"),
               paletteAction.text(),
               expectedTranslation("Set W3C Name"))
        && expectEqual(
               language + QStringLiteral(" Explorer action tooltip"),
               paletteAction.toolTip(),
               expectedTranslation("Reveal in Explorer..."))
        && expectEqual(
               language + QStringLiteral(" unproven Pitch Radius boundary"),
               unprovenPitchRadius.text(),
               QStringLiteral("Pitch Radius: "));
}

bool verifyLocale(const LocaleExpectation &expectation)
{
    const QString language = QString::fromLatin1(expectation.language);
    const QString composition =
        QString::fromUtf8(expectation.composition);
    const QString rectangle = QString::fromUtf8(expectation.rectangle);
    const QString circle = QString::fromUtf8(expectation.circle);
    const QString toolBox = QString::fromUtf8(expectation.toolBox);
    const QString exitActionText =
        QString::fromUtf8(expectation.exitAction);

    CavalryEmbeddedTranslator translator(language);
    CavalryDisplayTranslator displayTranslator(translator);

    QLabel numberedComposition(QStringLiteral("Composition 1"));
    QLabel dottedCircle(QStringLiteral("Circle.12"));
    QLabel customName(QStringLiteral("Custom Composition 1"));
    QLabel localizedName(composition + QStringLiteral(" 1"));
    QLabel toolBoxWindow;
    toolBoxWindow.setWindowTitle(QStringLiteral("ToolBox"));
    QAction exitAction;
    exitAction.setText(QStringLiteral("Exit"));

    displayTranslator.translateWidget(&numberedComposition);
    displayTranslator.translateWidget(&dottedCircle);
    displayTranslator.translateWidget(&customName);
    displayTranslator.translateWidget(&localizedName);
    displayTranslator.translateWidget(&toolBoxWindow);
    displayTranslator.translateAction(&exitAction);

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
            composition + QStringLiteral(" 1"))
        || !expectEqual(
            language + QStringLiteral(" ToolBox window title"),
            toolBoxWindow.windowTitle(),
            toolBox)
        || !expectEqual(
            language + QStringLiteral(" Exit action"),
            exitAction.text(),
            exitActionText)) {
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

    return verifyCompoundRuntimeTooltips(expectation)
        && verifyEvidencedResidualWidgets(language)
        && verifyTreeWidgetDisplay(expectation)
        && verifyLineEditDisplay(expectation);
}

} // namespace

int main(int argc, char *argv[])
{
    QApplication application(argc, argv);

    const LocaleExpectation expectations[] {
        { "zh-Hans", "合成", "矩形", "圆形", "默认关键帧图层", "工具箱", "退出" },
        { "zh-Hant", "合成", "矩形", "圓形", "預設關鍵影格圖層", "工具箱", "結束" },
        { "ja_JP", "コンポジション", "長方形", "円", "既定キーフレームレイヤー", "ツールボックス", "終了" },
    };

    for (const LocaleExpectation &expectation : expectations) {
        if (!verifyLocale(expectation)) {
            return 1;
        }
    }

    return 0;
}
