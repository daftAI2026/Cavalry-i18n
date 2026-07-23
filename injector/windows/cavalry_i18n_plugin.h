/**
 * [INPUT]: 依赖 QtGui QGenericPlugin 工厂协议与 cavalry_i18n_runtime 的进程内翻译生命周期
 * [OUTPUT]: 对外提供 metadata key 为 cavalryi18n 的 CavalryI18nPlugin 动态插件工厂
 * [POS]: injector/windows 的 Qt 官方加载入口，只负责 key 路由，不承载翻译或系统操作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtGui/QGenericPlugin>

class CavalryI18nPlugin final : public QGenericPlugin
{
    Q_OBJECT
    Q_PLUGIN_METADATA(
        IID QGenericPluginFactoryInterface_iid
        FILE "cavalryi18n.json"
    )

public:
    QObject *create(const QString &key, const QString &specification) override;
};
