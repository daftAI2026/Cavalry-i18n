/**
 * [INPUT]: 主验收共享 Qt 状态与真实产品操作。
 * [OUTPUT]: 主验收操作分片。
 * [POS]: macos_main_acceptance_driver 的受限实现分片。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
void startScenarioWhenReady(int attempt = 0) {
  if (!exposeMainWindow()) {
    if (attempt >= 120) {
      markDone(QStringLiteral("ERROR main window bounded readiness timeout"));
      return;
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      startScenarioWhenReady(attempt + 1);
    });
    return;
  }
    const char *scenario = std::getenv("CAVALRY_I18N_ACCEPTANCE_SCENARIO");
    appendLog(QStringLiteral("DRIVER_START scenario=%1 pid=%2")
                  .arg(QString::fromUtf8(scenario ? scenario : ""))
                  .arg(QCoreApplication::applicationPid()));
    if (scenario && QString::fromUtf8(scenario) == QStringLiteral("search")) {
      runSearchScenario();
      return;
    }
    if (scenario && QString::fromUtf8(scenario) == QStringLiteral("add-tag")) {
      runAddTagScenario();
      return;
    }
    if (scenario && QString::fromUtf8(scenario) == QStringLiteral("save")) {
      runSaveScenario();
      return;
    }
    if (scenario && QString::fromUtf8(scenario) == QStringLiteral("replace")) {
      runReplaceScenario();
      return;
    }
    if (scenario && QString::fromUtf8(scenario) == QStringLiteral("tracking")) {
      runTrackingScenario();
      return;
    }
    appendLog(QStringLiteral("ERROR unsupported scenario"));
    markDone(QStringLiteral("ERROR unsupported scenario"));
}

void scheduleScenario() {
  bool expected = false;
  if (!gScheduled.compare_exchange_strong(expected, true)) return;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{
    startScenarioWhenReady();
  });
}
} // namespace

__attribute__((constructor)) static void initializeAcceptanceDriver() {
  @autoreleasepool {
    [[NSNotificationCenter defaultCenter]
        addObserverForName:NSApplicationDidFinishLaunchingNotification
                    object:nil
                     queue:[NSOperationQueue mainQueue]
                usingBlock:^(__unused NSNotification *notification) {
      scheduleScenario();
    }];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 5000 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
      scheduleScenario();
    });
  }
}
