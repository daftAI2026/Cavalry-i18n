/**
 * [INPUT]: 依赖 cavalry_i18n_iat_patch.h 的单槽替换合同与 Windows VirtualProtect/FlushInstructionCache
 * [OUTPUT]: 对外实现 CAS 型 IAT 指针替换；expected mismatch 不覆盖，保护恢复失败时仅 CAS 回滚仍由本方占有的 replacement
 * [POS]: injector/windows 的共享 IAT 写入实现，被 ExtensionLayer 的 Qt、CavalryUI 与 Core 三条精确边界复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_iat_patch.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

bool replaceCavalryIatPointer(
    void **slot,
    void *expectedCurrent,
    void *replacement,
    QString *failureDetail)
{
    if (slot == nullptr || expectedCurrent == nullptr || replacement == nullptr) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral("IAT replacement received a null pointer.");
        }
        return false;
    }

    DWORD oldProtection = 0;
    if (!VirtualProtect(slot, sizeof(*slot), PAGE_READWRITE, &oldProtection)) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "VirtualProtect could not unlock the IAT slot (Win32 error %1).")
                .arg(GetLastError());
        }
        return false;
    }

    auto *const atomicSlot =
        reinterpret_cast<void *volatile *>(slot);
    void *const observed = InterlockedCompareExchangePointer(
        atomicSlot,
        replacement,
        expectedCurrent);
    if (observed != expectedCurrent) {
        DWORD ignoredProtection = 0;
        bool protectionRestored =
            VirtualProtect(
                slot,
                sizeof(*slot),
                oldProtection,
                &ignoredProtection)
            != FALSE;
        const DWORD firstRestoreError =
            protectionRestored ? ERROR_SUCCESS : GetLastError();
        DWORD retryError = ERROR_SUCCESS;
        if (!protectionRestored) {
            protectionRestored =
                VirtualProtect(
                    slot,
                    sizeof(*slot),
                    oldProtection,
                    &ignoredProtection)
                != FALSE;
            retryError =
                protectionRestored ? ERROR_SUCCESS : GetLastError();
        }
        if (failureDetail != nullptr) {
            if (firstRestoreError == ERROR_SUCCESS) {
                *failureDetail = QStringLiteral(
                    "The verified IAT slot changed before replacement.");
            } else if (protectionRestored) {
                *failureDetail = QStringLiteral(
                    "The verified IAT slot changed before replacement; page protection initially failed to restore (Win32 error %1) but the retry succeeded.")
                    .arg(firstRestoreError);
            } else {
                *failureDetail = QStringLiteral(
                    "The verified IAT slot changed before replacement, and page protection could not be restored after retry (Win32 errors %1 then %2); the IAT page may remain writable, so the calling lifecycle must terminate or isolate the process.")
                    .arg(firstRestoreError)
                    .arg(retryError);
            }
        }
        return false;
    }

    FlushInstructionCache(GetCurrentProcess(), slot, sizeof(*slot));

    DWORD ignoredProtection = 0;
    if (VirtualProtect(slot, sizeof(*slot), oldProtection, &ignoredProtection)) {
        return true;
    }

    const DWORD restoreError = GetLastError();
    void *const rollbackObserved = InterlockedCompareExchangePointer(
        atomicSlot,
        expectedCurrent,
        replacement);
    const bool rollbackSucceeded = rollbackObserved == replacement;
    if (rollbackSucceeded) {
        FlushInstructionCache(GetCurrentProcess(), slot, sizeof(*slot));
    }

    const bool protectionRestoredOnRetry =
        VirtualProtect(
            slot,
            sizeof(*slot),
            oldProtection,
            &ignoredProtection)
        != FALSE;
    const DWORD retryError =
        protectionRestoredOnRetry ? ERROR_SUCCESS : GetLastError();
    if (failureDetail != nullptr) {
        if (rollbackSucceeded && protectionRestoredOnRetry) {
            *failureDetail = QStringLiteral(
                "IAT page protection initially could not be restored (Win32 error %1); CAS restored the original pointer and the protection retry succeeded.")
                .arg(restoreError);
        } else if (rollbackSucceeded) {
            *failureDetail = QStringLiteral(
                "IAT page protection could not be restored (Win32 errors %1 then %2); CAS restored the original pointer, but the page protection retry also failed, so the calling lifecycle must terminate or isolate the process.")
                .arg(restoreError)
                .arg(retryError);
        } else if (protectionRestoredOnRetry) {
            *failureDetail = QStringLiteral(
                "IAT page protection initially could not be restored (Win32 error %1); the slot changed before CAS rollback, so the third-party pointer was left untouched and protection was restored.")
                .arg(restoreError);
        } else {
            *failureDetail = QStringLiteral(
                "IAT page protection could not be restored (Win32 errors %1 then %2); the slot changed before CAS rollback, so the third-party pointer was left untouched and the calling lifecycle must terminate or isolate the process.")
                .arg(restoreError)
                .arg(retryError);
        }
    }
    return false;
}
