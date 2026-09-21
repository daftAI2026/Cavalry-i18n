/**
 * [INPUT]: 依赖共享 macos_abi、时间轴不可变 vendor 合同与 UTF-8 全名称字形覆盖策略
 * [OUTPUT]: 仅向两个已验证名称 caller 提供同步 borrowed 字体副本；其他 measure/draw 原样转发
 * [POS]: macOS 时间轴名称自绘适配器；启动期固定三个系统字体引用，热路径无 IO、缓存、堆分配或文本回写
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_macos_timeline_font.h"
#include "cavalry_i18n_macos_timeline_font_policy.h"
#include "cavalry_i18n_macos_timeline_font_contract.h"
#include <atomic>
#include <mutex>
#include <cmath>

namespace {
using namespace cavalry_i18n::macos_abi;
using namespace cavalry_i18n::mac_timeline_contract;
using Measure = float (*)(const void *, const void *, std::size_t, int, void *, const void *);
using Draw = void (*)(void *, const void *, std::size_t, int, float, float, const void *, const void *);
using MakeTypeface = SkSpTypefaceAbi (*)(const char *, std::uint32_t);
struct Runtime {
    std::once_flag resolveOnce;
    std::atomic<Measure> measure{nullptr};
    std::atomic<Draw> draw{nullptr};
    std::atomic<bool> configured{false}, verified{false}, ready{false};
    LoadedImage extension{};
    cavalry_i18n::mac_timeline::GlyphLookup glyph = nullptr;
    // 每个候选恰持一个 vendor 引用，随不可卸载的 DYLD 注入器保留至进程退出。
    // 不在渲染/重绘中创建、增加引用或维护名称缓存。
    const void *candidates[3]{};
    std::atomic<std::uint64_t> measureCalls{0}, drawCalls{0}, fallbackCalls{0}, originalCalls{0};
};
Runtime state;

void resolveForwarders() noexcept
{
    if (state.measure.load(std::memory_order_acquire) && state.draw.load(std::memory_order_acquire)) return;
    std::call_once(state.resolveOnce, [] {
        LoadedImage skia{};
        if (!findLoadedImage("libskia.dylib", &skia)) return;
        state.measure.store(reinterpret_cast<Measure>(findMachOSymbol(skia,kMeasureSymbol)), std::memory_order_release);
        state.draw.store(reinterpret_cast<Draw>(findMachOSymbol(skia,kDrawSymbol)), std::memory_order_release);
    });
}

const void *selectedFont(const void *font, const void *text, std::size_t size,
                         int encoding, void *caller, bool measure, SkFontAbi &borrowed) noexcept
{
    if (!state.ready.load(std::memory_order_acquire) || !font ||
        caller != imageAddress(state.extension, measure ? kMeasureReturn : kDrawReturn)) return font;
    (measure ? state.measureCalls : state.drawCalls).fetch_add(1,std::memory_order_relaxed);
    float sizeValue = 0;
    std::memcpy(&sizeValue, static_cast<const std::byte *>(font)+sizeof(void *), sizeof(sizeValue));
    if (!std::isfinite(sizeValue) || sizeValue <= 0 || sizeValue > 4096) return font;
    const void *originalTypeface = nullptr;
    std::memcpy(&originalTypeface,font,sizeof(originalTypeface));
    const void *replacement = cavalry_i18n::mac_timeline::selectTypeface(
        originalTypeface,state.candidates,3,text,size,encoding,state.glyph);
    if (replacement == originalTypeface || !cavalry_i18n::mac_timeline::borrowFont(font,replacement,&borrowed)) {
        state.originalCalls.fetch_add(1,std::memory_order_relaxed);return font;
    }
    state.fallbackCalls.fetch_add(1,std::memory_order_relaxed);
    return &borrowed;
}
}

namespace cavalry_i18n {
void configureMacTimelineFont(const char *language) noexcept
{
    if (!language || (std::strcmp(language,"zh-Hans") && std::strcmp(language,"zh-Hant") && std::strcmp(language,"ja_JP"))) return;
    if (state.configured.exchange(true,std::memory_order_acq_rel)) return;
    resolveForwarders();
    LoadedImage extension{},skia{};
    if (!findLoadedImage("libExtensionLayer.dylib",&extension) ||
        !findLoadedImage("libskia.dylib",&skia) || !verify(extension,skia)) return;
    auto make = reinterpret_cast<MakeTypeface>(findMachOSymbol(skia,kMakeTypefaceSymbol));
    auto glyph = reinterpret_cast<mac_timeline::GlyphLookup>(findMachOSymbol(skia,kGlyphSymbol));
    if (!make || !glyph || !state.measure.load() || !state.draw.load()) return;
    state.extension = extension;state.glyph = glyph;
    state.verified.store(true,std::memory_order_release);
    const char *families[3] = {"PingFang SC","PingFang TC","Hiragino Sans"};
    if (!std::strcmp(language,"zh-Hant")) std::swap(families[0],families[1]);
    else if (!std::strcmp(language,"ja_JP")) std::swap(families[0],families[2]);
    bool any = false;
    for (std::size_t i=0;i<3;++i) {
        SkSpTypefaceAbi candidate = make(families[i],0x00050190u);
        state.candidates[i] = candidate.pointer;
        any |= candidate.pointer != nullptr;
    }
    state.ready.store(any,std::memory_order_release);
}
}

extern "C" bool cavalry_i18n_mac_timeline_font_diagnostics_v1(
    cavalry_i18n::MacTimelineFontDiagnostics *out,std::size_t size) noexcept
{
    if (!out || size != sizeof(*out)) return false;
    *out = {state.configured.load(),state.verified.load(),state.ready.load(),
        state.measureCalls.load(),state.drawCalls.load(),state.fallbackCalls.load(),state.originalCalls.load()};
    return true;
}

extern "C" __attribute__((noinline)) float replacementMacTimelineMeasure(
    const void *font,const void *text,std::size_t size,int encoding,void *bounds,const void *paint) noexcept
{
    resolveForwarders();auto original = state.measure.load(std::memory_order_acquire);
    if (!original) return 0;
    SkFontAbi borrowed;
    const void *selected = selectedFont(font,text,size,encoding,
        __builtin_extract_return_addr(__builtin_return_address(0)),true,borrowed);
    return original(selected,text,size,encoding,bounds,paint);
}
extern "C" __attribute__((noinline)) void replacementMacTimelineDraw(
    void *canvas,const void *text,std::size_t size,int encoding,float x,float y,
    const void *font,const void *paint) noexcept
{
    resolveForwarders();auto original = state.draw.load(std::memory_order_acquire);
    if (!original) return;
    SkFontAbi borrowed;
    const void *selected = selectedFont(font,text,size,encoding,
        __builtin_extract_return_addr(__builtin_return_address(0)),false,borrowed);
    original(canvas,text,size,encoding,x,y,selected,paint);
}
extern "C" float macTimelineMeasureTarget(const void *,const void *,std::size_t,int,void *,const void *)
    __asm("__ZNK6SkFont11measureTextEPKvm14SkTextEncodingP6SkRectPK7SkPaint");
extern "C" void macTimelineDrawTarget(void *,const void *,std::size_t,int,float,float,const void *,const void *)
    __asm("__ZN8SkCanvas14drawSimpleTextEPKvm14SkTextEncodingffRK6SkFontRK7SkPaint");
__attribute__((used,section("__DATA,__interpose"))) static const struct {
    const void *replacement;const void *original;
} timelineInterposes[] = {
    {reinterpret_cast<const void *>(replacementMacTimelineMeasure),reinterpret_cast<const void *>(macTimelineMeasureTarget)},
    {reinterpret_cast<const void *>(replacementMacTimelineDraw),reinterpret_cast<const void *>(macTimelineDrawTarget)},
};
