/**
 * [INPUT]: 依赖 QtGui QGenericPlugin 工厂协议与 cavalry_i18n_runtime 的显式语言生命周期
 * [OUTPUT]: 对外提供 metadata key 为 cavalryi18n、只接受严格非空 specification 的动态插件工厂
 * [POS]: injector/windows 的 generic 入口；拒绝 Qt 环境自动发现旁路，只把 QPA 明确语言投影为运行时
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
