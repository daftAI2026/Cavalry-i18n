/**
 * [INPUT]: 依赖 Quick Add placeholder 显示策略、Qt 公共控件和可控 vendor getter/setter
 * [OUTPUT]: 验证 exact Classic 范围、三语空结果、重复 Paint 幂等与 vendor 英文重写后的恢复
 * [POS]: tools 的空结果显示回归；不接触 vendor 私有布局，ABI 由平台适配器另行证明
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_quick_add_placeholder.h"
#include <QtWidgets/QApplication>
#include <QtWidgets/QListWidget>
#include <cstdio>

class QuickAddWindow : public QWidget { Q_OBJECT public: using QWidget::QWidget; };
class ListWidget : public QListWidget { Q_OBJECT public: using QListWidget::QListWidget; };
namespace {
QString current;
int writes = 0;
QString readText(const QListWidget *) { return current; }
void writeText(QListWidget *, const QString &text) { current = text; ++writes; }
#define CHECK(x) do { if (!(x)) { std::fprintf(stderr, "line %d: %s\n", __LINE__, #x); return 1; } } while(false)
}
int main(int argc, char **argv)
{
    QApplication app(argc, argv);
    QuickAddWindow owner;
    ListWidget list(&owner);
    const cavalry_i18n::QuickAddPlaceholderApi api{readText, writeText};
    for (const QString &translated : {QStringLiteral("无结果"), QStringLiteral("無結果"), QStringLiteral("結果なし")}) {
        current = QStringLiteral("No Results");
        writes = 0;
        CHECK(cavalry_i18n::translateQuickAddPlaceholder(&list, translated, api));
        CHECK(current == translated && writes == 1);
        for (int paint = 0; paint < 1000; ++paint)
            CHECK(!cavalry_i18n::translateQuickAddPlaceholder(list.viewport(), translated, api));
        CHECK(writes == 1);
        current = QStringLiteral("No Results");
        CHECK(cavalry_i18n::translateQuickAddPlaceholder(list.viewport(), translated, api));
        CHECK(writes == 2);
        current.clear();
        CHECK(!cavalry_i18n::translateQuickAddPlaceholder(&list, translated, api));
        current = QStringLiteral("User text");
        CHECK(!cavalry_i18n::translateQuickAddPlaceholder(&list, translated, api));
        CHECK(current == QStringLiteral("User text") && writes == 2);
    }
    current = QStringLiteral("No Results");
    CHECK(!cavalry_i18n::translateQuickAddPlaceholder(&list, QString(), api));
    CHECK(!cavalry_i18n::translateQuickAddPlaceholder(&list, current, api));
    CHECK(!cavalry_i18n::translateQuickAddPlaceholder(&list, QStringLiteral("无结果"), {}));
    QWidget foreignOwner;
    ListWidget foreignList(&foreignOwner);
    QListWidget ordinaryList(&owner);
    CHECK(!cavalry_i18n::translateQuickAddPlaceholder(&foreignList, QStringLiteral("无结果"), api));
    CHECK(!cavalry_i18n::translateQuickAddPlaceholder(&ordinaryList, QStringLiteral("无结果"), api));
    CHECK(!cavalry_i18n::translateQuickAddPlaceholder(nullptr, QStringLiteral("无结果"), api));
    return 0;
}
#include "quick_add_placeholder_fixture.moc"
