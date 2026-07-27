/**
 * [INPUT]: 依赖 CavalryEmbeddedTranslator 与 generated_translations.inc 中稳定存在的菜单样本
 * [OUTPUT]: 对外验证三语嵌入、helper/残留 source fallback、CogTool Pitch exact-context 隔离、精确尾随空白及未知输入空结果
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
    const QString &expectedFileTranslation,
    const QString &expectedCloseDistanceTranslation)
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
               translator.language(),
               language,
               "language identity")
        && expectEqual(
               translator.translate("QMenuBar", "File"),
               expectedFileTranslation,
               "exact context lookup")
        && expectEqual(
               translator.translate("UnknownContext", "File"),
               expectedFileTranslation,
               "source fallback lookup")
        && expectEqual(
               translator.translate("UnknownContext", "Close Distance:"),
               expectedCloseDistanceTranslation,
               "dynamic toolbar label source fallback")
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

bool verifyEvidencedResidualTranslationSamples(
    const QString &language,
    const QStringList &expectedTranslations)
{
    const QStringList sources {
        QStringLiteral("Reveal in Finder"),
        QStringLiteral("Reveal in Finder..."),
        QStringLiteral("Palette Name:"),
        QStringLiteral("Set W3C Name"),
        QStringLiteral("Reveal in Explorer..."),
        QStringLiteral("New Name:"),
        QStringLiteral("Bookmark Name:"),
        QStringLiteral("This Scene has missing layer types:"),
        QStringLiteral("This Scene has corrupt References:"),
        QStringLiteral("This Scene has missing assets:"),
        QStringLiteral("This Scene has missing fonts:"),
        QStringLiteral(
            "Are you sure you want to delete the Render Item(s)?"),
        QStringLiteral("Delete Render Item(s)"),
        QStringLiteral("Soft Selection: "),
        QStringLiteral("Soft Selection Size: "),
        QStringLiteral("Stability Radius: "),
        QStringLiteral("Draw in 2.5D: "),
        QStringLiteral("Stroke Width"),
        QStringLiteral("Cap Style"),
        QStringLiteral("Line Style: "),
        QStringLiteral("Supervision Strength: "),
        QStringLiteral("Supervised: "),
        QStringLiteral("Show Grid: "),
        QStringLiteral("Preset: "),
        QStringLiteral("Pitch Radius: "),
    };
    if (expectedTranslations.size() != sources.size()) {
        qCritical() << "Residual translation fixture has an invalid size.";
        return false;
    }

    const CavalryEmbeddedTranslator translator(language);
    for (int index = 0; index < sources.size() - 1; ++index) {
        const QByteArray sourceUtf8 = sources.at(index).toUtf8();
        if (!expectEqual(
                translator.translate(
                    "UnknownContext",
                    sourceUtf8.constData()),
                expectedTranslations.at(index),
                "evidenced residual source fallback")) {
            return false;
        }
    }

    return expectEqual(
               translator.translate(
                   nullptr,
                   "Pitch Radius: "),
               QString(),
               "null-context Pitch Radius source rejection")
        && expectEqual(
               translator.translate(
                   "UnknownContext",
                   "Pitch Radius: "),
               QString(),
               "context-only Pitch Radius source rejection")
        && expectEqual(
               translator.translate(
                   "MeshToolSettings",
                   "Soft Selection: "),
               expectedTranslations.at(13),
               "exact trailing-space tool lookup")
        && expectEqual(
               translator.translate(
                   "TrackingToolSettings",
                   "Supervision Strength: "),
               expectedTranslations.at(20),
               "exact tracking popover lookup")
        && expectEqual(
               translator.translate(
                   "cavalry::PaletteListWidget",
                   "Palette Name:"),
               expectedTranslations.at(2),
               "exact palette dialog lookup")
        && expectEqual(
               translator.translate(
                   "CogTool",
                   "Pitch Radius: "),
               expectedTranslations.at(24),
               "exact CogTool pitch-radius prefix lookup");
}

} // namespace

int main()
{
    if (!verifyLanguage(
            QStringLiteral("zh-Hans"),
            QStringLiteral("文件"),
            QStringLiteral("闭合距离:"))
        || !verifyLanguage(
            QStringLiteral("zh-Hant"),
            QStringLiteral("檔案"),
            QStringLiteral("閉合距離:"))
        || !verifyLanguage(
            QStringLiteral("ja_JP"),
            QStringLiteral("ファイル"),
            QStringLiteral("閉じる距離:"))
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
            })
        || !verifyEvidencedResidualTranslationSamples(
            QStringLiteral("zh-Hans"),
            {
                QStringLiteral("在访达中显示"),
                QStringLiteral("在访达中显示..."),
                QStringLiteral("调色板名称:"),
                QStringLiteral("设置 W3C 名称"),
                QStringLiteral("在文件资源管理器中显示..."),
                QStringLiteral("新名称:"),
                QStringLiteral("书签名称:"),
                QStringLiteral("此场景缺少以下图层类型："),
                QStringLiteral("此场景包含损坏的引用："),
                QStringLiteral("此场景缺少素材："),
                QStringLiteral("此场景缺少字体："),
                QStringLiteral("确定要删除渲染项目吗？"),
                QStringLiteral("删除渲染项目"),
                QStringLiteral("软选择： "),
                QStringLiteral("软选择大小： "),
                QStringLiteral("稳定半径： "),
                QStringLiteral("在 2.5D 中绘制： "),
                QStringLiteral("描边宽度"),
                QStringLiteral("端头样式"),
                QStringLiteral("线条样式： "),
                QStringLiteral("监督强度： "),
                QStringLiteral("受监督： "),
                QStringLiteral("显示网格： "),
                QStringLiteral("预设： "),
                QStringLiteral("节圆半径： "),
            })
        || !verifyEvidencedResidualTranslationSamples(
            QStringLiteral("zh-Hant"),
            {
                QStringLiteral("在 Finder 中顯示"),
                QStringLiteral("在 Finder 中顯示..."),
                QStringLiteral("調色盤名稱:"),
                QStringLiteral("設定 W3C 名稱"),
                QStringLiteral("在檔案總管中顯示..."),
                QStringLiteral("新名稱:"),
                QStringLiteral("書籤名稱:"),
                QStringLiteral("此場景缺少以下圖層類型："),
                QStringLiteral("此場景包含損壞的參照："),
                QStringLiteral("此場景缺少素材："),
                QStringLiteral("此場景缺少字體："),
                QStringLiteral("確定要刪除算繪項目嗎？"),
                QStringLiteral("刪除算繪項目"),
                QStringLiteral("軟選擇： "),
                QStringLiteral("軟選擇大小： "),
                QStringLiteral("穩定半徑： "),
                QStringLiteral("在 2.5D 中繪製： "),
                QStringLiteral("描邊寬度"),
                QStringLiteral("端頭樣式"),
                QStringLiteral("線條樣式： "),
                QStringLiteral("監督強度： "),
                QStringLiteral("受監督： "),
                QStringLiteral("顯示網格： "),
                QStringLiteral("預設： "),
                QStringLiteral("節圓半徑： "),
            })
        || !verifyEvidencedResidualTranslationSamples(
            QStringLiteral("ja_JP"),
            {
                QStringLiteral("Finder に表示"),
                QStringLiteral("Finder に表示..."),
                QStringLiteral("パレット名:"),
                QStringLiteral("W3C 名を設定"),
                QStringLiteral("エクスプローラーで表示..."),
                QStringLiteral("新しい名前:"),
                QStringLiteral("ブックマーク名:"),
                QStringLiteral(
                    "このシーンに次のレイヤータイプがありません："),
                QStringLiteral(
                    "このシーンには破損した参照があります："),
                QStringLiteral(
                    "このシーンに不足しているアセットがあります："),
                QStringLiteral(
                    "このシーンに不足しているフォントがあります："),
                QStringLiteral(
                    "レンダリング項目を削除してもよろしいですか？"),
                QStringLiteral("レンダリング項目を削除"),
                QStringLiteral("ソフト選択： "),
                QStringLiteral("ソフト選択サイズ： "),
                QStringLiteral("安定化半径： "),
                QStringLiteral("2.5Dで描画： "),
                QStringLiteral("ストローク幅"),
                QStringLiteral("キャップスタイル"),
                QStringLiteral("ラインスタイル： "),
                QStringLiteral("監督強度： "),
                QStringLiteral("監督あり： "),
                QStringLiteral("グリッドを表示： "),
                QStringLiteral("プリセット： "),
                QStringLiteral("ピッチ半径： "),
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
