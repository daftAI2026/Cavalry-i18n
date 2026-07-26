/**
 * [INPUT]: 依赖 ExtensionLayer/CavalryUI/Qt6Core/Qt6Widgets PE 导入事实、插件 process-lifetime PIN、Qt callback snapshot、Core text-path 子 hook 与共享 IAT CAS 原语
 * [OUTPUT]: 对外聚合四个串行化、可逆 IAT 边界，仅在插件永久驻留后首次写槽，终态失败回滚并转发 text-path 诊断
 * [POS]: injector/windows 的 ExtensionLayer 生命周期编排器；固定 aggregate→text 锁序与 PIN→IAT 写序，callback、ABI 与原子计数下沉到兄弟模块
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_extension_layer_hook.h"

#include "cavalry_i18n_extension_layer_qt_hooks.h"
#include "cavalry_i18n_extension_layer_sources.h"
#include "cavalry_i18n_extension_layer_text_path_hook.h"
#include "cavalry_i18n_iat_lifecycle.h"
#include "cavalry_i18n_iat_patch.h"
#include "cavalry_i18n_pe_iat.h"
#include "cavalry_i18n_skia_runtime_abi.h"
#include "cavalry_i18n_translator.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <psapi.h>

#include <QtCore/QByteArray>
#include <QtCore/QStringList>

#include <array>
#include <atomic>
#include <cstdint>
#include <cwchar>
#include <memory>

namespace {

constexpr wchar_t kExtensionLayerModuleName[] = L"ExtensionLayer.dll";
constexpr wchar_t kCavalryUiModuleName[] = L"CavalryUI.dll";
constexpr wchar_t kQt6CoreModuleName[] = L"Qt6Core.dll";
constexpr wchar_t kQt6WidgetsModuleName[] = L"Qt6Widgets.dll";
constexpr char kCavalryUiImportName[] = "CavalryUI.dll";
constexpr char kQt6WidgetsImportName[] = "Qt6Widgets.dll";
constexpr char kTextAtWidgetCentreSymbol[] =
    "?textAtWidgetCentre@ui@@YAXPEAVQWidget@@AEBVQString@@AEBVQColor@@PEBVQPixmap@@@Z";
constexpr char kQStringAssignmentSymbol[] =
    "??4QString@@QEAAAEAV0@AEBV0@@Z";
constexpr char kQTextEditAppendSymbol[] =
    "?append@QTextEdit@@QEAAXAEBVQString@@@Z";

std::atomic<const void *> gLifecycleOwner { nullptr };

QString withLastError(const QString &prefix)
{
    return QStringLiteral("%1 (Win32 error %2).")
        .arg(prefix)
        .arg(GetLastError());
}

bool hasExpectedModuleName(HMODULE module, const wchar_t *expectedName)
{
    if (module == nullptr || expectedName == nullptr) {
        return false;
    }
    std::array<wchar_t, 32768> modulePath {};
    const DWORD length = GetModuleFileNameW(
        module,
        modulePath.data(),
        static_cast<DWORD>(modulePath.size()));
    if (length == 0 || length >= modulePath.size() - 1) {
        return false;
    }
    const wchar_t *fileName = std::wcsrchr(modulePath.data(), L'\\');
    fileName = fileName == nullptr ? modulePath.data() : fileName + 1;
    return _wcsicmp(fileName, expectedName) == 0;
}

template <std::size_t Count>
bool isExactStaticSource(
    const QString &source,
    const std::array<const char *, Count> &allowedSources)
{
    for (const char *allowedSource : allowedSources) {
        if (source == QString::fromLatin1(allowedSource)) {
            return true;
        }
    }
    return false;
}

} // namespace

CavalryExtensionLayerHook::CavalryExtensionLayerHook(
    CavalryEmbeddedTranslator &translator)
    : translator_(translator)
    , textPathHook_(
          std::make_unique<CavalryExtensionLayerTextPathHook>(translator))
{
}

CavalryExtensionLayerHook::~CavalryExtensionLayerHook()
{
    uninstall();
}

bool CavalryExtensionLayerHook::ensureInstalled()
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    if (textAtWidgetCentreInstalled_ && placeholderAssignmentInstalled_
        && messageBarAppendInstalled_
        && textPathHook_ != nullptr && textPathHook_->isInstalled()) {
        return true;
    }
    if (terminalFailure_) {
        return false;
    }

    HMODULE extensionLayer = GetModuleHandleW(kExtensionLayerModuleName);
    if (extensionLayer == nullptr) {
        status_ = QStringLiteral("waiting-for-extension-layer");
        detail_ = QStringLiteral("ExtensionLayer.dll is not loaded yet.");
        return false;
    }
    if (!hasExpectedModuleName(extensionLayer, kExtensionLayerModuleName)) {
        return failTerminalLocked(QStringLiteral(
            "GetModuleHandleW returned a module whose basename is not ExtensionLayer.dll."));
    }

    MODULEINFO moduleInfo {};
    if (!GetModuleInformation(
            GetCurrentProcess(),
            extensionLayer,
            &moduleInfo,
            sizeof(moduleInfo))
        || moduleInfo.lpBaseOfDll == nullptr || moduleInfo.SizeOfImage == 0) {
        return failTerminalLocked(withLastError(QStringLiteral(
            "GetModuleInformation could not inspect ExtensionLayer.dll")));
    }
    const auto *image =
        static_cast<const std::uint8_t *>(moduleInfo.lpBaseOfDll);

    if (!textAtWidgetCentreInstalled_) {
        const CavalryPeIatLookupResult helperLookup = findCavalryPe64IatSlot(
            image,
            moduleInfo.SizeOfImage,
            kCavalryUiImportName,
            kTextAtWidgetCentreSymbol);
        if (helperLookup.status != CavalryPeIatLookupStatus::Found) {
            return failTerminalLocked(QStringLiteral(
                "ExtensionLayer.dll helper PE/IAT contract rejected: %1.")
                .arg(QString::fromLatin1(
                    cavalryPeIatLookupStatusName(helperLookup.status))));
        }

        HMODULE cavalryUi = GetModuleHandleW(kCavalryUiModuleName);
        if (!hasExpectedModuleName(cavalryUi, kCavalryUiModuleName)) {
            return failTerminalLocked(QStringLiteral(
                "CavalryUI.dll is unavailable or does not match the expected module basename."));
        }
        const FARPROC exportedHelper =
            GetProcAddress(cavalryUi, kTextAtWidgetCentreSymbol);
        if (exportedHelper == nullptr) {
            return failTerminalLocked(QStringLiteral(
                "CavalryUI.dll does not export the expected ui::textAtWidgetCentre ABI."));
        }

        auto **helperSlot = reinterpret_cast<void **>(
            const_cast<std::uint8_t *>(image)
            + helperLookup.iatSlotOffset);
        void *const originalHelper = *helperSlot;
        if (originalHelper != reinterpret_cast<void *>(exportedHelper)) {
            return failTerminalLocked(QStringLiteral(
                "ExtensionLayer.dll ui::textAtWidgetCentre IAT target does not match CavalryUI.dll."));
        }

        const void *expectedOwner = nullptr;
        if (!gLifecycleOwner.compare_exchange_strong(
                expectedOwner,
                this,
                std::memory_order_acq_rel)) {
            return failTerminalLocked(QStringLiteral(
                "The ExtensionLayer IAT hooks are already owned."));
        }
        ownsGlobalHooks_ = true;

        QString pinFailure;
        if (!pinCavalryI18nModuleForProcessLifetime(
                cavalryHelperReplacementAddress(),
                &pinFailure)) {
            return failTerminalLocked(QStringLiteral(
                "Could not PIN cavalryi18n.dll before aggregate IAT installation: %1")
                .arg(pinFailure));
        }

        QString snapshotFailure;
        if (!publishCavalryHelperCallbackSnapshot(
                translator_,
                originalHelper,
                &snapshotFailure)) {
            return failTerminalLocked(snapshotFailure);
        }

        QString replacementFailure;
        if (!replaceCavalryIatPointer(
                helperSlot,
                originalHelper,
                cavalryHelperReplacementAddress(),
                &replacementFailure)) {
            clearCavalryHelperOriginal();
            return failTerminalLocked(replacementFailure);
        }

        textAtWidgetCentreIatSlot_ = helperSlot;
        originalTextAtWidgetCentre_ = originalHelper;
        textAtWidgetCentreInstalled_ = true;
        enableCavalryHelperTranslations(true);
    } else if (!ownsGlobalHooks_
        || gLifecycleOwner.load(std::memory_order_acquire) != this) {
        return failTerminalLocked(QStringLiteral(
            "ExtensionLayer helper ownership changed while its IAT hook remained installed."));
    }

    if (!placeholderAssignmentInstalled_) {
        CavalryPlaceholderAssignmentPath path;
        QString pathFailure;
        if (!validateCavalryPlaceholderAssignmentPath(
                image,
                moduleInfo.SizeOfImage,
                extensionLayer,
                &path,
                &pathFailure)) {
            return failTerminalLocked(pathFailure);
        }

        HMODULE qt6Core = GetModuleHandleW(kQt6CoreModuleName);
        if (!hasExpectedModuleName(qt6Core, kQt6CoreModuleName)) {
            status_ = QStringLiteral("waiting-for-placeholder-assignment");
            detail_ = QStringLiteral(
                "Qt6Core.dll is not available for CustomListWidget::setPlaceholder yet.");
            return false;
        }
        const FARPROC qStringAssignment =
            GetProcAddress(qt6Core, kQStringAssignmentSymbol);
        if (qStringAssignment == nullptr) {
            return failTerminalLocked(QStringLiteral(
                "Qt6Core.dll does not export the expected QString::operator=(QString const&) ABI."));
        }

        void *const originalAssignment = *path.iatSlot;
        if (originalAssignment != reinterpret_cast<void *>(qStringAssignment)) {
            if (isCavalryUnresolvedPlaceholderAssignmentSlot(
                    image,
                    moduleInfo.SizeOfImage,
                    originalAssignment)) {
                status_ =
                    QStringLiteral("waiting-for-placeholder-assignment");
                detail_ = QStringLiteral(
                    "CustomListWidget::setPlaceholder QString assignment IAT has not resolved to Qt6Core.dll yet.");
                return false;
            }
            return failTerminalLocked(QStringLiteral(
                "ExtensionLayer.dll QString assignment IAT target does not match Qt6Core.dll."));
        }

        QString snapshotFailure;
        if (!publishCavalryPlaceholderCallbackSnapshot(
                translator_,
                originalAssignment,
                image,
                moduleInfo.SizeOfImage,
                path.setPlaceholderThunk,
                &snapshotFailure)) {
            return failTerminalLocked(snapshotFailure);
        }

        QString replacementFailure;
        if (!replaceCavalryIatPointer(
                path.iatSlot,
                originalAssignment,
                cavalryPlaceholderReplacementAddress(),
                &replacementFailure)) {
            clearCavalryPlaceholderOriginal();
            return failTerminalLocked(replacementFailure);
        }

        placeholderAssignmentIatSlot_ = path.iatSlot;
        originalPlaceholderAssignment_ = originalAssignment;
        placeholderAssignmentInstalled_ = true;
        enableCavalryPlaceholderTranslations(true);
    }

    if (!messageBarAppendInstalled_) {
        const CavalryPeIatLookupResult appendLookup = findCavalryPe64IatSlot(
            image,
            moduleInfo.SizeOfImage,
            kQt6WidgetsImportName,
            kQTextEditAppendSymbol);
        if (appendLookup.status != CavalryPeIatLookupStatus::Found) {
            return failTerminalLocked(QStringLiteral(
                "ExtensionLayer.dll MessageBar append PE/IAT contract rejected: %1.")
                .arg(QString::fromLatin1(
                    cavalryPeIatLookupStatusName(appendLookup.status))));
        }

        auto **appendSlot = reinterpret_cast<void **>(
            const_cast<std::uint8_t *>(image)
            + appendLookup.iatSlotOffset);
        CavalryMessageBarAppendPath appendPath;
        QString pathFailure;
        if (!validateCavalryMessageBarAppendPath(
                image,
                moduleInfo.SizeOfImage,
                appendSlot,
                &appendPath,
                &pathFailure)) {
            return failTerminalLocked(pathFailure);
        }

        HMODULE qt6Widgets = GetModuleHandleW(kQt6WidgetsModuleName);
        if (!hasExpectedModuleName(
                qt6Widgets,
                kQt6WidgetsModuleName)) {
            status_ = QStringLiteral("waiting-for-messagebar-append");
            detail_ = QStringLiteral(
                "Qt6Widgets.dll is not available for MessageBar append translation yet.");
            return false;
        }
        const FARPROC qTextEditAppend =
            GetProcAddress(qt6Widgets, kQTextEditAppendSymbol);
        if (qTextEditAppend == nullptr) {
            return failTerminalLocked(QStringLiteral(
                "Qt6Widgets.dll does not export the expected QTextEdit::append(QString const&) ABI."));
        }
        void *const originalAppend = *appendPath.iatSlot;
        if (originalAppend != reinterpret_cast<void *>(qTextEditAppend)) {
            return failTerminalLocked(QStringLiteral(
                "ExtensionLayer.dll QTextEdit::append IAT target does not match Qt6Widgets.dll."));
        }

        QString snapshotFailure;
        if (!publishCavalryMessageBarCallbackSnapshot(
                translator_,
                originalAppend,
                appendPath.approvedReturnAddresses,
                &snapshotFailure)) {
            return failTerminalLocked(snapshotFailure);
        }

        QString replacementFailure;
        if (!replaceCavalryIatPointer(
                appendPath.iatSlot,
                originalAppend,
                cavalryMessageBarReplacementAddress(),
                &replacementFailure)) {
            clearCavalryMessageBarOriginal();
            return failTerminalLocked(replacementFailure);
        }

        messageBarAppendIatSlot_ = appendPath.iatSlot;
        originalMessageBarAppend_ = originalAppend;
        messageBarAppendInstalled_ = true;
        enableCavalryMessageBarTranslations(true);
    }

    if (textPathHook_ == nullptr) {
        return failTerminalLocked(QStringLiteral(
            "Core text-path hook state is unavailable."));
    }
    if (!textPathHook_->ensureInstalled(image, moduleInfo.SizeOfImage)) {
        const QString childStatus = textPathHook_->status();
        const QString childDetail = textPathHook_->detail();
        if (textPathHook_->isTerminalFailure()) {
            return failTerminalLocked(QStringLiteral(
                "Core text-path hook failed: %1")
                .arg(childDetail));
        }
        status_ = childStatus;
        detail_ = childDetail;
        return false;
    }

    status_ = QStringLiteral("installed");
    detail_ = QStringLiteral(
        "Patched ExtensionLayer.dll ui::textAtWidgetCentre, CustomListWidget::setPlaceholder, canonical MessageBar QTextEdit::append, and Core::MakePathFromText IAT paths.");
    return true;
}

bool CavalryExtensionLayerHook::isWaitingForModule() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return status_ == QStringLiteral("waiting-for-extension-layer")
        || status_ == QStringLiteral("waiting-for-placeholder-assignment")
        || status_ == QStringLiteral("waiting-for-messagebar-append")
        || status_ == QStringLiteral("waiting-for-core-text-path");
}

QString CavalryExtensionLayerHook::status() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return status_;
}

QString CavalryExtensionLayerHook::detail() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    if (status_ == QStringLiteral("installed")
        && textPathHook_ != nullptr) {
        return detail_ + QStringLiteral(" ")
            + textPathHook_->detail();
    }
    return detail_;
}

CavalryTextPathHookDiagnostics
CavalryExtensionLayerHook::textPathDiagnostics() const
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return textPathHook_ == nullptr
        ? CavalryTextPathHookDiagnostics {}
        : textPathHook_->diagnostics();
}

QString CavalryExtensionLayerHook::translationForWhitelistedSource(
    const CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    if (!isExactStaticSource(
            source,
            cavalry_i18n::extension_layer_contract::kStaticHelperSources)) {
        return QString();
    }
    const QByteArray utf8 = source.toUtf8();
    return translator.translate(nullptr, utf8.constData());
}

QString CavalryExtensionLayerHook::translationForPlaceholderSource(
    const CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    if (!isExactStaticSource(
            source,
            cavalry_i18n::extension_layer_contract::
                kStaticPlaceholderSources)) {
        return QString();
    }
    const QByteArray utf8 = source.toUtf8();
    return translator.translate(nullptr, utf8.constData());
}

#ifdef CAVALRY_I18N_TESTING
bool CavalryExtensionLayerHook::configurePartialInstallForTesting(
    void **helperSlot,
    void *helperOriginal,
    bool helperInstalled,
    void **placeholderSlot,
    void *placeholderOriginal,
    bool placeholderInstalled,
    void **messageBarSlot,
    void *messageBarOriginal,
    bool messageBarInstalled)
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    const void *expectedOwner = nullptr;
    if (!gLifecycleOwner.compare_exchange_strong(
            expectedOwner,
            this,
            std::memory_order_acq_rel)) {
        return false;
    }
    ownsGlobalHooks_ = true;
    textAtWidgetCentreIatSlot_ = helperSlot;
    originalTextAtWidgetCentre_ = helperOriginal;
    textAtWidgetCentreInstalled_ = helperInstalled;
    placeholderAssignmentIatSlot_ = placeholderSlot;
    originalPlaceholderAssignment_ = placeholderOriginal;
    placeholderAssignmentInstalled_ = placeholderInstalled;
    messageBarAppendIatSlot_ = messageBarSlot;
    originalMessageBarAppend_ = messageBarOriginal;
    messageBarAppendInstalled_ = messageBarInstalled;
    return true;
}

bool CavalryExtensionLayerHook::triggerTerminalFailureForTesting(
    const QString &failure)
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return failTerminalLocked(failure);
}
#endif

bool CavalryExtensionLayerHook::failTerminalLocked(
    const QString &failure)
{
    QString rollbackFailure;
    const bool rolledBack = uninstallLocked(&rollbackFailure);
    terminalFailure_ = true;
    if (rolledBack) {
        status_ = QStringLiteral("unsupported");
        detail_ = failure;
    } else {
        status_ = QStringLiteral("restore-failed");
        detail_ = QStringLiteral("%1 Rollback failed: %2")
            .arg(failure, rollbackFailure);
    }
    return false;
}

bool CavalryExtensionLayerHook::uninstallLocked(
    QString *failureDetail)
{
    if (failureDetail != nullptr) {
        failureDetail->clear();
    }

    const bool childInstalled =
        textPathHook_ != nullptr && textPathHook_->isInstalled();
    const bool hasInstalledHook =
        textAtWidgetCentreInstalled_
        || placeholderAssignmentInstalled_
        || messageBarAppendInstalled_
        || childInstalled;
    if (!ownsGlobalHooks_) {
        if (!hasInstalledHook) {
            return true;
        }
        const QString failure = QStringLiteral(
            "ExtensionLayer restore refused because this instance is not the aggregate lifecycle owner.");
        status_ = QStringLiteral("restore-failed");
        detail_ = failure;
        if (failureDetail != nullptr) {
            *failureDetail = failure;
        }
        return false;
    }
    if (gLifecycleOwner.load(std::memory_order_acquire) != this) {
        const QString failure = QStringLiteral(
            "ExtensionLayer restore refused because aggregate lifecycle ownership changed.");
        status_ = QStringLiteral("restore-failed");
        detail_ = failure;
        if (failureDetail != nullptr) {
            *failureDetail = failure;
        }
        return false;
    }

    enableCavalryMessageBarTranslations(false);
    enableCavalryPlaceholderTranslations(false);
    enableCavalryHelperTranslations(false);

    QStringList failures;
    QString childFailure;
    if (textPathHook_ != nullptr
        && !textPathHook_->uninstall(&childFailure)) {
        failures.append(QStringLiteral("Core text-path restore: %1")
            .arg(childFailure));
    }

    bool messageBarRestoreSucceeded = !messageBarAppendInstalled_;
    if (messageBarAppendInstalled_) {
        QString restoreFailure;
        messageBarRestoreSucceeded =
            messageBarAppendIatSlot_ != nullptr
            && originalMessageBarAppend_ != nullptr
            && replaceCavalryIatPointer(
                messageBarAppendIatSlot_,
                cavalryMessageBarReplacementAddress(),
                originalMessageBarAppend_,
                &restoreFailure);
        if (!messageBarRestoreSucceeded) {
            failures.append(QStringLiteral("MessageBar restore: %1")
                .arg(restoreFailure.isEmpty()
                        ? QStringLiteral(
                              "slot metadata was unavailable; immutable callback state retains original forwarding.")
                        : restoreFailure));
        }
    }

    const auto attempts = cavalry_i18n::decideIatPairUninstall(
        true,
        placeholderAssignmentInstalled_,
        textAtWidgetCentreInstalled_,
        false,
        false);
    bool placeholderRestoreSucceeded =
        !placeholderAssignmentInstalled_;
    bool helperRestoreSucceeded =
        !textAtWidgetCentreInstalled_;

    if (attempts.restoreFirst) {
        QString restoreFailure;
        placeholderRestoreSucceeded =
            placeholderAssignmentIatSlot_ != nullptr
            && originalPlaceholderAssignment_ != nullptr
            && replaceCavalryIatPointer(
                placeholderAssignmentIatSlot_,
                cavalryPlaceholderReplacementAddress(),
                originalPlaceholderAssignment_,
                &restoreFailure);
        if (!placeholderRestoreSucceeded) {
            failures.append(QStringLiteral("Placeholder restore: %1")
                .arg(restoreFailure.isEmpty()
                        ? QStringLiteral(
                              "slot metadata was unavailable; immutable callback state retains original forwarding.")
                        : restoreFailure));
        }
    }

    if (attempts.restoreSecond) {
        QString restoreFailure;
        helperRestoreSucceeded =
            textAtWidgetCentreIatSlot_ != nullptr
            && originalTextAtWidgetCentre_ != nullptr
            && replaceCavalryIatPointer(
                textAtWidgetCentreIatSlot_,
                cavalryHelperReplacementAddress(),
                originalTextAtWidgetCentre_,
                &restoreFailure);
        if (!helperRestoreSucceeded) {
            failures.append(QStringLiteral("Helper restore: %1")
                .arg(restoreFailure.isEmpty()
                        ? QStringLiteral(
                              "slot metadata was unavailable; immutable callback state retains original forwarding.")
                        : restoreFailure));
        }
    }

    const auto completed = cavalry_i18n::decideIatPairUninstall(
        true,
        placeholderAssignmentInstalled_,
        textAtWidgetCentreInstalled_,
        placeholderRestoreSucceeded,
        helperRestoreSucceeded);
    if (completed.clearFirstOriginal) {
        clearCavalryPlaceholderOriginal();
        placeholderAssignmentIatSlot_ = nullptr;
        originalPlaceholderAssignment_ = nullptr;
        placeholderAssignmentInstalled_ = false;
    }
    if (completed.clearSecondOriginal) {
        clearCavalryHelperOriginal();
        textAtWidgetCentreIatSlot_ = nullptr;
        originalTextAtWidgetCentre_ = nullptr;
        textAtWidgetCentreInstalled_ = false;
    }
    if (messageBarAppendInstalled_ && messageBarRestoreSucceeded) {
        clearCavalryMessageBarOriginal();
        messageBarAppendIatSlot_ = nullptr;
        originalMessageBarAppend_ = nullptr;
        messageBarAppendInstalled_ = false;
    }

    const void *expectedOwner = this;
    const bool releasedOwner = gLifecycleOwner.compare_exchange_strong(
        expectedOwner,
        nullptr,
        std::memory_order_acq_rel);
    ownsGlobalHooks_ = false;
    if (!releasedOwner) {
        failures.append(QStringLiteral(
            "Aggregate lifecycle ownership could not be released."));
    }

    if (!failures.isEmpty()) {
        const QString failure = failures.join(QStringLiteral(" "));
        status_ = QStringLiteral("restore-failed");
        detail_ = failure;
        if (failureDetail != nullptr) {
            *failureDetail = failure;
        }
        return false;
    }

    status_ = QStringLiteral("uninstalled");
    detail_ = QStringLiteral(
        "Restored every installed ExtensionLayer IAT slot.");
    return true;
}

void CavalryExtensionLayerHook::uninstall()
{
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    QString ignoredFailure;
    uninstallLocked(&ignoredFailure);
}
