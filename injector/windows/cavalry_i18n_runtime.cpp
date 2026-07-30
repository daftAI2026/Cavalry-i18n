/**
 * [INPUT]: 依赖 QPA 显式 requestedLanguage、嵌入生成表、四条精确 hook、受控 Qt 显示槽、可选绝对 marker，以及显式同目录 Onboarding 验收握手
 * [OUTPUT]: 对外安装 translator/显示投影、报告配置成功，并以事件重试 hook、按 text-path revision 写结构化诊断；验收开启时语义触发并逐步证明 firstLaunch 标题与独立正文
 * [POS]: injector/windows 的运行时状态机；正常语言只来自 manifest/hash gate，验收分支不使用坐标/UIA，且仅在受控证据目录存在时驱动产品 Qt 对象
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_runtime.h"

#include "cavalry_i18n_display.h"
#include "cavalry_i18n_extension_layer_hook.h"
#include "cavalry_i18n_translator.h"

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
#include <QtWidgets/QGroupBox>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QMenu>
#include <QtWidgets/QPlainTextEdit>
#include <QtWidgets/QTabBar>
#include <QtWidgets/QTextBrowser>
#include <QtWidgets/QWidget>

#include <string>

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

namespace {

constexpr auto kPluginKey = "cavalryi18n";
constexpr auto kMarkerEnvironment = "CAVALRY_I18N_DIAGNOSTIC_MARKER";
constexpr auto kOnboardingAcceptanceEnvironment =
    "CAVALRY_I18N_WINDOWS_ONBOARDING_ACCEPTANCE_DIR";
constexpr auto kShowGuidesActionObjectName = "showGuides";
constexpr auto kOnboardingChoiceClass =
    "onboarding::OnboardingChoiceView";
constexpr auto kOnboardingGuideClass =
    "onboarding::OnboardingGuideView";
constexpr auto kFirstLaunchGuideId = "firstLaunch";
constexpr int kOnboardingStepCount = 5;
constexpr qint64 kOnboardingStageTimeoutMilliseconds = 45'000;

bool invokeDirectStringMethod(
    QObject *object,
    const char *methodName,
    const std::string &value,
    QByteArray *parameterType)
{
    if (object == nullptr) {
        return false;
    }
    const QMetaObject *metaObject = object->metaObject();
    for (int index = 0; index < metaObject->methodCount(); ++index) {
        const QMetaMethod method = metaObject->method(index);
        const QList<QByteArray> parameterTypes =
            method.parameterTypes();
        if (method.name() != methodName
            || parameterTypes.size() != 1) {
            continue;
        }
        *parameterType = parameterTypes.first();
        if (*parameterType != QByteArrayLiteral("std::string")) {
            continue;
        }
        return method.invoke(
            object,
            Qt::DirectConnection,
            QGenericArgument(
                parameterType->constData(),
                &value));
    }
    return false;
}

} // namespace

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
    configureOnboardingAcceptance();
    const QString diagnosticMarker =
        qEnvironmentVariable(kMarkerEnvironment).trimmed();
    if (QDir::isAbsolutePath(diagnosticMarker)) {
        // generic plugin 可能在 QApplication 的事件分发器启动前构造。
        // 把轮询器的创建也投递给 application，确保登录/模态窗口并存时
        // ready -> external screenshot -> ack 状态机仍由 GUI 线程持续推进。
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
                        if (!guardedRuntime->onboardingDriveActive_) {
                            guardedRuntime->onboardingDriveActive_ = true;
                            guardedRuntime->driveOnboardingAcceptance();
                            guardedRuntime->onboardingDriveActive_ = false;
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
        if (onboardingAcceptanceEnabled_
            && onboardingAcceptanceStatus_
                == QStringLiteral("waiting-for-action")
            && action != nullptr) {
            QString normalizedText = action->text().trimmed();
            normalizedText.remove(QLatin1Char('&'));
            const QString data = action->data().toString().trimmed();
            const QString expectedText = translator_->translate(
                "MenuBarManager",
                "Getting Started Guides");
            const bool exactObject =
                action->objectName()
                == QString::fromLatin1(kShowGuidesActionObjectName);
            const bool exactData =
                data == QString::fromLatin1(kShowGuidesActionObjectName);
            const bool exactText =
                !expectedText.isEmpty() && normalizedText == expectedText;
            if (exactObject || exactData || exactText) {
                onboardingActionObjectName_ = action->objectName();
                onboardingActionIdentity_ = exactObject
                    ? QStringLiteral("objectName:showGuides")
                    : (exactData
                        ? QStringLiteral("data:showGuides")
                        : QStringLiteral(
                            "context-source:MenuBarManager/Getting Started Guides"));
                onboardingObservedActions_.append(
                    QStringLiteral("object=%1|data=%2|text=%3")
                        .arg(action->objectName(), data, normalizedText));
                onboardingAcceptanceStatus_ =
                    QStringLiteral("waiting-for-choice");
                onboardingAcceptanceMessage_ =
                    QStringLiteral(
                        "Captured the exact lazy Getting Started Guides QAction; queued trigger.");
                onboardingStageTimer_.restart();
                const QPointer<QAction> guardedAction(action);
                QMetaObject::invokeMethod(
                    this,
                    [this, guardedAction]() {
                        if (!guardedAction.isNull()
                            && onboardingAcceptanceStatus_
                                == QStringLiteral(
                                    "waiting-for-choice")) {
                            guardedAction->trigger();
                            writeDiagnostic(
                                QStringLiteral("ready"),
                                QStringLiteral(
                                    "Embedded translation table installed; lazy Onboarding QAction triggered."),
                                true);
                        }
                    },
                    Qt::QueuedConnection);
            }
        }
        if (!onboardingDriveActive_) {
            onboardingDriveActive_ = true;
            driveOnboardingAcceptance();
            onboardingDriveActive_ = false;
        }
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

    switch (event->type()) {
    case QEvent::Show:
        // QMenu 必须在首帧前同步完成；普通控件也在自身 Show 前完成一次。
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

    if (!onboardingDriveActive_
        && (event->type() == QEvent::Show
            || event->type() == QEvent::Paint)) {
        onboardingDriveActive_ = true;
        driveOnboardingAcceptance();
        onboardingDriveActive_ = false;
    }

    return false;
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
    const QString acceptanceParent = acceptanceInfo.dir().canonicalPath();
    if (markerParent.isEmpty()
        || !acceptanceInfo.isDir()
        || acceptanceInfo.isSymLink()
        || acceptanceParent != markerParent) {
        failOnboardingAcceptance(
            QStringLiteral(
                "Onboarding acceptance directory must be a real direct child of the diagnostic marker directory."));
        return;
    }
    onboardingAcceptanceDirectory_ = acceptanceInfo.canonicalFilePath();

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
        QStringLiteral("waiting-for-foreground");
    onboardingAcceptanceMessage_ =
        QStringLiteral(
            "Waiting for the external exact-HWND foreground evidence acknowledgement.");
    // 外部 helper 还可能在收集其他场景或等待 Windows 前台所有权；
    // 产品内部阶段超时从 foreground ACK 后才开始计算。
    onboardingStageTimer_.invalidate();
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
    writeDiagnostic(
        QStringLiteral("ready"),
        QStringLiteral("Embedded translation table installed; Onboarding acceptance failed."),
        translatorInstalled_);
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
        == QStringLiteral("waiting-for-foreground")) {
        const QString acknowledgementPath =
            QDir(onboardingAcceptanceDirectory_)
                .filePath(QStringLiteral("foreground-ready.json"));
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
                    "Foreground acknowledgement escaped its evidence directory."));
            return;
        }
        QFile acknowledgementFile(acknowledgementPath);
        if (!acknowledgementFile.open(QIODevice::ReadOnly)) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Cannot read foreground evidence acknowledgement."));
            return;
        }
        QJsonParseError parseError;
        const QJsonDocument acknowledgement =
            QJsonDocument::fromJson(
                acknowledgementFile.readAll(),
                &parseError);
        if (parseError.error != QJsonParseError::NoError
            || !acknowledgement.isObject()
            || !acknowledgement.object()
                    .value(QStringLiteral("ready"))
                    .toBool()) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "Foreground evidence acknowledgement is invalid."));
            return;
        }
        onboardingAcceptanceStatus_ =
            QStringLiteral("waiting-for-action");
        onboardingAcceptanceMessage_ =
            QStringLiteral(
                "Exact-HWND foreground evidence acknowledged; waiting for showGuides.");
        onboardingStageTimer_.start();
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Embedded translation table installed; foreground evidence acknowledged."),
            true);
        return;
    }

    if (onboardingAcceptanceStatus_
        == QStringLiteral("waiting-for-action")) {
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

        const QString expectedText = translator_->translate(
            "MenuBarManager",
            "Getting Started Guides");
        const QString expectedHelpText = translator_->translate(
            "MenuBarManager",
            "Help");
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
        QAction *action = exactCandidates.size() == 1
            ? exactCandidates.first()
            : (textCandidates.size() == 1
                ? textCandidates.first()
                : nullptr);
        if (action == nullptr) {
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
            if (helpMenus.size() > 1) {
                failOnboardingAcceptance(
                    QStringLiteral(
                        "MenuBarManager/Help menu identity is ambiguous."));
            } else if (!onboardingHelpMnemonicSent_) {
                QWidget *mainWindow = nullptr;
                qint64 mainWindowArea = 0;
                bool mainWindowAmbiguous = false;
                const QWidgetList topLevelWindows =
                    QApplication::topLevelWidgets();
                for (QWidget *widget : topLevelWindows) {
                    if (widget == nullptr
                        || !widget->isVisible()
                        || qobject_cast<QMenu *>(widget) != nullptr) {
                        continue;
                    }
                    const qint64 area =
                        static_cast<qint64>(widget->width())
                        * static_cast<qint64>(widget->height());
                    if (area > mainWindowArea) {
                        mainWindow = widget;
                        mainWindowArea = area;
                        mainWindowAmbiguous = false;
                    } else if (area > 0 && area == mainWindowArea) {
                        mainWindowAmbiguous = true;
                    }
                }
                if (mainWindowAmbiguous) {
                    failOnboardingAcceptance(
                        QStringLiteral(
                            "Largest visible Cavalry QWidget identity is ambiguous."));
                    return;
                }
                if (mainWindow != nullptr) {
                    const HWND nativeWindow =
                        reinterpret_cast<HWND>(mainWindow->winId());
                    if (GetForegroundWindow() != nativeWindow) {
                        SetForegroundWindow(nativeWindow);
                        onboardingAcceptanceMessage_ =
                            QStringLiteral(
                                "Requested foreground ownership for the unique largest Cavalry HWND before the Help mnemonic.");
                        return;
                    }
                    constexpr DWORD kKeyUp = KEYEVENTF_KEYUP;
                    keybd_event(VK_MENU, 0, 0, 0);
                    keybd_event('H', 0, 0, 0);
                    keybd_event('H', 0, kKeyUp, 0);
                    keybd_event(VK_MENU, 0, kKeyUp, 0);
                    onboardingHelpMnemonicSent_ = true;
                    onboardingAcceptanceMessage_ =
                        QStringLiteral(
                            "Sent one native Alt+H after exact foreground-HWND confirmation.");
                    onboardingStageTimer_.restart();
                    writeDiagnostic(
                        QStringLiteral("ready"),
                        QStringLiteral(
                            "Embedded translation table installed; exact-HWND Help mnemonic sent."),
                        true);
                }
            }
            return;
        }
        for (QMenu *menu : helpMenus) {
            if (menu != nullptr && menu->isVisible()) {
                menu->hide();
            }
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
        onboardingAcceptanceStatus_ =
            QStringLiteral("waiting-for-choice");
        onboardingAcceptanceMessage_ =
            QStringLiteral(
                "Triggered the unique semantic Getting Started Guides QAction; waiting for chooser.");
        onboardingStageTimer_.restart();
        action->trigger();
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Embedded translation table installed; Onboarding chooser requested."),
            true);
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
        const std::string guideId(kFirstLaunchGuideId);
        QByteArray guideIdParameterType;
        onboardingAcceptanceStatus_ =
            QStringLiteral("selecting-guide");
        onboardingAcceptanceMessage_ =
            QStringLiteral(
                "Invoking guideSelected(firstLaunch); chooser identity is frozen.");
        if (!invokeDirectStringMethod(
                choice,
                "guideSelected",
                guideId,
                &guideIdParameterType)) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "OnboardingChoiceView rejected guideSelected(%1).")
                    .arg(
                        QString::fromLatin1(
                            guideIdParameterType)));
            return;
        }
        onboardingGuideParameterType_ =
            QString::fromLatin1(guideIdParameterType);
        // guideSelected 同步销毁 chooser；从这里开始不得再解引用 choice。
        onboardingStep_ = 1;
        onboardingAcceptanceStatus_ =
            QStringLiteral("waiting-for-step");
        onboardingAcceptanceMessage_ =
            QStringLiteral("firstLaunch selected; waiting for step 1 title/body.");
        onboardingStageTimer_.restart();
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Embedded translation table installed; firstLaunch selected."),
            true);
        return;
    }

    if (onboardingAcceptanceStatus_
        == QStringLiteral("waiting-for-step")) {
        QWidget *guide =
            findVisibleWidgetByClass(kOnboardingGuideClass);
        QStringList observedWidgets;
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
        if (observedWidgets != onboardingObservedWidgets_) {
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
        if (!QMetaObject::invokeMethod(
                guide,
                "nextClicked",
                Qt::DirectConnection)) {
            failOnboardingAcceptance(
                QStringLiteral(
                    "OnboardingGuideView rejected nextClicked()."));
            return;
        }
        // nextClicked 可同步销毁或重配 guide；从这里开始不得再解引用 guide。
        onboardingTitleMatches_ = false;
        onboardingBodyMatches_ = false;
        onboardingObservedTexts_.clear();
        onboardingStageTimer_.restart();
        onboardingStep_ = acknowledgedStep + 1;
        onboardingAcceptanceStatus_ =
            QStringLiteral("waiting-for-step");
        onboardingAcceptanceMessage_ =
            QStringLiteral("Waiting for step %1 title/body.")
                .arg(onboardingStep_);
        writeDiagnostic(
            QStringLiteral("ready"),
            QStringLiteral(
                "Embedded translation table installed; Onboarding step acknowledged."),
            true);
        return;
    }

}

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

    QJsonArray onboardingObservedActions;
    for (const QString &action : onboardingObservedActions_) {
        onboardingObservedActions.append(action);
    }
    QJsonArray onboardingObservedTexts;
    for (const QString &text : onboardingObservedTexts_) {
        onboardingObservedTexts.append(text);
    }
    QJsonArray onboardingObservedWidgets;
    for (const QString &widget : onboardingObservedWidgets_) {
        onboardingObservedWidgets.append(widget);
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
            QStringLiteral("choiceClass"),
            onboardingChoiceClass_
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
            QStringLiteral("observedActions"),
            onboardingObservedActions
        },
        {
            QStringLiteral("observedTexts"),
            onboardingObservedTexts
        },
        {
            QStringLiteral("observedWidgets"),
            onboardingObservedWidgets
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
        {
            QStringLiteral("onboardingAcceptance"),
            onboardingAcceptance
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
