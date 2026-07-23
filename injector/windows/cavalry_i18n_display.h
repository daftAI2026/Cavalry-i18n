/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator 的 source fallback，以及 Qt Widgets 的公开显示属性与菜单事件
 * [OUTPUT]: 对外提供幂等的 QWidget/QAction 主动翻译、菜单首帧刷新和动态英文写回恢复
 * [POS]: injector/windows 的显示层边界，只改可见文案，不接触输入值、item model 或厂商业务数据
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
class QMenu;
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
    void hookMenu(QMenu *menu);
    void trackObject(QObject *object);
    void translateWidgetProperties(QWidget *widget);
    void translateWidgetActions(QWidget *widget);
    void translateWidgetText(QWidget *widget);

    CavalryEmbeddedTranslator &translator_;
    QHash<QObject *, QHash<QByteArray, QString>> lastTranslations_;
    QSet<QObject *> trackedObjects_;
    QSet<QObject *> hookedActions_;
    QSet<QObject *> hookedMenus_;
    QSet<QObject *> translatingObjects_;
};
