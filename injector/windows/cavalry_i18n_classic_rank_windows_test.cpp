/**
 * [INPUT]: 依赖官方 Cavalry 2.7.2 MSI 的三份 Windows PE 文件与 Classic priority 静态证据
 * [OUTPUT]: 提供不执行厂商代码的完整哈希、PE、导出、RTTI/primary-base 及漂移反例回归
 * [POS]: injector/windows 的 Classic vendor 静态测试；raw PE 映射器只存在于测试，不进入产品 DLL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <QtCore/QCryptographicHash>
#include <QtCore/QFile>
#include <QtCore/QTemporaryDir>
#include <QtCore/QString>

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string_view>
#include <utility>

#include <cstdio>

namespace {

// +--------------------------------------------------------------------------+
// | 这些值来自官方 Cavalry 2.7.2 Windows x64 MSI；测试只读、绝不加载 DLL。 |
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

constexpr std::size_t kGetPriorityRva = 0x2e87;
constexpr std::size_t kSetPriorityRva = 0x3463;
constexpr std::size_t kSortByPriorityRva = 0x3062;
constexpr std::size_t kListItemConstructorRva = 0x26c6;
constexpr std::size_t kSetSortByPriorityRva = 0x1c4e;
constexpr std::size_t kQtSortItemsRva = 0x2dcec0;
constexpr std::size_t kElementVtableRva = 0x1545b28;
constexpr std::size_t kElementColRva = 0x1545b70;
constexpr std::size_t kElementTypeDescriptorRva = 0x19d8390;
constexpr std::size_t kElementHierarchyRva = 0x1545b90;
constexpr std::size_t kElementBaseArrayRva = 0x1545ba4;

constexpr char kGetPrioritySymbol[] = "?getPriority@ListItem@@QEBAHXZ";
constexpr char kSetPrioritySymbol[] = "?setPriority@ListItem@@QEAAXH@Z";
constexpr char kSortByPrioritySymbol[] = "?sortByPriority@ListItem@@QEBA_NXZ";
constexpr char kListItemConstructorSymbol[] =
    "??0ListItem@@QEAA@AEBVQString@@@Z";
constexpr char kSetSortByPrioritySymbol[] =
    "?setSortByPriority@ListItem@@QEAAX_N@Z";
constexpr char kQtSortItemsSymbol[] =
    "?sortItems@QListWidget@@QEAAXW4SortOrder@Qt@@@Z";
constexpr char kElementName[] = ".?AVElementListItem@@";
constexpr char kListItemName[] = ".?AVListItem@@";
constexpr char kQListWidgetItemName[] = ".?AVQListWidgetItem@@";

struct PeImage final
{
    QByteArray mapped;
    IMAGE_NT_HEADERS64 headers{};
};

bool hasRange(std::size_t size, std::size_t rva, std::size_t length) noexcept
{
    return rva <= size && length <= size - rva;
}

template <typename Value>
bool readMapped(const PeImage &image, std::size_t rva, Value *value) noexcept
{
    if (value == nullptr
        || !hasRange(static_cast<std::size_t>(image.mapped.size()), rva, sizeof(Value))) {
        return false;
    }
    std::memcpy(value, image.mapped.constData() + rva, sizeof(Value));
    return true;
}

bool asciiEquals(
    const PeImage &image,
    std::size_t rva,
    std::string_view expected) noexcept
{
    return hasRange(
               static_cast<std::size_t>(image.mapped.size()),
               rva,
               expected.size() + 1)
        && std::memcmp(image.mapped.constData() + rva,
            expected.data(), expected.size()) == 0
        && image.mapped.at(static_cast<qsizetype>(rva + expected.size())) == '\0';
}

bool mapPeFile(const QByteArray &raw, PeImage *image) noexcept
{
    if (image == nullptr || raw.size() < qsizetype(sizeof(IMAGE_DOS_HEADER))) return false;
    IMAGE_DOS_HEADER dos{};
    std::memcpy(&dos, raw.constData(), sizeof(dos));
    if (dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0) return false;
    const qsizetype ntOffset = static_cast<qsizetype>(dos.e_lfanew);
    if (ntOffset > raw.size() - qsizetype(sizeof(IMAGE_NT_HEADERS64))) return false;

    IMAGE_NT_HEADERS64 headers{};
    std::memcpy(&headers, raw.constData() + ntOffset, sizeof(headers));
    if (headers.Signature != IMAGE_NT_SIGNATURE
        || headers.FileHeader.Machine != IMAGE_FILE_MACHINE_AMD64
        || headers.OptionalHeader.Magic != IMAGE_NT_OPTIONAL_HDR64_MAGIC
        || headers.OptionalHeader.SizeOfImage == 0
        || headers.OptionalHeader.SizeOfHeaders > static_cast<DWORD>(raw.size())
        || headers.FileHeader.SizeOfOptionalHeader < sizeof(IMAGE_OPTIONAL_HEADER64)) {
        return false;
    }

    QByteArray mapped(static_cast<qsizetype>(headers.OptionalHeader.SizeOfImage), '\0');
    if (headers.OptionalHeader.SizeOfHeaders > static_cast<DWORD>(mapped.size())) return false;
    std::memcpy(mapped.data(), raw.constData(), headers.OptionalHeader.SizeOfHeaders);
    const std::size_t sectionTable = static_cast<std::size_t>(ntOffset)
        + offsetof(IMAGE_NT_HEADERS64, OptionalHeader)
        + headers.FileHeader.SizeOfOptionalHeader;
    const std::size_t sectionBytes = static_cast<std::size_t>(
        headers.FileHeader.NumberOfSections) * sizeof(IMAGE_SECTION_HEADER);
    if (sectionTable > static_cast<std::size_t>(raw.size())
        || sectionBytes > static_cast<std::size_t>(raw.size()) - sectionTable) return false;

    for (WORD index = 0; index < headers.FileHeader.NumberOfSections; ++index) {
        IMAGE_SECTION_HEADER section{};
        std::memcpy(&section,
            raw.constData() + sectionTable + static_cast<std::size_t>(index) * sizeof(section),
            sizeof(section));
        if (section.SizeOfRawData == 0) continue;
        if (static_cast<std::size_t>(section.PointerToRawData) > static_cast<std::size_t>(raw.size())
            || static_cast<std::size_t>(section.SizeOfRawData)
                > static_cast<std::size_t>(raw.size()) - section.PointerToRawData
            || static_cast<std::size_t>(section.VirtualAddress) > static_cast<std::size_t>(mapped.size())
            || static_cast<std::size_t>(section.SizeOfRawData)
                > static_cast<std::size_t>(mapped.size()) - section.VirtualAddress) return false;
        std::memcpy(mapped.data() + section.VirtualAddress,
            raw.constData() + section.PointerToRawData, section.SizeOfRawData);
    }
    image->mapped = std::move(mapped);
    image->headers = headers;
    return true;
}

bool pathHasBasename(const QString &path, const wchar_t *expected) noexcept
{
    const int slash = qMax(path.lastIndexOf(QChar('/')), path.lastIndexOf(QChar('\\')));
    const QString basename = slash < 0 ? path : path.mid(slash + 1);
    return basename.compare(QString::fromWCharArray(expected), Qt::CaseInsensitive) == 0;
}

bool loadStatic(
    const QString &path,
    const ModuleSpec &spec,
    PeImage *image) noexcept
{
    if (!pathHasBasename(path, spec.name) || image == nullptr) return false;
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) return false;
    const QByteArray raw = file.readAll();
    if (QCryptographicHash::hash(raw, QCryptographicHash::Sha256).toHex()
        != QByteArray(spec.sha256)
        || !mapPeFile(raw, image)) return false;
    return image->headers.FileHeader.TimeDateStamp == spec.timestamp
        && image->headers.OptionalHeader.SizeOfImage == spec.imageSize;
}

bool hasExport(const PeImage &image, const char *name, std::size_t expectedRva) noexcept
{
    const IMAGE_DATA_DIRECTORY &directory =
        image.headers.OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
    IMAGE_EXPORT_DIRECTORY exports{};
    if (directory.VirtualAddress == 0 || directory.Size < sizeof(exports)
        || !readMapped(image, directory.VirtualAddress, &exports)
        || !hasRange(static_cast<std::size_t>(image.mapped.size()), exports.AddressOfNames,
            static_cast<std::size_t>(exports.NumberOfNames) * sizeof(DWORD))
        || !hasRange(static_cast<std::size_t>(image.mapped.size()), exports.AddressOfNameOrdinals,
            static_cast<std::size_t>(exports.NumberOfNames) * sizeof(WORD))
        || !hasRange(static_cast<std::size_t>(image.mapped.size()), exports.AddressOfFunctions,
            static_cast<std::size_t>(exports.NumberOfFunctions) * sizeof(DWORD))) return false;

    for (DWORD index = 0; index < exports.NumberOfNames; ++index) {
        DWORD nameRva = 0;
        WORD ordinal = 0;
        if (!readMapped(image, exports.AddressOfNames + static_cast<std::size_t>(index) * sizeof(DWORD), &nameRva)
            || !readMapped(image, exports.AddressOfNameOrdinals + static_cast<std::size_t>(index) * sizeof(WORD), &ordinal)
            || ordinal >= exports.NumberOfFunctions || !asciiEquals(image, nameRva, name)) continue;
        DWORD functionRva = 0;
        return readMapped(image,
            exports.AddressOfFunctions + static_cast<std::size_t>(ordinal) * sizeof(DWORD),
            &functionRva) && functionRva == expectedRva;
    }
    return false;
}

bool verifyElementRtti(const PeImage &image) noexcept
{
    std::uint64_t encodedCol = 0;
    if (!readMapped(image, kElementVtableRva - sizeof(void *), &encodedCol)
        || encodedCol != image.headers.OptionalHeader.ImageBase + kElementColRva) return false;
    std::uint32_t typeDescriptor = 0;
    std::uint32_t hierarchy = 0;
    if (!readMapped(image, kElementColRva + 12, &typeDescriptor)
        || !readMapped(image, kElementColRva + 16, &hierarchy)
        || typeDescriptor != kElementTypeDescriptorRva
        || hierarchy != kElementHierarchyRva
        || !asciiEquals(image, typeDescriptor + 16, kElementName)) return false;

    std::uint32_t signature = 0;
    std::uint32_t attributes = 0;
    std::uint32_t baseCount = 0;
    std::uint32_t baseArray = 0;
    if (!readMapped(image, hierarchy + 0, &signature)
        || !readMapped(image, hierarchy + 4, &attributes)
        || !readMapped(image, hierarchy + 8, &baseCount)
        || !readMapped(image, hierarchy + 12, &baseArray)
        || signature != 0 || attributes != 0 || baseCount != 3
        || baseArray != kElementBaseArrayRva) return false;

    const std::array<std::string_view, 3> names{
        kElementName, kListItemName, kQListWidgetItemName};
    for (std::size_t index = 0; index < names.size(); ++index) {
        std::uint32_t baseDescriptor = 0;
        std::uint32_t baseType = 0;
        std::int32_t memberDisplacement = -1;
        if (!readMapped(image, baseArray + index * sizeof(std::uint32_t), &baseDescriptor)
            || !readMapped(image, baseDescriptor + 0, &baseType)
            || !readMapped(image, baseDescriptor + 8, &memberDisplacement)
            || memberDisplacement != 0
            || !asciiEquals(image, baseType + 16, names[index])) return false;
    }
    return true;
}

bool verifyVendorFiles(
    const QString &cavalryUiPath,
    const QString &extensionLayerPath,
    const QString &qtWidgetsPath)
{
    PeImage cavalryUi;
    PeImage extensionLayer;
    PeImage qtWidgets;
    return loadStatic(cavalryUiPath, kCavalryUi, &cavalryUi)
        && loadStatic(extensionLayerPath, kExtensionLayer, &extensionLayer)
        && loadStatic(qtWidgetsPath, kQtWidgets, &qtWidgets)
        && hasExport(cavalryUi, kGetPrioritySymbol, kGetPriorityRva)
        && hasExport(cavalryUi, kSetPrioritySymbol, kSetPriorityRva)
        && hasExport(cavalryUi, kSortByPrioritySymbol, kSortByPriorityRva)
        && hasExport(
               cavalryUi, kListItemConstructorSymbol, kListItemConstructorRva)
        && hasExport(
               cavalryUi, kSetSortByPrioritySymbol, kSetSortByPriorityRva)
        && hasExport(qtWidgets, kQtSortItemsSymbol, kQtSortItemsRva)
        && verifyElementRtti(extensionLayer);
}

bool copyFile(const QString &path, const QByteArray &bytes)
{
    QFile file(path);
    return file.open(QIODevice::WriteOnly | QIODevice::Truncate)
        && file.write(bytes) == bytes.size();
}

QByteArray readFile(const QString &path)
{
    QFile file(path);
    return file.open(QIODevice::ReadOnly) ? file.readAll() : QByteArray{};
}

} // 匿名命名空间

int main(int argc, char **argv)
{
    if (argc != 4) {
        std::fputs("usage: classic_rank_vendor_test CavalryUI ExtensionLayer Qt6Widgets\n", stderr);
        return 2;
    }
    const QString cavalryUiPath = QString::fromLocal8Bit(argv[1]);
    const QString extensionLayerPath = QString::fromLocal8Bit(argv[2]);
    const QString qtWidgetsPath = QString::fromLocal8Bit(argv[3]);
    if (!verifyVendorFiles(cavalryUiPath, extensionLayerPath, qtWidgetsPath)) {
        std::fputs("FAIL: official Windows Classic priority contract\n", stderr);
        return 1;
    }

    // 精确 RTTI 负例：哈希先通过的映像在测试内再篡改 primary-base displacement。
    QFile extensionFile(extensionLayerPath);
    if (!extensionFile.open(QIODevice::ReadOnly)) return 1;
    PeImage extensionImage;
    if (!mapPeFile(extensionFile.readAll(), &extensionImage)) return 1;
    std::uint32_t baseDescriptor = 0;
    if (!readMapped(extensionImage, kElementBaseArrayRva + sizeof(std::uint32_t), &baseDescriptor)
        || !hasRange(static_cast<std::size_t>(extensionImage.mapped.size()), baseDescriptor + 8, sizeof(std::int32_t))) return 1;
    std::int32_t badDisplacement = 8;
    std::memcpy(extensionImage.mapped.data() + baseDescriptor + 8,
        &badDisplacement, sizeof(badDisplacement));
    if (verifyElementRtti(extensionImage)) {
        std::fputs("FAIL: changed ElementListItem primary-base accepted\n", stderr);
        return 1;
    }

    QTemporaryDir temp;
    if (!temp.isValid()) return 1;
    const QString uiPath = temp.filePath(QStringLiteral("CavalryUI.dll"));
    const QString extensionPath = temp.filePath(QStringLiteral("ExtensionLayer.dll"));
    const QString widgetsPath = temp.filePath(QStringLiteral("Qt6Widgets.dll"));
    QByteArray ui = readFile(cavalryUiPath);
    const QByteArray extension = readFile(extensionLayerPath);
    const QByteArray widgets = readFile(qtWidgetsPath);
    if (ui.isEmpty() || extension.isEmpty() || widgets.isEmpty()) return 1;
    ui[0] = char(ui.at(0) ^ 1);
    if (!copyFile(uiPath, ui) || !copyFile(extensionPath, extension)
        || !copyFile(widgetsPath, widgets)) return 1;
    if (verifyVendorFiles(uiPath, extensionPath, widgetsPath)) {
        std::fputs("FAIL: changed CavalryUI hash accepted\n", stderr);
        return 1;
    }
    if (verifyVendorFiles(cavalryUiPath, cavalryUiPath, qtWidgetsPath)) {
        std::fputs("FAIL: wrong ExtensionLayer path accepted\n", stderr);
        return 1;
    }

    std::puts("PASS: Windows Classic priority hash/PE/export/RTTI contract and drift negatives");
    return 0;
}
