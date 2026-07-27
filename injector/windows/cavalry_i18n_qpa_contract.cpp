/**
 * [INPUT]: 依赖 cavalry_i18n_qpa_contract.h、QJsonDocument 与 Cavalry 2.7.2 / Qt 6.6.3 / x64 固定发布身份
 * [OUTPUT]: 对外实现 exact-key manifest v1、固定 vendor qwindows 身份、实际文件 hash 与精确四语言 marker 验证
 * [POS]: injector/windows 的 fail-closed 翻译激活判定；失败仅禁止 generic runtime，不影响原厂 QPA 委托
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_qpa_contract.h"

#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>
#include <QtCore/QJsonParseError>
#include <QtCore/QSet>
#include <QtCore/QStringList>

namespace {

constexpr auto kExpectedCavalryVersion = "2.7.2";
constexpr auto kExpectedQtVersion = "6.6.3";
constexpr auto kExpectedArchitecture = "x86_64";
constexpr auto kExpectedVendorQwindowsSha256 =
    "e039d39a6b99a26a358a85660147941112a4c9df3a62b5e19a8ae9ed75be3f01";

const QSet<QString> &manifestKeys()
{
    static const QSet<QString> keys {
        QStringLiteral("schemaVersion"),
        QStringLiteral("phase"),
        QStringLiteral("cavalryVersion"),
        QStringLiteral("cavalryExecutableSha256"),
        QStringLiteral("qtVersion"),
        QStringLiteral("architecture"),
        QStringLiteral("vendorQwindowsSha256"),
        QStringLiteral("proxyQwindowsSha256"),
        QStringLiteral("genericPluginSha256"),
    };
    return keys;
}

bool fail(QString *error, const QString &message)
{
    if (error != nullptr) {
        *error = message;
    }
    return false;
}

bool isLowerSha256(const QByteArray &value)
{
    if (value.size() != 64) {
        return false;
    }
    for (const char character : value) {
        const bool digit = character >= '0' && character <= '9';
        const bool lowerHex = character >= 'a' && character <= 'f';
        if (!digit && !lowerHex) {
            return false;
        }
    }
    return true;
}

bool readRequiredString(
    const QJsonObject &object,
    const QString &key,
    QString *value,
    QString *error)
{
    const QJsonValue jsonValue = object.value(key);
    if (!jsonValue.isString() || jsonValue.toString().isEmpty()) {
        return fail(
            error,
            QStringLiteral("QPA manifest field '%1' must be a non-empty string.")
                .arg(key));
    }
    *value = jsonValue.toString();
    return true;
}

bool readRequiredHash(
    const QJsonObject &object,
    const QString &key,
    QByteArray *value,
    QString *error)
{
    QString stringValue;
    if (!readRequiredString(object, key, &stringValue, error)) {
        return false;
    }
    const QByteArray bytes = stringValue.toLatin1();
    if (!isLowerSha256(bytes)) {
        return fail(
            error,
            QStringLiteral(
                "QPA manifest field '%1' must be 64 lowercase hexadecimal characters.")
                .arg(key));
    }
    *value = bytes;
    return true;
}

} // namespace

bool cavalryParseQpaManifest(
    const QByteArray &payload,
    CavalryQpaManifest *manifest,
    QString *error)
{
    if (manifest == nullptr) {
        return fail(error, QStringLiteral("QPA manifest output is unavailable."));
    }

    QJsonParseError parseError;
    const QJsonDocument document =
        QJsonDocument::fromJson(payload, &parseError);
    if (parseError.error != QJsonParseError::NoError
        || !document.isObject()) {
        return fail(
            error,
            QStringLiteral("QPA manifest JSON is invalid: %1")
                .arg(parseError.errorString()));
    }

    const QJsonObject object = document.object();
    const QStringList actualKeyList = object.keys();
    const QSet<QString> actualKeys(
        actualKeyList.cbegin(),
        actualKeyList.cend());
    if (actualKeys != manifestKeys()) {
        QStringList missing;
        QStringList unknown;
        for (const QString &key : manifestKeys()) {
            if (!actualKeys.contains(key)) {
                missing.append(key);
            }
        }
        for (const QString &key : actualKeys) {
            if (!manifestKeys().contains(key)) {
                unknown.append(key);
            }
        }
        missing.sort();
        unknown.sort();
        return fail(
            error,
            QStringLiteral(
                "QPA manifest keys do not match schema v1 (missing=%1, unknown=%2).")
                .arg(missing.join(QLatin1Char(',')), unknown.join(QLatin1Char(','))));
    }

    // QJsonObject 采用 last-key-wins，单靠解析结果看不见重复键。manifest v1
    // 是无嵌套、固定值域的平面对象，因此同时锁定冒号数和每个未转义键只出现一次；
    // 这也拒绝用 JSON key escape 伪装的第二份 phase/hash。
    if (payload.count(':') != manifestKeys().size()) {
        return fail(
            error,
            QStringLiteral("QPA manifest must contain each schema v1 field exactly once."));
    }
    for (const QString &key : manifestKeys()) {
        const QByteArray token =
            QByteArray("\"") + key.toUtf8() + QByteArray("\"");
        if (payload.count(token) != 1) {
            return fail(
                error,
                QStringLiteral("QPA manifest field '%1' is duplicated or escaped.")
                    .arg(key));
        }
    }

    const QJsonValue schemaVersion = object.value(
        QStringLiteral("schemaVersion"));
    if (!schemaVersion.isDouble() || schemaVersion.toDouble() != 1.0) {
        return fail(
            error,
            QStringLiteral("QPA manifest schemaVersion must be 1."));
    }

    QString phase;
    QString cavalryVersion;
    QString qtVersion;
    QString architecture;
    CavalryQpaManifest parsed;
    if (!readRequiredString(
            object,
            QStringLiteral("phase"),
            &phase,
            error)
        || !readRequiredString(
            object,
            QStringLiteral("cavalryVersion"),
            &cavalryVersion,
            error)
        || !readRequiredString(
            object,
            QStringLiteral("qtVersion"),
            &qtVersion,
            error)
        || !readRequiredString(
            object,
            QStringLiteral("architecture"),
            &architecture,
            error)
        || !readRequiredHash(
            object,
            QStringLiteral("cavalryExecutableSha256"),
            &parsed.cavalryExecutableSha256,
            error)
        || !readRequiredHash(
            object,
            QStringLiteral("vendorQwindowsSha256"),
            &parsed.vendorQwindowsSha256,
            error)
        || !readRequiredHash(
            object,
            QStringLiteral("proxyQwindowsSha256"),
            &parsed.proxyQwindowsSha256,
            error)
        || !readRequiredHash(
            object,
            QStringLiteral("genericPluginSha256"),
            &parsed.genericPluginSha256,
            error)) {
        return false;
    }

    if (phase != QStringLiteral("prepared")
        && phase != QStringLiteral("active")
        && phase != QStringLiteral("restoring")) {
        return fail(
            error,
            QStringLiteral("QPA manifest phase is unsupported: %1").arg(phase));
    }
    if (cavalryVersion != QString::fromLatin1(kExpectedCavalryVersion)) {
        return fail(
            error,
            QStringLiteral("QPA manifest Cavalry version is unsupported: %1")
                .arg(cavalryVersion));
    }
    if (qtVersion != QString::fromLatin1(kExpectedQtVersion)) {
        return fail(
            error,
            QStringLiteral("QPA manifest Qt version is unsupported: %1")
                .arg(qtVersion));
    }
    if (architecture != QString::fromLatin1(kExpectedArchitecture)) {
        return fail(
            error,
            QStringLiteral("QPA manifest architecture is unsupported: %1")
                .arg(architecture));
    }
    if (parsed.vendorQwindowsSha256
        != QByteArray(kExpectedVendorQwindowsSha256)) {
        return fail(
            error,
            QStringLiteral(
                "QPA manifest vendor qwindows identity is not the verified Cavalry 2.7.2 binary."));
    }

    parsed.phase = phase;
    *manifest = parsed;
    if (error != nullptr) {
        error->clear();
    }
    return true;
}

bool cavalryVerifyQpaManifestHashes(
    const CavalryQpaManifest &manifest,
    const QByteArray &cavalryExecutableSha256,
    const QByteArray &vendorQwindowsSha256,
    const QByteArray &proxyQwindowsSha256,
    const QByteArray &genericPluginSha256,
    QString *error)
{
    const struct {
        const char *name;
        const QByteArray *expected;
        const QByteArray *actual;
    } comparisons[] {
        {
            "Cavalry executable",
            &manifest.cavalryExecutableSha256,
            &cavalryExecutableSha256,
        },
        {
            "vendor qwindows",
            &manifest.vendorQwindowsSha256,
            &vendorQwindowsSha256,
        },
        {
            "proxy qwindows",
            &manifest.proxyQwindowsSha256,
            &proxyQwindowsSha256,
        },
        {
            "generic plugin",
            &manifest.genericPluginSha256,
            &genericPluginSha256,
        },
    };

    for (const auto &comparison : comparisons) {
        if (!isLowerSha256(*comparison.actual)
            || *comparison.expected != *comparison.actual) {
            return fail(
                error,
                QStringLiteral("QPA manifest hash mismatch for %1.")
                    .arg(QString::fromLatin1(comparison.name)));
        }
    }

    if (error != nullptr) {
        error->clear();
    }
    return true;
}

bool cavalryVerifyVendorQwindowsSha256(
    const QByteArray &vendorQwindowsSha256,
    QString *error)
{
    if (!isLowerSha256(vendorQwindowsSha256)
        || vendorQwindowsSha256
            != QByteArray(kExpectedVendorQwindowsSha256)) {
        return fail(
            error,
            QStringLiteral(
                "Vendor qwindows does not match the verified Cavalry 2.7.2 binary."));
    }
    if (error != nullptr) {
        error->clear();
    }
    return true;
}

bool cavalryVerifyRuntimeQtVersion(
    const QString &qtVersion,
    QString *error)
{
    if (qtVersion != QString::fromLatin1(kExpectedQtVersion)) {
        return fail(
            error,
            QStringLiteral("Runtime Qt version is unsupported: %1")
                .arg(qtVersion));
    }
    if (error != nullptr) {
        error->clear();
    }
    return true;
}

bool cavalryParseLanguageMarker(
    const QByteArray &payload,
    QString *language,
    QString *error)
{
    if (language == nullptr) {
        return fail(error, QStringLiteral("Language marker output is unavailable."));
    }

    QByteArray value = payload;
    if (value.endsWith("\r\n")) {
        value.chop(2);
    } else if (value.endsWith('\n')) {
        value.chop(1);
    }

    if (value == "en" || value == "zh-Hans"
        || value == "zh-Hant" || value == "ja_JP") {
        *language = QString::fromLatin1(value);
        if (error != nullptr) {
            error->clear();
        }
        return true;
    }

    return fail(
        error,
        QStringLiteral(
            "Language marker must contain exactly en, zh-Hans, zh-Hant, or ja_JP with at most one final newline."));
}
