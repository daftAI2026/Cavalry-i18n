/**
 * [INPUT]: 依赖启动期语言选择与 generated_translations.inc 中五条 MenuBarManager exact action 译文
 * [OUTPUT]: 对外提供 macOS TransformTool text-path 的一次性配置入口、只读原子诊断快照、五位 source mask、逐 source 成功/回退计数与稳定 C ABI 快照入口
 * [POS]: injector 的 macOS 私有 ABI 防火墙；把共享翻译数据投影到已验证的 Core→ExtensionLayer→Skia 调用链，不参与普通 Qt 文本翻译
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstddef>
#include <cstdint>

namespace cavalry_i18n {

inline constexpr std::size_t kMacToolHelpActionCount = 5;

struct MacToolHelpTextPathTranslation {
    const char *source;
    const char *translation;
    std::uint64_t sourceBit;
};

void configureMacToolHelpTextPath(
    const char *language,
    const MacToolHelpTextPathTranslation *translations,
    std::size_t translationCount) noexcept;

struct MacToolHelpTextPathDiagnostics {
    bool configured;
    bool vendorContractVerified;
    bool rendererReady;
    std::uint64_t canonicalCalls;
    std::uint64_t whitelistCalls;
    std::uint64_t cjkPathSuccess;
    std::uint64_t originalFallback;
    std::uint64_t rendererFailure;
    std::uint64_t translatedSourceMask;
    std::uint64_t fallbackSourceMask;
    std::uint64_t translatedSourceCalls[kMacToolHelpActionCount];
    std::uint64_t fallbackSourceCalls[kMacToolHelpActionCount];
};

MacToolHelpTextPathDiagnostics macToolHelpTextPathDiagnostics() noexcept;

} // namespace cavalry_i18n

extern "C" bool cavalry_i18n_mac_tool_help_diagnostics_v1(
    cavalry_i18n::MacToolHelpTextPathDiagnostics *output,
    std::size_t outputSize) noexcept;
