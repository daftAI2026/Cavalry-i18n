/**
 * [INPUT]: 依赖 QPA 显式语言、嵌入翻译器、显示层、ExtensionLayer 聚合 hook、Qt 事件过滤，以及仅在显式绝对 TEMP 证据目录下启用的 Onboarding 验收握手
 * [OUTPUT]: 对外提供严格语言谓词、可查询配置结果、受控显示刷新、revision 诊断 marker 与 firstLaunch 五步语义取证状态
 * [POS]: injector/windows 的 Qt 运行时核心；正常路径拒绝环境语言旁路，验收路径只驱动已证实的 showGuides/guideSelected 与前四步 nextClicked，第五步截图 ACK 后不触发关闭语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QElapsedTimer>
#include <QtCore/QObject>
#include <QtCore/QString>
#include <QtCore/QStringList>

#include <array>
#include <cstdint>
#include <memory>

class QEvent;
class QWidget;
class CavalryDisplayTranslator;
class CavalryEmbeddedTranslator;
class CavalryExtensionLayerHook;

bool cavalryIsSupportedRuntimeLanguage(const QString &language);

class CavalryI18nRuntime final : public QObject
{
public:
    explicit CavalryI18nRuntime(
        const QString &requestedLanguage);
    ~CavalryI18nRuntime() override;

    bool isConfigured() const;

protected:
    bool eventFilter(QObject *watched, QEvent *event) override;

private:
    bool configure();
    void ensureExtensionLayerHook();
    void maybeWriteTextPathDiagnostic();
    void configureOnboardingAcceptance();
    void driveOnboardingAcceptance();
    void failOnboardingAcceptance(const QString &message);
    QWidget *findVisibleWidgetByClass(const char *className) const;
    void queueRefresh(QWidget *root);
    void refreshAllTopLevelWidgets();
    void refreshWindow(QWidget *window);
    void writeDiagnostic(
        const QString &status,
        const QString &message,
        bool translatorInstalled) const;

    QString requestedLanguage_;
    QString language_;
    std::unique_ptr<CavalryEmbeddedTranslator> translator_;
    std::unique_ptr<CavalryDisplayTranslator> displayTranslator_;
    std::unique_ptr<CavalryExtensionLayerHook> extensionLayerHook_;
    std::uint64_t lastTextPathDiagnosticRevision_ = 0;
    QString onboardingAcceptanceDirectory_;
    QString onboardingAcceptanceStatus_ = QStringLiteral("disabled");
    QString onboardingAcceptanceMessage_;
    QString onboardingActionObjectName_;
    QString onboardingActionIdentity_;
    QString onboardingChoiceClass_;
    QString onboardingGuideParameterType_;
    QString onboardingGuideClass_;
    QString onboardingWindowHandle_;
    QString onboardingTitle_;
    QString onboardingBody_;
    QStringList onboardingObservedActions_;
    QStringList onboardingObservedTexts_;
    QStringList onboardingObservedWidgets_;
    std::array<QString, 5> onboardingExpectedTitles_;
    std::array<QString, 5> onboardingExpectedBodies_;
    QElapsedTimer onboardingStageTimer_;
    int onboardingStep_ = 0;
    bool onboardingAcceptanceEnabled_ = false;
    bool onboardingDriveActive_ = false;
    bool onboardingHelpMnemonicSent_ = false;
    bool onboardingTitleMatches_ = false;
    bool onboardingBodyMatches_ = false;
    bool translatorInstalled_ = false;
    bool configured_ = false;
};
