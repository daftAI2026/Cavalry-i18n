/**
 * [INPUT]: 只读的 Cavalry 2.7.2 ExtensionLayer/Core/skia PE64 映像，以及
 *          已验证的时间轴 SkFont/SkCanvas ABI 证据。
 * [OUTPUT]: 提供 fail-closed 的 vendor 时间轴字体 fallback 合同验证入口。
 * [POS]: injector/windows 的最窄 vendor 合同；只验证映像、IAT、导出跳板、
 *        helper 哈希与 SkFont 边界，不加载或修改 vendor DLL。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

struct CavalryTimelineFontContractEvidence final {
    const std::uint8_t *extensionLayerBase = nullptr;
    std::size_t extensionLayerImageSize = 0;
    const std::uint8_t *skiaBase = nullptr;
    std::size_t skiaImageSize = 0;
    std::size_t measureTextIatRva = 0;
    std::size_t drawSimpleTextIatRva = 0;
    std::size_t measureTextExportRva = 0;
    std::size_t drawSimpleTextExportRva = 0;
    std::size_t measureTextCallRva = 0;
    std::size_t measureTextReturnRva = 0;
    std::size_t drawSimpleTextCallRva = 0;
    std::size_t drawSimpleTextReturnRva = 0;
    std::size_t helperBeginRva = 0;
    std::size_t helperEndRva = 0;
};

// 运行时只传入已映射的只读模块区间；调用方应在 IAT patch 前执行一次，
// 将成功返回的 evidence 作为不可变安装快照保存，热路径不再重复验证。
bool verifyCavalryTimelineFontContract(
    const std::uint8_t *extensionLayerBase,
    std::size_t extensionLayerImageSize,
    const std::uint8_t *coreBase,
    std::size_t coreImageSize,
    const std::uint8_t *skiaBase,
    std::size_t skiaImageSize,
    CavalryTimelineFontContractEvidence *evidence,
    std::string *failure);

bool verifyCavalryTimelineFontContract(
    const std::vector<std::uint8_t> &extensionLayerImage,
    const std::vector<std::uint8_t> &coreImage,
    const std::vector<std::uint8_t> &skiaImage,
    std::string *failure);

bool verifyCavalryTimelineFontResolvedSkiaTargets(
    const CavalryTimelineFontContractEvidence &evidence,
    const void *measureTextExport,
    const void *drawSimpleTextExport,
    std::string *failure);
