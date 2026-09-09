/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator 的精确 source/context 查询，共享选择/补全输入值保护策略，以及 Qt Widgets 的公开显示属性、QComboBox/QTreeWidget DisplayRole、QLineEdit/QPlainTextEdit、菜单事件、Windows vendor 主窗口/Assets producer 身份与已验证 CavalryUI `ListWidget::setPlaceholder`/`this+0x28` ABI
 * [OUTPUT]: 对外提供幂等的 QWidget/QAction 主动翻译、已知基名数字后缀、来源绑定的受控动态模板、真实 Assets 菜单模板投影、输入框显示值、QTreeWidget 递归 DisplayRole 刷新、exact Classic `ListWidget`/真实 viewport 选择器与 `No Results` placeholder 投影，以及测试态主窗口/placeholder 访问注入缝
 * [POS]: injector/windows 的显示层边界，保护可编辑/字体 Combo 及其后代原值和所有 CompleterLineEdit 输入，只改其外部受控可见文案、下拉框/树的 DisplayRole、词表命中的非补全 QLineEdit、经运行时证明的厂商父系/producer 表面和 exact Classic 空结果 placeholder；未知输入、编辑器正文、UserRole、currentIndex、无关同文控件、普通 item view 与非真实 viewport 保持原值
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QByteArray>
#include <QtCore/QHash>
#include <QtCore/QObject>
#include <QtCore/QSet>
#include <QtCore/QString>

#include <functional>

class QAction;
class QComboBox;
class QLineEdit;
class QMenu;
class QPlainTextEdit;
class QListWidget;
class QTreeWidget;
class QTreeWidgetItem;
class QWidget;
class CavalryEmbeddedTranslator;

namespace cavalry_i18n {

// 仅接受 exact Classic ListWidget 本体或其真实 viewport；普通 item view/child 均拒绝。
bool isClassicQuickAddPlaceholderSurface(
    const QWidget *surface) noexcept;

} // namespace cavalry_i18n

#ifdef CAVALRY_I18N_TESTING
void cavalryI18nSetMainWindowForTesting(QWidget *mainWindow);
#endif

class CavalryDisplayTranslator final : public QObject
{
public:
    explicit CavalryDisplayTranslator(
        CavalryEmbeddedTranslator &translator,
        QObject *parent = nullptr);

    void translateAssetsContextMenu(QMenu *menu);
    void translateAction(QAction *action);
    void translateMenu(QMenu *menu);
    void translatePaintWidget(QWidget *widget);
    void translateWidget(QWidget *widget);
    void translateWidgetTree(QWidget *root);

#ifdef CAVALRY_I18N_TESTING
    using ClassicQuickAddPlaceholderReaderForTesting =
        std::function<QString(const QWidget *)>;
    using ClassicQuickAddPlaceholderSetterForTesting =
        std::function<void(QWidget *, const QString &)>;

    void setClassicQuickAddPlaceholderAccessForTesting(
        ClassicQuickAddPlaceholderReaderForTesting reader,
        ClassicQuickAddPlaceholderSetterForTesting setter);
#endif

private:
    QString translationFor(const QString &source) const;
    void applyTranslation(
        QObject *object,
        const QByteArray &property,
        const QString &current,
        const std::function<void(const QString &)> &setter);
    void hookAction(QAction *action);
    void hookLineEdit(QLineEdit *lineEdit);
    void hookMenu(QMenu *menu);
    void hookTreeWidget(QTreeWidget *treeWidget);
    void trackObject(QObject *object);
    void translateComboBoxDisplay(QComboBox *comboBox);
    void translateLineEditDisplay(QLineEdit *lineEdit);
    void translatePlainTextEditDisplay(QPlainTextEdit *plainTextEdit);
    void translateTreeWidgetDisplay(QTreeWidget *treeWidget);
    void translateTreeWidgetItemDisplay(QTreeWidgetItem *item);
    void translateClassicQuickAddPlaceholder(QListWidget *list);
    void translateWidgetProperties(QWidget *widget);
    void translateWidgetActions(QWidget *widget);
    void translateWidgetText(QWidget *widget);

    CavalryEmbeddedTranslator &translator_;
    QHash<QObject *, QHash<QByteArray, QString>> lastTranslations_;
    QSet<QObject *> trackedObjects_;
    QSet<QObject *> hookedActions_;
    QSet<QObject *> hookedLineEdits_;
    QSet<QObject *> hookedMenus_;
    QSet<QObject *> hookedTreeWidgets_;
    QSet<QObject *> translatingObjects_;
#ifdef CAVALRY_I18N_TESTING
    ClassicQuickAddPlaceholderReaderForTesting
        classicPlaceholderReaderForTesting_;
    ClassicQuickAddPlaceholderSetterForTesting
        classicPlaceholderSetterForTesting_;
#endif
};
