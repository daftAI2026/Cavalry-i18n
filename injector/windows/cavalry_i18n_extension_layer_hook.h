/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator、CavalryUI helper/CustomListWidget placeholder ABI 与精确 PE/IAT 槽查询
 * [OUTPUT]: 对外提供 ExtensionLayer 空状态 helper 与已验证 placeholder setter 的受控 IAT hook、精确 source 查询与可诊断安装状态
 * [POS]: injector/windows 的自绘空状态适配边界；接管 ExtensionLayer.dll 对 CavalryUI helper 的唯一导入槽，以及经 canonical setter 链验证的 QString 赋值槽，不处理动态 HelperHints
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>

#include <cstddef>

class CavalryEmbeddedTranslator;
class QColor;
class QPixmap;
class QWidget;

class CavalryExtensionLayerHook final
{
public:
    explicit CavalryExtensionLayerHook(CavalryEmbeddedTranslator &translator);
    ~CavalryExtensionLayerHook();

    CavalryExtensionLayerHook(const CavalryExtensionLayerHook &) = delete;
    CavalryExtensionLayerHook &operator=(const CavalryExtensionLayerHook &) = delete;

    // ExtensionLayer 可能晚于 generic plugin 加载；仅在目标模块尚未出现时允许重试。
    bool ensureInstalled();
    bool isWaitingForModule() const;
    QString status() const;
    QString detail() const;

    // 可测试的 helper 精确 source 投影；未知文案和动态 HelperHints 必须返回空值。
    static QString translationForWhitelistedSource(
        const CavalryEmbeddedTranslator &translator,
        const QString &source);

    // 仅供已验证 CustomListWidget::setPlaceholder 链调用；只接受十三条已采证且存在于生成表的 source。
    static QString translationForPlaceholderSource(
        const CavalryEmbeddedTranslator &translator,
        const QString &source);

    // 仅供已验证的 ui::textAtWidgetCentre IAT 回调入口调用；保留 widget、颜色和图标实参。
    void forwardTextAtWidgetCentre(
        QWidget *widget,
        const QString &source,
        const QColor &color,
        const QPixmap *icon);

    // 仅由 QString::operator= IAT 回调调用；返回地址必须是直调 setPlaceholder export 的返回点。
    QString &forwardPlaceholderAssignment(
        QString *destination,
        const QString &source,
        const void *returnAddress);

private:
    bool isDirectSetPlaceholderCaller(const void *returnAddress) const;
    void uninstall();

    CavalryEmbeddedTranslator &translator_;
    void **textAtWidgetCentreIatSlot_ = nullptr;
    void *originalTextAtWidgetCentre_ = nullptr;
    void **placeholderAssignmentIatSlot_ = nullptr;
    void *originalPlaceholderAssignment_ = nullptr;
    const void *setPlaceholderThunk_ = nullptr;
    const void *extensionLayerImage_ = nullptr;
    std::size_t extensionLayerImageSize_ = 0;
    QString status_ = QStringLiteral("waiting-for-extension-layer");
    QString detail_ = QStringLiteral("ExtensionLayer.dll is not loaded yet.");
    bool textAtWidgetCentreInstalled_ = false;
    bool placeholderAssignmentInstalled_ = false;
    bool terminalFailure_ = false;
};
