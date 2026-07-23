/**
 * [INPUT]: 依赖内存映射 PE64 镜像字节、目标导入 DLL 名称与 MSVC 修饰符号名
 * [OUTPUT]: 对外提供无副作用的精确 IAT 槽位定位结果及失败原因枚举
 * [POS]: injector/windows 的二进制边界适配器；供 ExtensionLayer 白名单 hook 使用，拒绝模糊匹配、PE32 和越界镜像
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstddef>
#include <cstdint>
#include <string_view>

enum class CavalryPeIatLookupStatus {
    Found,
    InvalidQuery,
    InvalidImage,
    UnsupportedImage,
    ImportDirectoryUnavailable,
    TargetModuleNotFound,
    TargetSymbolNotFound,
    AmbiguousTargetSymbol,
};

struct CavalryPeIatLookupResult {
    CavalryPeIatLookupStatus status = CavalryPeIatLookupStatus::InvalidImage;
    std::size_t iatSlotOffset = 0;
};

/**
 * 在已按 RVA 布局的 PE64 镜像中定位唯一的导入地址表槽位。
 *
 * 这不是文件偏移解析器：调用方必须传入已加载模块或等价的内存映射 fixture。
 * 目标导入名忽略 ASCII 大小写，符号名保持字节级精确匹配。
 */
CavalryPeIatLookupResult findCavalryPe64IatSlot(
    const std::uint8_t *image,
    std::size_t imageSize,
    std::string_view importedDll,
    std::string_view importedSymbol);

const char *cavalryPeIatLookupStatusName(CavalryPeIatLookupStatus status);
