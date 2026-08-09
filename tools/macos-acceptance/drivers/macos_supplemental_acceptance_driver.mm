/**
 * [INPUT]: 完整 Qt 对象图中的 OnboardingManager、含嵌套 chooser 的 Qt 事件循环、真实 PopOverView/catalog、Transform Tool/Viewport 与产品诊断 C ABI，以及 harness 逐表面截图 ACK。
 * [OUTPUT]: Onboarding 五步和 Transform 五条自绘 action 的 write-once 像素、拓扑、诊断，以及由 Qt timer 持续推进且不阻塞产品事件循环的异步 ACK 终态。
 * [POS]: acceptance-v2 补充驱动；firstLaunch 从真实产品语义触发，状态机穿过 chooser 嵌套循环，UI 可见性由控件/像素证明，自绘语义由逐 source 增量证明。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <QuartzCore/QuartzCore.h>

#include <QtCore/qcoreapplication.h>
#include <QtCore/qfile.h>
#include <QtCore/qfileinfo.h>
#include <QtCore/qjsonarray.h>
#include <QtCore/qjsondocument.h>
#include <QtCore/qjsonobject.h>
#include <QtCore/qpointer.h>
#include <QtCore/qregularexpression.h>
#include <QtCore/qset.h>
#include <QtCore/qtextstream.h>
#include <QtCore/qtimer.h>
#include <QtGui/qcursor.h>
#include <QtGui/qevent.h>
#include <QtGui/qtextdocument.h>
#include <QtGui/qwindow.h>
#include <QtWidgets/qabstractbutton.h>
#include <QtWidgets/qapplication.h>
#include <QtWidgets/qdialog.h>
#include <QtWidgets/qlabel.h>
#include <QtWidgets/qmenu.h>
#include <QtWidgets/qtextbrowser.h>
#include <QtWidgets/qwidget.h>

#include <algorithm>
#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <dlfcn.h>
#include <fcntl.h>
#include <functional>
#include <string>
#include <unistd.h>

namespace {
std::atomic<bool> gScheduled{false};
QJsonArray gOnboardingResults;
int gCaptureSequence = 0;
int gFindAttempts = 0;
int gTransitionAttempts = 0;
bool gTriggerAttempted = false;
bool gGuideChooserOpened = false;

struct ToolHelpDiagnosticsV1 {
  bool configured;
  bool vendorContractVerified;
  bool rendererReady;
  std::uint64_t canonicalCalls;
  std::uint64_t whitelistCalls;
  std::uint64_t cjkPathSuccess;
  std::uint64_t originalFallback;
  std::uint64_t rendererFailure;
  std::uint64_t translatedSourceMask;
  std::uint64_t fallbackSourceMask;
  std::uint64_t translatedSourceCalls[5];
  std::uint64_t fallbackSourceCalls[5];
};
using ToolHelpDiagnosticsFn =
    bool (*)(ToolHelpDiagnosticsV1 *, std::size_t) noexcept;

QString className(const QObject *object) {
  return object && object->metaObject()
      ? QString::fromLatin1(object->metaObject()->className())
      : QStringLiteral("<null>");
}

void appendLog(const QString &message) {
  const char *path = std::getenv("CAVALRY_I18N_SUPPLEMENTAL_LOG");
  if (!path || !*path) return;
  QFile file(QString::fromUtf8(path));
  if (!file.open(QIODevice::WriteOnly | QIODevice::Append | QIODevice::Text))
    return;
  QTextStream(&file) << message << '\n';
}

bool writeBytesExclusive(const QString &path, const QByteArray &bytes) {
  const QByteArray encodedPath = QFile::encodeName(path);
  const int fd =
      ::open(encodedPath.constData(), O_CREAT | O_EXCL | O_WRONLY, 0444);
  if (fd < 0) return false;
  qsizetype offset = 0;
  while (offset < bytes.size()) {
    const ssize_t written =
        ::write(fd, bytes.constData() + offset,
                static_cast<size_t>(bytes.size() - offset));
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

bool commitCaptureSurface(QWidget *child, QWidget *window) {
  if (!child || !window) return false;
  child->repaint();
  window->repaint();
  QCoreApplication::sendPostedEvents(child);
  QCoreApplication::sendPostedEvents(window);
  if (QWindow *handle = window->windowHandle())
    QCoreApplication::sendPostedEvents(handle);
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

QString safeSurfaceName(QString value) {
  for (QChar &character : value) {
    if (!character.isLetterOrNumber() && character != QLatin1Char('-') &&
        character != QLatin1Char('_')) {
      character = QLatin1Char('_');
    }
  }
  return value;
}

#include "macos_supplemental_capture.inc"

void finishOnce(const QString &message, const QJsonArray &surfaceResults = {}) {
  const char *path = std::getenv("CAVALRY_I18N_SUPPLEMENTAL_DONE");
  if (!path || !*path) return;
  QString surface =
      QString::fromUtf8(std::getenv("CAVALRY_I18N_SUPPLEMENTAL_SCENARIO") ?: "");
  QJsonObject target;
  if (!surfaceResults.isEmpty()) {
    const QJsonObject last = surfaceResults.last().toObject();
    surface = last.value(QStringLiteral("surface")).toString(surface);
    target = last.value(QStringLiteral("target")).toObject();
  }
  const QJsonObject output{
      {"schema", "cavalry-i18n.acceptance-v2.done/v2"},
      {"status", message.startsWith(QStringLiteral("OK ")) ? "OK" : "ERROR"},
      {"runUuid",
       QString::fromUtf8(std::getenv("CAVALRY_I18N_RUN_UUID") ?: "")},
      {"language", QString::fromUtf8(std::getenv("CAVALRY_I18N_LANG") ?: "")},
      {"scenario", QString::fromUtf8(
                       std::getenv("CAVALRY_I18N_SUPPLEMENTAL_SCENARIO") ?: "")},
      {"pid", double(QCoreApplication::applicationPid())},
      {"surface", surface},
      {"surfaceResults", surfaceResults},
      {"reason", message},
      {"target", target}};
  writeBytesExclusive(QString::fromUtf8(path),
                      QJsonDocument(output).toJson(QJsonDocument::Compact) +
                          '\n');
}

void markDone(const QString &message) { finishOnce(message); }

QString normalizedPlainText(QString value) {
  value.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
  return value.trimmed();
}

int onboardingStep(QWidget *root) {
  if (!root) return 0;
  static const QRegularExpression pattern(
      QStringLiteral("^\\s*([1-5])\\s*/\\s*5\\s*$"));
  for (QLabel *label : root->findChildren<QLabel *>()) {
    if (!label->isVisibleTo(root)) continue;
    const auto match = pattern.match(label->text());
    if (match.hasMatch()) return match.captured(1).toInt();
  }
  return 0;
}

