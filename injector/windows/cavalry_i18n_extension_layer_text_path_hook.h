/**
 * [INPUT]: 依赖 Core::MakePathFromText 的 MSVC x64 ABI、ExtensionLayer 三处持续复核字节包络的批准 caller、十六项翻译 source/context、已验证 CJK renderer 与嵌入 translator
 * [OUTPUT]: 对外提供串行化 IAT 安装/卸载、CogTool 整数后缀保留、终态失败、forward-only 墓碑、按 source 命中位图与无 IO 原子诊断
 * [POS]: injector/windows 的 Skia text-path 极窄边界；callback 无 owner/translator 指针，卸载后只保留原函数墓碑供迟到回调转发
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>

#include <cstddef>
#include <cstdint>
#include <atomic>
#include <memory>
#include <mutex>
#include <string>

class CavalryEmbeddedTranslator;
class CavalryTextPathDiagnosticState;
class CavalryTextPathCallbackState;

struct CavalryTextPathHookDiagnostics final {
    std::uint64_t revision = 0;
    std::uint64_t canonicalCalls = 0;
    std::uint64_t whitelistCalls = 0;
    std::uint64_t cjkPathSuccess = 0;
    std::uint64_t originalFallback = 0;
    std::uint64_t noTranslation = 0;
    std::uint64_t rendererFailure = 0;
    std::uint16_t translatedSourceMask = 0;
    std::uint16_t fallbackSourceMask = 0;
};

class CavalryExtensionLayerTextPathHook final
{
public:
    explicit CavalryExtensionLayerTextPathHook(
        CavalryEmbeddedTranslator &translator);
    ~CavalryExtensionLayerTextPathHook();

    CavalryExtensionLayerTextPathHook(
        const CavalryExtensionLayerTextPathHook &) = delete;
    CavalryExtensionLayerTextPathHook &operator=(
        const CavalryExtensionLayerTextPathHook &) = delete;

    bool ensureInstalled(const void *extensionLayerImage, std::size_t imageSize);
    bool uninstall(QString *failureDetail);
    bool isInstalled() const;
    bool isWaitingForCore() const;
    bool isTerminalFailure() const;
    QString status() const;
    QString detail() const;
    CavalryTextPathHookDiagnostics diagnostics() const;

    static bool isWhitelistedSource(const std::string &source);
    static std::string translationForWhitelistedSource(
        const CavalryEmbeddedTranslator &translator,
        const std::string &source);

#ifdef CAVALRY_I18N_TESTING
    static bool verifyForwardOnlyTombstoneForTesting(void *original);
    static CavalryTextPathHookDiagnostics
    exerciseDiagnosticCountersForTesting();
#endif

private:
    bool uninstallLocked(QString *failureDetail);
    bool failTerminalLocked(const QString &detail);

    CavalryEmbeddedTranslator &translator_;
    std::shared_ptr<CavalryTextPathDiagnosticState> diagnostics_;
    std::shared_ptr<const CavalryTextPathCallbackState>
        forwardOnlyTombstone_;
    std::shared_ptr<std::atomic<bool>> translationGate_;
    mutable std::mutex lifecycleMutex_;
    void **iatSlot_ = nullptr;
    void *original_ = nullptr;
    QString status_ = QStringLiteral("waiting-for-core-text-path");
    QString detail_ =
        QStringLiteral("Core.dll text-path boundary is not installed yet.");
    bool installed_ = false;
    bool ownsGlobalHook_ = false;
    bool terminalFailure_ = false;
};
