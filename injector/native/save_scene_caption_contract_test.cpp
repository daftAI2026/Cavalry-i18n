/**
 * [INPUT]: 依赖Qt 6.9.2 QString/QFileDialog公开头与caption策略。
 * [OUTPUT]: 验证Save captions及281 Load .cv的call-site、QString槽与透传边界。
 * [POS]: 不加载Cavalry；不创建窗口或调用Qt文件面板。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "save_scene_caption_policy.h"
#include "save_scene_caption_abi_contract.h"

#include <QtWidgets/QFileDialog>

#include <cstdio>
#include <cstdint>
#include <type_traits>

namespace {
using ExactSaveFileNameSignature = QString (*)(
    QWidget *, const QString &, const QString &, const QString &,
    QString *, QFileDialog::Options);
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
using ExactOpenFileNameSignature = QString (*)(
    QWidget *, const QString &, const QString &, const QString &,
    QString *, QFileDialog::Options);
#endif
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wreturn-type-c-linkage"
extern "C" QString saveSceneDialogAbiTarget(
    QWidget *, const QString &, const QString &, const QString &, QString *,
    QFileDialog::Options)
    __asm__("__ZN11QFileDialog15getSaveFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE");
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
extern "C" QString openSceneDialogAbiTarget(
    QWidget *, const QString &, const QString &, const QString &, QString *,
    QFileDialog::Options)
    __asm__("__ZN11QFileDialog15getOpenFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE");
#endif
#pragma clang diagnostic pop
static_assert(std::is_same_v<decltype(&saveSceneDialogAbiTarget),
                             ExactSaveFileNameSignature>);
static_assert(std::is_same_v<decltype(&QFileDialog::getSaveFileName),
                             ExactSaveFileNameSignature>);
#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
static_assert(std::is_same_v<decltype(&openSceneDialogAbiTarget),
                             ExactOpenFileNameSignature>);
static_assert(std::is_same_v<decltype(&QFileDialog::getOpenFileName),
                             ExactOpenFileNameSignature>);
static_assert(native_save_scene_caption::contract::kCallOffset == 0x6c1760U);
static_assert(native_save_scene_caption::contract::kOpenFileNameCallOffset ==
              0x6c1220U);
static_assert(native_save_scene_caption::contract::kOpenFileNameReturnOffset ==
              0x6c1224U);
#elif defined(__x86_64__)
static_assert(native_save_scene_caption::contract::kCallOffset == 0x7bb931U);
#else
static_assert(native_save_scene_caption::contract::kCallOffset == 0x6e4b88U);
#endif

struct CallRecord {
    int count = 0;
    QWidget *parent = nullptr;
    const QString *captionAddress = nullptr;
    const QString *directoryAddress = nullptr;
    const QString *filterAddress = nullptr;
    QString caption;
    QString directory;
    QString filter;
    QString *selectedFilter = nullptr;
    QFileDialog::Options options{};
};

CallRecord *gCall = nullptr;

QString fakeSaveFileName(
    QWidget *parent, const QString &caption, const QString &directory,
    const QString &filter, QString *selectedFilter,
    QFileDialog::Options options)
{
    ++gCall->count;
    gCall->parent = parent;
    gCall->captionAddress = &caption;
    gCall->directoryAddress = &directory;
    gCall->filterAddress = &filter;
    gCall->caption = caption;
    gCall->directory = directory;
    gCall->filter = filter;
    gCall->selectedFilter = selectedFilter;
    gCall->options = options;

    QString returned = QStringLiteral("return:");
    returned += caption;
    returned += QLatin1Char('|');
    returned += directory;
    returned += QLatin1Char('|');
    returned += filter;
    return returned;
}

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
QString fakeOpenFileName(
    QWidget *parent, const QString &caption, const QString &directory,
    const QString &filter, QString *selectedFilter,
    QFileDialog::Options options)
{
    ++gCall->count;
    gCall->parent = parent;
    gCall->captionAddress = &caption;
    gCall->directoryAddress = &directory;
    gCall->filterAddress = &filter;
    gCall->caption = caption;
    gCall->directory = directory;
    gCall->filter = filter;
    gCall->selectedFilter = selectedFilter;
    gCall->options = options;
    return QStringLiteral("open-return:") + caption + QLatin1Char('|') +
        directory + QLatin1Char('|') + filter;
}
#endif

bool require(bool value, const char *message)
{
    if (value) return true;
    std::fprintf(stderr, "FAIL: %s\n", message);
    return false;
}

bool checkCall(
    bool localized, const QString &source, const QString &expectedCaption,
    cavalry_native_font::Locale locale, bool shouldReadLocale)
{
    CallRecord call{};
    gCall = &call;
    const QString directory = QStringLiteral("/tmp/original-directory");
    const QString filter = QStringLiteral("Cavalry Scene (*.cv)");
    QString selectedFilter = QStringLiteral("sentinel");
    const QFileDialog::Options options = QFileDialog::DontUseNativeDialog;
    QWidget *parent = nullptr;
    int localeReads = 0;
    const std::uintptr_t exactReturnPc =
        native_save_scene_caption::contract::kReturnOffset;
    const std::uintptr_t caller = exactReturnPc;

    const QString returned = native_save_scene_caption::forwardSaveCaption(
        &fakeSaveFileName, true, caller, exactReturnPc, parent, source,
        directory, filter, &selectedFilter, options, [&]() {
            ++localeReads;
            return locale;
        });

    const QString expectedReturn = QStringLiteral("return:") + expectedCaption +
        QLatin1Char('|') + directory + QLatin1Char('|') + filter;
    return require(call.count == 1, "original is called exactly once") &&
        require(localeReads == (shouldReadLocale ? 1 : 0),
                "locale is read only after exact caller and caption") &&
        require(call.caption == expectedCaption,
                "original receives expected caption") &&
        require(call.directoryAddress == &directory && call.filterAddress == &filter,
                "directory and filter references are unchanged") &&
        require(call.selectedFilter == &selectedFilter,
                "selected-filter pointer is unchanged") &&
        require(call.options == options, "dialog options are unchanged") &&
        require((call.captionAddress != &source) == localized,
                "replacement caption lives in a distinct local QString") &&
        require(returned == expectedReturn,
                "QString return value survives the sret call boundary");
}

bool checkFallback(
    bool ready, std::uintptr_t caller, const QString &source,
    const QString &expected, cavalry_native_font::Locale locale,
    bool shouldReadLocale)
{
    CallRecord call{};
    gCall = &call;
    const QString directory = QStringLiteral("/tmp/original-directory");
    const QString filter = QStringLiteral("Cavalry Scene (*.cv)");
    QString selectedFilter = QStringLiteral("sentinel");
    const QFileDialog::Options options = QFileDialog::DontUseNativeDialog;
    int localeReads = 0;
    const std::uintptr_t exactReturnPc =
        native_save_scene_caption::contract::kReturnOffset;
    const QString returned = native_save_scene_caption::forwardSaveCaption(
        &fakeSaveFileName, ready, caller, exactReturnPc,
        static_cast<QWidget *>(nullptr), source,
        directory, filter, &selectedFilter, options, [&]() {
            ++localeReads;
            return locale;
        });
    return require(call.count == 1, "fallback calls original exactly once") &&
        require(localeReads == (shouldReadLocale ? 1 : 0),
                "fallback does not read locale outside exact source path") &&
        require(call.caption == expected && call.captionAddress == &source,
                "fallback passes the original caption by reference") &&
        require(returned.startsWith(QStringLiteral("return:") + expected),
                "fallback preserves the QString return value");
}

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
bool checkOpenCall(
    bool localized, cavalry_native_font::Locale locale,
    const QString &expectedCaption, bool shouldReadLocale)
{
    CallRecord call{};
    gCall = &call;
    const QString source = QStringLiteral("Load .cv");
    const QString directory = QStringLiteral("/user/project folder");
    const QString filter = QStringLiteral("Cavalry Scene (*.cv)");
    QString selectedFilter = QStringLiteral("unchanged-filter-output");
    const QFileDialog::Options options = QFileDialog::DontUseNativeDialog |
        QFileDialog::ReadOnly;
    QWidget *parent = reinterpret_cast<QWidget *>(0x12340U);
    int localeReads = 0;
    const std::uintptr_t exactReturnPc =
        native_save_scene_caption::contract::kOpenFileNameReturnOffset;
    const QString returned = native_save_scene_caption::forwardOpenCaption(
        &fakeOpenFileName, true, exactReturnPc, exactReturnPc, parent, source,
        directory, filter, &selectedFilter, options, [&]() {
            ++localeReads;
            return locale;
        });
    const QString expectedReturn = QStringLiteral("open-return:") +
        expectedCaption + QLatin1Char('|') + directory + QLatin1Char('|') + filter;
    return require(call.count == 1, "Open original is called exactly once") &&
        require(localeReads == (shouldReadLocale ? 1 : 0),
                "Open locale is read only for exact caller and caption") &&
        require(call.parent == parent, "Open parent is unchanged") &&
        require(call.caption == expectedCaption,
                "Open original receives expected caption") &&
        require(call.directoryAddress == &directory && call.directory == directory,
                "Open directory is forwarded unchanged") &&
        require(call.filterAddress == &filter && call.filter == filter,
                "Open filter is forwarded unchanged") &&
        require(call.selectedFilter == &selectedFilter,
                "Open selected-filter pointer is unchanged") &&
        require(selectedFilter == QStringLiteral("unchanged-filter-output"),
                "Open selected-filter value is unchanged by the adapter") &&
        require(call.options == options, "Open dialog options are unchanged") &&
        require((call.captionAddress != &source) == localized,
                "only localized Open caption uses a local QString") &&
        require(returned == expectedReturn,
                "Open QString return value survives the sret boundary");
}

bool checkOpenFallback(
    bool ready, std::uintptr_t caller, const QString &source,
    cavalry_native_font::Locale locale, bool shouldReadLocale)
{
    CallRecord call{};
    gCall = &call;
    const QString directory = QStringLiteral("/user/project folder");
    const QString filter = QStringLiteral("Cavalry Scene (*.cv)");
    QString selectedFilter = QStringLiteral("unchanged-filter-output");
    const QFileDialog::Options options = QFileDialog::DontUseNativeDialog |
        QFileDialog::ReadOnly;
    QWidget *parent = reinterpret_cast<QWidget *>(0x12340U);
    int localeReads = 0;
    const std::uintptr_t exactReturnPc =
        native_save_scene_caption::contract::kOpenFileNameReturnOffset;
    const QString returned = native_save_scene_caption::forwardOpenCaption(
        &fakeOpenFileName, ready, caller, exactReturnPc, parent, source,
        directory, filter, &selectedFilter, options, [&]() {
            ++localeReads;
            return locale;
        });
    const QString expectedReturn = QStringLiteral("open-return:") + source +
        QLatin1Char('|') + directory + QLatin1Char('|') + filter;
    return require(call.count == 1, "Open fallback calls original exactly once") &&
        require(localeReads == (shouldReadLocale ? 1 : 0),
                "Open fallback skips locale for unknown owner/source") &&
        require(call.parent == parent && call.captionAddress == &source,
                "Open fallback passes original parent and caption ref") &&
        require(call.directoryAddress == &directory && call.directory == directory,
                "Open fallback preserves directory") &&
        require(call.filterAddress == &filter && call.filter == filter,
                "Open fallback preserves filter") &&
        require(call.selectedFilter == &selectedFilter && call.options == options,
                "Open fallback preserves output pointer and options") &&
        require(selectedFilter == QStringLiteral("unchanged-filter-output"),
                "Open fallback leaves selected-filter value unchanged") &&
        require(returned == expectedReturn,
                "Open fallback preserves QString return value");
}
#endif
}  // namespace

int main()
{
    using cavalry_native_font::Locale;
    if (!checkCall(true, QStringLiteral("Save Scene"), QStringLiteral("保存场景"),
                   Locale::Hans, true) ||
        !checkCall(true, QStringLiteral("Save Scene"), QStringLiteral("儲存場景"),
                   Locale::Hant, true) ||
        !checkCall(true, QStringLiteral("Save Scene"), QStringLiteral("シーンを保存"),
                   Locale::Japanese, true) ||
        !checkCall(true, QStringLiteral("Save as .cv"),
                   QStringLiteral("保存为工程文件"), Locale::Hans, true) ||
        !checkCall(true, QStringLiteral("Save as .cv"),
                   QStringLiteral("儲存為專案檔"), Locale::Hant, true) ||
        !checkCall(true, QStringLiteral("Save as .cv"),
                   QStringLiteral("プロジェクトファイルとして保存"),
                   Locale::Japanese, true) ||
        !checkCall(false, QStringLiteral("Save Scene"), QStringLiteral("Save Scene"),
                   Locale::English, true) ||
        !checkCall(false, QStringLiteral("Save Scene"), QStringLiteral("Save Scene"),
                   Locale::Unknown, true) ||
        !checkCall(false, QStringLiteral("Save as .cv"),
                   QStringLiteral("Save as .cv"), Locale::English, true) ||
        !checkCall(false, QStringLiteral("Save as .cv"),
                   QStringLiteral("Save as .cv"), Locale::Unknown, true) ||
        !checkFallback(true,
                       native_save_scene_caption::contract::kReturnOffset + 4U,
                       QStringLiteral("Save Scene"),
                       QStringLiteral("Save Scene"), Locale::Hans, false) ||
        !checkFallback(true,
                       native_save_scene_caption::contract::kReturnOffset + 4U,
                       QStringLiteral("Save as .cv"),
                       QStringLiteral("Save as .cv"), Locale::Hant, false) ||
        !checkFallback(true, 0x10001000U, QStringLiteral("Save as .cv"),
                       QStringLiteral("Save as .cv"), Locale::Hans, false) ||
        !checkFallback(true, 0x10001000U, QStringLiteral("Save Scene "),
                       QStringLiteral("Save Scene "), Locale::Hans, false) ||
        !checkFallback(true, 0x10001000U, QStringLiteral("Save as .cv "),
                       QStringLiteral("Save as .cv "), Locale::Hans, false) ||
        !checkFallback(false, 0x10001000U, QStringLiteral("Save Scene"),
                       QStringLiteral("Save Scene"), Locale::Hans, false) ||
        !checkFallback(false,
                       native_save_scene_caption::contract::kReturnOffset,
                       QStringLiteral("Save as .cv"),
                       QStringLiteral("Save as .cv"), Locale::Hans, false) ||
        !checkFallback(true,
                       native_save_scene_caption::contract::kReturnOffset,
                       QStringLiteral("Other caption"),
                       QStringLiteral("Other caption"), Locale::Hans, false)) return 1;

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
    if (!checkOpenCall(true, Locale::Hans, QStringLiteral("加载工程文件"), true) ||
        !checkOpenCall(true, Locale::Hant, QStringLiteral("載入專案檔案"), true) ||
        !checkOpenCall(true, Locale::Japanese, QStringLiteral(".cv を読み込み"), true) ||
        !checkOpenCall(false, Locale::English, QStringLiteral("Load .cv"), true) ||
        !checkOpenCall(false, Locale::Unknown, QStringLiteral("Load .cv"), true) ||
        !checkOpenFallback(true,
            native_save_scene_caption::contract::kOpenFileNameReturnOffset + 4U,
            QStringLiteral("Load .cv"), Locale::Hans, false) ||
        !checkOpenFallback(true, 0x10001000U, QStringLiteral("Load .cv "),
                            Locale::Hant, false) ||
        !checkOpenFallback(true, 0x10001000U,
            QStringLiteral("User project: 中文.cv"), Locale::Japanese, false) ||
        !checkOpenFallback(false,
            native_save_scene_caption::contract::kOpenFileNameReturnOffset,
            QStringLiteral("Load .cv"), Locale::Hans, false)) return 1;
#endif

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
    std::puts("PASS: Save and exact 2.8.1 Load .cv preserve parameters, QString return, and unknown-caller/source passthrough");
#else
    std::puts("PASS: 2.8.0 Save captions preserve QString return/ref/lifetime and exact caller/source contract");
#endif
    return 0;
}