QWidget *findOnboardingWindow(bool *ambiguous = nullptr) {
  QList<QWidget *> hits;
  for (QWidget *widget : QApplication::allWidgets()) {
    if (widget && widget->isVisible() &&
        className(widget) == QStringLiteral("PopOverView") &&
        onboardingStep(widget) > 0) {
      hits << widget;
    }
  }
  if (ambiguous) *ambiguous = hits.size() > 1;
  return hits.size() == 1 ? hits.front() : nullptr;
}

#include "macos_supplemental_onboarding_trigger.inc"

QList<QAbstractButton *> onboardingButtons(QWidget *root) {
  QList<QAbstractButton *> buttons;
  if (!root) return buttons;
  for (QAbstractButton *button : root->findChildren<QAbstractButton *>()) {
    if (button && button->isVisibleTo(root) && button->isEnabled() &&
        !button->text().trimmed().isEmpty()) {
      buttons << button;
    }
  }
  std::sort(buttons.begin(), buttons.end(),
            [](QAbstractButton *left, QAbstractButton *right) {
    return left->mapToGlobal(QPoint()).x() <
           right->mapToGlobal(QPoint()).x();
  });
  return buttons;
}

struct OnboardingStepOracle {
  const char *title;
  const char *body;
};

struct OnboardingOracle {
  const char *language;
  std::array<OnboardingStepOracle, 5> steps;
  const char *back;
  const char *next;
  const char *done;
};

