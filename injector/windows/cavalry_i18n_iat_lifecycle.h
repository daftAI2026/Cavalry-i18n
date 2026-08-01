/**
 * [INPUT]: 依赖 IAT hook 实例的逐槽 installed 标记、全局 lifecycle owner 身份与逐槽 restore 结果
 * [OUTPUT]: 对外提供单槽/双槽卸载决策：非 owner 不恢复，且每个 global original 仅随本槽成功恢复而独立清理
 * [POS]: injector/windows 的 IAT 生命周期纯合同；把 partial-installed 与双槽独立清理规则从 Windows 页面副作用中分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

namespace cavalry_i18n {

struct IatUninstallState {
    bool installed;
    bool ownsLifecycle;
};

constexpr bool shouldAttemptIatRestore(IatUninstallState state)
{
    return state.installed && state.ownsLifecycle;
}

constexpr bool shouldClearOriginalAfterIatRestore(
    IatUninstallState state,
    bool restoreSucceeded)
{
    return shouldAttemptIatRestore(state) && restoreSucceeded;
}

struct IatPairUninstallDecision {
    bool restoreFirst;
    bool restoreSecond;
    bool clearFirstOriginal;
    bool clearSecondOriginal;
};

constexpr IatPairUninstallDecision decideIatPairUninstall(
    bool ownsLifecycle,
    bool firstInstalled,
    bool secondInstalled,
    bool firstRestoreSucceeded,
    bool secondRestoreSucceeded)
{
    const IatUninstallState first { firstInstalled, ownsLifecycle };
    const IatUninstallState second { secondInstalled, ownsLifecycle };
    return {
        shouldAttemptIatRestore(first),
        shouldAttemptIatRestore(second),
        shouldClearOriginalAfterIatRestore(first, firstRestoreSucceeded),
        shouldClearOriginalAfterIatRestore(second, secondRestoreSucceeded),
    };
}

} // namespace cavalry_i18n
