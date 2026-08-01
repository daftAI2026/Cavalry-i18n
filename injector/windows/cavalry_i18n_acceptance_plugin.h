/**
 * [INPUT]: 依赖 QtGui QGenericPlugin 工厂协议、显式 onboarding/adjacent specification 与验收专用语言环境
 * [OUTPUT]: 对外提供 metadata key 为 cavalryi18n_acceptance、只创建启用 Qt 测试档案的独立 Onboarding 或 Adjacent driver 工厂
 * [POS]: injector/windows 的 acceptance-only 动态入口；构建产物不进入 generic 发布目录，普通 Cavalry 启动不加载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtGui/QGenericPlugin>

class CavalryI18nAcceptancePlugin final : public QGenericPlugin
{
    Q_OBJECT
    Q_PLUGIN_METADATA(
        IID QGenericPluginFactoryInterface_iid
        FILE "cavalryi18n_acceptance.json"
    )

public:
    QObject *create(const QString &key, const QString &specification) override;
};
