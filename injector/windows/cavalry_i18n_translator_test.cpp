/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator 与 generated_translations.inc 中稳定存在的菜单样本
 * [OUTPUT]: 对外验证三语言嵌入、已证实 helper 提示的翻译表样本、精确查询、未知 context 的 source fallback、未知语言/文本空结果
 * [POS]: injector/windows 的最小数据合同测试，在进入真实 Cavalry 前证明 DLL 内翻译表不是空壳
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_translator.h"

#include <QtCore/QByteArray>
#include <QtCore/QDebug>
#include <QtCore/QString>
#include <QtCore/QStringList>

namespace {

bool expectEqual(
    const QString &actual,
    const QString &expected,
    const char *scenario)
{
    if (actual == expected) {
        return true;
    }

    qCritical().noquote()
        << QStringLiteral("%1: expected \"%2\", got \"%3\"")
               .arg(
                   QString::fromLatin1(scenario),
                   expected,
                   actual);
    return false;
}

bool verifyLanguage(
    const QString &language,
    const QString &expectedFileTranslation)
{
    const CavalryEmbeddedTranslator translator(language);
    if (translator.isEmpty()
        || translator.entryCount() <= 0
        || translator.exactKeyCount() <= 0
        || translator.sourceFallbackCount() <= 0) {
        qCritical().noquote()
            << QStringLiteral("%1 embedded table is empty.").arg(language);
        return false;
    }

    return expectEqual(
               translator.translate("QMenuBar", "File"),
               expectedFileTranslation,
               "exact context lookup")
        && expectEqual(
               translator.translate("UnknownContext", "File"),
               expectedFileTranslation,
               "source fallback lookup")
        && expectEqual(
               translator.translate("QMenuBar", "__missing_source__"),
               QString(),
               "missing source lookup");
}

bool verifyEmbeddedHelperTranslationSamples(
    const QString &language,
    const QStringList &expectedTranslations)
{
    const QStringList sources {
        QStringLiteral("Double click here to import Assets."),
        QStringLiteral("Drag layers here to see their settings."),
        QStringLiteral(
            "Use the Create menu to add a layer to your Composition."),
    };
    if (expectedTranslations.size() != sources.size()) {
        qCritical() << "Embedded helper translation fixture has an invalid size.";
        return false;
    }

    const CavalryEmbeddedTranslator translator(language);
    for (int index = 0; index < sources.size(); ++index) {
        const QByteArray sourceUtf8 = sources.at(index).toUtf8();
        if (!expectEqual(
                translator.translate(
                    "UnknownContext",
                    sourceUtf8.constData()),
                expectedTranslations.at(index),
                "embedded helper source fallback")) {
            return false;
        }
    }
    return true;
}

} // namespace

int main()
{
    if (!verifyLanguage(QStringLiteral("zh-Hans"), QStringLiteral("文件"))
        || !verifyLanguage(QStringLiteral("zh-Hant"), QStringLiteral("檔案"))
        || !verifyLanguage(QStringLiteral("ja_JP"), QStringLiteral("ファイル"))
        || !verifyEmbeddedHelperTranslationSamples(
            QStringLiteral("zh-Hans"),
            {
                QStringLiteral("双击此处以导入素材"),
                QStringLiteral("将图层拖到此处以查看其设置"),
                QStringLiteral("使用“创建”菜单将图层添加到合成中"),
            })
        || !verifyEmbeddedHelperTranslationSamples(
            QStringLiteral("zh-Hant"),
            {
                QStringLiteral("連按兩下此處以匯入素材"),
                QStringLiteral("將圖層拖曳至此以查看其設定"),
                QStringLiteral("使用「建立」選單將圖層新增至合成"),
            })
        || !verifyEmbeddedHelperTranslationSamples(
            QStringLiteral("ja_JP"),
            {
                QStringLiteral("ここをダブルクリックしてアセットをインポートします"),
                QStringLiteral("レイヤーをここにドラッグして設定を確認します"),
                QStringLiteral(
                    "「作成」メニューを使用してコンポジションにレイヤーを追加します"),
            })) {
        return 1;
    }

    const CavalryEmbeddedTranslator unsupported(
        QStringLiteral("__unsupported__"));
    if (!unsupported.isEmpty()
        || unsupported.entryCount() != 0
        || !unsupported.translate("QMenuBar", "File").isEmpty()) {
        qCritical() << "Unsupported language unexpectedly contains translations.";
        return 1;
    }

    const CavalryEmbeddedTranslator simplifiedChinese(
        QStringLiteral("zh-Hans"));
    if (!expectEqual(
            simplifiedChinese.translate(
                "MenuBarManager",
                "Rubber Hose Limb"),
            QStringLiteral("橡皮管肢体"),
            "exact first-match collision")
        || !expectEqual(
            simplifiedChinese.translate(
                "ModelDisplay",
                "Rubber Hose Limb"),
            QStringLiteral("软管肢体"),
            "exact context collision")
        || !expectEqual(
            simplifiedChinese.translate(
                "UnknownContext",
                "Rubber Hose Limb"),
            QStringLiteral("软管肢体"),
            "source fallback last-match collision")) {
        return 1;
    }

    return 0;
}
