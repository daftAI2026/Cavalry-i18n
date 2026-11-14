/**
 * [INPUT]: 依赖官方Save/Open source字串、native locale快照与Qt QString公开接口。
 * [OUTPUT]: 精确映射Save captions及281 Load .cv，并单次转发Qt原调用。
 * [POS]: 纯适配策略；未知caller、未知caption和非目标locale保留原值。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstdint>
#include <string_view>
#include <utility>

#include <QtCore/QString>

#include "native_locale_snapshot.h"

namespace native_save_scene_caption {
inline std::string_view translatedText(
    const QString &source, cavalry_native_font::Locale locale)
{
    if (source == QStringLiteral("Save Scene")) {
        switch (locale) {
            case cavalry_native_font::Locale::Hans: return "保存场景";
            case cavalry_native_font::Locale::Hant: return "儲存場景";
            case cavalry_native_font::Locale::Japanese: return "シーンを保存";
            case cavalry_native_font::Locale::Unset:
            case cavalry_native_font::Locale::English:
            case cavalry_native_font::Locale::Unknown: return {};
        }
    }
    if (source == QStringLiteral("Save as .cv")) {
        switch (locale) {
            case cavalry_native_font::Locale::Hans: return "保存为工程文件";
            case cavalry_native_font::Locale::Hant: return "儲存為專案檔";
            case cavalry_native_font::Locale::Japanese:
                return "プロジェクトファイルとして保存";
            case cavalry_native_font::Locale::Unset:
            case cavalry_native_font::Locale::English:
            case cavalry_native_font::Locale::Unknown: return {};
        }
    }
    return {};
}

inline std::string_view translatedOpenCaption(
    const QString &source, cavalry_native_font::Locale locale)
{
    if (source != QStringLiteral("Load .cv")) return {};
    switch (locale) {
        case cavalry_native_font::Locale::Hans: return "加载工程文件";
        case cavalry_native_font::Locale::Hant: return "載入專案檔案";
        case cavalry_native_font::Locale::Japanese: return ".cv を読み込み";
        case cavalry_native_font::Locale::Unset:
        case cavalry_native_font::Locale::English:
        case cavalry_native_font::Locale::Unknown: return {};
    }
    return {};
}

template<typename Original, typename LocaleGetter,
         typename Parent, typename Options>
QString forwardSaveCaption(
    Original &&original, bool contractReady, std::uintptr_t callerReturnPc,
    std::uintptr_t expectedReturnPc, Parent *parent, const QString &caption,
    const QString &directory, const QString &filter, QString *selectedFilter,
    Options options, LocaleGetter &&locale)
{
    std::string_view projection;
    if (contractReady && callerReturnPc == expectedReturnPc &&
        (caption == QStringLiteral("Save Scene") ||
         caption == QStringLiteral("Save as .cv"))) {
        projection = translatedText(
            caption, std::forward<LocaleGetter>(locale)());
    }
    if (projection.empty())
        return std::forward<Original>(original)(
            parent, caption, directory, filter, selectedFilter, options);

    const QString localized = QString::fromUtf8(
        projection.data(), static_cast<qsizetype>(projection.size()));
    return std::forward<Original>(original)(
        parent, localized, directory, filter, selectedFilter, options);
}

template<typename Original, typename LocaleGetter,
         typename Parent, typename Options>
QString forwardOpenCaption(
    Original &&original, bool contractReady, std::uintptr_t callerReturnPc,
    std::uintptr_t expectedReturnPc, Parent *parent, const QString &caption,
    const QString &directory, const QString &filter, QString *selectedFilter,
    Options options, LocaleGetter &&locale)
{
    std::string_view projection;
    if (contractReady && callerReturnPc == expectedReturnPc &&
        caption == QStringLiteral("Load .cv")) {
        projection = translatedOpenCaption(
            caption, std::forward<LocaleGetter>(locale)());
    }
    if (projection.empty())
        return std::forward<Original>(original)(
            parent, caption, directory, filter, selectedFilter, options);

    const QString localized = QString::fromUtf8(
        projection.data(), static_cast<qsizetype>(projection.size()));
    return std::forward<Original>(original)(
        parent, localized, directory, filter, selectedFilter, options);
}
}  // namespace native_save_scene_caption
