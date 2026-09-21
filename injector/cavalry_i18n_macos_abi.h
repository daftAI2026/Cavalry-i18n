/**
 * [INPUT]: 依赖当前进程 Mach-O 映像与 Cavalry/Skia 已验证的 64 位字体 ABI
 * [OUTPUT]: 提供加载映像、UUID/符号/字节验证，以及非析构 borrowed 字体存储；调用方各自定义准入合同
 * [POS]: macOS TransformTool 与时间轴适配器共用的底层解析；不持有翻译、字体候选或全局 hook 状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once
#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/nlist.h>
#include <uuid/uuid.h>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
namespace cavalry_i18n::macos_abi {
struct SkSpTypefaceAbi {
    void *pointer;

    SkSpTypefaceAbi() noexcept : pointer(nullptr) {}
    SkSpTypefaceAbi(SkSpTypefaceAbi &&other) noexcept : pointer(other.pointer)
    {
        other.pointer = nullptr;
    }
    SkSpTypefaceAbi(const SkSpTypefaceAbi &) = delete;
    ~SkSpTypefaceAbi() {}
};

struct alignas(8) SkFontAbi {
    std::array<std::byte, 0x18> storage;

    SkFontAbi() noexcept
    {
        storage.fill(std::byte{0});
    }
    SkFontAbi(SkFontAbi &&other) noexcept
    {
        std::memcpy(storage.data(), other.storage.data(), storage.size());
        other.storage.fill(std::byte{0});
    }
    SkFontAbi(const SkFontAbi &) = delete;
    ~SkFontAbi() {}
};

static_assert(sizeof(SkSpTypefaceAbi) == 0x8);
static_assert(sizeof(SkFontAbi) == 0x18);

struct LoadedImage {
    const mach_header_64 *header;
    std::intptr_t slide;
    const char *path;
    const segment_command_64 *textSegment;
    const segment_command_64 *linkeditSegment;
    const symtab_command *symbolTable;
    uuid_t uuid;
    bool hasUuid;
};

inline bool loadImageMetadata(
    const mach_header *rawHeader,
    std::intptr_t slide,
    const char *path,
    LoadedImage *output) noexcept
{
    if (rawHeader == nullptr || output == nullptr || rawHeader->magic != MH_MAGIC_64) {
        return false;
    }

    const auto *header = reinterpret_cast<const mach_header_64 *>(rawHeader);
#if defined(__arm64__)
    if (header->cputype != CPU_TYPE_ARM64) {
        return false;
    }
#elif defined(__x86_64__)
    if (header->cputype != CPU_TYPE_X86_64) {
        return false;
    }
#else
#error Unsupported macOS architecture
#endif

    LoadedImage candidate{};
    candidate.header = header;
    candidate.slide = slide;
    candidate.path = path;

    const auto *cursor = reinterpret_cast<const std::uint8_t *>(header) + sizeof(*header);
    for (std::uint32_t index = 0; index < header->ncmds; ++index) {
        const auto *command = reinterpret_cast<const load_command *>(cursor);
        if (command->cmdsize < sizeof(load_command)) {
            return false;
        }
        if (command->cmd == LC_SEGMENT_64) {
            const auto *segment = reinterpret_cast<const segment_command_64 *>(command);
            if (std::strncmp(segment->segname, SEG_TEXT, sizeof(segment->segname)) == 0) {
                candidate.textSegment = segment;
            } else if (
                std::strncmp(segment->segname, SEG_LINKEDIT, sizeof(segment->segname)) == 0) {
                candidate.linkeditSegment = segment;
            }
        } else if (command->cmd == LC_SYMTAB) {
            candidate.symbolTable = reinterpret_cast<const symtab_command *>(command);
        } else if (command->cmd == LC_UUID) {
            const auto *uuidCommand = reinterpret_cast<const uuid_command *>(command);
            std::memcpy(candidate.uuid, uuidCommand->uuid, sizeof(candidate.uuid));
            candidate.hasUuid = true;
        }
        cursor += command->cmdsize;
    }

    if (candidate.textSegment == nullptr || candidate.linkeditSegment == nullptr ||
        candidate.symbolTable == nullptr || candidate.textSegment->vmaddr != 0) {
        return false;
    }

    *output = candidate;
    return true;
}

inline bool findLoadedImage(const char *basename, LoadedImage *output) noexcept
{
    if (basename == nullptr || output == nullptr) {
        return false;
    }
    for (std::uint32_t index = 0; index < _dyld_image_count(); ++index) {
        const char *path = _dyld_get_image_name(index);
        if (path == nullptr) {
            continue;
        }
        const char *lastSlash = std::strrchr(path, '/');
        const char *candidateName = lastSlash != nullptr ? lastSlash + 1 : path;
        if (std::strcmp(candidateName, basename) != 0) {
            continue;
        }
        return loadImageMetadata(
            _dyld_get_image_header(index),
            _dyld_get_image_vmaddr_slide(index),
            path,
            output);
    }
    return false;
}

inline void *findMachOSymbol(const LoadedImage &image, const char *machOSymbol) noexcept
{
    if (machOSymbol == nullptr || image.linkeditSegment == nullptr ||
        image.symbolTable == nullptr) {
        return nullptr;
    }

    const std::uintptr_t linkeditBase =
        static_cast<std::uintptr_t>(image.slide) + image.linkeditSegment->vmaddr -
        image.linkeditSegment->fileoff;
    const auto *symbols = reinterpret_cast<const nlist_64 *>(
        linkeditBase + image.symbolTable->symoff);
    const auto *strings = reinterpret_cast<const char *>(
        linkeditBase + image.symbolTable->stroff);

    for (std::uint32_t index = 0; index < image.symbolTable->nsyms; ++index) {
        const std::uint32_t stringOffset = symbols[index].n_un.n_strx;
        if (stringOffset == 0 || stringOffset >= image.symbolTable->strsize) {
            continue;
        }
        if (std::strcmp(strings + stringOffset, machOSymbol) != 0) {
            continue;
        }
        const std::uintptr_t address =
            static_cast<std::uintptr_t>(image.slide) + symbols[index].n_value;
        const std::uintptr_t textStart =
            static_cast<std::uintptr_t>(image.slide) + image.textSegment->vmaddr;
        const std::uintptr_t textEnd = textStart + image.textSegment->vmsize;
        return address >= textStart && address < textEnd
            ? reinterpret_cast<void *>(address)
            : nullptr;
    }
    return nullptr;
}

inline void *imageAddress(const LoadedImage &image, std::uintptr_t offset) noexcept
{
    return reinterpret_cast<void *>(
        reinterpret_cast<std::uintptr_t>(image.header) + offset);
}

inline bool imageUuidEquals(const LoadedImage &image, const char *expected) noexcept
{
    if (!image.hasUuid || expected == nullptr) {
        return false;
    }
    char actual[37]{};
    uuid_unparse_upper(image.uuid, actual);
    return std::strcmp(actual, expected) == 0;
}

template <std::size_t Size>
inline bool matchesCode(
    const LoadedImage &image,
    std::uintptr_t offset,
    const std::array<std::uint8_t, Size> &expected) noexcept
{
    const std::uintptr_t start = reinterpret_cast<std::uintptr_t>(image.header) + offset;
    const std::uintptr_t textStart =
        static_cast<std::uintptr_t>(image.slide) + image.textSegment->vmaddr;
    const std::uintptr_t textEnd = textStart + image.textSegment->vmsize;
    return start >= textStart && start + Size <= textEnd &&
        std::memcmp(reinterpret_cast<const void *>(start), expected.data(), Size) == 0;
}

} // namespace cavalry_i18n::macos_abi
