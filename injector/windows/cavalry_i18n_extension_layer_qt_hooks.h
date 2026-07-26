/**
 * [INPUT]: 依赖 ExtensionLayer 2.7.2 placeholder ABI、固定 helper/placeholder source 合同与嵌入 translator
 * [OUTPUT]: 对外提供两条 Qt IAT callback 的 immutable snapshot 发布、启停、original 独立清理及 placeholder 路径验证
 * [POS]: injector/windows 的 ExtensionLayer Qt hook 机制层；聚合生命周期只编排槽位，本模块保证 callback 不持 owner/translator raw pointer
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>

#include <cstddef>
#include <cstdint>

class CavalryEmbeddedTranslator;

struct CavalryPlaceholderAssignmentPath {
    void **iatSlot = nullptr;
    const std::uint8_t *setPlaceholderThunk = nullptr;
};

bool validateCavalryPlaceholderAssignmentPath(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    void *extensionLayerModule,
    CavalryPlaceholderAssignmentPath *path,
    QString *failureDetail);

bool isCavalryUnresolvedPlaceholderAssignmentSlot(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    void *candidate);

bool publishCavalryHelperCallbackSnapshot(
    const CavalryEmbeddedTranslator &translator,
    void *original,
    QString *failureDetail);

bool publishCavalryPlaceholderCallbackSnapshot(
    const CavalryEmbeddedTranslator &translator,
    void *original,
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    const std::uint8_t *setPlaceholderThunk,
    QString *failureDetail);

void enableCavalryHelperTranslations(bool enabled);
void enableCavalryPlaceholderTranslations(bool enabled);
void clearCavalryHelperOriginal();
void clearCavalryPlaceholderOriginal();
bool isCavalryHelperOriginalPublished();
bool isCavalryPlaceholderOriginalPublished();
void *cavalryHelperReplacementAddress();
void *cavalryPlaceholderReplacementAddress();
