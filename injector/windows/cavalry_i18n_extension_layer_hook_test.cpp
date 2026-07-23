/**
 * [INPUT]: 依赖 ExtensionLayer helper/placeholder 静态合同、三语嵌入 translator 与无厂商模块的 Qt Core 进程
 * [OUTPUT]: 对外验证九条 helper、十三条 placeholder（含 Snippet）三语投影、表内非白名单/动态文本拒绝与缺少 ExtensionLayer 时的无副作用延迟回退
 * [POS]: injector/windows 的 hook 行为合同测试；不加载 Cavalry DLL、不改 IAT，只锁住安全的 helper/placeholder 文本边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_hook.h"
#include "cavalry_i18n_extension_layer_sources.h"
#include "cavalry_i18n_translator.h"

#include <QtCore/QByteArray>
#include <QtCore/QCoreApplication>
#include <QtCore/QDebug>
#include <QtCore/QString>

namespace {

bool expectEqual(
    const QString &scenario,
    const QString &actual,
    const QString &expected)
{
    if (actual == expected) {
        return true;
    }

    qCritical().noquote()
        << QStringLiteral("%1: expected '%2', got '%3'.")
               .arg(scenario, expected, actual);
    return false;
}

bool expectEmpty(
    const QString &scenario,
    const CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    return expectEqual(
        scenario,
        CavalryExtensionLayerHook::translationForWhitelistedSource(
            translator,
            source),
        QString());
}

bool expectPlaceholderEmpty(
    const QString &scenario,
    const CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    return expectEqual(
        scenario,
        CavalryExtensionLayerHook::translationForPlaceholderSource(
            translator,
            source),
        QString());
}

bool verifyLanguage(const QString &language)
{
    CavalryEmbeddedTranslator translator(language);
    for (const char *sourceText
         : cavalry_i18n::extension_layer_contract::kStaticHelperSources) {
        const QString source = QString::fromLatin1(sourceText);
        const QByteArray sourceUtf8 = source.toUtf8();
        const QString expected = translator.translate(nullptr, sourceUtf8.constData());
        if (expected.isEmpty() || expected == source) {
            qCritical().noquote()
                << QStringLiteral("%1 lacks an embedded translation for '%2'.")
                       .arg(language, source);
            return false;
        }
        if (!expectEqual(
                language + QStringLiteral(": ") + source,
                CavalryExtensionLayerHook::translationForWhitelistedSource(
                    translator,
                    source),
                expected)) {
            return false;
        }
    }

    if (!expectEmpty(
            language + QStringLiteral(": Snippet remains outside helper coverage"),
            translator,
            QStringLiteral("Drag some JavaScript here to make a Snippet."))
        || !expectEmpty(
            language + QStringLiteral(": dynamic HelperHints is rejected"),
            translator,
            QStringLiteral("A runtime HelperHints value"))) {
        return false;
    }

    for (const char *sourceText
         : cavalry_i18n::extension_layer_contract::kStaticPlaceholderSources) {
        const QString source = QString::fromLatin1(sourceText);
        const QByteArray sourceUtf8 = source.toUtf8();
        const QString expected = translator.translate(nullptr, sourceUtf8.constData());
        if (expected.isEmpty() || expected == source) {
            qCritical().noquote()
                << QStringLiteral("%1 lacks an embedded placeholder translation for '%2'.")
                       .arg(language, source);
            return false;
        }
        if (!expectEqual(
                language + QStringLiteral(": placeholder: ") + source,
                CavalryExtensionLayerHook::translationForPlaceholderSource(
                    translator,
                    source),
                expected)) {
            return false;
        }
    }

    const QString generatedButUnapprovedSource =
        QStringLiteral("Drag layers here to see their settings.");
    const QByteArray generatedButUnapprovedUtf8 =
        generatedButUnapprovedSource.toUtf8();
    if (translator.translate(nullptr, generatedButUnapprovedUtf8.constData()).isEmpty()) {
        qCritical().noquote()
            << QStringLiteral("%1 fixture lacks a generated non-placeholder source.")
                   .arg(language);
        return false;
    }
    if (!expectPlaceholderEmpty(
            language + QStringLiteral(": generated non-placeholder source is rejected"),
            translator,
            generatedButUnapprovedSource)
        || !expectPlaceholderEmpty(
            language + QStringLiteral(": unknown placeholder source is rejected"),
            translator,
            QStringLiteral("A runtime placeholder value"))) {
        return false;
    }

    CavalryExtensionLayerHook hook(translator);
    if (hook.ensureInstalled() || !hook.isWaitingForModule()) {
        qCritical().noquote()
            << QStringLiteral("%1: hook did not defer missing ExtensionLayer.dll.")
                   .arg(language);
        return false;
    }
    return true;
}

} // namespace

int main(int argc, char *argv[])
{
    QCoreApplication application(argc, argv);

    return verifyLanguage(QStringLiteral("zh-Hans"))
            && verifyLanguage(QStringLiteral("zh-Hant"))
            && verifyLanguage(QStringLiteral("ja_JP"))
        ? 0
        : 1;
}
