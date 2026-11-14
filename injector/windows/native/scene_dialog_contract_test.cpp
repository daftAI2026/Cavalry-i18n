/**
 * [INPUT]: 依赖scene dialog适配器、共享source-bound caption策略与模拟Qt原函数。
 * [OUTPUT]: 验证三语Save/Open、真实无关caller/source反例、参数和QString返回保全及单次转发。
 * [POS]: vendor-free Windows contract；不创建对话框、不写用户文件、不授予实屏通过。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "scene_dialog_adapter.h"

#include <array>
#include <cstdint>
#include <cstdio>
#include <stdexcept>

namespace {
using cavalry_native_font::Locale;
using native_windows_scene_dialog::contract::kPresetExportFileDialogReturnRva;
using native_windows_scene_dialog::contract::kPresetOpenFileDialogReturnRva;
using native_windows_scene_dialog::contract::kSceneOpenFileDialogReturnRva;
using native_windows_scene_dialog::contract::kSceneOpenThunkReturnRva;
using native_windows_scene_dialog::contract::kSceneSaveFileDialogReturnRva;
using native_windows_scene_dialog::contract::kSnippetExportFileDialogReturnRva;
using native_windows_scene_dialog::contract::kSnippetImportFileDialogReturnRva;
constexpr std::uintptr_t kExtensionBase = 0x180000000ULL;

struct CallState {
    int calls = 0;
    void *parent = nullptr;
    QString caption;
    QString directory;
    QString filter;
    QString *selectedFilter = nullptr;
    int options = 0;
    QString result = QStringLiteral("vendor-result.cv");
    bool throwOnCall = false;
};

QString original(CallState &state, void *parent, const QString &caption,
                 const QString &directory, const QString &filter,
                 QString *selectedFilter, int options)
{
    ++state.calls;
    state.parent = parent;
    state.caption = caption;
    state.directory = directory;
    state.filter = filter;
    state.selectedFilter = selectedFilter;
    state.options = options;
    if (state.throwOnCall) throw std::runtime_error("vendor dialog");
    return state.result;
}

std::string_view expectedTranslation(const QString &source, Locale locale)
{
    using namespace native_save_scene_caption;
    return source == QStringLiteral("Load .cv")
        ? translatedOpenCaption(source, locale)
        : translatedText(source, locale);
}

bool saveRoundTrip(const QString &source, Locale locale)
{
    CallState state;
    QString selected = QStringLiteral("Project (*.cv)");
    const QString directory = QStringLiteral("C:/owned/project");
    const QString filter = QStringLiteral("Project (*.cv)");
    void *const parent = reinterpret_cast<void *>(0x1234);
    int localeReads = 0;
    const QString result = native_windows_scene_dialog::forwardSaveCaption(
        [&](void *p, const QString &c, const QString &d, const QString &f,
            QString *s, int o) { return original(state, p, c, d, f, s, o); },
        true, kExtensionBase + kSceneSaveFileDialogReturnRva,
        kExtensionBase, parent, source, directory, filter, &selected, 0x35,
        [&]() { ++localeReads; return locale; });
    const auto projection = expectedTranslation(source, locale);
    const QString expectedCaption = projection.empty()
        ? source
        : QString::fromUtf8(projection.data(), static_cast<qsizetype>(projection.size()));
    return state.calls == 1 && localeReads == 1 && state.parent == parent &&
        state.caption == expectedCaption && state.directory == directory &&
        state.filter == filter && state.selectedFilter == &selected &&
        state.options == 0x35 && result == state.result && source != state.caption;
}

bool openRoundTrip(Locale locale)
{
    CallState state;
    QString selected = QStringLiteral("Project (*.cv)");
    const QString source = QStringLiteral("Load .cv");
    const QString directory = QStringLiteral("C:/owned/project");
    const QString filter = QStringLiteral("Project (*.cv)");
    void *const parent = reinterpret_cast<void *>(0x5678);
    int localeReads = 0;
    const QString result = native_windows_scene_dialog::forwardOpenCaption(
        [&](void *p, const QString &c, const QString &d, const QString &f,
            QString *s, int o) { return original(state, p, c, d, f, s, o); },
        true, kExtensionBase + kSceneOpenFileDialogReturnRva,
        kExtensionBase + kSceneOpenThunkReturnRva, kExtensionBase, parent,
        source, directory, filter, &selected, 0x59,
        [&]() { ++localeReads; return locale; });
    const auto projection = expectedTranslation(source, locale);
    const QString expectedCaption = projection.empty()
        ? source
        : QString::fromUtf8(projection.data(), static_cast<qsizetype>(projection.size()));
    return state.calls == 1 && localeReads == 1 && state.parent == parent &&
        state.caption == expectedCaption && state.directory == directory &&
        state.filter == filter && state.selectedFilter == &selected &&
        state.options == 0x59 && result == state.result && state.caption != source;
}

bool savePassthrough(std::uintptr_t caller, const QString &source, bool ready = true)
{
    CallState state;
    int localeReads = 0;
    QString selected;
    const auto result = native_windows_scene_dialog::forwardSaveCaption(
        [&](void *p, const QString &c, const QString &d, const QString &f,
            QString *s, int o) { return original(state, p, c, d, f, s, o); },
        ready, caller, kExtensionBase, static_cast<void *>(nullptr), source, QStringLiteral("dir"),
        QStringLiteral("filter"), &selected, 7,
        [&]() { ++localeReads; return Locale::Hans; });
    return state.calls == 1 && localeReads == 0 && state.caption == source &&
        state.selectedFilter == &selected && state.options == 7 && result == state.result;
}

bool openPassthrough(std::uintptr_t caller, std::uintptr_t sceneCaller,
                     const QString &source, bool ready = true)
{
    CallState state;
    int localeReads = 0;
    QString selected;
    const auto result = native_windows_scene_dialog::forwardOpenCaption(
        [&](void *p, const QString &c, const QString &d, const QString &f,
            QString *s, int o) { return original(state, p, c, d, f, s, o); },
        ready, caller, sceneCaller, kExtensionBase, static_cast<void *>(nullptr), source,
        QStringLiteral("dir"), QStringLiteral("filter"), &selected, 9,
        [&]() { ++localeReads; return Locale::Hans; });
    return state.calls == 1 && localeReads == 0 && state.caption == source &&
        state.selectedFilter == &selected && state.options == 9 && result == state.result;
}
}  // namespace

int main()
{
    using namespace native_windows_scene_dialog::contract;
    constexpr std::array locales = {Locale::Hans, Locale::Hant, Locale::Japanese};
    for (const auto locale : locales) {
        if (!saveRoundTrip(QStringLiteral("Save Scene"), locale) ||
            !saveRoundTrip(QStringLiteral("Save as .cv"), locale) ||
            !openRoundTrip(locale)) return 1;
    }

    if (!savePassthrough(kExtensionBase + kPresetExportFileDialogReturnRva,
                         QStringLiteral("Save Scene")) ||
        !savePassthrough(kExtensionBase + kSnippetExportFileDialogReturnRva,
                         QStringLiteral("Save as .cv")) ||
        !openPassthrough(kExtensionBase + kPresetOpenFileDialogReturnRva,
                         kExtensionBase + kSceneOpenThunkReturnRva,
                         QStringLiteral("Load .cv")) ||
        !openPassthrough(kExtensionBase + kSnippetImportFileDialogReturnRva,
                         kExtensionBase + kSceneOpenThunkReturnRva,
                         QStringLiteral("Load .cv")) ||
        !savePassthrough(kExtensionBase + kSceneSaveFileDialogReturnRva + 1U,
                         QStringLiteral("Save Scene")) ||
        !openPassthrough(kExtensionBase + kSceneOpenFileDialogReturnRva,
                         kExtensionBase + kSceneOpenThunkReturnRva + 1U,
                         QStringLiteral("Load .cv")) ||
        !savePassthrough(kExtensionBase + kSceneSaveFileDialogReturnRva,
                         QStringLiteral("Save Scene"), false) ||
        !openPassthrough(kExtensionBase + kSceneOpenFileDialogReturnRva,
                         kExtensionBase + kSceneOpenThunkReturnRva,
                         QStringLiteral("Load .cv"), false) ||
        !savePassthrough(kExtensionBase + kSceneSaveFileDialogReturnRva,
                         QStringLiteral("Save Scene ")) ||
        !openPassthrough(kExtensionBase + kSceneOpenFileDialogReturnRva,
                         kExtensionBase + kSceneOpenThunkReturnRva,
                         QStringLiteral("Load .cv "))) return 2;

    CallState state;
    state.throwOnCall = true;
    try {
        native_windows_scene_dialog::forwardSaveCaption(
            [&](void *p, const QString &c, const QString &d, const QString &f,
                QString *s, int o) { return original(state, p, c, d, f, s, o); },
            true, kExtensionBase + kSceneSaveFileDialogReturnRva, kExtensionBase,
            static_cast<void *>(nullptr), QStringLiteral("Save Scene"), QStringLiteral("dir"),
            QStringLiteral("filter"), nullptr, 0, [] { return Locale::Japanese; });
        return 3;
    } catch (const std::runtime_error &) {
        if (state.calls != 1) return 4;
    }

    std::puts("PASS: Windows scene dialogs preserve exact callers, captions, arguments, QString result, and single forwarding");
    return 0;
}
