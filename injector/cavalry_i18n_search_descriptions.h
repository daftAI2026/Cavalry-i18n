/**
 * [INPUT]: 依赖 Qt 6 QHash/QString/QStringList，以及生成式三语 nodeInfo/layerInfo 反向表
 * [OUTPUT]: 对外提供 quickAddEnglishDescriptionAliases(language, localizedDescription)，按完整 QLabel 说明返回所有英文别名；未知语言/说明返回空列表
 * [POS]: injector 的 Add Layer 描述搜索读取层；仅建立 owner helper 请求的只读索引，不进入通用翻译 fallback，不改写 QLabel、查询、role 或模型 identity
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QHash>
#include <QtCore/QString>
#include <QtCore/QStringList>

namespace cavalry_i18n {

struct QuickAddDescriptionEntry {
    const char *localizedDescription;
    const char *englishDescription;
};

#include "generated_quick_add_descriptions.inc"

using QuickAddDescriptionAliasMap = QHash<QString, QStringList>;

/* -------------------------------------------------------------------------
 * | 说明全文是反向索引的 key；不做 trim、翻译 fallback 或模糊猜测。      |
 * | 目标是让 Classic 的显示层文本获得英文搜索别名，而不是重写显示层。 |
 * ------------------------------------------------------------------------- */
inline void appendQuickAddDescriptionAliasEntries(
    QuickAddDescriptionAliasMap &aliases,
    const QuickAddDescriptionEntry *entries,
    int count)
{
    for (int index = 0; index < count; ++index) {
        const QuickAddDescriptionEntry &entry = entries[index];
        const QString localized = QString::fromUtf8(entry.localizedDescription);
        const QString english = QString::fromUtf8(entry.englishDescription);
        QStringList &values = aliases[localized];
        if (!values.contains(english)) {
            values.append(english);
        }
    }
}

inline QuickAddDescriptionAliasMap buildQuickAddDescriptionAliasMap(
    const QuickAddDescriptionEntry *entries,
    int count)
{
    QuickAddDescriptionAliasMap aliases;
    aliases.reserve(count);
    appendQuickAddDescriptionAliasEntries(aliases, entries, count);
    return aliases;
}

inline const QuickAddDescriptionAliasMap &quickAddDescriptionAliasesForLanguage(
    const QString &language)
{
    if (language == QStringLiteral("en")) {
        static const QuickAddDescriptionAliasMap aliases =
            buildQuickAddDescriptionAliasMap(
                kQuickAddEnglishDescriptionEntries,
                kQuickAddEnglishDescriptionEntriesCount);
        return aliases;
    }
    if (language == QStringLiteral("zh-Hans")) {
        static const QuickAddDescriptionAliasMap aliases = [] {
            QuickAddDescriptionAliasMap result =
                buildQuickAddDescriptionAliasMap(
                    kQuickAddEnglishDescriptionEntries,
                    kQuickAddEnglishDescriptionEntriesCount);
            appendQuickAddDescriptionAliasEntries(
                result,
                kZhHansQuickAddDescriptionEntries,
                kZhHansQuickAddDescriptionEntriesCount);
            return result;
        }();
        return aliases;
    }
    if (language == QStringLiteral("zh-Hant")) {
        static const QuickAddDescriptionAliasMap aliases = [] {
            QuickAddDescriptionAliasMap result =
                buildQuickAddDescriptionAliasMap(
                    kQuickAddEnglishDescriptionEntries,
                    kQuickAddEnglishDescriptionEntriesCount);
            appendQuickAddDescriptionAliasEntries(
                result,
                kZhHantQuickAddDescriptionEntries,
                kZhHantQuickAddDescriptionEntriesCount);
            return result;
        }();
        return aliases;
    }
    if (language == QStringLiteral("ja_JP")) {
        static const QuickAddDescriptionAliasMap aliases = [] {
            QuickAddDescriptionAliasMap result =
                buildQuickAddDescriptionAliasMap(
                    kQuickAddEnglishDescriptionEntries,
                    kQuickAddEnglishDescriptionEntriesCount);
            appendQuickAddDescriptionAliasEntries(
                result,
                kJaQuickAddDescriptionEntries,
                kJaQuickAddDescriptionEntriesCount);
            return result;
        }();
        return aliases;
    }

    static const QuickAddDescriptionAliasMap empty;
    return empty;
}

inline QStringList quickAddEnglishDescriptionAliases(
    const QString &language,
    const QString &localizedDescription)
{
    return quickAddDescriptionAliasesForLanguage(language).value(
        localizedDescription);
}

} // namespace cavalry_i18n
