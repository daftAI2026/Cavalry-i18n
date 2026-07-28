/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator 的精确/source 查询，以及 Qt Widgets 的公开显示属性、QComboBox/QTreeWidget DisplayRole、QLineEdit/QPlainTextEdit 与菜单事件
 * [OUTPUT]: 对外提供幂等的 QWidget/QAction 主动翻译、已知基名数字后缀、来源绑定的受控动态模板、输入框显示值和 QTreeWidget 递归 DisplayRole 刷新
 * [POS]: injector/windows 的显示层边界，只改受控可见文案、下拉框/树的 DisplayRole、词表命中的 QLineEdit 与厂商父系内的精确 QPlainTextEdit 占位文字；未知输入、编辑器正文、UserRole、currentIndex、无关同文控件与通用 item view 保持原值
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
class QTreeWidget;
class QTreeWidgetItem;
class QWidget;
class CavalryEmbeddedTranslator;

class CavalryDisplayTranslator final : public QObject
{
public:
    explicit CavalryDisplayTranslator(
        CavalryEmbeddedTranslator &translator,
        QObject *parent = nullptr);

    void translateAction(QAction *action);
    void translateMenu(QMenu *menu);
    void translatePaintWidget(QWidget *widget);
    void translateWidget(QWidget *widget);
    void translateWidgetTree(QWidget *root);

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
};
