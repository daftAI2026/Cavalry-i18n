/**
 * [INPUT]: 依赖 text-path dispatch 纯合同、CavalryEmbeddedTranslator 与三语生成表
 * [OUTPUT]: 对外验证安装与 callback 都持续拒绝被篡改的三处 caller/RDX 字节包络、三十六项静态白名单（含 Bone Tool 四组提示）、Pitch exact context，以及动态文本仅接受 canonical 32-bit int 后缀并逐字保留数值
 * [POS]: injector/windows 的静态/动态 text-path 回归；与真实 vendor PE 合同互补，不执行任何厂商代码
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_text_path_dispatch.h"

#include "cavalry_i18n_translator.h"

#include <QtCore/QDebug>
#include <QtCore/QString>

#include <array>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace {

struct LocaleExpectation final {
    const char *language;
    const char *prefix;
    std::array<const char *, 7> toolHelpActions;
    std::array<const char *, 3> transformToolPrefixes;
    std::array<const char *, 3> editShapeToolPrefixes;
    std::array<const char *, 8> boneToolTexts;
};

bool fail(const QString &message)
{
    qCritical().noquote() << message;
    return false;
}

template <std::size_t Size>
void writeBytes(
    std::vector<std::uint8_t> *image,
    std::size_t rva,
    const std::array<std::uint8_t, Size> &bytes)
{
    std::memcpy(image->data() + rva, bytes.data(), bytes.size());
}

void writeIndirectCall(
    std::vector<std::uint8_t> *image,
    std::size_t callRva,
    std::size_t slotRva)
{
    std::uint8_t *const call = image->data() + callRva;
    call[0] = 0xFF;
    call[1] = 0x15;
    const auto displacement = static_cast<std::int32_t>(
        static_cast<std::intptr_t>(slotRva)
        - static_cast<std::intptr_t>(callRva + 6));
    std::memcpy(call + 2, &displacement, sizeof(displacement));
}

bool verifyCallerEnvelopes()
{
    constexpr std::size_t slotRva = 0x01B28F98;
    constexpr std::size_t staticPreambleRva = 0x002D9170;
    constexpr std::size_t staticCallRva = 0x002D917A;
    constexpr std::size_t staticReturnRva = 0x002D9180;
    constexpr std::array<std::uint8_t, 10> staticPreamble {{
        0x4C, 0x89, 0xF1, 0x48, 0x89, 0xF2,
        0x66, 0x0F, 0x28, 0xD6,
    }};
    constexpr std::size_t firstPreambleRva = 0x00ABDAF0;
    constexpr std::size_t firstCallRva = 0x00ABDB15;
    constexpr std::size_t firstReturnRva = 0x00ABDB1B;
    constexpr std::array<std::uint8_t, 37> firstPreamble {{
        0x48, 0x8B, 0x17, 0x48, 0x39, 0x57, 0x08,
        0x0F, 0x84, 0x8C, 0x01, 0x00, 0x00,
        0xF2, 0x0F, 0x10, 0x35, 0xBB, 0x77, 0xA1, 0x00,
        0xF2, 0x41, 0x0F, 0x5E, 0xF0,
        0x4C, 0x8D, 0x75, 0xA8, 0x4C, 0x89, 0xF1,
        0x66, 0x0F, 0x28, 0xD6,
    }};
    constexpr std::size_t nextPreambleRva = 0x00ABDC00;
    constexpr std::size_t nextCallRva = 0x00ABDC11;
    constexpr std::size_t nextReturnRva = 0x00ABDC17;
    constexpr std::array<std::uint8_t, 17> nextPreamble {{
        0x4C, 0x89, 0xEA, 0x48, 0xC1, 0xE2, 0x05, 0x48, 0x01,
        0xC2, 0x4C, 0x89, 0xF1, 0x66, 0x0F, 0x28, 0xD6,
    }};

    std::vector<std::uint8_t> image(slotRva + sizeof(void *), 0);
    writeBytes(&image, staticPreambleRva, staticPreamble);
    writeBytes(&image, firstPreambleRva, firstPreamble);
    writeBytes(&image, nextPreambleRva, nextPreamble);
    writeIndirectCall(&image, staticCallRva, slotRva);
    writeIndirectCall(&image, firstCallRva, slotRva);
    writeIndirectCall(&image, nextCallRva, slotRva);
    void *const slot = image.data() + slotRva;

    if (!validateCavalryTextPathCallerEnvelopes(
            image.data(),
            image.size(),
            slot)
        || classifyCavalryTextPathCaller(
            image.data(),
            image.size(),
            slot,
            image.data() + staticReturnRva)
            != CavalryTextPathCallerKind::StaticExact
        || classifyCavalryTextPathCaller(
            image.data(),
            image.size(),
            slot,
            image.data() + firstReturnRva)
            != CavalryTextPathCallerKind::PrimitiveToolLine
        || classifyCavalryTextPathCaller(
            image.data(),
            image.size(),
            slot,
            image.data() + nextReturnRva)
            != CavalryTextPathCallerKind::PrimitiveToolLine
        || classifyCavalryTextPathCaller(
            image.data(),
            image.size(),
            slot,
            image.data() + nextReturnRva + 1)
            != CavalryTextPathCallerKind::Rejected) {
        return fail(QStringLiteral(
            "The three approved text-path caller envelopes were not exact."));
    }

    image[firstPreambleRva + 2] ^= 0x01;
    const bool rejectsChangedStringLoad =
        !validateCavalryTextPathCallerEnvelopes(
            image.data(),
            image.size(),
            slot);
    const bool callbackRejectsChangedStringLoad =
        classifyCavalryTextPathCaller(
            image.data(),
            image.size(),
            slot,
            image.data() + firstReturnRva)
        == CavalryTextPathCallerKind::Rejected;
    image[firstPreambleRva + 2] ^= 0x01;
    image[firstPreambleRva] ^= 0x01;
    return rejectsChangedStringLoad
        && callbackRejectsChangedStringLoad
        && !validateCavalryTextPathCallerEnvelopes(
        image.data(),
        image.size(),
        slot);
}

bool verifyLocale(const LocaleExpectation &expectation)
{
    using namespace cavalry_i18n::extension_layer_contract;
    const CavalryEmbeddedTranslator translator(
        QString::fromLatin1(expectation.language));
    const QString embedded =
        translator.translate("CogTool", kPitchRadiusPrefix);
    const std::string translatedPrefix =
        embedded.toUtf8().toStdString();
    const std::string expectedPrefix(expectation.prefix);

    if (translatedPrefix != expectedPrefix
        || cavalryTextPathExactSourceIndex(kPitchRadiusPrefix)
            != kPitchRadiusSourceIndex
        || std::string_view(
               textPathTranslationContext(kPitchRadiusSourceIndex))
            != "CogTool"
        || textPathTranslationContext(0) != nullptr) {
        return fail(QStringLiteral(
            "%1 Pitch Radius translation source contract failed.")
            .arg(QString::fromLatin1(expectation.language)));
    }

    constexpr std::array<const char *, 7> toolHelpSources {{
        kClearPath,
        kNewShape,
        kCreateAsMask,
        kStartNewShape,
        kStartNewContour,
        kCreateFromTheCentre,
        kConstrainProportions,
    }};
    for (std::size_t index = 0; index < toolHelpSources.size(); ++index) {
        const char *const source = toolHelpSources[index];
        const std::size_t sourceIndex =
            cavalryTextPathExactSourceIndex(source);
        const CavalryTextPathSourceMatch match =
            matchCavalryTextPathSource(
                CavalryTextPathCallerKind::StaticExact,
                source);
        const QString embeddedAction =
            translator.translate(nullptr, source);
        const std::string expectedAction =
            expectation.toolHelpActions[index];
        if (!isStaticTextPathSourceIndex(sourceIndex)
            || !match.isMatched()
            || match.sourceIndex != sourceIndex
            || !match.preservedSuffix.empty()
            || embeddedAction.toUtf8().toStdString() != expectedAction
            || composeCavalryTextPathTranslation(
                   expectedAction,
                   match) != expectedAction
            || matchCavalryTextPathSource(
                   CavalryTextPathCallerKind::PrimitiveToolLine,
                   source).isMatched()) {
            return fail(QStringLiteral(
                "%1 static tool-help action contract failed for '%2'.")
                .arg(
                    QString::fromLatin1(expectation.language),
                    QString::fromLatin1(source)));
        }
    }

    constexpr std::array<const char *, 3> transformToolPrefixSources {{
        "S + click path",
        "Hold S",
        "Space + click + drag",
    }};
    for (std::size_t index = 0;
         index < transformToolPrefixSources.size();
         ++index) {
        const char *const source = transformToolPrefixSources[index];
        const std::size_t sourceIndex =
            cavalryTextPathExactSourceIndex(source);
        const CavalryTextPathSourceMatch match =
            matchCavalryTextPathSource(
                CavalryTextPathCallerKind::StaticExact,
                source);
        const std::string expected =
            expectation.transformToolPrefixes[index];
        if (!isStaticTextPathSourceIndex(sourceIndex)
            || !match.isMatched()
            || match.sourceIndex != sourceIndex
            || !match.preservedSuffix.empty()
            || translator.translate(nullptr, source)
                    .toUtf8().toStdString() != expected
            || composeCavalryTextPathTranslation(
                   expected,
                   match) != expected
            || matchCavalryTextPathSource(
                   CavalryTextPathCallerKind::PrimitiveToolLine,
                   source).isMatched()) {
            return fail(QStringLiteral(
                "%1 TransformTool prefix contract failed for '%2'.")
                .arg(
                    QString::fromLatin1(expectation.language),
                    QString::fromLatin1(source)));
        }
    }

    constexpr std::array<const char *, 3> editShapeToolPrefixSources {{
        kEditShapeSplitCornerPrefix,
        kEditShapeSplitBezierPrefix,
        kEditShapeDeleteBezierHandlePrefix,
    }};
    for (std::size_t index = 0;
         index < editShapeToolPrefixSources.size();
         ++index) {
        const char *const source = editShapeToolPrefixSources[index];
        const std::size_t sourceIndex =
            cavalryTextPathExactSourceIndex(source);
        const CavalryTextPathSourceMatch match =
            matchCavalryTextPathSource(
                CavalryTextPathCallerKind::StaticExact,
                source);
        const std::string expected =
            expectation.editShapeToolPrefixes[index];
        if (!isStaticTextPathSourceIndex(sourceIndex)
            || !match.isMatched()
            || match.sourceIndex != sourceIndex
            || !match.preservedSuffix.empty()
            || translator.translate(nullptr, source)
                    .toUtf8().toStdString() != expected
            || composeCavalryTextPathTranslation(
                   expected,
                   match) != expected
            || matchCavalryTextPathSource(
                   CavalryTextPathCallerKind::PrimitiveToolLine,
                   source).isMatched()) {
            return fail(QStringLiteral(
                "%1 EditShapeTool prefix contract failed for '%2'.")
                .arg(
                    QString::fromLatin1(expectation.language),
                    QString::fromLatin1(source)));
        }
    }

    constexpr std::array<const char *, 8> boneToolSources {{
        kClickBone,
        kSelectAction,
        kClickHandle,
        kStartFinishAddingBone,
        kClickHandleAndDrag,
        kRotateBone,
        kAltClickHandleAndDrag,
        kStretchBone,
    }};
    for (std::size_t index = 0;
         index < boneToolSources.size();
         ++index) {
        const char *const source = boneToolSources[index];
        const std::size_t sourceIndex =
            cavalryTextPathExactSourceIndex(source);
        const CavalryTextPathSourceMatch match =
            matchCavalryTextPathSource(
                CavalryTextPathCallerKind::StaticExact,
                source);
        const std::string expected =
            expectation.boneToolTexts[index];
        if (!isStaticTextPathSourceIndex(sourceIndex)
            || sourceIndex
                != kBoneTextPathSourceIndexOffset + index
            || !match.isMatched()
            || match.sourceIndex != sourceIndex
            || !match.preservedSuffix.empty()
            || translator.translate(nullptr, source)
                    .toUtf8().toStdString() != expected
            || composeCavalryTextPathTranslation(
                   expected,
                   match) != expected
            || matchCavalryTextPathSource(
                   CavalryTextPathCallerKind::PrimitiveToolLine,
                   source).isMatched()) {
            return fail(QStringLiteral(
                "%1 Bone Tool text contract failed for '%2'.")
                .arg(
                    QString::fromLatin1(expectation.language),
                    QString::fromLatin1(source)));
        }
    }

    for (const std::string source
         : { std::string("Pitch Radius: 0"),
             std::string("Pitch Radius: 42"),
             std::string("Pitch Radius: -17"),
             std::string("Pitch Radius: 2147483647"),
             std::string("Pitch Radius: -2147483648") }) {
        const CavalryTextPathSourceMatch match =
            matchCavalryTextPathSource(
                CavalryTextPathCallerKind::PrimitiveToolLine,
                source);
        const std::string expected =
            expectedPrefix
            + source.substr(std::string(kPitchRadiusPrefix).size());
        std::array<char, 64> storage {};
        std::string_view written;
        if (!match.isMatched()
            || match.sourceIndex != kPitchRadiusSourceIndex
            || composeCavalryTextPathTranslation(
                   translatedPrefix,
                   match) != expected
            || !writeCavalryTextPathTranslation(
                translatedPrefix,
                match,
                storage.data(),
                storage.size(),
                &written)
            || written != expected) {
            return fail(QStringLiteral(
                "%1 failed to preserve the Pitch Radius integer in '%2'.")
                .arg(
                    QString::fromLatin1(expectation.language),
                    QString::fromStdString(source)));
        }
    }
    const CavalryTextPathSourceMatch capacityMatch =
        matchCavalryTextPathSource(
            CavalryTextPathCallerKind::PrimitiveToolLine,
            "Pitch Radius: 2147483647");
    std::array<char, 8> insufficientStorage {};
    std::string_view unwritten = "must be cleared";
    if (writeCavalryTextPathTranslation(
            expectedPrefix,
            capacityMatch,
            insufficientStorage.data(),
            insufficientStorage.size(),
            &unwritten)
        || !unwritten.empty()) {
        return fail(QStringLiteral(
            "%1 accepted an undersized callback buffer.")
            .arg(QString::fromLatin1(expectation.language)));
    }
    return true;
}

} // namespace

int main()
{
    using namespace cavalry_i18n::extension_layer_contract;
    if (!verifyCallerEnvelopes()) {
        return 1;
    }
    constexpr std::array<LocaleExpectation, 3> locales {{
        {
            "zh-Hans",
            "节圆半径： ",
            {{
                "清除路径",
                "新建形状",
                "创建为遮罩",
                "新建形状",
                "新建轮廓",
                "从中心创建",
                "锁定纵横比",
            }},
            {{
                "S + 单击路径",
                "按住 S",
                "Space + 单击 + 拖动",
            }},
            {{
                "S + 双击",
                "S + 单击",
                "X + 单击",
            }},
            {{
                "单击骨骼",
                "选择",
                "单击手柄",
                "开始/完成添加骨骼",
                "单击手柄并拖动",
                "旋转骨骼",
                "Alt + 单击手柄并拖动",
                "拉伸骨骼",
            }},
        },
        {
            "zh-Hant",
            "節圓半徑： ",
            {{
                "清除路徑",
                "新增形狀",
                "建立為遮罩",
                "新增形狀",
                "新增輪廓",
                "從中心建立",
                "鎖定長寬比",
            }},
            {{
                "S + 按一下路徑",
                "按住 S",
                "Space + 按一下 + 拖曳",
            }},
            {{
                "S + 連按兩下",
                "S + 按一下",
                "X + 按一下",
            }},
            {{
                "按一下骨骼",
                "選取",
                "按一下手柄",
                "開始/完成新增骨骼",
                "按一下手柄後拖曳",
                "旋轉骨骼",
                "Alt + 按一下手柄後拖曳",
                "拉伸骨骼",
            }},
        },
        {
            "ja_JP",
            "ピッチ半径： ",
            {{
                "パスをクリア",
                "新規シェイプ",
                "マスクとして作成",
                "新規シェイプを開始",
                "新しい輪郭を開始",
                "センターから作成",
                "縦横比を固定",
            }},
            {{
                "S + パスをクリック",
                "S キーを押したままにする",
                "Space + クリック + ドラッグ",
            }},
            {{
                "S + ダブルクリック",
                "S + クリック",
                "X + クリック",
            }},
            {{
                "ボーンをクリック",
                "選択",
                "ハンドルをクリック",
                "ボーンの追加を開始/完了",
                "ハンドルをクリックしてドラッグ",
                "ボーンを回転させる",
                "Alt + ハンドルをクリックしてドラッグ",
                "ボーンを伸ばす",
            }},
        },
    }};
    for (const LocaleExpectation &locale : locales) {
        if (!verifyLocale(locale)) {
            return 1;
        }
    }

    const std::array<std::string, 12> rejected {{
        "Pitch Radius: ",
        "Pitch Radius: +1",
        "Pitch Radius: 1.5",
        "Pitch Radius: 1px",
        "Pitch Radius:  1",
        "Pitch radius: 1",
        "Custom Pitch Radius: 1",
        "Pitch Radius: 01",
        "Pitch Radius: -0",
        "Pitch Radius: 2147483648",
        "Pitch Radius: -2147483649",
        "Pitch Radius: 999999999999999999999999",
    }};
    for (const std::string &source : rejected) {
        if (matchCavalryTextPathSource(
                CavalryTextPathCallerKind::PrimitiveToolLine,
                source).isMatched()) {
            fail(QStringLiteral(
                "Rejected dynamic source was accepted: '%1'.")
                .arg(QString::fromStdString(source)));
            return 1;
        }
    }
    if (matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "Pitch Radius: 12").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "Clear Paths").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            " Create as Mask").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "Constrain proportions").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "Shift").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "Control").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "H").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "S").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "Space").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "Click Bone").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "Click handle+drag").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::StaticExact,
            "Alt + click handle + drag ").isMatched()
        || matchCavalryTextPathSource(
            CavalryTextPathCallerKind::Rejected,
            "Pitch Radius: 12").isMatched()
        || classifyCavalryTextPathCaller(
            nullptr,
            0,
            nullptr,
            nullptr) != CavalryTextPathCallerKind::Rejected) {
        fail(QStringLiteral(
            "Pitch Radius escaped its exact caller boundary."));
        return 1;
    }
    return 0;
}
