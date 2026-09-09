/**
 * [INPUT]: 依赖 macClassicQuickAddPriorityApi 的 Cavalry UUID/Qt gate、共享 UI 导出校验与 RolloverLabel::text() const 双架构 RVA
 * [OUTPUT]: 实现 macQuickAddCategoryApi；通过后只读取 exact Quick Add RolloverLabel 的完整英文分类 source
 * [POS]: injector 的 macOS Quick Add 类别 ABI 防火墙；失败时返回空 source，绝不把普通 QLabel 或显示译文送入 vendor getter
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_macos_quick_add_category.h"

#include "cavalry_i18n_macos_classic_rank.h"
#include "cavalry_i18n_quick_add_tabs.h"

#include <cstdint>

namespace cavalry_i18n {
namespace {

// C++ 返回值类型由编译器按当前架构展开隐藏返回槽；不要手写隐藏参数。
using RolloverLabelTextFunction = QString (*)(const void *);

constexpr char kRolloverLabelTextSymbol[] =
    "_ZNK13RolloverLabel4textEv";

#if defined(__arm64__) || defined(__aarch64__)
constexpr std::uintptr_t kRolloverLabelTextRva = 0x44180;
constexpr std::uint8_t kArmRolloverLabelTextCode[] = {
    0x09, 0x28, 0x45, 0xa9, 0x09, 0x29, 0x00, 0xa9,
    0x0a, 0x30, 0x40, 0xf9, 0x0a, 0x09, 0x00, 0xf9,
};
#elif defined(__x86_64__)
constexpr std::uintptr_t kRolloverLabelTextRva = 0x466c0;
constexpr std::uint8_t kX8664RolloverLabelTextCode[] = {
    0x55, 0x48, 0x89, 0xe5, 0x48, 0x89, 0xf8, 0x48,
    0x8b, 0x4e, 0x50, 0x0f, 0x10, 0x46, 0x50, 0x0f,
};
#else
#error "Cavalry macOS Quick Add category adapter supports arm64 and x86_64 only"
#endif

struct RuntimeState final {
    bool attempted = false;
    bool verified = false;
    RolloverLabelTextFunction source = nullptr;
};

static RuntimeState gState;

bool resolveSourceGetter(RuntimeState *result) noexcept
{
    if (result == nullptr || !macClassicQuickAddPriorityApi()) {
        return false;
    }

    // 共享 gate 复用已锁定的 CavalryUI RuntimeImage、UUID、导出地址和永久 pin；
    // 本适配器只提供本架构 getter 的独立 symbol/RVA/机器码三元组。
#if defined(__arm64__) || defined(__aarch64__)
    constexpr auto *code = kArmRolloverLabelTextCode;
    constexpr std::size_t codeSize = sizeof(kArmRolloverLabelTextCode);
#else
    constexpr auto *code = kX8664RolloverLabelTextCode;
    constexpr std::size_t codeSize = sizeof(kX8664RolloverLabelTextCode);
#endif
    void *address = macVerifiedQuickAddUiFunction(
        kRolloverLabelTextSymbol,
        kRolloverLabelTextRva,
        code,
        codeSize);
    if (address == nullptr) {
        return false;
    }

    result->source = reinterpret_cast<RolloverLabelTextFunction>(address);
    result->verified = true;
    return true;
}

QString readCategorySource(const QWidget *widget) noexcept
{
    if (!gState.verified || gState.source == nullptr
        || !isQuickAddCategoryLabel(widget)) {
        return QString();
    }

    const QString source = gState.source(widget);
    return isQuickAddCategorySource(source) ? source : QString();
}

} // namespace

MacQuickAddCategoryApi macQuickAddCategoryApi() noexcept
{
    if (!gState.attempted) {
        gState.attempted = true;
        RuntimeState candidate;
        if (resolveSourceGetter(&candidate)) {
            candidate.attempted = true;
            gState = candidate;
        }
    }

    if (!gState.verified) {
        return {};
    }
    return {&readCategorySource};
}

} // namespace cavalry_i18n
