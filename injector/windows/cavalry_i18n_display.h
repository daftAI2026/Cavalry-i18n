/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator 的 source fallback，以及 Qt Widgets 的公开显示属性、QComboBox/QTreeWidget DisplayRole、QLineEdit 信号与菜单事件
 * [OUTPUT]: 对外提供幂等的 QWidget/QAction 主动翻译、已知基名数字后缀投影、受词表约束的 QLineEdit 显示值和 QTreeWidget 递归 DisplayRole 刷新
 * [POS]: injector/windows 的显示层边界，只改受控可见文案、下拉框/树的 DisplayRole 和词表命中的输入框显示值；未知输入、UserRole、currentIndex 与通用 item view 保持原值
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
