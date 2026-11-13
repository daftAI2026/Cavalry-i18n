/**
 * [INPUT]: 纯 Dependency NodeView ABI 合同、adapter frame reader与合成只读栈槽。
 * [OUTPUT]: 验证 owner policy及Measure从elide frame、Draw从Drawable frame取this。
 * [POS]: 不加载 Cavalry、Qt 或 Skia 的离线 adapter合同 smoke source。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "dependency_node_font_policy.h"
#include "viewport_owner_snapshot.h"

#include <array>
#include <atomic>
#include <cstring>
#include <limits>

namespace {
enum class Caller : std::uint8_t { Measure, Draw };

struct TextSnapshot {
    std::array<unsigned char, 16384> bytes{};
    std::size_t size = 0;
};

struct LoadedImage {
    const void *header = reinterpret_cast<const void *>(1);
};

struct RuntimeScope {
    RuntimeScope() noexcept = default;
    ~RuntimeScope() noexcept {}
};

[[maybe_unused]] std::atomic<bool> gAdmitted{true};
[[maybe_unused]] bool gInsideRuntime = false;
[[maybe_unused]] LoadedImage gExtensionImage{};

struct FakeWord {
    std::uintptr_t address = 0;
    std::uintptr_t value = 0;
};

std::array<FakeWord, 16> gFakeWords{};
std::size_t gFakeWordCount = 0;
bool gReadWrongPaintReceiverSlot = false;

void resetFakeMemory() noexcept
{
    gFakeWords = {};
    gFakeWordCount = 0;
    gReadWrongPaintReceiverSlot = false;
}

bool addFakeWord(std::uintptr_t address, std::uintptr_t value) noexcept
{
    if (gFakeWordCount == gFakeWords.size()) return false;
    gFakeWords[gFakeWordCount++] = {address, value};
    return true;
}

bool readSelf(const void *source, std::size_t size, void *destination) noexcept
{
    const auto address = reinterpret_cast<std::uintptr_t>(source);
    if (address == 0x2ff0) gReadWrongPaintReceiverSlot = true;
    if (size != sizeof(std::uintptr_t) || destination == nullptr) return false;
    for (std::size_t index = 0; index < gFakeWordCount; ++index) {
        if (gFakeWords[index].address == address) {
            std::memcpy(destination, &gFakeWords[index].value, sizeof(std::uintptr_t));
            return true;
        }
    }
    return false;
}

bool addOffset(const void *base, std::uintptr_t offset, const void **output) noexcept
{
    const auto address = reinterpret_cast<std::uintptr_t>(base);
    if (base == nullptr || output == nullptr ||
        address > std::numeric_limits<std::uintptr_t>::max() - offset) return false;
    *output = reinterpret_cast<const void *>(address + offset);
    return true;
}

[[maybe_unused]] const void *imageAddress(const LoadedImage &, std::uintptr_t offset) noexcept
{
    constexpr std::uintptr_t kSyntheticImageBase = 0x100000;
    return reinterpret_cast<const void *>(kSyntheticImageBase + offset);
}

template <typename Original, typename Report>
auto dispatchVerifiedText(const void *originalFont, const TextSnapshot &, int,
                          Caller, Original original, Report)
    -> decltype(original(originalFont));

using dependency_node_font::contract::isDrawReturnOffset;
using dependency_node_font::contract::isMeasureReturnOffset;
using dependency_node_font::policy::HeaderSlot;
using dependency_node_font::policy::OwnerProof;
using dependency_node_font::policy::SourceTarget;

constexpr std::uintptr_t kSyntheticImageBase = 0x100000;

static_assert(isMeasureReturnOffset(0x554058));
static_assert(isMeasureReturnOffset(0x5540a0));
static_assert(isMeasureReturnOffset(0x554248));
static_assert(!isMeasureReturnOffset(0x55405c));
static_assert(isDrawReturnOffset(0x477e18));
static_assert(isDrawReturnOffset(0x477e58));
static_assert(!isDrawReturnOffset(0x477e1c));

static_assert(dependency_node_font::policy::headerSlotForIndex(1) == HeaderSlot::NiceName);
static_assert(dependency_node_font::policy::headerSlotForIndex(2) == HeaderSlot::NodeType);
static_assert(dependency_node_font::policy::headerSlotForIndex(0) == HeaderSlot::None);
static_assert(dependency_node_font::policy::headerSlotForIndex(3) == HeaderSlot::None);

static_assert(dependency_node_font::policy::sourceTargetForAddressPoint(
                  kSyntheticImageBase +
                      dependency_node_font::contract::kTextViewConstructorTargetAddressPointOffset,
                  kSyntheticImageBase) == SourceTarget::ConstructorText);
static_assert(dependency_node_font::policy::sourceTargetForAddressPoint(
                  kSyntheticImageBase +
                      dependency_node_font::contract::kTextViewSetTextTargetAddressPointOffset,
                  kSyntheticImageBase) == SourceTarget::UpdatedNameText);
static_assert(dependency_node_font::policy::sourceTargetForAddressPoint(
                  kSyntheticImageBase + 0x1000, kSyntheticImageBase) == SourceTarget::Unknown);

constexpr OwnerProof kCompleteProof{
    true, true, true, true, true, true, true, true, true, true,
};
constexpr OwnerProof kNoHeaderProof{
    true, true, true, true, true, true, true, false, true, true,
};
static_assert(dependency_node_font::policy::completeOwnerProof(kCompleteProof));
static_assert(!dependency_node_font::policy::completeOwnerProof(kNoHeaderProof));

#include "dependency_node_font_adapter.inc"

bool measureReadsElideFrameReceiver() noexcept
{
    constexpr std::uintptr_t kDispatcherFrame = 0x1000;
    constexpr std::uintptr_t kElideFrame = 0x2000;
    constexpr std::uintptr_t kTextViewPaintFrame = 0x3000;
    constexpr std::uintptr_t kTextViewAddress = 0x4440;
    resetFakeMemory();
    if (!addFakeWord(kDispatcherFrame, kElideFrame) ||
        !addFakeWord(kElideFrame, kTextViewPaintFrame) ||
        !addFakeWord(kElideFrame + 8, kSyntheticImageBase + 0x553b6c) ||
        !addFakeWord(kElideFrame - 0x10, kTextViewAddress) ||
        !addFakeWord(kTextViewPaintFrame - 0x10, 0xbad0)) return false;

    dependency_node_font::policy::OwnerProof proof{};
    const void *textView = nullptr;
    const bool accepted = dependency_node_font_adapter::textViewForExactSkiaCaller(
        Caller::Measure, kSyntheticImageBase + 0x554058, kDispatcherFrame,
        kSyntheticImageBase, &textView, &proof);
    return accepted && proof.frameChainReadable && proof.exactLinaCallChain &&
        textView == reinterpret_cast<const void *>(kTextViewAddress) &&
        !gReadWrongPaintReceiverSlot;
}

bool drawReadsDrawableFrameReceiver(std::uintptr_t drawReturnOffset) noexcept
{
    constexpr std::uintptr_t kDispatcherFrame = 0x4000;
    constexpr std::uintptr_t kDrawableFrame = 0x5000;
    constexpr std::uintptr_t kTextViewAddress = 0x5440;
    resetFakeMemory();
    if (!addFakeWord(kDispatcherFrame, kDrawableFrame) ||
        !addFakeWord(kDrawableFrame + 8, kSyntheticImageBase + 0x553bd0) ||
        !addFakeWord(kDrawableFrame - 0x10, kTextViewAddress)) return false;

    dependency_node_font::policy::OwnerProof proof{};
    const void *textView = nullptr;
    const bool accepted = dependency_node_font_adapter::textViewForExactSkiaCaller(
        Caller::Draw, kSyntheticImageBase + drawReturnOffset, kDispatcherFrame,
        kSyntheticImageBase, &textView, &proof);
    return accepted && proof.exactSkiaCaller && proof.exactLinaCallChain &&
        textView == reinterpret_cast<const void *>(kTextViewAddress);
}
}  // namespace

int main()
{
    dependency_node_font::policy::OwnerProof proof{};
    dependency_node_font::policy::HeaderSlot slot =
        dependency_node_font::policy::HeaderSlot::None;
    TextSnapshot snapshot{};
    if (dependency_node_font_adapter::proveNodeViewHeaderTextView(
            nullptr, kSyntheticImageBase, &proof, &slot)) return 1;
    if (dependency_node_font_adapter::snapshotTextViewSource(
            nullptr, kSyntheticImageBase, &snapshot, &proof)) return 2;
    if (!measureReadsElideFrameReceiver()) return 1;
    if (!drawReadsDrawableFrameReceiver(0x477e18)) return 3;
    if (!drawReadsDrawableFrameReceiver(0x477e58)) return 4;
    return 0;
}
