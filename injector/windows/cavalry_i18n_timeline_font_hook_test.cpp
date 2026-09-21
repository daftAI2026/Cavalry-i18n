/**
 * [INPUT]: CavalryTimelineFontHook 生命周期接口、immutable callback snapshot 测试 seam，以及新建 ExtensionLayer 字体 hook 源码
 * [OUTPUT]: 锁定独立 timeline hook 的 waiting/retry 状态、无 PII 诊断、forward-only 墓碑与安装顺序 RED 合同
 * [POS]: injector/windows 的 timeline 字体 hook 单元合同；与 vendor 映像合同和 font fallback 选择器测试分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_translator.h"

#include <cstdint>

#if __has_include("cavalry_i18n_timeline_font_hook.h")
#include "cavalry_i18n_timeline_font_hook.h"
#else
// RED 阶段保留可编译的占位面；真实头文件出现后，测试自动切换到生产实现。
struct CavalryTimelineFontHookDiagnostics final {
    std::uint64_t revision = 0;
    std::uint64_t measureFallback = 0;
    std::uint64_t drawFallback = 0;
    std::uint64_t retainedOriginal = 0;
};

class CavalryTimelineFontHook final
{
public:
    explicit CavalryTimelineFontHook(CavalryEmbeddedTranslator &)
    {
    }

    bool ensureInstalled()
    {
        return false;
    }

    bool isWaitingForModule() const
    {
        return false;
    }

    QString status() const
    {
        return QString();
    }

    QString detail() const
    {
        return QString();
    }

    CavalryTimelineFontHookDiagnostics diagnostics() const
    {
        return {};
    }

    bool configureSlotsForTesting(
        void **,
        void *,
        void **,
        void *)
    {
        return false;
    }

    bool triggerTerminalFailureForTesting(const QString &)
    {
        return false;
    }

    static void *measureReplacementAddressForTesting()
    {
        return nullptr;
    }

    static void *drawReplacementAddressForTesting()
    {
        return nullptr;
    }

    static bool verifyForwardOnlyTombstoneForTesting(
        void *,
        void *)
    {
        return false;
    }
};
#endif

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <QtCore/QDebug>

namespace {

void dummyMeasure()
{
}

void dummyDraw()
{
}

int gMeasureForwarded = 0;
int gDrawForwarded = 0;

float __fastcall countingMeasure(
    const void *,
    const void *,
    std::size_t,
    int,
    void *,
    const void *)
{
    ++gMeasureForwarded;
    return 17.0F;
}

void __fastcall countingDraw(
    void *,
    const void *,
    std::size_t,
    int,
    float,
    float,
    const void *,
    const void *)
{
    ++gDrawForwarded;
}

using MeasureFunction = float (__fastcall *)(
    const void *,
    const void *,
    std::size_t,
    int,
    void *,
    const void *);
using DrawFunction = void (__fastcall *)(
    void *,
    const void *,
    std::size_t,
    int,
    float,
    float,
    const void *,
    const void *);

bool expect(bool condition, const QString &message)
{
    if (!condition) {
        qCritical().noquote() << message;
        return false;
    }
    return true;
}

bool verifyWaitingAndRetryContract()
{
    CavalryEmbeddedTranslator translator(QStringLiteral("zh-Hans"));
    CavalryTimelineFontHook hook(translator);

    const bool firstAttempt = hook.ensureInstalled();
    const auto firstDiagnostics = hook.diagnostics();
    if (!expect(
            !firstAttempt,
            QStringLiteral(
                "Timeline font hook unexpectedly installed without ExtensionLayer.dll."))
        || !expect(
            hook.isWaitingForModule(),
            QStringLiteral(
                "Timeline font hook did not remain retryable while ExtensionLayer.dll was absent."))
        || !expect(
            hook.status().startsWith(QStringLiteral("waiting")),
            QStringLiteral(
                "Timeline font hook did not expose a waiting status."))
        || !expect(
            hook.detail().contains(QStringLiteral("ExtensionLayer.dll")),
            QStringLiteral(
                "Timeline font hook waiting detail omitted ExtensionLayer.dll."))
        || !expect(
            firstDiagnostics.revision == 0
                && firstDiagnostics.measureFallback == 0
                && firstDiagnostics.drawFallback == 0
                && firstDiagnostics.retainedOriginal == 0,
            QStringLiteral(
                "Timeline font hook emitted callback diagnostics before installation."))) {
        return false;
    }

    const bool secondAttempt = hook.ensureInstalled();
    const auto secondDiagnostics = hook.diagnostics();
    return expect(
        !secondAttempt
            && hook.isWaitingForModule()
            && secondDiagnostics.revision == 0
            && secondDiagnostics.measureFallback == 0
            && secondDiagnostics.drawFallback == 0
            && secondDiagnostics.retainedOriginal == 0,
        QStringLiteral(
            "Timeline font hook retry changed independent waiting state or diagnostics."));
}

bool verifyForwardOnlyTombstoneContract()
{
    return expect(
        CavalryTimelineFontHook::verifyForwardOnlyTombstoneForTesting(
            reinterpret_cast<void *>(&dummyMeasure),
            reinterpret_cast<void *>(&dummyDraw)),
        QStringLiteral(
            "Timeline font hook did not retain original measure/draw forwarding in its tombstone."));
}

bool verifyTwoSlotRollbackAndOwnershipContract()
{
    {
        void *measureSlot = reinterpret_cast<void *>(&countingMeasure);
        void *drawSlot = reinterpret_cast<void *>(&countingDraw);
        CavalryEmbeddedTranslator translator(QStringLiteral("zh-Hans"));
        CavalryTimelineFontHook hook(translator);
        if (!expect(
                hook.configureSlotsForTesting(
                    &measureSlot,
                    reinterpret_cast<void *>(&countingMeasure),
                    &drawSlot,
                    reinterpret_cast<void *>(&countingDraw)),
                QStringLiteral(
                    "Timeline font hook did not install both fake slots."))) {
            return false;
        }
        if (!expect(
                measureSlot
                        == CavalryTimelineFontHook::measureReplacementAddressForTesting()
                    && drawSlot
                        == CavalryTimelineFontHook::drawReplacementAddressForTesting(),
                QStringLiteral(
                    "Timeline font hook did not publish both replacement addresses."))) {
            return false;
        }

        const auto measure = reinterpret_cast<MeasureFunction>(measureSlot);
        const auto draw = reinterpret_cast<DrawFunction>(drawSlot);
        const char ascii[] = "Timeline";
        gMeasureForwarded = 0;
        gDrawForwarded = 0;
        if (!expect(
                !hook.triggerTerminalFailureForTesting(
                    QStringLiteral("two-slot rollback")),
                QStringLiteral(
                    "Timeline font hook terminal rollback unexpectedly succeeded."))) {
            return false;
        }
        measure(
            nullptr,
            ascii,
            sizeof(ascii) - 1,
            0,
            nullptr,
            nullptr);
        draw(
            nullptr,
            ascii,
            sizeof(ascii) - 1,
            0,
            0.0F,
            0.0F,
            nullptr,
            nullptr);
        if (!expect(
                gMeasureForwarded == 1 && gDrawForwarded == 1,
                QStringLiteral(
                    "Timeline font hook gate/tombstone did not forward both callbacks."))) {
            return false;
        }
        if (!expect(
                measureSlot == reinterpret_cast<void *>(&countingMeasure)
                    && drawSlot == reinterpret_cast<void *>(&countingDraw),
                QStringLiteral(
                    "Timeline font hook did not restore both owned fake slots."))) {
            return false;
        }
    }

    {
        void *measureSlot = reinterpret_cast<void *>(&countingMeasure);
        void *drawSlot = reinterpret_cast<void *>(&dummyDraw);
        CavalryEmbeddedTranslator translator(QStringLiteral("zh-Hans"));
        CavalryTimelineFontHook hook(translator);
        if (!expect(
                !hook.configureSlotsForTesting(
                    &measureSlot,
                    reinterpret_cast<void *>(&countingMeasure),
                    &drawSlot,
                    reinterpret_cast<void *>(&countingDraw)),
                QStringLiteral(
                    "Timeline font hook accepted a second-slot CAS mismatch."))) {
            return false;
        }
        if (!expect(
                measureSlot == reinterpret_cast<void *>(&countingMeasure)
                    && drawSlot == reinterpret_cast<void *>(&dummyDraw),
                QStringLiteral(
                    "Timeline font hook did not roll back the first slot after second-slot failure."))) {
            return false;
        }
    }

    {
        void *measureSlot = reinterpret_cast<void *>(&countingMeasure);
        void *drawSlot = reinterpret_cast<void *>(&countingDraw);
        CavalryEmbeddedTranslator translator(QStringLiteral("zh-Hans"));
        CavalryTimelineFontHook hook(translator);
        if (!expect(
                hook.configureSlotsForTesting(
                    &measureSlot,
                    reinterpret_cast<void *>(&countingMeasure),
                    &drawSlot,
                    reinterpret_cast<void *>(&countingDraw)),
                QStringLiteral(
                    "Timeline font hook could not prepare ownership-loss case."))) {
            return false;
        }
        measureSlot = reinterpret_cast<void *>(&dummyMeasure);
        if (!expect(
                !hook.triggerTerminalFailureForTesting(
                    QStringLiteral("third-party slot takeover")),
                QStringLiteral(
                    "Timeline font hook overwrote a third-party slot takeover."))) {
            return false;
        }
        return expect(
            measureSlot == reinterpret_cast<void *>(&dummyMeasure)
                && drawSlot == reinterpret_cast<void *>(&countingDraw)
                && hook.status() == QStringLiteral("restore-failed"),
            QStringLiteral(
                "Timeline font hook did not preserve the externally owned slot after restore failure."));
    }
}

} // namespace

int main()
{
    return verifyWaitingAndRetryContract()
            && verifyForwardOnlyTombstoneContract()
            && verifyTwoSlotRollbackAndOwnershipContract()
        ? 0
        : 1;
}
