/**
 * [INPUT]: 依赖 Qt 6.6.3 私有 QPA 插件协议与 cavalry_i18n_qpa_contract 的安装根激活判定
 * [OUTPUT]: 对外提供 metadata key 为 windows、完整委托原厂 QPA 并可显式启动 generic 翻译的代理
 * [POS]: injector/windows 的原生入口汇合层；ABI 锁定 Qt 6.6.3，翻译失败不剥夺原厂窗口系统
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QStringList>
#include <qpa/qplatformintegrationplugin.h>

class QPlatformIntegration;

class CavalryWindowsQpaProxy final : public QPlatformIntegrationPlugin
{
    Q_OBJECT
    Q_PLUGIN_METADATA(
        IID QPlatformIntegrationFactoryInterface_iid
        FILE "qwindows.json"
    )

public:
    QPlatformIntegration *create(
        const QString &key,
        const QStringList &paramList) override;
    QPlatformIntegration *create(
        const QString &key,
        const QStringList &paramList,
        int &argc,
        char **argv) override;
};

