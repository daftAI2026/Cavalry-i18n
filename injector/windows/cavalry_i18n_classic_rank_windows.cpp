/**
 * [INPUT]: 依赖 Windows 模块枚举、Cavalry.exe 同目录证明、Qt 文件/哈希 API、CavalryUI 导出和 ExtensionLayer ElementListItem RTTI 合同
 * [OUTPUT]: 对外实现一次性 vendor 映像验证、ElementListItem vptr/primary-base gate 与安全的 getter/setter wrapper
 * [POS]: injector/windows 的 Classic priority 运行时防火墙；成功后只调用原厂公开导出，失败保持原厂排序
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_classic_rank_windows.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <psapi.h>

#include <QtCore/QByteArray>
#include <QtCore/QCryptographicHash>
#include <QtCore/QFile>
#include <QtCore/QFileInfo>

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string_view>

namespace cavalry_i18n {
namespace {

// +--------------------------------------------------------------------------+
// | 官方 Cavalry 2.7.2 Windows x64 MSI 的精确映像身份。                       |
// | 下面的进程级静态初始化是唯一一次文件读取与哈希计算。                       |
// +--------------------------------------------------------------------------+
struct ModuleSpec final
{
    const wchar_t *name;
    const char *sha256;
    std::uint32_t timestamp;
    std::size_t imageSize;
};

constexpr ModuleSpec kCavalryUi{
    L"CavalryUI.dll",
    "216503f6294a80928fc0a4a8e5156207a5e54d61312b90ce723bb5f08d49f843",
    0x6a0300b6,
    0x2af000,
};
constexpr ModuleSpec kExtensionLayer{
    L"ExtensionLayer.dll",
    "64209faedaeac3d1cffd5fec8fd8128aa4214c0f77162f930470670b2932e618",
    0x6a0300e0,
    0x1bbe000,
};
constexpr ModuleSpec kQtWidgets{
    L"Qt6Widgets.dll",
    "f18c445517db9979863e118044f2c181242eda50e34383b1fc121cd69a4ae35d",
    0x69bc2253,
    0x5ec000,
};

constexpr wchar_t kCavalryExecutableName[] = L"Cavalry.exe";

constexpr std::size_t kGetPriorityRva = 0x2e87;
constexpr std::size_t kSetPriorityRva = 0x3463;
constexpr std::size_t kSortByPriorityRva = 0x3062;
constexpr std::size_t kQtSortItemsRva = 0x2dcec0;

constexpr std::size_t kElementVtableRva = 0x1545b28;
constexpr std::size_t kElementColRva = 0x1545b70;
constexpr std::size_t kElementTypeDescriptorRva = 0x19d8390;
constexpr std::size_t kElementHierarchyRva = 0x1545b90;
constexpr std::size_t kElementBaseArrayRva = 0x1545ba4;

constexpr char kGetPrioritySymbol[] = "?getPriority@ListItem@@QEBAHXZ";
constexpr char kSetPrioritySymbol[] = "?setPriority@ListItem@@QEAAXH@Z";
constexpr char kSortByPrioritySymbol[] = "?sortByPriority@ListItem@@QEBA_NXZ";
constexpr char kQtSortItemsSymbol[] =
    "?sortItems@QListWidget@@QEAAXW4SortOrder@Qt@@@Z";

constexpr char kElementName[] = ".?AVElementListItem@@";
constexpr char kListItemName[] = ".?AVListItem@@";
constexpr char kQListWidgetItemName[] = ".?AVQListWidgetItem@@";

using GetPriority = int(__fastcall *)(const QListWidgetItem *);
using SetPriority = void(__fastcall *)(QListWidgetItem *, int);
using SortByPriority = bool(__fastcall *)(const QListWidgetItem *);

struct LoadedImage final
{
    HMODULE module = nullptr;
    const std::uint8_t *base = nullptr;
    std::size_t size = 0;
};

struct RuntimeContract final
{
    LoadedImage cavalryUi;
    LoadedImage extensionLayer;
    LoadedImage qtWidgets;
    GetPriority getPriority = nullptr;
    SetPriority setPriority = nullptr;
    SortByPriority sortByPriority = nullptr;
    bool verified = false;
};

bool hasRange(std::size_t imageSize, std::size_t rva, std::size_t size) noexcept
{
    return rva <= imageSize && size <= imageSize - rva;
}

template <typename Value>
bool readLoaded(
    const LoadedImage &image,
    std::size_t rva,
    Value *value) noexcept
{
    if (value == nullptr || image.base == nullptr
        || !hasRange(image.size, rva, sizeof(Value))) {
        return false;
    }
    std::memcpy(value, image.base + rva, sizeof(Value));
    return true;
}

bool loadedAsciiEquals(
    const LoadedImage &image,
    std::size_t rva,
    std::string_view expected) noexcept
{
    return hasRange(image.size, rva, expected.size() + 1)
        && std::memcmp(image.base + rva, expected.data(), expected.size()) == 0
        && image.base[rva + expected.size()] == 0;
}

bool expectedBasename(const QString &path, const wchar_t *name) noexcept
{
    const int slash = qMax(path.lastIndexOf(QChar('/')), path.lastIndexOf(QChar('\\')));
    const QString basename = slash < 0 ? path : path.mid(slash + 1);
    return basename.compare(QString::fromWCharArray(name), Qt::CaseInsensitive) == 0;
}

bool canonicalDirectory(const QString &path, QString *directory) noexcept
{
    if (directory == nullptr) return false;
    const QString value = QFileInfo(path).canonicalPath();
    if (value.isEmpty()) return false;
    *directory = value;
    return true;
}

bool modulePath(HMODULE module, QString *path) noexcept
{
    std::array<wchar_t, 32768> buffer{};
    const DWORD length = GetModuleFileNameW(
        module,
        buffer.data(),
        static_cast<DWORD>(buffer.size()));
    if (length == 0 || length >= buffer.size() - 1) return false;
    if (path != nullptr) {
        *path = QString::fromWCharArray(buffer.data(), static_cast<int>(length));
    }
    return true;
}

bool verifyLoadedPe(
    const LoadedImage &image,
    const ModuleSpec &expected) noexcept
{
    if (image.base == nullptr || image.size != expected.imageSize
        || !hasRange(image.size, 0, sizeof(IMAGE_DOS_HEADER))) {
        return false;
    }
    IMAGE_DOS_HEADER dos{};
    std::memcpy(&dos, image.base, sizeof(dos));
    if (dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0
        || !hasRange(image.size, static_cast<std::size_t>(dos.e_lfanew),
            sizeof(IMAGE_NT_HEADERS64))) {
        return false;
    }
    IMAGE_NT_HEADERS64 headers{};
    std::memcpy(&headers, image.base + dos.e_lfanew, sizeof(headers));
    return headers.Signature == IMAGE_NT_SIGNATURE
        && headers.FileHeader.Machine == IMAGE_FILE_MACHINE_AMD64
        && headers.OptionalHeader.Magic == IMAGE_NT_OPTIONAL_HDR64_MAGIC
        && headers.FileHeader.TimeDateStamp == expected.timestamp
        && headers.OptionalHeader.SizeOfImage == expected.imageSize;
}

bool verifyLoadedModule(
    const ModuleSpec &expected,
    const QString &expectedDirectory,
    LoadedImage *result) noexcept
{
    HMODULE module = GetModuleHandleW(expected.name);
    if (module == nullptr) return false;

    QString path;
    if (!modulePath(module, &path) || !expectedBasename(path, expected.name)) {
        return false;
    }
    const QFileInfo fileInfo(path);
    const QString canonicalDirectoryPath = fileInfo.canonicalPath();
    if (canonicalDirectoryPath.isEmpty()
        || canonicalDirectoryPath.compare(
               expectedDirectory, Qt::CaseInsensitive) != 0) {
        return false;
    }
    const QString canonicalPath = fileInfo.canonicalFilePath();
    if (canonicalPath.isEmpty()) return false;
    QFile file(canonicalPath);
    if (!file.open(QIODevice::ReadOnly)
        || QCryptographicHash::hash(
               file.readAll(), QCryptographicHash::Sha256).toHex()
            != QByteArray(expected.sha256)) {
        return false;
    }

    MODULEINFO information{};
    if (!GetModuleInformation(
            GetCurrentProcess(), module, &information, sizeof(information))
        || information.lpBaseOfDll != module
        || information.SizeOfImage == 0) {
        return false;
    }
    LoadedImage image{
        module,
        static_cast<const std::uint8_t *>(information.lpBaseOfDll),
        information.SizeOfImage,
    };
    if (!verifyLoadedPe(image, expected)) return false;
    if (result != nullptr) *result = image;
    return true;
}

bool verifyExport(
    const LoadedImage &image,
    const char *symbol,
    std::size_t rva) noexcept
{
    const FARPROC address = GetProcAddress(image.module, symbol);
    return address != nullptr
        && reinterpret_cast<const std::uint8_t *>(address) == image.base + rva;
}

bool verifyElementRtti(const LoadedImage &image) noexcept
{
    if (!hasRange(image.size, kElementVtableRva - sizeof(void *), sizeof(void *))) {
        return false;
    }
    std::uintptr_t col = 0;
    std::memcpy(
        &col,
        image.base + kElementVtableRva - sizeof(void *),
        sizeof(col));
    if (col != reinterpret_cast<std::uintptr_t>(image.base + kElementColRva)) {
        return false;
    }

    std::uint32_t typeDescriptor = 0;
    std::uint32_t hierarchy = 0;
    if (!readLoaded(image, kElementColRva + 12, &typeDescriptor)
        || !readLoaded(image, kElementColRva + 16, &hierarchy)
        || typeDescriptor != kElementTypeDescriptorRva
        || hierarchy != kElementHierarchyRva
        || !loadedAsciiEquals(image, typeDescriptor + 16, kElementName)) {
        return false;
    }

    std::uint32_t signature = 0;
    std::uint32_t attributes = 0;
    std::uint32_t baseCount = 0;
    std::uint32_t baseArray = 0;
    if (!readLoaded(image, hierarchy + 0, &signature)
        || !readLoaded(image, hierarchy + 4, &attributes)
        || !readLoaded(image, hierarchy + 8, &baseCount)
        || !readLoaded(image, hierarchy + 12, &baseArray)
        || signature != 0 || attributes != 0 || baseCount != 3
        || baseArray != kElementBaseArrayRva) {
        return false;
    }

    const std::array<std::string_view, 3> names{
        kElementName, kListItemName, kQListWidgetItemName};
    for (std::size_t index = 0; index < names.size(); ++index) {
        std::uint32_t baseDescriptor = 0;
        std::uint32_t baseType = 0;
        std::int32_t memberDisplacement = -1;
        if (!readLoaded(
                image,
                baseArray + index * sizeof(std::uint32_t),
                &baseDescriptor)
            || !readLoaded(image, baseDescriptor + 0, &baseType)
            || !readLoaded(image, baseDescriptor + 8, &memberDisplacement)
            || memberDisplacement != 0
            || !loadedAsciiEquals(image, baseType + 16, names[index])) {
            return false;
        }
    }
    return true;
}

bool pinModule(HMODULE module) noexcept
{
    HMODULE pinned = nullptr;
    return GetModuleHandleExW(
               GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS
                   | GET_MODULE_HANDLE_EX_FLAG_PIN,
               reinterpret_cast<LPCWSTR>(module),
               &pinned)
        && pinned == module;
}

const RuntimeContract &runtimeContract() noexcept
{
    // C++ 函数内静态对象保证每个进程只做一次文件哈希与身份验证。
    static const RuntimeContract contract = [] {
        RuntimeContract result;
        QString hostPath;
        QString hostDirectory;
        if (!modulePath(nullptr, &hostPath)
            || !expectedBasename(hostPath, kCavalryExecutableName)
            || !canonicalDirectory(hostPath, &hostDirectory)) {
            return result;
        }
        if (!verifyLoadedModule(
                kCavalryUi, hostDirectory, &result.cavalryUi)
            || !verifyLoadedModule(
                   kExtensionLayer, hostDirectory, &result.extensionLayer)
            || !verifyLoadedModule(
                   kQtWidgets, hostDirectory, &result.qtWidgets)
            || !verifyExport(result.cavalryUi, kGetPrioritySymbol, kGetPriorityRva)
            || !verifyExport(result.cavalryUi, kSetPrioritySymbol, kSetPriorityRva)
            || !verifyExport(result.cavalryUi, kSortByPrioritySymbol, kSortByPriorityRva)
            || !verifyExport(result.qtWidgets, kQtSortItemsSymbol, kQtSortItemsRva)
            || !verifyElementRtti(result.extensionLayer)
            || !pinModule(result.cavalryUi.module)
            || !pinModule(result.extensionLayer.module)
            || !pinModule(result.qtWidgets.module)) {
            return result;
        }

        result.getPriority = reinterpret_cast<GetPriority>(GetProcAddress(
            result.cavalryUi.module, kGetPrioritySymbol));
        result.setPriority = reinterpret_cast<SetPriority>(GetProcAddress(
            result.cavalryUi.module, kSetPrioritySymbol));
        result.sortByPriority = reinterpret_cast<SortByPriority>(GetProcAddress(
            result.cavalryUi.module, kSortByPrioritySymbol));
        result.verified = result.getPriority != nullptr
            && result.setPriority != nullptr
            && result.sortByPriority != nullptr;
        return result;
    }();
    return contract;
}

bool readableObject(const void *object) noexcept
{
    MEMORY_BASIC_INFORMATION memory{};
    if (object == nullptr
        || VirtualQuery(object, &memory, sizeof(memory)) != sizeof(memory)
        || memory.State != MEM_COMMIT) {
        return false;
    }
    return (memory.Protect & PAGE_NOACCESS) == 0
        && (memory.Protect & PAGE_GUARD) == 0;
}

bool accepts(const QListWidgetItem *item) noexcept
{
    const RuntimeContract &contract = runtimeContract();
    if (!contract.verified || !readableObject(item)) return false;

    std::uintptr_t vtable = 0;
    std::memcpy(&vtable, item, sizeof(vtable));
    if (vtable != reinterpret_cast<std::uintptr_t>(
            contract.extensionLayer.base + kElementVtableRva)) {
        return false;
    }
    std::uintptr_t col = 0;
    std::memcpy(
        &col,
        reinterpret_cast<const void *>(vtable - sizeof(void *)),
        sizeof(col));
    return col == reinterpret_cast<std::uintptr_t>(
        contract.extensionLayer.base + kElementColRva);
}

int getPriority(const QListWidgetItem *item) noexcept
{
    const RuntimeContract &contract = runtimeContract();
    // 共享 attachment 已在同一同步 model callback 中通过 accepts；这里不再
    // 重做 VirtualQuery，避免一次候选排序产生四次系统探针。
    return contract.verified && item != nullptr
        ? contract.getPriority(item)
        : 0;
}

void setPriority(QListWidgetItem *item, int priority) noexcept
{
    const RuntimeContract &contract = runtimeContract();
    // set 紧随 accepts/get，期间没有 queued 事件或 QObject 重入点。
    if (contract.verified && item != nullptr) {
        contract.setPriority(item, priority);
    }
}

bool sortsByPriority(const QListWidgetItem *item) noexcept
{
    const RuntimeContract &contract = runtimeContract();
    // 同步排序回调已先做唯一一次对象可读性与精确 vptr/COL gate。
    return contract.verified && item != nullptr
        && contract.sortByPriority(item);
}

} // 匿名命名空间

ClassicQuickAddPriorityApi windowsClassicQuickAddPriorityApi() noexcept
{
    const RuntimeContract &contract = runtimeContract();
    if (!contract.verified) return {};
    return {&accepts, &getPriority, &setPriority, &sortsByPriority};
}

} // namespace cavalry_i18n
