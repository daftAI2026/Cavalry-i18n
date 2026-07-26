/**
 * [INPUT]: 依赖 cavalry_i18n_skia_text_path_renderer.h、已验证并 PIN 的 CavalrySkiaRuntimeAbi 函数表及系统 CJK 字体回退
 * [OUTPUT]: 对外实现语言定向字体选择、逐码点 glyph 门、Core 同构 Path 构造和侵入式 typeface 引用的有界所有权
 * [POS]: injector/windows 的 CJK 自绘实现；不自行发现或解析厂商 DLL，所有私有调用必须来自 runtime ABI 防火墙
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_skia_text_path_renderer.h"

#include "cavalry_i18n_skia_runtime_abi.h"

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
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <utility>

namespace {

constexpr std::uint32_t kNormalSkFontStyle = 0x00050190;
constexpr std::size_t kSkTypefaceRefCountOffset = 0x08;
constexpr std::size_t kSkFontSize = 0x18;
constexpr std::size_t kSkPathSize = 0x38;
constexpr std::size_t kCavalryPathFlagOffset = 0x38;
constexpr std::size_t kSkMatrixSize = 0x24;
constexpr int kSkTextEncodingUtf8 = 0;
constexpr int kSkApplyPerspectiveClipYes = 1;

using SkRefCntDeletingDestructor = void(__fastcall *)(void *);

void addTypefaceReference(void *typeface)
{
    auto *refCount = reinterpret_cast<volatile LONG *>(
        static_cast<std::byte *>(typeface)
        + kSkTypefaceRefCountOffset);
    InterlockedIncrement(refCount);
}

void releaseTypeface(void *typeface)
{
    if (typeface == nullptr) {
        return;
    }
    auto *refCount = reinterpret_cast<volatile LONG *>(
        static_cast<std::byte *>(typeface)
        + kSkTypefaceRefCountOffset);
    if (InterlockedDecrement(refCount) != 0) {
        return;
    }
    auto **vtable = *reinterpret_cast<void ***>(typeface);
    const auto deletingDestructor =
        reinterpret_cast<SkRefCntDeletingDestructor>(vtable[1]);
    deletingDestructor(typeface);
}

std::vector<QByteArray> candidateFamilies(const QString &language)
{
    if (language == QStringLiteral("zh-Hans")) {
        return {
            QByteArrayLiteral("Microsoft YaHei UI"),
            QByteArrayLiteral("Microsoft YaHei"),
            QByteArrayLiteral("Noto Sans CJK SC"),
            QByteArrayLiteral("Noto Sans SC"),
            QByteArrayLiteral("SimSun"),
        };
    }
    if (language == QStringLiteral("zh-Hant")) {
        return {
            QByteArrayLiteral("Microsoft JhengHei UI"),
            QByteArrayLiteral("Microsoft JhengHei"),
            QByteArrayLiteral("Noto Sans CJK TC"),
            QByteArrayLiteral("Noto Sans TC"),
            QByteArrayLiteral("Microsoft YaHei UI"),
        };
    }
    if (language == QStringLiteral("ja_JP")) {
        return {
            QByteArrayLiteral("Yu Gothic UI"),
            QByteArrayLiteral("Yu Gothic"),
            QByteArrayLiteral("Meiryo UI"),
            QByteArrayLiteral("Meiryo"),
            QByteArrayLiteral("Noto Sans CJK JP"),
            QByteArrayLiteral("Noto Sans JP"),
        };
    }
    return {};
}

bool isIgnorableGlyphCheck(std::uint32_t codePoint)
{
    if (codePoint <= 0x20) {
        return true;
    }
    const QChar::Category category = QChar::category(codePoint);
    return category == QChar::Separator_Space
        || category == QChar::Separator_Line
        || category == QChar::Separator_Paragraph;
}

bool coversAllRequiredText(
    const CavalrySkiaRuntimeApi &api,
    const void *typeface,
    const std::vector<std::string> &requiredTexts)
{
    for (const std::string &utf8 : requiredTexts) {
        const QString text = QString::fromUtf8(
            utf8.data(),
            static_cast<qsizetype>(utf8.size()));
        for (const uint codePoint : text.toUcs4()) {
            if (!isIgnorableGlyphCheck(codePoint)
                && api.unicharToGlyph(
                       typeface,
                       static_cast<std::int32_t>(codePoint))
                    == 0) {
                return false;
            }
        }
    }
    return true;
}

void clearFontTypeface(
    const CavalrySkiaRuntimeApi &,
    std::array<std::byte, kSkFontSize> *font)
{
    if (font == nullptr) {
        return;
    }
    void *&typeface = *reinterpret_cast<void **>(font->data());
    releaseTypeface(typeface);
    typeface = nullptr;
}

} // namespace

struct CavalrySkiaTextPathRenderer::Impl final {
    std::shared_ptr<const CavalrySkiaRuntimeAbi> runtimeAbi;
    void *typeface = nullptr;
    QString family;

    ~Impl()
    {
        releaseTypeface(typeface);
    }
};

CavalrySkiaTextPathRenderer::CavalrySkiaTextPathRenderer(
    std::unique_ptr<Impl> impl)
    : impl_(std::move(impl))
{
}

CavalrySkiaTextPathRenderer::~CavalrySkiaTextPathRenderer() = default;

std::shared_ptr<const CavalrySkiaTextPathRenderer>
CavalrySkiaTextPathRenderer::create(
    const QString &language,
    const std::vector<std::string> &requiredTexts,
    std::shared_ptr<const CavalrySkiaRuntimeAbi> runtimeAbi,
    QString *detail)
{
    if (detail != nullptr) {
        detail->clear();
    }
    if (requiredTexts.empty()) {
        if (detail != nullptr) {
            *detail = QStringLiteral(
                "CJK text-path renderer received no required translations.");
        }
        return {};
    }

    auto impl = std::make_unique<Impl>();
    impl->runtimeAbi = std::move(runtimeAbi);
    if (impl->runtimeAbi == nullptr) {
        if (detail != nullptr) {
            *detail = QStringLiteral(
                "CJK text-path renderer received no verified Core/skia ABI.");
        }
        return {};
    }
    const CavalrySkiaRuntimeApi &api = impl->runtimeAbi->api();

    // 只有完整覆盖本语言所有白名单译文的字体才允许进入 Path 分支。
    for (const QByteArray &family : candidateFamilies(language)) {
        void *candidate = nullptr;
        api.makeTypefaceFromName(
            &candidate,
            family.constData(),
            kNormalSkFontStyle);
        if (candidate == nullptr) {
            continue;
        }
        if (!coversAllRequiredText(api, candidate, requiredTexts)) {
            releaseTypeface(candidate);
            continue;
        }

        impl->typeface = candidate;
        impl->family = QString::fromUtf8(family);
        if (detail != nullptr) {
            *detail = QStringLiteral(
                "CJK text-path renderer selected '%1' after full glyph coverage validation.")
                .arg(impl->family);
        }
        return std::shared_ptr<const CavalrySkiaTextPathRenderer>(
            new CavalrySkiaTextPathRenderer(std::move(impl)));
    }

    if (detail != nullptr) {
        *detail = QStringLiteral(
            "No language-appropriate Windows font covers every approved CJK text-path translation.");
    }
    return {};
}

bool CavalrySkiaTextPathRenderer::makePath(
    void *pathStorage,
    const std::string &utf8Text,
    double pointSize) const noexcept
{
    if (impl_ == nullptr || impl_->runtimeAbi == nullptr
        || impl_->typeface == nullptr || pathStorage == nullptr
        || utf8Text.empty() || !std::isfinite(pointSize)
        || pointSize <= 0.0) {
        return false;
    }

    const CavalrySkiaRuntimeApi &api = impl_->runtimeAbi->api();
    alignas(16) std::array<std::byte, kSkFontSize> font {};
    alignas(16) std::array<std::byte, kSkPathSize> path {};
    alignas(16) std::array<std::byte, kSkMatrixSize> matrix {};
    bool pathConstructed = false;
    void *typefaceForFont = impl_->typeface;
    addTypefaceReference(typefaceForFont);

    try {
        api.makeScalableFont(
            font.data(),
            &typefaceForFont,
            static_cast<float>(pointSize));
        api.constructPath(path.data());
        pathConstructed = true;
        api.getPath(
            utf8Text.data(),
            utf8Text.size(),
            kSkTextEncodingUtf8,
            0.0F,
            0.0F,
            font.data(),
            path.data());
        api.setScale(matrix.data(), 1.0F, -1.0F);
        api.transformPath(
            path.data(),
            matrix.data(),
            path.data(),
            kSkApplyPerspectiveClipYes);
        if (api.isPathEmpty(path.data())) {
            api.destroyPath(path.data());
            pathConstructed = false;
            clearFontTypeface(api, &font);
            releaseTypeface(typefaceForFont);
            return false;
        }

        api.copyPath(pathStorage, path.data());
        *(static_cast<std::byte *>(pathStorage)
            + kCavalryPathFlagOffset) = std::byte { 0 };
        api.destroyPath(path.data());
        pathConstructed = false;
        clearFontTypeface(api, &font);
        releaseTypeface(typefaceForFont);
        return true;
    } catch (...) {
        if (pathConstructed) {
            api.destroyPath(path.data());
        }
        clearFontTypeface(api, &font);
        releaseTypeface(typefaceForFont);
        return false;
    }
}

QString CavalrySkiaTextPathRenderer::fontFamily() const
{
    return impl_ == nullptr ? QString() : impl_->family;
}
