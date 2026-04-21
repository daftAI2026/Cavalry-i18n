#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>

#include <dispatch/dispatch.h>
#include <stdio.h>
#include <stdlib.h>

#include <qcoreapplication.h>
#include <qstring.h>
#include <qtranslator.h>

namespace {

constexpr int kMaxInstallAttempts = 20;
constexpr int kRetryDelayMs = 250;

QTranslator *gAppTranslator = nullptr;
QTranslator *gQtTranslator = nullptr;
bool gInstallAttempted = false;

QString readEnvVar(const char *name)
{
    const char *value = getenv(name);
    return value ? QString::fromUtf8(value) : QString();
}

QString defaultTranslationsDir()
{
    @autoreleasepool {
        NSBundle *bundle = [NSBundle mainBundle];
        if (bundle == nil) {
            return QString();
        }

        NSString *resourcesPath = bundle.resourcePath;
        if (resourcesPath == nil) {
            return QString();
        }

        NSString *translationsPath = [resourcesPath stringByAppendingPathComponent:@"translations"];
        return QString::fromUtf8(translationsPath.UTF8String);
    }
}

bool installTranslators()
{
    QCoreApplication *app = QCoreApplication::instance();
    if (app == nullptr) {
        return false;
    }

    const QString lang = readEnvVar("CAVALRY_I18N_LANG");
    if (lang.isEmpty()) {
        fprintf(stderr, "[cavalry-i18n] injector loaded, but CAVALRY_I18N_LANG is empty\n");
        gInstallAttempted = true;
        return true;
    }

    QString translationsDir = readEnvVar("CAVALRY_I18N_QM_DIR");
    if (translationsDir.isEmpty()) {
        translationsDir = defaultTranslationsDir();
    }

    gAppTranslator = new QTranslator(app);
    const bool appLoaded = gAppTranslator->load(QString("cavalry_") + lang, translationsDir);
    if (appLoaded) {
        app->installTranslator(gAppTranslator);
    } else {
        delete gAppTranslator;
        gAppTranslator = nullptr;
    }

    gQtTranslator = new QTranslator(app);
    const bool qtLoaded = gQtTranslator->load(QString("qtbase_") + lang, translationsDir);
    if (qtLoaded) {
        app->installTranslator(gQtTranslator);
    } else {
        delete gQtTranslator;
        gQtTranslator = nullptr;
    }

    fprintf(
        stderr,
        "[cavalry-i18n] install attempt lang=%s dir=%s app_qm=%s qt_qm=%s\n",
        lang.toUtf8().constData(),
        translationsDir.toUtf8().constData(),
        appLoaded ? "loaded" : "missing",
        qtLoaded ? "loaded" : "missing"
    );

    gInstallAttempted = true;
    return true;
}

void scheduleInstallAttempt(int attempt)
{
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(attempt == 0 ? 0 : kRetryDelayMs) * NSEC_PER_MSEC),
        dispatch_get_main_queue(),
        ^{
            if (gInstallAttempted) {
                return;
            }

            if (installTranslators()) {
                return;
            }

            if (attempt + 1 < kMaxInstallAttempts) {
                scheduleInstallAttempt(attempt + 1);
            } else {
                fprintf(stderr, "[cavalry-i18n] injector gave up waiting for QCoreApplication\n");
            }
        }
    );
}

void bootstrapInjector()
{
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        fprintf(stderr, "[cavalry-i18n] injector bootstrap\n");
        scheduleInstallAttempt(0);

        @autoreleasepool {
            [[NSNotificationCenter defaultCenter]
                addObserverForName:NSApplicationDidFinishLaunchingNotification
                            object:nil
                             queue:[NSOperationQueue mainQueue]
                        usingBlock:^(__unused NSNotification *note) {
                            scheduleInstallAttempt(0);
                        }];
        }
    });
}

} // namespace

__attribute__((constructor)) static void cavalryTranslatorInjectorLoad()
{
    bootstrapInjector();
}
