/**
 * [INPUT]: Qt 完整对象图、CorePrivate signal receiver identity、产品 WidgetTagRegistry，以及 Cavalry 2.7.2 导出的 onboarding C++ ABI。
 * [OUTPUT]: 在 five-tag workspace 连续稳定后，经直接对象、Gui getter 或真实 chooser 的唯一 signal receiver 精确解析 manager，以产品 guideSelected/showGuide 语义触发 firstLaunch，并在嵌套事件循环内精确确认 workspace reset；同时提供内容拓扑诊断。
 * [POS]: supplemental onboarding 的入口与就绪边界；先证明 guide 所需真实控件已注册，再优先让 chooser signal 完成自身生命周期，reset prompt 由主线程 event filter 驱动真实 Button，不构造验收 UI。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
constexpr auto kOnboardingManagerClass = "onboarding::OnboardingManager";
constexpr auto kOnboardingChoiceClass = "onboarding::OnboardingChoiceView";
constexpr auto kGuiClass = "Gui";
constexpr auto kShowGuidesActionObjectName = "showGuides";
constexpr auto kOnboardingManagerGetterSymbol =
    "_ZN3Gui17onboardingManagerEv";
constexpr auto kShowGuideSymbol =
    "_ZN10onboarding17OnboardingManager9showGuideERKNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE";
constexpr auto kGlobalWidgetTagRegistrySymbol =
    "_ZN10onboarding23globalWidgetTagRegistryEv";
constexpr auto kFindTaggedWidgetSymbol =
    "_ZNK10onboarding17WidgetTagRegistry10findWidgetERKNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE";

bool onboardingWorkspaceReady(bool *rejected) {
  static int attempts = 0;
  static int stableTicks = 0;
  if (rejected) *rejected = false;
  void *rawRegistry = dlsym(RTLD_DEFAULT, kGlobalWidgetTagRegistrySymbol);
  void *rawFindWidget = dlsym(RTLD_DEFAULT, kFindTaggedWidgetSymbol);
  if (!rawRegistry || !rawFindWidget) {
    markDone(QStringLiteral("ERROR onboarding widget registry ABI missing"));
    if (rejected) *rejected = true;
    return false;
  }
  using GlobalWidgetTagRegistry = void *(*)();
  using FindTaggedWidget = QWidget *(*)(const void *, const std::string &);
  const void *registry =
      reinterpret_cast<GlobalWidgetTagRegistry>(rawRegistry)();
  if (!registry) {
    markDone(QStringLiteral("ERROR onboarding widget registry unavailable"));
    if (rejected) *rejected = true;
    return false;
  }

  QList<QWidget *> mainDocks;
  for (QWidget *widget : QApplication::allWidgets()) {
    if (widget && widget->isVisible() &&
        className(widget) == QStringLiteral("MainDock"))
      mainDocks << widget;
  }
  if (mainDocks.size() > 1) {
    markDone(QStringLiteral("ERROR onboarding MainDock ambiguous"));
    if (rejected) *rejected = true;
    return false;
  }

  static constexpr std::array<const char *, 5> tags = {
      "viewport", "sceneTree", "attributeEditor", "timeline",
      "projectAssets"};
  QStringList missing;
  const auto findWidget = reinterpret_cast<FindTaggedWidget>(rawFindWidget);
  for (const char *tag : tags) {
    if (!findWidget(registry, std::string(tag)))
      missing << QString::fromLatin1(tag);
  }
  if (mainDocks.size() != 1 || !missing.isEmpty()) {
    stableTicks = 0;
    if (++attempts > 120) {
      markDone(QStringLiteral("ERROR onboarding workspace readiness main=%1 missing=%2")
                   .arg(mainDocks.size())
                   .arg(missing.join(QLatin1Char(','))));
      if (rejected) *rejected = true;
    }
    return false;
  }
  if (++stableTicks < 5) return false;
  if (stableTicks == 5)
    appendLog(QStringLiteral("ONBOARDING_WORKSPACE_READY tags=5 stableTicks=5"));
  return true;
}

struct WorkspaceResetOracle {
  const char *language;
  const char *title;
  const char *body;
  const char *confirm;
  const char *cancel;
};

const WorkspaceResetOracle *currentWorkspaceResetOracle() {
  static const WorkspaceResetOracle oracles[] = {
      {"zh-Hans", "重置工作区？", "本指南在默认布局下效果最佳。是否立即重置？",
       "确定", "取消"},
      {"zh-Hant", "重設工作區？", "本指南在預設版面配置下效果最佳。是否立即重設？",
       "確定", "取消"},
      {"ja_JP", "ワークスペースをリセットしますか？",
       "このガイドはデフォルトレイアウトで最適に動作します。今すぐリセットしますか？",
       "了解", "キャンセル"},
  };
  const QString language =
      QString::fromUtf8(std::getenv("CAVALRY_I18N_LANG") ?: "");
  for (const WorkspaceResetOracle &oracle : oracles) {
    if (language == QString::fromLatin1(oracle.language)) return &oracle;
  }
  return nullptr;
}

QString workspaceResetButtonText(QWidget *button) {
  if (auto *abstractButton = qobject_cast<QAbstractButton *>(button))
    return abstractButton->text().trimmed();
  QString text = button ? button->property("text").toString().trimmed()
                        : QString();
  if (!text.isEmpty()) return text;
  QList<QLabel *> labels = button->findChildren<QLabel *>();
  for (QLabel *label : labels) {
    if (label && label->isVisibleTo(button) && !label->text().trimmed().isEmpty()) {
      if (!text.isEmpty()) return QString();
      text = label->text().trimmed();
    }
  }
  return text;
}

void logWorkspaceResetTopology(QWidget *root) {
  appendLog(QStringLiteral("ONBOARDING_RESET_PROMPT_MISMATCH root=%1 title=%2")
                .arg(className(root), normalizedPlainText(root->windowTitle())));
  for (QWidget *widget : root->findChildren<QWidget *>()) {
    if (!widget || !widget->isVisibleTo(root)) continue;
    QString text;
    if (auto *button = qobject_cast<QAbstractButton *>(widget))
      text = button->text().trimmed();
    else if (auto *label = qobject_cast<QLabel *>(widget))
      text = normalizedPlainText(label->text());
    else if (className(widget) == QStringLiteral("Button"))
      text = workspaceResetButtonText(widget);
    appendLog(QStringLiteral("ONBOARDING_RESET_WIDGET class=%1 text=%2")
                  .arg(className(widget), text));
  }
}

class WorkspaceResetEventFilter final : public QObject {
 public:
  using QObject::QObject;

 protected:
  bool eventFilter(QObject *watched, QEvent *event) override {
    if (handled_ || !event || event->type() != QEvent::Paint) return false;
    auto *painted = qobject_cast<QWidget *>(watched);
    if (!painted) return false;
    const WorkspaceResetOracle *oracle = currentWorkspaceResetOracle();
    if (!oracle) return false;

    QList<QWidget *> matchingRoots;
    for (QWidget *root : QApplication::allWidgets()) {
      if (!root || !root->isVisible() ||
          className(root) != QStringLiteral("QMessageBox") ||
          onboardingStep(root) != 0)
        continue;
      int titleHits = 0;
      int bodyHits = 0;
      for (QLabel *label : root->findChildren<QLabel *>()) {
        if (!label || !label->isVisibleTo(root)) continue;
        const QString text = normalizedPlainText(label->text());
        titleHits += text == QString::fromUtf8(oracle->title);
        bodyHits += text == QString::fromUtf8(oracle->body);
      }
      if (titleHits == 1 && bodyHits == 1) matchingRoots << root;
    }
    if (matchingRoots.isEmpty()) return false;
    if (matchingRoots.size() != 1) {
      handled_ = true;
      markDone(QStringLiteral("ERROR onboarding reset prompt ambiguous"));
      return false;
    }

    QWidget *root = matchingRoots.front();
    QList<QWidget *> buttons;
    QPointer<QWidget> confirm;
    int cancelHits = 0;
    for (QWidget *widget : root->findChildren<QWidget *>()) {
      if (!widget || !widget->isVisibleTo(root) || !widget->isEnabled() ||
          !qobject_cast<QAbstractButton *>(widget))
        continue;
      buttons << widget;
      const QString text = workspaceResetButtonText(widget);
      if (text == QString::fromUtf8(oracle->confirm)) confirm = widget;
      cancelHits += text == QString::fromUtf8(oracle->cancel);
    }
    if (buttons.size() != 2 || !confirm || cancelHits != 1) {
      if (qobject_cast<QAbstractButton *>(painted)) {
        handled_ = true;
        logWorkspaceResetTopology(root);
        markDone(QStringLiteral("ERROR onboarding reset prompt controls"));
      }
      return false;
    }

    handled_ = true;
    appendLog(QStringLiteral("ONBOARDING_RESET_PROMPT accepted title=%1")
                  .arg(QString::fromUtf8(oracle->title)));
    if (!QMetaObject::invokeMethod(confirm, "click", Qt::QueuedConnection))
      markDone(QStringLiteral("ERROR onboarding reset prompt click queue"));
    return false;
  }

 private:
  bool handled_ = false;
};

void installWorkspaceResetEventFilter() {
  static WorkspaceResetEventFilter *filter = nullptr;
  if (!filter && qApp) {
    filter = new WorkspaceResetEventFilter(qApp);
    qApp->installEventFilter(filter);
  }
}

QObject *findOnboardingManager(QString *error) {
  if (error) error->clear();
  QSet<QObject *> seen;
  QList<QObject *> objects;
  if (qApp) {
    objects << qApp;
    objects.append(qApp->findChildren<QObject *>());
  }
  for (QWidget *widget : QApplication::allWidgets()) {
    if (!widget) continue;
    objects << widget;
    for (QAction *action : widget->actions()) objects << action;
    for (QAction *action : widget->findChildren<QAction *>()) objects << action;
    objects.append(widget->findChildren<QObject *>());
  }

  QList<QObject *> managers;
  QList<QObject *> guiObjects;
  for (QObject *root : objects) {
    for (QObject *object = root; object; object = object->parent()) {
      if (seen.contains(object)) continue;
      seen.insert(object);
      const QString runtimeClass = className(object);
      if (runtimeClass == QString::fromLatin1(kOnboardingManagerClass))
        managers << object;
      else if (runtimeClass == QString::fromLatin1(kGuiClass))
        guiObjects << object;
    }
  }

  if (managers.size() > 1) {
    if (error)
      *error = QStringLiteral("OnboardingManager identity ambiguous count=%1")
                   .arg(managers.size());
    return nullptr;
  }
  if (managers.size() == 1) {
    appendLog(QStringLiteral("ONBOARDING_MANAGER source=object-graph class=%1")
                  .arg(className(managers.front())));
    return managers.front();
  }
  if (guiObjects.isEmpty()) return nullptr;
  if (guiObjects.size() != 1) {
    if (error)
      *error = QStringLiteral("Gui identity ambiguous count=%1")
                   .arg(guiObjects.size());
    return nullptr;
  }

  void *rawGetter = dlsym(RTLD_DEFAULT, kOnboardingManagerGetterSymbol);
  if (!rawGetter) {
    if (error) *error = QStringLiteral("Gui::onboardingManager export missing");
    return nullptr;
  }
  using OnboardingManagerGetter = void *(*)(void *);
  void *rawManager = reinterpret_cast<OnboardingManagerGetter>(rawGetter)(
      guiObjects.front());
  if (!rawManager) {
    if (error) *error = QStringLiteral("Gui::onboardingManager returned null");
    return nullptr;
  }
  auto *manager = reinterpret_cast<QObject *>(rawManager);
  if (className(manager) != QString::fromLatin1(kOnboardingManagerClass)) {
    if (error)
      *error = QStringLiteral("Gui::onboardingManager class mismatch actual=%1")
                   .arg(className(manager));
    return nullptr;
  }
  appendLog(QStringLiteral("ONBOARDING_MANAGER source=gui-getter class=%1")
                .arg(className(manager)));
  return manager;
}

bool isGuideActionText(QString title) {
  title.remove(QLatin1Char('&'));
  title = title.trimmed();
  return title == QStringLiteral("Getting Started Guides") ||
         title == QStringLiteral("入门指南") ||
         title == QStringLiteral("入門指南") ||
         title == QStringLiteral("スタートガイド");
}

QAction *findShowGuidesAction(QString *error) {
  QSet<QAction *> seen;
  QList<QAction *> exact;
  QList<QAction *> translated;
  if (qApp) {
    for (QAction *action : qApp->findChildren<QAction *>()) {
      if (!action || seen.contains(action)) continue;
      seen.insert(action);
      if (action->objectName() ==
          QString::fromLatin1(kShowGuidesActionObjectName))
        exact << action;
      else if (isGuideActionText(action->text()))
        translated << action;
    }
  }
  for (QWidget *widget : QApplication::allWidgets()) {
    if (!widget) continue;
    QList<QAction *> actions = widget->actions();
    actions.append(widget->findChildren<QAction *>());
    for (QAction *action : actions) {
      if (!action || seen.contains(action)) continue;
      seen.insert(action);
      if (action->objectName() ==
          QString::fromLatin1(kShowGuidesActionObjectName))
        exact << action;
      else if (isGuideActionText(action->text()))
        translated << action;
    }
  }
  const QList<QAction *> &candidates = exact.isEmpty() ? translated : exact;
  if (candidates.size() > 1 && error)
    *error = QStringLiteral("Getting Started Guides action ambiguous count=%1")
                 .arg(candidates.size());
  return candidates.size() == 1 ? candidates.front() : nullptr;
}

QWidget *findOnboardingChoice(QString *error) {
  QList<QWidget *> choices;
  for (QWidget *widget : QApplication::allWidgets()) {
    if (widget && widget->isVisible() &&
        className(widget) == QString::fromLatin1(kOnboardingChoiceClass))
      choices << widget;
  }
  if (choices.size() > 1 && error)
    *error = QStringLiteral("OnboardingChoiceView ambiguous count=%1")
                 .arg(choices.size());
  return choices.size() == 1 ? choices.front() : nullptr;
}

QObject *onboardingManagerFromChoice(QWidget *choice, QString *error) {
  if (!choice ||
      className(choice) != QString::fromLatin1(kOnboardingChoiceClass)) {
    if (error) *error = QStringLiteral("OnboardingChoiceView class mismatch");
    return nullptr;
  }
  QObjectList receivers = QObjectPrivate::get(choice)->receiverList(
      SIGNAL(guideSelected(std::string)));
  if (receivers.isEmpty())
    receivers = QObjectPrivate::get(choice)->receiverList(
        "guideSelected(std::string)");
  QSet<QObject *> managers;
  for (QObject *receiver : receivers) {
    if (className(receiver) == QString::fromLatin1(kOnboardingManagerClass))
      managers.insert(receiver);
  }
  if (managers.size() != 1) {
    if (error)
      *error = QStringLiteral("guideSelected manager receiver count=%1")
                   .arg(managers.size());
    return nullptr;
  }
  QObject *manager = *managers.constBegin();
  appendLog(QStringLiteral("ONBOARDING_MANAGER source=choice-receiver class=%1")
                .arg(className(manager)));
  return manager;
}

bool triggerFirstLaunchFromChoice(QWidget *choice, QObject *manager,
                                  bool *rejected) {
  if (!choice || !manager) return false;
  QMetaMethod guideSelected;
  QByteArray parameterType;
  const QMetaObject *metaObject = choice->metaObject();
  for (int index = 0; index < metaObject->methodCount(); ++index) {
    const QMetaMethod method = metaObject->method(index);
    const QList<QByteArray> parameters = method.parameterTypes();
    if (method.name() == QByteArrayLiteral("guideSelected") &&
        parameters.size() == 1 &&
        parameters.front() == QByteArrayLiteral("std::string")) {
      guideSelected = method;
      parameterType = parameters.front();
      break;
    }
  }
  if (!guideSelected.isValid()) {
    markDone(QStringLiteral("ERROR onboarding guideSelected(std::string) ABI"));
    if (rejected) *rejected = true;
    return false;
  }
  installWorkspaceResetEventFilter();
  const QString receiverClass = className(manager);
  const std::string guideId("firstLaunch");
  if (!guideSelected.invoke(choice, Qt::DirectConnection,
                            QGenericArgument(parameterType.constData(),
                                             &guideId))) {
    markDone(QStringLiteral("ERROR onboarding guideSelected invocation"));
    if (rejected) *rejected = true;
    return false;
  }
  appendLog(QStringLiteral(
      "ONBOARDING_TRIGGER choice id=firstLaunch receiver=%1")
                .arg(receiverClass));
  return true;
}

bool showFirstLaunchGuide(QObject *manager, bool *rejected) {
  if (!manager ||
      className(manager) != QString::fromLatin1(kOnboardingManagerClass)) {
    markDone(QStringLiteral("ERROR onboarding manager class mismatch"));
    if (rejected) *rejected = true;
    return false;
  }
  installWorkspaceResetEventFilter();
  void *rawShowGuide = dlsym(RTLD_DEFAULT, kShowGuideSymbol);
  if (!rawShowGuide) {
    markDone(QStringLiteral("ERROR onboarding showGuide export missing"));
    if (rejected) *rejected = true;
    return false;
  }
  using ShowGuide = void (*)(void *, const std::string &);
  reinterpret_cast<ShowGuide>(rawShowGuide)(manager,
                                            std::string("firstLaunch"));
  appendLog(QStringLiteral("ONBOARDING_TRIGGER manager id=firstLaunch"));
  return true;
}

bool triggerFirstLaunchGuide(bool *rejected) {
  if (rejected) *rejected = false;
  QString error;
  QObject *manager = findOnboardingManager(&error);
  if (!error.isEmpty()) {
    appendLog(QStringLiteral("ONBOARDING_MANAGER_ERROR %1").arg(error));
    markDone(QStringLiteral("ERROR onboarding manager resolution: %1")
                 .arg(error));
    if (rejected) *rejected = true;
    return false;
  }
  if (manager) return showFirstLaunchGuide(manager, rejected);

  QWidget *choice = findOnboardingChoice(&error);
  if (!error.isEmpty()) {
    markDone(QStringLiteral("ERROR onboarding choice resolution: %1")
                 .arg(error));
    if (rejected) *rejected = true;
    return false;
  }
  if (choice) {
    manager = onboardingManagerFromChoice(choice, &error);
    if (!manager) {
      markDone(QStringLiteral("ERROR onboarding choice manager: %1")
                   .arg(error));
      if (rejected) *rejected = true;
      return false;
    }
    return triggerFirstLaunchFromChoice(choice, manager, rejected);
  }

  if (gGuideChooserOpened) return false;
  QAction *action = findShowGuidesAction(&error);
  if (!error.isEmpty()) {
    markDone(QStringLiteral("ERROR onboarding action resolution: %1")
                 .arg(error));
    if (rejected) *rejected = true;
    return false;
  }
  if (!action) return false;
  const QString identity = action->objectName().isEmpty()
                               ? action->text()
                               : action->objectName();
  const bool wasEnabled = action->isEnabled();
  QPointer<QAction> guarded(action);
  if (!wasEnabled) action->setEnabled(true);
  action->trigger();
  if (guarded && !wasEnabled) guarded->setEnabled(false);
  gGuideChooserOpened = true;
  appendLog(QStringLiteral("ONBOARDING_TRIGGER chooser action=%1")
                .arg(identity));
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