const OnboardingOracle *currentOnboardingOracle() {
  static const OnboardingOracle oracles[] = {
      {"zh-Hans",
       {{{"欢迎使用 Cavalry 🎉",
          "这是<b>视口</b>，你的设计将在这里栩栩如生。使用它来实时预览和交互你的合成。"},
         {"场景树", "使用<b>场景树</b>来选择、重命名、重新排序和组织合成的图层。"},
         {"属性编辑器",
          "使用<b>属性编辑器</b>来微调图层属性——位置、填充/描边颜色、大小等。"},
         {"时间编辑器", "使用<b>时间编辑器</b>来调整动画时序和图层可见性。"},
         {"资源窗口",
          "使用<b>文件 > 导入资源...</b>或在此窗口中双击来导入图像、视频、字体、音频文件等。"}}},
       "上一步", "下一步", "完成"},
      {"zh-Hant",
       {{{"歡迎使用 Cavalry 🎉",
          "這是<b>視埠</b>，你的設計將在這裡栩栩如生。使用它來即時預覽和互動你的合成。"},
         {"場景樹", "使用<b>場景樹</b>來選取、重新命名、重新排序和組織合成的圖層。"},
         {"屬性編輯器",
          "使用<b>屬性編輯器</b>來微調圖層屬性——位置、填色/筆觸顏色、大小等。"},
         {"時間編輯器", "使用<b>時間編輯器</b>來調整動畫時序和圖層可見性。"},
         {"素材視窗",
          "使用<b>檔案 > 匯入素材...</b>或在此視窗中按兩下來匯入影像、影片、字體、音訊檔案等。"}}},
       "上一步", "下一步", "完成"},
      {"ja_JP",
       {{{"Cavalry へようこそ 🎉",
          "ここは<b>ビューポート</b>です。デザインがここで動き出します。コンポジションをリアルタイムでプレビューし、操作できます。"},
         {"シーンツリー",
          "<b>シーンツリー</b>を使って、コンポジションのレイヤーを選択、名前変更、並べ替え、整理します。"},
         {"属性エディター",
          "<b>属性エディター</b>を使って、レイヤーのプロパティ（位置、塗り/線の色、サイズなど）を微調整します。"},
         {"タイムエディター",
          "<b>タイムエディター</b>を使って、アニメーションのタイミングとレイヤーの表示/非表示を調整します。"},
         {"アセットウィンドウ",
          "<b>ファイル > アセットを読み込み...</b>を使うか、このウィンドウ内をダブルクリックして、画像、動画、フォント、音声ファイルなどを読み込みます。"}}},
       "戻る", "次へ", "完了"},
  };
  const QString language =
      QString::fromUtf8(std::getenv("CAVALRY_I18N_LANG") ?: "");
  for (const OnboardingOracle &oracle : oracles) {
    if (language == QString::fromLatin1(oracle.language)) return &oracle;
  }
  return nullptr;
}

