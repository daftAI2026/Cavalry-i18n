/**
 * [INPUT]: 依赖 aggregate hook 生产源码、现有 process-lifetime PIN helper 与测试进程自身映像
 * [OUTPUT]: 对外提供 aggregate 三个 Qt IAT 安装写点必须位于插件 PIN 之后的源码合同，以及 PIN helper 正反例
 * [POS]: injector/windows 的危险原语顺序合同分片；直接锚定 ensureInstalled 生产路径，不伪造厂商模块或 WinAPI
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_skia_runtime_abi.h"

#include <QtCore/QByteArray>
#include <QtCore/QDebug>
#include <QtCore/QFile>
#include <QtCore/QString>

namespace {

void addressInsideTestImage()
{
}

bool verifyPinHelper()
{
    QString failure;
    if (pinCavalryI18nModuleForProcessLifetime(nullptr, &failure)
        || failure.isEmpty()) {
        qCritical() << "Plugin PIN helper accepted a null module address.";
        return false;
    }
    failure.clear();
    if (!pinCavalryI18nModuleForProcessLifetime(
            reinterpret_cast<const void *>(addressInsideTestImage),
            &failure)) {
        qCritical().noquote()
            << QStringLiteral("Plugin PIN helper rejected its own mapped image: %1")
                   .arg(failure);
        return false;
    }
    return true;
}

bool verifyProductionOrder()
{
    QFile sourceFile(QString::fromUtf8(
        CAVALRY_I18N_EXTENSION_LAYER_HOOK_SOURCE));
    if (!sourceFile.open(QIODevice::ReadOnly)) {
        qCritical() << "Could not read the aggregate hook production source.";
        return false;
    }
    const QByteArray source = sourceFile.readAll();
    const qsizetype ensureStart =
        source.indexOf("bool CavalryExtensionLayerHook::ensureInstalled()");
    const qsizetype ensureEnd = source.indexOf(
        "bool CavalryExtensionLayerHook::isWaitingForModule()", ensureStart);
    const qsizetype pluginPin =
        source.indexOf("pinCavalryI18nModuleForProcessLifetime(", ensureStart);
    constexpr auto iatWriteToken = "replaceCavalryIatPointer(";
    qsizetype cursor = ensureStart;
    int writeCount = 0;
    const bool hasEnsureBody = ensureStart >= 0 && ensureEnd > ensureStart;
    bool ordered = hasEnsureBody && pluginPin > ensureStart
        && pluginPin < ensureEnd;
    while (hasEnsureBody) {
        const qsizetype write = source.indexOf(iatWriteToken, cursor);
        if (write < 0 || write >= ensureEnd) {
            break;
        }
        ordered = ordered && write > pluginPin;
        ++writeCount;
        cursor = write + QByteArray(iatWriteToken).size();
    }
    if (!ordered || writeCount != 3) {
        qCritical()
            << "Aggregate ensureInstalled must PIN before exactly three IAT writes;"
            << "writes:" << writeCount;
        return false;
    }
    return true;
}

} // namespace

bool verifyAggregatePluginPinContract()
{
    return verifyPinHelper() && verifyProductionOrder();
}
