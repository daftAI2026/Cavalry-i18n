/**
 * [INPUT]: cavalry_i18n_timeline_font_fallback.h 的已验证 Skia ABI seam，以及测试用 fake typeface/glyph 表
 * [OUTPUT]: 锁定 SkTimeEditorView 无 fallback 的复现、三种语言的有界按调用字体选择、24 字节保留、forward 与释放合同
 * [POS]: injector/windows 时间轴字体 fallback 的专用合同测试；不加载 vendor DLL、不执行诊断 hook、不写 paint/IO
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_skia_runtime_abi.h"

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
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <initializer_list>
#include <memory>
#include <string>
#include <string_view>

#if __has_include("cavalry_i18n_timeline_font_fallback.h")
#include "cavalry_i18n_timeline_font_fallback.h"
#else
class CavalrySkiaTimelineFontFallback final
{
public:
    struct Selection final {
        const void *font = nullptr;
        bool usedFallback = false;
    };

    static std::unique_ptr<CavalrySkiaTimelineFontFallback>
    createForTesting(
        const QString &,
        const CavalrySkiaRuntimeApi &,
        QString *)
    {
        return std::unique_ptr<CavalrySkiaTimelineFontFallback>(
            new CavalrySkiaTimelineFontFallback);
    }

    Selection selectFont(
        const void *sourceFont,
        std::string_view,
        std::array<std::byte, 0x18> *) const noexcept
    {
        return { sourceFont, false };
    }
};
#endif

namespace {

constexpr std::size_t kSkFontSize = 0x18;
constexpr std::size_t kMaxTimelineTextBytes = 4096;
constexpr std::uint32_t kHanSimplified = 1U << 0;
constexpr std::uint32_t kHanTraditional = 1U << 1;
constexpr std::uint32_t kJapanese = 1U << 2;
constexpr std::uint32_t kAscii = 1U << 3;

struct FakeRuntimeState;

struct FakeTypeface final {
    void **vtable = nullptr;
    LONG references = 1;
    std::uint32_t coverage = 0;
    FakeRuntimeState *owner = nullptr;
};

static_assert(offsetof(FakeTypeface, references) == 0x08);
static_assert(sizeof(void *) == 0x08);

struct FakeRuntimeState final {
    bool failCandidates = false;
    std::uint32_t candidateCoverage = kAscii | kHanSimplified
        | kHanTraditional | kJapanese;
    int created = 0;
    int destroyed = 0;
    int makeCalls = 0;
    int glyphCalls = 0;
};

FakeRuntimeState *gFakeRuntime = nullptr;

std::string utf8Bytes(std::initializer_list<unsigned int> bytes)
{
    std::string result;
    result.reserve(bytes.size());
    for (const unsigned int byte : bytes) {
        result.push_back(static_cast<char>(byte));
    }
    return result;
}

void __fastcall destroyFakeTypeface(void *raw)
{
    auto *face = static_cast<FakeTypeface *>(raw);
    if (face == nullptr) {
        return;
    }
    if (face->owner != nullptr) {
        ++face->owner->destroyed;
    }
    delete face;
}

void **fakeTypefaceVtable()
{
    static void *vtable[2] = {
        nullptr,
        reinterpret_cast<void *>(&destroyFakeTypeface),
    };
    return vtable;
}

bool isHanSimplified(std::int32_t codePoint)
{
    return codePoint == 0x4E2D || codePoint == 0x6587;
}

bool isHanTraditional(std::int32_t codePoint)
{
    return codePoint == 0x7E41 || codePoint == 0x9AD4;
}

bool isJapanese(std::int32_t codePoint)
{
    return codePoint == 0x65E5 || codePoint == 0x672C
        || codePoint == 0x8A9E;
}

std::uint16_t fakeGlyph(
    const void *raw,
    std::int32_t codePoint)
{
    const auto *face = static_cast<const FakeTypeface *>(raw);
    if (face == nullptr) {
        return 0;
    }
    if (face->owner != nullptr) {
        ++face->owner->glyphCalls;
    }
    if (codePoint >= 0x20 && codePoint <= 0x7E) {
        return (face->coverage & kAscii) != 0 ? 1 : 0;
    }
    if (isHanSimplified(codePoint)) {
        return (face->coverage & kHanSimplified) != 0 ? 2 : 0;
    }
    if (isHanTraditional(codePoint)) {
        return (face->coverage & kHanTraditional) != 0 ? 3 : 0;
    }
    if (isJapanese(codePoint)) {
        return (face->coverage & kJapanese) != 0 ? 4 : 0;
    }
    return 0;
}

void *fakeMakeTypeface(
    void **result,
    const char *,
    std::uint32_t)
{
    if (result == nullptr || gFakeRuntime == nullptr) {
        return nullptr;
    }
    *result = nullptr;
    ++gFakeRuntime->makeCalls;
    if (gFakeRuntime->failCandidates) {
        return nullptr;
    }
    auto *face = new FakeTypeface;
    face->vtable = fakeTypefaceVtable();
    face->references = 1;
    face->coverage = gFakeRuntime->candidateCoverage;
    face->owner = gFakeRuntime;
    ++gFakeRuntime->created;
    *result = face;
    return face;
}

CavalrySkiaRuntimeApi fakeApi()
{
    CavalrySkiaRuntimeApi api;
    api.makeTypefaceFromName = &fakeMakeTypeface;
    api.unicharToGlyph = &fakeGlyph;
    return api;
}

FakeTypeface makeSource(FakeRuntimeState *owner)
{
    FakeTypeface source;
    source.vtable = fakeTypefaceVtable();
    source.references = 701;
    source.coverage = kAscii;
    source.owner = owner;
    return source;
}

using FontBytes = std::array<std::byte, kSkFontSize>;

FontBytes makeSourceFont(FakeTypeface *source)
{
    FontBytes font {};
    const void *typeface = source;
    std::memcpy(font.data(), &typeface, sizeof(typeface));
    const float pointSize = 12.0F;
    std::memcpy(
        font.data() + sizeof(typeface),
        &pointSize,
        sizeof(pointSize));
    for (std::size_t index = sizeof(typeface) + sizeof(pointSize);
         index < font.size();
         ++index) {
        font[index] = static_cast<std::byte>(0x30U + index);
    }
    return font;
}

void *fontTypeface(const FontBytes &font)
{
    void *typeface = nullptr;
    std::memcpy(&typeface, font.data(), sizeof(typeface));
    return typeface;
}

bool sameBytes(const FontBytes &left, const FontBytes &right)
{
    return std::memcmp(left.data(), right.data(), left.size()) == 0;
}

bool check(
    bool condition,
    const char *message)
{
    if (!condition) {
        qCritical().noquote() << message;
        return false;
    }
    return true;
}

std::unique_ptr<CavalrySkiaTimelineFontFallback> makeFallback(
    FakeRuntimeState *state,
    const QString &language)
{
    gFakeRuntime = state;
    QString detail;
    return CavalrySkiaTimelineFontFallback::createForTesting(
        language,
        fakeApi(),
        &detail);
}

bool verifyOldNoFallbackFailure()
{
    FakeRuntimeState state;
    FakeTypeface source = makeSource(&state);
    const FontBytes sourceFont = makeSourceFont(&source);
    const std::string text = utf8Bytes({ 'A', 0xE4, 0xB8, 0xAD });
    const auto *sourceTypeface = static_cast<const void *>(
        fontTypeface(sourceFont));

    if (!check(
            fakeGlyph(sourceTypeface, 0x4E2D) == 0,
            "baseline source face unexpectedly covers U+4E2D")) {
        return false;
    }

    // 旧 SkTimeEditorView 路径把同一个 SkFont 同时交给 measure/draw；没有
    // fallback 时它只能保留 source face，因此中文 glyph 必然为空。
    const void *oldMeasureFont = sourceTypeface;
    const void *oldDrawFont = sourceTypeface;
    return check(
        oldMeasureFont == oldDrawFont
            && fakeGlyph(oldMeasureFont, 0x4E2D) == 0
            && text.size() == 4,
        "old no-fallback timeline path did not reproduce the missing glyph");
}

bool verifyAsciiUnchanged()
{
    FakeRuntimeState state;
    FakeTypeface source = makeSource(&state);
    const FontBytes sourceFont = makeSourceFont(&source);
    const FontBytes sourceBefore = sourceFont;
    const std::string text = "Timeline 42";
    const std::string textBefore = text;
    auto fallback = makeFallback(&state, QStringLiteral("zh-Hans"));
    if (!check(fallback != nullptr, "zh-Hans fallback failed to initialize")) {
        return false;
    }

    FontBytes borrowed {};
    borrowed.fill(std::byte { 0xCC });
    const auto selection = fallback->selectFont(
        sourceFont.data(),
        text,
        &borrowed);
    return check(
        selection.font == sourceFont.data()
            && !selection.usedFallback
            && sameBytes(sourceFont, sourceBefore)
            && text == textBefore
            && fontTypeface(sourceFont) == &source,
        "ASCII timeline label changed source font/text or selected fallback");
}

bool verifyMixedCjkFallback()
{
    FakeRuntimeState state;
    FakeTypeface source = makeSource(&state);
    const FontBytes sourceFont = makeSourceFont(&source);
    const FontBytes sourceBefore = sourceFont;
    const std::string text = utf8Bytes({
        'A', 0xE4, 0xB8, 0xAD, 0xE6, 0x96, 0x87,
    });
    const std::string textBefore = text;
    auto fallback = makeFallback(&state, QStringLiteral("zh-Hans"));
    if (!check(fallback != nullptr, "mixed CJK fallback failed to initialize")) {
        return false;
    }

    FontBytes borrowed {};
    const auto selection = fallback->selectFont(
        sourceFont.data(),
        text,
        &borrowed);
    const void *selectedTypeface = fontTypeface(borrowed);
    return check(
        selection.font == borrowed.data()
            && selection.usedFallback
            && selectedTypeface != &source
            && fakeGlyph(selectedTypeface, 0x4E2D) != 0
            && fakeGlyph(selectedTypeface, 0x6587) != 0
            && std::memcmp(
                   borrowed.data() + sizeof(void *),
                   sourceFont.data() + sizeof(void *),
                   kSkFontSize - sizeof(void *))
                == 0
            && sameBytes(sourceFont, sourceBefore)
            && text == textBefore
            && source.references == 701,
        "mixed CJK did not use a borrowed fallback font while preserving source");
}

bool verifyAsciiBypassesMissingSourceGlyph()
{
    FakeRuntimeState state;
    FakeTypeface source = makeSource(&state);
    source.coverage = 0;
    const FontBytes sourceFont = makeSourceFont(&source);
    auto fallback = makeFallback(&state, QStringLiteral("zh-Hans"));
    if (!check(fallback != nullptr, "ASCII bypass fallback setup failed")) {
        return false;
    }

    FontBytes borrowed {};
    const auto selection = fallback->selectFont(
        sourceFont.data(),
        "ASCII despite a source face without glyphs",
        &borrowed);
    return check(
        selection.font == sourceFont.data()
            && !selection.usedFallback
            && state.glyphCalls == 0,
        "ASCII timeline text queried glyphs or selected fallback");
}

bool verifyCoveredSourceStaysOriginal()
{
    FakeRuntimeState state;
    FakeTypeface source = makeSource(&state);
    source.coverage = kAscii | kHanSimplified | kHanTraditional | kJapanese;
    const FontBytes sourceFont = makeSourceFont(&source);
    const FontBytes sourceBefore = sourceFont;
    auto fallback = makeFallback(&state, QStringLiteral("zh-Hans"));
    if (!check(fallback != nullptr, "covered-source fallback setup failed")) {
        return false;
    }

    FontBytes borrowed {};
    const auto selection = fallback->selectFont(
        sourceFont.data(),
        utf8Bytes({ 'A', 0xE4, 0xB8, 0xAD, 0xE6, 0x96, 0x87 }),
        &borrowed);
    return check(
        selection.font == sourceFont.data()
            && !selection.usedFallback
            && sameBytes(sourceFont, sourceBefore)
            && fontTypeface(sourceFont) == &source,
        "source font was replaced even though it covered the full label");
}

bool verifyLanguages()
{
    struct LanguageCase final {
        const char *language;
        const char *text;
    };
    constexpr LanguageCase cases[] {
        { "zh-Hans", nullptr },
        { "zh-Hant", nullptr },
        { "ja_JP", nullptr },
    };
    for (const LanguageCase &testCase : cases) {
        FakeRuntimeState state;
        FakeTypeface source = makeSource(&state);
        const FontBytes sourceFont = makeSourceFont(&source);
        auto fallback = makeFallback(
            &state,
            QString::fromLatin1(testCase.language));
        if (!check(
                fallback != nullptr && state.makeCalls > 0,
                "language did not create startup font candidates")) {
            return false;
        }
        FontBytes borrowed {};
        const std::string text = std::string(testCase.language)
            == "zh-Hans"
            ? utf8Bytes({ 'A', 0xE4, 0xB8, 0xAD, 0xE6, 0x96, 0x87 })
            : std::string(testCase.language) == "zh-Hant"
                ? utf8Bytes({ 'A', 0xE7, 0xB9, 0x81, 0xE9, 0xAB, 0x94 })
                : utf8Bytes({ 'A', 0xE6, 0x97, 0xA5, 0xE6, 0x9C,
                              0xAC, 0xE8, 0xAA, 0x9E });
        const auto selection = fallback->selectFont(
            sourceFont.data(),
            text,
            &borrowed);
        if (!check(
                selection.font == borrowed.data()
                    && selection.usedFallback
                    && fontTypeface(borrowed) != &source,
                testCase.language)) {
            return false;
        }
    }
    return true;
}

bool verifyIncompleteCandidateForwards()
{
    FakeRuntimeState state;
    state.candidateCoverage = kAscii | kHanSimplified;
    FakeTypeface source = makeSource(&state);
    const FontBytes sourceFont = makeSourceFont(&source);
    const FontBytes sourceBefore = sourceFont;
    const std::string text = utf8Bytes({
        'A', 0xE4, 0xB8, 0xAD, 0xE6, 0x96, 0x87,
        0xE6, 0x97, 0xA5,
    });
    auto fallback = makeFallback(&state, QStringLiteral("zh-Hans"));
    if (!check(fallback != nullptr, "incomplete candidate setup failed")) {
        return false;
    }

    FontBytes borrowed {};
    borrowed.fill(std::byte { 0xA5 });
    const auto selection = fallback->selectFont(
        sourceFont.data(),
        text,
        &borrowed);
    return check(
        selection.font == sourceFont.data()
            && !selection.usedFallback
            && sameBytes(sourceFont, sourceBefore)
            && fontTypeface(sourceFont) == &source,
        "candidate with incomplete glyph coverage did not forward source font");
}

bool verifyInvalidEmptyAndSizeBoundary()
{
    FakeRuntimeState state;
    FakeTypeface source = makeSource(&state);
    const FontBytes sourceFont = makeSourceFont(&source);
    auto fallback = makeFallback(&state, QStringLiteral("zh-Hans"));
    if (!check(fallback != nullptr, "boundary fallback setup failed")) {
        return false;
    }

    const std::string invalidUtf8 = utf8Bytes({ 'A', 0xE4, 0xB8 });
    const std::string empty;
    std::string atBoundary(kMaxTimelineTextBytes - 3, 'A');
    atBoundary.append(utf8Bytes({ 0xE4, 0xB8, 0xAD }));
    std::string overBoundary(kMaxTimelineTextBytes - 3, 'A');
    overBoundary.append(utf8Bytes({ 0xE4, 0xB8, 0xAD }));
    overBoundary.push_back('A');

    for (const std::string &text : { invalidUtf8, empty }) {
        FontBytes borrowed {};
        const auto selection = fallback->selectFont(
            sourceFont.data(),
            text,
            &borrowed);
        if (!check(
                selection.font == sourceFont.data()
                    && !selection.usedFallback,
                "invalid UTF-8 or empty timeline text was not forwarded")) {
            return false;
        }
    }

    FontBytes atBoundaryFont {};
    const auto atBoundarySelection = fallback->selectFont(
        sourceFont.data(),
        atBoundary,
        &atBoundaryFont);
    if (!check(
            atBoundary.size() == kMaxTimelineTextBytes
                && atBoundarySelection.font == atBoundaryFont.data()
                && atBoundarySelection.usedFallback,
            "exact timeline text size boundary did not use a covered fallback")) {
        return false;
    }

    FontBytes overBoundaryFont {};
    const auto overBoundarySelection = fallback->selectFont(
        sourceFont.data(),
        overBoundary,
        &overBoundaryFont);
    return check(
        overBoundary.size() == kMaxTimelineTextBytes + 1
            && overBoundarySelection.font == sourceFont.data()
            && !overBoundarySelection.usedFallback,
        "over-bound timeline text was not forwarded without unbounded work");
}

bool verifyMeasureAndDrawChooseSameFont()
{
    FakeRuntimeState state;
    FakeTypeface source = makeSource(&state);
    const FontBytes sourceFont = makeSourceFont(&source);
    auto fallback = makeFallback(&state, QStringLiteral("zh-Hans"));
    if (!check(fallback != nullptr, "measure/draw fallback setup failed")) {
        return false;
    }

    const std::string text = utf8Bytes({ 'A', 0xE4, 0xB8, 0xAD });
    FontBytes measuredBytes {};
    FontBytes drawnBytes {};
    const auto measured = fallback->selectFont(
        sourceFont.data(),
        text,
        &measuredBytes);
    const auto drawn = fallback->selectFont(
        sourceFont.data(),
        text,
        &drawnBytes);
    return check(
        measured.usedFallback
            && drawn.usedFallback
            && measured.font == measuredBytes.data()
            && drawn.font == drawnBytes.data()
            && fontTypeface(measuredBytes) == fontTypeface(drawnBytes)
            && std::memcmp(
                   measuredBytes.data(),
                   drawnBytes.data(),
                   measuredBytes.size())
                == 0,
        "measure and draw selected different timeline fonts");
}

bool verifyCandidateFailureForwards()
{
    FakeRuntimeState state;
    state.failCandidates = true;
    FakeTypeface source = makeSource(&state);
    const FontBytes sourceFont = makeSourceFont(&source);
    gFakeRuntime = &state;
    QString detail;
    const auto fallback =
        CavalrySkiaTimelineFontFallback::createForTesting(
            QStringLiteral("zh-Hans"),
            fakeApi(),
            &detail);
    return check(
        fallback == nullptr && state.makeCalls > 0,
        "failed startup font candidates did not stay on the original path");
}

bool verifyTypefaceRelease()
{
    FakeRuntimeState state;
    FakeTypeface source = makeSource(&state);
    const FontBytes sourceFont = makeSourceFont(&source);
    {
        auto fallback = makeFallback(&state, QStringLiteral("ja_JP"));
        if (!check(fallback != nullptr, "release test fallback setup failed")) {
            return false;
        }
        FontBytes borrowed {};
        fallback->selectFont(
            sourceFont.data(),
            utf8Bytes({ 'A', 0xE6, 0x97, 0xA5, 0xE6, 0x9C, 0xAC }),
            &borrowed);
    }
    return check(
        state.created > 0
            && state.destroyed == state.created
            && source.references == 701,
        "fallback typefaces were not released without touching source font");
}

} // namespace

int main()
{
    const bool ok = verifyOldNoFallbackFailure()
        && verifyAsciiUnchanged()
        && verifyAsciiBypassesMissingSourceGlyph()
        && verifyMixedCjkFallback()
        && verifyCoveredSourceStaysOriginal()
        && verifyLanguages()
        && verifyIncompleteCandidateForwards()
        && verifyInvalidEmptyAndSizeBoundary()
        && verifyMeasureAndDrawChooseSameFont()
        && verifyCandidateFailureForwards()
        && verifyTypefaceRelease();
    gFakeRuntime = nullptr;
    return ok ? 0 : 1;
}
