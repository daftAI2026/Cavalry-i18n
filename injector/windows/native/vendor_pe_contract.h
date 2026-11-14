/**
 * [INPUT]: 依赖显式vendor PE路径、预期SHA256与Windows PE结构。
 * [OUTPUT]: 提供只读RVA/导入/导出/相对引用/调用窗/RTTI核验，供平台binary contract共用。
 * [POS]: 测试支持边界；不装载映像、不解析profile、不执行vendor代码。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

#include <QtCore/QCryptographicHash>
#include <QtCore/QFile>
#include <QtCore/QString>

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <string_view>
#include <vector>

namespace native_windows_pe_contract {
inline unsigned checks = 0;

inline void require(bool value, const char *message)
{
    ++checks;
    if (!value) {
        std::fprintf(stderr, "FAIL: %s\n", message);
        std::exit(1);
    }
}

inline unsigned checkCount() noexcept { return checks; }

class Image {
    QByteArray bytes_;
    IMAGE_NT_HEADERS64 nt_{};
    std::vector<IMAGE_SECTION_HEADER> sections_;

    template <typename T>
    T file(std::size_t offset) const
    {
        require(offset <= static_cast<std::size_t>(bytes_.size()) &&
                    sizeof(T) <= static_cast<std::size_t>(bytes_.size()) - offset,
                "PE file bounds");
        T result{};
        std::memcpy(&result, bytes_.constData() + offset, sizeof(T));
        return result;
    }

    std::size_t fileOffset(std::uintptr_t rva, std::size_t length) const
    {
        for (const auto &section : sections_) {
            if (rva < section.VirtualAddress) continue;
            const std::size_t delta = static_cast<std::size_t>(rva - section.VirtualAddress);
            if (delta <= section.SizeOfRawData &&
                length <= static_cast<std::size_t>(section.SizeOfRawData) - delta)
                return static_cast<std::size_t>(section.PointerToRawData) + delta;
        }
        require(false, "RVA backed by PE section bytes");
        return 0;
    }

public:
    Image(const wchar_t *path, std::string_view expectedSha256)
    {
        QFile input(QString::fromWCharArray(path));
        require(input.open(QIODevice::ReadOnly), "explicit vendor image readable");
        bytes_ = input.readAll();
        const auto actualSha = QCryptographicHash::hash(bytes_, QCryptographicHash::Sha256).toHex();
        require(actualSha == QByteArray(expectedSha256.data(),
                                        static_cast<qsizetype>(expectedSha256.size())),
                "frozen vendor image identity");

        const auto dos = file<IMAGE_DOS_HEADER>(0);
        require(dos.e_magic == IMAGE_DOS_SIGNATURE && dos.e_lfanew > 0, "DOS header");
        nt_ = file<IMAGE_NT_HEADERS64>(static_cast<std::size_t>(dos.e_lfanew));
        require(nt_.Signature == IMAGE_NT_SIGNATURE &&
                    nt_.FileHeader.Machine == IMAGE_FILE_MACHINE_AMD64 &&
                    nt_.OptionalHeader.Magic == IMAGE_NT_OPTIONAL_HDR64_MAGIC,
                "MSVC x64 PE identity");
        const auto first = static_cast<std::size_t>(dos.e_lfanew) + sizeof(DWORD) +
            sizeof(IMAGE_FILE_HEADER) + nt_.FileHeader.SizeOfOptionalHeader;
        for (unsigned i = 0; i < nt_.FileHeader.NumberOfSections; ++i)
            sections_.push_back(file<IMAGE_SECTION_HEADER>(first + i * sizeof(IMAGE_SECTION_HEADER)));
    }

    template <typename T>
    T read(std::uintptr_t rva) const
    {
        return file<T>(fileOffset(rva, sizeof(T)));
    }

    std::uintptr_t relative(std::uint64_t absolute) const
    {
        require(absolute >= nt_.OptionalHeader.ImageBase, "image-relative pointer");
        return static_cast<std::uintptr_t>(absolute - nt_.OptionalHeader.ImageBase);
    }

    void text(std::uintptr_t rva, std::string_view expected) const
    {
        for (std::size_t i = 0; i < expected.size(); ++i)
            require(read<unsigned char>(rva + i) == static_cast<unsigned char>(expected[i]),
                    "complete PE string bytes");
        require(read<unsigned char>(rva + expected.size()) == 0, "PE string terminator");
    }

    void type(std::uintptr_t vtable, std::string_view expected) const
    {
        const auto locator = relative(read<std::uint64_t>(vtable - 8));
        require(read<std::uint32_t>(locator) == 1 && read<std::uint32_t>(locator + 4) == 0 &&
                    read<std::uint32_t>(locator + 20) == locator,
                "primary MSVC RTTI locator");
        text(read<std::uint32_t>(locator + 12) + 16, expected);
    }

    void field(std::uintptr_t rva, std::array<unsigned char, 3> opcode,
               std::uintptr_t offset) const
    {
        for (unsigned i = 0; i < opcode.size(); ++i)
            require(read<unsigned char>(rva + i) == opcode[i], "exact member access opcode");
        require(read<std::uint32_t>(rva + 3) == offset,
                "member offset matches vendor instruction");
    }

    void call(std::uintptr_t returnPc, std::string_view symbol) const
    {
        require(read<std::uint16_t>(returnPc - 6) == 0x15ff,
                "RIP-relative import call");
        const auto displacement = read<std::int32_t>(returnPc - 4);
        const auto slot = static_cast<std::uintptr_t>(
            static_cast<std::int64_t>(returnPc) + displacement);
        const auto hintName = read<std::uint64_t>(slot);
        require(hintName <= std::numeric_limits<std::uint32_t>::max(), "named vendor import");
        text(static_cast<std::uintptr_t>(hintName) + 2, symbol);
    }

    std::uintptr_t importSlot(std::string_view dll, std::string_view symbol) const
    {
        const auto directory = nt_.OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT];
        require(directory.VirtualAddress != 0 && directory.Size >= sizeof(IMAGE_IMPORT_DESCRIPTOR),
                "PE import directory present");
        const std::size_t descriptorLimit = directory.Size / sizeof(IMAGE_IMPORT_DESCRIPTOR);
        for (std::size_t descriptorIndex = 0; descriptorIndex < descriptorLimit; ++descriptorIndex) {
            const auto descriptor = read<IMAGE_IMPORT_DESCRIPTOR>(
                directory.VirtualAddress + descriptorIndex * sizeof(IMAGE_IMPORT_DESCRIPTOR));
            if (descriptor.Name == 0) break;
            const auto nameRva = static_cast<std::uintptr_t>(descriptor.Name);
            bool dllMatches = true;
            for (std::size_t i = 0; i < dll.size(); ++i)
                dllMatches = dllMatches && read<unsigned char>(nameRva + i) ==
                    static_cast<unsigned char>(dll[i]);
            dllMatches = dllMatches && read<unsigned char>(nameRva + dll.size()) == 0;
            if (!dllMatches) continue;

            const auto lookupRva = static_cast<std::uintptr_t>(
                descriptor.OriginalFirstThunk ? descriptor.OriginalFirstThunk : descriptor.FirstThunk);
            for (std::size_t index = 0; index < 65536; ++index) {
                const auto thunk = read<IMAGE_THUNK_DATA64>(
                    lookupRva + index * sizeof(IMAGE_THUNK_DATA64));
                if (thunk.u1.AddressOfData == 0) break;
                if (IMAGE_SNAP_BY_ORDINAL64(thunk.u1.Ordinal)) continue;
                const auto importName = static_cast<std::uintptr_t>(thunk.u1.AddressOfData) +
                    offsetof(IMAGE_IMPORT_BY_NAME, Name);
                bool symbolMatches = true;
                for (std::size_t i = 0; i < symbol.size(); ++i)
                    symbolMatches = symbolMatches && read<unsigned char>(importName + i) ==
                        static_cast<unsigned char>(symbol[i]);
                symbolMatches = symbolMatches && read<unsigned char>(importName + symbol.size()) == 0;
                if (symbolMatches)
                    return static_cast<std::uintptr_t>(descriptor.FirstThunk) +
                        index * sizeof(IMAGE_THUNK_DATA64);
            }
        }
        require(false, "expected PE import symbol");
        return 0;
    }

    void importCall(std::uintptr_t returnRva, std::uintptr_t expectedSlot) const
    {
        require(read<std::uint16_t>(returnRva - 6) == 0x15ff,
                "RIP-relative IAT call");
        const auto displacement = read<std::int32_t>(returnRva - 4);
        require(static_cast<std::uintptr_t>(
                    static_cast<std::int64_t>(returnRva) + displacement) == expectedSlot,
                "IAT call resolves to expected import slot");
    }

    std::uintptr_t ripRelativeTarget(std::uintptr_t instructionRva,
                                     std::size_t instructionSize,
                                     std::size_t displacementOffset) const
    {
        require(displacementOffset <= instructionSize &&
                    sizeof(std::int32_t) <= instructionSize - displacementOffset,
                "RIP-relative displacement stays inside the instruction");
        const auto displacement = read<std::int32_t>(instructionRva + displacementOffset);
        return static_cast<std::uintptr_t>(
            static_cast<std::int64_t>(instructionRva + instructionSize) + displacement);
    }

    std::uintptr_t exportRva(std::string_view symbol) const
    {
        const auto directory = nt_.OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
        require(directory.VirtualAddress != 0 && directory.Size >= sizeof(IMAGE_EXPORT_DIRECTORY),
                "PE export directory present");
        const auto exports = read<IMAGE_EXPORT_DIRECTORY>(directory.VirtualAddress);
        for (std::uint32_t i = 0; i < exports.NumberOfNames; ++i) {
            const auto nameRva = read<std::uint32_t>(exports.AddressOfNames + i * sizeof(std::uint32_t));
            bool matches = true;
            for (std::size_t j = 0; j < symbol.size(); ++j)
                matches = matches && read<unsigned char>(nameRva + j) ==
                    static_cast<unsigned char>(symbol[j]);
            matches = matches && read<unsigned char>(nameRva + symbol.size()) == 0;
            if (!matches) continue;
            const auto ordinal = read<std::uint16_t>(
                exports.AddressOfNameOrdinals + i * sizeof(std::uint16_t));
            require(ordinal < exports.NumberOfFunctions, "named export ordinal is in range");
            return read<std::uint32_t>(
                exports.AddressOfFunctions + ordinal * sizeof(std::uint32_t));
        }
        require(false, "expected named PE export");
        return 0;
    }

    void directCall(std::uintptr_t returnRva, std::uintptr_t expectedTarget) const
    {
        require(read<unsigned char>(returnRva - 5) == 0xe8,
                "relative direct call opcode");
        const auto displacement = read<std::int32_t>(returnRva - 4);
        require(static_cast<std::uintptr_t>(
                    static_cast<std::int64_t>(returnRva) + displacement) == expectedTarget,
                "relative direct call target");
    }

    void directJump(std::uintptr_t jumpRva, std::uintptr_t expectedTarget) const
    {
        require(read<unsigned char>(jumpRva) == 0xe9, "relative tail thunk opcode");
        const auto displacement = read<std::int32_t>(jumpRva + 1);
        require(static_cast<std::uintptr_t>(
                    static_cast<std::int64_t>(jumpRva + 5) + displacement) == expectedTarget,
                "relative tail thunk target");
    }

    void bytes(std::uintptr_t rva, const unsigned char *expected, std::size_t size) const
    {
        for (std::size_t i = 0; i < size; ++i)
            require(read<unsigned char>(rva + i) == expected[i], "exact vendor code bytes");
    }
};
}  // namespace native_windows_pe_contract
