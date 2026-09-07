/**
 * [INPUT]: 依赖显式官方 ExtensionLayer.dll 文件、Windows Fast ABI 防火墙与 QtCore 文件/摘要 API
 * [OUTPUT]: 提供不执行厂商 DLL 的 PE 映射正例、逐函数漂移及截断反例
 * [POS]: Windows Fast 标题的 vendor 静态回归门；与共享 payload fixture 和真实 UI 证据分别验证二进制来源、副本语义及最终显示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_quick_add_display_contract.h"
#include <QtCore/QFile>
#include <cstdio>

int main(int argc, char **argv)
{
    if (argc != 2) return 2;
    QFile file(QString::fromLocal8Bit(argv[1]));
    if (!file.open(QIODevice::ReadOnly)) return 2;
    const QByteArray raw = file.readAll();
    IMAGE_DOS_HEADER dos{};
    if (raw.size() < qsizetype(sizeof(dos))) return 2;
    std::memcpy(&dos, raw.constData(), sizeof(dos));
    if (dos.e_lfanew < 0 || dos.e_lfanew > raw.size() - qsizetype(sizeof(IMAGE_NT_HEADERS64))) return 2;
    IMAGE_NT_HEADERS64 nt{};
    std::memcpy(&nt, raw.constData() + dos.e_lfanew, sizeof(nt));
    if (nt.OptionalHeader.SizeOfImage != 0x1bbe000
        || nt.OptionalHeader.SizeOfHeaders > raw.size()) return 2;
    QByteArray mapped(nt.OptionalHeader.SizeOfImage, '\0');
    std::memcpy(mapped.data(), raw.constData(), nt.OptionalHeader.SizeOfHeaders);
    const size_t sections = dos.e_lfanew + offsetof(IMAGE_NT_HEADERS64, OptionalHeader)
        + nt.FileHeader.SizeOfOptionalHeader;
    for (size_t i = 0; i < nt.FileHeader.NumberOfSections; ++i) {
        const size_t offset = sections + i * sizeof(IMAGE_SECTION_HEADER);
        if (offset + sizeof(IMAGE_SECTION_HEADER) > size_t(raw.size())) return 2;
        IMAGE_SECTION_HEADER section{};
        std::memcpy(&section, raw.constData() + offset, sizeof(section));
        if (size_t(section.PointerToRawData) + section.SizeOfRawData > size_t(raw.size())
            || size_t(section.VirtualAddress) + section.SizeOfRawData > size_t(mapped.size())) return 2;
        std::memcpy(mapped.data() + section.VirtualAddress,
            raw.constData() + section.PointerToRawData, section.SizeOfRawData);
    }
    const auto verify = [&] {
        return cavalry_i18n::verifyWindowsQuickAddImage(
            reinterpret_cast<const unsigned char *>(mapped.constData()), mapped.size());
    };
    if (!verify()) { std::puts("FAIL: official Fast ABI"); return 1; }
    for (const auto &range : cavalry_i18n::kQuickAddCodeRanges) {
        mapped[range.rva] = char(mapped.at(range.rva) ^ 1);
        if (verify()) { std::puts("FAIL: changed code accepted"); return 1; }
        mapped[range.rva] = char(mapped.at(range.rva) ^ 1);
    }
    if (!verify() || cavalry_i18n::verifyWindowsQuickAddImage(
        reinterpret_cast<const unsigned char *>(mapped.constData()), mapped.size() - 1)) return 1;
    std::puts("PASS: official Windows Fast ABI, 10 code-drift negatives, truncated image");
    return 0;
}
