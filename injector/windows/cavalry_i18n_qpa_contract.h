/**
 * [INPUT]: 依赖 Qt Core 的 JSON/字节类型与安装根 QPA manifest v1、语言 marker 固定格式
 * [OUTPUT]: 对外提供严格 manifest 解析、三项实际 SHA-256 一致性验证及精确语言 marker 解码
 * [POS]: injector/windows 的纯 QPA 激活合同；代理与单元测试共享，拒绝未知字段、宽松空白和版本漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QByteArray>
#include <QtCore/QString>

struct CavalryQpaManifest final
{
    QString phase;
    QByteArray cavalryExecutableSha256;
    QByteArray vendorQwindowsSha256;
    QByteArray proxyQwindowsSha256;
    QByteArray genericPluginSha256;
};

bool cavalryParseQpaManifest(
    const QByteArray &payload,
    CavalryQpaManifest *manifest,
    QString *error);

bool cavalryVerifyQpaManifestHashes(
    const CavalryQpaManifest &manifest,
    const QByteArray &cavalryExecutableSha256,
    const QByteArray &vendorQwindowsSha256,
    const QByteArray &proxyQwindowsSha256,
    const QByteArray &genericPluginSha256,
    QString *error);

bool cavalryVerifyVendorQwindowsSha256(
    const QByteArray &vendorQwindowsSha256,
    QString *error);

bool cavalryVerifyRuntimeQtVersion(
    const QString &qtVersion,
    QString *error);

bool cavalryParseLanguageMarker(
    const QByteArray &payload,
    QString *language,
    QString *error);
