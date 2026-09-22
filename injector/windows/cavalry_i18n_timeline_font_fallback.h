/**
 * [INPUT]: 已验证并 process-lifetime PIN 的 CavalrySkiaRuntimeAbi；调用方提供的 24 字节 SkFont 与当前 UTF-8 时间轴名称
 * [OUTPUT]: 对外提供启动期系统字体候选创建、按同步调用选择 borrowed SkFont 拷贝及 fallback 使用标记
 * [POS]: injector/windows 时间轴 measure/draw 共用的字体选择边界；候选字体由本类持有，输出拷贝不拥有 typeface
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>

#include <array>
#include <cstddef>
#include <memory>
#include <string_view>

struct CavalrySkiaRuntimeApi;
class CavalrySkiaRuntimeAbi;

class CavalrySkiaTimelineFontFallback final
{
public:
    struct Selection final {
        const void *font = nullptr;
        bool usedFallback = false;
    };

    static std::unique_ptr<CavalrySkiaTimelineFontFallback> create(
        const QString &language,
        QString *detail);

#ifdef CAVALRY_I18N_TESTING
    static std::unique_ptr<CavalrySkiaTimelineFontFallback>
    createForTesting(
        const QString &language,
        const CavalrySkiaRuntimeApi &api,
        QString *detail);
#endif

    ~CavalrySkiaTimelineFontFallback();

    CavalrySkiaTimelineFontFallback(
        const CavalrySkiaTimelineFontFallback &) = delete;
    CavalrySkiaTimelineFontFallback &operator=(
        const CavalrySkiaTimelineFontFallback &) = delete;

    Selection selectFont(
        const void *sourceFont,
        std::string_view utf8Text,
        std::array<std::byte, 0x18> *borrowedFont) const noexcept;

private:
    struct Impl;

    explicit CavalrySkiaTimelineFontFallback(std::unique_ptr<Impl> impl);

    static std::unique_ptr<CavalrySkiaTimelineFontFallback> createWithApi(
        const QString &language,
        CavalrySkiaRuntimeApi api,
        std::shared_ptr<const CavalrySkiaRuntimeAbi> runtimeAbi,
        QString *detail);

    std::unique_ptr<Impl> impl_;
};