bool exactOnboardingContent(QWidget *root, int step, const QString &title,
                            const QString &bodyHtml, QString *bodyPlain) {
  QList<QLabel *> titleHits;
  QList<QTextBrowser *> bodyHits;
  QTextDocument expectedDocument;
  expectedDocument.setHtml(bodyHtml);
  const QString expectedBody =
      normalizedPlainText(expectedDocument.toPlainText());
  for (QLabel *label : root->findChildren<QLabel *>()) {
    if (label->isVisibleTo(root) && label->text() == title &&
        label->text() != QStringLiteral("%1 / 5").arg(step))
      titleHits << label;
  }
  for (QTextBrowser *browser : root->findChildren<QTextBrowser *>()) {
    if (browser->isVisibleTo(root) &&
        normalizedPlainText(browser->toPlainText()) == expectedBody)
      bodyHits << browser;
  }
  if (bodyPlain) *bodyPlain = expectedBody;
  return !title.trimmed().isEmpty() && !expectedBody.isEmpty() &&
         titleHits.size() == 1 && bodyHits.size() == 1;
}

void processOnboarding() {
  bool ambiguous = false;
  QWidget *root = findOnboardingWindow(&ambiguous);
  if (ambiguous) {
    markDone(QStringLiteral("ERROR onboarding PopOverView ambiguous"));
    return;
  }
  if (!root) {
    if (!gOnboardingResults.isEmpty()) {
      if (++gTransitionAttempts > 80) {
        markDone(QStringLiteral("ERROR onboarding transition timeout"));
        return;
      }
    } else {
      if (!gTriggerAttempted && gGuideChooserOpened)
        gTriggerAttempted = triggerFirstLaunchFromChoiceView();
      if (!gTriggerAttempted && !gGuideChooserOpened) {
        gTriggerAttempted = triggerFirstLaunchGuide();
        if (!gTriggerAttempted) {
          const bool nativeTriggered =
              triggerGuideInNativeMenu([NSApp mainMenu]);
          const bool qtTriggered =
              nativeTriggered ? false : triggerGuideInQtActions();
          gGuideChooserOpened = qtTriggered || nativeTriggered;
          appendLog(
              QStringLiteral(
                  "ONBOARDING_TRIGGER chooser qt=%1 native=%2")
                  .arg(qtTriggered)
                  .arg(nativeTriggered));
        }
      }
      if (++gFindAttempts > 80) {
        markDone(gTriggerAttempted
                     ? QStringLiteral(
                           "ERROR onboarding exact PopOverView timeout")
                     : QStringLiteral(
                           "ERROR onboarding trigger readiness timeout"));
        return;
      }
    }
    QTimer::singleShot(100, qApp, [] { processOnboarding(); });
    return;
  }
  const int step = onboardingStep(root);
  const int expectedStep = gOnboardingResults.size() + 1;
  if (step != expectedStep) {
    if (step == expectedStep - 1 && ++gTransitionAttempts <= 80) {
      QTimer::singleShot(100, qApp, [] { processOnboarding(); });
      return;
    }
    markDone(QStringLiteral("ERROR onboarding sequence expected=%1 actual=%2")
                 .arg(expectedStep)
                 .arg(step));
    return;
  }
  gTransitionAttempts = 0;
  root->raise();
  root->activateWindow();
  const OnboardingOracle *oracle = currentOnboardingOracle();
  if (!oracle) {
    markDone(QStringLiteral("ERROR onboarding unsupported language oracle"));
    return;
  }
  const OnboardingStepOracle &stepOracle = oracle->steps.at(step - 1);
  const QString title = QString::fromUtf8(stepOracle.title);
  const QString body = QString::fromUtf8(stepOracle.body);
  QString bodyPlain;
  if (!exactOnboardingContent(root, step, title, body, &bodyPlain)) {
    logOnboardingContentTopology(root, step);
    markDone(QStringLiteral("ERROR onboarding exact title/body step=%1").arg(step));
    return;
  }
  const QString next = QString::fromUtf8(oracle->next);
  const QString back = QString::fromUtf8(oracle->back);
  const QString done = QString::fromUtf8(oracle->done);
  const QList<QAbstractButton *> buttons = onboardingButtons(root);
  int nextHits = 0;
  int backHits = 0;
  int doneHits = 0;
  for (QAbstractButton *button : buttons) {
    nextHits += button->text() == next;
    backHits += button->text() == back;
    doneHits += button->text() == done;
  }
  const bool topology =
      !next.isEmpty() && !back.isEmpty() && !done.isEmpty() &&
      ((step == 1 && buttons.size() == 1 && nextHits == 1 &&
        backHits == 0 && doneHits == 0) ||
       (step >= 2 && step <= 4 && buttons.size() == 2 && nextHits == 1 &&
        backHits == 1 && doneHits == 0) ||
       (step == 5 && buttons.size() == 2 && nextHits == 0 &&
        backHits == 1 && doneHits == 1));
  if (!topology) {
    markDone(QStringLiteral("ERROR onboarding exact button topology step=%1")
                 .arg(step));
    return;
  }
  QJsonArray visibleButtons;
  for (QAbstractButton *button : buttons) visibleButtons.append(button->text());
  QWidget *window = root->window();
  QPointer<QAbstractButton> forward;
  for (QAbstractButton *button : buttons)
    if (button->text() == next) forward = button;
  if (step < 5 && !forward) {
    markDone(QStringLiteral("ERROR onboarding Next unavailable step=%1").arg(step));
    return;
  }
  const QPointer<QWidget> capturedRoot(root);
  captureSurfaceAsync(
      root, window, QStringLiteral("onboarding-step-%1").arg(step), title,
      {{"step", step},
       {"body", bodyPlain},
       {"buttons", visibleButtons},
       {"ownerClass", "PopOverView"},
       {"catalogSlot", "en"}},
      [capturedRoot, forward, step](bool ok, const QJsonObject &result) {
        if (!ok || !capturedRoot ||
            onboardingStep(capturedRoot) != step) {
          markDone(
              QStringLiteral("ERROR onboarding capture step=%1").arg(step));
          return;
        }
        gOnboardingResults.append(result);
        if (step == 5) {
          finishOnce(
              QStringLiteral("OK onboarding five exact localized steps"),
              gOnboardingResults);
          return;
        }
        if (!forward) {
          markDone(
              QStringLiteral("ERROR onboarding Next vanished step=%1")
                  .arg(step));
          return;
        }
        forward->click();
        QTimer::singleShot(
            100, qApp, [] { processOnboarding(); });
      });
}

