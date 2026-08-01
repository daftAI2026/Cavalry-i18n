/**
 * [INPUT]: 依赖 ExtensionLayer 聚合测试入口、MessageBar callback snapshot、共享 IAT CAS 与 Windows 只读指针页
 * [OUTPUT]: 对外验证 message-only partial install 在终态失败时可独立恢复，以及第三方接管时保留 forward-only original
 * [POS]: injector/windows 的 MessageBar 聚合生命周期合同分片；与正文 dispatch 单测分离，补足安装后失败和卸载竞争边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_hook.h"
#include "cavalry_i18n_extension_layer_qt_hooks.h"
#include "cavalry_i18n_translator.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <QtCore/QDebug>
#include <QtCore/QString>

#include <array>
#include <cstdint>

class QTextEdit;

namespace {

int gHistoryReturnStorage = 0;
int gLiveReturnStorage = 0;

void dummyMessageBarAppend(QTextEdit *, const QString &)
{
}

void dummyThirdPartyMessageBarAppend(QTextEdit *, const QString &)
{
}

DWORD pageProtection(void *address)
{
    MEMORY_BASIC_INFORMATION information {};
    return VirtualQuery(
               address,
               &information,
               sizeof(information))
            == sizeof(information)
        ? information.Protect
        : 0;
}

bool verifyMessageBarRollbackCase(
    const QString &scenario,
    bool thirdPartyTakeover)
{
    clearCavalryMessageBarOriginal();
    SYSTEM_INFO systemInfo {};
    GetSystemInfo(&systemInfo);
    void *const page = VirtualAlloc(
        nullptr,
        systemInfo.dwPageSize,
        MEM_RESERVE | MEM_COMMIT,
        PAGE_READWRITE);
    if (page == nullptr) {
        qCritical().noquote()
            << scenario + QStringLiteral(": VirtualAlloc failed.");
        return false;
    }

    auto **slot = static_cast<void **>(page);
    void *const original =
        reinterpret_cast<void *>(dummyMessageBarAppend);
    void *const thirdParty =
        reinterpret_cast<void *>(dummyThirdPartyMessageBarAppend);
    *slot = thirdPartyTakeover
        ? thirdParty
        : cavalryMessageBarReplacementAddress();

    CavalryEmbeddedTranslator translator(QStringLiteral("zh-Hans"));
    const std::array<const std::uint8_t *, 2> approvedReturns {{
        reinterpret_cast<const std::uint8_t *>(&gHistoryReturnStorage),
        reinterpret_cast<const std::uint8_t *>(&gLiveReturnStorage),
    }};
    QString failure;
    bool ok = publishCavalryMessageBarCallbackSnapshot(
        translator,
        original,
        approvedReturns,
        &failure);
    DWORD previousProtection = 0;
    if (ok && !VirtualProtect(
            page,
            systemInfo.dwPageSize,
            PAGE_READONLY,
            &previousProtection)) {
        failure = QStringLiteral("VirtualProtect failed.");
        ok = false;
    }

    {
        CavalryExtensionLayerHook hook(translator);
        if (ok && !hook.configurePartialInstallForTesting(
                nullptr,
                nullptr,
                false,
                nullptr,
                nullptr,
                false,
                slot,
                original,
                true)) {
            failure = QStringLiteral(
                "Could not claim aggregate lifecycle ownership.");
            ok = false;
        }
        if (ok && hook.triggerTerminalFailureForTesting(
                scenario + QStringLiteral(" terminal"))) {
            failure = QStringLiteral(
                "Terminal rollback unexpectedly returned success.");
            ok = false;
        }

        const QString expectedStatus = thirdPartyTakeover
            ? QStringLiteral("restore-failed")
            : QStringLiteral("unsupported");
        const void *expectedSlot =
            thirdPartyTakeover ? thirdParty : original;
        if (ok && (hook.status() != expectedStatus
            || !hook.detail().contains(
                scenario + QStringLiteral(" terminal"))
            || *slot != expectedSlot
            || pageProtection(page) != PAGE_READONLY
            || isCavalryMessageBarOriginalPublished()
                != thirdPartyTakeover)) {
            failure = QStringLiteral(
                "MessageBar rollback did not preserve per-slot state.");
            ok = false;
        }
    }

    if (!ok) {
        qCritical().noquote()
            << QStringLiteral("%1: %2").arg(scenario, failure);
    }
    clearCavalryMessageBarOriginal();
    VirtualFree(page, 0, MEM_RELEASE);
    return ok;
}

} // namespace

bool verifyCavalryMessageBarAggregateLifecycle()
{
    return verifyMessageBarRollbackCase(
               QStringLiteral("MessageBar restore"),
               false)
        && verifyMessageBarRollbackCase(
               QStringLiteral("MessageBar third-party takeover"),
               true);
}
