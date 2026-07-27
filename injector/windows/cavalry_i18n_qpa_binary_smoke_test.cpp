/**
 * [INPUT]: 依赖已构建 qpa/qwindows.dll、Qt 6.6.3 plugin metadata 与私有 QPlatformIntegrationPlugin 类型。
 * [OUTPUT]: 对外验证最终 QPA 二进制可加载、IID/`windows` key 正确且实例实现平台工厂；绝不调用 create 或加载厂商 DLL。
 * [POS]: injector/windows 的产物级 QPA 守门，补足纯 contract/source 测试无法覆盖的 metadata、导出和动态依赖回归。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include <QtCore/QJsonArray>
#include <QtCore/QJsonObject>
#include <QtCore/QLibrary>
#include <QtCore/QPluginLoader>
#include <QtCore/QString>
#include <qpa/qplatformintegrationplugin.h>

#include <cstdio>

namespace {

bool fail(const QString &message)
{
    const QByteArray utf8 = message.toUtf8();
    std::fprintf(stderr, "%s\n", utf8.constData());
    std::fflush(stderr);
    return false;
}

} // namespace

int main(int argc, char *argv[])
{
    if (argc != 2) {
        fail(QStringLiteral("Expected the built QPA proxy path."));
        return 1;
    }

    QPluginLoader loader(QString::fromLocal8Bit(argv[1]));
    loader.setLoadHints(
        loader.loadHints() | QLibrary::PreventUnloadHint);

    const QJsonObject metadata = loader.metaData();
    const QJsonArray keys = metadata
        .value(QStringLiteral("MetaData"))
        .toObject()
        .value(QStringLiteral("Keys"))
        .toArray();
    if (metadata.value(QStringLiteral("IID")).toString()
            != QString::fromLatin1(
                QPlatformIntegrationFactoryInterface_iid)
        || keys.size() != 1
        || keys.at(0).toString() != QStringLiteral("windows")) {
        fail(QStringLiteral("Built QPA proxy metadata contract mismatch."));
        return 1;
    }

    QObject *const instance = loader.instance();
    if (instance == nullptr) {
        fail(
            QStringLiteral("Could not load built QPA proxy: %1")
                .arg(loader.errorString()));
        return 1;
    }
    if (qobject_cast<QPlatformIntegrationPlugin *>(instance)
        == nullptr) {
        fail(
            QStringLiteral(
                "Built QPA proxy does not implement QPlatformIntegrationPlugin."));
        return 1;
    }

    return 0;
}
