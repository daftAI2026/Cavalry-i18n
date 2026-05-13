/**
 * [INPUT]: 依赖 Qt 6.6.3 runtime ABI (QTranslator/QMenuBar/QAction/QWidget)、AppKit (NSApp mainMenu)、generated_translations.inc 编译期翻译表
 * [OUTPUT]: 对外提供 EmbeddedTranslator (QTranslator 子类)、Qt 菜单与普通 QWidget 翻译、AppKit 菜单同步、定时刷新任务、English dump-only runtime inventory 导出
 * [POS]: injector 的唯一源文件，通过 DYLD_INSERT_LIBRARIES 注入 Cavalry 进程，拦截 Qt 翻译请求并刷新 macOS 原生菜单栏
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#import <AppKit/AppKit.h>
#import <CommonCrypto/CommonDigest.h>
#import <Foundation/Foundation.h>

#include <dispatch/dispatch.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <qdatetime.h>
#include <qcoreapplication.h>
#include <qevent.h>
#include <qfileinfo.h>
#include <qglobal.h>
#include <QtGui/qaction.h>
#include <QtWidgets/qabstractbutton.h>
#include <QtWidgets/qapplication.h>
#include <QtWidgets/qcombobox.h>
#include <QtWidgets/qgroupbox.h>
#include <QtWidgets/qlabel.h>
#include <QtWidgets/qlineedit.h>
#include <QtWidgets/qdialogbuttonbox.h>
#include <QtWidgets/qdockwidget.h>
#include <QtWidgets/qheaderview.h>
#include <QtWidgets/qlistwidget.h>
#include <QtWidgets/qmenu.h>
#include <QtWidgets/qmenubar.h>
#include <QtWidgets/qprogressbar.h>
#include <QtWidgets/qspinbox.h>
#include <QtWidgets/qstatusbar.h>
#include <QtWidgets/qtabbar.h>
#include <QtWidgets/qtablewidget.h>
#include <QtWidgets/qtabwidget.h>
#include <QtWidgets/qtoolbar.h>
#include <QtWidgets/qtoolbutton.h>
#include <QtWidgets/qtreewidget.h>
#include <QtWidgets/qwidget.h>
#include <qhash.h>
#include <qpointer.h>
#include <qset.h>
#include <qstring.h>
#include <qstringlist.h>
#include <qtranslator.h>
#include <qvariant.h>
#include <qvector.h>

namespace {

constexpr int kMaxInstallAttempts = 20;
constexpr int kRetryDelayMs = 250;
constexpr int kWarmupRefreshAttempts = 3;
constexpr int kRefreshDelayMs = 1000;
constexpr int kDirtyDrainMaxObjects = 32;

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
bool gRefreshScheduled = false;
QSet<QMenu *> gHookedMenus;
struct DirtyObject {
    QObject *key;
    QPointer<QObject> object;
};

QObject *gEventFilter = nullptr;
QVector<DirtyObject> gDirtyObjects;
QSet<QObject *> gDirtyObjectSet;
bool gDirtyDrainScheduled = false;
int gRefreshCount = 0;
int gDirtyEnqueueCount = 0;
int gDirtyDrainCount = 0;
int gDirtyObjectTranslateCount = 0;
QHash<QString, QString> gTranslationBySource;
QString gTranslationCacheLang;

QString readEnvVar(const char *name)
{
    const char *value = getenv(name);
    return value ? QString::fromUtf8(value) : QString();
}

NSString *toNSString(const QString &value);

NSString *runtimeCacheRoot()
{
    @autoreleasepool {
        const QString configured = readEnvVar("CAVALRY_I18N_CACHE_ROOT");
        if (!configured.isEmpty()) {
            return toNSString(configured);
        }
        return [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/Cavalry-i18n"];
    }
}

QString sessionUuidValue()
{
    const QString explicitSessionUuid = readEnvVar("CAVALRY_I18N_SESSION_UUID");
    if (!explicitSessionUuid.isEmpty()) {
        return explicitSessionUuid;
    }

    const QString sessionDir = readEnvVar("CAVALRY_I18N_SESSION_DIR");
    if (!sessionDir.isEmpty()) {
        return QFileInfo(sessionDir).fileName();
    }

    return QString();
}

NSString *runtimeSessionDir()
{
    @autoreleasepool {
        const QString configured = readEnvVar("CAVALRY_I18N_SESSION_DIR");
        if (!configured.isEmpty()) {
            NSString *sessionDir = toNSString(configured);
            [[NSFileManager defaultManager] createDirectoryAtPath:sessionDir
                                      withIntermediateDirectories:YES
                                                       attributes:nil
                                                            error:nil];
            return sessionDir;
        }

        NSString *cacheRoot = runtimeCacheRoot();
        NSString *sessionUuid = toNSString(sessionUuidValue());
        if ([sessionUuid length] == 0) {
            sessionUuid = [[NSUUID UUID] UUIDString];
        }
        NSString *sessionDir = [[cacheRoot stringByAppendingPathComponent:@"sessions"] stringByAppendingPathComponent:sessionUuid];
        [[NSFileManager defaultManager] createDirectoryAtPath:sessionDir
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:nil];
        return sessionDir;
    }
}

NSString *runtimeInventoryDir()
{
    @autoreleasepool {
        NSString *runtimeDir = [runtimeSessionDir() stringByAppendingPathComponent:@"runtime"];
        [[NSFileManager defaultManager] createDirectoryAtPath:runtimeDir
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:nil];
        return runtimeDir;
    }
}

NSString *bundleExecutableHash()
{
    @autoreleasepool {
        NSString *executablePath = [[NSBundle mainBundle] executablePath];
        if (executablePath == nil) {
            return @"";
        }

        NSData *data = [NSData dataWithContentsOfFile:executablePath];
        if (data == nil) {
            return @"";
        }

        unsigned char digest[CC_SHA256_DIGEST_LENGTH];
        CC_SHA256([data bytes], static_cast<CC_LONG>([data length]), digest);
        NSMutableString *hash = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
        for (int index = 0; index < CC_SHA256_DIGEST_LENGTH; ++index) {
            [hash appendFormat:@"%02x", digest[index]];
        }
        return hash;
    }
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

void rebuildTranslationCache(const QString &lang)
{
    gTranslationBySource.clear();
    gTranslationCacheLang.clear();

    int count = 0;
    const TranslationEntry *entries = entriesForLanguage(lang, &count);
    if (entries == nullptr) {
        return;
    }

    for (int index = 0; index < count; ++index) {
        const QString source = normalizeMenuText(QString::fromUtf8(entries[index].sourceText));
        const QString translation = QString::fromUtf8(entries[index].translation);
        if (!source.isEmpty() && !translation.isEmpty()) {
            gTranslationBySource.insert(source, translation);
        }
    }

    gTranslationCacheLang = lang;
}

QString lookupEmbeddedTranslation(const QString &lang, const QString &sourceText)
{
    const QString normalizedSource = normalizeMenuText(sourceText);
    if (normalizedSource.isEmpty()) {
        return QString();
    }

    if (gTranslationCacheLang == lang && !gTranslationBySource.isEmpty()) {
        const auto cached = gTranslationBySource.constFind(normalizedSource);
        if (cached != gTranslationBySource.constEnd()) {
            return cached.value();
        }
        return QString();
    }

    int count = 0;
    const TranslationEntry *entries = entriesForLanguage(lang, &count);
    if (entries == nullptr) {
        return QString();
    }

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

NSString *runtimeMenuInventoryPath(const QString &lang)
{
    @autoreleasepool {
        NSString *runtimeDir = runtimeInventoryDir();
        NSString *fileName = [NSString stringWithFormat:@"%s-injector-inventory.json", lang.toUtf8().constData()];
        return [runtimeDir stringByAppendingPathComponent:fileName];
    }
}

id serializeQtAction(QAction *action);
id serializeWidget(QWidget *widget);

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

bool addStringValue(NSMutableDictionary *strings, NSString *key, const QString &value)
{
    const QString normalized = normalizeMenuText(value);
    if (normalized.isEmpty()) {
        return false;
    }

    strings[key] = toNSString(normalized);
    return true;
}

void addWidgetPropertyString(NSMutableDictionary *strings, QWidget *widget, const char *propertyName)
{
    const QVariant propertyValue = widget->property(propertyName);
    if (!propertyValue.isValid()) {
        return;
    }

    const QString value = normalizeMenuText(propertyValue.toString());
    if (value.isEmpty()) {
        return;
    }

    strings[[NSString stringWithUTF8String:propertyName]] = toNSString(value);
}

id serializeWidget(QWidget *widget)
{
    if (widget == nullptr || !widget->isVisible()) {
        return [NSNull null];
    }

    NSMutableDictionary *payload = [NSMutableDictionary dictionary];
    payload[@"className"] = [NSString stringWithUTF8String:widget->metaObject()->className()];
    if (!widget->objectName().isEmpty()) {
        payload[@"objectName"] = toNSString(widget->objectName());
    }

    NSMutableDictionary *strings = [NSMutableDictionary dictionary];
    addStringValue(strings, @"windowTitle", widget->windowTitle());
    addStringValue(strings, @"toolTip", widget->toolTip());
    addStringValue(strings, @"statusTip", widget->statusTip());
    addStringValue(strings, @"whatsThis", widget->whatsThis());
    addWidgetPropertyString(strings, widget, "text");
    addWidgetPropertyString(strings, widget, "title");
    addWidgetPropertyString(strings, widget, "placeholderText");
    addWidgetPropertyString(strings, widget, "currentText");

    if ([strings count] > 0) {
        payload[@"strings"] = strings;
    }

    QTabBar *tabBar = qobject_cast<QTabBar *>(widget);
    if (tabBar != nullptr && tabBar->count() > 0) {
        NSMutableArray *tabTexts = [NSMutableArray array];
        for (int index = 0; index < tabBar->count(); ++index) {
            const QString tabText = normalizeMenuText(tabBar->tabText(index));
            if (!tabText.isEmpty()) {
                [tabTexts addObject:toNSString(tabText)];
            }
        }
        if ([tabTexts count] > 0) {
            payload[@"tabTexts"] = tabTexts;
        }
    }

    NSMutableArray *actionTexts = [NSMutableArray array];
    for (QAction *action : widget->actions()) {
        if (action != nullptr) {
            const QString actionText = normalizeMenuText(action->text());
            if (!actionText.isEmpty()) {
                [actionTexts addObject:toNSString(actionText)];
            }
        }
    }
    if ([actionTexts count] > 0) {
        payload[@"actionTexts"] = actionTexts;
    }

    if (payload[@"strings"] == nil && payload[@"tabTexts"] == nil && payload[@"actionTexts"] == nil) {
        return [NSNull null];
    }

    return payload;
}

bool dumpQtMenuInventory(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr) {
        return false;
    }

    NSMutableArray *menuBars = [NSMutableArray array];
    NSMutableArray *widgetTexts = [NSMutableArray array];
    const auto widgets = QApplication::allWidgets();
    for (QWidget *widget : widgets) {
        QMenuBar *menuBar = qobject_cast<QMenuBar *>(widget);
        if (menuBar != nullptr && !menuBar->actions().isEmpty()) {
            NSMutableArray *items = [NSMutableArray array];
            for (QAction *action : menuBar->actions()) {
                [items addObject:serializeQtAction(action)];
            }

            [menuBars addObject:@{
                @"items" : items,
            }];
        }

        id serializedWidget = serializeWidget(widget);
        if (serializedWidget != [NSNull null]) {
            [widgetTexts addObject:serializedWidget];
        }
    }

    if ([menuBars count] == 0 && [widgetTexts count] == 0) {
        fprintf(stderr,
                "[cavalry-i18n] menu inventory export deferred: no populated Qt menu bar or visible widget text yet\n");
        return false;
    }

    NSError *jsonError = nil;
    NSString *inventoryPath = runtimeMenuInventoryPath(lang);
    NSData *payload = [NSJSONSerialization dataWithJSONObject:@{
        @"formatVersion" : @3,
        @"language" : toNSString(lang),
        @"source" : @"live-injector",
        @"inventoryPath" : inventoryPath,
        @"capture" : @{
            @"pid" : @([[NSProcessInfo processInfo] processIdentifier]),
            @"bundleHash" : bundleExecutableHash(),
            @"sessionUuid" : toNSString(sessionUuidValue()),
            @"wallclockUtc" : toNSString(QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)),
            @"source" : @"live-injector",
        },
        @"menuBars" : menuBars,
        @"widgetTexts" : widgetTexts,
        @"diagnostics" : @{
            @"refreshCount" : @(gRefreshCount),
            @"dirtyEnqueueCount" : @(gDirtyEnqueueCount),
            @"menuHookCount" : @(gHookedMenus.size()),
        },
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
void hookQtMenu(QMenu *menu, const QString &lang);
void hookQtMenus(const QString &lang);

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

    QString translated = lookupEmbeddedTranslation(lang, action->text());
    if (!translated.isEmpty() && translated != action->text()) {
        action->setText(translated);
    }

    translated = lookupEmbeddedTranslation(lang, action->iconText());
    if (!translated.isEmpty() && translated != action->iconText()) {
        action->setIconText(translated);
    }

    translated = lookupEmbeddedTranslation(lang, action->toolTip());
    if (!translated.isEmpty() && translated != action->toolTip()) {
        action->setToolTip(translated);
    }

    translated = lookupEmbeddedTranslation(lang, action->statusTip());
    if (!translated.isEmpty() && translated != action->statusTip()) {
        action->setStatusTip(translated);
    }

    translated = lookupEmbeddedTranslation(lang, action->whatsThis());
    if (!translated.isEmpty() && translated != action->whatsThis()) {
        action->setWhatsThis(translated);
    }

    QMenu *submenu = action->menu();
    hookQtMenu(submenu, lang);
    translateQtMenu(submenu, lang);
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

void hookQtMenu(QMenu *menu, const QString &lang)
{
    if (menu == nullptr || lang.isEmpty() || gHookedMenus.contains(menu)) {
        return;
    }

    gHookedMenus.insert(menu);
    QPointer<QMenu> guardedMenu(menu);
    QObject::connect(
        menu,
        &QObject::destroyed,
        menu,
        [menu]() {
            gHookedMenus.remove(menu);
        }
    );
    QObject::connect(
        menu,
        &QMenu::aboutToShow,
        menu,
        [guardedMenu, lang]() {
            if (guardedMenu.isNull()) {
                return;
            }
            translateQtMenu(guardedMenu, lang);
            for (QAction *action : guardedMenu->actions()) {
                if (action != nullptr) {
                    translateQtAction(action, lang);
                }
            }
            dispatch_async(dispatch_get_main_queue(), ^{
                refreshNativeMenuBar(lang);
            });
        }
    );
}

void hookQtMenus(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr || lang.isEmpty()) {
        return;
    }

    const auto widgets = QApplication::allWidgets();
    for (QWidget *widget : widgets) {
        if (QMenu *menu = qobject_cast<QMenu *>(widget)) {
            hookQtMenu(menu, lang);
        }
        if (QMenuBar *menuBar = qobject_cast<QMenuBar *>(widget)) {
            for (QAction *action : menuBar->actions()) {
                hookQtMenu(action != nullptr ? action->menu() : nullptr, lang);
            }
        }
    }
}

QString translatedWidgetText(const QString &lang, const QString &sourceText)
{
    const QString translated = lookupEmbeddedTranslation(lang, sourceText);
    if (translated.isEmpty() || translated == sourceText) {
        return QString();
    }
    return translated;
}

void translateListWidgetItems(QListWidget *listWidget, const QString &lang)
{
    if (listWidget == nullptr || lang.isEmpty()) {
        return;
    }
    for (int row = 0; row < listWidget->count(); ++row) {
        QListWidgetItem *item = listWidget->item(row);
        if (item == nullptr) {
            continue;
        }
        const QString translated = translatedWidgetText(lang, item->text());
        if (!translated.isEmpty()) {
            item->setText(translated);
        }
    }
}

void translateTreeWidgetItem(QTreeWidgetItem *item, const QString &lang)
{
    if (item == nullptr || lang.isEmpty()) {
        return;
    }
    for (int column = 0; column < item->columnCount(); ++column) {
        const QString translated = translatedWidgetText(lang, item->text(column));
        if (!translated.isEmpty()) {
            item->setText(column, translated);
        }
    }
    for (int index = 0; index < item->childCount(); ++index) {
        translateTreeWidgetItem(item->child(index), lang);
    }
}

void translateTableWidgetItems(QTableWidget *tableWidget, const QString &lang)
{
    if (tableWidget == nullptr || lang.isEmpty()) {
        return;
    }
    for (int row = 0; row < tableWidget->rowCount(); ++row) {
        for (int column = 0; column < tableWidget->columnCount(); ++column) {
            QTableWidgetItem *item = tableWidget->item(row, column);
            if (item == nullptr) {
                continue;
            }
            const QString translated = translatedWidgetText(lang, item->text());
            if (!translated.isEmpty()) {
                item->setText(translated);
            }
        }
    }
}

void translateQtWidgetActions(QWidget *widget, const QString &lang, QSet<QAction *> &seen)
{
    if (widget == nullptr || lang.isEmpty()) {
        return;
    }

    for (QAction *action : widget->actions()) {
        if (action == nullptr || seen.contains(action)) {
            continue;
        }
        seen.insert(action);
        translateQtAction(action, lang);
    }
}

void translateQtWidgetTexts(QWidget *widget, const QString &lang, QSet<QAction *> &seenActions)
{
    if (widget == nullptr || lang.isEmpty()) {
        return;
    }

    QString translated = translatedWidgetText(lang, widget->windowTitle());
    if (!translated.isEmpty()) {
        widget->setWindowTitle(translated);
    }

    translated = translatedWidgetText(lang, widget->toolTip());
    if (!translated.isEmpty()) {
        widget->setToolTip(translated);
    }

    translated = translatedWidgetText(lang, widget->statusTip());
    if (!translated.isEmpty()) {
        widget->setStatusTip(translated);
    }

    translated = translatedWidgetText(lang, widget->whatsThis());
    if (!translated.isEmpty()) {
        widget->setWhatsThis(translated);
    }

    if (QLabel *label = qobject_cast<QLabel *>(widget)) {
        translated = translatedWidgetText(lang, label->text());
        if (!translated.isEmpty()) {
            label->setText(translated);
        }
    }

    if (QAbstractButton *button = qobject_cast<QAbstractButton *>(widget)) {
        translated = translatedWidgetText(lang, button->text());
        if (!translated.isEmpty()) {
            button->setText(translated);
        }
    }

    if (QGroupBox *groupBox = qobject_cast<QGroupBox *>(widget)) {
        translated = translatedWidgetText(lang, groupBox->title());
        if (!translated.isEmpty()) {
            groupBox->setTitle(translated);
        }
    }

    if (QLineEdit *lineEdit = qobject_cast<QLineEdit *>(widget)) {
        translated = translatedWidgetText(lang, lineEdit->placeholderText());
        if (!translated.isEmpty()) {
            lineEdit->setPlaceholderText(translated);
        }
    }

    if (QComboBox *comboBox = qobject_cast<QComboBox *>(widget)) {
        for (int index = 0; index < comboBox->count(); ++index) {
            translated = translatedWidgetText(lang, comboBox->itemText(index));
            if (!translated.isEmpty()) {
                comboBox->setItemText(index, translated);
            }
        }
    }

    if (QTabBar *tabBar = qobject_cast<QTabBar *>(widget)) {
        for (int index = 0; index < tabBar->count(); ++index) {
            translated = translatedWidgetText(lang, tabBar->tabText(index));
            if (!translated.isEmpty()) {
                tabBar->setTabText(index, translated);
            }
        }
    }

    if (QTabWidget *tabWidget = qobject_cast<QTabWidget *>(widget)) {
        for (int index = 0; index < tabWidget->count(); ++index) {
            translated = translatedWidgetText(lang, tabWidget->tabText(index));
            if (!translated.isEmpty()) {
                tabWidget->setTabText(index, translated);
            }
        }
    }

    if (QStatusBar *statusBar = qobject_cast<QStatusBar *>(widget)) {
        translated = translatedWidgetText(lang, statusBar->currentMessage());
        if (!translated.isEmpty()) {
            statusBar->showMessage(translated);

        }
    }

    if (QDockWidget *dockWidget = qobject_cast<QDockWidget *>(widget)) {
        translated = translatedWidgetText(lang, dockWidget->windowTitle());
        if (!translated.isEmpty()) {
            dockWidget->setWindowTitle(translated);
        }
    }

    if (QToolBar *toolBar = qobject_cast<QToolBar *>(widget)) {
        translated = translatedWidgetText(lang, toolBar->windowTitle());
        if (!translated.isEmpty()) {
            toolBar->setWindowTitle(translated);
        }
        for (QAction *action : toolBar->actions()) {
            translateQtAction(action, lang);
        }
    }

    if (QToolButton *toolButton = qobject_cast<QToolButton *>(widget)) {
        translated = translatedWidgetText(lang, toolButton->text());
        if (!translated.isEmpty()) {
            toolButton->setText(translated);
        }
        translateQtAction(toolButton->defaultAction(), lang);
    }

    if (QDialogButtonBox *buttonBox = qobject_cast<QDialogButtonBox *>(widget)) {
        for (QAbstractButton *button : buttonBox->buttons()) {
            translated = translatedWidgetText(lang, button->text());
            if (!translated.isEmpty()) {
                button->setText(translated);
            }
        }
    }

    if (QSpinBox *spinBox = qobject_cast<QSpinBox *>(widget)) {
        translated = translatedWidgetText(lang, spinBox->prefix());
        if (!translated.isEmpty()) {
            spinBox->setPrefix(translated);
        }
        translated = translatedWidgetText(lang, spinBox->suffix());
        if (!translated.isEmpty()) {
            spinBox->setSuffix(translated);
        }
    }

    if (QDoubleSpinBox *doubleSpinBox = qobject_cast<QDoubleSpinBox *>(widget)) {
        translated = translatedWidgetText(lang, doubleSpinBox->prefix());
        if (!translated.isEmpty()) {
            doubleSpinBox->setPrefix(translated);
        }
        translated = translatedWidgetText(lang, doubleSpinBox->suffix());
        if (!translated.isEmpty()) {
            doubleSpinBox->setSuffix(translated);
        }
    }

    if (QProgressBar *progressBar = qobject_cast<QProgressBar *>(widget)) {
        translated = translatedWidgetText(lang, progressBar->format());
        if (!translated.isEmpty()) {
            progressBar->setFormat(translated);
        }
    }

    if (QListWidget *listWidget = qobject_cast<QListWidget *>(widget)) {
        translateListWidgetItems(listWidget, lang);
    }

    if (QTreeWidget *treeWidget = qobject_cast<QTreeWidget *>(widget)) {
        for (int column = 0; column < treeWidget->columnCount(); ++column) {
            QTreeWidgetItem *header = treeWidget->headerItem();
            if (header != nullptr) {
                translated = translatedWidgetText(lang, header->text(column));
                if (!translated.isEmpty()) {
                    header->setText(column, translated);
                }
            }
        }
        for (int index = 0; index < treeWidget->topLevelItemCount(); ++index) {
            translateTreeWidgetItem(treeWidget->topLevelItem(index), lang);
        }
    }

    if (QTableWidget *tableWidget = qobject_cast<QTableWidget *>(widget)) {
        translateTableWidgetItems(tableWidget, lang);
        for (int column = 0; column < tableWidget->columnCount(); ++column) {
            QTableWidgetItem *header = tableWidget->horizontalHeaderItem(column);
            if (header != nullptr) {
                translated = translatedWidgetText(lang, header->text());
                if (!translated.isEmpty()) {
                    header->setText(translated);
                }
            }
        }
        for (int row = 0; row < tableWidget->rowCount(); ++row) {
            QTableWidgetItem *header = tableWidget->verticalHeaderItem(row);
            if (header != nullptr) {
                translated = translatedWidgetText(lang, header->text());
                if (!translated.isEmpty()) {
                    header->setText(translated);
                }
            }
        }
    }

    translateQtWidgetActions(widget, lang, seenActions);
}

void translateQtWidgets(const QString &lang)
{
    if (qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr) {
        return;
    }

    const auto widgets = QApplication::allWidgets();
    QSet<QAction *> seenActions;
    for (QWidget *widget : widgets) {
        translateQtWidgetTexts(widget, lang, seenActions);
    }
}

void refreshQtUiTranslations(const QString &lang)
{
    if (lang.isEmpty()) {
        return;
    }

    ++gRefreshCount;
    hookQtMenus(lang);
    translateQtMenuBar(lang);
    translateQtWidgets(lang);
    refreshNativeMenuBar(lang);
    dumpQtMenuInventory(lang);
}

void scheduleRefreshAttempts(QString lang)
{
    if (gRefreshScheduled || lang.isEmpty()) {
        return;
    }

    gRefreshScheduled = true;
    for (int i = 0; i < kWarmupRefreshAttempts; ++i) {
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(i * kRefreshDelayMs) * NSEC_PER_MSEC),
            dispatch_get_main_queue(),
            ^{
                refreshQtUiTranslations(lang);
            }
        );
    }
}

void translateRuntimeObject(QObject *object, const QString &lang)
{
    if (object == nullptr || lang.isEmpty()) {
        return;
    }

    QSet<QAction *> seenActions;
    if (QAction *action = qobject_cast<QAction *>(object)) {
        translateQtAction(action, lang);
        ++gDirtyObjectTranslateCount;
        return;
    }

    if (QMenu *menu = qobject_cast<QMenu *>(object)) {
        hookQtMenu(menu, lang);
        translateQtMenu(menu, lang);
        ++gDirtyObjectTranslateCount;
        return;
    }

    if (QWidget *widget = qobject_cast<QWidget *>(object)) {
        translateQtWidgetTexts(widget, lang, seenActions);
        for (QWidget *child : widget->findChildren<QWidget *>(QString(), Qt::FindDirectChildrenOnly)) {
            translateQtWidgetTexts(child, lang, seenActions);
        }
        ++gDirtyObjectTranslateCount;
    }
}

void drainDirtyObjects(QString lang)
{
    int processed = 0;
    while (!gDirtyObjects.isEmpty() && processed < kDirtyDrainMaxObjects) {
        DirtyObject entry = gDirtyObjects.takeFirst();
        gDirtyObjectSet.remove(entry.key);
        if (!entry.object.isNull()) {
            translateRuntimeObject(entry.object.data(), lang);
        }
        ++processed;
    }

    ++gDirtyDrainCount;
    if (!gDirtyObjects.isEmpty()) {
        dispatch_async(dispatch_get_main_queue(), ^{
            drainDirtyObjects(lang);
        });
        return;
    }

    gDirtyDrainScheduled = false;
}

void scheduleDirtyObjectDrain(QString lang)
{
    if (lang.isEmpty() || gDirtyDrainScheduled) {
        return;
    }

    gDirtyDrainScheduled = true;
    dispatch_async(dispatch_get_main_queue(), ^{
        drainDirtyObjects(lang);
    });
}

void enqueueRuntimeObject(QObject *object, const QString &lang)
{
    if (object == nullptr || lang.isEmpty() || gDirtyObjectSet.contains(object)) {
        return;
    }

    const bool isRelevantObject = qobject_cast<QWidget *>(object) != nullptr ||
        qobject_cast<QAction *>(object) != nullptr ||
        qobject_cast<QMenu *>(object) != nullptr;
    if (!isRelevantObject) {
        return;
    }

    gDirtyObjectSet.insert(object);
    gDirtyObjects.append(DirtyObject{ object, QPointer<QObject>(object) });
    ++gDirtyEnqueueCount;
    scheduleDirtyObjectDrain(lang);
}

class RuntimeUiEventFilter final : public QObject {
public:
    explicit RuntimeUiEventFilter(const QString &lang)
        : QObject(QCoreApplication::instance()), m_lang(lang)
    {
    }

protected:
    bool eventFilter(QObject *watched, QEvent *event) override
    {
        if (watched == nullptr || event == nullptr || m_lang.isEmpty()) {
            return QObject::eventFilter(watched, event);
        }

        switch (event->type()) {
        case QEvent::Show:
        case QEvent::ActionAdded:
            enqueueRuntimeObject(watched, m_lang);
            break;
        case QEvent::ChildAdded: {
            QChildEvent *childEvent = static_cast<QChildEvent *>(event);
            enqueueRuntimeObject(childEvent->child(), m_lang);
            break;
        }
        default:
            break;
        }

        return QObject::eventFilter(watched, event);
    }

private:
    QString m_lang;
};

void installRuntimeUiEventFilter(const QString &lang)
{
    QCoreApplication *app = QCoreApplication::instance();
    if (app == nullptr || lang.isEmpty() || gEventFilter != nullptr) {
        return;
    }

    gEventFilter = new RuntimeUiEventFilter(lang);
    app->installEventFilter(gEventFilter);
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

    const bool dumpOnlyEnglish = lang == QStringLiteral("en");
    int count = 0;
    if (!dumpOnlyEnglish && entriesForLanguage(lang, &count) == nullptr) {
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
        if (!dumpOnlyEnglish) {
            gTranslator = new EmbeddedTranslator(lang, app);
            app->installTranslator(gTranslator);
            rebuildTranslationCache(lang);
        }
    }

    if (dumpOnlyEnglish) {
        bool inventoryExported = false;
        for (int attempt = 0; attempt < kMaxInstallAttempts; ++attempt) {
            if (dumpQtMenuInventory(lang)) {
                inventoryExported = true;
                break;
            }
            if (attempt < kMaxInstallAttempts - 1) {
                fprintf(stderr, "[cavalry-i18n] english dump-only export deferred, retrying... (attempt %d/%d)\n",
                        attempt + 1, kMaxInstallAttempts);
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kRetryDelayMs * NSEC_PER_MSEC)),
                               dispatch_get_main_queue(),
                               ^{
                                   QCoreApplication::processEvents(QEventLoop::AllEvents);
                               });
                QCoreApplication::processEvents(QEventLoop::AllEvents);
                usleep(kRetryDelayMs * 1000);
            }
        }

        if (inventoryExported) {
            fprintf(stderr, "[cavalry-i18n] english dump-only inventory exported\n");
            gInstallAttempted = true;
            return true;
        }

        fprintf(stderr, "[cavalry-i18n] failed to export english dump-only inventory after %d attempts\n",
                kMaxInstallAttempts);
        gInstallAttempted = true;
        return true;
    }

    if (!translateQtMenuBar(lang)) {
        return false;
    }

    translateQtWidgets(lang);
    dumpQtMenuInventory(lang);
    refreshNativeMenuBar(lang);

    installRuntimeUiEventFilter(lang);

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
                            const QString lang = readEnvVar("CAVALRY_I18N_LANG");
                            fprintf(stderr, "[cavalry-i18n] NSApplicationDidFinishLaunching lang=%s\n",
                                    lang.toUtf8().constData());
                            scheduleInstallAttempt(0);
                            refreshNativeMenuBar(lang);
                            scheduleRefreshAttempts(lang);
                        }];
        }
    });
}

} // namespace

__attribute__((constructor)) static void cavalryTranslatorInjectorLoad()
{
    bootstrapInjector();
}
