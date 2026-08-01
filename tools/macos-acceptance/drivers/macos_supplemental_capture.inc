/**
 * [INPUT]: 已提交的 Qt/AppKit 真实窗口、write-once ready/ack 路径与 harness 进程身份。
 * [OUTPUT]: 不阻塞主线程的逐表面 ready 写入、严格 ACK 校验与有界异步完成回调。
 * [POS]: supplemental driver 的截图事务边界；产品事件循环自由推进，场景代码只消费成功或失败终态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
using CaptureCompletion =
    std::function<void(bool, const QJsonObject &)>;

enum class CaptureAckState {
  Pending,
  Valid,
  Invalid,
};

struct PendingCapture {
  QString ackPath;
  QString surface;
  int sequence = 0;
  QJsonObject result;
};

CaptureAckState captureAckState(const PendingCapture &pending) {
  if (!QFileInfo::exists(pending.ackPath))
    return CaptureAckState::Pending;
  QFile file(pending.ackPath);
  if (!file.open(QIODevice::ReadOnly))
    return CaptureAckState::Pending;
  QJsonParseError error{};
  const QJsonObject ack =
      QJsonDocument::fromJson(file.readAll(), &error).object();
  if (error.error != QJsonParseError::NoError)
    return CaptureAckState::Pending;
  const bool valid =
      ack.value(QStringLiteral("schema")).toString() ==
          QStringLiteral("cavalry-i18n.acceptance-v2.capture-ack/v1") &&
      ack.value(QStringLiteral("status")).toString() ==
          QStringLiteral("CAPTURED") &&
      ack.value(QStringLiteral("runUuid")).toString() ==
          QString::fromUtf8(
              std::getenv("CAVALRY_I18N_RUN_UUID") ?: "") &&
      ack.value(QStringLiteral("pid")).toInteger() ==
          QCoreApplication::applicationPid() &&
      ack.value(QStringLiteral("sequence")).toInt() ==
          pending.sequence &&
      ack.value(QStringLiteral("surface")).toString() ==
          pending.surface;
  return valid ? CaptureAckState::Valid
               : CaptureAckState::Invalid;
}

void pollCaptureAck(PendingCapture pending, int attempts,
                    CaptureCompletion completion) {
  const CaptureAckState state = captureAckState(pending);
  if (state == CaptureAckState::Valid) {
    appendLog(QStringLiteral("CAPTURE_ACKED surface=%1 sequence=%2")
                  .arg(pending.surface)
                  .arg(pending.sequence));
    completion(true, pending.result);
    return;
  }
  if (state == CaptureAckState::Invalid || attempts >= 800) {
    appendLog(QStringLiteral("CAPTURE_ACK_FAILED surface=%1 sequence=%2 state=%3")
                  .arg(pending.surface)
                  .arg(pending.sequence)
                  .arg(state == CaptureAckState::Invalid
                           ? QStringLiteral("invalid")
                           : QStringLiteral("timeout")));
    completion(false, {});
    return;
  }
  QTimer::singleShot(
      25, qApp,
      [pending, attempts, completion] {
        pollCaptureAck(pending, attempts + 1, completion);
      });
}

void captureSurfaceAsync(QWidget *child, QWidget *window,
                         const QString &surface, const QString &text,
                         const QJsonObject &details,
                         CaptureCompletion completion) {
  const char *captureDirRaw =
      std::getenv("CAVALRY_I18N_CAPTURE_DIR");
  if (!captureDirRaw || !*captureDirRaw || !child || !window ||
      !child->isVisible() || !window->isVisible() ||
      !commitCaptureSurface(child, window)) {
    completion(false, {});
    return;
  }
  const qint64 windowNumber = nativeWindowNumber(window);
  const QRect childRect(child->mapToGlobal(QPoint()), child->size());
  const QRect windowRect(window->mapToGlobal(QPoint()), window->size());
  if (windowNumber <= 0 || childRect.width() < 1 ||
      childRect.height() < 1 || !windowRect.contains(childRect)) {
    completion(false, {});
    return;
  }
  const int sequence = ++gCaptureSequence;
  const QString prefix =
      QStringLiteral("%1-%2")
          .arg(sequence, 2, 10, QLatin1Char('0'))
          .arg(safeSurfaceName(surface));
  const QString captureDir = QString::fromUtf8(captureDirRaw);
  const QString readyPath =
      captureDir + QLatin1Char('/') + prefix +
      QStringLiteral(".ready.json");
  const QString ackPath =
      captureDir + QLatin1Char('/') + prefix +
      QStringLiteral(".ack.json");
  const QJsonObject target{
      {"widgetClass", className(child)},
      {"objectName", child->objectName()},
      {"childBounds", widgetBounds(child)},
      {"windowBounds", widgetBounds(window)},
      {"nativeWindowNumber", windowNumber},
      {"childIsTopLevel", child == window},
      {"windowTitle", window->windowTitle()}};
  QJsonObject result{{"surface", surface},
                     {"text", text},
                     {"sequence", sequence},
                     {"target", target},
                     {"readyPath", readyPath}};
  for (auto iterator = details.begin();
       iterator != details.end(); ++iterator)
    result.insert(iterator.key(), iterator.value());
  const QJsonObject ready{
      {"schema", "cavalry-i18n.acceptance-v2.capture-ready/v1"},
      {"runUuid", QString::fromUtf8(
                      std::getenv("CAVALRY_I18N_RUN_UUID") ?: "")},
      {"language", QString::fromUtf8(
                       std::getenv("CAVALRY_I18N_LANG") ?: "")},
      {"scenario", QString::fromUtf8(
                       std::getenv(
                           "CAVALRY_I18N_SUPPLEMENTAL_SCENARIO") ?: "")},
      {"pid", double(QCoreApplication::applicationPid())},
      {"sequence", sequence},
      {"surface", surface},
      {"target", target},
      {"result", result}};
  if (!writeBytesExclusive(
          readyPath,
          QJsonDocument(ready).toJson(QJsonDocument::Compact) + '\n')) {
    completion(false, {});
    return;
  }
  QTimer::singleShot(
      0, qApp,
      [pending = PendingCapture{ackPath, surface, sequence, result},
       completion] {
        pollCaptureAck(pending, 0, completion);
      });
}
