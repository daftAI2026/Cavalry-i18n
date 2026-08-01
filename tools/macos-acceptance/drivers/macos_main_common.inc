/**
 * [INPUT]: Qt 真实控件、运行身份环境变量与 acceptance harness 的逐表面截图 ACK。
 * [OUTPUT]: 主验收场景共享的语言 oracle、严格拓扑工具、确定性首帧负例，以及只提交目标瞬态窗口且不重入产品事件循环的逐图 write-once 握手与终态。
 * [POS]: macos_main_acceptance_driver 的公共证据边界；场景分片只负责真实产品操作。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <QuartzCore/QuartzCore.h>

#include <QtCore/qabstractitemmodel.h>
#include <QtCore/qcoreapplication.h>
#include <QtCore/qelapsedtimer.h>
#include <QtCore/qfile.h>
#include <QtCore/qfileinfo.h>
#include <QtCore/qjsonarray.h>
#include <QtCore/qjsondocument.h>
#include <QtCore/qjsonobject.h>
#include <QtCore/qitemselectionmodel.h>
#include <QtCore/qmetaobject.h>
#include <QtCore/qmimedata.h>
#include <QtCore/qpointer.h>
#include <QtCore/qtextstream.h>
#include <QtCore/qthread.h>
#include <QtCore/qtimer.h>
#include <QtCore/qurl.h>
#include <QtGui/qaction.h>
#include <QtGui/qcursor.h>
#include <QtGui/qevent.h>
#include <QtGui/qwindow.h>
#include <QtWidgets/qabstractbutton.h>
#include <QtWidgets/qabstractitemview.h>
#include <QtWidgets/qapplication.h>
#include <QtWidgets/qdialog.h>
#include <QtWidgets/qlabel.h>
#include <QtWidgets/qlineedit.h>
#include <QtWidgets/qmenu.h>
#include <QtWidgets/qmenubar.h>
#include <QtWidgets/qprogressbar.h>
#include <QtWidgets/qpushbutton.h>
#include <QtWidgets/qwidget.h>

#include <algorithm>
#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <fcntl.h>
#include <unistd.h>

namespace {
std::atomic<bool> gScheduled{false};
int gCaptureSequence = 0;

QString className(const QObject *object) {
  return object && object->metaObject()
      ? QString::fromLatin1(object->metaObject()->className())
      : QStringLiteral("<null>");
}

bool ancestorHasClass(const QObject *object, const QString &expected) {
  for (const QObject *cursor = object ? object->parent() : nullptr; cursor;
       cursor = cursor->parent()) {
    if (className(cursor) == expected) return true;
  }
  return false;
}

void appendLog(const QString &message) {
  const char *path = std::getenv("CAVALRY_I18N_ACCEPTANCE_LOG");
  if (!path || !*path) return;
  QFile file(QString::fromUtf8(path));
  if (!file.open(QIODevice::WriteOnly | QIODevice::Append | QIODevice::Text)) return;
  QTextStream(&file) << message << '\n';
}

bool writeBytesExclusive(const QString &path, const QByteArray &bytes) {
  const QByteArray encodedPath = QFile::encodeName(path);
  const int fd = ::open(encodedPath.constData(), O_CREAT | O_EXCL | O_WRONLY, 0444);
  if (fd < 0) return false;
  qsizetype offset = 0;
  while (offset < bytes.size()) {
    const ssize_t written =
        ::write(fd, bytes.constData() + offset, static_cast<size_t>(bytes.size() - offset));
    if (written <= 0) {
      ::close(fd);
      return false;
    }
    offset += written;
  }
  const bool synced = ::fsync(fd) == 0;
  ::close(fd);
  return synced;
}

QJsonObject widgetBounds(QWidget *widget) {
  const QPoint origin = widget ? widget->mapToGlobal(QPoint()) : QPoint();
  return {{"x", origin.x()},
          {"y", origin.y()},
          {"width", widget ? widget->width() : 0},
          {"height", widget ? widget->height() : 0}};
}

qint64 nativeWindowNumber(QWidget *window) {
  if (!window) return 0;
  NSView *view =
      (__bridge NSView *)(reinterpret_cast<void *>(window->winId()));
  NSWindow *nativeWindow = view.window;
  return nativeWindow ? nativeWindow.windowNumber : 0;
}

bool commitTransientCaptureSurface(QWidget *child, QWidget *window) {
  if (!child || !window ||
      className(window) != QStringLiteral("QTipLabel") ||
      window->objectName() != QStringLiteral("qtooltip_label")) {
    return true;
  }
  child->repaint();
  QCoreApplication::sendPostedEvents(child);
  if (QWindow *handle = window->windowHandle()) {
    QCoreApplication::sendPostedEvents(handle);
  }
  NSView *view =
      (__bridge NSView *)(reinterpret_cast<void *>(window->winId()));
  NSWindow *nativeWindow = view.window;
  if (!nativeWindow) return false;
  [nativeWindow orderFrontRegardless];
  [nativeWindow.contentView displayIfNeeded];
  [nativeWindow displayIfNeeded];
  [CATransaction flush];
  return true;
}

bool validVisibleGeometry(QWidget *child, QWidget *window) {
  if (!child || !window || !child->isVisible() || !window->isVisible() ||
      child->width() < 1 || child->height() < 1 ||
      window->width() < 1 || window->height() < 1) {
    return false;
  }
  const QRect childRect(child->mapToGlobal(QPoint()), child->size());
  const QRect windowRect(window->mapToGlobal(QPoint()), window->size());
  return windowRect.contains(childRect);
}

QString safeSurfaceName(const QString &surface) {
  QString safe = surface;
  for (QChar &character : safe) {
    if (!character.isLetterOrNumber() && character != QLatin1Char('-') &&
        character != QLatin1Char('_')) {
      character = QLatin1Char('_');
    }
  }
  return safe;
}

enum class CaptureAckState {
  Pending,
  Valid,
  Invalid,
};

CaptureAckState captureAckState(const QString &ackPath, int sequence,
                                const QString &surface) {
  if (!QFileInfo::exists(ackPath)) return CaptureAckState::Pending;
  QFile file(ackPath);
  if (!file.open(QIODevice::ReadOnly)) return CaptureAckState::Invalid;
  QJsonParseError error{};
  const QJsonDocument document = QJsonDocument::fromJson(file.readAll(), &error);
  const QJsonObject ack = document.object();
  const bool valid =
      error.error == QJsonParseError::NoError &&
      ack.value(QStringLiteral("schema")).toString() ==
          QStringLiteral("cavalry-i18n.acceptance-v2.capture-ack/v1") &&
      ack.value(QStringLiteral("status")).toString() ==
          QStringLiteral("CAPTURED") &&
      ack.value(QStringLiteral("runUuid")).toString() ==
          QString::fromUtf8(std::getenv("CAVALRY_I18N_RUN_UUID") ?: "") &&
      ack.value(QStringLiteral("pid")).toInteger() ==
          QCoreApplication::applicationPid() &&
      ack.value(QStringLiteral("sequence")).toInt() == sequence &&
      ack.value(QStringLiteral("surface")).toString() == surface;
  return valid ? CaptureAckState::Valid : CaptureAckState::Invalid;
}

bool awaitCaptureAck(const QString &ackPath, int sequence,
                     const QString &surface) {
  QElapsedTimer timer;
  timer.start();
  while (timer.elapsed() < 20000) {
    const CaptureAckState state =
        captureAckState(ackPath, sequence, surface);
    if (state == CaptureAckState::Valid) return true;
    if (state == CaptureAckState::Invalid) return false;
    QThread::msleep(25);
  }
  return false;
}

bool prepareCaptureSurface(QWidget *child, QWidget *window,
                           const QString &surface, const QString &text,
                           QJsonObject *result, QString *ackPathResult,
                           int *sequenceResult,
                           const QJsonObject &details = {}) {
  const char *captureDirRaw = std::getenv("CAVALRY_I18N_CAPTURE_DIR");
  const qint64 windowNumber = nativeWindowNumber(window);
  if (!captureDirRaw || !*captureDirRaw || !result || !ackPathResult ||
      !sequenceResult || windowNumber <= 0 ||
      !validVisibleGeometry(child, window)) {
    appendLog(QStringLiteral("CAPTURE_INVALID surface=%1 child=%2 window=%3")
                  .arg(surface, className(child), className(window)));
    return false;
  }
  const QString captureDir = QString::fromUtf8(captureDirRaw);
  const int sequence = ++gCaptureSequence;
  const QString prefix =
      QStringLiteral("%1-%2").arg(sequence, 2, 10, QLatin1Char('0'))
          .arg(safeSurfaceName(surface));
  const QString readyPath =
      captureDir + QLatin1Char('/') + prefix + QStringLiteral(".ready.json");
  const QString ackPath =
      captureDir + QLatin1Char('/') + prefix + QStringLiteral(".ack.json");
  if (QFileInfo::exists(readyPath) || QFileInfo::exists(ackPath)) {
    appendLog(QStringLiteral("CAPTURE_WRITE_FAILED surface=%1 prefix=%2")
                  .arg(surface, prefix));
    return false;
  }

  QJsonObject target{{"widgetClass", className(child)},
                     {"objectName", child->objectName()},
                     {"childBounds", widgetBounds(child)},
                     {"windowBounds", widgetBounds(window)},
                     {"nativeWindowNumber", windowNumber},
                     {"childIsTopLevel", child == window},
                     {"windowTitle", window->windowTitle()}};
  QJsonObject surfaceResult{{"surface", surface},
                            {"text", text},
                            {"sequence", sequence},
                            {"target", target},
                            {"readyPath", readyPath}};
  for (auto iterator = details.begin(); iterator != details.end(); ++iterator) {
    surfaceResult.insert(iterator.key(), iterator.value());
  }
  const QJsonObject ready{{"schema", "cavalry-i18n.acceptance-v2.capture-ready/v1"},
                          {"runUuid", QString::fromUtf8(
                                          std::getenv("CAVALRY_I18N_RUN_UUID") ?: "")},
                          {"language", QString::fromUtf8(
                                         std::getenv("CAVALRY_I18N_LANG") ?: "")},
                          {"scenario", QString::fromUtf8(
                                         std::getenv("CAVALRY_I18N_ACCEPTANCE_SCENARIO") ?: "")},
                          {"pid", double(QCoreApplication::applicationPid())},
                          {"sequence", sequence},
                          {"surface", surface},
                          {"target", target},
                          {"result", surfaceResult}};
  if (!writeBytesExclusive(
          readyPath,
          QJsonDocument(ready).toJson(QJsonDocument::Compact) + '\n')) {
    appendLog(QStringLiteral("CAPTURE_WRITE_FAILED surface=%1 sequence=%2")
                  .arg(surface)
                  .arg(sequence));
    return false;
  }
  *result = surfaceResult;
  *ackPathResult = ackPath;
  *sequenceResult = sequence;
  return true;
}

bool captureSurface(QWidget *child, QWidget *window, const QString &surface,
                    const QString &text, QJsonObject *result,
                    const QJsonObject &details = {}) {
  QJsonObject preparedResult;
  QString ackPath;
  int sequence = 0;
  if (!prepareCaptureSurface(child, window, surface, text, &preparedResult,
                             &ackPath, &sequence, details) ||
      !commitTransientCaptureSurface(child, window) ||
      !awaitCaptureAck(ackPath, sequence, surface)) {
    appendLog(QStringLiteral("CAPTURE_ACK_FAILED surface=%1 sequence=%2")
                  .arg(surface)
                  .arg(sequence));
    return false;
  }
  *result = preparedResult;
  appendLog(QStringLiteral("CAPTURE_ACKED surface=%1 sequence=%2 child=%3 window=%4")
                .arg(surface)
                .arg(sequence)
                .arg(className(child), className(window)));
  return true;
}

void finishOnce(const QString &status, const QJsonArray &surfaceResults = {}) {
  const char *path = std::getenv("CAVALRY_I18N_ACCEPTANCE_DONE");
  if (!path || !*path) return;
  const bool ok = status.startsWith(QStringLiteral("OK "));
  QJsonObject target;
  QString surface =
      QString::fromUtf8(std::getenv("CAVALRY_I18N_ACCEPTANCE_SCENARIO") ?: "");
  if (!surfaceResults.isEmpty()) {
    const QJsonObject last = surfaceResults.last().toObject();
    target = last.value(QStringLiteral("target")).toObject();
    surface = last.value(QStringLiteral("surface")).toString(surface);
  }
  const QJsonObject output{
      {"schema", "cavalry-i18n.acceptance-v2.done/v2"},
      {"status", ok ? "OK" : "ERROR"},
      {"runUuid",
       QString::fromUtf8(std::getenv("CAVALRY_I18N_RUN_UUID") ?: "")},
      {"language", QString::fromUtf8(std::getenv("CAVALRY_I18N_LANG") ?: "")},
      {"scenario", QString::fromUtf8(
                       std::getenv("CAVALRY_I18N_ACCEPTANCE_SCENARIO") ?: "")},
      {"pid", double(QCoreApplication::applicationPid())},
      {"surface", surface},
      {"surfaceResults", surfaceResults},
      {"reason", status},
      {"target", target}};
  writeBytesExclusive(
      QString::fromUtf8(path),
      QJsonDocument(output).toJson(QJsonDocument::Compact) + '\n');
}

void markDone(const QString &status) { finishOnce(status); }

bool isWelcomeWindow(QWidget *widget) {
  if (!widget) return false;
  const QString klass = className(widget);
  const QString title = widget->windowTitle();
  return klass.contains(QStringLiteral("SignInDialog")) ||
         title.contains(QStringLiteral("Welcome"), Qt::CaseInsensitive) ||
         title.contains(QStringLiteral("歡迎")) ||
         title.contains(QStringLiteral("欢迎")) ||
         title.contains(QStringLiteral("ようこそ"));
}

bool exposeMainWindow() {
  if (!qApp) {
    appendLog(QStringLiteral("ERROR qApp unavailable"));
    markDone(QStringLiteral("ERROR qApp unavailable"));
    return false;
  }
  bool found = false;
  for (QWidget *widget : QApplication::topLevelWidgets()) {
    if (!widget) continue;
    if (isWelcomeWindow(widget)) {
      if (QDialog *dialog = qobject_cast<QDialog *>(widget)) dialog->setModal(false);
      widget->setWindowModality(Qt::NonModal);
      widget->hide();
      continue;
    }
    if (className(widget).contains(QStringLiteral("Main")) ||
        widget->windowTitle().contains(QStringLiteral("Cavalry"),
                                       Qt::CaseInsensitive)) {
      widget->showNormal();
      widget->raise();
      widget->activateWindow();
      found = true;
    }
  }
  return found;
}

// ---------- 每次运行只接受一个目标语言 ----------
QString oracle(const QString &key) {
  const QString language =
      QString::fromUtf8(std::getenv("CAVALRY_I18N_LANG") ?: "");
  struct Row {
    const char *lang;
    const char *search;
    const char *window;
    const char *sceneStatistics;
    const char *footage;
    const char *generator;
    const char *tagButton;
    const char *tagAdd;
    const char *tagAssign;
    const char *save;
    const char *replace;
    const char *create;
    const char *stat1;
    const char *stat2;
    const char *stat3;
    const char *statUpdate;
    const char *tracking;
    const char *cancel;
  };
  static const Row rows[] = {
      {"zh-Hans", "向合成添加图层 (⌘.)", "窗口", "场景统计", "作为素材添加到合成",
       "生成器", "添加标签", "添加标签：", "为所选内容分配标签：", "保存…", "替换…",
       "基于 %1 创建合成", "计算时间：", "绘制时间：", "节点总数：",
       "更新", "正在跟踪…", "取消"},
      {"zh-Hant", "向合成新增圖層 (⌘.)", "視窗", "場景統計", "作為素材新增至合成",
       "生成器", "新增標籤", "新增標籤：", "為所選內容分配標籤：", "儲存…", "取代…",
       "根據 %1 建立合成", "計算時間：", "繪製時間：", "節點總數：",
       "更新", "正在追蹤…", "取消"},
      {"ja_JP", "コンポジションにレイヤーを追加 (⌘.)", "ウィンドウ", "シーン統計",
       "フッテージとしてコンポジションに追加",
       "ジェネレーター", "タグを追加", "タグを追加：",
       "選択範囲にタグを割り当て：", "保存…", "置換…",
       "%1 を基にコンポジションを作成", "計算時間：", "描画時間：",
       "ノード総数：", "更新", "トラッキング中…", "キャンセル"}};
  for (const Row &row : rows) {
    if (language != QString::fromLatin1(row.lang)) continue;
    if (key == QStringLiteral("search")) return QString::fromUtf8(row.search);
    if (key == QStringLiteral("window")) return QString::fromUtf8(row.window);
    if (key == QStringLiteral("sceneStatistics"))
      return QString::fromUtf8(row.sceneStatistics);
    if (key == QStringLiteral("footage")) return QString::fromUtf8(row.footage);
    if (key == QStringLiteral("generator"))
      return QString::fromUtf8(row.generator);
    if (key == QStringLiteral("tagButton"))
      return QString::fromUtf8(row.tagButton);
    if (key == QStringLiteral("tagAdd")) return QString::fromUtf8(row.tagAdd);
    if (key == QStringLiteral("tagAssign")) return QString::fromUtf8(row.tagAssign);
    if (key == QStringLiteral("save")) return QString::fromUtf8(row.save);
    if (key == QStringLiteral("replace")) return QString::fromUtf8(row.replace);
    if (key == QStringLiteral("create")) return QString::fromUtf8(row.create);
    if (key == QStringLiteral("stat1")) return QString::fromUtf8(row.stat1);
    if (key == QStringLiteral("stat2")) return QString::fromUtf8(row.stat2);
    if (key == QStringLiteral("stat3")) return QString::fromUtf8(row.stat3);
    if (key == QStringLiteral("statUpdate"))
      return QString::fromUtf8(row.statUpdate);
    if (key == QStringLiteral("tracking")) return QString::fromUtf8(row.tracking);
    if (key == QStringLiteral("cancel")) return QString::fromUtf8(row.cancel);
  }
  return QString();
}

bool exactCurrent(const QString &actual, const QString &key) {
  const QString expected = oracle(key);
  return !expected.isEmpty() && actual == expected;
}

bool syntheticLabelRemainsEnglish(const QString &source) {
  QWidget owner;
  owner.setObjectName(QStringLiteral("acceptance-owner-external"));
  QLabel label(source, &owner);
  QPaintEvent paint(label.rect());
  QApplication::sendEvent(&label, &paint);
  return label.text() == source;
}

bool syntheticMenuActionRemainsEnglish(const QString &source) {
  QMenu menu;
  menu.setObjectName(QStringLiteral("acceptance-owner-external"));
  QAction *action = menu.addAction(source);
  menu.move(-10000, -10000);
  menu.show();
  const bool unchanged = action && action->text() == source;
  menu.hide();
  return unchanged;
}

QList<QWidget *> directVisibleEnabled(QWidget *parent, const QString &klass) {
  QList<QWidget *> result;
  if (!parent) return result;
  for (QObject *child : parent->children()) {
    QWidget *widget = qobject_cast<QWidget *>(child);
    if (widget && className(widget) == klass && widget->isVisibleTo(parent) &&
        widget->isEnabled()) {
      result << widget;
    }
  }
  return result;
}

QLabel *uniqueExactLabel(QWidget *owner, const QString &text) {
  QList<QLabel *> hits;
  if (!owner) return nullptr;
  for (QLabel *label : owner->findChildren<QLabel *>()) {
    if (label->isVisibleTo(owner) && label->text() == text) hits << label;
  }
  return hits.size() == 1 ? hits.front() : nullptr;
}
