/**
 * [INPUT]: 依赖 macOS 生产注入器翻译入口、Qt 6.6.3 Widgets 与显式只读 vendor Frameworks 链接输入
 * [OUTPUT]: 对外提供三语普通输入框与选择值回归程序，验证初始化、信号回调、Paint、只读切换及弹出列表不污染业务值，提示文字仍翻译
 * [POS]: tools 的 macOS 原生回归测试；直接编译生产实现，不启动或改写 Cavalry，不把 Qt fixture 结果冒充真实字体渲染验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "../injector/cavalry_i18n_input_policy.h"
#include "../injector/CavalryTranslatorInjector.mm"
#include <QtWidgets/QFontComboBox>

namespace {
int failures = 0;

void expect(bool condition, const char *message)
{
    if (!condition) {
        fprintf(stderr, "FAIL: %s\n", message);
        ++failures;
    }
}

void translate(QWidget *widget, const QString &language)
{
    QSet<QAction *> actions;
    translateQtWidgetTexts(widget, language, actions);
}

void verifyOrdinaryLineEdits(const QString &language)
{
    const QStringList values = {
        QStringLiteral("Text"),
        QStringLiteral("Bold"),
        QStringLiteral("Control33"),
    };
    const QString expectedPlaceholder = translatedWidgetText(language, QStringLiteral("Bold"));
    expect(!expectedPlaceholder.isEmpty() && expectedPlaceholder != QStringLiteral("Bold"),
           "ordinary line edit placeholder has a display translation");

    for (int i = 0; i < values.size(); ++i) {
        QLineEdit direct;
        direct.setText(values.at(i));
        direct.setPlaceholderText(QStringLiteral("Bold"));
        int directTextChanged = 0;
        QObject::connect(&direct, &QLineEdit::textChanged,
                         [&directTextChanged](const QString &) { ++directTextChanged; });
        translateLineEditDisplayText(&direct, language);
        expect(direct.text() == values.at(i),
               "direct ordinary line edit preserves Text/Bold/Control33");
        expect(directTextChanged == 0,
               "direct line edit translation does not emit textChanged");
        expect(direct.placeholderText() == expectedPlaceholder,
               "direct line edit placeholder still translates");

        QLineEdit callback;
        callback.setText(values.at(i));
        callback.setPlaceholderText(QStringLiteral("Bold"));
        int callbackTextChanged = 0;
        QObject::connect(&callback, &QLineEdit::textChanged,
                         [&callbackTextChanged](const QString &) { ++callbackTextChanged; });
        hookLineEditTextChanges(&callback, language);
        expect(callback.text() == values.at(i),
               "textChanged hook preserves initial ordinary line edit value");
        expect(callbackTextChanged == 0,
               "textChanged hook does not rewrite the initial value");
        expect(callback.placeholderText() == expectedPlaceholder,
               "textChanged hook still translates placeholder");
        const QString callbackReplacement = values.at((i + 1) % values.size());
        callback.setText(callbackReplacement);
        expect(callback.text() == callbackReplacement,
               "textChanged hook preserves a later edited value");
        expect(callbackTextChanged == 1,
               "ordinary line edit emits exactly its own edit signal");

        QLineEdit painted;
        painted.setText(values.at(i));
        painted.setPlaceholderText(QStringLiteral("Bold"));
        int paintTextChanged = 0;
        QObject::connect(&painted, &QLineEdit::textChanged,
                         [&paintTextChanged](const QString &) { ++paintTextChanged; });
        translateLineEditBeforePaint(&painted, language);
        expect(painted.text() == values.at(i),
               "Paint path preserves ordinary line edit value");
        expect(paintTextChanged == 0,
               "Paint path does not emit textChanged while translating");
        expect(painted.placeholderText() == expectedPlaceholder,
               "Paint path still translates placeholder");
        const QString paintReplacement = values.at((i + 2) % values.size());
        painted.setText(paintReplacement);
        translateLineEditBeforePaint(&painted, language);
        expect(painted.text() == paintReplacement,
               "Paint path preserves a later ordinary line edit value");
        expect(paintTextChanged == 1,
               "Paint path does not add a second textChanged signal");

        auto *parentless = new QLineEdit;
        parentless->setText(values.at(i));
        parentless->setPlaceholderText(QStringLiteral("Bold"));
        int parentlessTextChanged = 0;
        QObject::connect(parentless, &QLineEdit::textChanged,
                         [&parentlessTextChanged](const QString &) { ++parentlessTextChanged; });
        translate(parentless, language);
        expect(parentless->text() == values.at(i),
               "parentless initialization preserves ordinary line edit value");
        expect(parentlessTextChanged == 0,
               "parentless initialization does not emit textChanged");
        expect(parentless->placeholderText() == expectedPlaceholder,
               "parentless initialization still translates placeholder");
        translateLineEditBeforePaint(parentless, language);
        expect(parentless->text() == values.at(i),
               "parentless Paint path preserves ordinary line edit value");
        expect(parentlessTextChanged == 0,
               "parentless Paint path does not emit textChanged");
        delete parentless;
    }

    QLineEdit readOnlyThenEditable;
    readOnlyThenEditable.setReadOnly(true);
    readOnlyThenEditable.setText(QStringLiteral("Text"));
    readOnlyThenEditable.setPlaceholderText(QStringLiteral("Bold"));
    int transitionTextChanged = 0;
    QObject::connect(&readOnlyThenEditable, &QLineEdit::textChanged,
                     [&transitionTextChanged](const QString &) { ++transitionTextChanged; });
    translate(&readOnlyThenEditable, language);
    expect(readOnlyThenEditable.text() == QStringLiteral("Text"),
           "read-only line edit preserves its initial name");
    readOnlyThenEditable.setReadOnly(false);
    readOnlyThenEditable.setText(QStringLiteral("Bold"));
    translateLineEditBeforePaint(&readOnlyThenEditable, language);
    expect(readOnlyThenEditable.text() == QStringLiteral("Bold"),
           "read-only to editable transition preserves the committed value");
    expect(transitionTextChanged == 1,
           "read-only to editable transition emits only the real edit signal");
    expect(readOnlyThenEditable.placeholderText() == expectedPlaceholder,
           "read-only to editable transition keeps translated placeholder");
}

void verifySelection(const QString &language)
{
    rebuildTranslationCache(language);
    verifyOrdinaryLineEdits(language);
    const QStringList values = {"Regular", "Bold", "Black", "Medium", "Lato", "Impact",
                                "Bold Italic", "Custom Font Family"};
    expect(!translatedWidgetText(language, "Lato").isEmpty(), "font family Lato has a translation");
    QComboBox combo;
    combo.setEditable(true);
    combo.addItems(values);
    for (int i = 0; i < values.size(); ++i) {
        combo.setItemData(i, values[i], Qt::UserRole);
    }
    combo.lineEdit()->setPlaceholderText("Bold");
    translate(&combo, language);
    translate(combo.lineEdit(), language);
    const QString placeholder = translatedWidgetText(language, "Bold");
    expect(!placeholder.isEmpty() && combo.lineEdit()->placeholderText() == placeholder,
           "editable combo placeholder still translates");
    for (int i = 0; i < values.size(); ++i) {
        combo.setCurrentIndex(i);
        translateLineEditBeforePaint(combo.lineEdit(), language);
        translate(&combo, language);
        expect(combo.currentIndex() == i, "selection index unchanged");
        expect(combo.currentText() == values[i], "selected business value unchanged");
        expect(combo.itemText(i) == values[i], "option unchanged");
        expect(combo.itemData(i, Qt::EditRole).toString() == values[i], "EditRole unchanged");
        expect(combo.itemData(i, Qt::UserRole).toString() == values[i], "UserRole unchanged");
        combo.lineEdit()->setText(values[(i + 1) % values.size()]);
        expect(combo.lineEdit()->text() == values[(i + 1) % values.size()],
               "textChanged callback preserves edited value");
    }

    // ---- 正对照：保护来自输入语义，而不是删除词典中的 Bold ----------------
    QLabel label("Bold");
    translate(&label, language);
    expect(!translatedWidgetText(language, "Bold").isEmpty(), "Bold has a translation");
    expect(label.text() == translatedWidgetText(language, "Bold"), "ordinary label translates");
    QComboBox displayOnly;
    displayOnly.addItem("Bold");
    translate(&displayOnly, language);
    expect(displayOnly.itemText(0) == label.text(), "noneditable display combo still translates");

    QFontComboBox font;
    font.setEditable(false);
    font.clear();
    font.addItem("Bold");
    translate(&font, language);
    expect(font.itemText(0) == "Bold", "noneditable font combo preserves family");

    // ---- 自定义弹出列表与树也不能成为绕过 Combo 保护的回写入口 ------------
    QComboBox listCombo;
    listCombo.setEditable(true);
    auto *list = new QListWidget;
    list->addItems(values);
    listCombo.setModel(list->model());
    listCombo.setView(list);
    expect(cavalry_i18n::preservesSelectionValue(list), "popup has protected owner");
    translateListWidgetItems(list, language);
    expect(list->item(1)->text() == "Bold", "list popup preserves option");

    QComboBox treeCombo;
    treeCombo.setEditable(true);
    auto *tree = new QTreeWidget;
    auto *item = new QTreeWidgetItem(tree, QStringList{"Bold"});
    tree->setHeaderLabel("Bold");
    treeCombo.setModel(tree->model());
    treeCombo.setView(tree);
    translateTreeWidgetItem(tree, item, language);
    translate(tree, language);
    expect(item->text(0) == "Bold", "tree popup preserves option");
    expect(tree->headerItem()->text(0) == "Bold", "tree popup preserves header");

    QComboBox tableCombo;
    tableCombo.setEditable(true);
    auto *table = new QTableWidget(1, 1);
    table->setItem(0, 0, new QTableWidgetItem("Bold"));
    table->setHorizontalHeaderLabels(QStringList{"Bold"});
    table->setVerticalHeaderLabels(QStringList{"Medium"});
    tableCombo.setModel(table->model());
    tableCombo.setView(table);
    translateTableWidgetItems(table, language);
    translate(table, language);
    expect(table->item(0, 0)->text() == "Bold", "table popup preserves option");
    expect(table->horizontalHeaderItem(0)->text() == "Bold", "table popup preserves column header");
    expect(table->verticalHeaderItem(0)->text() == "Medium", "table popup preserves row header");
}
} // namespace

int main(int argc, char **argv)
{
    // 只直调生产入口；禁止测试构造器启动真实 app 的 bootstrap/capture 生命周期。
    gInstallAttempted = true;
    QApplication app(argc, argv);
    for (const auto &language : {"zh-Hans", "zh-Hant", "ja_JP"}) {
        verifySelection(QString::fromLatin1(language));
    }
    fprintf(stderr, "macOS selection-value fixture: %d failures\n", failures);
    return failures ? 1 : 0;
}
