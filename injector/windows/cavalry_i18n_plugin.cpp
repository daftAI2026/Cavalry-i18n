/**
 * [INPUT]: 依赖 cavalry_i18n_plugin.h 的 Qt 工厂契约、严格语言谓词与 CavalryI18nRuntime 配置结果
 * [OUTPUT]: 对外实现大小写不敏感 key 与严格非空 specification，拒绝环境自动发现及无效配置
 * [POS]: injector/windows 的最薄 generic 适配层；只有通过 manifest/hash gate 的 QPA 代理可明确创建翻译运行时
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_plugin.h"

#include "cavalry_i18n_runtime.h"

QObject *CavalryI18nPlugin::create(
    const QString &key,
    const QString &specification)
{
    if (key.compare(QStringLiteral("cavalryi18n"), Qt::CaseInsensitive) != 0) {
        return nullptr;
    }

    if (!cavalryIsSupportedRuntimeLanguage(specification)) {
        return nullptr;
    }

    // Qt 会统一销毁 QGenericPlugin 返回的对象；这里不能再把它挂到 qApp，
    // 否则会形成第二个所有者。
    auto *const runtime = new CavalryI18nRuntime(specification);
    if (!runtime->isConfigured()) {
        delete runtime;
        return nullptr;
    }
    return runtime;
}
