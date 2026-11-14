/*
 * [INPUT]: Windows节点header适配器、合成MSVC对象与三语完整/省略文字，不依赖Cavalry安装。
 * [OUTPUT]: 验证直属两header、可选child、坏指针与未知owner拒绝，单次字体选择及UTF8测量/绘制span一致。
 * [POS]: Windows2.8.1 NodeView回归合同；不替代真实字体与实屏验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "dependency_node_adapter.h"
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

namespace nd = native_windows_dependency;
namespace {
unsigned checks = 0;
void require(bool value, const char *message) {
    ++checks;
    if (!value) { std::fprintf(stderr, "FAIL: %s\n", message); std::exit(1); }
}
struct Objects {
    std::array<unsigned char, 0x700> node{}, name{}, type{}, extra{};
    std::array<std::uintptr_t, 4> children{};
    static constexpr std::uintptr_t extension = 0x180000000ULL;
    static void put(void *object, std::size_t offset, std::uintptr_t value) {
        std::memcpy(static_cast<unsigned char *>(object) + offset, &value, sizeof(value));
    }
    Objects(bool optional) {
        put(node.data(), 0, extension + nd::abi::kNodeViewVtable);
        for (auto *object : {&name, &type, &extra}) {
            put(object->data(), 0, extension + nd::abi::kTextViewVtable);
            put(object->data(), nd::abi::kParentOffset, reinterpret_cast<std::uintptr_t>(node.data()));
        }
        const auto first = optional ? 1U : 0U;
        children[0] = reinterpret_cast<std::uintptr_t>(extra.data());
        children[first] = reinterpret_cast<std::uintptr_t>(name.data());
        children[first + 1] = reinterpret_cast<std::uintptr_t>(type.data());
        children[first + 2] = reinterpret_cast<std::uintptr_t>(extra.data());
        put(node.data(), nd::abi::kNameHeaderOffset, reinterpret_cast<std::uintptr_t>(name.data()));
        const auto begin = reinterpret_cast<std::uintptr_t>(children.data());
        put(node.data(), nd::abi::kChildrenOffset, begin);
        put(node.data(), nd::abi::kChildrenOffset + 8, begin + (first + 3) * sizeof(void *));
        put(node.data(), nd::abi::kChildrenOffset + 16, begin + sizeof(children));
    }
    bool read(std::uintptr_t address, void *out, std::size_t bytes) const {
        for (const auto *object : {&node, &name, &type, &extra}) {
            const auto begin = reinterpret_cast<std::uintptr_t>(object->data());
            if (address >= begin && address - begin <= object->size() &&
                bytes <= object->size() - (address - begin)) {
                std::memcpy(out, reinterpret_cast<const void *>(address), bytes); return true;
            }
        }
        const auto begin = reinterpret_cast<std::uintptr_t>(children.data());
        if (address >= begin && address - begin <= sizeof(children) &&
            bytes <= sizeof(children) - (address - begin)) {
            std::memcpy(out, reinterpret_cast<const void *>(address), bytes); return true;
        }
        return false;
    }
    bool owns(const void *view) const {
        return nd::headerOwner(reinterpret_cast<std::uintptr_t>(view), extension,
            [&](std::uintptr_t at, void *out, std::size_t size) { return read(at, out, size); });
    }
};
bool validUtf8(const std::string &text) {
    std::size_t offset = 0;
    while (offset < text.size()) {
        std::int32_t scalar = 0;
        if (!cavalry_i18n::mac_timeline::nextCodepoint(
                reinterpret_cast<const unsigned char *>(text.data()), text.size(), offset, scalar)) return false;
    }
    return true;
}
}

int main() {
    for (const bool optional : {false, true}) {
        Objects objects(optional);
        require(objects.owns(objects.name.data()), "name header with optional child");
        require(objects.owns(objects.type.data()), "type header with optional child");
        require(!objects.owns(objects.extra.data()), "nested/sibling TextView is not a header");
        const auto before = objects.node;
        require(!objects.owns(reinterpret_cast<const void *>(1)), "unreadable object rejected");
        require(objects.node == before, "owner proof never mutates objects");
        Objects::put(objects.node.data(), 0, Objects::extension + nd::abi::kNodeViewVtable + 8);
        require(!objects.owns(objects.name.data()), "unknown parent vtable rejected");
    }
    {
        Objects objects(false);
        objects.children[2] = objects.children[0];
        require(!objects.owns(objects.name.data()), "duplicate name pointer rejected");
        Objects::put(objects.node.data(), nd::abi::kChildrenOffset + 8, 1);
        require(!objects.owns(objects.type.data()), "invalid vector rejected");
    }
    for (const std::string source : {u8"简体节点测试 281", u8"繁體節點測試 281", u8"日本語ノード 281", u8"Mixed 混排 281"}) {
        nd::PaintFrame frame;
        const auto original = source;
        require(frame.capture(source.data(), source.size(), 0), "complete source captured");
        std::array<std::byte, 24> font{}, first{}, second{};
        font.fill(std::byte{0x5a});
        const void *face = reinterpret_cast<const void *>(0x1234);
        std::memcpy(font.data(), &face, sizeof(face));
        unsigned selections = 0;
        const auto pick = [&](const void *data, std::size_t size, const void *passedFont) {
            ++selections;
            require(data && std::string(static_cast<const char *>(data), size) == original,
                    "font selection sees full name");
            require(passedFont == font.data(), "font selection sees borrowed font");
            return reinterpret_cast<const void *>(0x5678);
        };
        const auto measured = frame.font(font.data(), first, pick);
        const auto drawn = frame.font(font.data(), second, pick);
        require(measured == first.data() && drawn == second.data() && first == second,
                "measure and draw share typeface");
        require(selections == 1, "one complete-text font selection per paint");
        require(std::memcmp(first.data() + sizeof(void *), font.data() + sizeof(void *),
                            first.size() - sizeof(void *)) == 0, "font metrics bytes preserved");
        for (std::size_t prefix = 1; prefix < source.size(); ++prefix) {
            const auto fragment = source.substr(0, prefix) + "...";
            const auto a = frame.project(fragment.data(), fragment.size(), 0);
            const auto projected = std::string(static_cast<const char *>(a.text), a.size);
            require(validUtf8(projected), "every partial UTF8 prefix is repaired");
            const auto b = frame.project(fragment.data(), fragment.size(), 0);
            require(projected == std::string(static_cast<const char *>(b.text), b.size),
                    "measure and draw elision are identical");
        }
        require(source == original, "original model name unchanged");
        require(!frame.capture("other", 5, 0) || frame.sourceSize == original.size(),
                "later span cannot replace complete name");
    }
    {
        nd::PaintFrame frame;
        const char invalid[] = {'\xe4', '\xb8'};
        require(!frame.capture(invalid, sizeof(invalid), 0), "invalid full UTF8 rejected");
        require(!frame.sourceKnown && frame.sourceRejected, "invalid text cannot enable fallback");
        const auto span = frame.project(invalid, sizeof(invalid), 0);
        require(span.text == invalid && span.size == sizeof(invalid), "rejected source forwarded");
    }
    {
        nd::PaintFrame frame;
        const std::string oversized(nd::abi::kMaxSourceBytes + 1, 'A');
        require(!frame.capture(oversized.data(), oversized.size(), 0), "source limit is bounded");
    }
    require(nd::measureCaller(nd::abi::kFullMeasureReturn), "complete first measurement admitted");
    require(nd::measureCaller(nd::abi::kPrefixMeasureReturn), "prefix measurement admitted");
    require(nd::drawCaller(nd::abi::kFillDrawReturn) && nd::drawCaller(nd::abi::kStrokeDrawReturn),
            "fill and stroke share route");
    require(!nd::measureCaller(nd::abi::kFullMeasureReturn + 1) &&
            !nd::drawCaller(nd::abi::kFillDrawReturn - 1), "neighboring callers rejected");
    std::printf("PASS: %u Windows dependency-node checks\n", checks);
}
