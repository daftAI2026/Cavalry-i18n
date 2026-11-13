/**
 * [INPUT]: 依赖281 NodeView帧、可选装饰前项合同与既有Viewport字符串解码。
 * [OUTPUT]: 两header共用完整源串字体回退；只修复原厂省略串的UTF8断点，不改模型。
 * [POS]: 仅完整header owner可修省略显示span；其它Lina owner仍原参单次透传。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
namespace dependency_node_font_adapter {
namespace abi = ::dependency_node_font::contract;
namespace policy = ::dependency_node_font::policy;

struct DirectChildrenView {
    std::uintptr_t begin = 0;
    std::uintptr_t end = 0;
    std::uintptr_t capacity = 0;
};

bool readDirectChildren(const void *nodeView, DirectChildrenView *out) noexcept
{
    if (nodeView == nullptr || out == nullptr) return false;
    const void *vectorAddress = nullptr;
    if (!addOffset(nodeView, abi::kNodeViewChildrenVectorOffset, &vectorAddress)) return false;
    std::array<std::uintptr_t, 3> fields{};
    if (!readSelf(vectorAddress, sizeof(fields), fields.data())) return false;
    DirectChildrenView candidate{fields[0], fields[1], fields[2]};
    if (candidate.begin == 0 || candidate.end < candidate.begin ||
        candidate.capacity < candidate.end ||
        (candidate.begin & (alignof(void *) - 1U)) != 0 ||
        (candidate.end - candidate.begin) % sizeof(void *) != 0 ||
        (candidate.capacity - candidate.begin) % sizeof(void *) != 0) return false;
    const std::uintptr_t count = (candidate.end - candidate.begin) / sizeof(void *);
    const std::uintptr_t capacity =
        (candidate.capacity - candidate.begin) / sizeof(void *);
    if (count <= abi::kNodeViewTypeHeaderChildIndex || capacity < count) return false;
    *out = candidate;
    return true;
}

bool proveNodeViewHeaderTextView(const void *textView,
                                 std::uintptr_t extensionBase,
                                 policy::OwnerProof *proof,
                                 policy::HeaderSlot *headerSlot) noexcept
{
    if (textView == nullptr || proof == nullptr || headerSlot == nullptr || extensionBase == 0)
        return false;

    std::uintptr_t textViewVtable = 0;
    if (!readSelf(textView, sizeof(textViewVtable), &textViewVtable)) return false;
    proof->textViewVtable = textViewVtable == extensionBase +
        abi::kTextViewVtableAddressPointOffset;
    if (!proof->textViewVtable) return false;

    const void *parentAddress = nullptr;
    if (!addOffset(textView, abi::kDrawableParentPointerOffset, &parentAddress)) return false;
    std::uintptr_t parent = 0;
    if (!readSelf(parentAddress, sizeof(parent), &parent) || parent == 0) return false;
    proof->nodeViewParentPointer = true;

    std::uintptr_t parentVtable = 0;
    if (!readSelf(reinterpret_cast<const void *>(parent), sizeof(parentVtable), &parentVtable))
        return false;
    proof->nodeViewVtable = parentVtable == extensionBase +
        abi::kNodeViewVtableAddressPointOffset;
    if (!proof->nodeViewVtable) return false;

    DirectChildrenView children{};
    if (!readDirectChildren(reinterpret_cast<const void *>(parent), &children)) return false;
    proof->directChildVector = true;

    std::uintptr_t leadingChild = 0, leadingVtable = 0;
    if (!readSelf(reinterpret_cast<const void *>(children.begin), sizeof(leadingChild), &leadingChild) ||
        !readSelf(reinterpret_cast<const void *>(leadingChild), sizeof(leadingVtable), &leadingVtable))
        return false;
    std::size_t headerStart = 0;
    if (leadingVtable == extensionBase + abi::kHeaderDecorationAddressPointOffset) headerStart = 1;
    else if (leadingVtable != extensionBase + abi::kTextViewVtableAddressPointOffset) return false;
    if ((children.end - children.begin) / sizeof(void *) < headerStart + 2) return false;

    policy::HeaderSlot matchedSlot = policy::HeaderSlot::None;
    for (std::size_t relative = abi::kNodeViewNameHeaderChildIndex;
         relative <= abi::kNodeViewTypeHeaderChildIndex; ++relative) {
        const std::size_t index = headerStart + relative;
        const std::uintptr_t slotOffset = index * sizeof(void *);
        if (children.begin > std::numeric_limits<std::uintptr_t>::max() - slotOffset) return false;
        std::uintptr_t child = 0;
        if (!readSelf(reinterpret_cast<const void *>(children.begin + slotOffset),
                      sizeof(child), &child)) return false;
        if (child == reinterpret_cast<std::uintptr_t>(textView)) {
            if (matchedSlot != policy::HeaderSlot::None) return false;
            matchedSlot = policy::headerSlotForIndex(relative);
        }
    }

    *headerSlot = matchedSlot;
    proof->exactHeaderChild = matchedSlot != policy::HeaderSlot::None;
    return proof->exactHeaderChild;
}

bool snapshotTextViewSource(const void *textView, std::uintptr_t extensionBase,
                            TextSnapshot *snapshot, policy::OwnerProof *proof) noexcept
{
    if (textView == nullptr || snapshot == nullptr || proof == nullptr || extensionBase == 0)
        return false;
    const void *targetField = nullptr;
    if (!addOffset(textView, abi::kTextViewTextTargetPointerOffset, &targetField)) return false;
    std::uintptr_t target = 0;
    if (!readSelf(targetField, sizeof(target), &target) || target == 0) return false;

    std::uintptr_t targetVtable = 0;
    if (!readSelf(reinterpret_cast<const void *>(target), sizeof(targetVtable), &targetVtable))
        return false;
    const auto targetKind = policy::sourceTargetForAddressPoint(targetVtable, extensionBase);
    proof->recognizedSourceTarget = targetKind != policy::SourceTarget::Unknown;
    if (!proof->recognizedSourceTarget) return false;

    const void *stringObjectAddress = nullptr;
    if (!addOffset(reinterpret_cast<const void *>(target), abi::kTextTargetStringOffset,
                   &stringObjectAddress)) return false;
    std::array<unsigned char, abi::kLibcxxStringObjectBytes> object{};
    if (!readSelf(stringObjectAddress, object.size(), object.data())) return false;

    // The existing Viewport decoder owns the same libc++ string layout and limit.
    ::viewport_owner::Span span{};
    if (!::viewport_owner::decode(object,
            reinterpret_cast<std::uintptr_t>(stringObjectAddress), &span) ||
        span.size > snapshot->bytes.size()) return false;
    unsigned char terminator = 1;
    if (!readSelf(reinterpret_cast<const void *>(span.data + span.size),
                  sizeof(terminator), &terminator) || terminator != 0 ||
        !readSelf(reinterpret_cast<const void *>(span.data), span.size,
                  snapshot->bytes.data())) return false;
    snapshot->size = span.size;

    proof->completeSourceString = true;
    return true;
}

bool textViewForExactSkiaCaller(Caller caller, std::uintptr_t callerPc,
                                std::uintptr_t dispatcherFrame,
                                std::uintptr_t extensionBase,
                                const void **textView,
                                policy::OwnerProof *proof) noexcept
{
    if (textView == nullptr || proof == nullptr || dispatcherFrame == 0 ||
        (dispatcherFrame & (alignof(void *) - 1U)) != 0) return false;

    const std::uintptr_t callerOffset = callerPc >= extensionBase
        ? callerPc - extensionBase : 0;
    if (caller == Caller::Measure) {
        proof->exactSkiaCaller = abi::isMeasureReturnOffset(callerOffset);
    } else if (caller == Caller::Draw) {
        // Both SimpleText fill and stroke are issued by Drawable::paint for the
        // TextView::paint child call, so both passes share the same NodeView proof.
        proof->exactSkiaCaller = abi::isDrawReturnOffset(callerOffset);
    }
    if (!proof->exactSkiaCaller) return false;

    // The C typed dispatcher frame saves the original Lina caller FP at [dispatcherFrame].
    std::uintptr_t linaFrame = 0;
    if (!readSelf(reinterpret_cast<const void *>(dispatcherFrame +
                        abi::kDispatcherSavedFramePointerOffset),
                  sizeof(linaFrame), &linaFrame) || linaFrame == 0 ||
        (linaFrame & (alignof(void *) - 1U)) != 0) return false;
    proof->frameChainReadable = true;

    std::uintptr_t savedReturnPc = 0;
    const auto readFrameReturn = [](std::uintptr_t frame, std::uintptr_t *output) noexcept {
        if (frame == 0 || output == nullptr ||
            frame > std::numeric_limits<std::uintptr_t>::max() -
                abi::kFrameSavedReturnAddressOffset) return false;
        return readSelf(reinterpret_cast<const void *>(frame +
                           abi::kFrameSavedReturnAddressOffset),
                        sizeof(*output), output);
    };

    std::uintptr_t textViewAddress = 0;
    if (caller == Caller::Measure) {
        // TextView::elideTextToWidth saves its caller's x20=this at elideFP-0x10.
        // TextView::paint's own -0x10 is the caller's x20 and can be ViewComposer state.
        const auto readFrameWord = [](std::uintptr_t address, std::size_t size,
                                      void *destination) noexcept {
            return readSelf(reinterpret_cast<const void *>(address), size, destination);
        };
        if (!readFrameReturn(linaFrame, &savedReturnPc) ||
            savedReturnPc != extensionBase + abi::kTextViewElideReturnToPaintOffset ||
            !policy::readSavedThis(linaFrame, abi::kTextViewElideSavedThisOffset,
                                   readFrameWord, &textViewAddress)) return false;
        proof->exactLinaCallChain = true;
    } else if (caller == Caller::Draw) {
        // The draw call is in Drawable::paint, which TextView::paint invokes directly.
        const auto readFrameWord = [](std::uintptr_t address, std::size_t size,
                                      void *destination) noexcept {
            return readSelf(reinterpret_cast<const void *>(address), size, destination);
        };
        if (!readFrameReturn(linaFrame, &savedReturnPc) ||
            savedReturnPc != extensionBase + abi::kDrawablePaintReturnToTextViewPaintOffset ||
            !policy::readSavedThis(linaFrame, abi::kDrawablePaintSavedThisOffset,
                                   readFrameWord, &textViewAddress)) return false;
        proof->exactLinaCallChain = true;
    } else {
        return false;
    }

    if (textViewAddress == 0) return false;
    *textView = reinterpret_cast<const void *>(textViewAddress);
    return true;
}

template <typename Original, typename Report>
auto dispatchDependencyNodeFont(const void *originalFont, const void *text,
                                std::size_t length, int encoding,
                                Caller caller, std::uintptr_t callerPc,
                                std::uintptr_t dispatcherFrame,
                                Original original, Report report) noexcept
    -> decltype(original(originalFont, text, length))
{
    if (gInsideRuntime || !gAdmitted.load(std::memory_order_acquire) ||
        gExtensionImage.header == nullptr) return original(originalFont, text, length);

    const auto extensionBase = reinterpret_cast<std::uintptr_t>(
        imageAddress(gExtensionImage, 0));
    if (extensionBase == 0) return original(originalFont, text, length);

    policy::OwnerProof proof{};
    const void *textView = nullptr;
    if (!textViewForExactSkiaCaller(caller, callerPc, dispatcherFrame, extensionBase,
                                    &textView, &proof)) return original(originalFont, text, length);

    policy::HeaderSlot headerSlot = policy::HeaderSlot::None;
    if (!proveNodeViewHeaderTextView(textView, extensionBase, &proof, &headerSlot))
        return original(originalFont, text, length);

    TextSnapshot fullSource{};
    if (!snapshotTextViewSource(textView, extensionBase, &fullSource, &proof) ||
        !policy::completeOwnerProof(proof)) return original(originalFont, text, length);

    const std::size_t prefix = policy::repairedElisionPrefix(
        fullSource.bytes.data(), fullSource.size, text, length, encoding);
    RuntimeScope runtimeScope;
    return dispatchVerifiedText(originalFont, fullSource, encoding, caller,
        [&](const void *font) {
            // Shared fallback consumes the complete source before its one synchronous
            // original callback. Reuse only this owned snapshot for the display span.
            if (prefix != policy::kUnchangedTextSpan && prefix + 3 <= fullSource.bytes.size()) {
                std::memcpy(fullSource.bytes.data() + prefix, "...", 3);
                return original(font, fullSource.bytes.data(), prefix + 3);
            }
            return original(font, text, length);
        }, report);
}
}  // namespace dependency_node_font_adapter
