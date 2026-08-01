/**
 * [INPUT]: Qt 完整对象图与事件循环、Qt/native 菜单、OnboardingChoiceView 与 Cavalry 2.7.2 的 onboarding C++ ABI。
 * [OUTPUT]: 通过 manager、真实入门指南菜单或 choice signal 语义触发 firstLaunch guide，并在内容契约失败时输出可证伪拓扑。
 * [POS]: supplemental onboarding 的入口解析器；只负责非重入地打开真实产品 guide 和记录失败事实，不构造验收 UI。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
bool isGuideActionText(QString title) {
  title.remove(QLatin1Char('&'));
  title = title.trimmed();
  return title == QStringLiteral("Getting Started Guides") ||
         title == QStringLiteral("入门指南") ||
         title == QStringLiteral("入門指南") ||
         title == QStringLiteral("スタートガイド");
}

QObject *findOnboardingManager() {
  QSet<QObject *> seen;
  QList<QObject *> objects;
  if (qApp) {
    objects << qApp;
    objects.append(qApp->findChildren<QObject *>());
  }
  for (QWidget *widget : QApplication::allWidgets()) {
    if (!widget) continue;
    objects << widget;
    objects.append(widget->findChildren<QObject *>());
  }
  for (QObject *object : objects) {
    if (!object || seen.contains(object)) continue;
    seen.insert(object);
    if (!className(object).contains(QStringLiteral("OnboardingManager")))
      continue;
    appendLog(
        QStringLiteral("ONBOARDING_MANAGER class=%1 parent=%2 scanned=%3")
            .arg(className(object), className(object->parent()))
            .arg(seen.size()));
    return object;
  }
  return nullptr;
}

bool triggerFirstLaunchGuide() {
  QObject *manager = findOnboardingManager();
  const char *symbol =
      "_ZN10onboarding17OnboardingManager9showGuideERKNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE";
  void *raw = manager ? dlsym(RTLD_DEFAULT, symbol) : nullptr;
  if (!manager || !raw) return false;
  using ShowGuide = void (*)(void *, const std::string &);
  reinterpret_cast<ShowGuide>(raw)(
      manager, std::string("firstLaunch"));
  appendLog(QStringLiteral("ONBOARDING_TRIGGER manager id=firstLaunch"));
  return true;
}

bool triggerFirstLaunchFromChoiceView() {
  for (QWidget *widget : QApplication::allWidgets()) {
    if (!widget || !widget->isVisible() ||
        !className(widget).contains(QStringLiteral("OnboardingChoiceView"))) {
      continue;
    }
    const char *symbol =
        "_ZN10onboarding20OnboardingChoiceView13guideSelectedERKNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE";
    void *raw = dlsym(RTLD_DEFAULT, symbol);
    if (!raw) return false;
    using GuideSelected = void (*)(void *, const std::string &);
    const QString choiceClass = className(widget);
    reinterpret_cast<GuideSelected>(raw)(
        widget, std::string("firstLaunch"));
    appendLog(
        QStringLiteral(
            "ONBOARDING_TRIGGER choice-view class=%1 id=firstLaunch")
            .arg(choiceClass));
    return true;
  }
  return false;
}

bool triggerGuideInQtActions() {
  QSet<QAction *> seen;
  for (QWidget *widget : QApplication::allWidgets()) {
    if (!widget) continue;
    QList<QAction *> actions = widget->actions();
    actions.append(widget->findChildren<QAction *>());
    for (QAction *action : actions) {
      if (!action || seen.contains(action)) continue;
      seen.insert(action);
      if (!action->isEnabled() || !isGuideActionText(action->text()))
        continue;
      const QString text = action->text();
      const QPointer<QAction> guarded(action);
      QTimer::singleShot(0, qApp, [guarded] {
        if (guarded) guarded->trigger();
      });
      appendLog(
          QStringLiteral("ONBOARDING_TRIGGER qt-action-queued text=%1 parent=%2")
              .arg(text, className(action->parent())));
      return true;
    }
  }
  return false;
}

void logOnboardingContentTopology(QWidget *root, int step) {
  if (!root) return;
  appendLog(QStringLiteral("ONBOARDING_CONTENT_MISMATCH step=%1 root=%2")
                .arg(step)
                .arg(className(root)));
  for (QLabel *label : root->findChildren<QLabel *>()) {
    if (!label || !label->isVisibleTo(root)) continue;
    appendLog(QStringLiteral("ONBOARDING_VISIBLE_LABEL class=%1 text=%2")
                  .arg(className(label), label->text()));
  }
  for (QTextBrowser *browser : root->findChildren<QTextBrowser *>()) {
    if (!browser || !browser->isVisibleTo(root)) continue;
    appendLog(QStringLiteral("ONBOARDING_VISIBLE_BODY class=%1 plain=%2 html=%3")
                  .arg(className(browser),
                       normalizedPlainText(browser->toPlainText()),
                       normalizedPlainText(browser->toHtml())));
  }
}

bool triggerGuideInNativeMenu(NSMenu *menu) {
  if (menu == nil) return false;
  for (NSMenuItem *item in [menu itemArray]) {
    NSString *nativeTitle = [item title] ?: @"";
    const QString title =
        QString::fromUtf8([nativeTitle UTF8String]);
    if ([item isEnabled] && [item action] != nil &&
        isGuideActionText(title)) {
      const BOOL sent =
          [NSApp sendAction:[item action] to:[item target] from:item];
      appendLog(
          QStringLiteral("ONBOARDING_TRIGGER native-action text=%1 sent=%2")
              .arg(title)
              .arg(sent));
      return sent;
    }
    if ([item hasSubmenu] &&
        triggerGuideInNativeMenu([item submenu])) {
      return true;
    }
  }
  return false;
}
