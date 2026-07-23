/**
 * [INPUT]: 依赖 injector/generated_translations.inc 的 TranslationEntry 投影与 Qt QTranslator 查询协议
 * [OUTPUT]: 对外提供精确 (context, source) 首条优先哈希、末条覆盖 source fallback 及嵌入条目统计
 * [POS]: injector/windows 的翻译数据适配层，在共享生成表与 Qt 标准 translator 生命周期之间建立单一边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QByteArray>
#include <QtCore/QHash>
#include <QtCore/QString>
#include <QtCore/QTranslator>

class CavalryEmbeddedTranslator final : public QTranslator
{
public:
    explicit CavalryEmbeddedTranslator(const QString &language);

    QString translate(
        const char *context,
        const char *sourceText,
        const char *disambiguation = nullptr,
        int n = -1) const override;
    bool isEmpty() const override;

    int entryCount() const;
    int exactKeyCount() const;
    int sourceFallbackCount() const;

private:
    QHash<QByteArray, QString> exactTranslations_;
    QHash<QByteArray, QString> sourceFallbacks_;
    int entryCount_ = 0;
};
