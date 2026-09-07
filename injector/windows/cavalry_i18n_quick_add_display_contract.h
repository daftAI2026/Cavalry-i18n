/**
 * [INPUT]: 依赖 Cavalry 2.7.2 ExtensionLayer PE64 映像、已读证 Fast delegate/registered copy/dtor 机器码与 Qt 6.6.3 元类型
 * [OUTPUT]: 提供 Windows Fast 标题显示的只读 ABI 准入；拒绝版本、绘制/所有权代码及元类型来源漂移
 * [POS]: Windows 显示层与共享 paint-copy adapter 之间的厂商布局防火墙，不修改 IAT、模型或厂商代码
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QCryptographicHash>
#include <QtCore/QMetaType>
#include <array>
#include <cstring>
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <psapi.h>

namespace cavalry_i18n {

// ---- 官方 2.7.2：role 256 copy 到栈，paint 读取 +0x30 QString ----------
// payload 128/8；+0x18 command、+0x48 tags、+0x60 description 不投影。
// 哈希来自原厂 PE 的完整函数；RIP-relative 代码不受 ASLR 重定位影响。
struct QuickAddCodeRange { size_t rva; size_t size; const char *sha256; };
inline constexpr std::array<QuickAddCodeRange, 10> kQuickAddCodeRanges{{
    {0xa55d90, 0xd72, "7992e93b44abb584adef9c8d984ce7008ab0d4dcbdd8be70cbecb3c5984050c5"},
    {0xa57960, 0x5e, "e1e0de9929703807e73c082e21fefd2bd9eef49fd59f919fa75b6a870ce6fb97"},
    {0x5b450, 0xe6, "0f4e2c017cc576ffd37936d891e21707d92f040691f8e7e2ae29e1ab55257774"},
    {0x5b200, 0x77, "e956d6d35fb4a3493ac58aaeb91932f00f25b7ee0d947694f78a202cd4226f48"},
    {0x5b330, 0x10, "930465ff84c8ee5769485dc7388e4bc1f2d526ff96fb8663f666f19c28368cfc"},
    {0x5b440, 0x10, "7c3cc5c7e7e60391172b4b0e692cc9859fac3d13cc8ff16059b69e6519d5190d"},
    // 下面的 thunk 将 registered copy 路由到已验证的 +0x30 QString 复制函数。
    {0x13e8, 5, "844891b9f329bdb3447b55c8f253d2d3746b9d73549e59ef008e3ed0bc6ccff4"},
    {0x5ccc, 5, "33f268c186960921644eb6e964c55db17a9ab58e6d2f82e9f2785cfdcf44c927"},
    {0x1899e, 5, "6d2e37219018412f3af7c5531917cebe6450b7399b1587eb4387bf0e9d226206"},
    {0x1a451, 5, "a8448e0582777985c6605ea7c9617751b5eb45d28ab25533f84fb2aa52fb804a"},
}};

inline bool verifyWindowsQuickAddImage(const unsigned char *image, size_t size)
{
    if (!image || size != 0x1bbe000) return false;
    IMAGE_DOS_HEADER dos{};
    std::memcpy(&dos, image, sizeof(dos));
    if (dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0
        || size_t(dos.e_lfanew) > size - sizeof(IMAGE_NT_HEADERS64)) return false;
    IMAGE_NT_HEADERS64 nt{};
    std::memcpy(&nt, image + dos.e_lfanew, sizeof(nt));
    if (nt.Signature != IMAGE_NT_SIGNATURE
        || nt.FileHeader.Machine != IMAGE_FILE_MACHINE_AMD64
        || nt.FileHeader.TimeDateStamp != 0x6a0300e0
        || nt.OptionalHeader.Magic != IMAGE_NT_OPTIONAL_HDR64_MAGIC
        || nt.OptionalHeader.SizeOfImage != size) return false;
    for (const auto &range : kQuickAddCodeRanges) {
        const auto digest = QCryptographicHash::hash(
            QByteArrayView(reinterpret_cast<const char *>(image + range.rva), range.size),
            QCryptographicHash::Sha256).toHex();
        if (digest != range.sha256) return false;
    }
    return true;
}

inline bool verifiedWindowsQuickAddType(const QMetaType &type)
{
    HMODULE module = GetModuleHandleW(L"ExtensionLayer.dll");
    if (!module) return false;
    const auto *base = reinterpret_cast<const unsigned char *>(module);
    // 完整性只在首次挂接计算；模块永久 PIN，后续 paint 不做 IO 或二进制扫描。
    static const bool verified = [module, base] {
        MODULEINFO info{};
        HMODULE pinned = nullptr;
        return GetModuleInformation(GetCurrentProcess(), module, &info, sizeof(info))
            && verifyWindowsQuickAddImage(base, info.SizeOfImage)
            && GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS
                    | GET_MODULE_HANDLE_EX_FLAG_PIN,
                reinterpret_cast<LPCWSTR>(module), &pinned)
            && pinned == module;
    }();
    // 不接纳同名伪类型：元类型必须来自已采证映像内的唯一 interface。
    if (!verified || reinterpret_cast<const void *>(type.iface()) != base + 0x19ae450
        || type.sizeOf() != 0x80 || type.alignOf() != 8
        || !type.name() || QByteArray(type.name()) != "cavalry::FastQuickAddItem") return false;
    const auto *iface = type.iface();
    return reinterpret_cast<const void *>(iface->copyCtr) == base + 0x5ccc
        && reinterpret_cast<const void *>(iface->dtor) == base + 0x1899e;
}

} // namespace cavalry_i18n
