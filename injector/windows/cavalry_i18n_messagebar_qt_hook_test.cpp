/**
 * [INPUT]: 依赖 MessageBar Qt hook 的双 caller canonical path、HTML 尾部精确替换、immutable callback snapshot、三语生成表与 fake QTextEdit::append original
 * [OUTPUT]: 对外验证 history/live 两个 return、js_logger 排除、无 <br>/未知正文透传、Unicode 空白保持、禁用/空地址/墓碑转发及 synthetic Cavalry 2.7.2 路径正反例
 * [POS]: injector/windows 的 MessageBar 低层边界单测，不实例化 QTextEdit、不扫描文档，也不把日志 hook 扩成通用文本替换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_qt_hooks.h"

#include "cavalry_i18n_extension_layer_sources.h"
#include "cavalry_i18n_translator.h"

#include <QtCore/QCoreApplication>
#include <QtCore/QDebug>
#include <QtCore/QString>

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

namespace {

constexpr std::size_t kMessageBarAppendIatRva = 0x01B2E420;
constexpr std::array<std::size_t, 2> kMessageBarAppendCallRvas {{
    0x00FB40F4,
    0x00FB4B91,
}};
constexpr std::size_t kExcludedJsLoggerAppendCallRva = 0x010DF4B0;
constexpr std::array<std::array<std::uint8_t, 9>, 2>
    kMessageBarPostCallBytes {{
        {{
            0x48, 0x8B, 0x4D, 0x40,
            0x48, 0x85, 0xC9, 0x74, 0x14,
        }},
        {{
            0x48, 0x8B, 0x4D, 0xD8,
            0x48, 0x85, 0xC9, 0x74, 0x14,
        }},
}};
constexpr std::array<std::uint8_t, 8> kJsLoggerPostCallBytes {{
    0x48, 0x8B, 0x4F, 0x70,
    0x48, 0x83, 0xC1, 0x04,
}};

QTextEdit *gCapturedReceiver = nullptr;
QString gCapturedText;
int gAppendCount = 0;
int gReceiverStorage = 0;
int gHistoryReturnStorage = 0;
int gLiveReturnStorage = 0;
int gJsLoggerReturnStorage = 0;

void recordingAppend(QTextEdit *receiver, const QString &text)
{
    gCapturedReceiver = receiver;
    gCapturedText = text;
    ++gAppendCount;
}

void resetCapture()
{
    gCapturedReceiver = nullptr;
    gCapturedText.clear();
    gAppendCount = 0;
}

bool expectCapture(
    QTextEdit *expectedReceiver,
    const QString &expectedText,
    const char *scenario)
{
    if (gCapturedReceiver == expectedReceiver
        && gCapturedText == expectedText && gAppendCount == 1) {
        return true;
    }
    qCritical().noquote()
        << QStringLiteral(
               "%1: receiver=%2 text=\"%3\" count=%4.")
               .arg(
                   QString::fromLatin1(scenario),
                   QString::number(
                       reinterpret_cast<quintptr>(
                           gCapturedReceiver),
                       16),
                   gCapturedText)
               .arg(gAppendCount);
    return false;
}

bool writeSyntheticIatCall(
    std::vector<std::uint8_t> *image,
    void **slot,
    std::size_t callRva,
    const std::uint8_t *continuation,
    std::size_t continuationSize)
{
    if (image == nullptr || slot == nullptr
        || callRva > image->size() - 6 - continuationSize) {
        return false;
    }
    auto *call = image->data() + callRva;
    call[0] = 0xFF;
    call[1] = 0x15;
    const std::intptr_t displacement =
        reinterpret_cast<std::intptr_t>(slot)
        - reinterpret_cast<std::intptr_t>(call + 6);
    const std::int32_t displacement32 =
        static_cast<std::int32_t>(displacement);
    if (static_cast<std::intptr_t>(displacement32) != displacement) {
        return false;
    }
    std::memcpy(call + 2, &displacement32, sizeof(displacement32));
    std::memcpy(call + 6, continuation, continuationSize);
    return true;
}

bool verifySyntheticPath()
{
    std::vector<std::uint8_t> image(
        kMessageBarAppendIatRva + sizeof(void *),
        0);
    auto **slot = reinterpret_cast<void **>(
        image.data() + kMessageBarAppendIatRva);
    for (std::size_t index = 0;
         index < kMessageBarAppendCallRvas.size();
         ++index) {
        if (!writeSyntheticIatCall(
                &image,
                slot,
                kMessageBarAppendCallRvas[index],
                kMessageBarPostCallBytes[index].data(),
                kMessageBarPostCallBytes[index].size())) {
            qCritical() << "Synthetic MessageBar IAT displacement overflowed.";
            return false;
        }
    }
    if (!writeSyntheticIatCall(
            &image,
            slot,
            kExcludedJsLoggerAppendCallRva,
            kJsLoggerPostCallBytes.data(),
            kJsLoggerPostCallBytes.size())) {
        qCritical() << "Synthetic js_logger IAT displacement overflowed.";
        return false;
    }

    CavalryMessageBarAppendPath path;
    QString failure;
    if (!validateCavalryMessageBarAppendPath(
            image.data(),
            image.size(),
            slot,
            &path,
            &failure)
        || path.iatSlot != slot
        || path.approvedReturnAddresses[0]
            != image.data() + kMessageBarAppendCallRvas[0] + 6
        || path.approvedReturnAddresses[1]
            != image.data() + kMessageBarAppendCallRvas[1] + 6
        || path.approvedReturnAddresses[0]
            == image.data() + kExcludedJsLoggerAppendCallRva + 6
        || path.approvedReturnAddresses[1]
            == image.data() + kExcludedJsLoggerAppendCallRva + 6) {
        qCritical().noquote()
            << QStringLiteral("Synthetic MessageBar path failed: %1")
                   .arg(failure);
        return false;
    }

    image[kMessageBarAppendCallRvas[1] + 6] ^= 0x01;
    failure.clear();
    if (validateCavalryMessageBarAppendPath(
            image.data(),
            image.size(),
            slot,
            &path,
            &failure)
        || failure.isEmpty()) {
        qCritical()
            << "MessageBar path accepted a corrupt live continuation.";
        return false;
    }
    image[kMessageBarAppendCallRvas[1] + 6] ^= 0x01;

    failure.clear();
    if (validateCavalryMessageBarAppendPath(
            image.data(),
            image.size(),
            slot + 1,
            &path,
            &failure)
        || failure.isEmpty()) {
        qCritical()
            << "MessageBar path accepted a non-canonical IAT slot.";
        return false;
    }
    return true;
}

bool verifyDispatch(
    QTextEdit *receiver,
    const QString &text,
    const void *returnAddress,
    const QString &expected,
    const char *scenario)
{
    resetCapture();
    dispatchCavalryMessageBarAppendForTesting(
        receiver,
        text,
        returnAddress);
    return expectCapture(receiver, expected, scenario);
}

bool verifyLanguage(
    const QString &language,
    const QString &expectedTranslation)
{
    CavalryEmbeddedTranslator translator(language);
    const std::array<const std::uint8_t *, 2> approvedReturnAddresses {{
        reinterpret_cast<const std::uint8_t *>(&gHistoryReturnStorage),
        reinterpret_cast<const std::uint8_t *>(&gLiveReturnStorage),
    }};
    QString failure;
    if (!publishCavalryMessageBarCallbackSnapshot(
            translator,
            reinterpret_cast<void *>(recordingAppend),
            approvedReturnAddresses,
            &failure)
        || !isCavalryMessageBarOriginalPublished()) {
        qCritical().noquote()
            << QStringLiteral("%1 snapshot failed: %2")
                   .arg(language, failure);
        return false;
    }

    auto *receiver =
        reinterpret_cast<QTextEdit *>(&gReceiverStorage);
    const QString source = QString::fromLatin1(
        cavalry_i18n::extension_layer_contract::
            kPencilCameraDistanceWarning);
    const QString prefix =
        QStringLiteral(" 12:34 <b>warning</b> <br>");
    const QString leadingWhitespace =
        QString(QChar(0x2003)) + QStringLiteral("  ");
    const QString trailingWhitespace =
        QStringLiteral(" \t") + QString(QChar(0x3000));
    const QString decorated =
        prefix + leadingWhitespace + source + trailingWhitespace;
    const QString expected =
        prefix + leadingWhitespace
        + expectedTranslation + trailingWhitespace;
    const QString multipleBreaks =
        QStringLiteral("older<br>") + decorated;
    const QString multipleBreaksExpected =
        QStringLiteral("older<br>") + expected;
    const QString unknown =
        prefix + QStringLiteral("User-authored JavaScript console text");
    const auto *jsLoggerReturnAddress =
        reinterpret_cast<const void *>(&gJsLoggerReturnStorage);

    enableCavalryMessageBarTranslations(false);
    if (!verifyDispatch(
            receiver,
            decorated,
            approvedReturnAddresses[0],
            decorated,
            "disabled approved source")) {
        return false;
    }

    enableCavalryMessageBarTranslations(true);
    if (!verifyDispatch(
            receiver,
            decorated,
            jsLoggerReturnAddress,
            decorated,
            "excluded js_logger caller")
        || !verifyDispatch(
            receiver,
            decorated,
            nullptr,
            decorated,
            "null return address")
        || !verifyDispatch(
            receiver,
            source,
            approvedReturnAddresses[0],
            source,
            "raw source without br")
        || !verifyDispatch(
            receiver,
            unknown,
            approvedReturnAddresses[0],
            unknown,
            "unknown MessageBar body")
        || !verifyDispatch(
            receiver,
            multipleBreaks,
            approvedReturnAddresses[0],
            multipleBreaksExpected,
            "last br selects the Pencil body")
        || !verifyDispatch(
            receiver,
            decorated,
            approvedReturnAddresses[0],
            expected,
            "history replay Pencil warning")
        || !verifyDispatch(
            receiver,
            decorated,
            approvedReturnAddresses[1],
            expected,
            "live append Pencil warning")) {
        return false;
    }

    enableCavalryMessageBarTranslations(false);
    clearCavalryMessageBarOriginal();
    return !isCavalryMessageBarOriginalPublished()
        && verifyDispatch(
            receiver,
            decorated,
            approvedReturnAddresses[1],
            decorated,
            "forward-only callback tombstone");
}

} // namespace

int main(int argc, char *argv[])
{
    QCoreApplication application(argc, argv);
    return verifySyntheticPath()
            && verifyLanguage(
                QStringLiteral("zh-Hans"),
                QStringLiteral(
                    "铅笔工具：绘制位置离相机太远，请尝试在 2D 中绘制"))
            && verifyLanguage(
                QStringLiteral("zh-Hant"),
                QStringLiteral(
                    "鉛筆工具：繪製位置離攝影機太遠，請嘗試在 2D 中繪製"))
            && verifyLanguage(
                QStringLiteral("ja_JP"),
                QStringLiteral(
                    "鉛筆ツール：カメラから離れすぎのため2Dで描画してください"))
        ? 0
        : 1;
}
