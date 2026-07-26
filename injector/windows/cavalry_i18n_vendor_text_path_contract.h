/**
 * [INPUT]: 依赖测试内存中的 ExtensionLayer.dll PE64 映像与已采证的 Cavalry 2.7.2 Core text-path RVAs
 * [OUTPUT]: 对外提供 text-path IAT、hidden-sret/string/XMM2 preamble、canonical caller、viewport 表与 helper prefix/action 分离事实的只读验证入口
 * [POS]: injector/windows vendor 合同的 text-path 分片；与主 vendor 测试共享映像但不加载、执行或修改厂商 DLL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstdint>
#include <string>
#include <vector>

bool verifyCavalryExtensionLayerTextPathContract(
    const std::vector<std::uint8_t> &image,
    std::string *failure);
