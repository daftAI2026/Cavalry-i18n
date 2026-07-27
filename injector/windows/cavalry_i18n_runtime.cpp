/**
 * [INPUT]: 依赖 QPA 显式 requestedLanguage、嵌入生成表、四条精确 hook、可选绝对 marker 与 Qt 6.6.3 事件循环
 * [OUTPUT]: 对外安装 translator/显示投影、报告配置成功，并以事件重试 hook、按 text-path revision 写结构化诊断
 * [POS]: injector/windows 的运行时状态机；语言只来自已通过 manifest/hash gate 的 QPA 显式参数，不读取进程语言环境
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_runtime.h"

#include "cavalry_i18n_display.h"
#include "cavalry_i18n_extension_layer_hook.h"
#include "cavalry_i18n_translator.h"

#include <QtCore/QCoreApplication>
#include <QtCore/QDir>
#include <QtCore/QEvent>
#include <QtCore/QFileInfo>
#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>
#include <QtCore/QMetaObject>
#include <QtCore/QPointer>
#include <QtCore/QSaveFile>
#include <QtCore/QThread>
#include <QtCore/QTimer>
#include <QtCore/QDebug>
#include <QtGui/QActionEvent>
#include <QtWidgets/QApplication>
#include <QtWidgets/QAbstractButton>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QGroupBox>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QMenu>
#include <QtWidgets/QTabBar>
#include <QtWidgets/QWidget>

namespace {

constexpr auto kPluginKey = "cavalryi18n";
constexpr auto kMarkerEnvironment = "CAVALRY_I18N_DIAGNOSTIC_MARKER";

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
    const QString diagnosticMarker =
        qEnvironmentVariable(kMarkerEnvironment).trimmed();
    if (QDir::isAbsolutePath(diagnosticMarker)) {
        auto *diagnosticTimer = new QTimer(this);
        diagnosticTimer->setInterval(75);
        QObject::connect(
            diagnosticTimer,
            &QTimer::timeout,
            this,
            [this]() { maybeWriteTextPathDiagnostic(); });
        diagnosticTimer->start();
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
        displayTranslator_->translateAction(actionEvent->action());
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
            static_cast<int>(textPathDiagnostics.translatedSourceMask)
        },
        {
            QStringLiteral("fallbackSourceMask"),
            static_cast<int>(textPathDiagnostics.fallbackSourceMask)
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
