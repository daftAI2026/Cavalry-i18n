/**
 * [INPUT]: SearchBar、MainDock 的 Window 菜单、Scene Statistics、TagHeader 触发器与 PopOverView 结果 owner 的真实 Qt 控件拓扑。
 * [OUTPUT]: 以目标控件有界就绪代替固定延时，通过真实 Window 菜单打开统计窗口，先守卫同窗 GroupButton 的唯一 Update 标签，再产出 Add Layer、三项统计、Add Tag 与 Assign Tag 的逐语言像素证据及阶段诊断。
 * [POS]: 主验收的普通 Qt owner-scoped 场景；同文负例必须脱离产品 owner，统计截图同时约束可见相邻按钮。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
QString normalizedMenuText(QString text) {
  return text.remove(QLatin1Char('&')).trimmed();
}

bool uniqueWindowMenu(QMenuBar **menuBarResult, QAction **actionResult,
                      QMenu **menuResult) {
  if (!menuBarResult || !actionResult || !menuResult) return false;
  *menuBarResult = nullptr;
  *actionResult = nullptr;
  *menuResult = nullptr;

  QWidget *mainDock = nullptr;
  for (QWidget *widget : QApplication::allWidgets()) {
    if (!widget || !widget->isVisible() ||
        className(widget) != QStringLiteral("MainDock")) {
      continue;
    }
    if (mainDock) return false;
    mainDock = widget;
  }
  if (!mainDock) return false;

  const QString expected = oracle(QStringLiteral("window"));
  for (QWidget *widget : QApplication::allWidgets()) {
    QMenuBar *candidateBar = qobject_cast<QMenuBar *>(widget);
    if (!candidateBar || !candidateBar->isEnabled()) continue;
    for (QAction *candidateAction : candidateBar->actions()) {
      QMenu *candidateMenu = candidateAction ? candidateAction->menu() : nullptr;
      if (!candidateMenu || !candidateAction->isEnabled() ||
          !candidateAction->associatedObjects().contains(candidateBar) ||
          candidateMenu->parent() != mainDock ||
          normalizedMenuText(candidateAction->text()) != expected ||
          normalizedMenuText(candidateMenu->title()) != expected) {
        continue;
      }
      if (*menuResult) return false;
      *menuBarResult = candidateBar;
      *actionResult = candidateAction;
      *menuResult = candidateMenu;
    }
  }
  return *menuBarResult && *actionResult && *menuResult;
}

QAction *uniqueSceneStatisticsAction(QMenu *windowMenu) {
  QAction *result = nullptr;
  if (!windowMenu) return nullptr;
  const QString expected = oracle(QStringLiteral("sceneStatistics"));
  for (QAction *action : windowMenu->actions()) {
    if (!action || !action->isEnabled() || !action->isVisible() ||
        action->isSeparator() ||
        !action->associatedObjects().contains(windowMenu) ||
        normalizedMenuText(action->text()) != expected) {
      continue;
    }
    if (result) return nullptr;
    result = action;
  }
  return result;
}

QList<QWidget *> projectStatisticsWindows() {
  QList<QWidget *> result;
  for (QWidget *widget : QApplication::allWidgets()) {
    if (widget &&
        className(widget) == QStringLiteral("ProjectStatisticsWindow") &&
        ancestorHasClass(widget, QStringLiteral("MainDock"))) {
      result << widget;
    }
  }
  return result;
}

void triggerStatisticsAndCapture(QAction *action,
                                 const QJsonArray &seedResults,
                                 bool workspaceVisibleInitially) {
  const QJsonArray capturedSeed = seedResults;
  QPointer<QAction> guardedAction(action);
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 300 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{
    const QList<QWidget *> windows = projectStatisticsWindows();
    if (!guardedAction || windows.size() != 1 || !windows.front()->isVisible()) {
      markDone(QStringLiteral("ERROR Scene Statistics real operation failed"));
      return;
    }
    QWidget *owner = windows.front();
    if (owner->windowTitle() != oracle(QStringLiteral("sceneStatistics"))) {
      markDone(QStringLiteral(
          "ERROR Scene Statistics current-language window title"));
      return;
    }
    QList<QLabel *> updateLabels;
    const QString expectedUpdate = oracle(QStringLiteral("statUpdate"));
    for (QLabel *label : owner->findChildren<QLabel *>()) {
      QWidget *groupButton = label ? label->parentWidget() : nullptr;
      if (label && label->isVisibleTo(owner) &&
          label->text() == expectedUpdate && groupButton &&
          className(groupButton) == QStringLiteral("GroupButton") &&
          groupButton->parentWidget() == owner &&
          groupButton->isVisibleTo(owner) && groupButton->isEnabled()) {
        updateLabels << label;
      }
    }
    if (expectedUpdate.isEmpty() || updateLabels.size() != 1) {
      appendLog(
          QStringLiteral(
              "SEARCH_STAGE statistics-update-miss expected=%1 count=%2")
              .arg(expectedUpdate)
              .arg(updateLabels.size()));
      markDone(QStringLiteral(
          "ERROR Scene Statistics Update exact GroupButton label"));
      return;
    }
    struct Statistic {
      const char *key;
      const char *surface;
      const char *source;
    };
    static const Statistic statistics[] = {
        {"stat1", "statistics-compute-time", "Compute Time:"},
        {"stat2", "statistics-draw-time", "Draw Time:"},
        {"stat3", "statistics-total-nodes", "Total Nodes:"}};
    QJsonArray results = capturedSeed;
    for (const Statistic &statistic : statistics) {
      const QString key = QString::fromLatin1(statistic.key);
      QLabel *label = uniqueExactLabel(owner, oracle(key));
      const bool negativeUnchanged = syntheticLabelRemainsEnglish(
          QString::fromLatin1(statistic.source));
      if (!label || !negativeUnchanged) {
        appendLog(
            QStringLiteral(
                "SEARCH_STAGE statistics-miss key=%1 label=%2 negative=%3 "
                "owner-visible=%4")
                .arg(key)
                .arg(label ? QStringLiteral("found") : QStringLiteral("missing"))
                .arg(negativeUnchanged)
                .arg(owner->isVisible()));
        QWidget diagnosticOwner;
        diagnosticOwner.setObjectName(
            QStringLiteral("acceptance-owner-external-diagnostic"));
        QLabel diagnosticLabel(
            QString::fromLatin1(statistic.source), &diagnosticOwner);
        QPaintEvent diagnosticPaint(diagnosticLabel.rect());
        QApplication::sendEvent(&diagnosticLabel, &diagnosticPaint);
        appendLog(
            QStringLiteral("SEARCH_STAGE statistics-negative-after=%1")
                .arg(diagnosticLabel.text()));
        for (QLabel *candidate : owner->findChildren<QLabel *>()) {
          appendLog(
              QStringLiteral(
                  "SEARCH_STAGE statistics-label text=%1 visible=%2 "
                  "visible-to-owner=%3")
                  .arg(candidate->text())
                  .arg(candidate->isVisible())
                  .arg(candidate->isVisibleTo(owner)));
        }
        markDone(
            QStringLiteral("ERROR Statistics exact label/negative control %1")
                .arg(key));
        return;
      }
      QJsonObject result;
      if (!captureSurface(
              label, owner, QString::fromLatin1(statistic.surface),
              oracle(key), &result,
              {{"ownerClass", "ProjectStatisticsWindow"},
               {"ownerExternalUnchanged", true},
               {"source", QString::fromLatin1(statistic.source)},
               {"navigation", "Window > Scene Statistics"},
               {"workspaceVisibleInitially", workspaceVisibleInitially}})) {
        markDone(QStringLiteral("ERROR Statistics capture %1").arg(key));
        return;
      }
      results.append(result);
    }
    if (results.size() != 4) {
      markDone(QStringLiteral("ERROR Search four-surface completeness"));
      return;
    }
    finishOnce(
        QStringLiteral("OK Search tooltip plus Statistics exact labels"),
        results);
  });
  action->trigger();
}

void continueSearchWithStatistics(const QJsonArray &seedResults) {
  const QJsonArray capturedSeed = seedResults;
  QMenuBar *menuBar = nullptr;
  QAction *windowAction = nullptr;
  QMenu *windowMenu = nullptr;
  if (!uniqueWindowMenu(&menuBar, &windowAction, &windowMenu)) {
    markDone(QStringLiteral(
        "ERROR Window menu topology/current-language contract"));
    return;
  }

  const QRect windowActionGeometry = menuBar->actionGeometry(windowAction);
  const bool widgetGeometryAvailable =
      windowActionGeometry.isValid() && !windowActionGeometry.isEmpty();
  const QPoint popupAnchor =
      widgetGeometryAvailable
          ? menuBar->mapToGlobal(windowActionGeometry.bottomLeft())
          : QCursor::pos();
  appendLog(QStringLiteral("SEARCH_STAGE window-menu-popup anchor=%1")
                .arg(widgetGeometryAvailable
                         ? QStringLiteral("menubar-action")
                         : QStringLiteral("native-menubar-cursor")));
  QPointer<QMenu> guardedWindowMenu(windowMenu);
  windowMenu->popup(popupAnchor);
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 250 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{
    if (!guardedWindowMenu) {
      markDone(QStringLiteral("ERROR Window menu destroyed during open"));
      return;
    }
    QAction *statisticsAction =
        uniqueSceneStatisticsAction(guardedWindowMenu.data());
    if (!statisticsAction) {
      markDone(QStringLiteral(
          "ERROR Scene Statistics unavailable after real Window menu open"));
      return;
    }
    const QList<QWidget *> windowsBefore = projectStatisticsWindows();
    if (windowsBefore.size() > 1) {
      markDone(QStringLiteral("ERROR ProjectStatisticsWindow ambiguous"));
      return;
    }
    const bool visibleBefore =
        windowsBefore.size() == 1 && windowsBefore.front()->isVisible();
    appendLog(
        QStringLiteral(
            "SEARCH_STAGE statistics-action checkable=%1 checked=%2 "
            "workspace-visible=%3")
            .arg(statisticsAction->isCheckable())
            .arg(statisticsAction->isChecked())
            .arg(visibleBefore));
    guardedWindowMenu->hide();
    triggerStatisticsAndCapture(
        statisticsAction, capturedSeed, visibleBefore);
  });
}

void inspectSearchWhenReady(int attempt = 0) {
  QWidget *addButton = nullptr;
  for (QWidget *widget : QApplication::allWidgets()) {
    if (!widget || !widget->isVisible() || !widget->isEnabled() ||
        !ancestorHasClass(widget, QStringLiteral("SearchBarContainerWidget")) ||
        !exactCurrent(widget->toolTip(), QStringLiteral("search"))) {
      continue;
    }
    if (addButton) {
      markDone(QStringLiteral("ERROR Add Layer tooltip ambiguous"));
      return;
    }
    addButton = widget;
  }
  if (!addButton) {
    if (attempt >= 50) {
      appendLog(QStringLiteral(
          "SEARCH_STAGE add-button=<missing> bounded-attempts=%1")
                    .arg(attempt));
      markDone(QStringLiteral("ERROR Add Layer bounded readiness timeout"));
      return;
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      inspectSearchWhenReady(attempt + 1);
    });
    return;
  }
  appendLog(QStringLiteral("SEARCH_STAGE add-button=%1 ready-attempt=%2")
                .arg(className(addButton))
                .arg(attempt));
  appendLog(QStringLiteral("SEARCH_STAGE synthetic-negative-start"));
  const bool syntheticUnchanged = syntheticLabelRemainsEnglish(
      QStringLiteral("Add a layer to your Composition (⌘.)"));
  appendLog(QStringLiteral("SEARCH_STAGE synthetic-negative=%1")
                .arg(syntheticUnchanged));
  if (!syntheticUnchanged) {
    markDone(QStringLiteral("ERROR Add Layer owner/current-language contract"));
    return;
  }

  const QPoint local = addButton->rect().center();
  const QPoint global = addButton->mapToGlobal(local);
  QHelpEvent help(QEvent::ToolTip, local, global);
  appendLog(QStringLiteral("SEARCH_STAGE tooltip-send-start"));
  QApplication::sendEvent(addButton, &help);
  appendLog(QStringLiteral("SEARCH_STAGE tooltip-send-done"));
  QLabel *tip = nullptr;
  for (QWidget *top : QApplication::topLevelWidgets()) {
    QLabel *label = qobject_cast<QLabel *>(top);
    if (!label || className(label) != QStringLiteral("QTipLabel") ||
        !label->isVisible() || label->text() != oracle(QStringLiteral("search"))) {
      continue;
    }
    if (tip) {
      markDone(QStringLiteral("ERROR Add Layer visible QTipLabel ambiguous"));
      return;
    }
    tip = label;
  }
  appendLog(QStringLiteral("SEARCH_STAGE tooltip=%1")
                .arg(tip ? tip->text() : QStringLiteral("<missing>")));
  appendLog(QStringLiteral("SEARCH_STAGE tooltip-capture-start"));
  if (!tip) {
    markDone(QStringLiteral("ERROR Add Layer visible tooltip capture"));
    return;
  }
  QJsonObject addResult;
  if (!captureSurface(
          tip, tip, QStringLiteral("add-layer-tooltip"),
          oracle(QStringLiteral("search")), &addResult,
          {{"ownerClass", "SearchBarContainerWidget"},
           {"ownerExternalUnchanged", true},
           {"triggerClass", className(addButton)}})) {
    markDone(QStringLiteral("ERROR Add Layer visible tooltip capture"));
    return;
  }
  QJsonArray results;
  results.append(addResult);
  tip->hide();
  continueSearchWithStatistics(results);
}

void runSearchScenario() {
  if (!exposeMainWindow()) return;
  appendLog(QStringLiteral("SEARCH_STAGE scheduled"));
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{
    inspectSearchWhenReady();
  });
}

void runAddTagScenario() {
  if (!exposeMainWindow()) return;
  // Tag 模块晚于 MainDock 完成信号连接；沿用旧三语实机采证的启动稳定窗。
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 3500 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{
    QWidget *header = nullptr;
    for (QWidget *widget : QApplication::allWidgets()) {
      if (widget && className(widget) == QStringLiteral("cavalry::TagHeader") &&
          widget->isVisible()) {
        if (header) {
          markDone(QStringLiteral("ERROR TagHeader ambiguous"));
          return;
        }
        header = widget;
      }
    }
    const QList<QWidget *> buttons =
        directVisibleEnabled(header, QStringLiteral("GroupButton"));
    QList<QWidget *> addButtons;
    const QString expectedButton = oracle(QStringLiteral("tagButton"));
    for (QWidget *candidate : buttons) {
      if (candidate->toolTip() == expectedButton) addButtons << candidate;
    }
    const bool addNegative =
        syntheticLabelRemainsEnglish(QStringLiteral("Add Tag:"));
    const bool assignNegative = syntheticLabelRemainsEnglish(
        QStringLiteral("Assign Tag to Selection: "));
    appendLog(
        QStringLiteral(
            "TAG_STAGE header=%1 buttons=%2 add-buttons=%3 add-negative=%4 "
            "assign-negative=%5")
            .arg(header ? QStringLiteral("found") : QStringLiteral("missing"))
            .arg(buttons.size())
            .arg(addButtons.size())
            .arg(addNegative)
            .arg(assignNegative));
    if (!header || addButtons.size() != 1 || !addNegative || !assignNegative) {
      markDone(QStringLiteral("ERROR TagHeader topology/negative controls"));
      return;
    }
    QWidget *button = addButtons.front();
    const bool invoked =
        QMetaObject::invokeMethod(button, "click", Qt::DirectConnection);
    bool pressAccepted = false;
    bool releaseAccepted = false;
    if (!invoked) {
      const QPointF local(button->rect().center());
      const QPointF global(
          button->mapToGlobal(button->rect().center()));
      QMouseEvent press(QEvent::MouseButtonPress, local, global, Qt::LeftButton,
                        Qt::LeftButton, Qt::NoModifier);
      QMouseEvent release(QEvent::MouseButtonRelease, local, global,
                          Qt::LeftButton, Qt::NoButton, Qt::NoModifier);
      pressAccepted = QApplication::sendEvent(button, &press);
      releaseAccepted = QApplication::sendEvent(button, &release);
    }
    appendLog(QStringLiteral(
                  "TAG_STAGE click invoked=%1 press=%2 release=%3 tooltip=%4 "
                  "geometry=%5x%6 global=%7,%8")
                  .arg(invoked)
                  .arg(pressAccepted)
                  .arg(releaseAccepted)
                  .arg(button->toolTip())
                  .arg(button->width())
                  .arg(button->height())
                  .arg(button->mapToGlobal(QPoint(0, 0)).x())
                  .arg(button->mapToGlobal(QPoint(0, 0)).y()));

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 1200 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      QList<QWidget *> owners;
      QLabel *addLabel = nullptr;
      QLabel *assignLabel = nullptr;
      for (QWidget *candidate : QApplication::allWidgets()) {
        if (!candidate || className(candidate) != QStringLiteral("PopOverView") ||
            !candidate->isVisible() ||
            !ancestorHasClass(candidate, QStringLiteral("MainDock"))) {
          continue;
        }
        QLabel *candidateAdd =
            uniqueExactLabel(candidate, oracle(QStringLiteral("tagAdd")));
        QLabel *candidateAssign =
            uniqueExactLabel(candidate, oracle(QStringLiteral("tagAssign")));
        if (!candidateAdd || !candidateAssign) continue;
        owners << candidate;
        addLabel = candidateAdd;
        assignLabel = candidateAssign;
      }
      if (owners.size() != 1 || !addLabel || !assignLabel) {
        appendLog(
            QStringLiteral(
                "TAG_STAGE popover-match owners=%1 add=%2 assign=%3")
                .arg(owners.size())
                .arg(addLabel ? QStringLiteral("found")
                              : QStringLiteral("missing"))
                .arg(assignLabel ? QStringLiteral("found")
                                 : QStringLiteral("missing")));
        for (QWidget *candidate : QApplication::allWidgets()) {
          if (!candidate ||
              className(candidate) != QStringLiteral("PopOverView")) {
            continue;
          }
          appendLog(
              QStringLiteral(
                  "TAG_STAGE popover visible=%1 main-dock=%2 add=%3 assign=%4")
                  .arg(candidate->isVisible())
                  .arg(ancestorHasClass(candidate, QStringLiteral("MainDock")))
                  .arg(uniqueExactLabel(
                           candidate, oracle(QStringLiteral("tagAdd")))
                           ? QStringLiteral("found")
                           : QStringLiteral("missing"))
                  .arg(uniqueExactLabel(
                           candidate, oracle(QStringLiteral("tagAssign")))
                           ? QStringLiteral("found")
                           : QStringLiteral("missing")));
        }
        for (QLabel *candidate :
             qApp->findChildren<QLabel *>()) {
          if (candidate->text() != oracle(QStringLiteral("tagAdd")) &&
              candidate->text() != oracle(QStringLiteral("tagAssign"))) {
            continue;
          }
          appendLog(
              QStringLiteral(
                  "TAG_STAGE exact-label text=%1 visible=%2 parent=%3 "
                  "popover-ancestor=%4")
                  .arg(candidate->text())
                  .arg(candidate->isVisible())
                  .arg(className(candidate->parentWidget()))
                  .arg(ancestorHasClass(candidate,
                                        QStringLiteral("PopOverView"))));
        }
        markDone(QStringLiteral("ERROR Tag Add/Assign exact owner postcondition"));
        return;
      }
      QWidget *owner = owners.front();
      QWidget *window = owner->window();
      QJsonArray results;
      QJsonObject addResult;
      QJsonObject assignResult;
      if (!captureSurface(addLabel, window, QStringLiteral("tag-add"),
                          oracle(QStringLiteral("tagAdd")), &addResult,
                          {{"ownerClass", "PopOverView"},
                           {"triggerOwnerClass", "cavalry::TagHeader"},
                           {"triggerToolTip", expectedButton},
                           {"directButtonCount", buttons.size()},
                           {"ownerExternalUnchanged", true},
                           {"source", "Add Tag:"}}) ||
          !captureSurface(assignLabel, window, QStringLiteral("tag-assign"),
                          oracle(QStringLiteral("tagAssign")), &assignResult,
                          {{"ownerClass", "PopOverView"},
                           {"triggerOwnerClass", "cavalry::TagHeader"},
                           {"triggerToolTip", expectedButton},
                           {"directButtonCount", buttons.size()},
                           {"ownerExternalUnchanged", true},
                           {"source", "Assign Tag to Selection: "}})) {
        markDone(QStringLiteral("ERROR Tag Add/Assign capture"));
        return;
      }
      results.append(addResult);
      results.append(assignResult);
      finishOnce(QStringLiteral("OK TagHeader trigger and PopOverView exact Add/Assign owner scoped"),
                 results);
    });
  });
}
