/**
 * [INPUT]: 依赖 acceptance-only generic plugin、显式受控语言/证据目录、产品已安装 translator、Guide catalog 与 Cavalry 真实 Qt 控件树
 * [OUTPUT]: 对外提供 firstLaunch 五步语义 driver，以原子 onboarding-state.json 发布 exact action/std::string/HWND/title/body 状态、消费原子 ACK，并以真实下一页标题/正文确认每次 Next 转场
 * [POS]: injector/windows 的 Onboarding 验收专用边界；只由不发布的 acceptance plugin 创建，产品 runtime 不链接本类或任何 UI 驱动语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QElapsedTimer>
#include <QtCore/QObject>
#include <QtCore/QPointer>
#include <QtCore/QString>
#include <QtCore/QStringList>

#include <array>
#include <memory>

class QEvent;
class QWidget;
class CavalryEmbeddedTranslator;

class CavalryI18nOnboardingAcceptance final : public QObject
{
public:
    explicit CavalryI18nOnboardingAcceptance(
        const QString &language,
        QObject *parent = nullptr);
    ~CavalryI18nOnboardingAcceptance() override;

    bool isEnabled() const;
    void start();

protected:
    bool eventFilter(QObject *watched, QEvent *event) override;

private:
    void bypassBlockingWindows();
    void configureOnboardingAcceptance();
    void driveOnboardingAcceptance();
    void failOnboardingAcceptance(const QString &message);
    QWidget *findVisibleWidgetByClass(const char *className) const;
    void restoreOnboardingManagerDisabledState();
    void restoreQuitOnLastWindowClosed();
    bool triggerFirstLaunchFromManager(
        QObject *manager,
        const QString &identity);
    void writeDiagnostic(
        const QString &status,
        const QString &message,
        bool translatorInstalled) const;

    QString language_;
    QString onboardingAcceptanceDirectory_;
    QString onboardingAcceptanceStatus_ = QStringLiteral("disabled");
    QString onboardingAcceptanceMessage_;
    QString onboardingActionObjectName_;
    QString onboardingActionIdentity_;
    QString onboardingChoiceClass_;
    QString onboardingChoiceProducerClass_;
    QString onboardingGuideParameterType_;
    QString onboardingGuideClass_;
    QString onboardingWindowHandle_;
    QString onboardingTitle_;
    QString onboardingBody_;
    QString onboardingResetWorkspaceTitle_;
    QString onboardingResetWorkspaceBody_;
    QStringList onboardingObservedActions_;
    QStringList onboardingBypassedWindows_;
    QStringList onboardingObservedTexts_;
    QStringList onboardingObservedWidgets_;
    std::array<QString, 5> onboardingExpectedTitles_;
    std::array<QString, 5> onboardingExpectedBodies_;
    std::unique_ptr<CavalryEmbeddedTranslator> translationLookup_;
    QPointer<QObject> onboardingManager_;
    QElapsedTimer onboardingStageTimer_;
    QElapsedTimer onboardingStartupTimer_;
    QElapsedTimer onboardingTransitionTimer_;
    int onboardingStep_ = 0;
    int onboardingPendingStep_ = 0;
    int onboardingTransitionClickAttempts_ = 0;
    QString onboardingTransitionSourceTitle_;
    QString onboardingTransitionSourceBody_;
    bool onboardingAcceptanceEnabled_ = false;
    bool onboardingActionTemporarilyEnabled_ = false;
    bool onboardingActionWasEnabled_ = false;
    bool onboardingDriveActive_ = false;
    bool onboardingHelpProducerOpened_ = false;
    bool onboardingQuitBypassed_ = false;
    bool onboardingManagerEnableBypassUsed_ = false;
    bool onboardingManagerTemporarilyEnabled_ = false;
    bool onboardingManagerWasDisabled_ = false;
    bool onboardingManagerDisabledStateRestored_ = false;
    bool onboardingWorkspaceResetPromptObserved_ = false;
    bool onboardingWorkspaceResetAvoided_ = false;
    bool onboardingStartupSettled_ = false;
    bool quitOnLastWindowClosedOverridden_ = false;
    bool quitOnLastWindowClosedWasEnabled_ = false;
    bool onboardingTitleMatches_ = false;
    bool onboardingBodyMatches_ = false;
};
