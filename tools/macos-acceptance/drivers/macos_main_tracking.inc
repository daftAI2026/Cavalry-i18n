/**
 * [INPUT]: 真实 MP4 fixture、Assets 导入前后行差集、Scene/Viewport/TrackingToolSettings 拓扑、QTimer 与 Tracking 对话框。
 * [OUTPUT]: 从导入素材到四点跟踪、向前跟踪动作及 exact MainDock dialog 的逐语言像素证据。
 * [POS]: 主验收的长操作状态机；Assets 以唯一新增行和省略前缀绑定 fixture，Scene 以完整文本绑定 RowWidget，Tracking modal 由其 Qt 嵌套循环承接。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
class TrackingAcceptanceFlow;

class TrackingMenuSensor final : public QObject {
 public:
  explicit TrackingMenuSensor(QObject *parent) : QObject(parent) {}

  void arm() {
    armed_ = true;
    footageTriggered_ = false;
  }

  bool footageTriggered() const { return footageTriggered_; }

 protected:
  bool eventFilter(QObject *watched, QEvent *event) override {
    QMenu *menu = qobject_cast<QMenu *>(watched);
    if (!armed_ || !menu || event->type() != QEvent::Show) {
      return QObject::eventFilter(watched, event);
    }
    QList<QAction *> hits;
    for (QAction *action : menu->actions()) {
      if (action && action->isVisible() && action->isEnabled() &&
          QStringList{
              QStringLiteral("Add to Composition as Footage"),
              oracle(QStringLiteral("footage")),
          }.contains(action->text())) {
        hits << action;
      }
    }
    if (hits.size() != 1) {
      armed_ = false;
      markDone(QStringLiteral("ERROR tracking Footage QAction count=%1")
                   .arg(hits.size()));
      menu->close();
      return QObject::eventFilter(watched, event);
    }
    armed_ = false;
    QPointer<QMenu> guardedMenu(menu);
    QPointer<QAction> guardedAction(hits.front());
    QTimer::singleShot(0, this, [this, guardedMenu, guardedAction] {
      if (!guardedMenu || !guardedAction) {
        markDone(QStringLiteral(
            "ERROR tracking Footage QAction vanished before Qt handoff"));
        return;
      }
      guardedMenu->hide();
      footageTriggered_ = true;
      appendLog(
          QStringLiteral(
              "TRACKING_FOOTAGE_ACTION owner=assets::Window text=%1")
              .arg(guardedAction->text()));
      guardedAction->trigger();
    });
    return QObject::eventFilter(watched, event);
  }

 private:
  bool armed_ = false;
  bool footageTriggered_ = false;
};

class TrackingDialogSensor final : public QObject {
 public:
  TrackingDialogSensor(TrackingAcceptanceFlow *flow, QObject *parent)
      : QObject(parent), flow_(flow) {}

  void arm() { armed_ = true; }

 protected:
  bool eventFilter(QObject *watched, QEvent *event) override;

 private:
  TrackingAcceptanceFlow *flow_ = nullptr;
  bool armed_ = false;
};

class TrackingAcceptanceFlow final : public QObject {
 public:
  explicit TrackingAcceptanceFlow(QObject *parent)
      : QObject(parent),
        menuSensor_(new TrackingMenuSensor(this)),
        dialogSensor_(new TrackingDialogSensor(this, this)) {
    qApp->installEventFilter(menuSensor_);
    qApp->installEventFilter(dialogSensor_);
  }

  void start() {
    const char *fixture = std::getenv("CAVALRY_I18N_TRACKING_FIXTURE");
    fixture_ = QString::fromUtf8(fixture ?: "");
    QFileInfo info(fixture_);
    const bool fixtureValid =
        !fixture_.isEmpty() && info.isFile() && !info.isSymLink() &&
        info.completeBaseName() == QStringLiteral("replace-source") &&
        info.suffix().compare(QStringLiteral("mp4"), Qt::CaseInsensitive) == 0;
    const bool ownerExternalValid =
        syntheticTrackingTitleRemainsEnglish();
    appendLog(
        QStringLiteral(
            "TRACKING_STAGE fixture-valid=%1 owner-external=%2 path=%3")
            .arg(fixtureValid)
            .arg(ownerExternalValid)
            .arg(fixture_));
    if (!fixtureValid || !ownerExternalValid) {
      fail(QStringLiteral("fixture/owner-external negative precondition"));
      return;
    }
    pollAssetsTopology();
  }

  void observeDialog(QDialog *dialog) {
    if (terminal_ || !dialog) return;
    QPointer<QDialog> guarded(dialog);
    QTimer::singleShot(0, this, [this, guarded] {
      if (!guarded) {
        this->fail(QStringLiteral("tracking dialog vanished before post-Show proof"));
        return;
      }
      this->captureDialog(guarded);
    });
  }

 private:
  static constexpr int kAttempts = 100;
  const QString stem_ = QStringLiteral("replace-source");
  QString fixture_;
  QPointer<QWidget> assetsWindow_;
  QPointer<QWidget> assetsTree_;
  QPointer<QWidget> dropTarget_;
  QPointer<QWidget> importedRow_;
  QPointer<QLineEdit> importedName_;
  QList<QPointer<QWidget>> initialAssetRows_;
  TrackingMenuSensor *menuSensor_ = nullptr;
  TrackingDialogSensor *dialogSensor_ = nullptr;
  int attempts_ = 0;
  bool terminal_ = false;

  void fail(const QString &reason) {
    if (terminal_) return;
    terminal_ = true;
    appendLog(QStringLiteral("ERROR TRACKING_V2 %1").arg(reason));
    markDone(QStringLiteral("ERROR tracking %1").arg(reason));
  }

  bool syntheticTrackingTitleRemainsEnglish() {
    QDialog dialog;
    dialog.setObjectName(QStringLiteral("acceptance-owner-external"));
    dialog.setWindowTitle(QStringLiteral("Tracking..."));
    QPushButton cancel(QStringLiteral("Cancel"), &dialog);
    dialog.move(-10000, -10000);
    dialog.show();
    cancel.show();
    const bool pass =
        dialog.windowTitle() == QStringLiteral("Tracking...");
    appendLog(
        QStringLiteral(
            "TRACKING_STAGE external-title=%1 external-cancel=%2")
            .arg(dialog.windowTitle(), cancel.text()));
    dialog.hide();
    return pass;
  }

  QList<ExactAssetRow> visibleNamedRows(
      QWidget *owner, const QString &rowClass) const {
    QList<ExactAssetRow> rows;
    if (!owner) return rows;
    for (QLineEdit *name : owner->findChildren<QLineEdit *>()) {
      if (!name || className(name) != QStringLiteral("EditableNodeName") ||
          !name->isVisibleTo(owner)) {
        continue;
      }
      QWidget *row = nullptr;
      for (QWidget *cursor = name->parentWidget(); cursor && cursor != owner;
           cursor = cursor->parentWidget()) {
        if (className(cursor) == rowClass) {
          row = cursor;
          break;
        }
      }
      if (!row || !row->isVisibleTo(owner)) continue;
      bool duplicate = false;
      for (const ExactAssetRow &existing : rows)
        duplicate = duplicate || existing.row == row;
      if (!duplicate) rows << ExactAssetRow{row, name};
    }
    return rows;
  }

  QList<ExactAssetRow> exactRows(
      QWidget *owner, const QString &stem, const QString &rowClass) const {
    QList<ExactAssetRow> rows;
    for (const ExactAssetRow &candidate :
         visibleNamedRows(owner, rowClass)) {
      if (candidate.name->text() == stem) rows << candidate;
    }
    return rows;
  }

  bool assetDisplayMatchesStem(const QString &display) const {
    if (display == stem_) return true;
    if (!display.endsWith(QChar(0x2026))) return false;
    const QString prefix = display.left(display.size() - 1);
    return !prefix.isEmpty() && stem_.startsWith(prefix);
  }

  QWidget *uniqueVisibleOwner(const QString &klass) const {
    QWidget *hit = nullptr;
    for (QWidget *widget : QApplication::allWidgets()) {
      if (!widget || className(widget) != klass || !widget->isVisible()) continue;
      if (hit) return nullptr;
      hit = widget;
    }
    return hit;
  }

  void pollAssetsTopology() {
    if (terminal_) return;
    assetsWindow_ = uniqueVisibleOwner(QStringLiteral("assets::Window"));
    QList<QWidget *> trees;
    if (assetsWindow_) {
      for (QWidget *widget : assetsWindow_->findChildren<QWidget *>()) {
        if (className(widget) == QStringLiteral("SimpleTreeWidget") &&
            widget->isVisibleTo(assetsWindow_) && widget->isEnabled()) {
          trees << widget;
        }
      }
    }
    if (!assetsWindow_ || trees.size() != 1) {
      if (++attempts_ > kAttempts) {
        fail(QStringLiteral("Assets topology timeout/ambiguity"));
        return;
      }
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                     dispatch_get_main_queue(), ^{ this->pollAssetsTopology(); });
      return;
    }
    assetsTree_ = trees.front();
    dropTarget_ = assetsTree_;
    if (QAbstractItemView *view = qobject_cast<QAbstractItemView *>(assetsTree_)) {
      if (view->viewport()) dropTarget_ = view->viewport();
    }
    const QList<ExactAssetRow> currentAssetRows = visibleNamedRows(
        assetsWindow_, QStringLiteral("SimpleRowWidget"));
    bool fixtureAlreadyPresent = false;
    for (const ExactAssetRow &row : currentAssetRows)
      fixtureAlreadyPresent =
          fixtureAlreadyPresent || assetDisplayMatchesStem(row.name->text());
    if (!dropTarget_ || !dropTarget_->acceptDrops() ||
        !dropTarget_->isVisibleTo(assetsWindow_) ||
        fixtureAlreadyPresent) {
      fail(QStringLiteral("fresh exact Assets row/drop target contract"));
      return;
    }
    initialAssetRows_.clear();
    for (const ExactAssetRow &row : currentAssetRows)
      initialAssetRows_ << QPointer<QWidget>(row.row);
    importFixture();
  }

  void importFixture() {
    QMimeData mime;
    mime.setUrls({QUrl::fromLocalFile(fixture_)});
    const QPoint position = dropTarget_->rect().center();
    QDragEnterEvent dragEnter(position, Qt::CopyAction, &mime, Qt::LeftButton,
                              Qt::NoModifier);
    const bool dragDelivered = QApplication::sendEvent(dropTarget_, &dragEnter);
    QDropEvent drop(QPointF(position), Qt::CopyAction, &mime, Qt::LeftButton,
                    Qt::NoModifier);
    const bool dropDelivered = QApplication::sendEvent(dropTarget_, &drop);
    if (!dragDelivered || !dragEnter.isAccepted() || !dropDelivered ||
        !drop.isAccepted()) {
      fail(QStringLiteral("MP4 QDragEnter/QDrop delivered+accepted"));
      return;
    }
    attempts_ = 0;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{ this->pollImportedAsset(); });
  }

  void pollImportedAsset() {
    if (terminal_) return;
    const QList<ExactAssetRow> rows = visibleNamedRows(
        assetsWindow_, QStringLiteral("SimpleRowWidget"));
    QList<ExactAssetRow> added;
    for (const ExactAssetRow &row : rows) {
      bool existed = false;
      for (const QPointer<QWidget> &before : initialAssetRows_)
        existed = existed || before == row.row;
      if (!existed) added << row;
    }
    const bool exactDelta =
        rows.size() == initialAssetRows_.size() + 1 && added.size() == 1;
    const bool displayMatches =
        exactDelta && assetDisplayMatchesStem(added.front().name->text());
    if (!exactDelta || !displayMatches) {
      if (added.size() > 1 || ++attempts_ > kAttempts) {
        if (assetsWindow_) {
          for (QLineEdit *name :
               assetsWindow_->findChildren<QLineEdit *>()) {
            QStringList parents;
            for (QObject *cursor = name->parent(); cursor;
                 cursor = cursor->parent()) {
              parents << className(cursor);
              if (cursor == assetsWindow_) break;
            }
            appendLog(
                QStringLiteral(
                    "TRACKING_STAGE asset-line-edit class=%1 text=%2 "
                    "visible=%3 parents=%4")
                    .arg(className(name), name->text())
                    .arg(name->isVisibleTo(assetsWindow_))
                    .arg(parents.join(QStringLiteral("<-"))));
          }
        }
        fail(QStringLiteral("Assets exact row delta must be 0→1"));
        return;
      }
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                     dispatch_get_main_queue(), ^{ this->pollImportedAsset(); });
      return;
    }
    importedRow_ = added.front().row;
    importedName_ = added.front().name;
    appendLog(
        QStringLiteral(
            "TRACKING_STAGE asset-row-delta before=%1 after=%2 display=%3")
            .arg(initialAssetRows_.size())
            .arg(rows.size())
            .arg(importedName_->text()));
    dispatchWidgetClick(importedRow_);
    menuSensor_->arm();
    const QPoint global =
        importedName_->mapToGlobal(importedName_->rect().center());
    const QPoint local = dropTarget_->mapFromGlobal(global);
    QContextMenuEvent context(QContextMenuEvent::Mouse, local, global);
    const bool delivered = QApplication::sendEvent(dropTarget_, &context);
    if (!delivered || !context.isAccepted() ||
        !menuSensor_->footageTriggered()) {
      fail(QStringLiteral("exact Assets Footage context action delivery+acceptance"));
      return;
    }
    attempts_ = 0;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{ this->pollSceneLayer(); });
  }

  void pollSceneLayer() {
    if (terminal_) return;
    QWidget *sceneOwner = uniqueVisibleOwner(QStringLiteral("SceneTreeWindow"));
    const QList<ExactAssetRow> rows = exactRows(
        sceneOwner, stem_, QStringLiteral("RowWidget"));
    if (!sceneOwner || rows.size() != 1) {
      if (rows.size() > 1 || ++attempts_ > kAttempts) {
        fail(QStringLiteral("Scene exact footage row delta must be 0→1"));
        return;
      }
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                     dispatch_get_main_queue(), ^{ this->pollSceneLayer(); });
      return;
    }
    dispatchWidgetClick(rows.front().row);
    activateTrackingTool();
  }

  void activateTrackingTool() {
    QWidget *tool = nullptr;
    for (QWidget *widget : QApplication::allWidgets()) {
      if (widget && className(widget) == QStringLiteral("ToolButton") &&
          widget->objectName() == QStringLiteral("Tracking Tool") &&
          widget->isVisible() && widget->isEnabled()) {
        if (tool) {
          fail(QStringLiteral("Tracking Tool exact objectName ambiguous"));
          return;
        }
        tool = widget;
      }
    }
    if (!tool) {
      fail(QStringLiteral("Tracking Tool exact objectName unavailable"));
      return;
    }
    dispatchWidgetClick(tool);
    QWidget *viewport =
        uniqueVisibleOwner(QStringLiteral("GraphicsViewportWindow"));
    QWidget *canvas = nullptr;
    if (viewport) {
      for (QWidget *widget : viewport->findChildren<QWidget *>()) {
        if (className(widget) == QStringLiteral("QWindowContainer") &&
            widget->isVisibleTo(viewport)) {
          if (canvas) {
            fail(QStringLiteral("GraphicsViewport QWindowContainer ambiguous"));
            return;
          }
          canvas = widget;
        }
      }
    }
    if (!viewport || !canvas) {
      fail(QStringLiteral("GraphicsViewport exact canvas unavailable"));
      return;
    }
    const QList<QPoint> points{
        QPoint(viewport->width() * 30 / 100, viewport->height() * 28 / 100),
        QPoint(viewport->width() * 70 / 100, viewport->height() * 28 / 100),
        QPoint(viewport->width() * 30 / 100, viewport->height() * 68 / 100),
        QPoint(viewport->width() * 70 / 100, viewport->height() * 68 / 100)};
    for (const QPoint &viewportPoint : points) {
      const QPoint global = viewport->mapToGlobal(viewportPoint);
      const QPointF local(canvas->mapFromGlobal(global));
      QMouseEvent press(QEvent::MouseButtonPress, local, QPointF(global),
                        Qt::LeftButton, Qt::LeftButton, Qt::NoModifier);
      QMouseEvent release(QEvent::MouseButtonRelease, local, QPointF(global),
                          Qt::LeftButton, Qt::NoButton, Qt::NoModifier);
      QApplication::sendEvent(canvas, &press);
      QApplication::sendEvent(canvas, &release);
    }
    attempts_ = 0;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{ this->pollTrackingSettings(); });
  }

  void pollTrackingSettings() {
    if (terminal_) return;
    QWidget *settings =
        uniqueVisibleOwner(QStringLiteral("TrackingToolSettings"));
    const QList<QWidget *> buttons =
        directVisibleEnabled(settings, QStringLiteral("GroupButton"));
    QList<QPair<QWidget *, QWidget *>> adjacentPairs;
    for (QWidget *left : buttons) {
      for (QWidget *right : buttons) {
        if (left == right || left->size() != QSize(28, 28) ||
            right->size() != QSize(28, 28)) {
          continue;
        }
        const QPoint leftGlobal = left->mapToGlobal(QPoint());
        const QPoint rightGlobal = right->mapToGlobal(QPoint());
        if (rightGlobal.y() == leftGlobal.y() &&
            rightGlobal.x() - leftGlobal.x() == 28) {
          adjacentPairs << qMakePair(left, right);
        }
      }
    }
    const bool topology = settings && adjacentPairs.size() == 1;
    if (!topology) {
      if (++attempts_ > kAttempts) {
        appendLog(
            QStringLiteral(
                "TRACKING_STAGE settings-buttons=%1 adjacent-pairs=%2")
                .arg(buttons.size())
                .arg(adjacentPairs.size()));
        fail(QStringLiteral(
            "TrackingToolSettings unique adjacent back/forward topology"));
        return;
      }
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                     dispatch_get_main_queue(), ^{ this->pollTrackingSettings(); });
      return;
    }
    QWidget *forward = adjacentPairs.front().second;
    appendLog(
        QStringLiteral(
            "TRACKING_STAGE settings-buttons=%1 forward=%2")
            .arg(buttons.size())
            .arg(forward->toolTip()));
    dialogSensor_->arm();
    dispatchWidgetClick(forward);
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 10000 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      if (!this->terminal_) {
        this->fail(QStringLiteral("exact tracking dialog timeout"));
      }
    });
  }

  void captureDialog(QDialog *dialog) {
    if (terminal_ || !dialog) return;
    const QList<QProgressBar *> progress =
        dialog->findChildren<QProgressBar *>(QString(),
                                             Qt::FindDirectChildrenOnly);
    const QList<QPushButton *> buttons =
        dialog->findChildren<QPushButton *>(QString(),
                                            Qt::FindDirectChildrenOnly);
    QPushButton *cancel = buttons.size() == 1 ? buttons.front() : nullptr;
    const bool topology =
        dialog->metaObject() == &QDialog::staticMetaObject &&
        className(dialog->parent()) == QStringLiteral("MainDock") &&
        dialog->isWindow() && dialog->window() == dialog &&
        dialog->testAttribute(Qt::WA_DeleteOnClose) &&
        progress.size() == 1 &&
        progress.front()->windowModality() == Qt::WindowModal && cancel &&
        dialog->windowTitle() == oracle(QStringLiteral("tracking")) &&
        cancel->text() == oracle(QStringLiteral("cancel"));
    if (!topology) {
      fail(QStringLiteral("QDialog/MainDock/progress/title/Cancel topology"));
      return;
    }
    QJsonObject result;
    if (!captureSurface(
            cancel, dialog, QStringLiteral("tracking"),
            dialog->windowTitle(), &result,
            {{"ownerClass", "MainDock"},
             {"ownerExternalUnchanged", true},
             {"dialogClass", "QDialog"},
             {"cancelText", cancel->text()},
             {"progressModality", int(progress.front()->windowModality())},
             {"fixtureStem", stem_}})) {
      fail(QStringLiteral("tracking exact dialog capture"));
      return;
    }
    terminal_ = true;
    finishOnce(QStringLiteral("OK Tracking real MP4 exact MainDock dialog"),
               QJsonArray{result});
  }

  friend class TrackingDialogSensor;
};

bool TrackingDialogSensor::eventFilter(QObject *watched, QEvent *event) {
  QDialog *dialog = qobject_cast<QDialog *>(watched);
  if (!armed_ || !dialog || event->type() != QEvent::Show ||
      dialog->metaObject() != &QDialog::staticMetaObject ||
      className(dialog->parent()) != QStringLiteral("MainDock")) {
    return QObject::eventFilter(watched, event);
  }
  armed_ = false;
  flow_->observeDialog(dialog);
  return QObject::eventFilter(watched, event);
}

void runTrackingScenario() {
  if (!exposeMainWindow() || !qApp) return;
  auto *flow = new TrackingAcceptanceFlow(qApp);
  // Assets/Tracking 信号连接晚于 MainDock；沿用旧三语实机采证的启动稳定窗。
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 3500 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{ flow->start(); });
}
