/**
 * [INPUT]: 依赖 QPA proxy 头、严格 manifest/marker 合同、QPluginLoader 与安装根的 vendor/generic DLL
 * [OUTPUT]: 对外委托两种 QPA create 重载，并仅在 active+hash 完整时显式传语言启动 cavalryi18n runtime
 * [POS]: injector/windows 的原生 Cavalry 启动汇合点；vendor QPA 成功后才尝试翻译，所有翻译故障 fail-open
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_qpa_proxy.h"

#include "cavalry_i18n_qpa_contract.h"

#include <QtCore/QCoreApplication>
#include <QtCore/QCryptographicHash>
#include <QtCore/QDebug>
#include <QtCore/QDir>
#include <QtCore/QFile>
#include <QtCore/QFileInfo>
#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>
#include <QtCore/QLibrary>
#include <QtCore/QPluginLoader>
#include <QtCore/QSaveFile>
#include <QtGui/QGenericPlugin>

#include <memory>

namespace {

constexpr auto kRuntimeDirectory = "cavalry-i18n-qpa";
constexpr auto kManifestFileName = "manifest.json";
constexpr auto kVendorQwindowsFileName = "vendor-qwindows.dll";
constexpr auto kProxyQwindowsFileName = "qwindows.dll";
constexpr auto kGenericDirectory = "generic";
constexpr auto kGenericPluginFileName = "cavalryi18n.dll";
constexpr auto kLanguageMarkerFileName = "cavalry-i18n-lang.txt";
constexpr auto kGenericPluginKey = "cavalryi18n";
constexpr auto kDiagnosticMarkerEnvironment =
    "CAVALRY_I18N_DIAGNOSTIC_MARKER";
constexpr qint64 kMaximumManifestBytes = 16 * 1024;
constexpr qint64 kMaximumLanguageMarkerBytes = 32;

enum class ActivationDisposition {
    Skip,
    Load,
    Error,
};

struct GenericRuntimeState final {
    std::unique_ptr<QPluginLoader> loader;
    QObject *runtime = nullptr;
    bool attempted = false;
};

std::unique_ptr<QPluginLoader> &vendorLoader()
{
    static std::unique_ptr<QPluginLoader> loader;
    return loader;
}

GenericRuntimeState &genericRuntimeState()
{
    // QPA、generic runtime 与其 IAT 回调共同服务到进程结束。使用进程期槽避免
    // Qt/plugin 静态析构顺序反过来销毁仍可能被 Cavalry 调用的代码。
    static auto *const state = new GenericRuntimeState;
    return *state;
}

QString installRoot()
{
    return QDir::cleanPath(QCoreApplication::applicationDirPath());
}

QString runtimePath(const QString &root, const char *fileName)
{
    return QFileInfo(
        root + QLatin1Char('/')
            + QString::fromLatin1(kRuntimeDirectory),
        QString::fromLatin1(fileName))
        .absoluteFilePath();
}

QString rootPath(const QString &root, const char *fileName)
{
    return QFileInfo(root, QString::fromLatin1(fileName))
        .absoluteFilePath();
}

bool readBoundedFile(
    const QString &path,
    qint64 maximumBytes,
    const QString &role,
    QByteArray *payload,
    QString *error)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        *error = QStringLiteral("Could not open %1 at %2: %3")
                     .arg(role, path, file.errorString());
        return false;
    }
    if (file.size() < 0 || file.size() > maximumBytes) {
        *error = QStringLiteral("%1 at %2 exceeds its size contract.")
                     .arg(role, path);
        return false;
    }
    const QByteArray bytes = file.readAll();
    if (bytes.size() != file.size()) {
        *error = QStringLiteral("Could not read complete %1 at %2.")
                     .arg(role, path);
        return false;
    }
    *payload = bytes;
    return true;
}

bool sha256File(
    const QString &path,
    const QString &role,
    QByteArray *digest,
    QString *error)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        *error = QStringLiteral("Could not open %1 at %2: %3")
                     .arg(role, path, file.errorString());
        return false;
    }

    QCryptographicHash hash(QCryptographicHash::Sha256);
    if (!hash.addData(&file)) {
        *error = QStringLiteral("Could not hash %1 at %2.")
                     .arg(role, path);
        return false;
    }
    *digest = hash.result().toHex();
    return true;
}

QJsonObject emptyTextPathDiagnostics()
{
    return {
        { QStringLiteral("revision"), 0 },
        { QStringLiteral("canonicalCalls"), 0 },
        { QStringLiteral("whitelistCalls"), 0 },
        { QStringLiteral("cjkPathSuccess"), 0 },
        { QStringLiteral("originalFallback"), 0 },
        { QStringLiteral("noTranslation"), 0 },
        { QStringLiteral("rendererFailure"), 0 },
        { QStringLiteral("translatedSourceMask"), 0 },
        { QStringLiteral("fallbackSourceMask"), 0 },
    };
}

void writeBootstrapErrorDiagnostic(
    const QString &message,
    const QString &language)
{
    qWarning().noquote()
        << QStringLiteral("[cavalryi18n-qpa] %1").arg(message);

    const QString markerPath =
        qEnvironmentVariable(kDiagnosticMarkerEnvironment);
    if (markerPath.isEmpty() || !QDir::isAbsolutePath(markerPath)) {
        return;
    }

    const QFileInfo markerInfo(QDir::cleanPath(markerPath));
    if (!markerInfo.dir().exists()) {
        qWarning().noquote()
            << QStringLiteral(
                   "[cavalryi18n-qpa] Diagnostic marker parent directory does not exist.");
        return;
    }

    const QJsonObject marker {
        { QStringLiteral("plugin"), QStringLiteral("cavalryi18n") },
        { QStringLiteral("status"), QStringLiteral("error") },
        { QStringLiteral("message"), message },
        { QStringLiteral("language"), language },
        {
            QStringLiteral("translationSource"),
            QStringLiteral("embedded-generated-table")
        },
        { QStringLiteral("embeddedEntryCount"), 0 },
        { QStringLiteral("exactKeyCount"), 0 },
        { QStringLiteral("sourceFallbackCount"), 0 },
        { QStringLiteral("translatorInstalled"), false },
        {
            QStringLiteral("extensionLayerHookStatus"),
            QStringLiteral("not-requested")
        },
        { QStringLiteral("extensionLayerHookDetail"), message },
        {
            QStringLiteral("extensionLayerTextPathDiagnostics"),
            emptyTextPathDiagnostics()
        },
        { QStringLiteral("qtVersion"), QString::fromLatin1(qVersion()) },
        {
            QStringLiteral("processId"),
            QString::number(QCoreApplication::applicationPid())
        },
    };

    QSaveFile markerFile(markerInfo.absoluteFilePath());
    if (!markerFile.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        qWarning().noquote()
            << QStringLiteral(
                   "[cavalryi18n-qpa] Could not open diagnostic marker: %1")
                   .arg(markerFile.errorString());
        return;
    }
    markerFile.write(QJsonDocument(marker).toJson(QJsonDocument::Indented));
    if (!markerFile.commit()) {
        qWarning().noquote()
            << QStringLiteral(
                   "[cavalryi18n-qpa] Could not commit diagnostic marker: %1")
                   .arg(markerFile.errorString());
    }
}

ActivationDisposition resolveActivation(
    const QString &root,
    QString *language,
    QString *error)
{
    QByteArray manifestPayload;
    const QString manifestPath = runtimePath(root, kManifestFileName);
    if (!readBoundedFile(
            manifestPath,
            kMaximumManifestBytes,
            QStringLiteral("QPA manifest"),
            &manifestPayload,
            error)) {
        return ActivationDisposition::Error;
    }

    CavalryQpaManifest manifest;
    if (!cavalryParseQpaManifest(
            manifestPayload,
            &manifest,
            error)) {
        return ActivationDisposition::Error;
    }
    if (manifest.phase != QStringLiteral("active")) {
        return ActivationDisposition::Skip;
    }

    const QString vendorPath =
        runtimePath(root, kVendorQwindowsFileName);
    const QString proxyPath =
        rootPath(root, kProxyQwindowsFileName);
    const QString genericPath = QFileInfo(
        root + QLatin1Char('/')
            + QString::fromLatin1(kGenericDirectory),
        QString::fromLatin1(kGenericPluginFileName))
        .absoluteFilePath();

    QByteArray vendorHash;
    QByteArray proxyHash;
    QByteArray genericHash;
    QByteArray cavalryExecutableHash;
    if (!sha256File(
            QCoreApplication::applicationFilePath(),
            QStringLiteral("Cavalry executable"),
            &cavalryExecutableHash,
            error)
        || !sha256File(
            vendorPath,
            QStringLiteral("vendor qwindows"),
            &vendorHash,
            error)
        || !sha256File(
            proxyPath,
            QStringLiteral("proxy qwindows"),
            &proxyHash,
            error)
        || !sha256File(
            genericPath,
            QStringLiteral("generic translation plugin"),
            &genericHash,
            error)
        || !cavalryVerifyQpaManifestHashes(
            manifest,
            cavalryExecutableHash,
            vendorHash,
            proxyHash,
            genericHash,
            error)) {
        return ActivationDisposition::Error;
    }

    QByteArray markerPayload;
    const QString markerPath =
        rootPath(root, kLanguageMarkerFileName);
    if (!readBoundedFile(
            markerPath,
            kMaximumLanguageMarkerBytes,
            QStringLiteral("language marker"),
            &markerPayload,
            error)
        || !cavalryParseLanguageMarker(
            markerPayload,
            language,
            error)) {
        return ActivationDisposition::Error;
    }

    return *language == QStringLiteral("en")
        ? ActivationDisposition::Skip
        : ActivationDisposition::Load;
}

QPlatformIntegrationPlugin *vendorPlugin(
    const QString &root,
    QString *error)
{
    if (!cavalryVerifyRuntimeQtVersion(
            QString::fromLatin1(qVersion()),
            error)) {
        return nullptr;
    }

    const QString vendorPath =
        runtimePath(root, kVendorQwindowsFileName);
    QByteArray vendorHash;
    if (!sha256File(
            vendorPath,
            QStringLiteral("vendor qwindows"),
            &vendorHash,
            error)
        || !cavalryVerifyVendorQwindowsSha256(
            vendorHash,
            error)) {
        return nullptr;
    }

    auto &loader = vendorLoader();
    if (!loader) {
        loader = std::make_unique<QPluginLoader>(vendorPath);
        loader->setLoadHints(
            loader->loadHints() | QLibrary::PreventUnloadHint);
    }

    QObject *const instance = loader->instance();
    if (instance == nullptr) {
        *error = QStringLiteral("Could not load vendor qwindows: %1")
                     .arg(loader->errorString());
        return nullptr;
    }

    auto *const plugin =
        qobject_cast<QPlatformIntegrationPlugin *>(instance);
    if (plugin == nullptr) {
        *error = QStringLiteral(
            "Vendor qwindows does not implement QPlatformIntegrationPlugin.");
        return nullptr;
    }
    return plugin;
}

void installGenericRuntimeOnce(const QString &root)
{
    auto &state = genericRuntimeState();
    if (state.attempted) {
        return;
    }
    state.attempted = true;

    QString language;
    QString error;
    const ActivationDisposition disposition =
        resolveActivation(root, &language, &error);
    if (disposition == ActivationDisposition::Skip) {
        return;
    }
    if (disposition == ActivationDisposition::Error) {
        writeBootstrapErrorDiagnostic(error, language);
        return;
    }

    const QString genericPath = QFileInfo(
        root + QLatin1Char('/')
            + QString::fromLatin1(kGenericDirectory),
        QString::fromLatin1(kGenericPluginFileName))
        .absoluteFilePath();
    state.loader = std::make_unique<QPluginLoader>(genericPath);
    state.loader->setLoadHints(
        state.loader->loadHints() | QLibrary::PreventUnloadHint);

    QObject *const instance = state.loader->instance();
    auto *const genericPlugin = qobject_cast<QGenericPlugin *>(instance);
    if (genericPlugin == nullptr) {
        writeBootstrapErrorDiagnostic(
            QStringLiteral("Could not load generic translation plugin: %1")
                .arg(state.loader->errorString()),
            language);
        return;
    }

    state.runtime = genericPlugin->create(
        QString::fromLatin1(kGenericPluginKey),
        language);
    if (state.runtime == nullptr) {
        writeBootstrapErrorDiagnostic(
            QStringLiteral(
                "Generic translation plugin rejected the explicit language specification."),
            language);
    }
}

template <typename CreateVendorIntegration>
QPlatformIntegration *createWithVendor(
    CreateVendorIntegration createVendorIntegration)
{
    const QString root = installRoot();
    QString error;
    QPlatformIntegrationPlugin *const plugin =
        vendorPlugin(root, &error);
    if (plugin == nullptr) {
        writeBootstrapErrorDiagnostic(error, QString());
        return nullptr;
    }

    QPlatformIntegration *const integration =
        createVendorIntegration(plugin);
    if (integration == nullptr) {
        writeBootstrapErrorDiagnostic(
            QStringLiteral("Vendor qwindows rejected the platform request."),
            QString());
        return nullptr;
    }

    // 翻译激活发生在原厂窗口系统可用之后；后续任一失败都只跳过翻译。
    installGenericRuntimeOnce(root);
    return integration;
}

} // namespace

QPlatformIntegration *CavalryWindowsQpaProxy::create(
    const QString &key,
    const QStringList &paramList)
{
    return createWithVendor(
        [&key, &paramList](QPlatformIntegrationPlugin *plugin) {
            return plugin->create(key, paramList);
        });
}

QPlatformIntegration *CavalryWindowsQpaProxy::create(
    const QString &key,
    const QStringList &paramList,
    int &argc,
    char **argv)
{
    return createWithVendor(
        [&key, &paramList, &argc, argv](
            QPlatformIntegrationPlugin *plugin) {
            return plugin->create(key, paramList, argc, argv);
        });
}
