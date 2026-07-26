/**
 * [INPUT]: 依赖 Qt/CavalryUI 函数 ABI、ExtensionLayer placeholder setter 链、固定 source 数组与 immutable exact-translation snapshot
 * [OUTPUT]: 对外实现无 raw-owner callback、process-lifetime 原子发布槽、逐槽 original 生命周期与只读 PE 调用链验证
 * [POS]: injector/windows 的 ExtensionLayer Qt callback 状态所有者；静态 detach 不析构 shared_ptr，callback 只保留原函数、值译文和 caller 元数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_qt_hooks.h"

#include "cavalry_i18n_callback_snapshot.h"
#include "cavalry_i18n_extension_layer_sources.h"
#include "cavalry_i18n_translator.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <intrin.h>

#include <QtGui/QColor>
#include <QtGui/QPixmap>
#include <QtWidgets/QWidget>

#include <array>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <memory>
#include <utility>

#pragma intrinsic(_ReturnAddress)

namespace {

constexpr char kSetPlaceholderSymbol[] =
    "?setPlaceholder@CustomListWidget@cavalry@@QEAAXAEBVQString@@@Z";
constexpr std::size_t kSetPlaceholderThunkRva = 0x00015A87;
constexpr std::size_t kSetPlaceholderSetterRva = 0x002759F0;
constexpr std::uintptr_t kQStringAssignmentNameRva = 0x01B7CBD2;
constexpr std::array<std::uint8_t, 15> kSetPlaceholderSetterPrologue {{
    0xB8, 0xA8, 0x00, 0x00, 0x00,
    0x48, 0x03, 0x81, 0x90, 0x01, 0x00, 0x00,
    0x48, 0x89, 0xC1,
}};

using TextAtWidgetCentreFunction =
    void (*)(QWidget *, const QString &, const QColor &, const QPixmap *);
using QStringAssignmentFunction =
    QString &(*)(QString *, const QString &);
using HelperTranslations =
    cavalry_i18n::ExactTranslationSnapshot<QString, 9>;
using PlaceholderTranslations =
    cavalry_i18n::ExactTranslationSnapshot<QString, 13>;

static_assert(
    cavalry_i18n::extension_layer_contract::kStaticHelperSources.size() == 9);
static_assert(
    cavalry_i18n::extension_layer_contract::kStaticPlaceholderSources.size()
    == 13);

struct HelperCallbackState final {
    HelperCallbackState(
        TextAtWidgetCentreFunction originalFunction,
        std::array<HelperTranslations::Entry, 9> entries)
        : original(originalFunction)
        , translations(std::move(entries))
    {
    }

    TextAtWidgetCentreFunction original;
    HelperTranslations translations;
};

struct PlaceholderCallbackState final {
    PlaceholderCallbackState(
        QStringAssignmentFunction originalFunction,
        std::array<PlaceholderTranslations::Entry, 13> entries,
        const std::uint8_t *image,
        std::size_t imageSize,
        const std::uint8_t *thunk)
        : original(originalFunction)
        , translations(std::move(entries))
        , extensionLayerImage(image)
        , extensionLayerImageSize(imageSize)
        , setPlaceholderThunk(thunk)
    {
    }

    QStringAssignmentFunction original;
    PlaceholderTranslations translations;
    const std::uint8_t *extensionLayerImage;
    std::size_t extensionLayerImageSize;
    const std::uint8_t *setPlaceholderThunk;
};

std::shared_ptr<const HelperCallbackState> &helperCallbackSlot()
{
    return cavalry_i18n::processLifetimeCallbackSlot<
        HelperCallbackState>();
}

std::shared_ptr<const PlaceholderCallbackState> &placeholderCallbackSlot()
{
    return cavalry_i18n::processLifetimeCallbackSlot<
        PlaceholderCallbackState>();
}
std::atomic<bool> gHelperTranslationsEnabled { false };
std::atomic<bool> gPlaceholderTranslationsEnabled { false };
std::atomic<TextAtWidgetCentreFunction> gOriginalTextAtWidgetCentre { nullptr };
std::atomic<QStringAssignmentFunction> gOriginalPlaceholderAssignment { nullptr };

bool moduleContainsRange(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    const std::uint8_t *address,
    std::size_t size)
{
    if (moduleBase == nullptr || address == nullptr || size > moduleSize) {
        return false;
    }
    const std::uintptr_t base = reinterpret_cast<std::uintptr_t>(moduleBase);
    const std::uintptr_t pointer = reinterpret_cast<std::uintptr_t>(address);
    if (pointer < base) {
        return false;
    }
    const std::size_t offset = static_cast<std::size_t>(pointer - base);
    return offset <= moduleSize && size <= moduleSize - offset;
}

bool readNearJumpTarget(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    const std::uint8_t *instruction,
    const std::uint8_t **target)
{
    if (target == nullptr
        || !moduleContainsRange(moduleBase, moduleSize, instruction, 5)
        || instruction[0] != 0xE9) {
        return false;
    }
    std::int32_t displacement = 0;
    std::memcpy(&displacement, instruction + 1, sizeof(displacement));
    const auto *resolved = reinterpret_cast<const std::uint8_t *>(
        reinterpret_cast<std::intptr_t>(instruction + 5) + displacement);
    if (!moduleContainsRange(moduleBase, moduleSize, resolved, 1)) {
        return false;
    }
    *target = resolved;
    return true;
}

template <std::size_t Count>
bool buildTranslationEntries(
    const CavalryEmbeddedTranslator &translator,
    const std::array<const char *, Count> &sources,
    std::array<std::pair<QString, QString>, Count> *entries,
    QString *failureDetail)
{
    if (entries == nullptr) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "ExtensionLayer callback snapshot received no translation table.");
        }
        return false;
    }
    try {
        for (std::size_t index = 0; index < Count; ++index) {
            const QString source = QString::fromLatin1(sources[index]);
            const QString translated =
                translator.translate(nullptr, sources[index]);
            (*entries)[index] = {
                source,
                translated.isEmpty() ? source : translated,
            };
        }
        return true;
    } catch (...) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "Could not allocate the immutable ExtensionLayer callback translations.");
        }
        return false;
    }
}

bool isDirectSetPlaceholderCaller(
    const PlaceholderCallbackState &state,
    const void *returnAddress)
{
    if (returnAddress == nullptr || state.setPlaceholderThunk == nullptr
        || state.extensionLayerImage == nullptr
        || state.extensionLayerImageSize < 5) {
        return false;
    }
    const auto *returnPointer =
        static_cast<const std::uint8_t *>(returnAddress);
    const std::uintptr_t returnValue =
        reinterpret_cast<std::uintptr_t>(returnPointer);
    const std::uintptr_t moduleBase =
        reinterpret_cast<std::uintptr_t>(state.extensionLayerImage);
    if (returnValue < moduleBase + 5
        || !moduleContainsRange(
            state.extensionLayerImage,
            state.extensionLayerImageSize,
            returnPointer,
            1)) {
        return false;
    }
    const auto *call =
        reinterpret_cast<const std::uint8_t *>(returnValue - 5);
    if (!moduleContainsRange(
            state.extensionLayerImage,
            state.extensionLayerImageSize,
            call,
            5)
        || call[0] != 0xE8) {
        return false;
    }
    std::int32_t displacement = 0;
    std::memcpy(&displacement, call + 1, sizeof(displacement));
    const std::intptr_t target =
        reinterpret_cast<std::intptr_t>(call + 5) + displacement;
    return reinterpret_cast<const void *>(target)
        == state.setPlaceholderThunk;
}

void cavalryExtensionLayerTextAtWidgetCentreReplacement(
    QWidget *widget,
    const QString &source,
    const QColor &color,
    const QPixmap *icon)
{
    const auto state = std::atomic_load_explicit(
        &helperCallbackSlot(),
        std::memory_order_acquire);
    if (state == nullptr || state->original == nullptr) {
        return;
    }
    const QString *translated = nullptr;
    if (gHelperTranslationsEnabled.load(std::memory_order_acquire)) {
        translated = state->translations.find(source);
    }
    state->original(
        widget,
        translated == nullptr ? source : *translated,
        color,
        icon);
}

QString &cavalryExtensionLayerQStringAssignmentReplacement(
    QString *destination,
    const QString &source)
{
    const auto state = std::atomic_load_explicit(
        &placeholderCallbackSlot(),
        std::memory_order_acquire);
    if (state == nullptr || state->original == nullptr) {
        return *destination;
    }
    const QString *translated = nullptr;
    if (gPlaceholderTranslationsEnabled.load(std::memory_order_acquire)
        && isDirectSetPlaceholderCaller(*state, _ReturnAddress())) {
        translated = state->translations.find(source);
    }
    return state->original(
        destination,
        translated == nullptr ? source : *translated);
}

} // namespace

bool validateCavalryPlaceholderAssignmentPath(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    void *extensionLayerModule,
    CavalryPlaceholderAssignmentPath *path,
    QString *failureDetail)
{
    if (moduleBase == nullptr || extensionLayerModule == nullptr
        || path == nullptr) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "setPlaceholder path validation received a null pointer.");
        }
        return false;
    }
    if (kSetPlaceholderThunkRva >= moduleSize
        || kSetPlaceholderSetterRva >= moduleSize) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "ExtensionLayer.dll is smaller than the canonical setPlaceholder RVAs.");
        }
        return false;
    }

    const auto *expectedThunk = moduleBase + kSetPlaceholderThunkRva;
    const FARPROC exportedThunk = GetProcAddress(
        static_cast<HMODULE>(extensionLayerModule),
        kSetPlaceholderSymbol);
    if (exportedThunk == nullptr
        || reinterpret_cast<const std::uint8_t *>(exportedThunk)
            != expectedThunk) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "ExtensionLayer.dll does not export the canonical CustomListWidget::setPlaceholder thunk.");
        }
        return false;
    }

    const std::uint8_t *setter = nullptr;
    if (!readNearJumpTarget(
            moduleBase,
            moduleSize,
            expectedThunk,
            &setter)
        || setter != moduleBase + kSetPlaceholderSetterRva
        || !moduleContainsRange(
            moduleBase,
            moduleSize,
            setter,
            kSetPlaceholderSetterPrologue.size() + 7)
        || std::memcmp(
               setter,
               kSetPlaceholderSetterPrologue.data(),
               kSetPlaceholderSetterPrologue.size())
            != 0) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "CustomListWidget::setPlaceholder setter chain does not match the Cavalry 2.7.2 ABI contract.");
        }
        return false;
    }

    const auto *tailJump = setter + kSetPlaceholderSetterPrologue.size();
    if (tailJump[0] != 0x48 || tailJump[1] != 0xFF || tailJump[2] != 0x25) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "CustomListWidget::setPlaceholder setter no longer tail-jumps through its QString assignment IAT slot.");
        }
        return false;
    }
    std::int32_t displacement = 0;
    std::memcpy(&displacement, tailJump + 3, sizeof(displacement));
    auto **resolvedSlot = reinterpret_cast<void **>(
        reinterpret_cast<std::intptr_t>(tailJump + 7) + displacement);
    if (!moduleContainsRange(
            moduleBase,
            moduleSize,
            reinterpret_cast<const std::uint8_t *>(resolvedSlot),
            sizeof(*resolvedSlot))) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "CustomListWidget::setPlaceholder tail jump does not resolve to an IAT slot inside ExtensionLayer.dll.");
        }
        return false;
    }
    path->iatSlot = resolvedSlot;
    path->setPlaceholderThunk = expectedThunk;
    return true;
}

bool isCavalryUnresolvedPlaceholderAssignmentSlot(
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    void *candidate)
{
    const std::uintptr_t candidateValue =
        reinterpret_cast<std::uintptr_t>(candidate);
    const std::uintptr_t moduleBaseValue =
        reinterpret_cast<std::uintptr_t>(moduleBase);
    return candidateValue == kQStringAssignmentNameRva
        || candidateValue == moduleBaseValue + kQStringAssignmentNameRva
        || moduleContainsRange(
            moduleBase,
            moduleSize,
            static_cast<const std::uint8_t *>(candidate),
            1);
}

bool publishCavalryHelperCallbackSnapshot(
    const CavalryEmbeddedTranslator &translator,
    void *original,
    QString *failureDetail)
{
    std::array<HelperTranslations::Entry, 9> entries {};
    if (original == nullptr
        || !buildTranslationEntries(
            translator,
            cavalry_i18n::extension_layer_contract::kStaticHelperSources,
            &entries,
            failureDetail)) {
        return false;
    }
    try {
        const auto originalFunction =
            reinterpret_cast<TextAtWidgetCentreFunction>(original);
        const auto state = std::make_shared<const HelperCallbackState>(
            originalFunction,
            std::move(entries));
        gHelperTranslationsEnabled.store(false, std::memory_order_release);
        std::atomic_store_explicit(
            &helperCallbackSlot(),
            state,
            std::memory_order_release);
        gOriginalTextAtWidgetCentre.store(
            originalFunction,
            std::memory_order_release);
        return true;
    } catch (...) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "Could not allocate the immutable helper callback snapshot.");
        }
        return false;
    }
}

bool publishCavalryPlaceholderCallbackSnapshot(
    const CavalryEmbeddedTranslator &translator,
    void *original,
    const std::uint8_t *moduleBase,
    std::size_t moduleSize,
    const std::uint8_t *setPlaceholderThunk,
    QString *failureDetail)
{
    std::array<PlaceholderTranslations::Entry, 13> entries {};
    if (original == nullptr || moduleBase == nullptr
        || setPlaceholderThunk == nullptr
        || !buildTranslationEntries(
            translator,
            cavalry_i18n::extension_layer_contract::kStaticPlaceholderSources,
            &entries,
            failureDetail)) {
        return false;
    }
    try {
        const auto originalFunction =
            reinterpret_cast<QStringAssignmentFunction>(original);
        const auto state =
            std::make_shared<const PlaceholderCallbackState>(
                originalFunction,
                std::move(entries),
                moduleBase,
                moduleSize,
                setPlaceholderThunk);
        gPlaceholderTranslationsEnabled.store(
            false,
            std::memory_order_release);
        std::atomic_store_explicit(
            &placeholderCallbackSlot(),
            state,
            std::memory_order_release);
        gOriginalPlaceholderAssignment.store(
            originalFunction,
            std::memory_order_release);
        return true;
    } catch (...) {
        if (failureDetail != nullptr) {
            *failureDetail = QStringLiteral(
                "Could not allocate the immutable placeholder callback snapshot.");
        }
        return false;
    }
}

void enableCavalryHelperTranslations(bool enabled)
{
    gHelperTranslationsEnabled.store(enabled, std::memory_order_release);
}

void enableCavalryPlaceholderTranslations(bool enabled)
{
    gPlaceholderTranslationsEnabled.store(enabled, std::memory_order_release);
}

void clearCavalryHelperOriginal()
{
    gOriginalTextAtWidgetCentre.store(nullptr, std::memory_order_release);
}

void clearCavalryPlaceholderOriginal()
{
    gOriginalPlaceholderAssignment.store(nullptr, std::memory_order_release);
}

bool isCavalryHelperOriginalPublished()
{
    return gOriginalTextAtWidgetCentre.load(std::memory_order_acquire)
        != nullptr;
}

bool isCavalryPlaceholderOriginalPublished()
{
    return gOriginalPlaceholderAssignment.load(std::memory_order_acquire)
        != nullptr;
}

void *cavalryHelperReplacementAddress()
{
    return reinterpret_cast<void *>(
        cavalryExtensionLayerTextAtWidgetCentreReplacement);
}

void *cavalryPlaceholderReplacementAddress()
{
    return reinterpret_cast<void *>(
        cavalryExtensionLayerQStringAssignmentReplacement);
}
