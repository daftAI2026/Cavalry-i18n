/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator、CavalryUI helper/CustomListWidget placeholder/MessageBar append ABI、Core text-path 子边界与精确 PE/IAT 槽查询
 * [OUTPUT]: 对外提供串行化 helper/placeholder/MessageBar/三十项 text-path 聚合状态、前两条 Qt source 查询及结构化 text-path 诊断快照
 * [POS]: injector/windows 的 ExtensionLayer 聚合生命周期边界；动态 detail 转发子 hook 最新计数，callback 不持 hook/translator raw pointer
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "cavalry_i18n_extension_layer_text_path_hook.h"

#include <QtCore/QString>

#include <cstddef>
#include <memory>
#include <mutex>

class CavalryEmbeddedTranslator;

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
    CavalryTextPathHookDiagnostics textPathDiagnostics() const;

    // 可测试的 helper 精确 source 投影；未知文案和动态 HelperHints 必须返回空值。
    static QString translationForWhitelistedSource(
        const CavalryEmbeddedTranslator &translator,
        const QString &source);

    // 仅供已验证 CustomListWidget::setPlaceholder 链调用；只接受十三条已采证且存在于生成表的 source。
    static QString translationForPlaceholderSource(
        const CavalryEmbeddedTranslator &translator,
        const QString &source);

#ifdef CAVALRY_I18N_TESTING
    // 仅供无厂商 DLL 的本进程 fake-slot 生命周期测试；正式插件不暴露此入口。
    bool configurePartialInstallForTesting(
        void **helperSlot,
        void *helperOriginal,
        bool helperInstalled,
        void **placeholderSlot,
        void *placeholderOriginal,
        bool placeholderInstalled,
        void **messageBarSlot = nullptr,
        void *messageBarOriginal = nullptr,
        bool messageBarInstalled = false);
    bool triggerTerminalFailureForTesting(const QString &failure);
#endif

private:
    bool failTerminalLocked(const QString &failure);
    bool uninstallLocked(QString *failureDetail);
    void uninstall();

    CavalryEmbeddedTranslator &translator_;
    std::unique_ptr<CavalryExtensionLayerTextPathHook> textPathHook_;
    mutable std::mutex lifecycleMutex_;
    void **textAtWidgetCentreIatSlot_ = nullptr;
    void *originalTextAtWidgetCentre_ = nullptr;
    void **placeholderAssignmentIatSlot_ = nullptr;
    void *originalPlaceholderAssignment_ = nullptr;
    void **messageBarAppendIatSlot_ = nullptr;
    void *originalMessageBarAppend_ = nullptr;
    QString status_ = QStringLiteral("waiting-for-extension-layer");
    QString detail_ = QStringLiteral("ExtensionLayer.dll is not loaded yet.");
    bool textAtWidgetCentreInstalled_ = false;
    bool placeholderAssignmentInstalled_ = false;
    bool messageBarAppendInstalled_ = false;
    bool ownsGlobalHooks_ = false;
    bool terminalFailure_ = false;
};
