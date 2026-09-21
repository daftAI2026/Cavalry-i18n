/**
 * [INPUT]: 依赖 fallback 头文件契约、已验证 Skia ABI、共享 skia_typeface 系统字体候选与引用管理，以及当前 UTF-8 名称
 * [OUTPUT]: 提供启动期系统字体候选和同步 borrowed SkFont 选择，保持源字体与文本只读
 * [POS]: injector/windows 时间轴 measure/draw 共用的字体边界；输出拷贝不拥有 typeface
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_timeline_font_fallback.h"

#include "cavalry_i18n_skia_runtime_abi.h"
#include "cavalry_i18n_skia_typeface.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <QtCore/QByteArray>
#include <QtCore/QChar>
#include <QtCore/QList>

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <memory>
#include <string_view>
#include <utility>
#include <vector>

namespace {

constexpr std::size_t kMaxTimelineTextBytes = 4096;

using cavalry_i18n::skia_typeface::candidateFamilies;
using cavalry_i18n::skia_typeface::isIgnorableGlyphCheck;
using cavalry_i18n::skia_typeface::kNormalSkFontStyle;
using cavalry_i18n::skia_typeface::kSkFontSize;
using cavalry_i18n::skia_typeface::releaseTypeface;

bool decodeStrictUtf8(std::string_view utf8, QString *decoded)
{
    if (decoded == nullptr || utf8.data() == nullptr || utf8.empty()
        || utf8.size() > kMaxTimelineTextBytes) {
        return false;
    }

    const QString candidate = QString::fromUtf8(
        utf8.data(),
        static_cast<qsizetype>(utf8.size()));
    const QByteArray roundTrip = candidate.toUtf8();
    if (roundTrip.size() != static_cast<qsizetype>(utf8.size())
        || std::memcmp(
               roundTrip.constData(),
               utf8.data(),
               utf8.size())
            != 0) {
        return false;
    }
    *decoded = candidate;
    return true;
}

bool isAscii(std::string_view utf8)
{
    for (const unsigned char byte : utf8) {
        if (byte >= 0x80U) {
            return false;
        }
    }
    return true;
}

bool coversText(
    const CavalrySkiaRuntimeApi &api,
    const void *typeface,
    const QString &text)
{
    if (typeface == nullptr || api.unicharToGlyph == nullptr) {
        return false;
    }
    for (const uint codePoint : text.toUcs4()) {
        if (!isIgnorableGlyphCheck(codePoint)
            && api.unicharToGlyph(
                   typeface,
                   static_cast<std::int32_t>(codePoint))
                == 0) {
            return false;
        }
    }
    return true;
}

void *fontTypeface(const void *font)
{
    if (font == nullptr) {
        return nullptr;
    }
    void *typeface = nullptr;
    std::memcpy(&typeface, font, sizeof(typeface));
    return typeface;
}

} // namespace

struct CavalrySkiaTimelineFontFallback::Impl final {
    CavalrySkiaRuntimeApi api {};
    std::shared_ptr<const CavalrySkiaRuntimeAbi> runtimeAbi;
    std::vector<void *> candidates;

    ~Impl()
    {
        for (void *candidate : candidates) {
            releaseTypeface(candidate);
        }
    }
};

CavalrySkiaTimelineFontFallback::CavalrySkiaTimelineFontFallback(
    std::unique_ptr<Impl> impl)
    : impl_(std::move(impl))
{
}

CavalrySkiaTimelineFontFallback::~CavalrySkiaTimelineFontFallback() = default;

std::unique_ptr<CavalrySkiaTimelineFontFallback>
CavalrySkiaTimelineFontFallback::createWithApi(
    const QString &language,
    CavalrySkiaRuntimeApi api,
    std::shared_ptr<const CavalrySkiaRuntimeAbi> runtimeAbi,
    QString *detail)
{
    if (detail != nullptr) {
        detail->clear();
    }
    if (api.makeTypefaceFromName == nullptr
        || api.unicharToGlyph == nullptr) {
        if (detail != nullptr) {
            *detail = QStringLiteral(
                "Timeline font fallback requires the verified Skia font ABI.");
        }
        return nullptr;
    }

    const std::vector<QByteArray> families = candidateFamilies(language);
    if (families.empty()) {
        if (detail != nullptr) {
            *detail = QStringLiteral(
                "Timeline font fallback has no candidate family for this language.");
        }
        return nullptr;
    }

    std::unique_ptr<Impl> impl;
    try {
        impl = std::make_unique<Impl>();
        impl->api = api;
        impl->runtimeAbi = std::move(runtimeAbi);
        impl->candidates.reserve(families.size());

        for (const QByteArray &family : families) {
            void *candidate = nullptr;
            api.makeTypefaceFromName(
                &candidate,
                family.constData(),
                kNormalSkFontStyle);
            if (candidate == nullptr) {
                continue;
            }
            try {
                impl->candidates.push_back(candidate);
            } catch (...) {
                releaseTypeface(candidate);
                throw;
            }
        }
    } catch (...) {
        if (detail != nullptr) {
            *detail = QStringLiteral(
                "Timeline font fallback candidate creation failed.");
        }
        return nullptr;
    }

    if (impl == nullptr || impl->candidates.empty()) {
        if (detail != nullptr) {
            *detail = QStringLiteral(
                "No installed timeline fallback font candidate could be created.");
        }
        return nullptr;
    }
    return std::unique_ptr<CavalrySkiaTimelineFontFallback>(
        new CavalrySkiaTimelineFontFallback(std::move(impl)));
}

std::unique_ptr<CavalrySkiaTimelineFontFallback>
CavalrySkiaTimelineFontFallback::create(
    const QString &language,
    QString *detail)
{
    if (detail != nullptr) {
        detail->clear();
    }
    const std::shared_ptr<const CavalrySkiaRuntimeAbi> runtimeAbi =
        CavalrySkiaRuntimeAbi::verifyAndPin(detail);
    if (runtimeAbi == nullptr) {
        return nullptr;
    }
    return createWithApi(
        language,
        runtimeAbi->api(),
        runtimeAbi,
        detail);
}

#ifdef CAVALRY_I18N_TESTING
std::unique_ptr<CavalrySkiaTimelineFontFallback>
CavalrySkiaTimelineFontFallback::createForTesting(
    const QString &language,
    const CavalrySkiaRuntimeApi &api,
    QString *detail)
{
    return createWithApi(language, api, nullptr, detail);
}
#endif

CavalrySkiaTimelineFontFallback::Selection
CavalrySkiaTimelineFontFallback::selectFont(
    const void *sourceFont,
    std::string_view utf8Text,
    std::array<std::byte, 0x18> *borrowedFont) const noexcept
{
    const Selection forward { sourceFont, false };
    if (impl_ == nullptr || sourceFont == nullptr || borrowedFont == nullptr
        || static_cast<const void *>(borrowedFont->data()) == sourceFont
        || impl_->api.unicharToGlyph == nullptr
        || utf8Text.data() == nullptr || utf8Text.empty()
        || utf8Text.size() > kMaxTimelineTextBytes || isAscii(utf8Text)) {
        return forward;
    }

    try {
        QString text;
        if (!decodeStrictUtf8(utf8Text, &text)) {
            return forward;
        }

        const void *sourceTypeface = fontTypeface(sourceFont);
        if (sourceTypeface == nullptr
            || coversText(impl_->api, sourceTypeface, text)) {
            return forward;
        }

        for (void *candidate : impl_->candidates) {
            if (candidate == nullptr || candidate == sourceTypeface
                || !coversText(impl_->api, candidate, text)) {
                continue;
            }
            std::memcpy(borrowedFont->data(), sourceFont, kSkFontSize);
            std::memcpy(
                borrowedFont->data(),
                &candidate,
                sizeof(candidate));
            return { borrowedFont->data(), true };
        }
    } catch (...) {
        return forward;
    }
    return forward;
}
