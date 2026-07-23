/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator、Qt QPainter 绘制 ABI 与精确 PE/IAT 槽位查询
 * [OUTPUT]: 对外提供 ExtensionLayer 四条精确自绘提示的生命周期受控 IAT hook、精确白名单翻译查询与可诊断安装状态
 * [POS]: injector/windows 的自绘补译边界；只接管 ExtensionLayer.dll 对 Qt6Gui QPainter::drawText(PointF, QString) 的唯一导入槽位
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>

class QPointF;
class QPainter;
class CavalryEmbeddedTranslator;

class CavalryExtensionLayerHook final
{
public:
    explicit CavalryExtensionLayerHook(CavalryEmbeddedTranslator &translator);
    ~CavalryExtensionLayerHook();

    CavalryExtensionLayerHook(const CavalryExtensionLayerHook &) = delete;
    CavalryExtensionLayerHook &operator=(const CavalryExtensionLayerHook &) = delete;

    // ExtensionLayer 可能晚于 generic plugin 加载；仅在模块尚未出现时允许重试。
    bool ensureInstalled();
    bool isWaitingForModule() const;
    QString status() const;
    QString detail() const;

    // 可测试的精确 source 投影；未知文案必须返回空值，禁止模糊或子串匹配。
    static QString translationForWhitelistedSource(
        const CavalryEmbeddedTranslator &translator,
        const QString &source);

    // 仅供已验证的 IAT 回调入口调用；未知 source 必须完整回退到原 Qt 绘制。
    void drawWhitelistedText(
        QPainter *painter,
        const QPointF &point,
        const QString &source);

private:
    void uninstall();

    CavalryEmbeddedTranslator &translator_;
    void **iatSlot_ = nullptr;
    void *originalDrawText_ = nullptr;
    QString status_ = QStringLiteral("waiting-for-extension-layer");
    QString detail_ = QStringLiteral("ExtensionLayer.dll is not loaded yet.");
    bool installed_ = false;
    bool terminalFailure_ = false;
};
