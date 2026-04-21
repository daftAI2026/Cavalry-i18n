#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>

#include <dispatch/dispatch.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <qcoreapplication.h>
#include <qglobal.h>
#include <QtGui/qaction.h>
#include <QtWidgets/qapplication.h>
#include <QtWidgets/qmenu.h>
#include <QtWidgets/qmenubar.h>
#include <QtWidgets/qwidget.h>
#include <qstring.h>
#include <qstringlist.h>
#include <qtranslator.h>

namespace {

constexpr int kMaxInstallAttempts = 20;
constexpr int kRetryDelayMs = 250;

struct TranslationEntry {
    const char *context;
    const char *sourceText;
    const char *translation;
};

#include "generated_translations.inc"

class EmbeddedTranslator final : public QTranslator {
public:
    explicit EmbeddedTranslator(const QString &lang, QObject *parent = nullptr)
        : QTranslator(parent), m_lang(lang)
    {
    }

    QString translate(
        const char *context,
        const char *sourceText,
        const char *disambiguation = nullptr,
        int n = -1) const override
    {
        (void) disambiguation;
        (void) n;

        if (context == nullptr || sourceText == nullptr) {
            return QString();
        }

        int count = 0;
        const TranslationEntry *entries = entriesForLanguage(m_lang, &count);
        if (entries == nullptr) {
            return QString();
        }

        for (int index = 0; index < count; ++index) {
            if (strcmp(entries[index].context, context) == 0 &&
                strcmp(entries[index].sourceText, sourceText) == 0) {
                return QString::fromUtf8(entries[index].translation);
            }
        }

        return QString();
    }

private:
    QString m_lang;
};

EmbeddedTranslator *gTranslator = nullptr;
bool gInstallAttempted = false;

QString readEnvVar(const char *name)
{
    const char *value = getenv(name);
    return value ? QString::fromUtf8(value) : QString();
}

QString normalizeMenuText(const QString &text)
{
    QString normalized = text;
    normalized.replace(QChar('&'), QString());
    normalized.replace(QString::fromUtf8("…"), QStringLiteral("..."));

    QString cleaned;
    cleaned.reserve(normalized.size());
    for (QChar ch : normalized) {
        if (ch.category() == QChar::Other_Format || ch.unicode() == 0xFEFF) {
            continue;
        }
        cleaned.append(ch);
    }

    return cleaned.trimmed();
}

QString lookupEmbeddedTranslation(const QString &lang, const QString &sourceText)
{
    int count = 0;
    const TranslationEntry *entries = entriesForLanguage(lang, &count);
    if (entries == nullptr) {
        return QString();
    }

    const QString normalizedSource = normalizeMenuText(sourceText);
    for (int index = 0; index < count; ++index) {
        const QString candidate = normalizeMenuText(QString::fromUtf8(entries[index].sourceText));
        if (candidate == normalizedSource) {
            return QString::fromUtf8(entries[index].translation);
        }
    }

    return QString();
}

NSString *toNSString(const QString &value)
{
    const QByteArray utf8 = value.toUtf8();
    return [NSString stringWithUTF8String:utf8.constData()];
}

NSString *runtimeMenuInventoryPath()
{
    @autoreleasepool {
        NSString *cacheRoot =
            [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/Cavalry-i18n"];
        [[NSFileManager defaultManager] createDirectoryAtPath:cacheRoot
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:nil];
        return [cacheRoot stringByAppendingPathComponent:@"menu-inventory.json"];
    }
}

id serializeQtAction(QAction *action);

id serializeQtMenu(QMenu *menu)
{
    if (menu == nullptr) {
        return [NSNull null];
    }

    NSMutableArray *items = [NSMutableArray array];
    for (QAction *action : menu->actions()) {
        [items addObject:serializeQtAction(action)];
    }

    return @{
        @"title" : toNSString(menu->title()),
        @"items" : items,
    };
}

id serializeQtAction(QAction *action)
{
    if (action == nullptr) {
        return [NSNull null];
    }

    NSMutableDictionary *payload = [NSMutableDictionary dictionary];
    payload[@"text"] = toNSString(action->text());
    payload[@"enabled"] = @(action->isEnabled());
    payload[@"separator"] = @(action->isSeparator());

    QMenu *submenu = action->menu();
    if (submenu != nullptr) {
        payload[@"submenu"] = serializeQtMenu(submenu);
    }

    return payload;
}

bool dumpQtMenuInventory(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr) {
        return false;
    }

    NSMutableArray *menuBars = [NSMutableArray array];
    const auto widgets = QApplication::allWidgets();
    for (QWidget *widget : widgets) {
        QMenuBar *menuBar = qobject_cast<QMenuBar *>(widget);
        if (menuBar == nullptr || menuBar->actions().isEmpty()) {
            continue;
        }

        NSMutableArray *items = [NSMutableArray array];
        for (QAction *action : menuBar->actions()) {
            [items addObject:serializeQtAction(action)];
        }

        [menuBars addObject:@{
            @"items" : items,
        }];
    }

    if ([menuBars count] == 0) {
        fprintf(stderr, "[cavalry-i18n] menu inventory export deferred: no populated Qt menu bar yet\n");
        return false;
    }

    NSError *jsonError = nil;
    NSString *inventoryPath = runtimeMenuInventoryPath();
    NSData *payload = [NSJSONSerialization dataWithJSONObject:@{
        @"formatVersion" : @1,
        @"language" : toNSString(lang),
        @"inventoryPath" : inventoryPath,
        @"menuBars" : menuBars,
    }
                                                       options:NSJSONWritingPrettyPrinted
                                                          error:&jsonError];
    if (payload == nil) {
        fprintf(stderr,
                "[cavalry-i18n] failed to serialize runtime menu inventory: %s\n",
                jsonError != nil ? [[jsonError localizedDescription] UTF8String] : "unknown error");
        return false;
    }

    NSError *writeError = nil;
    const bool wrote = [payload writeToFile:inventoryPath
                                    options:NSDataWritingAtomic
                                      error:&writeError];
    if (wrote) {
        fprintf(stderr,
                "[cavalry-i18n] exported runtime menu inventory -> %s\n",
                [inventoryPath UTF8String]);
    } else {
        fprintf(stderr,
                "[cavalry-i18n] failed to write runtime menu inventory: %s (%s)\n",
                [inventoryPath UTF8String],
                writeError != nil ? [[writeError localizedDescription] UTF8String] : "unknown error");
    }
    return wrote;
}

void translateQtAction(QAction *action, const QString &lang);

void translateQtMenu(QMenu *menu, const QString &lang)
{
    if (menu == nullptr) {
        return;
    }

    const QString title = menu->title();
    const QString translatedTitle = lookupEmbeddedTranslation(lang, title);
    if (!translatedTitle.isEmpty() && translatedTitle != title) {
        menu->setTitle(translatedTitle);
    }

    for (QAction *action : menu->actions()) {
        translateQtAction(action, lang);
    }
}

void translateQtAction(QAction *action, const QString &lang)
{
    if (action == nullptr) {
        return;
    }

    const QString text = action->text();
    const QString translatedText = lookupEmbeddedTranslation(lang, text);
    if (!translatedText.isEmpty() && translatedText != text) {
        action->setText(translatedText);
    }

    translateQtMenu(action->menu(), lang);
}

bool translateQtMenuBar(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr) {
        return false;
    }

