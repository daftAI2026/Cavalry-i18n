/**
 * [INPUT]: 依赖 CAVALRY_I18N_LANG、嵌入式生成表、ExtensionLayer 精确 hook、可选诊断 marker 与 Qt 6.6.3 应用实例
 * [OUTPUT]: 对外安装 EmbeddedTranslator、主动刷新既有/动态显示属性、在 Show/Paint 前重试目标模块 hook，并原子记录加载结果
 * [POS]: injector/windows 的运行时状态机，以事件驱动白名单弥补厂商控件不响应 LanguageChange 与精确自绘提示的边界
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
#include <QtCore/QDebug>
#include <QtGui/QActionEvent>
#include <QtWidgets/QApplication>
#include <QtWidgets/QAbstractButton>
#include <QtWidgets/QGroupBox>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QMenu>
#include <QtWidgets/QTabBar>
#include <QtWidgets/QWidget>

namespace {

constexpr auto kPluginKey = "cavalryi18n";
constexpr auto kLanguageEnvironment = "CAVALRY_I18N_LANG";
constexpr auto kMarkerEnvironment = "CAVALRY_I18N_DIAGNOSTIC_MARKER";

bool isSupportedLanguage(const QString &language)
{
    return language == QStringLiteral("en")
        || language == QStringLiteral("zh-Hans")
        || language == QStringLiteral("zh-Hant")
        || language == QStringLiteral("ja_JP");
}

} // namespace

CavalryI18nRuntime::CavalryI18nRuntime()
{
    configure();
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

    language_ = qEnvironmentVariable(kLanguageEnvironment).trimmed();
    if (!isSupportedLanguage(language_)) {
        writeDiagnostic(
            QStringLiteral("error"),
            QStringLiteral("Unsupported or missing CAVALRY_I18N_LANG."),
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
        // 这些类型没有统一的 textChanged 信号；Paint 前的小白名单能接住厂商动态写回。
        if (qobject_cast<QLabel *>(widget) != nullptr
            || qobject_cast<QAbstractButton *>(widget) != nullptr
            || qobject_cast<QGroupBox *>(widget) != nullptr
            || qobject_cast<QLineEdit *>(widget) != nullptr
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
    }
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
