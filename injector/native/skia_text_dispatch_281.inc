/**
 * [INPUT]: 依赖2.8.1 NodeView ABI合同、原Skia函数、owner adapter与共享回退。
 * [OUTPUT]: 将Measure/Draw NodeView精确owner路由放在可读的独立编译片段。
 * [POS]: 仅由CAVALRY_NATIVE_TARGET_281 arm64分支include；2.8.0实现保持原样。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
extern "C" float timelineMeasureDispatch(
    const void *font, const void *text, std::size_t length, int encoding,
    const void *bounds, const void *paint, const void *closure,
    std::uintptr_t callerPc) noexcept
{
    const MeasureOriginal original = requireMeasureOriginal();
#if defined(CAVALRY_NATIVE_TARGET_281)
    const auto extensionBase = reinterpret_cast<std::uintptr_t>(imageAddress(gExtensionImage, 0));
    if (::dependency_node_font::contract::isMeasureReturnOffset(callerPc - extensionBase))
        return dependency_node_font_adapter::dispatchDependencyNodeFont(
            font, encoding, Caller::Measure, callerPc,
            reinterpret_cast<std::uintptr_t>(__builtin_frame_address(0)),
            [&](const void *displayFont) { return original(displayFont, text, length, encoding, bounds, paint); },
            [](DecisionReason) noexcept {});
#endif
    if (viewport_owner::measureCaller(callerPc - reinterpret_cast<std::uintptr_t>(imageAddress(gExtensionImage,0))))
        return dispatchViewportFont(font,text,length,encoding,callerPc,reinterpret_cast<std::uintptr_t>(__builtin_frame_address(0)),true,Caller::Measure,
            [&](const void *displayFont) { return original(displayFont,text,length,encoding,bounds,paint); });
    return dispatchFont(font, text, length, encoding, closure, callerPc, Caller::Measure,
        [&](const void *displayFont) {
            return original(displayFont, text, length, encoding, bounds, paint);
        });
}

extern "C" void timelineDrawDispatch(
    const void *canvas, const void *text, std::size_t length, int encoding,
    float x, float y, const void *font, const void *paint,
    const void *closure, std::uintptr_t callerPc) noexcept
{
    const DrawOriginal original = requireDrawOriginal();
#if defined(CAVALRY_NATIVE_TARGET_281)
    const auto extensionBase = reinterpret_cast<std::uintptr_t>(imageAddress(gExtensionImage, 0));
    if (::dependency_node_font::contract::isDrawReturnOffset(callerPc - extensionBase)) {
        dependency_node_font_adapter::dispatchDependencyNodeFont(
            font, encoding, Caller::Draw, callerPc,
            reinterpret_cast<std::uintptr_t>(__builtin_frame_address(0)),
            [&](const void *displayFont) { original(canvas, text, length, encoding, x, y, displayFont, paint); },
            [](DecisionReason) noexcept {});
        return;
    }
#endif
    dispatchFont(font, text, length, encoding, closure, callerPc, Caller::Draw,
        [&](const void *displayFont) {
            original(canvas, text, length, encoding, x, y, displayFont, paint);
        });
}
