/**
 * [INPUT]: 依赖 QPA 显式语言、嵌入翻译器、显示层、ExtensionLayer 聚合 hook 与 Qt 事件过滤
 * [OUTPUT]: 对外提供严格语言谓词、可查询配置结果、受控显示刷新及 revision 驱动的结构化诊断 marker
 * [POS]: injector/windows 的 Qt 运行时核心；拒绝空 specification，语言只能来自 QPA manifest/hash gate
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QObject>
#include <QtCore/QString>

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
    bool translatorInstalled_ = false;
    bool configured_ = false;
};