    bool foundMenuSurface = false;
    const auto widgets = QApplication::allWidgets();
    for (QWidget *widget : widgets) {
        QMenuBar *menuBar = qobject_cast<QMenuBar *>(widget);
        if (menuBar == nullptr) {
            continue;
        }

        const auto actions = menuBar->actions();
        if (!actions.isEmpty()) {
            foundMenuSurface = true;
        }

        for (QAction *action : actions) {
            translateQtAction(action, lang);
        }
    }

    return foundMenuSurface;
}

void translateNativeMenu(NSMenu *menu, const QString &lang)
{
    if (menu == nil) {
        return;
    }

    for (NSMenuItem *item in [menu itemArray]) {
        const QString title = QString::fromUtf8([[item title] UTF8String]);
        const QString translated = lookupEmbeddedTranslation(lang, title);
        if (!translated.isEmpty() && translated != title) {
            const QByteArray utf8 = translated.toUtf8();
            [item setTitle:[NSString stringWithUTF8String:utf8.constData()]];
        }

        translateNativeMenu([item submenu], lang);
    }
}

void refreshNativeMenuBar(const QString &lang)
{
    if (lang.isEmpty()) {
        return;
    }

    @autoreleasepool {
        translateNativeMenu([NSApp mainMenu], lang);
    }
}

QString majorMinorVersion(const QString &version)
{
    const QStringList parts = version.split('.');
    if (parts.size() < 2) {
        return version;
    }
    return parts[0] + QStringLiteral(".") + parts[1];
}

bool installTranslator()
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

    int count = 0;
    if (entriesForLanguage(lang, &count) == nullptr) {
        fprintf(stderr, "[cavalry-i18n] unsupported language: %s\n", lang.toUtf8().constData());
        gInstallAttempted = true;
        return true;
    }

    const QString buildQtVersion = QStringLiteral(QT_VERSION_STR);
    const QString runtimeQtVersion = QString::fromUtf8(qVersion());
    if (majorMinorVersion(buildQtVersion) != majorMinorVersion(runtimeQtVersion)) {
        fprintf(
            stderr,
            "[cavalry-i18n] injector Qt version mismatch build=%s runtime=%s\n",
            buildQtVersion.toUtf8().constData(),
            runtimeQtVersion.toUtf8().constData()
        );
        gInstallAttempted = true;
        return true;
    }

    if (gTranslator == nullptr) {
        gTranslator = new EmbeddedTranslator(lang, app);
        app->installTranslator(gTranslator);
    }

    if (!translateQtMenuBar(lang)) {
        return false;
    }

    dumpQtMenuInventory(lang);
    refreshNativeMenuBar(lang);

    fprintf(
        stderr,
        "[cavalry-i18n] embedded translator installed lang=%s entries=%d\n",
        lang.toUtf8().constData(),
        count
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

            if (installTranslator()) {
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
                            refreshNativeMenuBar(readEnvVar("CAVALRY_I18N_LANG"));
                            dispatch_after(
                                dispatch_time(DISPATCH_TIME_NOW, 250 * NSEC_PER_MSEC),
                                dispatch_get_main_queue(),
                                ^{
                                    refreshNativeMenuBar(readEnvVar("CAVALRY_I18N_LANG"));
                                }
                            );
                        }];
        }
    });
}

} // namespace

__attribute__((constructor)) static void cavalryTranslatorInjectorLoad()
{
    bootstrapInjector();
}
