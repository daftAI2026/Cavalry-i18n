/**
 * [INPUT]: 依赖Qt 6.9.2 QString/QFileDialog公开头与caption策略。
 * [OUTPUT]: 验证两种caption、架构call-site、QString槽与透传边界。
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
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wreturn-type-c-linkage"
extern "C" QString saveSceneDialogAbiTarget(
    QWidget *, const QString &, const QString &, const QString &, QString *,
    QFileDialog::Options)
    __asm__("__ZN11QFileDialog15getSaveFileNameEP7QWidgetRK7QStringS4_S4_PS2_6QFlagsINS_6OptionEE");
#pragma clang diagnostic pop
static_assert(std::is_same_v<decltype(&saveSceneDialogAbiTarget),
                             ExactSaveFileNameSignature>);
static_assert(std::is_same_v<decltype(&QFileDialog::getSaveFileName),
                             ExactSaveFileNameSignature>);
#if defined(__x86_64__)
static_assert(native_save_scene_caption::contract::kCallOffset == 0x7bb931U);
#else
static_assert(native_save_scene_caption::contract::kCallOffset == 0x6c1760U);
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

    std::puts("PASS: Save captions preserve QString return/ref/lifetime and exact caller/source contract");
    return 0;
}
