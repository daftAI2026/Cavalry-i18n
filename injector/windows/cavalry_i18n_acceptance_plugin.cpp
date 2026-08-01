/**
 * [INPUT]: 依赖 acceptance plugin 工厂契约、Qt StandardPaths 测试模式、显式 onboarding/adjacent specification、受控语言环境与两个独立 driver
 * [OUTPUT]: 对外实现 acceptance-only key/specification/language 三重门，在 driver 构造前隔离 Qt 登录/工作区档案，并把选定 driver 启动投递到 Qt 事件线程
 * [POS]: injector/windows 的测试插件适配层；测试档案隔离只存在于不发布 DLL，不链接产品 runtime、不进入发布 generic 资源
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_acceptance_plugin.h"

#include "cavalry_i18n_adjacent_acceptance.h"
#include "cavalry_i18n_onboarding_acceptance.h"

#include <QtCore/QMetaObject>
#include <QtCore/QPointer>
#include <QtCore/QStandardPaths>

namespace {

constexpr auto kLanguageEnvironment =
    "CAVALRY_I18N_WINDOWS_ACCEPTANCE_LANGUAGE";

bool isSupportedAcceptanceLanguage(const QString &language)
{
    return language == QStringLiteral("zh-Hans")
        || language == QStringLiteral("zh-Hant")
        || language == QStringLiteral("ja_JP");
}

template<typename Driver>
QObject *createAcceptanceDriver(const QString &language)
{
    auto *const driver = new Driver(language);
    if (!driver->isEnabled()) {
        delete driver;
        return nullptr;
    }
    const QPointer<Driver> guardedDriver(driver);
    QMetaObject::invokeMethod(
        driver,
        [guardedDriver]() {
            if (!guardedDriver.isNull()) {
                guardedDriver->start();
            }
        },
        Qt::QueuedConnection);
    return driver;
}

} // namespace

QObject *CavalryI18nAcceptancePlugin::create(
    const QString &key,
    const QString &specification)
{
    if (key.compare(
            QStringLiteral("cavalryi18n_acceptance"),
            Qt::CaseInsensitive) != 0) {
        return nullptr;
    }

    const QString language =
        qEnvironmentVariable(kLanguageEnvironment).trimmed();
    if (!isSupportedAcceptanceLanguage(language)) {
        return nullptr;
    }

    // acceptance plugin 由 QPA delegate 在 Cavalry 主初始化前创建。
    // Qt 测试 profile 隔离登录与工作区，不复制或伪造账号数据。
    QStandardPaths::setTestModeEnabled(true);

    if (specification == QStringLiteral("onboarding")) {
        return createAcceptanceDriver<CavalryI18nOnboardingAcceptance>(
            language);
    }
    if (specification == QStringLiteral("adjacent")) {
        return createAcceptanceDriver<CavalryI18nAdjacentAcceptance>(
            language);
    }
    return nullptr;
}
