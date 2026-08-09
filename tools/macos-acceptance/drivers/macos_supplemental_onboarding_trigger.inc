/**
 * [INPUT]: Qt 完整对象图、AppKit modal run-loop mode、Qt/native 菜单、可选 reset PopOverView、OnboardingChoiceView 与 Cavalry 2.7.2 的 onboarding C++ ABI。
 * [OUTPUT]: 通过 manager、真实入门指南菜单或 choice signal 语义触发 firstLaunch guide，并只在精确匹配本地化 reset-workspace 对话框时确认默认布局。
 * [POS]: supplemental onboarding 的入口解析器；用 mode-aware timer 穿过同步产品弹窗后打开真实 guide，并对任何未知 modal 拓扑失败关闭，不构造验收 UI。
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

enum class WorkspaceResetPromptResult { Waiting, Accepted, Rejected };

struct WorkspaceResetOracle {
  const char *language;
  const char *title;
  const char *body;
  const char *confirm;
  const char *cancel;
};

NSTimer *gWorkspaceResetModalTimer = nil;

const WorkspaceResetOracle *currentWorkspaceResetOracle() {
  static const WorkspaceResetOracle oracles[] = {
      {"zh-Hans", "重置工作区？", "本指南在默认布局下效果最佳。是否立即重置？",
       "确定", "取消"},
      {"zh-Hant", "重設工作區？", "本指南在預設版面配置下效果最佳。是否立即重設？",
       "確定", "取消"},
      {"ja_JP", "ワークスペースをリセットしますか？",
       "このガイドはデフォルトレイアウトで最適に動作します。今すぐリセットしますか？",
       "OK", "キャンセル"},
  };
  const QString language =
      QString::fromUtf8(std::getenv("CAVALRY_I18N_LANG") ?: "");
  for (const WorkspaceResetOracle &oracle : oracles) {
    if (language == QString::fromLatin1(oracle.language)) return &oracle;
  }
  return nullptr;
}

void logWorkspaceResetTopology(QWidget *root) {
  appendLog(QStringLiteral("ONBOARDING_RESET_PROMPT_MISMATCH root=%1")
                .arg(className(root)));
  for (QLabel *label : root->findChildren<QLabel *>()) {
    if (label && label->isVisibleTo(root))
      appendLog(QStringLiteral("ONBOARDING_RESET_PROMPT_VISIBLE_LABEL text=%1")
                    .arg(normalizedPlainText(label->text())));
  }
  for (QAbstractButton *button : root->findChildren<QAbstractButton *>()) {
    if (button && button->isVisibleTo(root))
      appendLog(QStringLiteral("ONBOARDING_RESET_PROMPT_VISIBLE_BUTTON text=%1 enabled=%2")
                    .arg(button->text())
                    .arg(button->isEnabled()));
  }
}

bool isGuideChoicePopOver(QWidget *root) {
  if (!root) return false;
  for (QWidget *child : root->findChildren<QWidget *>()) {
    if (child && child->isVisibleTo(root) &&
        className(child).contains(QStringLiteral("OnboardingChoiceView")))
      return true;
  }
  return false;
}

bool hasVisibleGuideChoice() {
  for (QWidget *widget : QApplication::allWidgets()) {
    if (widget && widget->isVisible() &&
        className(widget).contains(QStringLiteral("OnboardingChoiceView")))
      return true;
  }
  return false;
}

bool exactWorkspaceResetPrompt(QWidget *root,
                               const WorkspaceResetOracle &oracle,
                               QPointer<QAbstractButton> *confirmOut) {
  if (!root || !confirmOut) return false;
  int titleHits = 0;
  int bodyHits = 0;
  for (QLabel *label : root->findChildren<QLabel *>()) {
    if (!label || !label->isVisibleTo(root)) continue;
    const QString text = normalizedPlainText(label->text());
    titleHits += text == QString::fromUtf8(oracle.title);
    bodyHits += text == QString::fromUtf8(oracle.body);
  }
  QList<QAbstractButton *> buttons;
  QPointer<QAbstractButton> confirm;
  int cancelHits = 0;
  for (QAbstractButton *button : root->findChildren<QAbstractButton *>()) {
    if (!button || !button->isVisibleTo(root) || !button->isEnabled()) continue;
    buttons << button;
    if (button->text() == QString::fromUtf8(oracle.confirm)) confirm = button;
    cancelHits += button->text() == QString::fromUtf8(oracle.cancel);
  }
  const bool exact = titleHits == 1 && bodyHits == 1 && buttons.size() == 2 &&
                     confirm && cancelHits == 1;
  if (exact) *confirmOut = confirm;
  return exact;
}

WorkspaceResetPromptResult handleWorkspaceResetPrompt() {
  QList<QWidget *> prompts;
  for (QWidget *widget : QApplication::allWidgets()) {
    if (widget && widget->isVisible() &&
        className(widget) == QStringLiteral("PopOverView") &&
        onboardingStep(widget) == 0)
      prompts << widget;
  }
  if (prompts.isEmpty()) return WorkspaceResetPromptResult::Waiting;
  const WorkspaceResetOracle *oracle = currentWorkspaceResetOracle();
  if (!oracle) {
    markDone(QStringLiteral("ERROR onboarding reset workspace prompt language"));
    return WorkspaceResetPromptResult::Rejected;
  }
  QPointer<QAbstractButton> confirm;
  int resetHits = 0;
  bool onlyGuideChoice = true;
  for (QWidget *root : prompts) {
    QPointer<QAbstractButton> candidate;
    if (exactWorkspaceResetPrompt(root, *oracle, &candidate)) {
      resetHits += 1;
      confirm = candidate;
    } else {
      onlyGuideChoice = onlyGuideChoice && isGuideChoicePopOver(root);
    }
  }
  if (resetHits == 0 && onlyGuideChoice)
    return WorkspaceResetPromptResult::Waiting;
  if (resetHits != 1 || !confirm) {
    for (QWidget *root : prompts) logWorkspaceResetTopology(root);
    markDone(QStringLiteral("ERROR onboarding reset workspace prompt topology"));
    return WorkspaceResetPromptResult::Rejected;
  }
  appendLog(QStringLiteral("ONBOARDING_RESET_PROMPT accepted title=%1")
                .arg(QString::fromUtf8(oracle->title)));
  confirm->click();
  return WorkspaceResetPromptResult::Accepted;
}

void disarmWorkspaceResetModalPoll() {
  if (!gWorkspaceResetModalTimer) return;
  [gWorkspaceResetModalTimer invalidate];
  gWorkspaceResetModalTimer = nil;
}

bool triggerFirstLaunchFromChoiceView();

void armWorkspaceResetModalPoll() {
  if (gWorkspaceResetModalTimer) return;
  gWorkspaceResetModalTimer =
      [NSTimer timerWithTimeInterval:0.05
                               repeats:YES
                               block:^(NSTimer *) {
                                 const WorkspaceResetPromptResult result =
                                     handleWorkspaceResetPrompt();
                                 if (result ==
                                     WorkspaceResetPromptResult::Rejected) {
                                   disarmWorkspaceResetModalPoll();
                                   return;
                                 }
                                 if (result ==
                                     WorkspaceResetPromptResult::Accepted) {
                                   disarmWorkspaceResetModalPoll();
                                   armWorkspaceResetModalPoll();
                                   return;
                                 }
                                 if (hasVisibleGuideChoice()) {
                                   disarmWorkspaceResetModalPoll();
                                   gTriggerAttempted =
                                       triggerFirstLaunchFromChoiceView();
                                   if (!gTriggerAttempted)
                                     markDone(QStringLiteral(
                                         "ERROR onboarding choice trigger"));
                                 }
                               }];
  [[NSRunLoop mainRunLoop] addTimer:gWorkspaceResetModalTimer
                           forMode:NSRunLoopCommonModes];
  [[NSRunLoop mainRunLoop] addTimer:gWorkspaceResetModalTimer
                           forMode:NSModalPanelRunLoopMode];
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
  armWorkspaceResetModalPoll();
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
    armWorkspaceResetModalPoll();
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
      armWorkspaceResetModalPoll();
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
      armWorkspaceResetModalPoll();
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
