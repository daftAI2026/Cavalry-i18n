/**
 * [INPUT]: Cavalry 2.7.2 SkTimeEditorView 两个已验证 Skia IAT 槽、CavalrySkiaTimelineFontFallback，以及 immutable callback snapshot
 * [OUTPUT]: 对外提供独立 timeline 字体 hook 的安装、等待状态、诊断计数与卸载生命周期
 * [POS]: injector/windows 的 SkTimeEditorView 字体适配器；只覆盖精确 measureText/drawSimpleText caller，不参与其他翻译 hook
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>

#include <atomic>
#include <cstdint>
#include <memory>
#include <mutex>

class CavalryEmbeddedTranslator;
class CavalryTimelineFontDiagnosticState;
class CavalryTimelineFontCallbackState;

struct CavalryTimelineFontHookDiagnostics final {
    std::uint64_t revision = 0;
    std::uint64_t measureCalls = 0;
    std::uint64_t drawCalls = 0;
    std::uint64_t measureFallback = 0;
    std::uint64_t drawFallback = 0;
    std::uint64_t originalForward = 0;
    std::uint64_t rejectedCaller = 0;
    std::uint64_t rejectedEncoding = 0;
    std::uint64_t rejectedAbi = 0;
    std::uint64_t retainedOriginal = 0;
};

class CavalryTimelineFontHook final
{
public:
    explicit CavalryTimelineFontHook(CavalryEmbeddedTranslator &translator);
    ~CavalryTimelineFontHook();

    CavalryTimelineFontHook(const CavalryTimelineFontHook &) = delete;
    CavalryTimelineFontHook &operator=(const CavalryTimelineFontHook &) = delete;

    bool ensureInstalled();
    bool isWaitingForModule() const;
    QString status() const;
    QString detail() const;
    CavalryTimelineFontHookDiagnostics diagnostics() const;

#ifdef CAVALRY_I18N_TESTING
    bool configureSlotsForTesting(
        void **measureSlot,
        void *measureOriginal,
        void **drawSlot,
        void *drawOriginal);
    bool triggerTerminalFailureForTesting(const QString &failure);
    static void *measureReplacementAddressForTesting();
    static void *drawReplacementAddressForTesting();
    static bool verifyForwardOnlyTombstoneForTesting(
        void *measureOriginal,
        void *drawOriginal);
#endif

private:
    bool uninstallLocked(QString *failureDetail);
    bool failTerminalLocked(const QString &failure);

    CavalryEmbeddedTranslator &translator_;
    mutable std::mutex lifecycleMutex_;
    std::shared_ptr<CavalryTimelineFontDiagnosticState> diagnostics_;
    std::shared_ptr<std::atomic<bool>> translationGate_;
    std::shared_ptr<const CavalryTimelineFontCallbackState>
        forwardOnlyTombstone_;
    void **measureIatSlot_ = nullptr;
    void **drawIatSlot_ = nullptr;
    void *originalMeasure_ = nullptr;
    void *originalDraw_ = nullptr;
    bool measureInstalled_ = false;
    bool drawInstalled_ = false;
    bool ownsLifecycle_ = false;
    bool terminalFailure_ = false;
    QString status_ = QStringLiteral("waiting-for-extension-layer");
    QString detail_ = QStringLiteral(
        "ExtensionLayer.dll is not loaded yet; timeline font hook will retry.");
};
