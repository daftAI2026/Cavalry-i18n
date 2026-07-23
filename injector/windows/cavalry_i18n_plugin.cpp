/**
 * [INPUT]: 依赖 cavalry_i18n_plugin.h 的 Qt 工厂契约与 CavalryI18nRuntime 的运行时实现
 * [OUTPUT]: 对外实现大小写不敏感的 cavalryi18n 工厂创建，拒绝所有未知插件 key
 * [POS]: injector/windows 的最薄插件适配层，把 Qt 自动发现与翻译生命周期解耦
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_plugin.h"

#include "cavalry_i18n_runtime.h"

QObject *CavalryI18nPlugin::create(
    const QString &key,
    const QString &specification)
{
    Q_UNUSED(specification);

    if (key.compare(QStringLiteral("cavalryi18n"), Qt::CaseInsensitive) != 0) {
        return nullptr;
    }

    // Qt 会统一销毁 QGenericPlugin 返回的对象；这里不能再把它挂到 qApp，
    // 否则会形成第二个所有者。
    return new CavalryI18nRuntime();
}