QJsonObject diagnosticsJson(const ToolHelpDiagnosticsV1 &value) {
  QJsonArray translated;
  QJsonArray fallback;
  for (int index = 0; index < 5; ++index) {
    translated.append(double(value.translatedSourceCalls[index]));
    fallback.append(double(value.fallbackSourceCalls[index]));
  }
  return {{"configured", value.configured},
          {"vendorContractVerified", value.vendorContractVerified},
          {"rendererReady", value.rendererReady},
          {"canonicalCalls", double(value.canonicalCalls)},
          {"cjkPathSuccess", double(value.cjkPathSuccess)},
          {"rendererFailure", double(value.rendererFailure)},
          {"translatedSourceMask", double(value.translatedSourceMask)},
          {"fallbackSourceMask", double(value.fallbackSourceMask)},
          {"translatedSourceCalls", translated},
          {"fallbackSourceCalls", fallback}};
}

bool translatedDeltasOnly(const ToolHelpDiagnosticsV1 &before,
                          const ToolHelpDiagnosticsV1 &after) {
  if (!before.configured || !before.vendorContractVerified ||
      !before.rendererReady || !after.configured ||
      !after.vendorContractVerified || !after.rendererReady ||
      after.canonicalCalls <= before.canonicalCalls ||
      after.cjkPathSuccess < before.cjkPathSuccess + 5 ||
      after.originalFallback != before.originalFallback ||
      after.rendererFailure != before.rendererFailure ||
      after.fallbackSourceMask != before.fallbackSourceMask) {
    return false;
  }
  for (int index = 0; index < 5; ++index) {
    if (after.translatedSourceCalls[index] <=
            before.translatedSourceCalls[index] ||
        after.fallbackSourceCalls[index] !=
            before.fallbackSourceCalls[index]) {
      return false;
    }
  }
  return true;
}

