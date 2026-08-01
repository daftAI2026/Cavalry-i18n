/**
 * [INPUT]: ColorWindow 的 TabBarHeader、当前语言 Generator TabItem、当前页 GroupButton 与 owner-scoped QMenu。
 * [OUTPUT]: 真实 Generator options 菜单中 Save QAction 的当前语言像素证据。
 * [POS]: 主验收的 Color Save 场景；Generator 入口由当前语言 tooltip 锁定，菜单 owner 由 ColorWindow 父系锁定。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
QObject *nearestAncestorWithClass(QObject *object, const QString &klass) {
  for (QObject *cursor = object ? object->parent() : nullptr; cursor;
       cursor = cursor->parent()) {
    if (className(cursor) == klass) return cursor;
  }
  return nullptr;
}

void inspectSaveMenuWhenVisible(int attempt = 0) {
  const QStringList allSave{QStringLiteral("Save..."), QStringLiteral("Save…"),
                            QStringLiteral("保存…"), QStringLiteral("儲存…")};
  QList<QMenu *> candidates;
  for (QWidget *top : QApplication::topLevelWidgets()) {
    QMenu *menu = qobject_cast<QMenu *>(top);
    if (!menu || !menu->isVisible()) continue;
    bool targetLike = false;
    for (QAction *action : menu->actions())
      targetLike = targetLike || (action && allSave.contains(action->text()));
    if (!targetLike) continue;
    if (!ancestorHasClass(menu, QStringLiteral("ColorWindow"))) {
      markDone(QStringLiteral("ERROR Save target-like menu escaped ColorWindow"));
      return;
    }
    candidates << menu;
  }
  if (candidates.isEmpty()) {
    if (attempt >= 100) {
      markDone(QStringLiteral("ERROR Save exact menu bounded timeout"));
      return;
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 50 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      inspectSaveMenuWhenVisible(attempt + 1);
    });
    return;
  }
  if (candidates.size() != 1) {
    markDone(QStringLiteral("ERROR Save visible menu ambiguous"));
    return;
  }
  QMenu *menu = candidates.front();
  QList<QAction *> hits;
  QStringList forbidden;
  for (QAction *action : menu->actions()) {
    if (!action || !allSave.contains(action->text())) continue;
    if (action->text() == oracle(QStringLiteral("save")) &&
        action->isVisible() && action->isEnabled() &&
        action->associatedObjects().contains(menu))
      hits << action;
    else
      forbidden << action->text();
  }
  if (hits.size() != 1 || !forbidden.isEmpty()) {
    markDone(QStringLiteral("ERROR Save current-language QAction uniqueness"));
    menu->close();
    return;
  }
  QJsonObject result;
  if (!captureSurface(menu, menu, QStringLiteral("save"),
                      oracle(QStringLiteral("save")), &result,
                      {{"ownerClass", "ColorWindow"},
                       {"ownerExternalUnchanged", true},
                       {"source", "Save..."}})) {
    markDone(QStringLiteral("ERROR Save menu capture"));
    menu->close();
    return;
  }
  menu->close();
  finishOnce(QStringLiteral("OK ColorWindow generator Save exact QAction"),
             QJsonArray{result});
}

void runSaveScenario() {
  if (!exposeMainWindow() || !qApp ||
      !syntheticMenuActionRemainsEnglish(QStringLiteral("Save..."))) {
    if (qApp) markDone(QStringLiteral("ERROR Save owner-external negative"));
    return;
  }
  // Color 页签与 Tag 模块相同，晚于 MainDock 完成内部信号连接。
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 3500 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{
    QWidget *color = nullptr;
    for (QWidget *widget : QApplication::allWidgets()) {
      if (!widget || className(widget) != QStringLiteral("ColorWindow") ||
          !widget->isVisible()) {
        continue;
      }
      if (color) {
        markDone(QStringLiteral("ERROR ColorWindow ambiguous"));
        return;
      }
      color = widget;
    }
    QWidget *header = nullptr;
    if (color) {
      for (QWidget *widget : color->findChildren<QWidget *>()) {
        if (className(widget) == QStringLiteral("TabBarHeader") &&
            widget->isVisibleTo(color)) {
          if (header) {
            markDone(QStringLiteral("ERROR ColorWindow TabBarHeader ambiguous"));
            return;
          }
          header = widget;
        }
      }
    }
    QList<QWidget *> tabs;
    if (header) {
      for (QWidget *widget : header->findChildren<QWidget *>()) {
        if (className(widget) == QStringLiteral("TabItem") &&
            widget->isVisibleTo(header) && widget->isEnabled() &&
            exactCurrent(widget->toolTip(), QStringLiteral("generator")) &&
            nearestAncestorWithClass(widget, QStringLiteral("TabBarHeader")) ==
                header) {
          tabs << widget;
        }
      }
    }
    appendLog(QStringLiteral(
                  "SAVE_STAGE color=%1 header=%2 generator-tabs=%3")
                  .arg(color ? QStringLiteral("found")
                             : QStringLiteral("missing"))
                  .arg(header ? QStringLiteral("found")
                              : QStringLiteral("missing"))
                  .arg(tabs.size()));
    if (!color || !header || tabs.size() != 1) {
      markDone(QStringLiteral(
          "ERROR ColorWindow current-language Generator TabItem topology"));
      return;
    }
    dispatchWidgetClick(tabs.front());
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 300 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      QList<QWidget *> options;
      const int headerBottom =
          header->mapToGlobal(QPoint(0, header->height())).y();
      for (QWidget *widget : color->findChildren<QWidget *>()) {
        if (className(widget) == QStringLiteral("GroupButton") &&
            widget->isVisibleTo(color) && widget->isEnabled() &&
            !ancestorHasClass(widget, QStringLiteral("TabBarHeader")) &&
            widget->mapToGlobal(QPoint()).y() > headerBottom) {
          options << widget;
        }
      }
      appendLog(
          QStringLiteral("SAVE_STAGE generator-options=%1").arg(options.size()));
      if (options.size() != 1) {
        markDone(QStringLiteral("ERROR active generator page unique GroupButton"));
        return;
      }
      // QMenu::exec() 会阻塞当前 GCD 回调；Qt timer 才能进入菜单的嵌套事件循环。
      QTimer::singleShot(0, qApp, [] { inspectSaveMenuWhenVisible(); });
      dispatchWidgetClick(options.front());
    });
  });
}
