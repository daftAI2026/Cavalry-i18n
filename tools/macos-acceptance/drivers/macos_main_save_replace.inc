/**
 * [INPUT]: 主验收共享 oracle/截图握手/QTimer、Assets 真实 Qt 拓扑与 harness 冻结的双 stem fixture。
 * [OUTPUT]: 两轮 Drop→精确新增行→ContextMenu 的 Replace/Create 动态模板证据。
 * [POS]: 主验收的 Assets owner 分片；真实 ContextMenu 进入 QMenu 嵌套循环后仅由 Qt timer 驱动检查与收口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
void dispatchWidgetClick(QWidget *widget) {
  if (!widget) {
    return;
  }
  if (QMetaObject::invokeMethod(widget, "click", Qt::DirectConnection)) {
    return;
  }
  const QPointF local(widget->rect().center());
  const QPointF global(widget->mapToGlobal(widget->rect().center()));
  QMouseEvent press(QEvent::MouseButtonPress, local, global,
                    Qt::LeftButton, Qt::LeftButton, Qt::NoModifier);
  QApplication::sendEvent(widget, &press);
  QMouseEvent release(QEvent::MouseButtonRelease, local, global,
                      Qt::LeftButton, Qt::NoButton, Qt::NoModifier);
  QApplication::sendEvent(widget, &release);
}

struct ExactAssetRow {
  QWidget *row = nullptr;
  QLineEdit *name = nullptr;
};

QString replaceEnvironment(const char *name) {
  const char *value = std::getenv(name);
  return value ? QString::fromUtf8(value) : QString();
}

QStringList replaceTranslations() {
  return {
      QStringLiteral("替换…"),
      QStringLiteral("取代…"),
      QStringLiteral("置換…"),
  };
}

QStringList createTranslations(const QString &stem) {
  return {
      QStringLiteral("基于 %1 创建合成").arg(stem),
      QStringLiteral("根據 %1 建立合成").arg(stem),
      QStringLiteral("%1 を基にコンポジションを作成").arg(stem),
  };
}

bool actionIsPaintedBy(QAction *action, QMenu *menu) {
  if (!action || !menu || !action->isVisible() || !action->isEnabled()) {
    return false;
  }
  for (QObject *associated : action->associatedObjects()) {
    if (associated == menu) {
      return true;
    }
  }
  return false;
}

class ReplaceAcceptanceFlow final : public QObject {
 public:
  explicit ReplaceAcceptanceFlow(QObject *parent) : QObject(parent) {
    stems_ = {QStringLiteral("replace-source"), QStringLiteral("dynamic-proof-two")};
    fixtures_ = {
        replaceEnvironment("CAVALRY_I18N_FIXTURE_REPLACE"),
        replaceEnvironment("CAVALRY_I18N_FIXTURE_DYNAMIC"),
    };
  }

  void start() {
    if (!validateFixtures()) {
      return;
    }
    pollTopology();
  }

 private:
  static constexpr int kTopologyAttempts = 80;
  static constexpr int kRowAttempts = 80;
  static constexpr int kMenuAttempts = 80;

  QStringList stems_;
  QStringList fixtures_;
  QPointer<QWidget> assetsWindow_;
  QPointer<QWidget> treeWidget_;
  QPointer<QWidget> dropTarget_;
  QPointer<QWidget> selectedRow_;
  QPointer<QLineEdit> selectedName_;
  QJsonArray observations_;
  int stemIndex_ = 0;
  int topologyAttempts_ = 0;
  int rowAttempts_ = 0;
  int menuAttempts_ = 0;
  int beforeRowCount_ = -1;
  bool terminal_ = false;
  bool menuValidated_ = false;
  bool contextReturned_ = false;
  bool contextDelivered_ = false;
  bool contextAccepted_ = false;
  QJsonObject pendingReplaceCapture_;
  QJsonObject pendingCreateCapture_;

  void fail(const QString &reason) {
    if (terminal_) {
      return;
    }
    terminal_ = true;
    closeVisibleMenus();
    appendLog(QStringLiteral("ERROR REPLACE_V2 %1").arg(reason));
    markDone(QStringLiteral("ERROR replace %1").arg(reason));
  }

  bool validateFixtures() {
    if (oracle(QStringLiteral("replace")).isEmpty() ||
        oracle(QStringLiteral("create")).isEmpty()) {
      fail(QStringLiteral("current-language oracle unavailable"));
      return false;
    }
    QStringList canonical;
    for (int index = 0; index < stems_.size(); ++index) {
      QFile fixtureFile(fixtures_.at(index));
      const QByteArray fixtureUtf8 = fixtures_.at(index).toUtf8();
      NSString *rawPath =
          [NSString stringWithUTF8String:fixtureUtf8.constData()];
      NSString *resolvedPath =
          [rawPath stringByResolvingSymlinksInPath];
      const QString resolved =
          QString::fromUtf8([resolvedPath fileSystemRepresentation]);
      const QString resolvedStem = QString::fromUtf8(
          [[[resolvedPath lastPathComponent] stringByDeletingPathExtension]
              UTF8String]);
      if (fixtures_.at(index).isEmpty() || !fixtureFile.exists() ||
          !fixtureFile.open(QIODevice::ReadOnly) || resolved.isEmpty() ||
          resolvedStem != stems_.at(index)) {
        fail(QStringLiteral("fixture must be a real file with exact stem=%1 path=%2")
                 .arg(stems_.at(index), fixtures_.at(index)));
        return false;
      }
      fixtureFile.close();
      canonical << resolved;
    }
    if (canonical.at(0) == canonical.at(1)) {
      fail(QStringLiteral("dual fixtures resolve to one file"));
      return false;
    }
    fixtures_ = canonical;
    return true;
  }

  void pollTopology() {
    if (terminal_) {
      return;
    }
    QList<QWidget *> assetsHits;
    for (QWidget *widget : QApplication::allWidgets()) {
      if (widget && className(widget) == QStringLiteral("assets::Window") &&
          widget->isVisible()) {
        assetsHits << widget;
      }
    }
    if (assetsHits.size() > 1) {
      fail(QStringLiteral("assets::Window ambiguous count=%1").arg(assetsHits.size()));
      return;
    }
    if (assetsHits.isEmpty()) {
      retryTopology(QStringLiteral("assets::Window"));
      return;
    }

    QList<QWidget *> treeHits;
    for (QWidget *widget :
         assetsHits.front()->findChildren<QWidget *>()) {
      if (className(widget) == QStringLiteral("SimpleTreeWidget") &&
          widget->isVisibleTo(assetsHits.front()) && widget->isEnabled()) {
        treeHits << widget;
      }
    }
    if (treeHits.size() > 1) {
      fail(QStringLiteral("SimpleTreeWidget ambiguous count=%1").arg(treeHits.size()));
      return;
    }
    if (treeHits.isEmpty()) {
      retryTopology(QStringLiteral("SimpleTreeWidget"));
      return;
    }

    QWidget *dropTarget = treeHits.front();
    if (QAbstractItemView *view =
            qobject_cast<QAbstractItemView *>(treeHits.front())) {
      if (view->viewport()) {
        dropTarget = view->viewport();
      }
    }
    if (!dropTarget->isVisibleTo(assetsHits.front()) ||
        !dropTarget->isEnabled() || !dropTarget->acceptDrops() ||
        !ancestorHasClass(dropTarget, QStringLiteral("assets::Window"))) {
      fail(QStringLiteral("exact Assets drop target is not visible/enabled/drop-enabled"));
      return;
    }

    assetsWindow_ = assetsHits.front();
    treeWidget_ = treeHits.front();
    dropTarget_ = dropTarget;
    runCurrentStem();
  }

  void retryTopology(const QString &missing) {
    if (++topologyAttempts_ > kTopologyAttempts) {
      fail(QStringLiteral("bounded topology readiness timeout missing=%1").arg(missing));
      return;
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      this->pollTopology();
    });
  }

  QList<ExactAssetRow> exactVisibleRows(const QString &stem,
                                        bool *ambiguous) const {
    QList<ExactAssetRow> rows;
    int exactNameWidgets = 0;
    if (ambiguous) {
      *ambiguous = false;
    }
    if (!assetsWindow_) {
      if (ambiguous) {
        *ambiguous = true;
      }
      return rows;
    }
    for (QLineEdit *name :
         assetsWindow_->findChildren<QLineEdit *>()) {
      if (className(name) != QStringLiteral("EditableNodeName") ||
          !name->isVisibleTo(assetsWindow_) || name->text() != stem) {
        continue;
      }
      ++exactNameWidgets;
      QWidget *row = nullptr;
      for (QWidget *cursor = name->parentWidget();
           cursor && cursor != assetsWindow_;
           cursor = cursor->parentWidget()) {
        if (className(cursor) == QStringLiteral("SimpleRowWidget")) {
          row = cursor;
          break;
        }
      }
      if (!row || !row->isVisibleTo(assetsWindow_) ||
          row->width() < 1 || row->height() < 1) {
        if (ambiguous) {
          *ambiguous = true;
        }
        continue;
      }
      bool duplicate = false;
      for (const ExactAssetRow &existing : rows) {
        if (existing.row == row) {
          duplicate = true;
          break;
        }
      }
      if (duplicate) {
        if (ambiguous) {
          *ambiguous = true;
        }
        continue;
      }
      rows << ExactAssetRow{row, name};
    }
    if (exactNameWidgets != rows.size() && ambiguous) {
      *ambiguous = true;
    }
    return rows;
  }

  void runCurrentStem() {
    if (terminal_) {
      return;
    }
    if (stemIndex_ >= stems_.size()) {
      finish();
      return;
    }
    if (!assetsWindow_ || !treeWidget_ || !dropTarget_ ||
        !assetsWindow_->isVisible() ||
        !treeWidget_->isVisibleTo(assetsWindow_) ||
        !dropTarget_->isVisibleTo(assetsWindow_) ||
        !dropTarget_->acceptDrops()) {
      assetsWindow_.clear();
      treeWidget_.clear();
      dropTarget_.clear();
      topologyAttempts_ = 0;
      pollTopology();
      return;
    }
    const QString stem = stems_.at(stemIndex_);
    if (!verifyOwnerExternalEnglish(stem)) {
      return;
    }

    bool ambiguous = false;
    const QList<ExactAssetRow> before = exactVisibleRows(stem, &ambiguous);
    if (ambiguous || !before.isEmpty()) {
      fail(QStringLiteral("before exact visible row must be uniquely absent stem=%1 count=%2")
               .arg(stem)
               .arg(before.size()));
      return;
    }
    beforeRowCount_ = before.size();

    QMimeData mime;
    mime.setUrls({QUrl::fromLocalFile(fixtures_.at(stemIndex_))});
    const QPoint position = dropTarget_->rect().center();
    QDragEnterEvent dragEnter(position, Qt::CopyAction, &mime,
                              Qt::LeftButton, Qt::NoModifier);
    const bool dragDelivered =
        QApplication::sendEvent(dropTarget_, &dragEnter);
    QDropEvent drop(QPointF(position), Qt::CopyAction, &mime,
                    Qt::LeftButton, Qt::NoModifier);
    const bool dropDelivered = QApplication::sendEvent(dropTarget_, &drop);
    appendLog(
        QStringLiteral(
            "REPLACE_DROP stem=%1 target=%2 dragDelivered=%3 "
            "dragAccepted=%4 dropDelivered=%5 dropAccepted=%6")
            .arg(stem, className(dropTarget_))
            .arg(dragDelivered)
            .arg(dragEnter.isAccepted())
            .arg(dropDelivered)
            .arg(drop.isAccepted()));
    if (!dragDelivered || !dragEnter.isAccepted() ||
        !dropDelivered || !drop.isAccepted()) {
      fail(QStringLiteral("real QDropEvent was not delivered+accepted stem=%1")
               .arg(stem));
      return;
    }
    rowAttempts_ = 0;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      this->pollImportedRow();
    });
  }

  bool verifyOwnerExternalEnglish(const QString &stem) {
    QMenu unrelated;
    unrelated.setObjectName(
        QStringLiteral("CavalryI18nReplaceOwnerExternalNegative"));
    QAction *replace = unrelated.addAction(QStringLiteral("Replace..."));
    QAction *create = unrelated.addAction(
        QStringLiteral("Create Composition based on %1").arg(stem));
    unrelated.move(QPoint(-10000, -10000));
    unrelated.show();
    const bool pass =
        unrelated.isVisible() &&
        actionIsPaintedBy(replace, &unrelated) &&
        actionIsPaintedBy(create, &unrelated) &&
        replace->text() == QStringLiteral("Replace...") &&
        create->text() ==
            QStringLiteral("Create Composition based on %1").arg(stem);
    appendLog(
        QStringLiteral(
            "REPLACE_OWNER_EXTERNAL_NEGATIVE stem=%1 visible=%2 "
            "replace=%3 create=%4 pass=%5")
            .arg(stem)
            .arg(unrelated.isVisible())
            .arg(replace->text(), create->text())
            .arg(pass));
    unrelated.close();
    if (!pass) {
      fail(QStringLiteral("owner-external English QAction changed stem=%1")
               .arg(stem));
    }
    return pass;
  }

  void pollImportedRow() {
    if (terminal_) {
      return;
    }
    const QString stem = stems_.at(stemIndex_);
    bool ambiguous = false;
    const QList<ExactAssetRow> after = exactVisibleRows(stem, &ambiguous);
    if (ambiguous || after.size() > beforeRowCount_ + 1) {
      fail(QStringLiteral("after exact visible row ambiguous stem=%1 count=%2")
               .arg(stem)
               .arg(after.size()));
      return;
    }
    if (after.size() != beforeRowCount_ + 1) {
      if (++rowAttempts_ > kRowAttempts) {
        fail(QStringLiteral("before/after visible row delta is not +1 stem=%1 "
                            "before=%2 after=%3")
                 .arg(stem)
                 .arg(beforeRowCount_)
                 .arg(after.size()));
        return;
      }
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                     dispatch_get_main_queue(), ^{
        this->pollImportedRow();
      });
      return;
    }
    selectedRow_ = after.front().row;
    selectedName_ = after.front().name;
    if (!selectedRow_ || !selectedName_ ||
        selectedName_->text() != stem) {
      fail(QStringLiteral("exact imported row identity changed stem=%1").arg(stem));
      return;
    }
    appendLog(
        QStringLiteral(
            "REPLACE_ROW_DELTA stem=%1 before=%2 after=%3 rowClass=%4 "
            "nameClass=%5")
            .arg(stem)
            .arg(beforeRowCount_)
            .arg(after.size())
            .arg(className(selectedRow_), className(selectedName_)));
    dispatchWidgetClick(selectedRow_);
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 150 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      this->dispatchRealContextMenu();
    });
  }

  void dispatchRealContextMenu() {
    if (terminal_ || !selectedName_ || !treeWidget_ || !dropTarget_) {
      fail(QStringLiteral("selected asset row vanished before ContextMenu"));
      return;
    }
    const QString stem = stems_.at(stemIndex_);
    if (selectedName_->text() != stem ||
        !selectedName_->isVisibleTo(assetsWindow_) ||
        !ancestorHasClass(dropTarget_, QStringLiteral("assets::Window"))) {
      fail(QStringLiteral("selected exact row no longer visible stem=%1").arg(stem));
      return;
    }

    menuAttempts_ = 0;
    menuValidated_ = false;
    contextReturned_ = false;
    contextDelivered_ = false;
    contextAccepted_ = false;
    QTimer::singleShot(0, this, [this] { inspectPositiveMenu(); });

    const QPoint global =
        selectedName_->mapToGlobal(selectedName_->rect().center());
    const QPoint local = dropTarget_->mapFromGlobal(global);
    QContextMenuEvent contextEvent(QContextMenuEvent::Mouse, local, global);
    const bool delivered =
        QApplication::sendEvent(dropTarget_, &contextEvent);
    contextDelivered_ = delivered;
    contextAccepted_ = contextEvent.isAccepted();
    contextReturned_ = true;
    appendLog(
        QStringLiteral(
            "REPLACE_CONTEXT stem=%1 receiver=%2 delivered=%3 accepted=%4 "
            "global=%5,%6")
            .arg(stem, className(dropTarget_))
            .arg(delivered)
            .arg(contextAccepted_)
            .arg(global.x())
            .arg(global.y()));
    if (!delivered) {
      fail(QStringLiteral("real assets::Window ContextMenu was not delivered "
                          "stem=%1")
               .arg(stem));
      return;
    }
    if (menuValidated_) {
      completeStemWhenContextReturns();
    }
  }

  void inspectPositiveMenu() {
    if (terminal_ || menuValidated_) {
      return;
    }
    const QString stem = stems_.at(stemIndex_);
    const QString wantedReplace = oracle(QStringLiteral("replace"));
    const QString wantedCreate =
        oracle(QStringLiteral("create")).arg(stem);
    QStringList replaceCandidates = replaceTranslations();
    replaceCandidates << QStringLiteral("Replace...");
    QStringList createCandidates = createTranslations(stem);
    createCandidates
        << QStringLiteral("Create Composition based on %1").arg(stem);

    QList<QMenu *> candidateMenus;
    for (QWidget *top : QApplication::topLevelWidgets()) {
      QMenu *menu = qobject_cast<QMenu *>(top);
      if (!menu || !menu->isVisible()) {
        continue;
      }
      bool candidate = false;
      for (QAction *action : menu->actions()) {
        if (replaceCandidates.contains(action->text()) ||
            createCandidates.contains(action->text())) {
          candidate = true;
        }
      }
      if (candidate) {
        candidateMenus << menu;
      }
    }
    if (candidateMenus.size() > 1) {
      fail(QStringLiteral("visible target QMenu ambiguous stem=%1 count=%2")
               .arg(stem)
               .arg(candidateMenus.size()));
      return;
    }
    if (candidateMenus.isEmpty()) {
      if (++menuAttempts_ > kMenuAttempts) {
        fail(QStringLiteral("visible product QMenu timeout stem=%1").arg(stem));
        return;
      }
      QTimer::singleShot(
          50, this, [this] { inspectPositiveMenu(); });
      return;
    }

    QMenu *menu = candidateMenus.front();
    int replaceHits = 0;
    int createHits = 0;
    QStringList forbidden;
    for (QAction *action : menu->actions()) {
      const QString text = action->text();
      if (text == wantedReplace) {
        if (!actionIsPaintedBy(action, menu)) {
          fail(QStringLiteral("Replace QAction is not visible/enabled/associated"));
          return;
        }
        ++replaceHits;
      } else if (replaceCandidates.contains(text)) {
        forbidden << text;
      }
      if (text == wantedCreate) {
        if (!actionIsPaintedBy(action, menu)) {
          fail(QStringLiteral("Create QAction is not visible/enabled/associated"));
          return;
        }
        ++createHits;
      } else if (createCandidates.contains(text)) {
        forbidden << text;
      }
    }
    if (replaceHits != 1 || createHits != 1 || !forbidden.isEmpty()) {
      fail(QStringLiteral(
               "visible product QMenu must contain only current oracle "
               "stem=%1 replaceHits=%2 createHits=%3 forbidden=%4")
               .arg(stem)
               .arg(replaceHits)
               .arg(createHits)
               .arg(forbidden.join(QStringLiteral("|"))));
      return;
    }

    pendingReplaceCapture_ = {};
    pendingCreateCapture_ = {};
    if (!captureSurface(
            menu, menu, QStringLiteral("replace-%1").arg(stem), wantedReplace,
            &pendingReplaceCapture_,
            {{"logicalSurface", "replace"},
             {"ownerClass", className(assetsWindow_)},
             {"producerReceiverClass", className(dropTarget_)},
             {"ownerExternalUnchanged", true},
             {"source", "Replace..."},
             {"fixtureStem", stem}}) ||
        !captureSurface(
            menu, menu, QStringLiteral("create-%1").arg(stem), wantedCreate,
            &pendingCreateCapture_,
            {{"logicalSurface", "create"},
             {"ownerClass", className(assetsWindow_)},
             {"producerReceiverClass", className(dropTarget_)},
             {"ownerExternalUnchanged", true},
             {"sourceTemplate", "Create Composition based on %1"},
             {"fixtureStem", stem}})) {
      fail(QStringLiteral("Replace/Create exact menu capture stem=%1").arg(stem));
      return;
    }
    menuValidated_ = true;
    appendLog(
        QStringLiteral(
            "REPLACE_MENU_PASS stem=%1 class=%2 replace=%3 create=%4")
            .arg(stem, className(menu), wantedReplace, wantedCreate));
    QMenu *rootMenu = menu;
    while (QMenu *parentMenu =
               qobject_cast<QMenu *>(rootMenu->parentWidget())) {
      rootMenu = parentMenu;
    }
    rootMenu->close();
    QTimer::singleShot(
        0, this, [this] { completeStemWhenContextReturns(); });
  }

  void completeStemWhenContextReturns() {
    if (terminal_ || !menuValidated_) {
      return;
    }
    if (!contextReturned_) {
      QTimer::singleShot(
          20, this, [this] { completeStemWhenContextReturns(); });
      return;
    }
    if (!contextDelivered_ || !contextAccepted_) {
      fail(QStringLiteral("ContextMenu returned without delivery+acceptance"));
      return;
    }
    const QString stem = stems_.at(stemIndex_);
    bool ambiguous = false;
    const QList<ExactAssetRow> rows = exactVisibleRows(stem, &ambiguous);
    if (ambiguous || rows.size() != beforeRowCount_ + 1 ||
        rows.size() != 1) {
      fail(QStringLiteral("exact asset row drifted after menu stem=%1 count=%2")
               .arg(stem)
               .arg(rows.size()));
      return;
    }
    // 同一 Show 既可能在嵌套菜单循环内完成，也可能在 sendEvent 返回后完成；
    // 先消费本轮令牌，避免两条回调重复提交同一 stem。
    menuValidated_ = false;
    const QPoint childOrigin = rows.front().row->mapToGlobal(QPoint());
    const QPoint topOrigin = assetsWindow_->mapToGlobal(QPoint());
    observations_.append(
        QJsonObject{
            {"stem", stem},
            {"fixture", fixtures_.at(stemIndex_)},
            {"beforeExactVisibleRows", beforeRowCount_},
            {"afterExactVisibleRows", rows.size()},
            {"dropDelivered", true},
            {"dropAccepted", true},
            {"contextDelivered", contextDelivered_},
            {"contextAccepted", contextAccepted_},
            {"producerOwnerClass", className(assetsWindow_)},
            {"producerReceiverClass", className(dropTarget_)},
            {"replaceObserved", oracle(QStringLiteral("replace"))},
            {"createObserved", oracle(QStringLiteral("create")).arg(stem)},
            {"replaceCapture", pendingReplaceCapture_},
            {"createCapture", pendingCreateCapture_},
            {"rowClass", className(rows.front().row)},
            {"nameClass", className(rows.front().name)},
            {"childRect",
             QJsonObject{{"x", childOrigin.x()},
                         {"y", childOrigin.y()},
                         {"width", rows.front().row->width()},
                         {"height", rows.front().row->height()}}},
            {"topRect",
             QJsonObject{{"x", topOrigin.x()},
                         {"y", topOrigin.y()},
                         {"width", assetsWindow_->width()},
                         {"height", assetsWindow_->height()}}},
        });
    ++stemIndex_;
    selectedRow_.clear();
    selectedName_.clear();
    pendingReplaceCapture_ = {};
    pendingCreateCapture_ = {};
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 150 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      this->runCurrentStem();
    });
  }

  void closeVisibleMenus() {
    for (QWidget *top : QApplication::topLevelWidgets()) {
      if (QMenu *menu = qobject_cast<QMenu *>(top);
          menu && menu->isVisible()) {
        menu->close();
      }
    }
  }

  void finish() {
    if (terminal_) {
      return;
    }
    if (observations_.size() != 2) {
      fail(QStringLiteral("dual-stem observation completeness"));
      return;
    }
    terminal_ = true;
    QJsonArray replaceVariants;
    QJsonArray createVariants;
    for (const QJsonValue &value : observations_) {
      const QJsonObject observation = value.toObject();
      replaceVariants.append(
          observation.value(QStringLiteral("replaceCapture")));
      createVariants.append(
          observation.value(QStringLiteral("createCapture")));
    }
    const QJsonObject lastReplace = replaceVariants.last().toObject();
    const QJsonObject lastCreate = createVariants.last().toObject();
    const QJsonObject replaceResult{
        {"surface", "replace"},
        {"owner", "assets::Window"},
        {"text", oracle(QStringLiteral("replace"))},
        {"observedStems",
         QJsonArray{QStringLiteral("replace-source"),
                    QStringLiteral("dynamic-proof-two")}},
        {"variants", replaceVariants},
        {"target", lastReplace.value(QStringLiteral("target"))},
    };
    const QJsonObject createResult{
        {"surface", "create"},
        {"owner", "assets::Window"},
        {"template", oracle(QStringLiteral("create"))},
        {"dualStemObserved", observations_},
        {"variants", createVariants},
        {"target", lastCreate.value(QStringLiteral("target"))},
    };
    finishOnce(
        QStringLiteral(
            "OK Replace/Create dual real drops exact owner current-language"),
        QJsonArray{replaceResult, createResult});
  }
};

void runReplaceScenario() {
  if (!exposeMainWindow() || !qApp) return;
  auto *flow = new ReplaceAcceptanceFlow(qApp);
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0),
                 dispatch_get_main_queue(), ^{
    flow->start();
  });
}