bool completeTranslatedState(const ToolHelpDiagnosticsV1 &value) {
  if (!value.configured || !value.vendorContractVerified ||
      !value.rendererReady || value.canonicalCalls < 5 ||
      value.cjkPathSuccess < 5 || value.originalFallback != 0 ||
      value.rendererFailure != 0 ||
      (value.translatedSourceMask & 31) != 31 ||
      value.fallbackSourceMask != 0) {
    return false;
  }
  for (int index = 0; index < 5; ++index) {
    if (value.translatedSourceCalls[index] == 0 ||
        value.fallbackSourceCalls[index] != 0)
      return false;
  }
  return true;
}

QJsonArray currentTransformTranslationOracle() {
  const QString language =
      QString::fromUtf8(std::getenv("CAVALRY_I18N_LANG") ?: "");
  if (language == QStringLiteral("zh-Hans")) {
    return {QStringLiteral("插入关键帧"), QStringLiteral("直接选择图层"),
            QStringLiteral("播放/停止"), QStringLiteral("平移"),
            QStringLiteral("启用吸附")};
  }
  if (language == QStringLiteral("zh-Hant")) {
    return {QStringLiteral("插入關鍵幀"), QStringLiteral("直接選取圖層"),
            QStringLiteral("播放/停止"), QStringLiteral("移動檢視"),
            QStringLiteral("啟用吸附")};
  }
  if (language == QStringLiteral("ja_JP")) {
    return {QStringLiteral("キーフレームを挿入"),
            QStringLiteral("レイヤーを直接選択"),
            QStringLiteral("再生/停止"), QStringLiteral("パン"),
            QStringLiteral("スナップを有効にする")};
  }
  return {};
}

struct TransformState {
  ToolHelpDiagnosticsFn diagnostic = nullptr;
  ToolHelpDiagnosticsV1 before{};
  QPointer<QWidget> viewport;
  QPointer<QWidget> hoverSurface;
  QPointer<QWidget> target;
  int attempts = 0;
};
TransformState gTransform;

void pollTransformEvidence() {
  ToolHelpDiagnosticsV1 after{};
  if (!gTransform.diagnostic ||
      !gTransform.diagnostic(&after, sizeof(after))) {
    markDone(QStringLiteral("ERROR transform diagnostics ABI read"));
    return;
  }
  const bool actionDelta = translatedDeltasOnly(gTransform.before, after);
  const bool startupCumulative =
      completeTranslatedState(gTransform.before) &&
      completeTranslatedState(after);
  if (!actionDelta && !startupCumulative) {
    if (++gTransform.attempts > 100) {
      appendLog(
          QStringLiteral("TRANSFORM_DIAGNOSTICS_TIMEOUT before=%1 after=%2")
              .arg(
                  QString::fromUtf8(
                      QJsonDocument(diagnosticsJson(gTransform.before))
                          .toJson(QJsonDocument::Compact)),
                  QString::fromUtf8(
                      QJsonDocument(diagnosticsJson(after))
                          .toJson(QJsonDocument::Compact))));
      markDone(QStringLiteral(
          "ERROR transform five-source success/fallback bounded delta"));
      return;
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{ pollTransformEvidence(); });
    return;
  }
  if (!gTransform.viewport || !gTransform.viewport->isVisible() ||
      !gTransform.hoverSurface || !gTransform.hoverSurface->isVisible()) {
    markDone(QStringLiteral("ERROR transform viewport surface vanished"));
    return;
  }
  QJsonArray deltas;
  for (int index = 0; index < 5; ++index) {
    deltas.append(double(after.translatedSourceCalls[index] -
                         gTransform.before.translatedSourceCalls[index]));
  }
  const QJsonArray expectedTranslations = currentTransformTranslationOracle();
  if (expectedTranslations.size() != 5) {
    markDone(QStringLiteral("ERROR transform unsupported language oracle"));
    return;
  }
  captureSurfaceAsync(
      gTransform.viewport, gTransform.viewport->window(),
      QStringLiteral("transform-tool-help"),
      QStringLiteral("Transform Tool"),
      {{"ownerClass", "GraphicsViewportWindow"},
       {"expectedTranslations", expectedTranslations},
       {"callerBoundaryVerified", true},
       {"evidenceMode",
        actionDelta ? "action-delta" : "startup-cumulative"},
       {"before", diagnosticsJson(gTransform.before)},
       {"after", diagnosticsJson(after)},
       {"translatedSourceDeltas", deltas}},
      [](bool ok, const QJsonObject &result) {
        if (!ok) {
          markDone(
              QStringLiteral("ERROR transform exact viewport capture"));
          return;
        }
        finishOnce(
            QStringLiteral(
                "OK transform five-source diagnostic and pixels"),
            QJsonArray{result});
      });
}

