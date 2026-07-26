/**
 * [INPUT]: 依赖只读映射后的 Cavalry 2.7.2 ExtensionLayer PE64 映像
 * [OUTPUT]: 对外提供 QTextEdit::append 唯一 IAT、三处调用点、history/live 双 continuation、js_logger 排除与 Pencil/HTML source 的静态合同
 * [POS]: injector/windows 的 MessageBar vendor 证据分片，把两个批准 caller 与命名日志 sink 的静态边界隔离后再交给聚合 vendor 主测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <cstdint>
#include <string>
#include <vector>

bool verifyCavalryExtensionLayerMessageBarContract(
    const std::vector<std::uint8_t> &extensionLayerImage,
    std::string *failure);
