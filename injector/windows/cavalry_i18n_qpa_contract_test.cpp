/**
 * [INPUT]: 依赖纯 manifest/marker 接口、manifest v1 固定字段与 CMake 指向的正式 QPA proxy 源
 * [OUTPUT]: 对外回归状态/schema/hash/marker，并静态锁定 vendor 先验摘要、原厂 integration 先行、翻译后验门禁、双重委托、PreventUnload 与禁止 qputenv
 * [POS]: injector/windows 的 QPA 激活单元/源码双门；不加载、不执行也不修改任何厂商 DLL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_qpa_contract.h"

#include <QtCore/QByteArray>
#include <QtCore/QDebug>
#include <QtCore/QFile>
#include <QtCore/QString>

#include <cstdio>

namespace {

constexpr auto kVendorHash =
    "e039d39a6b99a26a358a85660147941112a4c9df3a62b5e19a8ae9ed75be3f01";
constexpr auto kProxyHash =
    "1111111111111111111111111111111111111111111111111111111111111111";
constexpr auto kGenericHash =
    "2222222222222222222222222222222222222222222222222222222222222222";
constexpr auto kCavalryExecutableHash =
    "3333333333333333333333333333333333333333333333333333333333333333";

QByteArray manifestPayload(const QByteArray &phase = "active")
{
    return QByteArrayLiteral(
               R"({"schemaVersion":1,"phase":")")
        + phase
        + QByteArrayLiteral(
              R"(","cavalryVersion":"2.7.2","cavalryExecutableSha256":")")
        + QByteArray(kCavalryExecutableHash)
        + QByteArrayLiteral(
              R"(","qtVersion":"6.6.3","architecture":"x86_64","vendorQwindowsSha256":")")
        + QByteArray(kVendorHash)
        + QByteArrayLiteral(R"(","proxyQwindowsSha256":")")
        + QByteArray(kProxyHash)
        + QByteArrayLiteral(R"(","genericPluginSha256":")")
        + QByteArray(kGenericHash)
        + QByteArrayLiteral(R"("})");
}

bool expect(bool condition, const char *message)
{
    if (condition) {
        return true;
    }
    std::fprintf(stderr, "%s\n", message);
    std::fflush(stderr);
    return false;
}

bool verifyProxySourceContract()
{
#ifndef CAVALRY_I18N_QPA_PROXY_SOURCE
    return expect(false, "QPA proxy source contract path is unavailable.");
#else
    QFile sourceFile(
        QString::fromUtf8(CAVALRY_I18N_QPA_PROXY_SOURCE));
    if (!sourceFile.open(QIODevice::ReadOnly)) {
        return expect(false, "Could not read formal QPA proxy source.");
    }
    const QByteArray source = sourceFile.readAll();
    const qsizetype vendorGate =
        source.indexOf("cavalryVerifyVendorQwindowsSha256");
    const qsizetype vendorInstance =
        source.indexOf("QObject *const instance = loader->instance()");
    const qsizetype createWithVendor =
        source.indexOf("QPlatformIntegration *createWithVendor(");
    const qsizetype vendorIntegration =
        source.indexOf("createVendorIntegration(plugin);", createWithVendor);
    const qsizetype genericActivation =
        source.indexOf("installGenericRuntimeOnce(root);", vendorIntegration);
    const qsizetype activationResolver =
        source.indexOf("ActivationDisposition resolveActivation(");
    const qsizetype executableHashGate =
        source.indexOf(
            "QCoreApplication::applicationFilePath()",
            activationResolver);
    const qsizetype manifestHashGate =
        source.indexOf(
            "cavalryVerifyQpaManifestHashes(",
            executableHashGate);
    const qsizetype vendorPlugin =
        source.indexOf("QPlatformIntegrationPlugin *vendorPlugin(");
    return expect(
               !source.contains("qputenv"),
               "Formal QPA proxy must never mutate process language environment.")
        && expect(
               vendorGate >= 0
                   && vendorInstance >= 0
                   && vendorGate < vendorInstance,
               "Vendor qwindows must pass its fixed hash gate before QPluginLoader::instance executes it.")
        && expect(
               createWithVendor >= 0
                   && vendorIntegration >= 0
                   && genericActivation >= 0
                   && vendorIntegration < genericActivation,
               "Vendor integration must exist before any translation activation is attempted.")
        && expect(
               activationResolver >= 0
                   && executableHashGate >= 0
                   && manifestHashGate >= 0
                   && vendorPlugin >= 0
                   && activationResolver < executableHashGate
                   && executableHashGate < manifestHashGate
                   && manifestHashGate < vendorPlugin,
               "Cavalry.exe must be hash-locked inside the post-vendor translation activation gate.")
        && expect(
               source.count("QLibrary::PreventUnloadHint") >= 2,
               "Vendor and generic plugin loaders must both prevent unload.")
        && expect(
               source.contains(
                   "plugin->create(key, paramList);"),
               "Two-argument vendor QPA create is not delegated.")
        && expect(
               source.contains(
                   "plugin->create(key, paramList, argc, argv);"),
               "argc/argv vendor QPA create is not delegated.")
        && expect(
               source.contains("\"cavalry-i18n-qpa\"")
                   && source.contains("\"manifest.json\"")
                   && source.contains("\"vendor-qwindows.dll\""),
               "Formal QPA installation-root paths drifted.")
        && expect(
               source.contains(
                   "genericPlugin->create(\n"
                   "        QString::fromLatin1(kGenericPluginKey),\n"
                   "        language);"),
               "Generic runtime no longer receives the explicit manifest language.");
#endif
}

} // namespace

int main()
{
    if (!verifyProxySourceContract()) {
        return 1;
    }

    for (const QByteArray phase : {"prepared", "active", "restoring"}) {
        CavalryQpaManifest manifest;
        QString error;
        if (!expect(
                cavalryParseQpaManifest(
                    manifestPayload(phase),
                    &manifest,
                    &error),
                qPrintable(error))
            || !expect(
                manifest.phase == QString::fromLatin1(phase),
                "Manifest phase did not round-trip.")
            || !expect(
                cavalryVerifyQpaManifestHashes(
                    manifest,
                    QByteArray(kCavalryExecutableHash),
                    QByteArray(kVendorHash),
                    QByteArray(kProxyHash),
                    QByteArray(kGenericHash),
                    &error),
                qPrintable(error))) {
            return 1;
        }
    }

    const struct {
        QByteArray payload;
        const char *message;
    } invalidManifests[] {
        {
            manifestPayload().replace(
                QByteArrayLiteral(R"("schemaVersion":1)"),
                QByteArrayLiteral(R"("schemaVersion":2)")),
            "Schema drift was accepted.",
        },
        {
            manifestPayload().replace(
                QByteArrayLiteral(R"("phase":"active")"),
                QByteArrayLiteral(R"("phase":"pending")")),
            "Unknown phase was accepted.",
        },
        {
            manifestPayload().replace(
                QByteArrayLiteral(R"("qtVersion":"6.6.3")"),
                QByteArrayLiteral(R"("qtVersion":"6.6.4")")),
            "Qt version drift was accepted.",
        },
        {
            manifestPayload().replace(
                QByteArrayLiteral(R"("genericPluginSha256":")"),
                QByteArrayLiteral(R"("unknown":true,"genericPluginSha256":")")),
            "Unknown manifest key was accepted.",
        },
        {
            manifestPayload().replace(
                QByteArrayLiteral(R"("phase":"active")"),
                QByteArrayLiteral(R"("phase":"prepared","phase":"active")")),
            "Duplicate manifest field was accepted.",
        },
        {
            manifestPayload().replace(
                QByteArrayLiteral(R"("phase":"active")"),
                QByteArrayLiteral(
                    R"("ph\u0061se":"prepared","phase":"active")")),
            "Escaped duplicate manifest field was accepted.",
        },
        {
            manifestPayload().replace(
                QByteArrayLiteral(kVendorHash),
                QByteArrayLiteral(
                    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")),
            "Unverified vendor qwindows was accepted.",
        },
    };

    for (const auto &fixture : invalidManifests) {
        CavalryQpaManifest manifest;
        QString error;
        if (!expect(
                !cavalryParseQpaManifest(
                    fixture.payload,
                    &manifest,
                    &error),
                fixture.message)
            || !expect(!error.isEmpty(), "Rejected manifest had no diagnostic.")) {
            return 1;
        }
    }

    CavalryQpaManifest manifest;
    QString error;
    if (!cavalryParseQpaManifest(
            manifestPayload(),
            &manifest,
            &error)) {
        return 1;
    }
    if (!expect(
            cavalryVerifyVendorQwindowsSha256(
                QByteArray(kVendorHash),
                &error),
            qPrintable(error))
        || !expect(
            !cavalryVerifyVendorQwindowsSha256(
                QByteArray(
                    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
                &error),
            "Unknown vendor qwindows hash was accepted before load.")) {
        return 1;
    }
    if (!expect(
            cavalryVerifyRuntimeQtVersion(
                QStringLiteral("6.6.3"),
                &error),
            qPrintable(error))
        || !expect(
            !cavalryVerifyRuntimeQtVersion(
                QStringLiteral("6.6.4"),
                &error),
            "Runtime Qt version drift was accepted.")) {
        return 1;
    }
    if (!expect(
            !cavalryVerifyQpaManifestHashes(
                manifest,
                QByteArray(kCavalryExecutableHash),
                QByteArray(kVendorHash),
                QByteArray(kProxyHash),
                QByteArray(
                    "4444444444444444444444444444444444444444444444444444444444444444"),
                &error),
            "Generic plugin hash drift was accepted.")) {
        return 1;
    }
    if (!expect(
            !cavalryVerifyQpaManifestHashes(
                manifest,
                QByteArray(
                    "4444444444444444444444444444444444444444444444444444444444444444"),
                QByteArray(kVendorHash),
                QByteArray(kProxyHash),
                QByteArray(kGenericHash),
                &error),
            "Cavalry executable drift was accepted.")) {
        return 1;
    }

    for (const QByteArray payload : {
             QByteArray("en"),
             QByteArray("zh-Hans\n"),
             QByteArray("zh-Hant\r\n"),
             QByteArray("ja_JP"),
         }) {
        QString language;
        if (!expect(
                cavalryParseLanguageMarker(payload, &language, &error),
                qPrintable(error))
            || !expect(!language.isEmpty(), "Language marker decoded empty.")) {
            return 1;
        }
    }

    for (const QByteArray payload : {
             QByteArray("pending\n"),
             QByteArray(" zh-Hans\n"),
             QByteArray("zh-Hans \n"),
             QByteArray("zh-Hans\n\n"),
             QByteArray("ZH-hans\n"),
         }) {
        QString language;
        if (!expect(
                !cavalryParseLanguageMarker(payload, &language, &error),
                "Loose language marker was accepted.")) {
            return 1;
        }
    }

    return 0;
}
