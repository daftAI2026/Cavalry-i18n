/**
 * [INPUT]: 依赖共享 generated_translations.inc、跨平台 exact-only/macOS owner-only 查询策略与 cavalry_i18n_translator.h 的 Qt 接口
 * [OUTPUT]: 对外实现精确键首条优先、过滤自绘及任一平台来源绑定词条的 source-only 末条覆盖兜底与语言标签查询
 * [POS]: injector/windows 的翻译真相投影，复用跨平台同源生成数据；跨平台 scoped 词条仅交给本平台 owner/context 显示门，当前仅有 macOS producer 证据的共享词条在 Windows 采证前只能精确查询、不得全局回退
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_translator.h"

#include "../cavalry_i18n_translation_policy.h"

namespace {

struct TranslationEntry
{
    const char *context;
    const char *sourceText;
    const char *translation;
};

#include "../generated_translations.inc"

QByteArray exactTranslationKey(const char *context, const char *sourceText)
{
    QByteArray key(context);
    key.append('\0');
    key.append(sourceText);
    return key;
}

} // namespace

CavalryEmbeddedTranslator::CavalryEmbeddedTranslator(const QString &language)
    : language_(language)
{
    int count = 0;
    const TranslationEntry *entries = entriesForLanguage(language, &count);
    if (entries == nullptr || count <= 0) {
        return;
    }

    entryCount_ = count;
    exactTranslations_.reserve(count);
    sourceFallbacks_.reserve(count);

    for (int index = 0; index < count; ++index) {
        const TranslationEntry &entry = entries[index];
        if (entry.context == nullptr || entry.sourceText == nullptr
            || entry.translation == nullptr) {
            continue;
        }

        const QByteArray exactKey =
            exactTranslationKey(entry.context, entry.sourceText);
        if (!exactTranslations_.contains(exactKey)) {
            exactTranslations_.insert(
                exactKey,
                QString::fromUtf8(entry.translation));
        }

        if (!cavalry_i18n::requiresExactTranslationContext(
                entry.context,
                entry.sourceText)
            && !cavalry_i18n::requiresMacOwnerTranslationContext(
                entry.context,
                entry.sourceText)) {
            const QByteArray sourceKey(entry.sourceText);
            // source-only 兜底复用现有显示层缓存的末条覆盖语义；
            // 自绘和 Windows 来源绑定词条必须保留 context，不能泄漏到普通 QWidget。
            sourceFallbacks_.insert(
                sourceKey,
                QString::fromUtf8(entry.translation));
        }
    }
}

QString CavalryEmbeddedTranslator::translate(
    const char *context,
    const char *sourceText,
    const char *disambiguation,
    int n) const
{
    Q_UNUSED(disambiguation);
    Q_UNUSED(n);

    if (sourceText == nullptr) {
        return QString();
    }

    if (context != nullptr) {
        const auto exact = exactTranslations_.constFind(
            exactTranslationKey(context, sourceText));
        if (exact != exactTranslations_.constEnd()) {
            return exact.value();
        }
    }

    const auto fallback =
        sourceFallbacks_.constFind(QByteArray(sourceText));
    return fallback != sourceFallbacks_.constEnd()
        ? fallback.value()
        : QString();
}

bool CavalryEmbeddedTranslator::isEmpty() const
{
    return exactTranslations_.isEmpty();
}

int CavalryEmbeddedTranslator::entryCount() const
{
    return entryCount_;
}

int CavalryEmbeddedTranslator::exactKeyCount() const
{
    return exactTranslations_.size();
}

int CavalryEmbeddedTranslator::sourceFallbackCount() const
{
    return sourceFallbacks_.size();
}

QString CavalryEmbeddedTranslator::language() const
{
    return language_;
}
