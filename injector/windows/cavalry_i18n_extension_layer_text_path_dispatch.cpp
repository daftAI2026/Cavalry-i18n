/**
 * [INPUT]: 依赖 cavalry_i18n_extension_layer_text_path_dispatch.h、映射后的 ExtensionLayer PE64 字节与 IAT 槽地址
 * [OUTPUT]: 对外实现持续复核首行 RDX 字符串来源的三处 exact caller 门、三十六项静态 source 和 Pitch canonical 32-bit int 后缀匹配
 * [POS]: injector/windows 的无 Qt、无 IO text-path 分发器；安装与每次 callback 共享完整字节包络判定，译文通过有界栈缓冲写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_text_path_dispatch.h"

#include <array>
#include <cstring>

namespace {

constexpr std::size_t kStaticPreambleRva = 0x002D9170;
constexpr std::size_t kStaticCallRva = 0x002D917A;
constexpr std::size_t kStaticReturnRva = 0x002D9180;
constexpr std::array<std::uint8_t, 10> kStaticPreamble {{
    0x4C, 0x89, 0xF1,
    0x48, 0x89, 0xF2,
    0x66, 0x0F, 0x28, 0xD6,
}};

constexpr std::size_t kToolFirstPreambleRva = 0x00ABDAF0;
constexpr std::size_t kToolFirstCallRva = 0x00ABDB15;
constexpr std::size_t kToolFirstReturnRva = 0x00ABDB1B;
constexpr std::array<std::uint8_t, 37> kToolFirstPreamble {{
    0x48, 0x8B, 0x17,
    0x48, 0x39, 0x57, 0x08,
    0x0F, 0x84, 0x8C, 0x01, 0x00, 0x00,
    0xF2, 0x0F, 0x10, 0x35, 0xBB, 0x77, 0xA1, 0x00,
    0xF2, 0x41, 0x0F, 0x5E, 0xF0,
    0x4C, 0x8D, 0x75, 0xA8,
    0x4C, 0x89, 0xF1,
    0x66, 0x0F, 0x28, 0xD6,
}};

constexpr std::size_t kToolNextPreambleRva = 0x00ABDC00;
constexpr std::size_t kToolNextCallRva = 0x00ABDC11;
constexpr std::size_t kToolNextReturnRva = 0x00ABDC17;
constexpr std::array<std::uint8_t, 17> kToolNextPreamble {{
    0x4C, 0x89, 0xEA,
    0x48, 0xC1, 0xE2, 0x05,
    0x48, 0x01, 0xC2,
    0x4C, 0x89, 0xF1,
    0x66, 0x0F, 0x28, 0xD6,
}};

bool containsRange(
    const std::uint8_t *image,
    std::size_t imageSize,
    const std::uint8_t *address,
    std::size_t size)
{
    if (image == nullptr || address == nullptr || size > imageSize) {
        return false;
    }
    const std::uintptr_t base =
        reinterpret_cast<std::uintptr_t>(image);
    const std::uintptr_t value =
        reinterpret_cast<std::uintptr_t>(address);
    if (value < base) {
        return false;
    }
    const std::size_t offset =
        static_cast<std::size_t>(value - base);
    return offset <= imageSize && size <= imageSize - offset;
}

bool indirectCallTargetsSlot(
    const std::uint8_t *image,
    std::size_t imageSize,
    const std::uint8_t *call,
    const void *slot)
{
    if (!containsRange(image, imageSize, call, 6)
        || call[0] != 0xFF || call[1] != 0x15) {
        return false;
    }
    std::int32_t displacement = 0;
    std::memcpy(&displacement, call + 2, sizeof(displacement));
    const std::intptr_t target =
        static_cast<std::intptr_t>(
            reinterpret_cast<std::uintptr_t>(call + 6))
        + displacement;
    return reinterpret_cast<const void *>(target) == slot;
}

template <std::size_t Size>
bool validatesEnvelope(
    const std::uint8_t *image,
    std::size_t imageSize,
    const void *slot,
    std::size_t preambleRva,
    const std::array<std::uint8_t, Size> &preamble,
    std::size_t callRva,
    std::size_t returnRva)
{
    if (image == nullptr
        || preambleRva > imageSize
        || preamble.size() > imageSize - preambleRva
        || callRva > imageSize
        || 6 > imageSize - callRva
        || returnRva > imageSize) {
        return false;
    }
    return preambleRva + preamble.size() == callRva
        && callRva + 6 == returnRva
        && containsRange(
            image,
            imageSize,
            image + preambleRva,
            preamble.size())
        && std::memcmp(
            image + preambleRva,
            preamble.data(),
            preamble.size()) == 0
        && indirectCallTargetsSlot(
            image,
            imageSize,
            image + callRva,
            slot);
}

bool isCanonicalSignedInt(std::string_view value)
{
    if (value.empty()) {
        return false;
    }
    const bool negative = value.front() == '-';
    const std::size_t digitsBegin = negative ? 1 : 0;
    if (digitsBegin == value.size()) {
        return false;
    }
    const std::string_view digits = value.substr(digitsBegin);
    if ((digits.size() > 1 && digits.front() == '0')
        || (negative && digits == "0")) {
        return false;
    }
    for (std::size_t index = 0; index < digits.size(); ++index) {
        const unsigned char character =
            static_cast<unsigned char>(digits[index]);
        if (character < static_cast<unsigned char>('0')
            || character > static_cast<unsigned char>('9')) {
            return false;
        }
    }
    constexpr std::string_view positiveLimit = "2147483647";
    constexpr std::string_view negativeLimit = "2147483648";
    const std::string_view limit =
        negative ? negativeLimit : positiveLimit;
    return digits.size() < limit.size()
        || (digits.size() == limit.size() && digits <= limit);
}

} // namespace

bool CavalryTextPathSourceMatch::isMatched() const noexcept
{
    return sourceIndex
            < cavalry_i18n::extension_layer_contract::
                kTextPathSourceCount
        && !lookupSource.empty();
}

bool validateCavalryTextPathCallerEnvelopes(
    const std::uint8_t *image,
    std::size_t imageSize,
    const void *iatSlot)
{
    if (image == nullptr || iatSlot == nullptr) {
        return false;
    }
    return validatesEnvelope(
               image,
               imageSize,
               iatSlot,
               kStaticPreambleRva,
               kStaticPreamble,
               kStaticCallRva,
               kStaticReturnRva)
        && validatesEnvelope(
               image,
               imageSize,
               iatSlot,
               kToolFirstPreambleRva,
               kToolFirstPreamble,
               kToolFirstCallRva,
               kToolFirstReturnRva)
        && validatesEnvelope(
               image,
               imageSize,
               iatSlot,
               kToolNextPreambleRva,
               kToolNextPreamble,
               kToolNextCallRva,
               kToolNextReturnRva);
}

CavalryTextPathCallerKind classifyCavalryTextPathCaller(
    const std::uint8_t *image,
    std::size_t imageSize,
    const void *iatSlot,
    const void *returnAddress)
{
    if (image == nullptr || iatSlot == nullptr
        || returnAddress == nullptr) {
        return CavalryTextPathCallerKind::Rejected;
    }
    if (kStaticReturnRva <= imageSize
        && returnAddress == image + kStaticReturnRva
        && validatesEnvelope(
            image,
            imageSize,
            iatSlot,
            kStaticPreambleRva,
            kStaticPreamble,
            kStaticCallRva,
            kStaticReturnRva)) {
        return CavalryTextPathCallerKind::StaticExact;
    }
    if ((kToolFirstReturnRva <= imageSize
            && returnAddress == image + kToolFirstReturnRva
            && validatesEnvelope(
                image,
                imageSize,
                iatSlot,
                kToolFirstPreambleRva,
                kToolFirstPreamble,
                kToolFirstCallRva,
                kToolFirstReturnRva))
        || (kToolNextReturnRva <= imageSize
            && returnAddress == image + kToolNextReturnRva
            && validatesEnvelope(
                image,
                imageSize,
                iatSlot,
                kToolNextPreambleRva,
                kToolNextPreamble,
                kToolNextCallRva,
                kToolNextReturnRva))) {
        return CavalryTextPathCallerKind::PrimitiveToolLine;
    }
    return CavalryTextPathCallerKind::Rejected;
}

std::size_t cavalryTextPathExactSourceIndex(std::string_view source)
{
    using namespace cavalry_i18n::extension_layer_contract;
    for (std::size_t index = 0;
         index < kTextPathSourceCount;
         ++index) {
        if (source == textPathTranslationSource(index)) {
            return index;
        }
    }
    return kTextPathSourceCount;
}

CavalryTextPathSourceMatch matchCavalryTextPathSource(
    CavalryTextPathCallerKind caller,
    const std::string &source)
{
    using namespace cavalry_i18n::extension_layer_contract;
    constexpr std::size_t pitchPrefixSize =
        sizeof(kPitchRadiusPrefix) - 1;
    if (caller == CavalryTextPathCallerKind::StaticExact) {
        const std::size_t index =
            cavalryTextPathExactSourceIndex(source);
        if (isStaticTextPathSourceIndex(index)) {
            return { index, textPathTranslationSource(index), {} };
        }
        return {};
    }
    if (caller != CavalryTextPathCallerKind::PrimitiveToolLine
        || source.size() <= pitchPrefixSize
        || source.compare(
               0,
               pitchPrefixSize,
               kPitchRadiusPrefix) != 0) {
        return {};
    }

    const std::string_view suffix(
        source.data() + pitchPrefixSize,
        source.size() - pitchPrefixSize);
    if (!isCanonicalSignedInt(suffix)) {
        return {};
    }
    return {
        kPitchRadiusSourceIndex,
        kPitchRadiusPrefix,
        suffix,
    };
}

std::string composeCavalryTextPathTranslation(
    std::string_view translatedLookupSource,
    const CavalryTextPathSourceMatch &match)
{
    if (!match.isMatched() || translatedLookupSource.empty()) {
        return {};
    }
    std::string result(translatedLookupSource);
    result.append(match.preservedSuffix);
    return result;
}

bool writeCavalryTextPathTranslation(
    std::string_view translatedLookupSource,
    const CavalryTextPathSourceMatch &match,
    char *storage,
    std::size_t storageSize,
    std::string_view *written) noexcept
{
    if (written == nullptr) {
        return false;
    }
    *written = {};
    if (!match.isMatched() || translatedLookupSource.empty()) {
        return false;
    }
    if (match.preservedSuffix.empty()) {
        *written = translatedLookupSource;
        return true;
    }
    if (storage == nullptr
        || translatedLookupSource.size() > storageSize
        || match.preservedSuffix.size()
            > storageSize - translatedLookupSource.size()) {
        return false;
    }
    std::memcpy(
        storage,
        translatedLookupSource.data(),
        translatedLookupSource.size());
    std::memcpy(
        storage + translatedLookupSource.size(),
        match.preservedSuffix.data(),
        match.preservedSuffix.size());
    *written = std::string_view(
        storage,
        translatedLookupSource.size()
            + match.preservedSuffix.size());
    return true;
}
