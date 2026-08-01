/**
 * [INPUT]: 依赖测试内存中的 Cavalry 2.7.2 Core.dll/skia.dll PE64 映像与 CJK Path 工厂所用的精确导出/对象布局事实
 * [OUTPUT]: 对外提供 Core Lato 原路径、MakeScalableFont、Skia 导出、引用计数和 Cavalry::Path 构造步骤的只读验证入口
 * [POS]: injector/windows vendor 合同的 CJK 字形分片；为运行时窄边界提供独立静态证据，不加载或执行厂商 DLL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstdint>
#include <string>
#include <vector>

bool verifyCavalryCoreSkiaTextPathContract(
    const std::vector<std::uint8_t> &coreImage,
    const std::vector<std::uint8_t> &skiaImage,
    std::string *failure);
