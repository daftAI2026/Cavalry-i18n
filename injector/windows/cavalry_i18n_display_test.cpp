/**
 * [INPUT]: 依赖 CavalryDisplayTranslator、嵌入式三语翻译表与 Qt Widgets 的 action tooltip、标准 item model、可编辑/字体 Combo、QTreeWidget popup、QLineEdit、QPlainTextEdit 与 QMenu
 * [OUTPUT]: 对外锁定普通 Qt 残留、来源绑定的 Color Settings/Mesh Explorer/Project Statistics/Tracking/Assets/单索引动态模板、精确 Qt context 隔离、selected/认证 QLabel、逐行 tooltip、数字后缀、DisplayRole 数据隔离与字体/选择值保护
 * [POS]: injector/windows 的显示层单元回归，证明动态文案必须同时命中厂商父系、producer 或对话框结构与显示属性，且通用规则不会改写可编辑/字体选择值、弹出树、编辑器正文、同文无关控件、自定义名称、UserRole、currentIndex 或未知用户输入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_display.h"
#include "cavalry_i18n_dynamic_label.h"
#include "cavalry_i18n_translator.h"

#include <QtCore/QList>
#include <QtCore/QModelIndex>
#include <QtCore/QSignalBlocker>
#include <QtCore/QString>
#include <QtCore/QStringList>
#include <QtCore/QVariant>
#include <QtGui/QAction>
#include <QtGui/QStandardItemModel>
#include <QtWidgets/QApplication>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QDialog>
#include <QtWidgets/QFontComboBox>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QMenu>
#include <QtWidgets/QPlainTextEdit>
#include <QtWidgets/QProgressBar>
#include <QtWidgets/QPushButton>
#include <QtWidgets/QTreeWidget>
#include <QtWidgets/QWidget>

#include <algorithm>
#include <array>
#include <cstdio>

namespace {

class AttributeEditorWindow final : public QWidget
{
    Q_OBJECT

public:
    using QWidget::QWidget;
};

class MeshExplorerRowWidget final : public QWidget
{
    Q_OBJECT

public:
    using QWidget::QWidget;
};

class ProjectStatisticsWindow final : public QWidget
{
    Q_OBJECT

public:
    using QWidget::QWidget;
};

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
    const char *automaticColorSpace;
    const char *singleIndexPlaceholder;
};

struct ComboValueState
{
    QStringList displayValues;
    QList<QVariant> editValues;
    QList<QVariant> userValues;
    int currentIndex = -1;
    QString currentText;
    QModelIndex currentModelIndex;
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

ComboValueState captureComboValueState(const QComboBox &comboBox)
{
    ComboValueState state;
    state.displayValues.reserve(comboBox.count());
    state.editValues.reserve(comboBox.count());
    state.userValues.reserve(comboBox.count());
    for (int index = 0; index < comboBox.count(); ++index) {
        state.displayValues.append(comboBox.itemText(index));
        state.editValues.append(comboBox.itemData(index, Qt::EditRole));
        state.userValues.append(comboBox.itemData(index, Qt::UserRole));
    }
    state.currentIndex = comboBox.currentIndex();
    state.currentText = comboBox.currentText();
    if (comboBox.model() != nullptr) {
        state.currentModelIndex = comboBox.model()->index(
            state.currentIndex,
            comboBox.modelColumn(),
            comboBox.rootModelIndex());
    }
    return state;
}

bool expectComboValueState(
    const QString &surface,
    const QComboBox &comboBox,
    const ComboValueState &expected)
{
    if (!expectTrue(
            surface + QStringLiteral(" item count"),
            comboBox.count() == expected.displayValues.size())) {
        return false;
    }
    for (int index = 0; index < comboBox.count(); ++index) {
        if (!expectEqual(
                surface + QStringLiteral(" itemText[")
                    + QString::number(index) + QChar(']'),
                comboBox.itemText(index),
                expected.displayValues.at(index))
            || !expectTrue(
                surface + QStringLiteral(" EditRole[")
                    + QString::number(index) + QChar(']'),
                comboBox.itemData(index, Qt::EditRole)
                    == expected.editValues.at(index))
            || !expectTrue(
                surface + QStringLiteral(" UserRole[")
                    + QString::number(index) + QChar(']'),
                comboBox.itemData(index, Qt::UserRole)
                    == expected.userValues.at(index))) {
            return false;
        }
    }

    return expectEqual(
               surface + QStringLiteral(" currentText"),
               comboBox.currentText(),
               expected.currentText)
        && expectTrue(
            surface + QStringLiteral(" currentIndex"),
            comboBox.currentIndex() == expected.currentIndex)
        && expectTrue(
            surface + QStringLiteral(" selected model index"),
            comboBox.model() != nullptr
                && comboBox.model()->index(
                       comboBox.currentIndex(),
                       comboBox.modelColumn(),
                       comboBox.rootModelIndex())
                    == expected.currentModelIndex);
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
    if (!expectEqual(
            language + QStringLiteral(" line edit paint fallback"),
            lineEdit.text(),
            defaultKeyframeLayer)
        || !expectTrue(
            language + QStringLiteral(" line edit paint signal isolation"),
            emittedTexts.size() == signalCountBeforePaintFallback)) {
        return false;
    }

    const QString singleIndexSource =
        QStringLiteral("Enter an index, e.g: 0");
    const QString documentText =
        QStringLiteral("Enter an index, e.g: 0\nUser-authored document");
    QPlainTextEdit unrelatedPlainTextEdit;
    unrelatedPlainTextEdit.setPlainText(documentText);
    unrelatedPlainTextEdit.setPlaceholderText(singleIndexSource);
    displayTranslator.translateWidget(&unrelatedPlainTextEdit);
    if (!expectEqual(
            language + QStringLiteral(
                " unrelated plain-text placeholder isolation"),
            unrelatedPlainTextEdit.placeholderText(),
            singleIndexSource)
        || !expectEqual(
            language + QStringLiteral(
                " unrelated plain-text document isolation"),
            unrelatedPlainTextEdit.toPlainText(),
            documentText)) {
        return false;
    }

    AttributeEditorWindow attributeEditorWindow;
    QPlainTextEdit plainTextEdit(&attributeEditorWindow);
    plainTextEdit.setPlainText(documentText);
    plainTextEdit.setPlaceholderText(singleIndexSource);
    displayTranslator.translateWidget(&plainTextEdit);
    if (!expectEqual(
            language + QStringLiteral(" plain-text exact placeholder"),
            plainTextEdit.placeholderText(),
            QString::fromUtf8(expectation.singleIndexPlaceholder))
        || !expectEqual(
            language + QStringLiteral(" plain-text document isolation"),
            plainTextEdit.toPlainText(),
            documentText)) {
        return false;
    }

    const QString customPlaceholder =
        QStringLiteral("Custom user placeholder");
    plainTextEdit.setPlaceholderText(customPlaceholder);
    displayTranslator.translatePaintWidget(&plainTextEdit);
    if (!expectEqual(
            language + QStringLiteral(" plain-text unknown placeholder"),
            plainTextEdit.placeholderText(),
            customPlaceholder)
        || !expectEqual(
            language + QStringLiteral(" plain-text unknown document isolation"),
            plainTextEdit.toPlainText(),
            documentText)) {
        return false;
    }

    plainTextEdit.setPlaceholderText(singleIndexSource);
    displayTranslator.translatePaintWidget(&plainTextEdit);
    return expectEqual(
               language + QStringLiteral(" plain-text dynamic rewrite"),
               plainTextEdit.placeholderText(),
               QString::fromUtf8(expectation.singleIndexPlaceholder))
        && expectEqual(
            language + QStringLiteral(" plain-text dynamic document isolation"),
            plainTextEdit.toPlainText(),
            documentText);
}

bool verifySelectionValueProtection(const LocaleExpectation &expectation)
{
    const QString language = QString::fromLatin1(expectation.language);
    CavalryEmbeddedTranslator translator(language);
    CavalryDisplayTranslator displayTranslator(translator);

    // Lato 是已核实的字体族命中；Impact、Custom font、Bold Italic 是用户值负例。
    const QStringList selectionValues {
        QStringLiteral("Regular"), QStringLiteral("Bold"),
        QStringLiteral("Black"), QStringLiteral("Medium"),
        QStringLiteral("Lato"), QStringLiteral("Impact"),
        QStringLiteral("Custom font"), QStringLiteral("Bold Italic"),
    };
    for (const QString &source : {
             QStringLiteral("Regular"), QStringLiteral("Bold"),
             QStringLiteral("Black"), QStringLiteral("Medium"),
             QStringLiteral("Lato")}) {
        const QByteArray sourceUtf8 = source.toUtf8();
        const QString translated = translator.translate(
            nullptr, sourceUtf8.constData());
        if (!expectTrue(
                language + QStringLiteral(" confirmed font translation: ")
                    + source,
                !translated.isEmpty() && translated != source)) {
            return false;
        }
    }

    const auto identityFor = [](const QString &prefix, int index) {
        return prefix + QChar('-') + QString::number(index);
    };
    const auto addSelectionValues =
        [&identityFor, &selectionValues](QComboBox &comboBox,
                                         const QString &prefix) {
            for (int index = 0; index < selectionValues.size(); ++index) {
                comboBox.addItem(selectionValues.at(index),
                                 identityFor(prefix, index));
            }
        };
    const auto expectProtectedCombo =
        [](const QString &surface, QComboBox &comboBox,
           RoleRecordingModel &model, const ComboValueState &expected) {
            return expectComboValueState(surface, comboBox, expected)
                && expectTrue(
                    surface + QStringLiteral(" has no model writes"),
                    model.writtenRoles.isEmpty());
        };
    const auto translateWidget = [&displayTranslator](QWidget *widget) {
        displayTranslator.translateWidget(widget);
    };
    const auto translatePaintWidget =
        [&displayTranslator](QWidget *widget) {
            displayTranslator.translatePaintWidget(widget);
        };
    const auto checkProtectedCombo =
        [&expectProtectedCombo](const QString &surface, const auto &translate,
                                QComboBox &comboBox,
                                RoleRecordingModel &model,
                                const ComboValueState &expected) {
            model.writtenRoles.clear();
            translate(&comboBox);
            return expectProtectedCombo(surface, comboBox, model, expected);
        };

    RoleRecordingModel editableModel;
    QComboBox editableCombo;
    editableCombo.setEditable(true);
    editableCombo.setModel(&editableModel);
    addSelectionValues(editableCombo, QStringLiteral("editable"));
    editableCombo.setCurrentIndex(1);
    QLineEdit *const editableEditor = editableCombo.lineEdit();
    if (!expectTrue(
            language + QStringLiteral(" editable combo editor exists"),
            editableEditor != nullptr)) {
        return false;
    }

    // Bold 是三语确定命中的词，用作 placeholder 正向对照。
    const QString placeholderSource = QStringLiteral("Bold");
    editableEditor->setPlaceholderText(placeholderSource);
    const QString translatedPlaceholder = translator.translate(nullptr, "Bold");
    if (!expectTrue(
            language + QStringLiteral(" editable placeholder source hit"),
            !translatedPlaceholder.isEmpty()
                && translatedPlaceholder != placeholderSource)) {
        return false;
    }
    QStringList editorSignals;
    QObject::connect(
        editableEditor, &QLineEdit::textChanged, editableEditor,
        [&editorSignals](const QString &text) { editorSignals.append(text); });

    // QComboBox 的自定义 QTreeWidget popup 与宿主共用 popup model。
    auto *const popup = new QTreeWidget;
    popup->setColumnCount(1);
    QTreeWidgetItem *const popupHeader = popup->headerItem();
    popupHeader->setData(0, Qt::DisplayRole, QStringLiteral("Lato"));
    popupHeader->setData(0, Qt::UserRole, QStringLiteral("popup-header"));
    auto *const popupTop = new QTreeWidgetItem(popup);
    popupTop->setData(0, Qt::DisplayRole, QStringLiteral("Bold Italic"));
    popupTop->setData(0, Qt::UserRole, QStringLiteral("popup-top"));
    auto *const popupNested = new QTreeWidgetItem(popupTop);
    popupNested->setData(0, Qt::DisplayRole, QStringLiteral("Regular"));
    popupNested->setData(0, Qt::UserRole, QStringLiteral("popup-nested"));
    QComboBox popupCombo;
    popupCombo.setEditable(true);
    popupCombo.setModel(popup->model());
    popupCombo.setView(popup);
    popup->setCurrentItem(popupNested);

    const ComboValueState editableInitial = captureComboValueState(editableCombo);
    const QList<QTreeWidgetItem *> popupItems {
        popupHeader, popupTop, popupNested,
    };
    const QList<QVariant> popupUserValues {
        popupHeader->data(0, Qt::UserRole), popupTop->data(0, Qt::UserRole),
        popupNested->data(0, Qt::UserRole),
    };
    const QModelIndex popupCurrentIndex = popup->indexFromItem(popupNested, 0);
    const QStringList popupInitialDisplay {
        popupHeader->data(0, Qt::DisplayRole).toString(),
        popupTop->data(0, Qt::DisplayRole).toString(),
        popupNested->data(0, Qt::DisplayRole).toString(),
    };
    const auto expectPopup =
        [&](const QString &surface, const QStringList &expectedDisplay) {
            for (int index = 0; index < popupItems.size(); ++index) {
                QTreeWidgetItem *const item = popupItems.at(index);
                if (!expectEqual(
                        surface + QStringLiteral(" DisplayRole[")
                            + QString::number(index) + QChar(']'),
                        item->data(0, Qt::DisplayRole).toString(),
                        expectedDisplay.at(index))
                    || !expectEqual(
                        surface + QStringLiteral(" EditRole[")
                            + QString::number(index) + QChar(']'),
                        item->data(0, Qt::EditRole).toString(),
                        expectedDisplay.at(index))
                    || !expectTrue(
                        surface + QStringLiteral(" UserRole[")
                            + QString::number(index) + QChar(']'),
                        item->data(0, Qt::UserRole)
                            == popupUserValues.at(index))) {
                    return false;
                }
            }
            return expectTrue(
                       surface + QStringLiteral(" current item"),
                       popup->currentItem() == popupNested)
                && expectTrue(
                    surface + QStringLiteral(" current index"),
                    popup->indexFromItem(popupNested, 0)
                        == popupCurrentIndex);
        };
    const auto checkPopup =
        [&expectPopup, popup](const QString &surface, const auto &translate,
                              const QStringList &expectedDisplay) {
            translate(popup);
            return expectPopup(surface, expectedDisplay);
        };

    if (!checkProtectedCombo(
            language + QStringLiteral(" editable combo initial widget"),
            translateWidget, editableCombo, editableModel, editableInitial)) {
        return false;
    }
    displayTranslator.translateWidgetTree(&editableCombo);
    displayTranslator.translateWidgetTree(&popupCombo);
    if (!expectProtectedCombo(
            language + QStringLiteral(" editable combo initial tree"),
            editableCombo, editableModel, editableInitial)
        || !expectPopup(
            language + QStringLiteral(" editable tree popup initial"),
            popupInitialDisplay)
        || !expectEqual(
            language + QStringLiteral(" editable combo placeholder"),
            editableEditor->placeholderText(), translatedPlaceholder)
        || !expectTrue(
            language + QStringLiteral(" editable combo initial signals"),
            editorSignals.isEmpty())) {
        return false;
    }

    editableModel.setData(
        editableModel.index(0, editableCombo.modelColumn()),
        QStringLiteral("Black"), Qt::DisplayRole);
    const ComboValueState editableDynamic = captureComboValueState(editableCombo);
    if (!checkProtectedCombo(
            language + QStringLiteral(" editable combo dynamic widget"),
            translateWidget, editableCombo, editableModel, editableDynamic)
        || !checkProtectedCombo(
            language + QStringLiteral(" editable combo dynamic paint"),
            translatePaintWidget, editableCombo, editableModel, editableDynamic)) {
        return false;
    }

    popupTop->setData(0, Qt::DisplayRole, QStringLiteral("Medium"));
    QStringList popupDynamic = popupInitialDisplay;
    popupDynamic[1] = QStringLiteral("Medium");
    if (!checkPopup(
            language + QStringLiteral(" editable tree popup dynamic widget"),
            translateWidget, popupDynamic)) {
        return false;
    }
    popupNested->setData(0, Qt::DisplayRole, QStringLiteral("Lato"));
    popupDynamic[2] = QStringLiteral("Lato");
    if (!checkPopup(
            language + QStringLiteral(" editable tree popup dynamic paint"),
            translatePaintWidget, popupDynamic)) {
        return false;
    }

    const int signalCountBeforeLato = editorSignals.size();
    editableEditor->setText(QStringLiteral("Lato"));
    if (!expectEqual(
            language + QStringLiteral(" editable editor dynamic Lato"),
            editableEditor->text(), QStringLiteral("Lato"))
        || !expectTrue(
            language + QStringLiteral(" editable editor Lato signal"),
            editorSignals.size() == signalCountBeforeLato + 1
                && editorSignals.constLast() == QStringLiteral("Lato"))) {
        return false;
    }
    translatePaintWidget(editableEditor);
    const int signalCountBeforeCustom = editorSignals.size();
    editableEditor->setText(QStringLiteral("Bold Italic"));
    translateWidget(editableEditor);
    if (!expectEqual(
            language + QStringLiteral(" editable editor custom style"),
            editableEditor->text(), QStringLiteral("Bold Italic"))
        || !expectTrue(
            language + QStringLiteral(" editable editor custom signal"),
            editorSignals.size() == signalCountBeforeCustom + 1
                && editorSignals.constLast() == QStringLiteral("Bold Italic"))) {
        return false;
    }
    editableEditor->setPlaceholderText(placeholderSource);
    translatePaintWidget(editableEditor);
    if (!expectEqual(
            language + QStringLiteral(" editable editor dynamic placeholder"),
            editableEditor->placeholderText(), translatedPlaceholder)) {
        return false;
    }
    {
        QSignalBlocker blocker(editableEditor);
        editableEditor->setText(editableInitial.currentText);
    }
    if (!expectEqual(
            language + QStringLiteral(" editable combo selected text restore"),
            editableCombo.currentText(), editableInitial.currentText)
        || !expectTrue(
            language + QStringLiteral(" editable combo selected index restore"),
            editableCombo.currentIndex() == editableInitial.currentIndex)) {
        return false;
    }

    // QFontComboBox 即使 non-editable 也属于字体身份边界。
    RoleRecordingModel fontModel;
    QFontComboBox fontCombo;
    fontCombo.setModel(&fontModel);
    addSelectionValues(fontCombo, QStringLiteral("font"));
    fontCombo.setCurrentIndex(3);
    fontCombo.setEditable(false);
    const ComboValueState fontInitial = captureComboValueState(fontCombo);
    if (!checkProtectedCombo(
            language + QStringLiteral(" QFontComboBox initial"),
            translateWidget, fontCombo, fontModel, fontInitial)) {
        return false;
    }
    fontModel.setData(
        fontModel.index(0, fontCombo.modelColumn()),
        QStringLiteral("Lato"), Qt::DisplayRole);
    const ComboValueState fontDynamic = captureComboValueState(fontCombo);
    if (!checkProtectedCombo(
            language + QStringLiteral(" QFontComboBox dynamic widget"),
            translateWidget, fontCombo, fontModel, fontDynamic)
        || !checkProtectedCombo(
            language + QStringLiteral(" QFontComboBox dynamic paint"),
            translatePaintWidget, fontCombo, fontModel, fontDynamic)) {
        return false;
    }

    // 正对照：普通 non-editable Combo 仍翻译同一批词，且只写 DisplayRole。
    RoleRecordingModel ordinaryModel;
    QComboBox ordinaryCombo;
    ordinaryCombo.setModel(&ordinaryModel);
    const QStringList ordinaryValues {
        QStringLiteral("Regular"), QStringLiteral("Bold"),
        QStringLiteral("Lato"),
    };
    for (int index = 0; index < ordinaryValues.size(); ++index) {
        ordinaryCombo.addItem(
            ordinaryValues.at(index), identityFor(QStringLiteral("ordinary"), index));
    }
    ordinaryCombo.setCurrentIndex(0);
    const ComboValueState ordinaryInitial = captureComboValueState(ordinaryCombo);
    QStringList ordinaryTranslated;
    for (const QString &source : ordinaryValues) {
        const QByteArray sourceUtf8 = source.toUtf8();
        ordinaryTranslated.append(
            translator.translate(nullptr, sourceUtf8.constData()));
    }
    ordinaryModel.writtenRoles.clear();
    translateWidget(&ordinaryCombo);
    for (int index = 0; index < ordinaryValues.size(); ++index) {
        if (!expectEqual(
                language + QStringLiteral(" ordinary combo itemText[")
                    + QString::number(index) + QChar(']'),
                ordinaryCombo.itemText(index), ordinaryTranslated.at(index))) {
            return false;
        }
    }
    if (!expectTrue(
            language + QStringLiteral(" ordinary combo currentIndex"),
            ordinaryCombo.currentIndex() == ordinaryInitial.currentIndex)
        || !expectTrue(
            language + QStringLiteral(" ordinary combo UserRole"),
            ordinaryCombo.itemData(0, Qt::UserRole)
                == ordinaryInitial.userValues.at(0))
        || !expectTrue(
            language + QStringLiteral(" ordinary combo DisplayRole writes"),
            !ordinaryModel.writtenRoles.isEmpty()
                && std::all_of(
                    ordinaryModel.writtenRoles.cbegin(),
                    ordinaryModel.writtenRoles.cend(),
                    [](int role) { return role == Qt::DisplayRole; }))) {
        return false;
    }
    ordinaryModel.setData(
        ordinaryModel.index(0, ordinaryCombo.modelColumn()),
        QStringLiteral("Regular"), Qt::DisplayRole);
    ordinaryModel.writtenRoles.clear();
    translatePaintWidget(&ordinaryCombo);
    return expectEqual(
               language + QStringLiteral(" ordinary combo dynamic itemText"),
               ordinaryCombo.itemText(0), ordinaryTranslated.at(0))
        && expectTrue(
            language + QStringLiteral(" ordinary combo dynamic index"),
            ordinaryCombo.currentIndex() == ordinaryInitial.currentIndex)
        && expectTrue(
            language + QStringLiteral(" ordinary combo dynamic write"),
            ordinaryModel.writtenRoles.size() == 1
                && ordinaryModel.writtenRoles.constFirst() == Qt::DisplayRole);
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
    const QString exactPitchTranslation =
        translator.translate("CogTool", "Pitch Radius: ");
    const QString exactAddLayerTranslation =
        translator.translate(
            "SearchBarContainerWidget",
            "Add a layer to your Composition (%1)");
    const QString exactAddTagTranslation =
        translator.translate("cavalry::TagHeader", "Add Tag:");
    const QString exactSaveTranslation =
        translator.translate("ColorWindow", "Save...");
    const QString exactReplaceTranslation =
        translator.translate("assets::Window", "Replace...");
    const QString exactCreateTranslation =
        translator.translate(
            "assets::Window",
            "Create Composition based on %1");
    const QString exactComputeTimeTranslation =
        translator.translate("MenuBarManager", "Compute Time:");
    const QString exactDrawTimeTranslation =
        translator.translate("MenuBarManager", "Draw Time:");
    const QString exactTotalNodesTranslation =
        translator.translate("MenuBarManager", "Total Nodes:");
    const QString exactTrackingTranslation =
        translator.translate("MenuBarManager", "Tracking...");

    QLabel paletteName(QStringLiteral("Palette Name:"));
    QLabel missingAssets(QStringLiteral("This Scene has missing assets:"));
    QLabel softSelection(QStringLiteral("Soft Selection: "));
    QLabel strokeWidth(QStringLiteral("Stroke Width: "));
    QLabel capStyle(QStringLiteral("Cap Style: "));
    QLabel boundaryColor(QStringLiteral("Boundary Color"));
    ProjectStatisticsWindow statisticsWindow;
    QLabel computeTime(QStringLiteral("Compute Time:"), &statisticsWindow);
    QLabel drawTime(QStringLiteral("Draw Time:"), &statisticsWindow);
    QLabel totalNodes(QStringLiteral("Total Nodes:"), &statisticsWindow);
    QLabel unrelatedComputeTime(QStringLiteral("Compute Time:"));
    QLabel pitchRadius(QStringLiteral("Pitch Radius: "));
    QLineEdit placementUtility;
    placementUtility.setPlaceholderText(
        QStringLiteral("Click the + button to add a Placement Utility"));
    QWidget renderDialog;
    renderDialog.setWindowTitle(QStringLiteral("Delete Render Item(s)"));
    QWidget cavalryMainWindow;
    cavalryI18nSetMainWindowForTesting(&cavalryMainWindow);
    QDialog trackingWindow(&cavalryMainWindow);
    trackingWindow.setWindowTitle(QStringLiteral("Tracking..."));
    trackingWindow.setAttribute(Qt::WA_DeleteOnClose);
    QProgressBar trackingProgress(&trackingWindow);
    trackingProgress.setWindowModality(Qt::WindowModal);
    QPushButton trackingCancel(QStringLiteral("Cancel"), &trackingWindow);
    QWidget unrelatedMainWindow;
    QDialog sameShapeUnrelatedTrackingWindow(&unrelatedMainWindow);
    sameShapeUnrelatedTrackingWindow.setWindowTitle(
        QStringLiteral("Tracking..."));
    sameShapeUnrelatedTrackingWindow.setAttribute(Qt::WA_DeleteOnClose);
    QProgressBar sameShapeUnrelatedProgress(
        &sameShapeUnrelatedTrackingWindow);
    sameShapeUnrelatedProgress.setWindowModality(Qt::WindowModal);
    QPushButton sameShapeUnrelatedCancel(
        QStringLiteral("Cancel"),
        &sameShapeUnrelatedTrackingWindow);
    QDialog unrelatedTrackingWindow;
    unrelatedTrackingWindow.setWindowTitle(QStringLiteral("Tracking..."));
    QDialog incompleteTrackingWindow;
    incompleteTrackingWindow.setWindowTitle(QStringLiteral("Tracking..."));
    QProgressBar incompleteTrackingProgress(&incompleteTrackingWindow);
    QDialog wrongButtonTrackingWindow;
    wrongButtonTrackingWindow.setWindowTitle(QStringLiteral("Tracking..."));
    QProgressBar wrongButtonTrackingProgress(&wrongButtonTrackingWindow);
    QPushButton wrongTrackingButton(
        QStringLiteral("Continue"),
        &wrongButtonTrackingWindow);
    QAction paletteAction;
    paletteAction.setText(QStringLiteral("Set W3C Name"));
    paletteAction.setToolTip(QStringLiteral("Reveal in Explorer..."));
    QAction residualAction;
    residualAction.setText(QStringLiteral("Copy as PolyMesh"));
    QAction addTagAction;
    addTagAction.setText(QStringLiteral("Add Tag:"));
    QAction saveAction;
    saveAction.setText(QStringLiteral("Save..."));
    QAction replaceAction;
    replaceAction.setText(QStringLiteral("Replace..."));
    QMenu assetsContextMenu;
    QAction *assetsReplaceAction =
        assetsContextMenu.addAction(QStringLiteral("Replace..."));
    QAction *assetsCreateAction = assetsContextMenu.addAction(
        QStringLiteral("Create Composition based on replace-source"));
    QAction *assetsUnrelatedAction =
        assetsContextMenu.addAction(QStringLiteral("Custom user action"));
    QMenu unrelatedContextMenu;
    QAction *unrelatedReplaceAction =
        unrelatedContextMenu.addAction(QStringLiteral("Replace..."));
    QAction *unrelatedCreateAction = unrelatedContextMenu.addAction(
        QStringLiteral("Create Composition based on replace-source"));
    const QString addLayerWithShortcut =
        exactAddLayerTranslation.arg(QStringLiteral("Ctrl+."));
    const QString expectedAddLayerTranslation =
        language == QStringLiteral("zh-Hans")
        ? QString::fromUtf8("向合成添加图层 (%1)")
        : language == QStringLiteral("zh-Hant")
            ? QString::fromUtf8("向合成新增圖層 (%1)")
            : QString::fromUtf8("コンポジションにレイヤーを追加 (%1)");
    const QString numberedBookmark =
        translator.translate("cavalry::DGWindow", "Bookmark %1").arg(7);
    const std::array<const char *, 8> scopedSources {{
        "Add a layer to your Composition (%1)",
        "Add Tag:",
        "Save...",
        "Replace...",
        "Compute Time:",
        "Draw Time:",
        "Total Nodes:",
        "Tracking...",
    }};
    bool scopedFallbacksRemainEmpty = true;
    for (const char *source : scopedSources) {
        scopedFallbacksRemainEmpty =
            expectEqual(
                language + QStringLiteral(" scoped fallback isolation: ")
                    + QString::fromUtf8(source),
                translator.translate(nullptr, source),
                QString())
            && scopedFallbacksRemainEmpty;
    }

    displayTranslator.translateWidget(&paletteName);
    displayTranslator.translateWidget(&missingAssets);
    displayTranslator.translateWidget(&softSelection);
    displayTranslator.translateWidget(&strokeWidth);
    displayTranslator.translateWidget(&capStyle);
    displayTranslator.translateWidget(&boundaryColor);
    displayTranslator.translateWidgetTree(&statisticsWindow);
    displayTranslator.translateWidget(&unrelatedComputeTime);
    displayTranslator.translateWidget(&pitchRadius);
    displayTranslator.translateWidget(&placementUtility);
    displayTranslator.translateWidget(&renderDialog);
    displayTranslator.translateWidgetTree(&trackingWindow);
    displayTranslator.translateWidgetTree(
        &sameShapeUnrelatedTrackingWindow);
    displayTranslator.translateWidgetTree(&unrelatedTrackingWindow);
    displayTranslator.translateWidgetTree(&incompleteTrackingWindow);
    displayTranslator.translateWidgetTree(&wrongButtonTrackingWindow);
    displayTranslator.translateAction(&paletteAction);
    displayTranslator.translateAction(&residualAction);
    displayTranslator.translateAction(&addTagAction);
    displayTranslator.translateAction(&saveAction);
    displayTranslator.translateAction(&replaceAction);
    displayTranslator.translateAssetsContextMenu(&assetsContextMenu);
    displayTranslator.translateMenu(&unrelatedContextMenu);

    const bool passed = expectEqual(
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
               language + QStringLiteral(" exact Stroke Width label"),
               strokeWidth.text(),
               expectedTranslation("Stroke Width: "))
        && expectEqual(
               language + QStringLiteral(" exact Cap Style label"),
               capStyle.text(),
               expectedTranslation("Cap Style: "))
        && expectEqual(
               language + QStringLiteral(" boundary color label"),
               boundaryColor.text(),
               expectedTranslation("Boundary Color"))
        && expectEqual(
               language + QStringLiteral(" compute-time label"),
               computeTime.text(),
               exactComputeTimeTranslation)
        && expectEqual(
               language + QStringLiteral(" draw-time label"),
               drawTime.text(),
               exactDrawTimeTranslation)
        && expectEqual(
               language + QStringLiteral(" total-nodes label"),
               totalNodes.text(),
               exactTotalNodesTranslation)
        && expectEqual(
               language
                   + QStringLiteral(" unrelated Project Statistics text isolation"),
               unrelatedComputeTime.text(),
               QStringLiteral("Compute Time:"))
        && expectEqual(
               language + QStringLiteral(" Placement Utility placeholder"),
               placementUtility.placeholderText(),
               expectedTranslation(
                   "Click the + button to add a Placement Utility"))
        && expectEqual(
               language + QStringLiteral(" render dialog title"),
               renderDialog.windowTitle(),
               expectedTranslation("Delete Render Item(s)"))
        && expectEqual(
               language + QStringLiteral(" tracking window title"),
               trackingWindow.windowTitle(),
               exactTrackingTranslation)
        && expectEqual(
               language
                   + QStringLiteral(" same-shape unrelated Tracking isolation"),
               sameShapeUnrelatedTrackingWindow.windowTitle(),
               QStringLiteral("Tracking..."))
        && expectEqual(
               language + QStringLiteral(" unrelated Tracking dialog isolation"),
               unrelatedTrackingWindow.windowTitle(),
               QStringLiteral("Tracking..."))
        && expectEqual(
               language + QStringLiteral(" incomplete Tracking dialog isolation"),
               incompleteTrackingWindow.windowTitle(),
               QStringLiteral("Tracking..."))
        && expectEqual(
               language + QStringLiteral(" wrong-button Tracking dialog isolation"),
               wrongButtonTrackingWindow.windowTitle(),
               QStringLiteral("Tracking..."))
        && expectEqual(
               language + QStringLiteral(" palette action"),
               paletteAction.text(),
               expectedTranslation("Set W3C Name"))
        && expectEqual(
               language + QStringLiteral(" Explorer action tooltip"),
               paletteAction.toolTip(),
               expectedTranslation("Reveal in Explorer..."))
        && expectEqual(
               language + QStringLiteral(" PolyMesh context action"),
               residualAction.text(),
               expectedTranslation("Copy as PolyMesh"))
        && expectEqual(
               language + QStringLiteral(" source-only Add Tag isolation"),
               addTagAction.text(),
               QStringLiteral("Add Tag:"))
        && expectEqual(
               language + QStringLiteral(" source-only Save isolation"),
               saveAction.text(),
               QStringLiteral("Save..."))
        && expectEqual(
               language + QStringLiteral(" source-only Replace isolation"),
               replaceAction.text(),
               QStringLiteral("Replace..."))
        && expectEqual(
               language + QStringLiteral(" Assets producer Replace"),
               assetsReplaceAction->text(),
               exactReplaceTranslation)
        && expectEqual(
               language + QStringLiteral(" Assets producer Create template"),
               assetsCreateAction->text(),
               exactCreateTranslation.arg(QStringLiteral("replace-source")))
        && expectEqual(
               language + QStringLiteral(" Assets producer unrelated isolation"),
               assetsUnrelatedAction->text(),
               QStringLiteral("Custom user action"))
        && expectEqual(
               language + QStringLiteral(" unrelated menu Replace isolation"),
               unrelatedReplaceAction->text(),
               QStringLiteral("Replace..."))
        && expectEqual(
               language + QStringLiteral(" unrelated menu Create isolation"),
               unrelatedCreateAction->text(),
               QStringLiteral(
                   "Create Composition based on replace-source"))
        && expectEqual(
               language + QStringLiteral(" exact Tag Header Add Tag"),
               exactAddTagTranslation,
               language == QStringLiteral("zh-Hans")
                   ? QString::fromUtf8("添加标签：")
                   : language == QStringLiteral("zh-Hant")
                       ? QString::fromUtf8("新增標籤：")
                       : QString::fromUtf8("タグを追加："))
        && expectEqual(
               language + QStringLiteral(" exact Color Window Save"),
               exactSaveTranslation,
               language == QStringLiteral("zh-Hans")
                   ? QString::fromUtf8("保存…")
                   : language == QStringLiteral("zh-Hant")
                       ? QString::fromUtf8("儲存…")
                       : QString::fromUtf8("保存…"))
        && expectEqual(
               language + QStringLiteral(" exact Assets Window Replace"),
               exactReplaceTranslation,
               language == QStringLiteral("zh-Hans")
                   ? QString::fromUtf8("替换…")
                   : language == QStringLiteral("zh-Hant")
                       ? QString::fromUtf8("取代…")
                       : QString::fromUtf8("置換…"))
        && expectEqual(
               language + QStringLiteral(" Search Bar add-layer template"),
               addLayerWithShortcut,
               expectedAddLayerTranslation.arg(QStringLiteral("Ctrl+.")))
        && expectEqual(
               language + QStringLiteral(" numbered bookmark template"),
               numberedBookmark,
               expectedTranslation("Bookmark %1").arg(7))
        && expectEqual(
               language + QStringLiteral(" context-only Pitch Radius label"),
               pitchRadius.text(),
               QStringLiteral("Pitch Radius: "))
        && expectEqual(
               language + QStringLiteral(" exact CogTool Pitch Radius"),
               exactPitchTranslation,
               language == QStringLiteral("zh-Hans")
                   ? QString::fromUtf8("节圆半径： ")
                   : language == QStringLiteral("zh-Hant")
                       ? QString::fromUtf8("節圓半徑： ")
                       : QString::fromUtf8("ピッチ半径： "))
        && scopedFallbacksRemainEmpty;
    cavalryI18nSetMainWindowForTesting(nullptr);
    return passed;
}

bool verifyDynamicLabelTranslations(const LocaleExpectation &expectation)
{
    const QString language = QString::fromLatin1(expectation.language);
    struct DynamicLabelCase {
        const char *source;
        const char *expected[3];
    };
    const DynamicLabelCase positiveCases[] {
        { "0 selected", { "已选择 0 个", "已選取 0 個", "0 個を選択中" } },
        { "12345 selected",
          { "已选择 12345 个", "已選取 12345 個", "12345 個を選択中" } },
        {
            "Cavalry is offline. You will need to re-authenticate in less "
            "than 0 days.",
            {
                "Cavalry 已离线。你需要在不到 0 天内重新认证。",
                "Cavalry 已離線。你需要在不到 0 天內重新驗證。",
                "Cavalry はオフラインです。0 日以内に再認証が必要です。",
            },
        },
        {
            "Cavalry is offline. You will need to re-authenticate in less "
            "than \t 12345 \t days.",
            {
                "Cavalry 已离线。你需要在不到 12345 天内重新认证。",
                "Cavalry 已離線。你需要在不到 12345 天內重新驗證。",
                "Cavalry はオフラインです。12345 日以内に再認証が必要です。",
            },
        },
    };
    const int languageIndex = language == QStringLiteral("zh-Hans") ? 0
        : (language == QStringLiteral("zh-Hant") ? 1 : 2);
    for (const DynamicLabelCase &testCase : positiveCases) {
        if (!expectEqual(
                language + QStringLiteral(" dynamic label rule"),
                cavalryI18nDynamicLabelTranslation(
                    QString::fromLatin1(testCase.source),
                    language),
                QString::fromUtf8(testCase.expected[languageIndex]))) {
            return false;
        }
    }
    const QStringList nearMisses {
        QStringLiteral("12selected"),
        QStringLiteral("12 Selected"),
        QStringLiteral("12 selected "),
        QStringLiteral("12  selected"),
        QStringLiteral("12\tselected"),
        QStringLiteral(
            "Cavalry is offline. You will need to re-authenticate in less "
            "than -1 days."),
        QStringLiteral(
            "Cavalry is offline. You will need to re-authenticate in less "
            "than 1 day."),
        QStringLiteral(
            "Cavalry is offline. You will need to re-authenticate in less "
            "than 1 days"),
    };
    for (const QString &nearMiss : nearMisses) {
        if (!expectEqual(
                language + QStringLiteral(" dynamic QLabel near miss: ")
                    + nearMiss,
                cavalryI18nDynamicLabelTranslation(nearMiss, language),
                QString())) {
            return false;
        }
    }
    CavalryEmbeddedTranslator translator(language);
    CavalryDisplayTranslator displayTranslator(translator);
    const QString offlineSource =
        QStringLiteral(
            "Cavalry is offline. You will need to re-authenticate in less "
            "than 42 days.");
    QLabel dynamicLabel(offlineSource);
    QLineEdit modelBoundInput(offlineSource);
    displayTranslator.translateWidget(&dynamicLabel);
    displayTranslator.translateWidget(&modelBoundInput);
    if (!expectEqual(
            language + QStringLiteral(" dynamic QLabel projection"),
            dynamicLabel.text(),
            cavalryI18nDynamicLabelTranslation(offlineSource, language))
        || !expectEqual(
            language + QStringLiteral(" dynamic QLabel QLineEdit isolation"),
            modelBoundInput.text(),
            offlineSource)) {
        return false;
    }
    dynamicLabel.setText(
        QStringLiteral("67890 selected"));
    displayTranslator.translatePaintWidget(&dynamicLabel);
    if (!expectEqual(
            language + QStringLiteral(" dynamic QLabel English rewrite"),
            dynamicLabel.text(),
            cavalryI18nDynamicLabelTranslation(
                QStringLiteral("67890 selected"),
                language))) {
        return false;
    }

    QLabel unrelatedMeshText(QStringLiteral("Points: 12"));
    displayTranslator.translateWidget(&unrelatedMeshText);
    if (!expectEqual(
            language + QStringLiteral(
                " unrelated Mesh Explorer text isolation"),
            unrelatedMeshText.text(),
            QStringLiteral("Points: 12"))) {
        return false;
    }

    MeshExplorerRowWidget meshExplorerRow;
    QLabel meshIndex(QStringLiteral("Index: 7"), &meshExplorerRow);
    QLabel meshPoints(QStringLiteral("Points: 12"), &meshExplorerRow);
    QLabel meshVerbs(QStringLiteral("Verbs: 34"), &meshExplorerRow);
    QLabel childMeshes(
        QStringLiteral("Child Meshes: 56"),
        &meshExplorerRow);
    QLabel leadingZeroNearMiss(
        QStringLiteral("Points: 01"),
        &meshExplorerRow);
    QLineEdit modelBoundMeshText(QStringLiteral("Points: 12"));
    for (QLabel *label
         : { &meshIndex,
             &meshPoints,
             &meshVerbs,
             &childMeshes,
             &leadingZeroNearMiss }) {
        displayTranslator.translateWidget(label);
    }
    displayTranslator.translateWidget(&modelBoundMeshText);
    if (!expectEqual(
            language + QStringLiteral(" Mesh Explorer index"),
            meshIndex.text(),
            translator.translate(
                "MeshExplorerRowWidget",
                "Index: ") + QStringLiteral("7"))
        || !expectEqual(
            language + QStringLiteral(" Mesh Explorer points"),
            meshPoints.text(),
            translator.translate(
                "MeshExplorerRowWidget",
                "Points: %1").arg(12))
        || !expectEqual(
            language + QStringLiteral(" Mesh Explorer verbs"),
            meshVerbs.text(),
            translator.translate(
                "MeshExplorerRowWidget",
                "Verbs: %1").arg(34))
        || !expectEqual(
            language + QStringLiteral(" Mesh Explorer child meshes"),
            childMeshes.text(),
            translator.translate(
                "MeshExplorerRowWidget",
                "Child Meshes: %1").arg(56))
        || !expectEqual(
            language + QStringLiteral(" Mesh Explorer leading-zero rejection"),
            leadingZeroNearMiss.text(),
            QStringLiteral("Points: 01"))
        || !expectEqual(
            language + QStringLiteral(" Mesh Explorer QLineEdit isolation"),
            modelBoundMeshText.text(),
            QStringLiteral("Points: 12"))) {
        return false;
    }

    meshPoints.setText(QStringLiteral("Points: 99"));
    displayTranslator.translatePaintWidget(&meshPoints);
    return expectEqual(
        language + QStringLiteral(" Mesh Explorer dynamic rewrite"),
        meshPoints.text(),
        translator.translate(
            "MeshExplorerRowWidget",
            "Points: %1").arg(99));
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
    comboBox.addItem(
        QStringLiteral("Automatic (sRGB)"),
        QStringLiteral("automatic-srgb-identity"));
    comboBox.addItem(
        QStringLiteral("Automatic(sRGB)"),
        QStringLiteral("automatic-near-miss-identity"));
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
            language + QStringLiteral(
                " unrelated Automatic combo isolation"),
            comboBox.itemText(3),
            QStringLiteral("Automatic (sRGB)"))
        || !expectEqual(
            language + QStringLiteral(" Automatic near-miss display"),
            comboBox.itemText(4),
            QStringLiteral("Automatic(sRGB)"))
        || !expectEqual(
            language + QStringLiteral(" Rectangle identity"),
            comboBox.itemData(0, Qt::UserRole).toString(),
            QStringLiteral("rectangle-identity"))
        || !expectEqual(
            language + QStringLiteral(" Circle identity"),
            comboBox.itemData(1, Qt::UserRole).toString(),
            QStringLiteral("circle-identity"))
        || !expectEqual(
            language + QStringLiteral(" Automatic color-space identity"),
            comboBox.itemData(3, Qt::UserRole).toString(),
            QStringLiteral("automatic-srgb-identity"))
        || !expectEqual(
            language + QStringLiteral(" Automatic near-miss identity"),
            comboBox.itemData(4, Qt::UserRole).toString(),
            QStringLiteral("automatic-near-miss-identity"))
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

    QDialog colorSettingsDialog;
    colorSettingsDialog.setWindowTitle(
        QStringLiteral("Color Settings"));
    QComboBox colorSettingsCombo(&colorSettingsDialog);
    RoleRecordingModel colorSettingsModel;
    colorSettingsCombo.setModel(&colorSettingsModel);
    colorSettingsCombo.addItem(
        QStringLiteral("Automatic (sRGB)"),
        QStringLiteral("automatic-srgb-identity"));
    colorSettingsCombo.addItem(
        QStringLiteral("Automatic(sRGB)"),
        QStringLiteral("automatic-near-miss-identity"));
    colorSettingsCombo.setCurrentIndex(1);
    colorSettingsModel.writtenRoles.clear();
    displayTranslator.translateWidget(&colorSettingsCombo);
    if (!expectEqual(
            language + QStringLiteral(" Color Settings Automatic display"),
            colorSettingsCombo.itemText(0),
            QString::fromUtf8(expectation.automaticColorSpace))
        || !expectEqual(
            language + QStringLiteral(
                " Color Settings Automatic near-miss"),
            colorSettingsCombo.itemText(1),
            QStringLiteral("Automatic(sRGB)"))
        || !expectEqual(
            language + QStringLiteral(" Color Settings Automatic identity"),
            colorSettingsCombo.itemData(0, Qt::UserRole).toString(),
            QStringLiteral("automatic-srgb-identity"))
        || !expectTrue(
            language + QStringLiteral(
                " Color Settings Automatic currentIndex"),
            colorSettingsCombo.currentIndex() == 1)
        || !expectTrue(
            language + QStringLiteral(
                " Color Settings Automatic DisplayRole-only write"),
            colorSettingsModel.writtenRoles.size() == 1
                && colorSettingsModel.writtenRoles.constFirst()
                    == Qt::DisplayRole)) {
        return false;
    }

    colorSettingsModel.setData(
        colorSettingsModel.index(
            0,
            colorSettingsCombo.modelColumn()),
        QStringLiteral("Automatic (sRGB)"),
        Qt::DisplayRole);
    colorSettingsModel.writtenRoles.clear();
    colorSettingsDialog.setWindowTitle(
        translator.translate(nullptr, "Color Settings"));
    displayTranslator.translatePaintWidget(&colorSettingsCombo);
    if (!expectEqual(
            language + QStringLiteral(" dynamic Automatic rewrite"),
            colorSettingsCombo.itemText(0),
            QString::fromUtf8(expectation.automaticColorSpace))
        || !expectEqual(
            language + QStringLiteral(" dynamic Automatic identity"),
            colorSettingsCombo.itemData(0, Qt::UserRole).toString(),
            QStringLiteral("automatic-srgb-identity"))
        || !expectTrue(
            language + QStringLiteral(" dynamic Automatic currentIndex"),
            colorSettingsCombo.currentIndex() == 1)
        || !expectTrue(
            language + QStringLiteral(
                " dynamic Automatic DisplayRole-only write"),
            colorSettingsModel.writtenRoles.size() == 1
                && colorSettingsModel.writtenRoles.constFirst()
                    == Qt::DisplayRole)) {
        return false;
    }

    return verifyCompoundRuntimeTooltips(expectation)
        && verifyEvidencedResidualWidgets(language)
        && verifyDynamicLabelTranslations(expectation)
        && verifyTreeWidgetDisplay(expectation)
        && verifyLineEditDisplay(expectation)
        && verifySelectionValueProtection(expectation);
}

} // namespace

int main(int argc, char *argv[])
{
    QApplication application(argc, argv);

    const LocaleExpectation expectations[] {
        { "zh-Hans", "合成", "矩形", "圆形", "默认关键帧图层", "工具箱", "退出", "自动（sRGB）", "输入索引，例如：0" },
        { "zh-Hant", "合成", "矩形", "圓形", "預設關鍵影格圖層", "工具箱", "結束", "自動（sRGB）", "輸入索引，例如：0" },
        { "ja_JP", "コンポジション", "長方形", "円", "既定キーフレームレイヤー", "ツールボックス", "終了", "自動（sRGB）", "インデックスを入力（例：0）" },
    };

    for (const LocaleExpectation &expectation : expectations) {
        if (!verifyLocale(expectation)) {
            return 1;
        }
    }

    return 0;
}

#include "cavalry_i18n_display_test.moc"
