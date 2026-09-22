/**
 * [INPUT]: Windows x64 的 SkTypeface 引用计数布局，以及当前语言的系统字体名称
 * [OUTPUT]: 提供按当前语言优先并追加跨语 UI 字体的候选表、SkTypeface 引用操作、24 字节 SkFont 常量和空白 glyph 判断
 * [POS]: injector/windows 两个 Skia 字体消费者共用的最小所有权与候选边界；不创建或缓存用户文本
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <QtCore/QByteArray>
#include <QtCore/QChar>
#include <QtCore/QString>

#include <cstddef>
#include <cstdint>
#include <vector>

namespace cavalry_i18n::skia_typeface {

constexpr std::uint32_t kNormalSkFontStyle = 0x00050190;
constexpr std::size_t kSkTypefaceRefCountOffset = 0x08;
constexpr std::size_t kSkFontSize = 0x18;

static_assert(sizeof(void *) == 0x08, "SkTypeface ABI is x64 only.");

using SkRefCntDeletingDestructor = void(__fastcall *)(void *);

inline void addTypefaceReference(void *typeface)
{
    auto *refCount = reinterpret_cast<volatile LONG *>(
        static_cast<std::byte *>(typeface) + kSkTypefaceRefCountOffset);
    InterlockedIncrement(refCount);
}

inline void releaseTypeface(void *typeface)
{
    if (typeface == nullptr) {
        return;
    }
    auto *refCount = reinterpret_cast<volatile LONG *>(
        static_cast<std::byte *>(typeface) + kSkTypefaceRefCountOffset);
    if (InterlockedDecrement(refCount) != 0) {
        return;
    }
    auto **vtable = *reinterpret_cast<void ***>(typeface);
    const auto deletingDestructor =
        reinterpret_cast<SkRefCntDeletingDestructor>(vtable[1]);
    deletingDestructor(typeface);
}

inline std::vector<QByteArray> candidateFamilies(const QString &language)
{
    const std::vector<QByteArray> zhHansFamilies {
        QByteArrayLiteral("Microsoft YaHei UI"),
        QByteArrayLiteral("Microsoft YaHei"),
        QByteArrayLiteral("Noto Sans CJK SC"),
        QByteArrayLiteral("Noto Sans SC"),
        QByteArrayLiteral("SimSun"),
    };
    const std::vector<QByteArray> zhHantFamilies {
        QByteArrayLiteral("Microsoft JhengHei UI"),
        QByteArrayLiteral("Microsoft JhengHei"),
        QByteArrayLiteral("Noto Sans CJK TC"),
        QByteArrayLiteral("Noto Sans TC"),
        QByteArrayLiteral("Microsoft YaHei UI"),
    };
    const std::vector<QByteArray> jaFamilies {
        QByteArrayLiteral("Yu Gothic UI"),
        QByteArrayLiteral("Yu Gothic"),
        QByteArrayLiteral("Meiryo UI"),
        QByteArrayLiteral("Meiryo"),
        QByteArrayLiteral("Noto Sans CJK JP"),
        QByteArrayLiteral("Noto Sans JP"),
    };

    std::size_t primaryIndex = 0;
    if (language == QStringLiteral("zh-Hans")) {
        primaryIndex = 0;
    } else if (language == QStringLiteral("zh-Hant")) {
        primaryIndex = 1;
    } else if (language == QStringLiteral("ja_JP")) {
        primaryIndex = 2;
    } else {
        return {};
    }

    const std::vector<QByteArray> *profiles[] {
        &zhHansFamilies,
        &zhHantFamilies,
        &jaFamilies,
    };

    std::vector<QByteArray> families = *profiles[primaryIndex];
    const auto appendUnique = [&families](const QByteArray &candidate) {
        for (const QByteArray &existing : families) {
            if (existing == candidate) {
                return;
            }
        }
        families.push_back(candidate);
    };

    // 当前语言候选保持优先；其余已验证语言的完整系统字体列表随后补充。
    for (std::size_t profileIndex = 0; profileIndex < 3; ++profileIndex) {
        if (profileIndex == primaryIndex) {
            continue;
        }
        for (const QByteArray &candidate : *profiles[profileIndex]) {
            appendUnique(candidate);
        }
    }
    return families;
}

inline bool isIgnorableGlyphCheck(std::uint32_t codePoint)
{
    if (codePoint <= 0x20) {
        return true;
    }
    const QChar::Category category = QChar::category(codePoint);
    return category == QChar::Separator_Space
        || category == QChar::Separator_Line
        || category == QChar::Separator_Paragraph;
}

} // namespace cavalry_i18n::skia_typeface
