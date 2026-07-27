/**
 * [INPUT]: 依赖 ExtensionLayer 2.7.2 的三处 Core::MakePathFromText 调用包络与共享 text-path source 真相
 * [OUTPUT]: 对外提供已批准 caller 分类、静态/动态 source 匹配、普通译文组合及无堆分配的有界写入
 * [POS]: injector/windows 的 text-path 纯合同层；把二进制 caller 门与 CJK renderer 生命周期解耦，未知调用点和非 MSVC int 文本一律拒绝
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "cavalry_i18n_extension_layer_sources.h"

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>

enum class CavalryTextPathCallerKind : std::uint8_t {
    Rejected,
    StaticExact,
    PrimitiveToolLine,
};

struct CavalryTextPathSourceMatch final {
    std::size_t sourceIndex =
        cavalry_i18n::extension_layer_contract::kTextPathSourceCount;
    std::string_view lookupSource;
    std::string_view preservedSuffix;

    bool isMatched() const noexcept;
};

bool validateCavalryTextPathCallerEnvelopes(
    const std::uint8_t *image,
    std::size_t imageSize,
    const void *iatSlot);

CavalryTextPathCallerKind classifyCavalryTextPathCaller(
    const std::uint8_t *image,
    std::size_t imageSize,
    const void *iatSlot,
    const void *returnAddress);

std::size_t cavalryTextPathExactSourceIndex(std::string_view source);

CavalryTextPathSourceMatch matchCavalryTextPathSource(
    CavalryTextPathCallerKind caller,
    const std::string &source);

std::string composeCavalryTextPathTranslation(
    std::string_view translatedLookupSource,
    const CavalryTextPathSourceMatch &match);

bool writeCavalryTextPathTranslation(
    std::string_view translatedLookupSource,
    const CavalryTextPathSourceMatch &match,
    char *storage,
    std::size_t storageSize,
    std::string_view *written) noexcept;
