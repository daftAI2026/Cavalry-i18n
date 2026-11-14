/**
 * [INPUT]: 依赖candidate对同 bundle libskia的two-level导入。
 * [OUTPUT]: 保存四个Skia原函数链并核对地址等于已验证导出入口。
 * [POS]: 仅验证直接绑定等于Skia入口；未知previous链不准字体替换。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wreturn-type-c-linkage"
extern "C" void getPathTarget(const void *, std::size_t, int, float, float,
                               const void *, void *)
    __asm__("__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath");
extern "C" float measureTarget(const void *, const void *, std::size_t, int,
                                const void *, const void *) noexcept
    __asm__("__ZNK6SkFont11measureTextEPKvm14SkTextEncodingP6SkRectPK7SkPaint");
extern "C" void drawTarget(const void *, const void *, std::size_t, int,
                            float, float, const void *, const void *) noexcept
    __asm__("__ZN8SkCanvas14drawSimpleTextEPKvm14SkTextEncodingffRK6SkFontRK7SkPaint");
extern "C" viewport_blob::BlobResultAbi blobTarget(
    const void *, std::size_t, const void *, int) noexcept
    __asm__("__ZN10SkTextBlob12MakeFromTextEPKvmRK6SkFont14SkTextEncoding");
#pragma clang diagnostic pop

bool resolveOriginals() noexcept
{
    gOriginalGetPath.store(&getPathTarget, std::memory_order_release);
    gOriginalMeasure.store(&measureTarget, std::memory_order_release);
    gOriginalDraw.store(&drawTarget, std::memory_order_release);
    gOriginalBlob.store(&blobTarget, std::memory_order_release);
    return true;
}

#if defined(__x86_64__)
[[maybe_unused]] bool exactSkiaOriginalBindings() noexcept
#else
bool exactSkiaOriginalBindings() noexcept
#endif
{
    if (gSkiaImage.header == nullptr) return false;
    const auto address = [](auto function) noexcept {
        return reinterpret_cast<const void *>(function);
    };
    return address(gOriginalGetPath.load(std::memory_order_acquire)) ==
               imageAddress(gSkiaImage, e4_contract::kGetPathOffset) &&
           address(gOriginalMeasure.load(std::memory_order_acquire)) ==
               imageAddress(gSkiaImage, observer_contract::kMeasureSymbolOffset) &&
           address(gOriginalDraw.load(std::memory_order_acquire)) ==
               imageAddress(gSkiaImage, observer_contract::kDrawSymbolOffset) &&
           address(gOriginalBlob.load(std::memory_order_acquire)) ==
               imageAddress(gSkiaImage, 0x1b40d8);
}
