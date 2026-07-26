/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator、CavalryDisplayTranslator、聚合四条边界的 CavalryExtensionLayerHook 与 Qt 应用级事件过滤机制
 * [OUTPUT]: 对外提供环境驱动翻译安装、受控显示刷新、ExtensionLayer 延迟安装及按 revision 落盘的结构化诊断 marker
 * [POS]: injector/windows 的 Qt 运行时核心；只有显式绝对 marker 路径才启用低频诊断计时器，渲染 callback 永不执行 Qt 或 IO
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

class CavalryI18nRuntime final : public QObject
{
public:
    CavalryI18nRuntime();
    ~CavalryI18nRuntime() override;

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

    QString language_;
    std::unique_ptr<CavalryEmbeddedTranslator> translator_;
    std::unique_ptr<CavalryDisplayTranslator> displayTranslator_;
    std::unique_ptr<CavalryExtensionLayerHook> extensionLayerHook_;
    std::uint64_t lastTextPathDiagnosticRevision_ = 0;
    bool translatorInstalled_ = false;
};
