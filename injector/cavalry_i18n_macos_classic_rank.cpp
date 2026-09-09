/**
 * [INPUT]: 依赖 macOS dyld/Mach-O 当前映像、CoreFoundation bundle 元数据、Qt 6.6.3 qVersion，以及 CavalryUI 导出评分函数
 * [OUTPUT]: 实现 macClassicQuickAddPriorityApi 与共享显示符号验证门；回调只验证 ElementListItem primary vtable 后调用已锁定导出
 * [POS]: macOS Classic 排序 ABI 防火墙实现；UUID/RVA/typeinfo 三重锁定阻断未知 Cavalry、架构或伪造 QListWidgetItem
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

#include "cavalry_i18n_macos_classic_rank.h"

#include <CoreFoundation/CoreFoundation.h>
#include <QtCore/qglobal.h>

#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach/machine.h>
#if defined(__arm64__) || defined(__aarch64__)
#include <ptrauth.h>
#endif
#include <dlfcn.h>

#include <cstdint>
#include <cstring>
#include <limits.h>
#include <stdlib.h>
#include <typeinfo>

namespace cavalry_i18n {
namespace {

using GetPriority = int (*)(const void *);
using SetPriority = void (*)(void *, int);
using SortsByPriority = bool (*)(const void *);

struct RuntimeImage {
    const mach_header_64 *header = nullptr;
    intptr_t slide = 0;
    const char *path = nullptr;
    std::uint8_t uuid[16]{};
};

struct ExpectedAbi {
    const char *cavalryUiUuid;
    const char *extensionLayerUuid;
    std::uintptr_t getPriorityRva;
    std::uintptr_t setPriorityRva;
    std::uintptr_t sortsByPriorityRva;
    std::uintptr_t elementTypeInfoRva;
    std::uintptr_t listTypeInfoRva;
    std::uintptr_t elementTypeNameRva;
    std::uintptr_t listTypeNameRva;
    std::uintptr_t uiListTypeInfoRva;
    std::uintptr_t uiListTypeNameRva;
    std::uintptr_t elementVtableRva;
    const std::uint8_t *getPriorityCode;
    std::size_t getPriorityCodeSize;
    const std::uint8_t *setPriorityCode;
    std::size_t setPriorityCodeSize;
    const std::uint8_t *sortsByPriorityCode;
    std::size_t sortsByPriorityCodeSize;
};

struct AdapterState {
    bool attempted = false;
    bool verified = false;
    GetPriority getPriority = nullptr;
    SetPriority setPriority = nullptr;
    SortsByPriority sortsByPriority = nullptr;
    std::uintptr_t elementTypeInfo = 0;
    std::uintptr_t elementVtableAddressPoint = 0;
    void *pinnedUiHandle = nullptr;
    RuntimeImage uiImage;
};

// Itanium RTTI 的公共单继承布局；这里验证继承链，不读取 vendor 私有字段。
struct ItaniumSiTypeInfo {
    std::uintptr_t vtable;
    std::uintptr_t name;
    std::uintptr_t baseTypeInfo;
};


#if defined(__arm64__) || defined(__aarch64__)
constexpr cpu_type_t kCurrentCpu = CPU_TYPE_ARM64;
constexpr std::uint8_t kArmGetPriorityCode[] = {
    0x00, 0x24, 0x40, 0xb9, 0xc0, 0x03, 0x5f, 0xd6,
};
constexpr std::uint8_t kArmSetPriorityCode[] = {
    0x01, 0x24, 0x00, 0xb9, 0xc0, 0x03, 0x5f, 0xd6,
};
constexpr std::uint8_t kArmSortsByPriorityCode[] = {
    0x00, 0xa0, 0x40, 0x39, 0xc0, 0x03, 0x5f, 0xd6,
};
constexpr ExpectedAbi kExpectedAbi{
    // libCavalryUI.dylib / libExtensionLayer.dylib, Cavalry 2.7.2 arm64。
    "E3B81A31-C1D2-3AF2-8886-B980954864CB",
    "9A99CECD-995B-34D6-B089-6A19093A35B1",
    0x0066d68, // ListItem::getPriority() const
    0x0066d70, // ListItem::setPriority(int)
    0x0066d78, // ListItem::sortByPriority() const
    0x0dd5070, // __ZTI15ElementListItem
    0x0dd5058, // __ZTI8ListItem
    0x0d06eaa, // __ZTS15ElementListItem
    0x0d06ebc, // __ZTS8ListItem
    0x0c48b0, // libCavalryUI __ZTI8ListItem
    0x0a5dbd, // libCavalryUI __ZTS8ListItem
    0x0dd5118, // __ZTV15ElementListItem; object address point + 0x10
    kArmGetPriorityCode, sizeof(kArmGetPriorityCode),
    kArmSetPriorityCode, sizeof(kArmSetPriorityCode),
    kArmSortsByPriorityCode, sizeof(kArmSortsByPriorityCode),
};
#elif defined(__x86_64__)
constexpr cpu_type_t kCurrentCpu = CPU_TYPE_X86_64;
constexpr std::uint8_t kX8664GetPriorityCode[] = {
    0x55, 0x48, 0x89, 0xe5, 0x8b, 0x47, 0x24, 0x5d, 0xc3,
};
constexpr std::uint8_t kX8664SetPriorityCode[] = {
    0x55, 0x48, 0x89, 0xe5, 0x89, 0x77, 0x24, 0x5d, 0xc3,
};
constexpr std::uint8_t kX8664SortsByPriorityCode[] = {
    0x55, 0x48, 0x89, 0xe5, 0x0f, 0xb6, 0x47, 0x28, 0x5d, 0xc3,
};
constexpr ExpectedAbi kExpectedAbi{
    // libCavalryUI.dylib / libExtensionLayer.dylib, Cavalry 2.7.2 x86_64。
    "1B1BF0AC-CF15-3549-AED7-506358045EF4",
    "C48EFBA5-24C5-318E-B7CD-FC39A6A01FF8",
    0x006b810, // ListItem::getPriority() const
    0x006b820, // ListItem::setPriority(int)
    0x006b830, // ListItem::sortByPriority() const
    0x0f5c9c0, // __ZTI15ElementListItem
    0x0f5c9a8, // __ZTI8ListItem
    0x0d51a28, // __ZTS15ElementListItem
    0x0d51a3a, // __ZTS8ListItem
    0x0cc9a0, // libCavalryUI __ZTI8ListItem
    0x0ae010, // libCavalryUI __ZTS8ListItem
    0x0f5ca68, // __ZTV15ElementListItem; object address point + 0x10
    kX8664GetPriorityCode, sizeof(kX8664GetPriorityCode),
    kX8664SetPriorityCode, sizeof(kX8664SetPriorityCode),
    kX8664SortsByPriorityCode, sizeof(kX8664SortsByPriorityCode),
};
#else
#error "Cavalry macOS Classic priority adapter supports arm64 and x86_64 only"
#endif

std::uintptr_t stripPointer(std::uintptr_t value) noexcept
{
#if defined(__arm64__) || defined(__aarch64__)
    const auto stripped = reinterpret_cast<std::uintptr_t>(
        ptrauth_strip(reinterpret_cast<void *>(value), ptrauth_key_asda));
    // arm64e 的 RTTI name pointer 在 arm64 编译单元中仍可能带高位 PAC。
    return stripped & UINT64_C(0x0000ffffffffffff);
#else
    return value;
#endif
}

// 进程级成功状态不析构；Cavalry runtime 的导出必须在所有回调期间保持加载。
AdapterState gState;

class NoUnloadHandle final {
public:
    explicit NoUnloadHandle(void *handle) noexcept : handle_(handle) {}
    NoUnloadHandle(const NoUnloadHandle &) = delete;
    NoUnloadHandle &operator=(const NoUnloadHandle &) = delete;

    ~NoUnloadHandle()
    {
        if (handle_ != nullptr && !pinned_) {
            dlclose(handle_);
        }
    }

    void *get() const noexcept
    {
        return handle_;
    }

    void *pin() noexcept
    {
        pinned_ = true;
        return handle_;
    }

private:
    void *handle_ = nullptr;
    bool pinned_ = false;
};

const char *lastContentsMarker(const char *path) noexcept
{
    const char *last = nullptr;
    const char *cursor = path;
    while (cursor != nullptr) {
        const char *candidate = std::strstr(cursor, "/Contents/");
        if (candidate == nullptr) {
            break;
        }
        last = candidate;
        cursor = candidate + 1;
    }
    return last;
}

bool hasPrefix(const char *value, const char *prefix) noexcept
{
    if (value == nullptr || prefix == nullptr) {
        return false;
    }
    const std::size_t length = std::strlen(prefix);
    return std::strncmp(value, prefix, length) == 0;
}

bool canonicalPath(const char *path, char output[PATH_MAX]) noexcept
{
    if (path == nullptr || output == nullptr || path[0] != '/') {
        return false;
    }
    return ::realpath(path, output) != nullptr;
}

const char *findMainExecutablePath() noexcept
{
    for (std::uint32_t index = 0; index < _dyld_image_count(); ++index) {
        const mach_header *rawHeader = _dyld_get_image_header(index);
        const char *path = _dyld_get_image_name(index);
        if (rawHeader == nullptr || path == nullptr
            || rawHeader->magic != MH_MAGIC_64
            || rawHeader->filetype != MH_EXECUTE) {
            continue;
        }
        return path;
    }
    return nullptr;
}

bool parseUuid(const char *text, std::uint8_t output[16]) noexcept
{
    if (text == nullptr || std::strlen(text) != 36) {
        return false;
    }
    std::size_t outputIndex = 0;
    for (std::size_t inputIndex = 0; inputIndex < 36;) {
        if (text[inputIndex] == '-') {
            ++inputIndex;
            continue;
        }
        if (inputIndex + 1 >= 36 || outputIndex >= 16) {
            return false;
        }
        auto hex = [](char value) noexcept -> int {
            if (value >= '0' && value <= '9') return value - '0';
            if (value >= 'a' && value <= 'f') return value - 'a' + 10;
            if (value >= 'A' && value <= 'F') return value - 'A' + 10;
            return -1;
        };
        const int high = hex(text[inputIndex]);
        const int low = hex(text[inputIndex + 1]);
        if (high < 0 || low < 0) {
            return false;
        }
        output[outputIndex++] = static_cast<std::uint8_t>((high << 4) | low);
        inputIndex += 2;
    }
    return outputIndex == 16;
}

bool uuidEquals(const std::uint8_t actual[16], const char *expected) noexcept
{
    std::uint8_t parsed[16]{};
    return parseUuid(expected, parsed)
        && std::memcmp(actual, parsed, sizeof(parsed)) == 0;
}

bool hasCavalryBundlePath(
    const char *mainPath,
    const char *imagePath,
    const char *frameworkLeaf) noexcept
{
    if (mainPath == nullptr || imagePath == nullptr || frameworkLeaf == nullptr) {
        return false;
    }

    // dyld 注入时 index 0 可能是本 dylib，且 /tmp 可能以 /private/tmp 显示；
    // 初始化阶段先解析真实路径，再进行 bundle 关系判断，回调路径绝不触碰文件系统。
    char canonicalMainPath[PATH_MAX]{};
    char canonicalImagePath[PATH_MAX]{};
    if (!canonicalPath(mainPath, canonicalMainPath)
        || !canonicalPath(imagePath, canonicalImagePath)) {
        return false;
    }
    const char *mainContents = lastContentsMarker(canonicalMainPath);
    const char *imageContents = lastContentsMarker(canonicalImagePath);
    if (mainContents == nullptr || imageContents == nullptr
        || mainContents == canonicalMainPath
        || imageContents == canonicalImagePath) {
        return false;
    }
    const std::size_t bundlePrefixLength =
        static_cast<std::size_t>(mainContents - canonicalMainPath);
    if (bundlePrefixLength
            != static_cast<std::size_t>(imageContents - canonicalImagePath)
        || std::strncmp(
               canonicalMainPath, canonicalImagePath, bundlePrefixLength) != 0) {
        return false;
    }
    if (std::strcmp(imageContents, "/Contents/Frameworks/libCavalryUI.dylib") == 0) {
        return std::strcmp(frameworkLeaf, "libCavalryUI.dylib") == 0;
    }
    if (std::strcmp(imageContents, "/Contents/Frameworks/libExtensionLayer.dylib") == 0) {
        return std::strcmp(frameworkLeaf, "libExtensionLayer.dylib") == 0;
    }
    if (std::strcmp(imageContents, "/Contents/Frameworks/QtCore.framework/Versions/A/QtCore") == 0) {
        return std::strcmp(frameworkLeaf, "QtCore") == 0;
    }
    return false;
}

bool readImageUuid(const mach_header_64 *header, std::uint8_t output[16]) noexcept
{
    if (header == nullptr || header->magic != MH_MAGIC_64
        || header->cputype != kCurrentCpu) {
        return false;
    }
    const auto *command = reinterpret_cast<const load_command *>(header + 1);
    for (std::uint32_t index = 0; index < header->ncmds; ++index) {
        if (command->cmd == LC_UUID
            && command->cmdsize >= sizeof(uuid_command)) {
            const auto *uuid = reinterpret_cast<const uuid_command *>(command);
            std::memcpy(output, uuid->uuid, 16);
            return true;
        }
        if (command->cmdsize < sizeof(load_command)) {
            return false;
        }
        command = reinterpret_cast<const load_command *>(
            reinterpret_cast<const std::uint8_t *>(command) + command->cmdsize);
    }
    return false;
}

bool findLoadedImage(
    const char *mainPath,
    const char *frameworkLeaf,
    RuntimeImage *result) noexcept
{
    if (result == nullptr) {
        return false;
    }
    for (std::uint32_t index = 0; index < _dyld_image_count(); ++index) {
        const mach_header *rawHeader = _dyld_get_image_header(index);
        const char *path = _dyld_get_image_name(index);
        if (rawHeader == nullptr || path == nullptr
            || !hasCavalryBundlePath(mainPath, path, frameworkLeaf)
            || rawHeader->magic != MH_MAGIC_64) {
            continue;
        }
        RuntimeImage candidate;
        candidate.header = reinterpret_cast<const mach_header_64 *>(rawHeader);
        candidate.slide = _dyld_get_image_vmaddr_slide(index);
        candidate.path = path;
        if (!readImageUuid(candidate.header, candidate.uuid)
            || (std::strcmp(frameworkLeaf, "libCavalryUI.dylib") == 0
                && !uuidEquals(candidate.uuid, kExpectedAbi.cavalryUiUuid))
            || (std::strcmp(frameworkLeaf, "libExtensionLayer.dylib") == 0
                && !uuidEquals(candidate.uuid, kExpectedAbi.extensionLayerUuid))) {
            continue;
        }
        *result = candidate;
        return true;
    }
    return false;
}

std::uintptr_t runtimeAddress(
    const RuntimeImage &image,
    std::uintptr_t rva) noexcept
{
    return static_cast<std::uintptr_t>(image.slide) + rva;
}

bool bundleStringEquals(
    CFBundleRef bundle,
    CFStringRef key,
    const char *expected) noexcept
{
    if (bundle == nullptr || key == nullptr || expected == nullptr) {
        return false;
    }
    CFTypeRef value = CFBundleGetValueForInfoDictionaryKey(bundle, key);
    if (value == nullptr || CFGetTypeID(value) != CFStringGetTypeID()) {
        return false;
    }
    char buffer[64]{};
    return CFStringGetCString(
               static_cast<CFStringRef>(value),
               buffer,
               sizeof(buffer),
               kCFStringEncodingUTF8)
        && std::strcmp(buffer, expected) == 0;
}

bool verifyBundleAndQt(const char *mainPath) noexcept
{
    if (mainPath == nullptr || !hasPrefix(mainPath, "/")) {
        return false;
    }
    const char *executable = std::strrchr(mainPath, '/');
    if (executable == nullptr || std::strcmp(executable + 1, "Cavalry") != 0) {
        return false;
    }
    CFBundleRef bundle = CFBundleGetMainBundle();
    if (!bundle
        || !bundleStringEquals(
            bundle, CFSTR("CFBundleIdentifier"), "com.scenegroup.cavalry")
        || !bundleStringEquals(
            bundle, CFSTR("CFBundleShortVersionString"), "2.7.2")) {
        return false;
    }
    if (std::strcmp(qVersion(), "6.6.3") != 0) {
        return false;
    }
    RuntimeImage qtCore;
    return findLoadedImage(mainPath, "QtCore", &qtCore);
}

bool isTextRange(
    const RuntimeImage &image,
    std::uintptr_t rva,
    std::size_t length) noexcept
{
    if (image.header == nullptr || length == 0) {
        return false;
    }
    const auto *command = reinterpret_cast<const load_command *>(image.header + 1);
    for (std::uint32_t index = 0; index < image.header->ncmds; ++index) {
        if (command->cmd == LC_SEGMENT_64
            && command->cmdsize >= sizeof(segment_command_64)) {
            const auto *segment =
                reinterpret_cast<const segment_command_64 *>(command);
            const auto *section = reinterpret_cast<const section_64 *>(
                segment + 1);
            for (std::uint32_t sectionIndex = 0;
                 sectionIndex < segment->nsects;
                 ++sectionIndex) {
                if (std::strncmp(section[sectionIndex].sectname, "__text", 16) != 0
                    || std::strncmp(section[sectionIndex].segname, "__TEXT", 16) != 0) {
                    continue;
                }
                const std::uintptr_t begin = section[sectionIndex].addr;
                return rva >= begin
                    && rva - begin <= section[sectionIndex].size
                    && length <= section[sectionIndex].size - (rva - begin);
            }
        }
        if (command->cmdsize < sizeof(load_command)) {
            return false;
        }
        command = reinterpret_cast<const load_command *>(
            reinterpret_cast<const std::uint8_t *>(command) + command->cmdsize);
    }
    return false;
}

bool verifyFunctionCode(
    const RuntimeImage &image,
    std::uintptr_t rva,
    const std::uint8_t *expected,
    std::size_t length) noexcept
{
    return expected != nullptr
        && isTextRange(image, rva, length)
        && std::memcmp(
               reinterpret_cast<const void *>(runtimeAddress(image, rva)),
               expected,
               length) == 0;
}

bool verifyElementRtti(
    const RuntimeImage &extension,
    const RuntimeImage &ui,
    std::uintptr_t listWidgetItemTypeInfo,
    std::uintptr_t *elementTypeInfo,
    std::uintptr_t *elementVtableAddressPoint) noexcept
{
    if (listWidgetItemTypeInfo == 0
        || elementTypeInfo == nullptr
        || elementVtableAddressPoint == nullptr) {
        return false;
    }
    const std::uintptr_t elementTypeInfoAddress = runtimeAddress(
        extension, kExpectedAbi.elementTypeInfoRva);
    const std::uintptr_t extensionListTypeInfoAddress = runtimeAddress(
        extension, kExpectedAbi.listTypeInfoRva);
    const std::uintptr_t uiListTypeInfoAddress = runtimeAddress(
        ui, kExpectedAbi.uiListTypeInfoRva);
    const std::uintptr_t elementVtableAddress = runtimeAddress(
        extension, kExpectedAbi.elementVtableRva);
    const auto *elementInfo = reinterpret_cast<const ItaniumSiTypeInfo *>(
        elementTypeInfoAddress);
    const std::uintptr_t listTypeInfoAddress = stripPointer(
        elementInfo->baseTypeInfo);
    if (listTypeInfoAddress != extensionListTypeInfoAddress
        && listTypeInfoAddress != uiListTypeInfoAddress) {
        return false;
    }
    const auto *listInfo = reinterpret_cast<const ItaniumSiTypeInfo *>(
        listTypeInfoAddress);
    const auto *vtable = reinterpret_cast<const std::uintptr_t *>(
        elementVtableAddress);

    // __ZTS 地址、单继承 typeinfo 链和 vtable 的 RTTI 槽都是静态可核查的双架构证据。
    // Itanium 单继承表示 primary base 在 offset 0；这里不触碰任何 vendor 私有字段。
    const std::uintptr_t expectedListTypeName =
        listTypeInfoAddress == extensionListTypeInfoAddress
            ? runtimeAddress(extension, kExpectedAbi.listTypeNameRva)
            : runtimeAddress(ui, kExpectedAbi.uiListTypeNameRva);
    if (stripPointer(elementInfo->vtable) != stripPointer(listInfo->vtable)
        || stripPointer(elementInfo->name) != runtimeAddress(
            extension, kExpectedAbi.elementTypeNameRva)
        || stripPointer(listInfo->name) != expectedListTypeName
        || stripPointer(listInfo->baseTypeInfo) != listWidgetItemTypeInfo
        || vtable[0] != 0
        || stripPointer(vtable[1]) != elementTypeInfoAddress) {
        return false;
    }

    *elementTypeInfo = elementTypeInfoAddress;
    *elementVtableAddressPoint = elementVtableAddress + 2 * sizeof(void *);
    return true;
}

bool resolveFunction(
    void *handle,
    const RuntimeImage &image,
    const char *symbol,
    std::uintptr_t rva,
    const std::uint8_t *expectedCode,
    std::size_t expectedCodeSize,
    void **result) noexcept
{
    if (handle == nullptr || symbol == nullptr || result == nullptr) {
        return false;
    }
    if (!verifyFunctionCode(image, rva, expectedCode, expectedCodeSize)) {
        return false;
    }
    dlerror();
    void *address = dlsym(handle, symbol);
    const char *error = dlerror();
    if (error != nullptr || address == nullptr
        || reinterpret_cast<std::uintptr_t>(address)
            != runtimeAddress(image, rva)) {
        return false;
    }
    *result = address;
    return true;
}

bool resolveAdapter(AdapterState *result) noexcept
{
    if (result == nullptr) {
        return false;
    }
    // 注入 dylib 可以排在 dyld image 0；必须按 MH_EXECUTE 找真正的 Cavalry 主映像。
    const char *mainPath = findMainExecutablePath();
    if (!verifyBundleAndQt(mainPath)) {
        return false;
    }

    RuntimeImage ui;
    RuntimeImage extension;
    if (!findLoadedImage(mainPath, "libCavalryUI.dylib", &ui)
        || !findLoadedImage(mainPath, "libExtensionLayer.dylib", &extension)) {
        return false;
    }

    NoUnloadHandle uiHandle(dlopen(ui.path, RTLD_LAZY | RTLD_NOLOAD));
    if (uiHandle.get() == nullptr) {
        return false;
    }

    void *get = nullptr;
    void *set = nullptr;
    void *sort = nullptr;
    if (!resolveFunction(
            uiHandle.get(),
            ui,
            "_ZNK8ListItem11getPriorityEv",
            kExpectedAbi.getPriorityRva,
            kExpectedAbi.getPriorityCode,
            kExpectedAbi.getPriorityCodeSize,
            &get)
        || !resolveFunction(
            uiHandle.get(),
            ui,
            "_ZN8ListItem11setPriorityEi",
            kExpectedAbi.setPriorityRva,
            kExpectedAbi.setPriorityCode,
            kExpectedAbi.setPriorityCodeSize,
            &set)
        || !resolveFunction(
            uiHandle.get(),
            ui,
            "_ZNK8ListItem14sortByPriorityEv",
            kExpectedAbi.sortsByPriorityRva,
            kExpectedAbi.sortsByPriorityCode,
            kExpectedAbi.sortsByPriorityCodeSize,
            &sort)) {
        return false;
    }

    dlerror();
    void *listWidgetItemTypeInfo =
        dlsym(RTLD_DEFAULT, "_ZTI15QListWidgetItem");
    if (dlerror() != nullptr || listWidgetItemTypeInfo == nullptr) {
        return false;
    }

    AdapterState candidate;
    if (!verifyElementRtti(
            extension,
            ui,
            stripPointer(reinterpret_cast<std::uintptr_t>(listWidgetItemTypeInfo)),
            &candidate.elementTypeInfo,
            &candidate.elementVtableAddressPoint)) {
        return false;
    }
    candidate.getPriority = reinterpret_cast<GetPriority>(get);
    candidate.setPriority = reinterpret_cast<SetPriority>(set);
    candidate.sortsByPriority = reinterpret_cast<SortsByPriority>(sort);
    candidate.pinnedUiHandle = uiHandle.pin();
    candidate.uiImage = ui;
    candidate.verified = true;
    *result = candidate;
    return true;
}

bool acceptsElementListItem(const QListWidgetItem *item) noexcept
{
    if (!gState.verified || item == nullptr) {
        return false;
    }

    std::uintptr_t vtable = 0;
    std::memcpy(&vtable, static_cast<const void *>(item), sizeof(vtable));
    if (vtable != gState.elementVtableAddressPoint) {
        return false;
    }

    // Itanium vtable address point 前两个槽是 offset-to-top 与 typeinfo。
    const auto *vtableSlots = reinterpret_cast<const std::uintptr_t *>(vtable);
    if (vtableSlots[-2] != 0
        || stripPointer(vtableSlots[-1]) != gState.elementTypeInfo) {
        return false;
    }

    // 字符串仅作第二证据；真正的类型门是已锁 UUID 的 vtable/typeinfo 地址。
    return std::strcmp(typeid(*item).name(), "15ElementListItem") == 0;
}

bool accepts(const QListWidgetItem *item) noexcept
{
    return acceptsElementListItem(item);
}

int getPriority(const QListWidgetItem *item) noexcept
{
    return acceptsElementListItem(item) && gState.getPriority != nullptr
        ? gState.getPriority(item)
        : 0;
}

void setPriority(QListWidgetItem *item, int priority) noexcept
{
    if (acceptsElementListItem(item) && gState.setPriority != nullptr) {
        gState.setPriority(item, priority);
    }
}

bool sortsByPriority(const QListWidgetItem *item) noexcept
{
    return acceptsElementListItem(item) && gState.sortsByPriority != nullptr
        && gState.sortsByPriority(item);
}

} // namespace

ClassicQuickAddPriorityApi macClassicQuickAddPriorityApi() noexcept
{
    if (!gState.attempted) {
        gState.attempted = true;
        AdapterState candidate;
        if (resolveAdapter(&candidate)) {
            // 成功后只保留已证明的永久映像；失败不会覆盖已有成功状态。
            candidate.attempted = true;
            gState = candidate;
        }
    }
    if (!gState.verified) {
        return {};
    }
    return {
        &accepts,
        &getPriority,
        &setPriority,
        &sortsByPriority,
    };
}

void *macVerifiedQuickAddUiFunction(const char *symbol, std::uintptr_t rva,
    const std::uint8_t *code, std::size_t size) noexcept
{
    if (!macClassicQuickAddPriorityApi() || code == nullptr || size == 0) return nullptr;
    void *address = nullptr;
    return resolveFunction(gState.pinnedUiHandle, gState.uiImage, symbol,
        rva, code, size, &address) ? address : nullptr;
}

} // namespace cavalry_i18n
