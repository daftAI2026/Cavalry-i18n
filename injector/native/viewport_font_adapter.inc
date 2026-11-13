/**
 * [INPUT]: 依赖架构专属Viewport caller、线程栈容器和TextBlob原函数。
 * [OUTPUT]: 为已证完整显示名称共用系统字体回退。
 * [POS]: ARM读getNiceName帧；x86只读首个TextBlob完整名称路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
bool verifyViewportProbe(const LoadedImage &extension) noexcept {
 constexpr std::array<std::uint8_t, 80> viewportNameFrame = {
     0xef, 0x3b, 0xb6, 0x6d, 0xed, 0x33, 0x01, 0x6d,
     0xeb, 0x2b, 0x02, 0x6d, 0xe9, 0x23, 0x03, 0x6d,
     0xfc, 0x6f, 0x04, 0xa9, 0xfa, 0x67, 0x05, 0xa9,
     0xf8, 0x5f, 0x06, 0xa9, 0xf6, 0x57, 0x07, 0xa9,
     0xf4, 0x4f, 0x08, 0xa9, 0xfd, 0x7b, 0x09, 0xa9,
     0xfd, 0x43, 0x02, 0x91, 0xff, 0x43, 0x0b, 0xd1,
     0xf6, 0x03, 0x02, 0xaa, 0xf7, 0x03, 0x01, 0xaa,
     0xf4, 0x03, 0x00, 0xaa, 0x88, 0x6f, 0x00, 0xf0,
     0x08, 0xad, 0x44, 0xf9, 0x08, 0x01, 0x40, 0xf9,
     0xa8, 0x83, 0x15, 0xf8, 0x18, 0x08, 0x40, 0xf9
 };
 constexpr std::array<std::uint8_t, 16> nameProducer = {
     0xe8, 0x43, 0x08, 0x91, 0xe0, 0x03, 0x17, 0xaa,
     0x9e, 0xa0, 0x2b, 0x94, 0xb3, 0xc3, 0x03, 0xd1
 };
 constexpr std::array<std::uint8_t, 48> firstMeasure = {
     0x09, 0x1d, 0x00, 0x13, 0xea, 0x0b, 0x41, 0xf9,
     0xeb, 0x0f, 0x41, 0xf9, 0x3f, 0x01, 0x00, 0x71,
     0xe9, 0x43, 0x08, 0x91, 0x41, 0xb1, 0x89, 0x9a,
     0x62, 0xb1, 0x88, 0x9a, 0x80, 0xc1, 0x05, 0x91,
     0xe4, 0x03, 0x06, 0x91, 0x85, 0x01, 0x18, 0x8b,
     0x03, 0x00, 0x80, 0x52, 0x25, 0xb0, 0x2b, 0x94
 };
 constexpr std::array<std::uint8_t, 52> secondMeasure = {
     0xeb, 0x0f, 0x41, 0xf9, 0x3f, 0x01, 0x00, 0x71,
     0xe9, 0x43, 0x08, 0x91, 0x41, 0xb1, 0x89, 0x9a,
     0x62, 0xb1, 0x88, 0x9a, 0x00, 0x70, 0x00, 0xb0,
     0x00, 0x00, 0x09, 0x91, 0xe4, 0x03, 0x06, 0x91,
     0x08, 0x70, 0x00, 0xb0, 0x08, 0x41, 0x03, 0x91,
     0x05, 0x01, 0x18, 0x8b, 0x03, 0x00, 0x80, 0x52,
     0xfd, 0xaf, 0x2b, 0x94
 };
 constexpr std::array<std::uint8_t, 36> firstTextBlob = {
     0xe0, 0x03, 0x15, 0xaa, 0x52, 0xb6, 0x2b, 0x94,
     0xe1, 0x03, 0x00, 0xaa, 0x02, 0x70, 0x00, 0xb0,
     0x42, 0x00, 0x09, 0x91, 0xa8, 0xc3, 0x03, 0xd1,
     0xe0, 0x03, 0x15, 0xaa, 0x03, 0x00, 0x80, 0x52,
     0x19, 0x88, 0x2b, 0x94
 };
 return matchesCode(extension, 0x23a018, viewportNameFrame) &&
     matchesCode(extension, 0x23a074, nameProducer) &&
     matchesCode(extension, 0x23a200, firstMeasure) &&
     matchesCode(extension, 0x23a29c, secondMeasure) &&
     matchesCode(extension, 0x23acb4, firstTextBlob) &&
     symbolAt(gSkiaImage, observer_contract::kTextBlobSymbol,
              observer_contract::kTextBlobSymbolOffset);
}
viewport_owner::StackRange currentThreadStack() noexcept {
 const auto high=reinterpret_cast<std::uintptr_t>(pthread_get_stackaddr_np(pthread_self()));
 const auto size=pthread_get_stacksize_np(pthread_self());
 return high>=size ? viewport_owner::StackRange{high-size,high} : viewport_owner::StackRange{};
}
template<class Original>
auto dispatchViewportFont(const void *font, const void *text, std::size_t length,
    int encoding, std::uintptr_t callerPc, std::uintptr_t callerFrame,
    bool ownFrame, Caller caller, Original original) noexcept -> decltype(original(font))
{
    if (gInsideRuntime || !gAdmitted.load(std::memory_order_acquire))
        return original(font);
#if defined(__x86_64__)
    (void)ownFrame;
    if (caller != Caller::Draw || encoding != 0) return original(font);
    const auto extensionBase = reinterpret_cast<std::uintptr_t>(
        imageAddress(gExtensionImage, 0));
    if (extensionBase == 0 || callerPc < extensionBase ||
        !native_viewport_blob_x86_64::contract::exactViewportNameBlobCaller(
            callerPc - extensionBase)) return original(font);

    const auto stack = currentThreadStack();
    const auto read = [](std::uintptr_t address, std::size_t size,
                         void *destination) noexcept {
        return readSelf(reinterpret_cast<const void *>(address), size, destination);
    };
    TextSnapshot snapshot{};
    std::size_t snapshotSize = 0;
    const native_viewport_blob_x86_64::StackRange x86Stack{stack.low, stack.high};
    if (!native_viewport_blob_x86_64::snapshot(
            callerPc - extensionBase, encoding, callerFrame, x86Stack,
            reinterpret_cast<std::uintptr_t>(text), length, read,
            snapshot.bytes.data(), snapshot.bytes.size(), &snapshotSize))
        return original(font);
    snapshot.size = snapshotSize;
    RuntimeScope scope;
    return dispatchVerifiedText(font, snapshot, encoding, caller, original,
        [](DecisionReason) noexcept {});
#else
    const auto extensionBase = reinterpret_cast<std::uintptr_t>(
        imageAddress(gExtensionImage, 0));
    if (callerPc < extensionBase) return original(font);
    const auto offset = callerPc - extensionBase;
    if (!viewport_owner::admitted(offset, encoding) ||
        (caller == Caller::Measure ? !viewport_owner::measureCaller(offset)
                                   : !viewport_owner::blobCaller(offset)))
        return original(font);

    RuntimeScope scope;
    const auto stack = currentThreadStack();
    const auto read = [](std::uintptr_t address, std::size_t size,
                         void *destination) noexcept {
        return readSelf(reinterpret_cast<const void *>(address), size, destination);
    };
    if (ownFrame && !viewport_owner::callerFrame(
            callerFrame, stack, callerPc, read, &callerFrame))
        return original(font);

    TextSnapshot snapshot{};
    if (!viewport_owner::snapshot(offset, encoding, callerFrame, stack,
            reinterpret_cast<std::uintptr_t>(text), length, read,
            snapshot.bytes.data(), snapshot.bytes.size(), &snapshot.size))
        return original(font);
    return dispatchVerifiedText(font, snapshot, encoding, caller, original,
        [](DecisionReason) noexcept {});
#endif
}
