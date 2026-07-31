/**
 * [INPUT]: 依赖 Windows adjacent acceptance 显式目录/fixture、当前语言 oracle、QApplication 控件树与外部截图封存 ACK
 * [OUTPUT]: 对外实现 TagHeader→PopOverView 与 Assets Drop→ContextMenu 两条真实 producer 流，并在 producer 时序内写出三张 QWidget PNG、PID/HWND 锚点握手及两个逻辑结果
 * [POS]: injector/windows 的验收专用实现；以可观察控件后置条件推进，不把固定等待、坐标脚本、UIA 或强杀引入产品运行时
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_adjacent_acceptance.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <QtCore/QCoreApplication>
#include <QtCore/QDir>
#include <QtCore/QElapsedTimer>
#include <QtCore/QFile>
#include <QtCore/QFileInfo>
#include <QtCore/QJsonArray>
#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>
#include <QtCore/QMetaObject>
#include <QtCore/QMimeData>
#include <QtCore/QPointer>
#include <QtCore/QTimer>
#include <QtCore/QUrl>
#include <QtGui/QAction>
#include <QtGui/QContextMenuEvent>
#include <QtGui/QDragEnterEvent>
#include <QtGui/QDropEvent>
#include <QtGui/QMouseEvent>
#include <QtGui/QPaintEvent>
#include <QtGui/QPixmap>
#include <QtWidgets/QAbstractItemView>
#include <QtWidgets/QApplication>
#include <QtWidgets/QDialog>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QMenu>
#include <QtWidgets/QWidget>

#include <functional>
#include <limits>

namespace {

constexpr auto kAcceptanceEnvironment =
    "CAVALRY_I18N_WINDOWS_ADJACENT_ACCEPTANCE_DIR";
constexpr auto kDiagnosticMarkerEnvironment =
    "CAVALRY_I18N_DIAGNOSTIC_MARKER";
constexpr auto kReplaceFixtureEnvironment =
    "CAVALRY_I18N_WINDOWS_ADJACENT_REPLACE_FIXTURE";
constexpr auto kDynamicFixtureEnvironment =
    "CAVALRY_I18N_WINDOWS_ADJACENT_DYNAMIC_FIXTURE";
constexpr int kTopologyAttempts = 100;
constexpr int kRowAttempts = 100;
constexpr int kMenuAttempts = 100;
constexpr qint64 kCaptureTimeoutMilliseconds = 45'000;

QString className(const QObject *object)
{
    return object != nullptr && object->metaObject() != nullptr
        ? QString::fromLatin1(object->metaObject()->className())
        : QStringLiteral("<null>");
}

bool ancestorHasClass(
    const QObject *object,
    const QString &expected)
{
    for (const QObject *cursor =
             object != nullptr ? object->parent() : nullptr;
         cursor != nullptr;
         cursor = cursor->parent()) {
        if (className(cursor) == expected) {
            return true;
        }
    }
    return false;
}

QString safeSurfaceName(QString surface)
{
    for (QChar &character : surface) {
        if (!character.isLetterOrNumber()
            && character != QLatin1Char('-')
            && character != QLatin1Char('_')) {
            character = QLatin1Char('_');
        }
    }
    return surface;
}

QJsonObject widgetBounds(QWidget *widget)
{
    const QPoint origin =
        widget != nullptr ? widget->mapToGlobal(QPoint()) : QPoint();
    return {
        {QStringLiteral("x"), origin.x()},
        {QStringLiteral("y"), origin.y()},
        {
            QStringLiteral("width"),
            widget != nullptr ? widget->width() : 0
        },
        {
            QStringLiteral("height"),
            widget != nullptr ? widget->height() : 0
        },
    };
}

struct NativeWindowMatch {
    QRect qtBounds;
    QRect nativeBounds;
    HWND handle = nullptr;
    int score = std::numeric_limits<int>::max();
};

BOOL CALLBACK collectExactThreadWindow(HWND handle, LPARAM parameter)
{
    auto *match = reinterpret_cast<NativeWindowMatch *>(parameter);
    DWORD processId = 0;
    RECT nativeBounds {};
    GetWindowThreadProcessId(handle, &processId);
    if (processId != GetCurrentProcessId()
        || !IsWindowVisible(handle)
        || !GetWindowRect(handle, &nativeBounds)) {
        return TRUE;
    }
    const QRect candidate(
        nativeBounds.left,
        nativeBounds.top,
        nativeBounds.right - nativeBounds.left,
        nativeBounds.bottom - nativeBounds.top);
    if (!candidate.intersects(match->qtBounds)) {
        return TRUE;
    }
    const int score =
        qAbs(candidate.left() - match->qtBounds.left())
        + qAbs(candidate.top() - match->qtBounds.top())
        + qAbs(candidate.width() - match->qtBounds.width())
        + qAbs(candidate.height() - match->qtBounds.height());
    if (score < match->score) {
        match->handle = handle;
        match->score = score;
        match->nativeBounds = candidate;
    }
    return TRUE;
}

quintptr resolveProcessWindowAnchor(
    QWidget *window,
    int *resolutionScore,
    QRect *nativeBounds)
{
    if (window == nullptr) {
        return 0;
    }
    if (const WId qtHandle = window->internalWinId(); qtHandle != 0) {
        *resolutionScore = 0;
        *nativeBounds = QRect(
            window->mapToGlobal(QPoint()),
            window->size());
        return static_cast<quintptr>(qtHandle);
    }
    NativeWindowMatch match {
        QRect(
        window->mapToGlobal(QPoint()),
        window->size())
    };
    EnumThreadWindows(
        GetCurrentThreadId(),
        collectExactThreadWindow,
        reinterpret_cast<LPARAM>(&match));
    *resolutionScore = match.score;
    *nativeBounds = match.nativeBounds;
    // Qt alien popup 没有独立 HWND；此时保留同 GUI 线程、同 PID 的
    // MainDock 作为原生锚点，producer 精确范围仍由 QWidget::grab 冻结。
    if (match.handle == nullptr) {
        return 0;
    }
    return reinterpret_cast<quintptr>(match.handle);
}

bool writeExclusive(
    const QString &path,
    const QJsonObject &payload)
{
    const QString temporaryPath =
        QStringLiteral("%1.tmp-%2")
            .arg(path)
            .arg(QCoreApplication::applicationPid());
    QFile::remove(temporaryPath);
    QFile file(temporaryPath);
    if (!file.open(QIODevice::WriteOnly | QIODevice::NewOnly)) {
        return false;
    }
    const QByteArray bytes =
        QJsonDocument(payload).toJson(QJsonDocument::Compact)
        + QByteArrayLiteral("\n");
    if (file.write(bytes) != bytes.size() || !file.flush()) {
        file.close();
        QFile::remove(temporaryPath);
        return false;
    }
    file.close();
    if (QFileInfo::exists(path)
        || !QFile::rename(temporaryPath, path)) {
        QFile::remove(temporaryPath);
        return false;
    }
    return true;
}

QString oracle(
    const QString &language,
    const QString &key)
{
    struct Row {
        const char *language;
        const char *tagButton;
        const char *tagAdd;
        const char *tagAssign;
        const char *replace;
        const char *create;
    };
    static constexpr Row rows[] {
        {
            "zh-Hans",
            "添加标签",
            "添加标签：",
            "为所选内容分配标签：",
            "替换…",
            "基于 %1 创建合成",
        },
        {
            "zh-Hant",
            "新增標籤",
            "新增標籤：",
            "為所選內容分配標籤：",
            "取代…",
            "根據 %1 建立合成",
        },
        {
            "ja_JP",
            "タグを追加",
            "タグを追加：",
            "選択範囲にタグを割り当て：",
            "置換…",
            "%1 を基にコンポジションを作成",
        },
    };
    for (const Row &row : rows) {
        if (language != QString::fromLatin1(row.language)) {
            continue;
        }
        if (key == QStringLiteral("tagButton")) {
            return QString::fromUtf8(row.tagButton);
        }
        if (key == QStringLiteral("tagAdd")) {
            return QString::fromUtf8(row.tagAdd);
        }
        if (key == QStringLiteral("tagAssign")) {
            return QString::fromUtf8(row.tagAssign);
        }
        if (key == QStringLiteral("replace")) {
            return QString::fromUtf8(row.replace);
        }
        if (key == QStringLiteral("create")) {
            return QString::fromUtf8(row.create);
        }
    }
    return {};
}

QStringList replaceTranslations()
{
    return {
        QStringLiteral("替换…"),
        QStringLiteral("取代…"),
        QStringLiteral("置換…"),
    };
}

QStringList createTranslations(const QString &stem)
{
    return {
        QStringLiteral("基于 %1 创建合成").arg(stem),
        QStringLiteral("根據 %1 建立合成").arg(stem),
        QStringLiteral("%1 を基にコンポジションを作成").arg(stem),
    };
}

bool actionIsPaintedBy(
    QAction *action,
    QMenu *menu)
{
    if (action == nullptr || menu == nullptr
        || !action->isVisible() || !action->isEnabled()) {
        return false;
    }
    return action->associatedObjects().contains(menu);
}

bool syntheticLabelRemainsEnglish(
    const QString &source,
    QWidget *parent)
{
    if (parent == nullptr) {
        return false;
    }
    QWidget owner(parent);
    owner.setObjectName(
        QStringLiteral("CavalryI18nAdjacentOwnerExternalLabel"));
    owner.move(-10'000, -10'000);
    owner.resize(320, 40);
    QLabel label(source, &owner);
    label.setGeometry(owner.rect());
    owner.show();
    label.show();
    QPaintEvent paint(label.rect());
    QApplication::sendEvent(&label, &paint);
    const bool unchanged = label.text() == source;
    owner.hide();
    return unchanged;
}

void dispatchWidgetClick(QWidget *widget)
{
    if (widget == nullptr
        || QMetaObject::invokeMethod(
            widget,
            "click",
            Qt::DirectConnection)) {
        return;
    }
    const QPointF local(widget->rect().center());
    const QPointF global(
        widget->mapToGlobal(widget->rect().center()));
    QMouseEvent press(
        QEvent::MouseButtonPress,
        local,
        global,
        Qt::LeftButton,
        Qt::LeftButton,
        Qt::NoModifier);
    QApplication::sendEvent(widget, &press);
    QMouseEvent release(
        QEvent::MouseButtonRelease,
        local,
        global,
        Qt::LeftButton,
        Qt::NoButton,
        Qt::NoModifier);
    QApplication::sendEvent(widget, &release);
}

struct ExactAssetRow {
    QWidget *row = nullptr;
    QLineEdit *name = nullptr;
};

} // namespace

class CavalryI18nAdjacentAcceptance::Implementation final
{
public:
    Implementation(
        CavalryI18nAdjacentAcceptance *owner,
        const QString &language)
        : owner_(owner),
          language_(language),
          requestedDirectory_(
              qEnvironmentVariable(kAcceptanceEnvironment).trimmed())
    {
        enabled_ = !requestedDirectory_.isEmpty();
        stems_ = {
            QStringLiteral("replace-source"),
            QStringLiteral("dynamic-proof-two"),
        };
        fixtures_ = {
            qEnvironmentVariable(kReplaceFixtureEnvironment).trimmed(),
            qEnvironmentVariable(kDynamicFixtureEnvironment).trimmed(),
        };
    }

    bool isEnabled() const
    {
        return enabled_;
    }

    void observeEvent(QObject *watched, QEvent *event)
    {
        if (!terminal_ && contextPosted_
            && watched == dropTarget_
            && event != nullptr
            && event->type() == QEvent::ContextMenu) {
            contextDelivered_ = true;
            traceAssetStage(QStringLiteral("context-delivered"));
        }
    }

    void start()
    {
        if (!enabled_ || terminal_) {
            return;
        }
        if (!validateConfiguration()) {
            return;
        }
        const QJsonObject startMarker {
            {
                QStringLiteral("schema"),
                QStringLiteral(
                    "cavalry-i18n.windows-adjacent.start/v1")
            },
            {QStringLiteral("status"), QStringLiteral("STARTED")},
            {QStringLiteral("language"), language_},
            {
                QStringLiteral("pid"),
                static_cast<double>(
                    QCoreApplication::applicationPid())
            },
        };
        if (!writeExclusive(
                QDir(acceptanceDirectory_)
                    .filePath(QStringLiteral("driver-start.json")),
                startMarker)) {
            fail(QStringLiteral("driver start write-once failed"));
            return;
        }
        readyToDrive_ = true;
        QCoreApplication::instance()->installEventFilter(owner_);
        driveTimer_.setInterval(25);
        QObject::connect(
            &driveTimer_,
            &QTimer::timeout,
            owner_,
            // ContextMenu 会进入 Qt 嵌套事件循环；定时器必须能在外层
            // sendEvent 尚未返回时推进截图 ACK，事件过滤器仍由 owner 防重入。
            [this]() { drive(); });
        driveTimer_.start();
        stateTimer_.setSingleShot(true);
        QObject::connect(
            &stateTimer_,
            &QTimer::timeout,
            owner_,
            [this]() {
                std::function<void()> task =
                    std::move(scheduledTask_);
                scheduledTask_ = {};
                if (!terminal_ && task) {
                    task();
                }
            });
    }

    void drive()
    {
        if (!readyToDrive_ || terminal_) {
            return;
        }
        exposeMainWindow();
        if (terminal_) {
            return;
        }
        if (!driveStarted_) {
            bool visibleTopLevel = false;
            for (QWidget *widget : QApplication::topLevelWidgets()) {
                if (widget != nullptr && widget->isVisible()) {
                    visibleTopLevel = true;
                    break;
                }
            }
            if (!visibleTopLevel) {
                return;
            }
            driveStarted_ = true;
            const QJsonObject driveMarker {
                {
                    QStringLiteral("schema"),
                    QStringLiteral(
                        "cavalry-i18n.windows-adjacent.drive/v1")
                },
                {QStringLiteral("status"), QStringLiteral("DRIVING")},
                {QStringLiteral("language"), language_},
                {
                    QStringLiteral("pid"),
                    static_cast<double>(
                        QCoreApplication::applicationPid())
                },
            };
            if (!writeExclusive(
                    QDir(acceptanceDirectory_)
                        .filePath(QStringLiteral("driver-drive.json")),
                    driveMarker)) {
                fail(QStringLiteral("driver drive write-once failed"));
                return;
            }
            pollTagTopology();
        }
    }

private:
    CavalryI18nAdjacentAcceptance *owner_ = nullptr;
    QString language_;
    QString requestedDirectory_;
    QString acceptanceDirectory_;
    QStringList stems_;
    QStringList fixtures_;
    QPointer<QWidget> tagPopover_;
    QPointer<QWidget> assetsWindow_;
    QPointer<QWidget> treeWidget_;
    QPointer<QWidget> dropTarget_;
    QPointer<QWidget> selectedRow_;
    QPointer<QLineEdit> selectedName_;
    QJsonObject tagResult_;
    QJsonObject pendingAssetCapture_;
    QJsonArray assetObservations_;
    QJsonArray captures_;
    QString pendingAckPath_;
    QString pendingSurface_;
    std::function<void()> pendingContinuation_;
    std::function<void()> scheduledTask_;
    QElapsedTimer pendingCaptureTimer_;
    int captureSequence_ = 0;
    int topologyAttempts_ = 0;
    int rowAttempts_ = 0;
    int menuAttempts_ = 0;
    int stemIndex_ = 0;
    int beforeRowCount_ = -1;
    bool enabled_ = false;
    bool readyToDrive_ = false;
    bool driveStarted_ = false;
    bool terminal_ = false;
    bool menuValidated_ = false;
    bool contextPosted_ = false;
    bool contextDelivered_ = false;
    bool contextAccepted_ = false;
    bool tagOwnerExternalUnchanged_ = false;
    bool configurationValidated_ = false;
    QTimer driveTimer_;
    QTimer stateTimer_;
    QJsonArray bypassedWindows_;

#include "cavalry_i18n_adjacent_acceptance_lifecycle.inc"
#include "cavalry_i18n_adjacent_acceptance_assets.inc"
#include "cavalry_i18n_adjacent_acceptance_evidence.inc"

};

CavalryI18nAdjacentAcceptance::CavalryI18nAdjacentAcceptance(
    const QString &language,
    QObject *parent)
    : QObject(parent),
      implementation_(
          std::make_unique<Implementation>(this, language))
{
}

CavalryI18nAdjacentAcceptance::~CavalryI18nAdjacentAcceptance()
{
    if (QCoreApplication::instance() != nullptr) {
        QCoreApplication::instance()->removeEventFilter(this);
    }
}

bool CavalryI18nAdjacentAcceptance::isEnabled() const
{
    return implementation_->isEnabled();
}

void CavalryI18nAdjacentAcceptance::start()
{
    implementation_->start();
}

void CavalryI18nAdjacentAcceptance::drive()
{
    if (driveActive_) {
        return;
    }
    driveActive_ = true;
    implementation_->drive();
    driveActive_ = false;
}

bool CavalryI18nAdjacentAcceptance::eventFilter(
    QObject *watched,
    QEvent *event)
{
    if (implementation_->isEnabled()) {
        implementation_->observeEvent(watched, event);
        drive();
    }
    return false;
}
