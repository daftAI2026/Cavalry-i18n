/**
 * [INPUT]: 依赖 cavalry_i18n_quick_add_tabs.h 的 exact owner/class 链判定与 QLabel 显示副本投影，以及 Qt 6.6.3 Widgets 公共 API
 * [OUTPUT]: 对外提供 Quick Add 顶部类别标签显示边界的 vendor-free 合同回归；覆盖五个固定 source、Classic/Fast owner、负例与完整 source 保留
 * [POS]: injector/windows 的 Quick Add 顶部标签合同测试；用 moc 生成的 exact 类链模拟厂商对象，只验证共享边界与基类 setter，不冒充真实 Cavalry ABI 或 live UI 证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "../cavalry_i18n_quick_add_tabs.h"

#include <QtCore/QStringList>
#include <QtWidgets/QApplication>

#include <cstdio>

namespace cavalry {

class FastQuickAddWindow final : public QWidget
{
    Q_OBJECT

public:
    using QWidget::QWidget;
};

} // namespace cavalry

class QuickAddWindow final : public QWidget
{
    Q_OBJECT

public:
    using QWidget::QWidget;
};

class TabBarHeader final : public QWidget
{
    Q_OBJECT

public:
    using QWidget::QWidget;
};

class Widget : public QWidget
{
    Q_OBJECT

public:
    using QWidget::QWidget;
};

class TabItem final : public Widget
{
    Q_OBJECT

public:
    using Widget::Widget;
};

class RolloverLabel : public QLabel
{
    Q_OBJECT

public:
    using QLabel::QLabel;

    void setVendorSource(const QString &source)
    {
        fullSource_ = source;
        QLabel::setText(source);
    }

    const QString &vendorSource() const
    {
        return fullSource_;
    }

private:
    QString fullSource_;
};

class DerivedRolloverLabel final : public RolloverLabel
{
    Q_OBJECT

public:
    using RolloverLabel::RolloverLabel;
};

namespace {

bool expect(bool condition, const char *message)
{
    if (condition) {
        return true;
    }
    std::fprintf(stderr, "Quick Add tabs contract failed: %s\n", message);
    return false;
}

bool expectEqual(
    const QString &actual,
    const QString &expected,
    const char *message)
{
    if (actual == expected) {
        return true;
    }
    std::fprintf(
        stderr,
        "Quick Add tabs contract failed: %s (expected '%s', got '%s')\n",
        message,
        expected.toUtf8().constData(),
        actual.toUtf8().constData());
    return false;
}

bool verifyCategorySources()
{
    const QStringList accepted{
        QStringLiteral("All"),
        QStringLiteral("Shapes"),
        QStringLiteral("Behaviours"),
        QStringLiteral("Utilities"),
        QStringLiteral("Effects"),
    };
    for (const QString &source : accepted) {
        if (!expect(
                cavalry_i18n::isQuickAddCategorySource(source),
                "known category source must be accepted")) {
            return false;
        }
    }

    return expect(
               !cavalry_i18n::isQuickAddCategorySource(
                   QStringLiteral("Behavi…")),
               "elided source must not be treated as a category key")
        && expect(
               !cavalry_i18n::isQuickAddCategorySource(
                   QStringLiteral("Behaviour")),
               "singular prefix must not be treated as a category key");
}

bool verifyOwnerBoundaries()
{
    {
        cavalry::FastQuickAddWindow owner;
        TabBarHeader header(&owner);
        TabItem item(&header);
        RolloverLabel label(&item);
        if (!expect(
                cavalry_i18n::isQuickAddCategoryLabel(&label),
                "Fast exact owner chain must be accepted")) {
            return false;
        }
    }

    {
        QuickAddWindow owner;
        TabBarHeader header(&owner);
        TabItem item(&header);
        RolloverLabel label(&item);
        if (!expect(
                cavalry_i18n::isQuickAddCategoryLabel(&label),
                "Classic exact owner chain must be accepted")) {
            return false;
        }
    }

    {
        QWidget unrelatedOwner;
        TabBarHeader header(&unrelatedOwner);
        TabItem item(&header);
        RolloverLabel label(&item);
        if (!expect(
                !cavalry_i18n::isQuickAddCategoryLabel(&label),
                "unrelated owner must be rejected")) {
            return false;
        }
    }

    {
        cavalry::FastQuickAddWindow owner;
        RolloverLabel label(&owner);
        if (!expect(
                !cavalry_i18n::isQuickAddCategoryLabel(&label),
                "missing TabItem and TabBarHeader must be rejected")) {
            return false;
        }
    }

    {
        cavalry::FastQuickAddWindow owner;
        TabBarHeader header(&owner);
        TabItem item(&header);
        DerivedRolloverLabel label(&item);
        if (!expect(
                !cavalry_i18n::isQuickAddCategoryLabel(&label),
                "derived label must not widen exact class ownership")) {
            return false;
        }
    }

    {
        cavalry::FastQuickAddWindow owner;
        TabBarHeader header(&owner);
        TabItem item(&header);
        QLabel label(&item);
        if (!expect(
                !cavalry_i18n::isQuickAddCategoryLabel(&label),
                "ordinary QLabel must not enter the vendor label path")) {
            return false;
        }
    }

    return true;
}

bool verifyDisplayProjection()
{
    cavalry::FastQuickAddWindow owner;
    TabBarHeader header(&owner);
    TabItem item(&header);
    RolloverLabel label(&item);
    label.setFixedWidth(40);
    label.setVendorSource(QStringLiteral("Behaviours"));

    const QString translated = QStringLiteral("行为和其他内容");
    const QString expected =
        cavalry_i18n::quickAddCategoryDisplayText(&label, translated);
    if (!expect(!expected.isEmpty(), "translated display projection is nonempty")
        || !expect(
            expected != translated,
            "narrow category label should use translated elision")) {
        return false;
    }

    if (!expect(
            cavalry_i18n::setQuickAddCategoryDisplayText(&label, translated),
            "exact label display setter must accept the owner chain")
        || !expectEqual(
            label.text(),
            expected,
            "QLabel display must equal translated projection")
        || !expectEqual(
            label.vendorSource(),
            QStringLiteral("Behaviours"),
            "vendor full source must remain unchanged")) {
        return false;
    }

    QLabel unrelated(QStringLiteral("Behavi…"), &item);
    return expect(
        !cavalry_i18n::setQuickAddCategoryDisplayText(
            &unrelated,
            QStringLiteral("行为")),
        "ordinary QLabel must reject the category display setter")
        && expectEqual(
            unrelated.text(),
            QStringLiteral("Behavi…"),
            "ordinary QLabel elided English must remain untouched");
}

} // namespace

int main(int argc, char **argv)
{
    QApplication application(argc, argv);
    return verifyCategorySources()
            && verifyOwnerBoundaries()
            && verifyDisplayProjection()
        ? 0
        : 1;
}

#include "cavalry_i18n_quick_add_tabs_test.moc"
