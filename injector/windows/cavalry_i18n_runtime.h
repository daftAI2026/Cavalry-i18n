/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator、CavalryDisplayTranslator、CavalryExtensionLayerHook 与 Qt 应用级事件过滤机制
 * [OUTPUT]: 对外提供环境驱动的嵌入翻译安装、受控显示属性主动刷新、ExtensionLayer 延迟 IAT 安装及显式诊断 marker 生命周期
 * [POS]: injector/windows 的 Qt 运行时核心；仅在当前进程事件首帧前尝试精确 hook，不解析安装位置、不执行进程注入、不拥有 Qt runtime
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QObject>
#include <QtCore/QString>

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
    bool translatorInstalled_ = false;
};