bool isTransformTool(QWidget *widget) {
  if (!widget || className(widget) != QStringLiteral("StateButton"))
    return false;
  const QString toolTip = widget->toolTip().trimmed();
  return toolTip == QStringLiteral("Transform Tool") ||
         toolTip == QStringLiteral("变形工具") ||
         toolTip == QStringLiteral("變形工具") ||
         toolTip == QStringLiteral("変換ツール");
}

void clickTransformTool(QWidget *target) {
  const QPoint local = target->rect().center();
  const QPoint global = target->mapToGlobal(local);
  QMouseEvent press(QEvent::MouseButtonPress, local, global, Qt::LeftButton,
                    Qt::LeftButton, Qt::NoModifier);
  QMouseEvent release(QEvent::MouseButtonRelease, local, global, Qt::LeftButton,
                      Qt::NoButton, Qt::NoModifier);
  QApplication::sendEvent(target, &press);
  QApplication::sendEvent(target, &release);
}

void exposeTransformWorkspace() {
  for (QWidget *top : QApplication::topLevelWidgets()) {
    if (!top) continue;
    const QString klass = className(top);
    const QString title = top->windowTitle();
    const bool welcome =
        klass.contains(QStringLiteral("SignInDialog")) ||
        title.contains(QStringLiteral("Welcome"), Qt::CaseInsensitive) ||
        title.contains(QStringLiteral("欢迎")) ||
        title.contains(QStringLiteral("歡迎")) ||
        title.contains(QStringLiteral("ようこそ"));
    if (!welcome) continue;
    if (QDialog *dialog = qobject_cast<QDialog *>(top))
      dialog->setModal(false);
    top->setWindowModality(Qt::NonModal);
    top->hide();
  }
}

