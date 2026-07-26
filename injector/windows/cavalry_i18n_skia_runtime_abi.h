/**
 * [INPUT]: 依赖 Windows 已映射模块查询、Cavalry 2.7.2 Core/skia 私有导出身份与 MSVC x64 对象 ABI
 * [OUTPUT]: 对外提供先验证后永久 PIN 的 Core/skia 函数表、插件自 PIN 入口，以及纯值身份测试门
 * [POS]: injector/windows 的私有 Skia 运行时防火墙；renderer 只能消费本模块已经锁定的函数表，不能自行 GetProcAddress
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>

#include <cstddef>
#include <cstdint>
#include <memory>

struct CavalrySkiaRuntimeApi final {
    using MakeScalableFontFunction =
        void *(__fastcall *)(void *, void **, float);
    using MakeTypefaceFromNameFunction =
        void *(__fastcall *)(void **, const char *, std::uint32_t);
    using TypefaceUnicharToGlyphFunction =
        std::uint16_t(__fastcall *)(const void *, std::int32_t);
    using SkTextGetPathFunction = void(__fastcall *)(
        const void *,
        std::size_t,
        int,
        float,
        float,
        const void *,
        void *);
    using SkPathConstructorFunction = void *(__fastcall *)(void *);
    using SkPathCopyConstructorFunction =
        void *(__fastcall *)(void *, const void *);
    using SkPathDestructorFunction = void(__fastcall *)(void *);
    using SkPathIsEmptyFunction = bool(__fastcall *)(const void *);
    using SkMatrixSetScaleFunction =
        void *(__fastcall *)(void *, float, float);
    using SkPathTransformFunction =
        void(__fastcall *)(const void *, const void *, void *, int);

    void *makePathFromText = nullptr;
    MakeScalableFontFunction makeScalableFont = nullptr;
    MakeTypefaceFromNameFunction makeTypefaceFromName = nullptr;
    TypefaceUnicharToGlyphFunction unicharToGlyph = nullptr;
    SkTextGetPathFunction getPath = nullptr;
    SkPathConstructorFunction constructPath = nullptr;
    SkPathCopyConstructorFunction copyPath = nullptr;
    SkPathDestructorFunction destroyPath = nullptr;
    SkPathIsEmptyFunction isPathEmpty = nullptr;
    SkMatrixSetScaleFunction setScale = nullptr;
    SkPathTransformFunction transformPath = nullptr;

    bool isComplete() const;
};

class CavalrySkiaRuntimeAbi final
{
public:
    static std::shared_ptr<const CavalrySkiaRuntimeAbi> verifyAndPin(
        QString *detail);

    const CavalrySkiaRuntimeApi &api() const;

private:
    explicit CavalrySkiaRuntimeAbi(CavalrySkiaRuntimeApi api);

    CavalrySkiaRuntimeApi api_;
};

// 任一插件 replacement 写入 IAT 前调用；成功即明确接受插件存活到进程结束。
// Core/skia 私有路径仍须独立完成映像验证与 PIN，不以插件 PIN 代替 ABI 门。
bool pinCavalryI18nModuleForProcessLifetime(
    const void *addressInsidePlugin,
    QString *failureDetail);

#ifdef CAVALRY_I18N_TESTING
bool matchesCavalrySkiaRuntimeIdentityForTesting(
    bool coreImage,
    std::uint16_t machine,
    std::uint16_t optionalMagic,
    std::uint32_t timestamp,
    std::size_t sizeOfImage);
#endif
