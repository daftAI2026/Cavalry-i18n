/**
 * [INPUT]: 依赖 Qt Core 的 QString 与 QRegularExpression，接收厂商 QLabel 原文和当前语言
 * [OUTPUT]: 对外提供严格 selected 计数与离线认证倒计时的纯显示翻译；未知语言、未知文本和近似文本返回空值
 * [POS]: injector/windows 显示层的动态 QLabel 规则边界，被 CavalryDisplayTranslator 与单元回归共同消费，不接触 QObject、模型或 setter
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QRegularExpression>
#include <QtCore/QString>

inline QString cavalryI18nDynamicLabelTranslation(
    const QString &source,
    const QString &language)
{
    static const QRegularExpression kSelectedCountPattern(
        QStringLiteral("^([0-9]+) selected$"));
    const QRegularExpressionMatch selectedMatch =
        kSelectedCountPattern.match(source);
    if (selectedMatch.hasMatch()) {
        const QString count = selectedMatch.captured(1);
        if (language == QStringLiteral("zh-Hans")) {
            return QString::fromUtf8("已选择 %1 个").arg(count);
        }
        if (language == QStringLiteral("zh-Hant")) {
            return QString::fromUtf8("已選取 %1 個").arg(count);
        }
        if (language == QStringLiteral("ja_JP")) {
            return QString::fromUtf8("%1 個を選択中").arg(count);
        }
        return QString();
    }

    static const QRegularExpression kOfflineAuthenticationPattern(
        QStringLiteral(
            "^Cavalry is offline\\. You will need to re-authenticate in less "
            "than\\s+([0-9]+)\\s+days\\.$"));
    const QRegularExpressionMatch offlineMatch =
        kOfflineAuthenticationPattern.match(source);
    if (!offlineMatch.hasMatch()) {
        return QString();
    }

    const QString days = offlineMatch.captured(1);
    if (language == QStringLiteral("zh-Hans")) {
        return QString::fromUtf8(
            "Cavalry 已离线。你需要在不到 %1 天内重新认证。")
            .arg(days);
    }
    if (language == QStringLiteral("zh-Hant")) {
        return QString::fromUtf8(
            "Cavalry 已離線。你需要在不到 %1 天內重新驗證。")
            .arg(days);
    }
    if (language == QStringLiteral("ja_JP")) {
        return QString::fromUtf8(
            "Cavalry はオフラインです。%1 日以内に再認証が必要です。")
            .arg(days);
    }
    return QString();
}
