/**
 * [INPUT]: 依赖 cavalry_i18n_pe_iat 的内存 PE64 解析契约与自建最小导入表 fixture
 * [OUTPUT]: 对外验证精确 DLL/符号匹配、重复符号拒绝和损坏 INT 的失败闭合
 * [POS]: injector/windows 的无 Qt、无厂商二进制单元测试；保证 IAT hook 的地址发现可脱离真实 Cavalry 复现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_pe_iat.h"

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <vector>

namespace {

constexpr char kQt6GuiDll[] = "Qt6Gui.dll";
constexpr char kQPainterDrawTextSymbol[] =
    "?drawText@QPainter@@QEAAXAEBVQPointF@@AEBVQString@@@Z";
constexpr std::size_t kNtOffset = 0x80;
constexpr std::size_t kOptionalHeaderOffset = kNtOffset + 4 + 20;
constexpr std::size_t kImportDescriptorOffset = 0x200;
constexpr std::size_t kImportNameOffset = 0x280;
constexpr std::size_t kOriginalFirstThunkOffset = 0x300;
constexpr std::size_t kIatOffset = 0x380;
constexpr std::size_t kImportByNameOffset = 0x400;

void writeU16(std::vector<std::uint8_t> &image, std::size_t offset, std::uint16_t value)
{
    image[offset] = static_cast<std::uint8_t>(value & 0xFFU);
    image[offset + 1] = static_cast<std::uint8_t>((value >> 8U) & 0xFFU);
}

void writeU32(std::vector<std::uint8_t> &image, std::size_t offset, std::uint32_t value)
{
    for (std::size_t index = 0; index < 4; ++index) {
        image[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
    }
}

void writeU64(std::vector<std::uint8_t> &image, std::size_t offset, std::uint64_t value)
{
    for (std::size_t index = 0; index < 8; ++index) {
        image[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
    }
}

void writeAscii(std::vector<std::uint8_t> &image, std::size_t offset, const char *value)
{
    const std::size_t length = std::strlen(value);
    std::memcpy(image.data() + offset, value, length + 1);
}

std::vector<std::uint8_t> makeFixture()
{
    std::vector<std::uint8_t> image(0x1000, 0);
    writeU16(image, 0, 0x5A4D);
    writeU32(image, 0x3C, static_cast<std::uint32_t>(kNtOffset));
    writeU32(image, kNtOffset, 0x00004550);
    writeU16(image, kNtOffset + 4, 0x8664);
    writeU16(image, kNtOffset + 4 + 16, 0xF0);
    writeU16(image, kOptionalHeaderOffset, 0x020B);
    writeU32(image, kOptionalHeaderOffset + 0x38, 0x1000);
    writeU32(image, kOptionalHeaderOffset + 0x6C, 16);
    writeU32(image, kOptionalHeaderOffset + 0x70 + 8, kImportDescriptorOffset);
    writeU32(image, kOptionalHeaderOffset + 0x70 + 12, 40);

    writeU32(image, kImportDescriptorOffset, kOriginalFirstThunkOffset);
    writeU32(image, kImportDescriptorOffset + 12, kImportNameOffset);
    writeU32(image, kImportDescriptorOffset + 16, kIatOffset);
    writeAscii(image, kImportNameOffset, "qT6gUi.DlL");
    writeU64(image, kOriginalFirstThunkOffset, kImportByNameOffset);
    writeU64(image, kIatOffset, 0x1122334455667788ULL);
    writeU16(image, kImportByNameOffset, 0);
    writeAscii(image, kImportByNameOffset + 2, kQPainterDrawTextSymbol);
    return image;
}

bool expectStatus(
    const char *scenario,
    const CavalryPeIatLookupResult &result,
    CavalryPeIatLookupStatus expectedStatus,
    std::size_t expectedOffset = 0)
{
    if (result.status == expectedStatus
        && (expectedStatus != CavalryPeIatLookupStatus::Found
            || result.iatSlotOffset == expectedOffset)) {
        return true;
    }

    std::fprintf(
        stderr,
        "%s: expected %s at 0x%zx, got %s at 0x%zx.\n",
        scenario,
        cavalryPeIatLookupStatusName(expectedStatus),
        expectedOffset,
        cavalryPeIatLookupStatusName(result.status),
        result.iatSlotOffset);
    return false;
}

} // namespace

int main()
{
    const auto fixture = makeFixture();
    if (!expectStatus(
            "exact Qt6Gui QPainter import",
            findCavalryPe64IatSlot(
                fixture.data(),
                fixture.size(),
                kQt6GuiDll,
                kQPainterDrawTextSymbol),
            CavalryPeIatLookupStatus::Found,
            kIatOffset)) {
        return 1;
    }

    if (!expectStatus(
            "wrong DLL is rejected",
            findCavalryPe64IatSlot(
                fixture.data(),
                fixture.size(),
                "Qt6Widgets.dll",
                kQPainterDrawTextSymbol),
            CavalryPeIatLookupStatus::TargetModuleNotFound)) {
        return 1;
    }

    if (!expectStatus(
            "wrong decorated symbol is rejected",
            findCavalryPe64IatSlot(
                fixture.data(),
                fixture.size(),
                kQt6GuiDll,
                "?drawText@QPainter@@unexpected"),
            CavalryPeIatLookupStatus::TargetSymbolNotFound)) {
        return 1;
    }

    auto duplicate = fixture;
    writeU64(duplicate, kOriginalFirstThunkOffset + 8, kImportByNameOffset);
    writeU64(duplicate, kIatOffset + 8, 0x8877665544332211ULL);
    if (!expectStatus(
            "duplicate target symbol is rejected",
            findCavalryPe64IatSlot(
                duplicate.data(),
                duplicate.size(),
                kQt6GuiDll,
                kQPainterDrawTextSymbol),
            CavalryPeIatLookupStatus::AmbiguousTargetSymbol)) {
        return 1;
    }

    auto missingOriginalThunk = fixture;
    writeU32(missingOriginalThunk, kImportDescriptorOffset, 0);
    if (!expectStatus(
            "missing import-name table fails closed",
            findCavalryPe64IatSlot(
                missingOriginalThunk.data(),
                missingOriginalThunk.size(),
                kQt6GuiDll,
                kQPainterDrawTextSymbol),
            CavalryPeIatLookupStatus::InvalidImage)) {
        return 1;
    }

    return 0;
}
