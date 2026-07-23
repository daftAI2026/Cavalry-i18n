/**
 * [INPUT]: 依赖 ExtensionLayer 精确白名单、三语嵌入 translator 与无厂商模块的 Qt Core 进程
 * [OUTPUT]: 对外验证四条精确自绘提示的三语投影、大小写/未知文本拒绝及模块延迟加载的无副作用回退
 * [POS]: injector/windows 的 hook 行为合同测试；不加载 Cavalry DLL、不改 IAT，只锁住可安全拦截的文本边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_hook.h"
#include "cavalry_i18n_translator.h"

#include <QtCore/QCoreApplication>
#include <QtCore/QDebug>
#include <QtCore/QString>

#include <array>

namespace {

struct TranslationCase {
    const char *source;
    const char *simplifiedChinese;
    const char *traditionalChinese;
    const char *japanese;
};

constexpr std::array<TranslationCase, 4> kExtensionLayerEmptyStates {{
    {
        "Double click here to import Assets.",
        "双击此处导入素材",
        "連按兩下此處匯入素材",
        "ここをダブルクリックしてアセットを読み込み",
    },
    {
        "Drag layers here to see their settings.",
        "将图层拖到此处以查看其设置",
        "在此拖動層以查看其設置",
        "レイヤーをドラッグして設定を確認します",
    },
    {
        "Drag some JavaScript here to make a Snippet.",
        "将 JavaScript 拖到此处以创建代码片段。",
        "將 JavaScript 拖到此處以建立程式碼片段。",
        "JavaScript をここにドラッグしてスニペットを作成します。",
    },
    {
        "Use the Create menu to add a layer to your Composition.",
        "使用创建菜单向合成添加图层",
        "使用建立選單向合成新增圖層",
        "作成メニューを使用してコンポジションにレイヤーを追加してください",
    },
}};

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

bool verifyLanguage(
    const QString &language,
    int expectedTranslationIndex)
{
    CavalryEmbeddedTranslator translator(language);
    for (const TranslationCase &testCase : kExtensionLayerEmptyStates) {
        const char *expectedTranslations[] {
            testCase.simplifiedChinese,
            testCase.traditionalChinese,
            testCase.japanese,
        };
        const QString source = QString::fromLatin1(testCase.source);
        if (!expectEqual(
                language + QStringLiteral(": ") + source,
                CavalryExtensionLayerHook::translationForWhitelistedSource(
                    translator,
                    source),
                QString::fromUtf8(expectedTranslations[expectedTranslationIndex]))) {
            return false;
        }
    }

    if (!expectEqual(
            language + QStringLiteral(": unknown source"),
            CavalryExtensionLayerHook::translationForWhitelistedSource(
                translator,
                QStringLiteral("Drag some javascript here to make a Snippet.")),
            QString())) {
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

    return verifyLanguage(QStringLiteral("zh-Hans"), 0)
            && verifyLanguage(QStringLiteral("zh-Hant"), 1)
            && verifyLanguage(QStringLiteral("ja_JP"), 2)
        ? 0
        : 1;
}
