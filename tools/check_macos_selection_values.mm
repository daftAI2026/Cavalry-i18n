/**
 * [INPUT]: 依赖 macOS 生产注入器翻译入口、Qt 6.6.3 Widgets 与显式只读 vendor Frameworks 链接输入
 * [OUTPUT]: 对外提供三语选择输入值回归可执行程序，验证初始化、信号回调、Paint 回补及弹出列表不污染业务值
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

void verifySelection(const QString &language)
{
    rebuildTranslationCache(language);
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
