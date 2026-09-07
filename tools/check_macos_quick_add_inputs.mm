/**
 * [INPUT]: 依赖 macOS 生产注入器的 QLineEdit 显示/回调/Paint 入口、共享搜索策略、Qt 6.6.3 Widgets 与 moc 生成的精确 Cavalry owner fixture
 * [OUTPUT]: 对外提供三语 Quick Add 搜索输入回归程序，证明 Text/Box/Shape/Circle/Edit 的完整、部分、大小写、CJK 与清空查询保持原文且 placeholder 仍翻译
 * [POS]: tools 的 macOS 原生搜索输入合同；直接编译生产实现并用 exact QuickAddWindow/FastQuickAddWindow 父系验证预填充 parentless 输入和动态 owner 复核，不启动或修改真实 Cavalry
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "../injector/CavalryTranslatorInjector.mm"

#include <QtCore/QByteArray>
#include <QtCore/QStringList>
#include <QtWidgets/QApplication>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QWidget>

#include <cstdio>

namespace cavalry {

class FastQuickAddWindow final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

} // namespace cavalry

class QuickAddWindow final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

class Widget final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

class SearchBar final : public QWidget {
    Q_OBJECT
public:
    using QWidget::QWidget;
};

class CompleterLineEdit final : public QLineEdit {
    Q_OBJECT
public:
    using QLineEdit::QLineEdit;
};

namespace {

int failures = 0;

void expect(bool condition, const QString &message)
{
    if (!condition) {
        std::fprintf(stderr, "FAIL: %s\n", message.toUtf8().constData());
        ++failures;
    }
}

struct SearchBoxFixture {
    QWidget *owner = nullptr;
    Widget *widget = nullptr;
    SearchBar *searchBar = nullptr;
    CompleterLineEdit *lineEdit = nullptr;
};

template <typename Owner>
SearchBoxFixture makeSearchBox()
{
    auto *owner = new Owner;
    auto *widget = new Widget(owner);
    auto *searchBar = new SearchBar(widget);
    auto *lineEdit = new CompleterLineEdit(searchBar);
    return {owner, widget, searchBar, lineEdit};
}

struct QueryCase {
    const char *name;
    const char *value;
};

constexpr QueryCase kEnglishQueries[] = {
    {"full Text", "Text"},
    {"full Box", "Box"},
    {"full Shape", "Shape"},
    {"full Circle", "Circle"},
    {"full Edit", "Edit"},
    {"partial Text", "Tex"},
    {"partial Box", "Bo"},
    {"partial Shape", "Shap"},
    {"partial Circle", "Cir"},
    {"partial Edit", "Edi"},
    {"case Text", "TEXT"},
    {"case Box", "bOx"},
    {"case Shape", "shape"},
    {"case Circle", "CIRCLE"},
    {"case Edit", "eDiT"},
};

QStringList cjkQueries(const QString &language)
{
    if (language == QStringLiteral("zh-Hans")) {
        return {
            QStringLiteral("文字"),
            QStringLiteral("盒形"),
            QStringLiteral("形状"),
            QStringLiteral("圆形"),
            QStringLiteral("编辑"),
        };
    }
    if (language == QStringLiteral("zh-Hant")) {
        return {
            QStringLiteral("文字"),
            QStringLiteral("盒形"),
            QStringLiteral("形狀"),
            QStringLiteral("圓形"),
            QStringLiteral("編輯"),
        };
    }
    if (language == QStringLiteral("ja_JP")) {
        return {
            QStringLiteral("テキスト"),
            QStringLiteral("ボックス"),
            QStringLiteral("シェイプ"),
            QStringLiteral("円"),
            QStringLiteral("編集"),
        };
    }
    return {};
}

QString expectedPlaceholder(const QString &language)
{
    return translatedWidgetText(language, QStringLiteral("Text"));
}

void verifyOwnerName(const SearchBoxFixture &fixture, const char *expected)
{
    const QByteArray actual = fixture.owner->metaObject()->className();
    expect(actual == QByteArray(expected),
           QStringLiteral("owner class is exact: expected %1, got %2")
               .arg(QString::fromLatin1(expected), QString::fromLatin1(actual)));
    expect(cavalry_i18n::isQuickAddSearchBox(fixture.lineEdit),
           QStringLiteral("exact owner/search bar/widget chain is a Quick Add search box"));
}

void verifyOneQuery(
    const SearchBoxFixture &fixture,
    const QString &language,
    const QString &query,
    const QString &queryName,
    const char *pathName,
    void (*path)(QLineEdit *, const QString &, const QString &))
{
    const QString placeholder = expectedPlaceholder(language);
    fixture.lineEdit->setPlaceholderText(QStringLiteral("Text"));
    path(fixture.lineEdit, language, query);

    expect(fixture.lineEdit->text() == query,
           QStringLiteral("%1/%2 preserves query %3")
               .arg(QString::fromLatin1(pathName), queryName, query));
    expect(fixture.lineEdit->placeholderText() == placeholder && placeholder != QStringLiteral("Text"),
           QStringLiteral("%1/%2 keeps translated placeholder")
               .arg(QString::fromLatin1(pathName), queryName));
}

void directDisplayPath(
    QLineEdit *lineEdit,
    const QString &language,
    const QString &query)
{
    lineEdit->setText(query);
    translateLineEditDisplayText(lineEdit, language);
}

void callbackPath(
    QLineEdit *lineEdit,
    const QString &language,
    const QString &query)
{
    hookLineEditTextChanges(lineEdit, language);
    lineEdit->setText(query);
}

void paintPath(
    QLineEdit *lineEdit,
    const QString &language,
    const QString &query)
{
    lineEdit->setText(query);
    translateLineEditBeforePaint(lineEdit, language);
}

template <typename Owner>
void verifyOwnerQueries(const QString &language, const char *ownerName)
{
    constexpr int queryCount = sizeof(kEnglishQueries) / sizeof(kEnglishQueries[0]);
    const struct {
        const char *name;
        void (*path)(QLineEdit *, const QString &, const QString &);
    } paths[] = {
        {"translateLineEditDisplayText", directDisplayPath},
        {"hookLineEditTextChanges", callbackPath},
        {"Paint", paintPath},
    };

    for (const auto &selectedPath : paths) {
        for (int index = 0; index < queryCount; ++index) {
            SearchBoxFixture fixture = makeSearchBox<Owner>();
            verifyOwnerName(fixture, ownerName);
            verifyOneQuery(
                fixture,
                language,
                QString::fromLatin1(kEnglishQueries[index].value),
                QString::fromLatin1(kEnglishQueries[index].name),
                selectedPath.name,
                selectedPath.path);
            delete fixture.owner;
        }

        const QStringList cjk = cjkQueries(language);
        for (int index = 0; index < cjk.size(); ++index) {
            SearchBoxFixture fixture = makeSearchBox<Owner>();
            verifyOwnerName(fixture, ownerName);
            verifyOneQuery(
                fixture,
                language,
                cjk.at(index),
                QStringLiteral("CJK %1").arg(index + 1),
                selectedPath.name,
                selectedPath.path);
            delete fixture.owner;
        }

        SearchBoxFixture cleared = makeSearchBox<Owner>();
        verifyOwnerName(cleared, ownerName);
        verifyOneQuery(
            cleared,
            language,
            QString(),
            QStringLiteral("clear"),
            selectedPath.name,
            selectedPath.path);
        delete cleared.owner;
    }
}

template <typename Owner>
void verifyParentlessHookThenReparent(const QString &language, const char *ownerName)
{
    auto *lineEdit = new CompleterLineEdit;
    lineEdit->setPlaceholderText(QStringLiteral("Text"));
    lineEdit->setText(QStringLiteral("Box"));
    hookLineEditTextChanges(lineEdit, language);
    expect(lineEdit->text() == QStringLiteral("Box"),
           QStringLiteral("parentless prefilled query survives first translation"));
    lineEdit->setText(QStringLiteral("Shape"));
    expect(lineEdit->text() == QStringLiteral("Shape"),
           QStringLiteral("parentless callback preserves query before owner exists"));
    expect(!cavalry_i18n::isQuickAddSearchBox(lineEdit),
           QStringLiteral("%1 parentless hook starts outside Quick Add owner")
               .arg(QString::fromLatin1(ownerName)));

    auto *owner = new Owner;
    auto *widget = new Widget(owner);
    auto *searchBar = new SearchBar(widget);
    lineEdit->setParent(searchBar);
    expect(cavalry_i18n::isQuickAddSearchBox(lineEdit),
           QStringLiteral("%1 callback rechecks owner after reparent")
               .arg(QString::fromLatin1(ownerName)));

    lineEdit->setText(QStringLiteral("Text"));
    expect(lineEdit->text() == QStringLiteral("Text"),
           QStringLiteral("%1 parentless-hook callback preserves reparented query")
               .arg(QString::fromLatin1(ownerName)));
    expect(lineEdit->placeholderText() == expectedPlaceholder(language),
           QStringLiteral("%1 parentless-hook placeholder remains translated")
               .arg(QString::fromLatin1(ownerName)));
    delete owner;
}

void verifyLanguage(const QString &language)
{
    rebuildTranslationCache(language);
    expect(!expectedPlaceholder(language).isEmpty(),
           QStringLiteral("%1 has a translated Text placeholder").arg(language));
    verifyOwnerQueries<QuickAddWindow>(language, "QuickAddWindow");
    verifyOwnerQueries<cavalry::FastQuickAddWindow>(
        language,
        "cavalry::FastQuickAddWindow");
    verifyParentlessHookThenReparent<QuickAddWindow>(language, "QuickAddWindow");
    verifyParentlessHookThenReparent<cavalry::FastQuickAddWindow>(
        language,
        "cavalry::FastQuickAddWindow");
}

} // namespace

int main(int argc, char **argv)
{
    // 只直调生产入口；禁止测试构造器启动真实 app 的 bootstrap/capture 生命周期。
    gInstallAttempted = true;
    QApplication application(argc, argv);
    application.setQuitOnLastWindowClosed(false);

    for (const auto &language : {
             QStringLiteral("zh-Hans"),
             QStringLiteral("zh-Hant"),
             QStringLiteral("ja_JP")}) {
        verifyLanguage(language);
    }

    std::fprintf(
        stderr,
        "macOS Quick Add input fixture: %d failures\n",
        failures);
    return failures == 0 ? 0 : 1;
}

#include "check_macos_quick_add_inputs.moc"