void runTransform() {
  exposeTransformWorkspace();
  QWidget *mainWindow = nullptr;
  QWidget *target = nullptr;
  QWidget *viewport = nullptr;
  QWidget *hoverSurface = nullptr;
  for (QWidget *widget : QApplication::allWidgets()) {
    if (!widget || !widget->isVisible()) continue;
    if (className(widget) == QStringLiteral("MainDock")) {
      if (mainWindow) {
        markDone(QStringLiteral("ERROR MainDock ambiguous"));
        return;
      }
      mainWindow = widget;
    }
    if (isTransformTool(widget) && widget->isEnabled()) {
      if (target) {
        markDone(QStringLiteral("ERROR Transform Tool ambiguous"));
        return;
      }
      target = widget;
    }
    if (className(widget) == QStringLiteral("GraphicsViewportWindow")) {
      if (viewport) {
        markDone(QStringLiteral("ERROR GraphicsViewportWindow ambiguous"));
        return;
      }
      viewport = widget;
    }
  }
  if (viewport) {
    for (QWidget *widget : QApplication::allWidgets()) {
      if (!widget || !widget->isVisible() ||
          className(widget) != QStringLiteral("GraphicsViewportBase") ||
          !viewport->isAncestorOf(widget)) {
        continue;
      }
      if (hoverSurface) {
        markDone(QStringLiteral("ERROR GraphicsViewportBase ambiguous"));
        return;
      }
      hoverSurface = widget;
    }
  }
  if (!mainWindow || !target || !viewport || !hoverSurface) {
    if (++gFindAttempts <= 100) {
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                     dispatch_get_main_queue(), ^{ runTransform(); });
      return;
    }
    appendLog(
        QStringLiteral(
            "TRANSFORM_TOPOLOGY_TIMEOUT main=%1 target=%2 viewport=%3 hover=%4")
            .arg(bool(mainWindow))
            .arg(bool(target))
            .arg(bool(viewport))
            .arg(bool(hoverSurface)));
    markDone(QStringLiteral("ERROR transform exact topology timeout"));
    return;
  }
  mainWindow->raise();
  mainWindow->activateWindow();
  gTransform.diagnostic = reinterpret_cast<ToolHelpDiagnosticsFn>(
      dlsym(RTLD_DEFAULT, "cavalry_i18n_mac_tool_help_diagnostics_v1"));
  if (!gTransform.diagnostic ||
      !gTransform.diagnostic(&gTransform.before, sizeof(gTransform.before)) ||
      !gTransform.before.configured ||
      !gTransform.before.vendorContractVerified ||
      !gTransform.before.rendererReady) {
    markDone(QStringLiteral("ERROR transform diagnostics precondition"));
    return;
  }
  gTransform.viewport = viewport;
  gTransform.hoverSurface = hoverSurface;
  gTransform.target = target;
  appendLog(
      QStringLiteral(
          "TRANSFORM_TOPOLOGY target=%1 tooltip=%2 viewport=%3 hover=%4")
          .arg(className(target), target->toolTip(), className(viewport),
               className(hoverSurface)));
  clickTransformTool(target);
  if (completeTranslatedState(gTransform.before)) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 150 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      if (!gTransform.target || !gTransform.viewport ||
          !gTransform.hoverSurface) {
        markDone(QStringLiteral("ERROR transform surface vanished"));
        return;
      }
      clickTransformTool(gTransform.target);
      QCursor::setPos(gTransform.hoverSurface->mapToGlobal(
          gTransform.hoverSurface->rect().center()));
      gTransform.hoverSurface->update();
      gTransform.viewport->update();
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                     dispatch_get_main_queue(), ^{ pollTransformEvidence(); });
    });
    return;
  }
  QCursor::setPos(
      hoverSurface->mapToGlobal(hoverSurface->rect().center()));
  hoverSurface->update();
  viewport->update();
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{ pollTransformEvidence(); });
}

void schedule() {
  bool expected = false;
  if (!gScheduled.compare_exchange_strong(expected, true)) return;
  const QString scenario = QString::fromUtf8(
      std::getenv("CAVALRY_I18N_SUPPLEMENTAL_SCENARIO") ?: "");
  const qint64 delay =
      scenario == QStringLiteral("transform") ? 2500 : 100;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, delay * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{
    if (scenario == QStringLiteral("onboarding"))
      processOnboarding();
    else if (scenario == QStringLiteral("transform"))
      runTransform();
    else
      markDone(QStringLiteral("ERROR unsupported supplemental scenario"));
  });
}
}  // namespace

__attribute__((constructor)) static void initializeSupplementalDriver() {
  @autoreleasepool {
    [[NSNotificationCenter defaultCenter]
        addObserverForName:NSApplicationDidFinishLaunchingNotification
                    object:nil
                     queue:[NSOperationQueue mainQueue]
                usingBlock:^(__unused NSNotification *notification) {
                  schedule();
                }];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 5000 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{ schedule(); });
  }
}
