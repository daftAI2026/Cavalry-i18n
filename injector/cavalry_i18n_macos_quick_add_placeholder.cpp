/**
 * [INPUT]: 依赖既有 Mac Classic UUID/Qt gate、CavalryUI 导出地址及双架构 setter 字节合同
 * [OUTPUT]: 实现只读 ListWidget placeholder 与调用已验证 vendor setter 的 API
 * [POS]: macOS 空结果 ABI 适配器；以 sizeof、UUID、RVA 与机器码共同证明 this+0x28，写入只走原厂 setter
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_macos_quick_add_placeholder.h"
#include "cavalry_i18n_macos_classic_rank.h"
#include <cstdint>

namespace cavalry_i18n {
namespace {
using Setter = void (*)(void *, const QString &);
static_assert(sizeof(QString) == 0x18 && sizeof(QListWidget) == 0x28,
              "Cavalry 2.7.2 Qt 6.6.3 ListWidget layout required");
#if defined(__arm64__) || defined(__aarch64__)
constexpr std::uintptr_t kSetterRva = 0x382b4;
constexpr unsigned char kSetterCode[] = {
    0xf4,0x4f,0xbe,0xa9,0xfd,0x7b,0x01,0xa9,0xfd,0x43,0x00,0x91,
    0xf3,0x03,0x00,0xaa,0x00,0xa0,0x00,0x91,0xa9,0x9b,0x01,0x94,
    0xe0,0x03,0x13,0xaa,0xfd,0x7b,0x41,0xa9,0xf4,0x4f,0xc2,0xa8,
    0x59,0x9c,0x01,0x14};
#elif defined(__x86_64__)
constexpr std::uintptr_t kSetterRva = 0x39c10;
constexpr unsigned char kSetterCode[] = {
    0x55,0x48,0x89,0xe5,0x53,0x50,0x48,0x89,0xfb,0x48,0x83,0xc7,
    0x28,0xe8,0xd4,0xe6,0x06,0x00,0x48,0x89,0xdf,0x48,0x83,0xc4,
    0x08,0x5b,0x5d,0xe9,0x2e,0xe8,0x06,0x00};
#else
#error "Cavalry Quick Add supports arm64 and x86_64 only"
#endif
Setter resolveSetter() noexcept
{
    return reinterpret_cast<Setter>(macVerifiedQuickAddUiFunction(
        "_ZN10ListWidget14setPlaceholderERK7QString", kSetterRva,
        kSetterCode, sizeof(kSetterCode)));
}
Setter verifiedSetter() noexcept
{
    static const Setter setter = resolveSetter();
    return setter;
}
QString readPlaceholder(const QListWidget *list)
{
    if (list == nullptr || verifiedSetter() == nullptr) return {};
    // setter 的完整双架构指令与 paint 的源共同证明该 QString；不扫描其他私有内存。
    return *reinterpret_cast<const QString *>(
        reinterpret_cast<const unsigned char *>(list) + sizeof(QListWidget));
}
void writePlaceholder(QListWidget *list, const QString &value)
{
    if (list != nullptr) if (Setter setter = verifiedSetter()) setter(list, value);
}
}
QuickAddPlaceholderApi macQuickAddPlaceholderApi() noexcept
{
    return verifiedSetter() != nullptr
        ? QuickAddPlaceholderApi{readPlaceholder, writePlaceholder}
        : QuickAddPlaceholderApi{};
}
}
