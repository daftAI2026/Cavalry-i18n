/**
 * [INPUT]: 依赖 Windows IAT 槽地址、已验证当前函数指针与替换函数指针
 * [OUTPUT]: 对外提供带页面保护恢复、竞争检查和指令缓存刷新的单槽可逆替换
 * [POS]: injector/windows 的最小 IAT 写入原语；调用方负责先完成模块、符号、槽位和调用点合同验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>

bool replaceCavalryIatPointer(
    void **slot,
    void *expectedCurrent,
    void *replacement,
    QString *failureDetail);
