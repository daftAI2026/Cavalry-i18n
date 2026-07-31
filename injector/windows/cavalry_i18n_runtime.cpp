/**
 * [INPUT]: 产品分区依赖 QPA 显式语言、嵌入生成表、四条精确 hook 与受控 Qt 显示槽；acceptance-only 编译分区依赖 Onboarding driver 契约、显式受控语言/证据目录与产品已安装 translator
 * [OUTPUT]: 产品分区安装 translator/显示投影、传递真实 Assets producer 并写 text-path 诊断；acceptance-only 分区为不发布插件生成 firstLaunch 五步 driver，并以目标页标题/正文确认 Next 转场后才推进状态
 * [POS]: injector/windows 的双目标源码分区；产品 target 永不编译验收分区，acceptance wrapper 只编译验收分区，防止 UI 驱动语义进入发布 DLL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#ifdef CAVALRY_I18N_ONBOARDING_ACCEPTANCE_ONLY
#include "cavalry_i18n_onboarding_acceptance.h"
#include "cavalry_i18n_translator.h"
#include <QtCore/private/qobject_p.h>
#else
#include "cavalry_i18n_runtime.h"
#include "cavalry_i18n_display.h"
#include "cavalry_i18n_extension_layer_hook.h"
#include "cavalry_i18n_translator.h"
#endif

#include <QtCore/QCoreApplication>
#include <QtCore/QDir>
#include <QtCore/QEvent>
#include <QtCore/QFile>
#include <QtCore/QFileInfo>
#include <QtCore/QJsonArray>
#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>
#include <QtCore/QMetaMethod>
#include <QtCore/QMetaObject>
#include <QtCore/QPointer>
#include <QtCore/QSaveFile>
#include <QtCore/QSet>
#include <QtCore/QThread>
#include <QtCore/QTimer>
#include <QtCore/QDebug>
#include <QtGui/QAction>
#include <QtGui/QActionEvent>
#include <QtGui/QTextDocument>
#include <QtWidgets/QApplication>
#include <QtWidgets/QAbstractButton>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QDialog>
#include <QtWidgets/QGroupBox>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QMenu>
#include <QtWidgets/QMessageBox>
#include <QtWidgets/QPlainTextEdit>
#include <QtWidgets/QTabBar>
#include <QtWidgets/QTextBrowser>
#include <QtWidgets/QWidget>

#include <array>
#include <string>

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

namespace {

constexpr auto kMarkerEnvironment = "CAVALRY_I18N_DIAGNOSTIC_MARKER";
#ifdef CAVALRY_I18N_ONBOARDING_ACCEPTANCE_ONLY
constexpr auto kOnboardingAcceptanceEnvironment =
    "CAVALRY_I18N_WINDOWS_ONBOARDING_ACCEPTANCE_DIR";
constexpr auto kShowGuidesActionObjectName = "showGuides";
constexpr auto kOnboardingChoiceClass =
    "onboarding::OnboardingChoiceView";
constexpr auto kOnboardingManagerClass =
    "onboarding::OnboardingManager";
constexpr auto kOnboardingGuideClass =
    "onboarding::OnboardingGuideView";
constexpr auto kFirstLaunchGuideId = "firstLaunch";
constexpr int kOnboardingStepCount = 5;
constexpr qint64 kOnboardingStageTimeoutMilliseconds = 45'000;
constexpr qint64 kOnboardingStartupSettleMilliseconds = 15'000;
constexpr qint64 kOnboardingTransitionRetryMilliseconds = 1'500;
constexpr int kOnboardingTransitionClickAttempts = 3;
constexpr auto kShowGuideSymbol =
    "?showGuide@OnboardingManager@onboarding@@QEAAXAEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@@Z";
constexpr auto kOnboardingManagerGetterSymbol =
    "?onboardingManager@Gui@@QEAAPEAVOnboardingManager@onboarding@@XZ";
constexpr auto kOnboardingManagerIsDisabledSymbol =
    "?isDisabled@OnboardingManager@onboarding@@QEBA_NXZ";
constexpr auto kOnboardingManagerSetDisabledSymbol =
    "?setDisabled@OnboardingManager@onboarding@@QEAAX_N@Z";

using ShowGuideFunction =
    void (*)(void *, const std::string &);
using OnboardingManagerGetterFunction =
    void *(*)(void *);
using OnboardingManagerIsDisabledFunction =
    bool (*)(void *);
using OnboardingManagerSetDisabledFunction =
    void (*)(void *, bool);

struct OnboardingManagerTrigger
{
    QObject *manager = nullptr;
};

QMetaMethod resolveDirectStringMethod(
    QObject *object,
    const char *methodName,
    QByteArray *parameterType)
{
    if (object == nullptr) {
        return {};
    }
    const QMetaObject *metaObject = object->metaObject();
    for (int index = 0;
         index < metaObject->methodCount();
         ++index) {
        const QMetaMethod method =
            metaObject->method(index);
        const QList<QByteArray> parameterTypes =
            method.parameterTypes();
        if (method.name() != methodName
            || parameterTypes.size() != 1) {
            continue;
        }
        *parameterType = parameterTypes.first();
        if (*parameterType
            != QByteArrayLiteral("std::string")) {
            continue;
        }
        return method;
    }
    return {};
}

FARPROC resolveExactOnboardingExport(
    const char *symbol,
    QString *error)
{
    HMODULE onboardingModule =
        GetModuleHandleW(L"ExtensionLayer.dll");
    if (onboardingModule == nullptr) {
        *error = QStringLiteral(
            "ExtensionLayer.dll is not loaded.");
        return nullptr;
    }
    std::array<wchar_t, 32768> modulePath {};
    const DWORD modulePathLength = GetModuleFileNameW(
        onboardingModule,
        modulePath.data(),
        static_cast<DWORD>(modulePath.size()));
    if (modulePathLength == 0
        || modulePathLength >= modulePath.size()) {
        *error = QStringLiteral(
            "Could not resolve the loaded ExtensionLayer.dll path.");
        return nullptr;
    }
    const QString loadedCore =
        QFileInfo(
            QString::fromWCharArray(
                modulePath.data(),
                static_cast<qsizetype>(modulePathLength)))
            .canonicalFilePath();
    const QString expectedCore =
        QFileInfo(
            QDir(QCoreApplication::applicationDirPath())
                .filePath(QStringLiteral("ExtensionLayer.dll")))
            .canonicalFilePath();
    if (loadedCore.isEmpty()
        || expectedCore.isEmpty()
        || loadedCore.compare(
               expectedCore,
               Qt::CaseInsensitive) != 0) {
        *error = QStringLiteral(
            "Loaded Onboarding module escaped the exact Cavalry ExtensionLayer.dll.");
        return nullptr;
    }
    FARPROC resolved =
        GetProcAddress(onboardingModule, symbol);
    if (resolved == nullptr) {
        *error = QStringLiteral(
            "Exact Cavalry 2.7.2 Onboarding export is missing: %1")
                     .arg(QString::fromLatin1(symbol));
    }
    return resolved;
}

QObject *onboardingManagerFromGui(
    QObject *gui,
    QString *error)
{
    if (gui == nullptr
        || gui->metaObject() == nullptr
        || QString::fromLatin1(
               gui->metaObject()->className())
            != QStringLiteral("Gui")) {
        *error = QStringLiteral(
            "Gui::onboardingManager() requires the exact Gui runtime class.");
        return nullptr;
    }
    FARPROC rawGetter =
        resolveExactOnboardingExport(
            kOnboardingManagerGetterSymbol,
            error);
    if (rawGetter == nullptr) {
        return nullptr;
    }
    void *rawManager =
        reinterpret_cast<OnboardingManagerGetterFunction>(
            rawGetter)(
                gui);
    if (rawManager == nullptr) {
        *error = QStringLiteral(
            "Exact Gui::onboardingManager() returned null.");
        return nullptr;
    }
    auto *manager =
        reinterpret_cast<QObject *>(rawManager);
    if (manager->metaObject() == nullptr
        || QString::fromLatin1(
               manager->metaObject()->className())
            != QString::fromLatin1(
                kOnboardingManagerClass)) {
        *error = QStringLiteral(
            "Gui::onboardingManager() returned an unexpected runtime class.");
        return nullptr;
    }
    return manager;
}

bool resolveOnboardingManagerTrigger(
    OnboardingManagerTrigger *trigger,
    QString *error)
{
    QSet<QObject *> seen;
    QList<QObject *> objects;
    if (qApp != nullptr) {
        objects.append(qApp);
        objects.append(
            qApp->findChildren<QObject *>(
                QString(),
                Qt::FindChildrenRecursively));
    }
    for (QWidget *widget : QApplication::allWidgets()) {
        if (widget == nullptr) {
            continue;
        }
        objects.append(widget);
        for (QAction *action : widget->actions()) {
            objects.append(action);
        }
        for (QAction *action :
             widget->findChildren<QAction *>(
                 QString(),
                 Qt::FindChildrenRecursively)) {
            objects.append(action);
        }
        objects.append(
            widget->findChildren<QObject *>(
                QString(),
                Qt::FindChildrenRecursively));
    }

    QList<QObject *> managers;
    QList<QObject *> guiObjects;
    for (QObject *root : objects) {
        for (QObject *object = root;
             object != nullptr;
             object = object->parent()) {
            if (seen.contains(object)) {
                continue;
            }
            seen.insert(object);
            if (QString::fromLatin1(
                    object->metaObject()->className())
                == QString::fromLatin1(
                    kOnboardingManagerClass)) {
                managers.append(object);
            } else if (QString::fromLatin1(
                           object->metaObject()->className())
                       == QStringLiteral("Gui")) {
                guiObjects.append(object);
            }
        }
    }
    if (managers.size() > 1) {
        *error = QStringLiteral(
            "OnboardingManager identity is ambiguous: %1 candidates.")
                     .arg(managers.size());
        return false;
    }
    QObject *manager = managers.isEmpty()
        ? nullptr
        : managers.first();
    if (manager == nullptr) {
        if (guiObjects.isEmpty()) {
            return false;
        }
        if (guiObjects.size() != 1) {
            *error = QStringLiteral(
                "Gui identity is ambiguous while resolving OnboardingManager: %1 candidates.")
                         .arg(guiObjects.size());
            return false;
        }
        manager = onboardingManagerFromGui(
            guiObjects.first(),
            error);
        if (manager == nullptr) {
            return false;
        }
    }

    FARPROC rawShowGuide =
        resolveExactOnboardingExport(kShowGuideSymbol, error);
    if (rawShowGuide == nullptr) {
        return false;
    }
    trigger->manager = manager;
    return true;
}

#else
constexpr auto kPluginKey = "cavalryi18n";
bool hasAncestorClass(const QObject *object, const char *className)
{
    for (const QObject *candidate = object;
         candidate != nullptr;
         candidate = candidate->parent()) {
        if (candidate->inherits(className)) {
            return true;
        }
    }
    return false;
}
#endif

} // namespace

#ifndef CAVALRY_I18N_ONBOARDING_ACCEPTANCE_ONLY
CavalryI18nRuntime::CavalryI18nRuntime(
    const QString &requestedLanguage)
    : requestedLanguage_(requestedLanguage)
{
    configured_ = configure();
}

CavalryI18nRuntime::~CavalryI18nRuntime()
{
    auto *application = QCoreApplication::instance();
    if (application == nullptr) {
        return;
    }

    application->removeEventFilter(this);
    if (translatorInstalled_) {
        application->removeTranslator(translator_.get());
    }
}

bool cavalryIsSupportedRuntimeLanguage(const QString &language)
{
    return language == QStringLiteral("en")
        || language == QStringLiteral("zh-Hans")
        || language == QStringLiteral("zh-Hant")
        || language == QStringLiteral("ja_JP");
}

bool CavalryI18nRuntime::isConfigured() const
{
    return configured_;
}

bool CavalryI18nRuntime::configure()
{
    auto *application = QCoreApplication::instance();
    if (application == nullptr) {
        writeDiagnostic(
            QStringLiteral("error"),
            QStringLiteral("Qt application instance is unavailable."),
            false);
        return false;
    }

    if (QThread::currentThread() != application->thread()) {
        writeDiagnostic(
            QStringLiteral("error"),
            QStringLiteral("The plugin was created outside the Qt application thread."),
            false);
        return false;
    }

    language_ = requestedLanguage_;
    if (!cavalryIsSupportedRuntimeLanguage(language_)) {
        writeDiagnostic(
            QStringLiteral("error"),
            QStringLiteral("Unsupported explicit language specification."),
            false);
        return false;
    }

    if (language_ == QStringLiteral("en")) {
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral("English baseline selected; no translator is required."),
            false);
        return true;
    }

    translator_ = std::make_unique<CavalryEmbeddedTranslator>(language_);
    if (translator_->entryCount() <= 0) {
        writeDiagnostic(
            QStringLiteral("error"),
            QStringLiteral("The embedded translation table is empty."),
            false);
        return false;
    }

    if (!application->installTranslator(translator_.get())) {
        writeDiagnostic(
            QStringLiteral("error"),
            QStringLiteral("Qt failed to install the embedded translator."),
            false);
        return false;
    }

    translatorInstalled_ = true;
    displayTranslator_ =
        std::make_unique<CavalryDisplayTranslator>(*translator_, this);
    extensionLayerHook_ =
        std::make_unique<CavalryExtensionLayerHook>(*translator_);
    ensureExtensionLayerHook();
    application->installEventFilter(this);
    const QString diagnosticMarker =
        qEnvironmentVariable(kMarkerEnvironment).trimmed();
    if (QDir::isAbsolutePath(diagnosticMarker)) {
        // generic plugin 可能在 QApplication 的事件分发器启动前构造。
        // 把轮询器的创建也投递给 application，确保早期插件线程无事件
        // 分发器时，ExtensionLayer/text-path 诊断仍由 GUI 线程持续推进。
        const QPointer<CavalryI18nRuntime> guardedRuntime(this);
        QMetaObject::invokeMethod(
            application,
            [application, guardedRuntime]() {
                if (guardedRuntime.isNull()) {
                    return;
                }
                auto *diagnosticTimer = new QTimer(application);
                diagnosticTimer->setInterval(75);
                QObject::connect(
                    diagnosticTimer,
                    &QTimer::timeout,
                    application,
                    [guardedRuntime]() {
                        if (guardedRuntime.isNull()) {
                            return;
                        }
                        guardedRuntime->maybeWriteTextPathDiagnostic();
                    });
                diagnosticTimer->start();
            },
            Qt::QueuedConnection);
    }

    // generic plugin 在 QGuiApplication 构造期加载；把首次刷新投递到事件队列，
    // 等 QApplication 与早期顶层窗口完成创建后再访问 QWidget。
    QMetaObject::invokeMethod(
        this,
        [this]() { refreshAllTopLevelWidgets(); },
        Qt::QueuedConnection);

    writeDiagnostic(
        QStringLiteral("ready"),
        QStringLiteral("Embedded translation table installed."),
        true);
    return true;
}

bool CavalryI18nRuntime::eventFilter(QObject *watched, QEvent *event)
{
    if (!translatorInstalled_ || displayTranslator_ == nullptr
        || watched == nullptr || event == nullptr) {
        return false;
    }
    if (event->type() == QEvent::ActionAdded) {
        auto *actionEvent = static_cast<QActionEvent *>(event);
        QAction *action = actionEvent->action();
        displayTranslator_->translateAction(action);
        return false;
    }

    if ((event->type() == QEvent::Show || event->type() == QEvent::Paint)
        && extensionLayerHook_ != nullptr
        && extensionLayerHook_->isWaitingForModule()) {
        // 先于目标 QWidget 的 Show/Paint 处理；若 ExtensionLayer 刚刚加载，首帧即可接住。
        ensureExtensionLayerHook();
    }
    maybeWriteTextPathDiagnostic();

    auto *widget = qobject_cast<QWidget *>(watched);
    if (widget == nullptr) {
        return false;
    }

    if (event->type() == QEvent::ContextMenu
        && hasAncestorClass(widget, "assets::Window")) {
        // QApplication event filter 先于目标对象处理 ContextMenu；其处理器会同步
        // 创建并 Show QMenu。只把这一个事件回合的 producer 身份交给首帧菜单。
        assetsContextMenuProducer_ = widget;
        const QPointer<CavalryI18nRuntime> guardedRuntime(this);
        QMetaObject::invokeMethod(
            this,
            [guardedRuntime]() {
                if (!guardedRuntime.isNull()) {
                    guardedRuntime->assetsContextMenuProducer_.clear();
                }
            },
            Qt::QueuedConnection);
    }

    switch (event->type()) {
    case QEvent::Show:
        // QMenu 必须在首帧前同步完成；普通控件也在自身 Show 前完成一次。
        if (auto *menu = qobject_cast<QMenu *>(widget);
            menu != nullptr && !assetsContextMenuProducer_.isNull()) {
            displayTranslator_->translateAssetsContextMenu(menu);
            assetsContextMenuProducer_.clear();
        }
        displayTranslator_->translateWidget(widget);
        if (widget->isWindow() && qobject_cast<QMenu *>(widget) == nullptr) {
            queueRefresh(widget);
        }
        break;
    case QEvent::Paint:
        // 动态英文写回路径并不统一；Paint 前的小白名单补齐未走信号的控件。
        if (qobject_cast<QLabel *>(widget) != nullptr
            || qobject_cast<QAbstractButton *>(widget) != nullptr
            || qobject_cast<QGroupBox *>(widget) != nullptr
            || qobject_cast<QLineEdit *>(widget) != nullptr
            || qobject_cast<QPlainTextEdit *>(widget) != nullptr
            || qobject_cast<QComboBox *>(widget) != nullptr
            || qobject_cast<QTabBar *>(widget) != nullptr) {
            displayTranslator_->translatePaintWidget(widget);
        }
        break;
    case QEvent::WindowTitleChange:
    case QEvent::ToolTipChange:
    case QEvent::Enter:
        displayTranslator_->translateWidget(widget);
        break;
    default:
        break;
    }

    return false;
}
#endif

#ifdef CAVALRY_I18N_ONBOARDING_ACCEPTANCE_ONLY

CavalryI18nOnboardingAcceptance::CavalryI18nOnboardingAcceptance(
    const QString &language,
    QObject *parent)
    : QObject(parent)
    , language_(language)
    , translationLookup_(
          std::make_unique<CavalryEmbeddedTranslator>(language))
{
    configureOnboardingAcceptance();
}

CavalryI18nOnboardingAcceptance::~CavalryI18nOnboardingAcceptance()
{
    if (QCoreApplication *application = QCoreApplication::instance()) {
        application->removeEventFilter(this);
    }
    restoreOnboardingManagerDisabledState();
    restoreQuitOnLastWindowClosed();
}

bool CavalryI18nOnboardingAcceptance::isEnabled() const
{
    return onboardingAcceptanceEnabled_;
}

void CavalryI18nOnboardingAcceptance::start()
{
    QCoreApplication *application = QCoreApplication::instance();
    if (application == nullptr || !onboardingAcceptanceEnabled_) {
        return;
    }
    quitOnLastWindowClosedWasEnabled_ =
        QApplication::quitOnLastWindowClosed();
    QApplication::setQuitOnLastWindowClosed(false);
    quitOnLastWindowClosedOverridden_ = true;
    application->installEventFilter(this);
    auto *timer = new QTimer(this);
    timer->setInterval(75);
    QObject::connect(
        timer,
        &QTimer::timeout,
        this,
        [this]() {
            if (!onboardingDriveActive_) {
                onboardingDriveActive_ = true;
                bypassBlockingWindows();
                driveOnboardingAcceptance();
                onboardingDriveActive_ = false;
            }
        });
    timer->start();
    bypassBlockingWindows();
    driveOnboardingAcceptance();
}

bool CavalryI18nOnboardingAcceptance::eventFilter(
    QObject *,
    QEvent *event)
{
    if (event != nullptr
        && event->type() == QEvent::Quit
        && onboardingAcceptanceEnabled_
        && onboardingAcceptanceStatus_ != QStringLiteral("complete")
        && onboardingAcceptanceStatus_ != QStringLiteral("error")
        && !onboardingQuitBypassed_) {
        onboardingQuitBypassed_ = true;
        onboardingAcceptanceMessage_ =
            QStringLiteral(
                "Suppressed one pre-completion application Quit requested by the login/welcome controller.");
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Onboarding acceptance suppressed one login-controller Quit."),
            true);
        return true;
    }
    return false;
}

#define CavalryI18nRuntime CavalryI18nOnboardingAcceptance

void CavalryI18nRuntime::restoreOnboardingManagerDisabledState()
{
    if (!onboardingManagerTemporarilyEnabled_) {
        onboardingManagerDisabledStateRestored_ = true;
        return;
    }
    if (onboardingManager_.isNull()) {
        return;
    }
    QString error;
    FARPROC rawSetDisabled =
        resolveExactOnboardingExport(
            kOnboardingManagerSetDisabledSymbol,
            &error);
    if (rawSetDisabled == nullptr) {
        qWarning().noquote()
            << QStringLiteral(
                   "[cavalryi18n_acceptance] Could not restore OnboardingManager disabled state: %1")
                   .arg(error);
        return;
    }
    reinterpret_cast<OnboardingManagerSetDisabledFunction>(
        rawSetDisabled)(
            onboardingManager_.data(),
            onboardingManagerWasDisabled_);
    onboardingManagerTemporarilyEnabled_ = false;
    onboardingManagerDisabledStateRestored_ = true;
}

bool CavalryI18nRuntime::triggerFirstLaunchFromManager(
    QObject *manager,
    const QString &identity)
{
    if (manager == nullptr
        || manager->metaObject() == nullptr
        || QString::fromLatin1(
               manager->metaObject()->className())
            != QString::fromLatin1(
                kOnboardingManagerClass)) {
        failOnboardingAcceptance(
            QStringLiteral(
                "Onboarding manager trigger received the wrong runtime class."));
        return false;
    }
    QString error;
    FARPROC rawShowGuide =
        resolveExactOnboardingExport(
            kShowGuideSymbol,
            &error);
    FARPROC rawIsDisabled =
        resolveExactOnboardingExport(
            kOnboardingManagerIsDisabledSymbol,
            &error);
    FARPROC rawSetDisabled =
        resolveExactOnboardingExport(
            kOnboardingManagerSetDisabledSymbol,
            &error);
    if (rawShowGuide == nullptr
        || rawIsDisabled == nullptr
        || rawSetDisabled == nullptr) {
        failOnboardingAcceptance(error);
        return false;
    }

    onboardingManager_ = manager;
    onboardingManagerWasDisabled_ =
        reinterpret_cast<OnboardingManagerIsDisabledFunction>(
            rawIsDisabled)(
                manager);
    onboardingManagerTemporarilyEnabled_ =
        onboardingManagerWasDisabled_;
    onboardingManagerEnableBypassUsed_ =
        onboardingManagerTemporarilyEnabled_;
    onboardingManagerDisabledStateRestored_ =
        !onboardingManagerTemporarilyEnabled_;
    if (onboardingManagerTemporarilyEnabled_) {
        reinterpret_cast<OnboardingManagerSetDisabledFunction>(
            rawSetDisabled)(
                manager,
                false);
    }

    onboardingActionIdentity_ = identity;
    onboardingChoiceProducerClass_ =
        QString::fromLatin1(
            manager->metaObject()->className());
    onboardingGuideParameterType_ =
        QStringLiteral("const std::string&");
    onboardingAcceptanceStatus_ =
        QStringLiteral("waiting-for-step");
    onboardingAcceptanceMessage_ =
        QStringLiteral(
            "Queued exact ExtensionLayer.dll OnboardingManager::showGuide(firstLaunch); waiting for step 1 title/body.");
    onboardingStep_ = 1;
    onboardingStageTimer_.restart();
    writeDiagnostic(
        QStringLiteral("ready"),
        QStringLiteral(
            "OnboardingManager identity, disabled state, and exact export frozen before firstLaunch."),
        true);
    const QPointer<CavalryI18nRuntime> guardedRuntime(this);
    const QPointer<QObject> guardedManager(manager);
    const auto showGuide =
        reinterpret_cast<ShowGuideFunction>(
            rawShowGuide);
    QTimer::singleShot(
        0,
        qApp,
        [guardedRuntime, guardedManager, showGuide] {
            if (guardedRuntime.isNull()
                || guardedManager.isNull()) {
                if (!guardedRuntime.isNull()) {
                    guardedRuntime->failOnboardingAcceptance(
                        QStringLiteral(
                            "OnboardingManager disappeared before the queued firstLaunch call."));
                }
                return;
            }
            const std::string guideId(
                kFirstLaunchGuideId);
            showGuide(
                guardedManager.data(),
                guideId);
        });
    return true;
}

void CavalryI18nRuntime::restoreQuitOnLastWindowClosed()
{
    if (!quitOnLastWindowClosedOverridden_) {
        return;
    }
    QApplication::setQuitOnLastWindowClosed(
        quitOnLastWindowClosedWasEnabled_);
    quitOnLastWindowClosedOverridden_ = false;
}

void CavalryI18nRuntime::bypassBlockingWindows()
{
    for (QWidget *widget : QApplication::topLevelWidgets()) {
        if (widget == nullptr) {
            continue;
        }
        const QString klass =
            QString::fromLatin1(widget->metaObject()->className());
        if (klass == QString::fromLatin1(kOnboardingChoiceClass)
            || klass == QString::fromLatin1(kOnboardingGuideClass)
            || klass == QStringLiteral("PopOverView")) {
            continue;
        }
        const QString title = widget->windowTitle();
        const bool welcome =
            klass.contains(QStringLiteral("SignInDialog"))
            || title.contains(
                QStringLiteral("Welcome"),
                Qt::CaseInsensitive)
            || title.contains(QStringLiteral("欢迎"))
            || title.contains(QStringLiteral("歡迎"))
            || title.contains(QStringLiteral("ようこそ"));
        const auto *dialog = qobject_cast<QDialog *>(widget);
        const bool blockingDialog =
            dialog != nullptr
            && (dialog->isModal()
                || dialog->windowModality() != Qt::NonModal);
        if (!welcome && !blockingDialog) {
            continue;
        }
        QString identity =
            QStringLiteral("%1|%2").arg(klass, title);
        if (auto *messageBox =
                qobject_cast<QMessageBox *>(widget)) {
            QStringList buttonTexts;
            for (QAbstractButton *button :
                 messageBox->buttons()) {
                if (button != nullptr) {
                    buttonTexts.append(
                        button->text().trimmed());
                }
            }
            identity.append(
                QStringLiteral(
                    "|text=%1|informative=%2|buttons=%3")
                    .arg(
                        messageBox->text().trimmed(),
                        messageBox->informativeText().trimmed(),
                        buttonTexts.join(
                            QStringLiteral(","))));
            const bool exactWorkspaceReset =
                messageBox->text().trimmed()
                    == onboardingResetWorkspaceTitle_
                && messageBox->informativeText().trimmed()
                    == onboardingResetWorkspaceBody_;
            if (exactWorkspaceReset) {
                QAbstractButton *acceptButton =
                    messageBox->button(QMessageBox::Ok);
                QAbstractButton *cancelButton =
                    messageBox->button(QMessageBox::Cancel);
                if (acceptButton == nullptr
                    || cancelButton == nullptr
                    || messageBox->buttons().size() != 2) {
                    failOnboardingAcceptance(
                        QStringLiteral(
                            "Exact workspace-reset prompt did not expose only standard Ok/Cancel buttons."));
                    return;
                }
                onboardingWorkspaceResetPromptObserved_ = true;
                failOnboardingAcceptance(
                    QStringLiteral(
                        "Workspace-reset prompt appeared after the bounded MainDock settle; neither Ok nor Cancel was invoked."));
                return;
            }
        }
        if (!onboardingBypassedWindows_.contains(identity)) {
            onboardingBypassedWindows_.append(identity);
        }
        // 登录、欢迎页和恢复工作区对话框可以与 Onboarding 共存。
        // 不点击 Cancel、不隐藏、不改变模态状态；exact-HWND oracle
        // 只接受真实 OnboardingGuideView 所属窗口。
    }
}

void CavalryI18nRuntime::configureOnboardingAcceptance()
{
    const QString requestedDirectory =
        qEnvironmentVariable(kOnboardingAcceptanceEnvironment).trimmed();
    if (requestedDirectory.isEmpty()) {
        return;
    }

    onboardingAcceptanceEnabled_ = true;
    onboardingAcceptanceStatus_ = QStringLiteral("configuring");
    const QString markerPath =
        qEnvironmentVariable(kMarkerEnvironment).trimmed();
    if (!QDir::isAbsolutePath(markerPath)
        || !QDir::isAbsolutePath(requestedDirectory)) {
        failOnboardingAcceptance(
            QStringLiteral(
                "Onboarding acceptance requires absolute marker and evidence paths."));
        return;
    }

    const QFileInfo markerInfo(QDir::cleanPath(markerPath));
    const QFileInfo acceptanceInfo(QDir::cleanPath(requestedDirectory));
    const QString markerParent = markerInfo.dir().canonicalPath();
    const QString acceptanceCanonical =
        acceptanceInfo.canonicalFilePath();
    const QString acceptanceParent =
        QFileInfo(acceptanceCanonical).dir().canonicalPath();
    if (!markerInfo.exists()
        || !markerInfo.isFile()
        || markerInfo.isSymLink()
        || markerInfo.isJunction()
        || markerParent.isEmpty()
        || !acceptanceInfo.isDir()
        || acceptanceInfo.isSymLink()
        || acceptanceInfo.isJunction()
        || acceptanceCanonical.isEmpty()
        || acceptanceParent != markerParent) {
        failOnboardingAcceptance(
            QStringLiteral(
                "Onboarding acceptance requires an existing real marker file and one real direct child evidence directory."));
        return;
    }
    onboardingAcceptanceDirectory_ = acceptanceCanonical;

    const QString catalogPath =
        QDir(QCoreApplication::applicationDirPath())
            .filePath(QStringLiteral("assets/Learn/Guides/strings.json"));
    QFile catalogFile(catalogPath);
    if (!catalogFile.open(QIODevice::ReadOnly)) {
        failOnboardingAcceptance(
            QStringLiteral("Cannot open installed Guide catalog: %1")
                .arg(catalogFile.errorString()));
        return;
    }
    QJsonParseError parseError;
    const QJsonDocument catalogDocument =
        QJsonDocument::fromJson(catalogFile.readAll(), &parseError);
    if (parseError.error != QJsonParseError::NoError
        || !catalogDocument.isArray()
        || catalogDocument.array().size() != 1) {
        failOnboardingAcceptance(
            QStringLiteral("Installed Guide catalog is not the expected single array entry."));
        return;
    }
    const QJsonObject catalog = catalogDocument.array().at(0).toObject();
    if (catalog.value(QStringLiteral("type")).toString()
            != QStringLiteral("strings")
        || catalog.value(QStringLiteral("language")).toString()
            != QStringLiteral("en")
        || !catalog.value(QStringLiteral("value")).isObject()) {
        failOnboardingAcceptance(
            QStringLiteral(
                "Installed Guide catalog does not retain Cavalry's fixed en loader slot."));
        return;
    }

    const QJsonObject values =
        catalog.value(QStringLiteral("value")).toObject();
    onboardingResetWorkspaceTitle_ =
        values.value(
            QStringLiteral(
                "onboarding.dialog.resetWorkspace.title"))
            .toString()
            .trimmed();
    onboardingResetWorkspaceBody_ =
        values.value(
            QStringLiteral(
                "onboarding.dialog.resetWorkspace.body"))
            .toString()
            .trimmed();
    if (onboardingResetWorkspaceTitle_.isEmpty()
        || onboardingResetWorkspaceBody_.isEmpty()) {
        failOnboardingAcceptance(
            QStringLiteral(
                "Installed Guide catalog is missing the exact workspace-reset prompt."));
        return;
    }
    for (int step = 0; step < kOnboardingStepCount; ++step) {
        const QString prefix =
            QStringLiteral("onboarding.firstLaunch.step%1.").arg(step);
        onboardingExpectedTitles_[step] =
            values.value(prefix + QStringLiteral("title"))
                .toString()
                .trimmed();
        onboardingExpectedBodies_[step] =
            values.value(prefix + QStringLiteral("body"))
                .toString()
                .trimmed();
        if (onboardingExpectedTitles_[step].isEmpty()
            || onboardingExpectedBodies_[step].isEmpty()) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Installed Guide catalog is missing firstLaunch step %1 title/body.")
                    .arg(step + 1));
            return;
        }
    }

    onboardingAcceptanceStatus_ =
        QStringLiteral("waiting-for-action");
    onboardingAcceptanceMessage_ =
        QStringLiteral(
            "Waiting for the initialized MainDock before resolving the unique semantic showGuides action.");
    onboardingStageTimer_.start();
    onboardingStartupTimer_.start();
    writeDiagnostic(
        QStringLiteral("ready"),
        QStringLiteral("Onboarding acceptance configured."),
        true);
}

QWidget *CavalryI18nRuntime::findVisibleWidgetByClass(
    const char *className) const
{
    const QWidgetList widgets = QApplication::allWidgets();
    for (QWidget *widget : widgets) {
        if (widget != nullptr
            && widget->isVisible()
            && qstrcmp(widget->metaObject()->className(), className) == 0) {
            return widget;
        }
    }
    return nullptr;
}

void CavalryI18nRuntime::failOnboardingAcceptance(
    const QString &message)
{
    onboardingAcceptanceStatus_ = QStringLiteral("error");
    onboardingAcceptanceMessage_ = message;
    restoreOnboardingManagerDisabledState();
    restoreQuitOnLastWindowClosed();
    writeDiagnostic(
        QStringLiteral("ready"),
        QStringLiteral("Embedded translation table installed; Onboarding acceptance failed."),
        true);
}

void CavalryI18nRuntime::driveOnboardingAcceptance()
{
    if (!onboardingAcceptanceEnabled_
        || onboardingAcceptanceStatus_ == QStringLiteral("disabled")
        || onboardingAcceptanceStatus_ == QStringLiteral("complete")
        || onboardingAcceptanceStatus_ == QStringLiteral("error")) {
        return;
    }
    if (onboardingStageTimer_.isValid()
        && onboardingStageTimer_.elapsed()
            > kOnboardingStageTimeoutMilliseconds) {
        failOnboardingAcceptance(
            QStringLiteral("Timed out in state %1 at step %2.")
                .arg(onboardingAcceptanceStatus_)
                .arg(onboardingStep_));
        return;
    }

    if (onboardingAcceptanceStatus_
        == QStringLiteral("waiting-for-action")) {
        if (!onboardingStartupSettled_) {
            if (!onboardingStartupTimer_.isValid()
                || onboardingStartupTimer_.elapsed()
                    < kOnboardingStartupSettleMilliseconds) {
                return;
            }
            bool mainDockVisible = false;
            for (QWidget *widget :
                 QApplication::topLevelWidgets()) {
                if (widget != nullptr
                    && widget->isVisible()
                    && QString::fromLatin1(
                           widget->metaObject()->className())
                           .contains(QStringLiteral("MainDock"))) {
                    mainDockVisible = true;
                    break;
                }
            }
            if (!mainDockVisible) {
                return;
            }
            onboardingStartupSettled_ = true;
            onboardingAcceptanceMessage_ =
                QStringLiteral(
                    "MainDock remained available after the bounded startup settle; resolving the semantic Onboarding producer.");
            writeDiagnostic(
                QStringLiteral("ready"),
                QStringLiteral(
                    "Onboarding startup readiness frozen before any workspace-reset request."),
                true);
        }
        OnboardingManagerTrigger managerTrigger;
        QString managerError;
        if (resolveOnboardingManagerTrigger(
                &managerTrigger,
                &managerError)) {
            triggerFirstLaunchFromManager(
                managerTrigger.manager,
                QStringLiteral(
                    "manager-export:ExtensionLayer.dll/OnboardingManager::showGuide"));
            return;
        }
        if (!managerError.isEmpty()) {
            failOnboardingAcceptance(managerError);
            return;
        }

        QSet<QAction *> actions;
        const QWidgetList widgets = QApplication::allWidgets();
        for (QWidget *widget : widgets) {
            if (widget == nullptr) {
                continue;
            }
            for (QAction *action : widget->actions()) {
                actions.insert(action);
            }
            const QList<QAction *> children =
                widget->findChildren<QAction *>(
                    QString(),
                    Qt::FindChildrenRecursively);
            actions.unite(QSet<QAction *>(children.begin(), children.end()));
        }
        auto *application = QCoreApplication::instance();
        if (application != nullptr) {
            const QList<QAction *> children =
                application->findChildren<QAction *>(
                    QString(),
                    Qt::FindChildrenRecursively);
            actions.unite(QSet<QAction *>(children.begin(), children.end()));
        }

        QString expectedText = translationLookup_->translate(
            "MenuBarManager",
            "Getting Started Guides");
        QString expectedHelpText = translationLookup_->translate(
            "MenuBarManager",
            "Help");
        expectedText = expectedText.trimmed();
        expectedText.remove(QLatin1Char('&'));
        expectedHelpText = expectedHelpText.trimmed();
        expectedHelpText.remove(QLatin1Char('&'));
        QList<QAction *> exactCandidates;
        QList<QAction *> textCandidates;
        QSet<QMenu *> helpMenus;
        QStringList observedActions;
        for (QAction *action : actions) {
            if (action == nullptr) {
                continue;
            }
            QString normalizedText = action->text().trimmed();
            normalizedText.remove(QLatin1Char('&'));
            const QString data = action->data().toString().trimmed();
            const bool exactObject =
                action->objectName()
                == QString::fromLatin1(kShowGuidesActionObjectName);
            const bool exactData =
                data == QString::fromLatin1(kShowGuidesActionObjectName);
            const bool exactText =
                !expectedText.isEmpty() && normalizedText == expectedText;
            if (!expectedHelpText.isEmpty()
                && normalizedText == expectedHelpText
                && action->menu() != nullptr) {
                helpMenus.insert(action->menu());
            }
            if (exactObject || exactData) {
                exactCandidates.append(action);
            } else if (exactText) {
                textCandidates.append(action);
            }
            if (exactObject
                || exactData
                || exactText
                || action->objectName().contains(
                    QStringLiteral("guide"),
                    Qt::CaseInsensitive)
                || data.contains(
                    QStringLiteral("guide"),
                    Qt::CaseInsensitive)
                || normalizedText == expectedHelpText) {
                observedActions.append(
                    QStringLiteral("object=%1|data=%2|text=%3")
                        .arg(action->objectName(), data, normalizedText));
            }
        }
        for (QWidget *widget : widgets) {
            auto *menu = qobject_cast<QMenu *>(widget);
            if (menu == nullptr) {
                continue;
            }
            QString title = menu->title().trimmed();
            title.remove(QLatin1Char('&'));
            if (title == expectedHelpText) {
                helpMenus.insert(menu);
            }
        }
        observedActions.sort();
        observedActions.removeDuplicates();
        if (observedActions != onboardingObservedActions_) {
            onboardingObservedActions_ = observedActions;
            writeDiagnostic(
                QStringLiteral("ready"),
                QStringLiteral(
                    "Embedded translation table installed; Onboarding QAction inventory advanced."),
                true);
        }
        if (exactCandidates.size() > 1 || textCandidates.size() > 1) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Onboarding QAction identity is ambiguous: exact=%1 text=%2.")
                    .arg(exactCandidates.size())
                    .arg(textCandidates.size()));
            return;
        }
        if (helpMenus.size() > 1) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "MenuBarManager/Help menu identity is ambiguous."));
            return;
        }
        if (!onboardingHelpProducerOpened_) {
            if (helpMenus.size() == 1) {
                QMenu *helpMenu = *helpMenus.constBegin();
                if (helpMenu != nullptr) {
                    // 通过真实 Help QMenu 触发 lazy producer，不向登录/
                    // 恢复窗口发送键盘、坐标或按钮输入。
                    helpMenu->popup(QPoint(-10000, -10000));
                    onboardingHelpProducerOpened_ = true;
                    onboardingAcceptanceMessage_ =
                        QStringLiteral(
                            "Opened the unique semantic Help menu offscreen to materialize showGuides.");
                    onboardingStageTimer_.restart();
                    writeDiagnostic(
                        QStringLiteral("ready"),
                        QStringLiteral(
                            "Onboarding acceptance opened the semantic Help producer."),
                        true);
                }
            }
            return;
        }
        QAction *action = exactCandidates.size() == 1
            ? exactCandidates.first()
            : (textCandidates.size() == 1
                ? textCandidates.first()
                : nullptr);
        if (action == nullptr) {
            return;
        }
        onboardingActionObjectName_ = action->objectName();
        onboardingActionIdentity_ =
            exactCandidates.size() == 1
            ? (action->objectName()
                    == QString::fromLatin1(kShowGuidesActionObjectName)
                ? QStringLiteral("objectName:showGuides")
                : QStringLiteral("data:showGuides"))
            : QStringLiteral(
                  "context-source:MenuBarManager/Getting Started Guides");
        onboardingActionWasEnabled_ = action->isEnabled();
        onboardingActionTemporarilyEnabled_ =
            !onboardingActionWasEnabled_;
        if (onboardingActionTemporarilyEnabled_) {
            action->setEnabled(true);
        }
        onboardingAcceptanceStatus_ =
            QStringLiteral("waiting-for-choice");
        onboardingAcceptanceMessage_ =
            QStringLiteral(
                "Triggered the unique semantic Getting Started Guides QAction; waiting for chooser.");
        onboardingStageTimer_.restart();
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Embedded translation table installed; Onboarding chooser requested."),
            true);
        const bool restoreDisabled =
            onboardingActionTemporarilyEnabled_;
        action->trigger();
        if (restoreDisabled) {
            action->setEnabled(false);
        }
        for (QMenu *menu : helpMenus) {
            if (menu != nullptr && menu->isVisible()) {
                menu->hide();
            }
        }
        return;
    }

    if (onboardingAcceptanceStatus_
        == QStringLiteral("waiting-for-choice")) {
        QWidget *choice =
            findVisibleWidgetByClass(kOnboardingChoiceClass);
        if (choice == nullptr) {
            return;
        }
        onboardingChoiceClass_ =
            QString::fromLatin1(choice->metaObject()->className());
        QObjectList choiceReceivers =
            QObjectPrivate::get(choice)->receiverList(
                SIGNAL(guideSelected(std::string)));
        if (choiceReceivers.isEmpty()) {
            choiceReceivers =
                QObjectPrivate::get(choice)->receiverList(
                    "guideSelected(std::string)");
        }
        QSet<QObject *> managerReceivers;
        for (QObject *receiver : choiceReceivers) {
            if (receiver != nullptr
                && receiver->metaObject() != nullptr
                && QString::fromLatin1(
                       receiver->metaObject()->className())
                    == QString::fromLatin1(
                        kOnboardingManagerClass)) {
                managerReceivers.insert(receiver);
            }
        }
        if (managerReceivers.size() != 1) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "guideSelected must expose exactly one OnboardingManager receiver; found %1.")
                    .arg(managerReceivers.size()));
            return;
        }
        onboardingManager_ =
            *managerReceivers.constBegin();
        QStringList choiceWidgets;
        QList<QWidget *> choiceChildren =
            choice->findChildren<QWidget *>(
                QString(),
                Qt::FindChildrenRecursively);
        choiceChildren.prepend(choice);
        for (QWidget *candidate : choiceChildren) {
            if (candidate == nullptr) {
                continue;
            }
            QString text;
            if (auto *button =
                    qobject_cast<QAbstractButton *>(candidate)) {
                text = button->text().trimmed();
            } else if (auto *label =
                           qobject_cast<QLabel *>(candidate)) {
                text = label->text().trimmed();
            }
            choiceWidgets.append(
                QStringLiteral(
                    "class=%1|object=%2|visible=%3|text=%4|geometry=%5x%6")
                    .arg(
                        QString::fromLatin1(
                            candidate->metaObject()->className()),
                        candidate->objectName(),
                        candidate->isVisibleTo(choice)
                            ? QStringLiteral("true")
                            : QStringLiteral("false"),
                        text)
                    .arg(candidate->width())
                    .arg(candidate->height()));
            const QMetaObject *candidateMeta =
                candidate->metaObject();
            const QString candidateClass =
                QString::fromLatin1(candidateMeta->className());
            if (candidateClass.startsWith(
                    QStringLiteral("onboarding::"))) {
                for (int index = candidateMeta->methodOffset();
                     index < candidateMeta->methodCount();
                     ++index) {
                    choiceWidgets.append(
                        QStringLiteral("meta-method=%1::%2")
                            .arg(
                                candidateClass,
                                QString::fromLatin1(
                                    candidateMeta->method(index)
                                        .methodSignature())));
                }
            }
        }
        choiceWidgets.sort();
        choiceWidgets.removeDuplicates();
        onboardingObservedWidgets_ = choiceWidgets;
        onboardingChoiceProducerClass_ =
            onboardingChoiceClass_;
        QByteArray guideIdParameterType;
        const QMetaMethod guideSelected =
            resolveDirectStringMethod(
                choice,
                "guideSelected",
                &guideIdParameterType);
        if (!guideSelected.isValid()) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "OnboardingChoiceView rejected guideSelected(%1).")
                    .arg(
                        QString::fromLatin1(
                            guideIdParameterType)));
            return;
        }
        onboardingGuideParameterType_ =
            QString::fromLatin1(
                guideIdParameterType);
        onboardingStep_ = 1;
        onboardingAcceptanceStatus_ =
            QStringLiteral("waiting-for-step");
        onboardingAcceptanceMessage_ =
            QStringLiteral(
                "Queued exact OnboardingChoiceView::guideSelected(firstLaunch); waiting for step 1 title/body.");
        onboardingStageTimer_.restart();
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Onboarding chooser identity, exact std::string ABI, and child inventory frozen before firstLaunch selection."),
            true);
        const QPointer<CavalryI18nRuntime> guardedRuntime(this);
        const QPointer<QObject> guardedChoice(choice);
        QTimer::singleShot(
            0,
            qApp,
            [
                guardedRuntime,
                guardedChoice,
                guideSelected,
                guideIdParameterType
            ] {
                if (guardedRuntime.isNull()
                    || guardedChoice.isNull()) {
                    if (!guardedRuntime.isNull()) {
                        guardedRuntime->failOnboardingAcceptance(
                            QStringLiteral(
                                "OnboardingChoiceView disappeared before the queued firstLaunch call."));
                    }
                    return;
                }
                const std::string guideId(
                    kFirstLaunchGuideId);
                if (!guideSelected.invoke(
                        guardedChoice.data(),
                        Qt::DirectConnection,
                        QGenericArgument(
                            guideIdParameterType.constData(),
                            &guideId))) {
                    guardedRuntime->failOnboardingAcceptance(
                        QStringLiteral(
                            "Exact OnboardingChoiceView::guideSelected(std::string) invocation failed."));
                }
                // guideSelected 可同步销毁 chooser；调用后不得解引用。
            });
        return;
    }

    if (onboardingAcceptanceStatus_
        == QStringLiteral("waiting-for-transition")) {
        QWidget *guide =
            findVisibleWidgetByClass(kOnboardingGuideClass);
        if (guide == nullptr
            || onboardingPendingStep_ < 2
            || onboardingPendingStep_ > kOnboardingStepCount) {
            return;
        }
        const QString expectedTitle =
            onboardingExpectedTitles_[onboardingPendingStep_ - 1];
        QTextDocument expectedBodyDocument;
        expectedBodyDocument.setHtml(
            onboardingExpectedBodies_[onboardingPendingStep_ - 1]);
        const QString expectedBody =
            expectedBodyDocument.toPlainText().trimmed();
        int expectedTitleHits = 0;
        int sourceTitleHits = 0;
        for (QLabel *label :
             guide->findChildren<QLabel *>(
                 QString(),
                 Qt::FindChildrenRecursively)) {
            if (label == nullptr || !label->isVisibleTo(guide)) {
                continue;
            }
            const QString text = label->text().trimmed();
            expectedTitleHits += text == expectedTitle;
            sourceTitleHits +=
                text == onboardingTransitionSourceTitle_;
        }
        int expectedBodyHits = 0;
        int sourceBodyHits = 0;
        for (QTextBrowser *browser :
             guide->findChildren<QTextBrowser *>(
                 QString(),
                 Qt::FindChildrenRecursively)) {
            if (browser == nullptr || !browser->isVisibleTo(guide)) {
                continue;
            }
            const QString text = browser->toPlainText().trimmed();
            expectedBodyHits += text == expectedBody;
            sourceBodyHits +=
                text == onboardingTransitionSourceBody_;
        }
        if (expectedTitleHits == 1 && expectedBodyHits == 1) {
            onboardingStep_ = onboardingPendingStep_;
            onboardingPendingStep_ = 0;
            onboardingTransitionClickAttempts_ = 0;
            onboardingTransitionSourceTitle_.clear();
            onboardingTransitionSourceBody_.clear();
            onboardingTitleMatches_ = false;
            onboardingBodyMatches_ = false;
            onboardingObservedTexts_.clear();
            onboardingAcceptanceStatus_ =
                QStringLiteral("waiting-for-step");
            onboardingAcceptanceMessage_ =
                QStringLiteral(
                    "The real guide title/body confirmed transition to step %1.")
                    .arg(onboardingStep_);
            onboardingStageTimer_.restart();
            writeDiagnostic(
                QStringLiteral("ready"),
                QStringLiteral(
                    "Embedded translation table installed; real Onboarding transition confirmed."),
                true);
            return;
        }
        if (sourceTitleHits != 1
            || sourceBodyHits != 1
            || !onboardingTransitionTimer_.isValid()
            || onboardingTransitionTimer_.elapsed()
                < kOnboardingTransitionRetryMilliseconds) {
            return;
        }
        if (onboardingTransitionClickAttempts_
            >= kOnboardingTransitionClickAttempts) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Localized Next click did not transition the real guide after %1 exact attempts.")
                    .arg(onboardingTransitionClickAttempts_));
            return;
        }
        const QString expectedNext =
            translationLookup_
                ->translate("MenuBarManager", "Next")
                .trimmed();
        QList<QAbstractButton *> forwardButtons;
        for (QAbstractButton *button :
             guide->findChildren<QAbstractButton *>(
                 QString(),
                 Qt::FindChildrenRecursively)) {
            if (button != nullptr
                && button->isVisibleTo(guide)
                && button->isEnabled()
                && button->text().trimmed() == expectedNext) {
                forwardButtons.append(button);
            }
        }
        if (expectedNext.isEmpty()
            || forwardButtons.size() != 1) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Onboarding transition retry requires exactly one enabled localized Next button; found %1.")
                    .arg(forwardButtons.size()));
            return;
        }
        QAbstractButton *const forward =
            forwardButtons.first();
        forward->click();
        ++onboardingTransitionClickAttempts_;
        onboardingTransitionTimer_.restart();
        onboardingAcceptanceMessage_ =
            QStringLiteral(
                "The previous real guide page remained stable; localized Next retry %1 was invoked.")
                .arg(onboardingTransitionClickAttempts_);
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Embedded translation table installed; bounded localized Next retry invoked."),
            true);
        return;
    }

    if (onboardingAcceptanceStatus_
        == QStringLiteral("waiting-for-step")) {
        QWidget *guide =
            findVisibleWidgetByClass(kOnboardingGuideClass);
        QStringList observedWidgets;
        const QWidgetList allWidgets = QApplication::allWidgets();
        for (QWidget *candidate : allWidgets) {
            if (candidate == nullptr) {
                continue;
            }
            const QString candidateClass =
                QString::fromLatin1(
                    candidate->metaObject()->className());
            if (!candidateClass.contains(
                    QStringLiteral("Onboarding"),
                    Qt::CaseInsensitive)) {
                continue;
            }
            observedWidgets.append(
                QStringLiteral(
                    "class=%1|object=%2|visible=%3|windowVisible=%4|geometry=%5x%6")
                    .arg(
                        candidateClass,
                        candidate->objectName(),
                        candidate->isVisible()
                            ? QStringLiteral("true")
                            : QStringLiteral("false"),
                        candidate->window() != nullptr
                                && candidate->window()->isVisible()
                            ? QStringLiteral("true")
                            : QStringLiteral("false"))
                    .arg(candidate->width())
                    .arg(candidate->height()));
        }
        if (guide != nullptr) {
            QList<QWidget *> guideWidgets =
                guide->findChildren<QWidget *>(
                    QString(),
                    Qt::FindChildrenRecursively);
            guideWidgets.prepend(guide);
            for (QWidget *widget : guideWidgets) {
                if (widget == nullptr) {
                    continue;
                }
                observedWidgets.append(
                    QStringLiteral(
                        "class=%1|object=%2|visible=%3|geometry=%4x%5")
                        .arg(
                            QString::fromLatin1(
                                widget->metaObject()->className()),
                            widget->objectName(),
                            widget->isVisibleTo(guide)
                                ? QStringLiteral("true")
                                : QStringLiteral("false"))
                        .arg(widget->width())
                        .arg(widget->height()));
            }
        }
        observedWidgets.sort();
        observedWidgets.removeDuplicates();
        if (!observedWidgets.isEmpty()
            && observedWidgets != onboardingObservedWidgets_) {
            onboardingObservedWidgets_ = observedWidgets;
            writeDiagnostic(
                QStringLiteral("ready"),
                QStringLiteral(
                    "Embedded translation table installed; Onboarding QWidget inventory advanced."),
                true);
        }
        if (guide == nullptr
            || onboardingStep_ < 1
            || onboardingStep_ > kOnboardingStepCount) {
            return;
        }
        onboardingGuideClass_ =
            QString::fromLatin1(guide->metaObject()->className());
        QWidget *guideWindow = guide->window();
        if (guideWindow == nullptr || !guideWindow->isVisible()) {
            return;
        }
        const HWND nativeGuideWindow =
            reinterpret_cast<HWND>(guideWindow->winId());
        if (nativeGuideWindow == nullptr) {
            return;
        }
        onboardingWindowHandle_ = QString::number(
            static_cast<qulonglong>(
                reinterpret_cast<quintptr>(nativeGuideWindow)));
        const QString expectedTitle =
            onboardingExpectedTitles_[onboardingStep_ - 1];
        const QString expectedBodyHtml =
            onboardingExpectedBodies_[onboardingStep_ - 1];
        QTextDocument expectedBodyDocument;
        expectedBodyDocument.setHtml(expectedBodyHtml);
        const QString expectedBody =
            expectedBodyDocument.toPlainText().trimmed();
        onboardingObservedTexts_.clear();
        onboardingTitle_.clear();
        onboardingBody_.clear();
        onboardingTitleMatches_ = false;
        onboardingBodyMatches_ = false;
        QLabel *titleLabel = nullptr;
        const QList<QLabel *> labels =
            guide->findChildren<QLabel *>(
                QString(),
                Qt::FindChildrenRecursively);
        for (QLabel *label : labels) {
            if (label == nullptr || !label->isVisibleTo(guide)) {
                continue;
            }
            const QString text = label->text().trimmed();
            if (text.isEmpty()) {
                continue;
            }
            onboardingObservedTexts_.append(text);
            if (text == expectedTitle && titleLabel != nullptr) {
                failOnboardingAcceptance(
                    QStringLiteral(
                        "Onboarding step %1 has ambiguous title QLabel identity.")
                        .arg(onboardingStep_));
                return;
            }
            if (text == expectedTitle) {
                titleLabel = label;
            }
        }
        QTextBrowser *bodyBrowser = nullptr;
        const QList<QTextBrowser *> bodyBrowsers =
            guide->findChildren<QTextBrowser *>(
                QString(),
                Qt::FindChildrenRecursively);
        for (QTextBrowser *browser : bodyBrowsers) {
            if (browser == nullptr || !browser->isVisibleTo(guide)) {
                continue;
            }
            const QString text = browser->toPlainText().trimmed();
            if (text.isEmpty()) {
                continue;
            }
            onboardingObservedTexts_.append(text);
            if (text == expectedBody && bodyBrowser != nullptr) {
                failOnboardingAcceptance(
                    QStringLiteral(
                        "Onboarding step %1 has ambiguous body QTextBrowser identity.")
                        .arg(onboardingStep_));
                return;
            }
            if (text == expectedBody) {
                bodyBrowser = browser;
            }
        }
        onboardingObservedTexts_.sort();
        onboardingObservedTexts_.removeDuplicates();
        onboardingTitleMatches_ = titleLabel != nullptr;
        onboardingBodyMatches_ =
            bodyBrowser != nullptr;
        if (!onboardingTitleMatches_ || !onboardingBodyMatches_) {
            return;
        }
        onboardingTitle_ = titleLabel->text().trimmed();
        onboardingBody_ = bodyBrowser->toPlainText().trimmed();
        if (onboardingStep_ == 1) {
            onboardingWorkspaceResetAvoided_ =
                !onboardingWorkspaceResetPromptObserved_;
        }
        onboardingAcceptanceStatus_ = QStringLiteral("ready");
        onboardingAcceptanceMessage_ =
            QStringLiteral(
                "Step %1 exposes one exact title QLabel and one exact body QTextBrowser; waiting for external screenshot acknowledgement.")
                .arg(onboardingStep_);
        onboardingStageTimer_.restart();
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Embedded translation table installed; Onboarding step is ready."),
            true);
        return;
    }

    if (onboardingAcceptanceStatus_ == QStringLiteral("ready")) {
        const QString acknowledgementPath =
            QDir(onboardingAcceptanceDirectory_)
                .filePath(
                    QStringLiteral("step-%1.ack.json")
                        .arg(onboardingStep_));
        const QFileInfo acknowledgementInfo(acknowledgementPath);
        if (!acknowledgementInfo.exists()) {
            return;
        }
        if (!acknowledgementInfo.isFile()
            || acknowledgementInfo.isSymLink()
            || acknowledgementInfo.dir().canonicalPath()
                != onboardingAcceptanceDirectory_) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Onboarding screenshot acknowledgement escaped its evidence directory."));
            return;
        }
        QFile acknowledgementFile(acknowledgementPath);
        if (!acknowledgementFile.open(QIODevice::ReadOnly)) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Cannot read Onboarding screenshot acknowledgement."));
            return;
        }
        QJsonParseError parseError;
        const QJsonDocument acknowledgement =
            QJsonDocument::fromJson(
                acknowledgementFile.readAll(),
                &parseError);
        if (parseError.error != QJsonParseError::NoError
            || !acknowledgement.isObject()
            || acknowledgement.object()
                    .value(QStringLiteral("step"))
                    .toInt()
                != onboardingStep_) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Onboarding screenshot acknowledgement has the wrong step."));
            return;
        }

        const int acknowledgedStep = onboardingStep_;
        if (acknowledgedStep == kOnboardingStepCount) {
            onboardingAcceptanceStatus_ = QStringLiteral("complete");
            onboardingAcceptanceMessage_ =
                QStringLiteral(
                    "All five firstLaunch steps were acknowledged.");
            restoreOnboardingManagerDisabledState();
            restoreQuitOnLastWindowClosed();
            writeDiagnostic(
                QStringLiteral("ready"),
                QStringLiteral(
                    "Embedded translation table installed; Onboarding acceptance complete."),
                true);
            return;
        }
        QWidget *guide =
            findVisibleWidgetByClass(kOnboardingGuideClass);
        if (guide == nullptr) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "OnboardingGuideView disappeared before its acknowledged transition."));
            return;
        }
        const QString expectedNext =
            translationLookup_
                ->translate("MenuBarManager", "Next")
                .trimmed();
        QList<QAbstractButton *> forwardButtons;
        for (QAbstractButton *button :
             guide->findChildren<QAbstractButton *>(
                 QString(),
                 Qt::FindChildrenRecursively)) {
            if (button != nullptr
                && button->isVisibleTo(guide)
                && button->isEnabled()
                && button->text().trimmed() == expectedNext) {
                forwardButtons.append(button);
            }
        }
        if (expectedNext.isEmpty()
            || forwardButtons.size() != 1) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Onboarding step %1 requires exactly one enabled localized Next button; found %2.")
                    .arg(acknowledgedStep)
                    .arg(forwardButtons.size()));
            return;
        }
        QAbstractButton *const forward =
            forwardButtons.first();
        onboardingPendingStep_ = acknowledgedStep + 1;
        onboardingTransitionSourceTitle_ = onboardingTitle_;
        onboardingTransitionSourceBody_ = onboardingBody_;
        onboardingTransitionClickAttempts_ = 1;
        onboardingTransitionTimer_.restart();
        forward->click();
        // click() 可同步发出 nextClicked 并销毁或重配 guide；调用后不再解引用。
        onboardingAcceptanceStatus_ =
            QStringLiteral("waiting-for-transition");
        onboardingAcceptanceMessage_ =
            QStringLiteral(
                "Localized Next was clicked; waiting for the real title/body transition to step %1.")
                .arg(onboardingPendingStep_);
        onboardingStageTimer_.restart();
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Embedded translation table installed; localized Next button click invoked."),
            true);
        return;
    }

}

void CavalryI18nRuntime::writeDiagnostic(
    const QString &,
    const QString &,
    bool) const
{
    if (onboardingAcceptanceDirectory_.isEmpty()) {
        return;
    }

    QJsonArray observedActions;
    for (const QString &action : onboardingObservedActions_) {
        observedActions.append(action);
    }
    QJsonArray observedTexts;
    for (const QString &text : onboardingObservedTexts_) {
        observedTexts.append(text);
    }
    QJsonArray observedWidgets;
    for (const QString &widget : onboardingObservedWidgets_) {
        observedWidgets.append(widget);
    }
    QJsonArray bypassedWindows;
    for (const QString &window : onboardingBypassedWindows_) {
        bypassedWindows.append(window);
    }
    const QJsonObject onboardingAcceptance {
        {
            QStringLiteral("enabled"),
            onboardingAcceptanceEnabled_
        },
        {
            QStringLiteral("status"),
            onboardingAcceptanceStatus_
        },
        {
            QStringLiteral("message"),
            onboardingAcceptanceMessage_
        },
        {
            QStringLiteral("step"),
            onboardingStep_
        },
        {
            QStringLiteral("totalSteps"),
            kOnboardingStepCount
        },
        {
            QStringLiteral("guideId"),
            QString::fromLatin1(kFirstLaunchGuideId)
        },
        {
            QStringLiteral("actionObjectName"),
            onboardingActionObjectName_
        },
        {
            QStringLiteral("actionIdentity"),
            onboardingActionIdentity_
        },
        {
            QStringLiteral("actionWasEnabled"),
            onboardingActionWasEnabled_
        },
        {
            QStringLiteral("actionTemporarilyEnabled"),
            onboardingActionTemporarilyEnabled_
        },
        {
            QStringLiteral("managerWasDisabled"),
            onboardingManagerWasDisabled_
        },
        {
            QStringLiteral("managerTemporarilyEnabled"),
            onboardingManagerTemporarilyEnabled_
        },
        {
            QStringLiteral("managerEnableBypassUsed"),
            onboardingManagerEnableBypassUsed_
        },
        {
            QStringLiteral("managerDisabledStateRestored"),
            onboardingManagerDisabledStateRestored_
        },
        {
            QStringLiteral("choiceClass"),
            onboardingChoiceClass_
        },
        {
            QStringLiteral("choiceProducerClass"),
            onboardingChoiceProducerClass_
        },
        {
            QStringLiteral("guideParameterType"),
            onboardingGuideParameterType_
        },
        {
            QStringLiteral("guideClass"),
            onboardingGuideClass_
        },
        {
            QStringLiteral("windowHandle"),
            onboardingWindowHandle_
        },
        {
            QStringLiteral("title"),
            onboardingTitle_
        },
        {
            QStringLiteral("body"),
            onboardingBody_
        },
        {
            QStringLiteral("titleMatches"),
            onboardingTitleMatches_
        },
        {
            QStringLiteral("bodyMatches"),
            onboardingBodyMatches_
        },
        {
            QStringLiteral("loginControllerQuitBypassed"),
            onboardingQuitBypassed_
        },
        {
            QStringLiteral("workspaceResetPromptObserved"),
            onboardingWorkspaceResetPromptObserved_
        },
        {
            QStringLiteral("workspaceResetAvoided"),
            onboardingWorkspaceResetAvoided_
        },
        {
            QStringLiteral("startupSettled"),
            onboardingStartupSettled_
        },
        {
            QStringLiteral("observedActions"),
            observedActions
        },
        {
            QStringLiteral("observedTexts"),
            observedTexts
        },
        {
            QStringLiteral("observedWidgets"),
            observedWidgets
        },
        {
            QStringLiteral("bypassedWindows"),
            bypassedWindows
        },
    };
    const QJsonObject marker {
        {
            QStringLiteral("schema"),
            QStringLiteral(
                "cavalry-i18n.windows-onboarding.acceptance-state/v1")
        },
        {
            QStringLiteral("language"),
            language_
        },
        {
            QStringLiteral("processId"),
            QString::number(QCoreApplication::applicationPid())
        },
        {
            QStringLiteral("onboardingAcceptance"),
            onboardingAcceptance
        },
    };

    QSaveFile stateFile(
        QDir(onboardingAcceptanceDirectory_)
            .filePath(QStringLiteral("onboarding-state.json")));
    if (!stateFile.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        return;
    }
    if (stateFile.write(
            QJsonDocument(marker).toJson(QJsonDocument::Indented)) < 0) {
        stateFile.cancelWriting();
        return;
    }
    stateFile.commit();
}

#undef CavalryI18nRuntime
#endif

#ifndef CAVALRY_I18N_ONBOARDING_ACCEPTANCE_ONLY

void CavalryI18nRuntime::ensureExtensionLayerHook()
{
    if (!translatorInstalled_ || extensionLayerHook_ == nullptr) {
        return;
    }

    const QString previousStatus = extensionLayerHook_->status();
    extensionLayerHook_->ensureInstalled();
    if (extensionLayerHook_->status() != previousStatus) {
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral("Embedded translation table installed."),
            true);
        lastTextPathDiagnosticRevision_ =
            extensionLayerHook_->textPathDiagnostics().revision;
    }
}

void CavalryI18nRuntime::maybeWriteTextPathDiagnostic()
{
    if (!translatorInstalled_ || extensionLayerHook_ == nullptr) {
        return;
    }
    const CavalryTextPathHookDiagnostics diagnostics =
        extensionLayerHook_->textPathDiagnostics();
    if (diagnostics.revision
        == lastTextPathDiagnosticRevision_) {
        return;
    }
    lastTextPathDiagnosticRevision_ = diagnostics.revision;
    writeDiagnostic(
        QStringLiteral("ready"),
        QStringLiteral(
            "Embedded translation table installed; text-path diagnostics advanced."),
        true);
}

void CavalryI18nRuntime::queueRefresh(QWidget *root)
{
    const QPointer<QWidget> guardedRoot(root);
    QMetaObject::invokeMethod(
        this,
        [this, guardedRoot]() {
            if (!guardedRoot.isNull()) {
                refreshWindow(guardedRoot.data());
            }
        },
        Qt::QueuedConnection);
}

void CavalryI18nRuntime::refreshAllTopLevelWidgets()
{
    if (!translatorInstalled_
        || qobject_cast<QApplication *>(QCoreApplication::instance()) == nullptr) {
        return;
    }

    ensureExtensionLayerHook();

    const QWidgetList windows = QApplication::topLevelWidgets();
    for (QWidget *window : windows) {
        refreshWindow(window);
    }
}

void CavalryI18nRuntime::refreshWindow(QWidget *window)
{
    if (!translatorInstalled_ || displayTranslator_ == nullptr
        || window == nullptr) {
        return;
    }

    QEvent languageChange(QEvent::LanguageChange);
    QCoreApplication::sendEvent(window, &languageChange);
    displayTranslator_->translateWidgetTree(window);
}

void CavalryI18nRuntime::writeDiagnostic(
    const QString &status,
    const QString &message,
    bool translatorInstalled) const
{
    if (status == QStringLiteral("error")) {
        qWarning().noquote()
            << QStringLiteral("[%1] %2").arg(
                   QString::fromLatin1(kPluginKey),
                   message);
    } else {
        qInfo().noquote()
            << QStringLiteral("[%1] %2").arg(
                   QString::fromLatin1(kPluginKey),
                   message);
    }

    const QString markerPath =
        qEnvironmentVariable(kMarkerEnvironment).trimmed();
    if (markerPath.isEmpty()) {
        return;
    }

    if (!QDir::isAbsolutePath(markerPath)) {
        qWarning().noquote()
            << QStringLiteral(
                   "[%1] Ignoring relative diagnostic marker path.")
                   .arg(QString::fromLatin1(kPluginKey));
        return;
    }

    const QFileInfo markerInfo(QDir::cleanPath(markerPath));
    if (!markerInfo.dir().exists()) {
        qWarning().noquote()
            << QStringLiteral(
                   "[%1] Diagnostic marker parent directory does not exist.")
                   .arg(QString::fromLatin1(kPluginKey));
        return;
    }

    const CavalryTextPathHookDiagnostics textPathDiagnostics =
        extensionLayerHook_ == nullptr
        ? CavalryTextPathHookDiagnostics {}
        : extensionLayerHook_->textPathDiagnostics();
    const QJsonObject textPathDiagnosticObject {
        {
            QStringLiteral("revision"),
            static_cast<qint64>(textPathDiagnostics.revision)
        },
        {
            QStringLiteral("canonicalCalls"),
            static_cast<qint64>(textPathDiagnostics.canonicalCalls)
        },
        {
            QStringLiteral("whitelistCalls"),
            static_cast<qint64>(textPathDiagnostics.whitelistCalls)
        },
        {
            QStringLiteral("cjkPathSuccess"),
            static_cast<qint64>(textPathDiagnostics.cjkPathSuccess)
        },
        {
            QStringLiteral("originalFallback"),
            static_cast<qint64>(textPathDiagnostics.originalFallback)
        },
        {
            QStringLiteral("noTranslation"),
            static_cast<qint64>(textPathDiagnostics.noTranslation)
        },
        {
            QStringLiteral("rendererFailure"),
            static_cast<qint64>(textPathDiagnostics.rendererFailure)
        },
        {
            QStringLiteral("translatedSourceMask"),
            static_cast<qint64>(
                textPathDiagnostics.translatedSourceMask)
        },
        {
            QStringLiteral("fallbackSourceMask"),
            static_cast<qint64>(
                textPathDiagnostics.fallbackSourceMask)
        },
    };

    const QJsonObject marker {
        { QStringLiteral("plugin"), QString::fromLatin1(kPluginKey) },
        { QStringLiteral("status"), status },
        { QStringLiteral("message"), message },
        { QStringLiteral("language"), language_ },
        {
            QStringLiteral("translationSource"),
            QStringLiteral("embedded-generated-table")
        },
        {
            QStringLiteral("embeddedEntryCount"),
            translator_ != nullptr ? translator_->entryCount() : 0
        },
        {
            QStringLiteral("exactKeyCount"),
            translator_ != nullptr ? translator_->exactKeyCount() : 0
        },
        {
            QStringLiteral("sourceFallbackCount"),
            translator_ != nullptr ? translator_->sourceFallbackCount() : 0
        },
        { QStringLiteral("translatorInstalled"), translatorInstalled },
        {
            QStringLiteral("extensionLayerHookStatus"),
            extensionLayerHook_ != nullptr
                ? extensionLayerHook_->status()
                : QStringLiteral("not-requested")
        },
        {
            QStringLiteral("extensionLayerHookDetail"),
            extensionLayerHook_ != nullptr
                ? extensionLayerHook_->detail()
                : QStringLiteral("No non-English embedded translator is installed.")
        },
        {
            QStringLiteral("extensionLayerTextPathDiagnostics"),
            textPathDiagnosticObject
        },
        { QStringLiteral("qtVersion"), QString::fromLatin1(qVersion()) },
        {
            QStringLiteral("processId"),
            QString::number(QCoreApplication::applicationPid())
        },
    };

    QSaveFile markerFile(markerInfo.absoluteFilePath());
    if (!markerFile.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        qWarning().noquote()
            << QStringLiteral("[%1] Cannot open diagnostic marker: %2")
                   .arg(
                       QString::fromLatin1(kPluginKey),
                       markerFile.errorString());
        return;
    }

    markerFile.write(QJsonDocument(marker).toJson(QJsonDocument::Indented));
    if (!markerFile.commit()) {
        qWarning().noquote()
            << QStringLiteral("[%1] Cannot commit diagnostic marker: %2")
                   .arg(
                       QString::fromLatin1(kPluginKey),
                       markerFile.errorString());
    }
}

#endif
