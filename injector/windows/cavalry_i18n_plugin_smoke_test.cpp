/**
 * [INPUT]: 依赖已构建 generic/cavalryi18n.dll、Qt Widgets 事件循环、插件环境与显式 diagnostic marker
 * [OUTPUT]: 对外验证真实插件加载、十二个顶层菜单、嵌入翻译表样本、动态 ActionAdded、显示白名单、数据隔离和 marker
 * [POS]: injector/windows 的端到端回归 smoke，以真实 Qt 事件链锁住 Cavalry 首帧与动态英文写回边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include <QtCore/QByteArray>
#include <QtCore/QCoreApplication>
#include <QtCore/QFile>
#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>
#include <QtCore/QPoint>
#include <QtCore/QString>
#include <QtCore/QStringList>
#include <QtCore/QDebug>
#include <QtGui/QAction>
#include <QtWidgets/QApplication>
#include <QtWidgets/QGroupBox>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QListWidget>
#include <QtWidgets/QMainWindow>
#include <QtWidgets/QMenu>
#include <QtWidgets/QMenuBar>
#include <QtWidgets/QPushButton>
#include <QtWidgets/QTabBar>
#include <QtWidgets/QVBoxLayout>

#include <cstdio>

namespace {

bool fail(const QString &message)
{
    const QByteArray utf8 = message.toUtf8();
    std::fprintf(stderr, "%s\n", utf8.constData());
    std::fflush(stderr);
    qCritical().noquote() << message;
    return false;
}

bool expectEqual(
    const QString &surface,
    const QString &actual,
    const QString &expected)
{
    if (actual == expected) {
        return true;
    }

    return fail(
        QStringLiteral("%1 mismatch: expected '%2', got '%3'.")
            .arg(surface, expected, actual));
}

bool expectMenuText(
    const QString &surface,
    QString actual,
    const QString &expected)
{
    actual.remove(QChar('&'));
    return expectEqual(surface, actual, expected);
}

bool verifyMarker()
{
    const QString markerPath =
        qEnvironmentVariable("CAVALRY_I18N_DIAGNOSTIC_MARKER");
    QFile markerFile(markerPath);
    if (!markerFile.open(QIODevice::ReadOnly)) {
        return fail(
            QStringLiteral("Cannot read plugin marker: %1")
                .arg(markerFile.errorString()));
    }

    QJsonParseError parseError;
    const QJsonDocument document =
        QJsonDocument::fromJson(markerFile.readAll(), &parseError);
    if (parseError.error != QJsonParseError::NoError
        || !document.isObject()) {
        return fail(
            QStringLiteral("Invalid plugin marker JSON: %1")
                .arg(parseError.errorString()));
    }

    const QJsonObject marker = document.object();
    const QString expectedProcessId =
        QString::number(QCoreApplication::applicationPid());
    if (marker.value(QStringLiteral("plugin")).toString()
            != QStringLiteral("cavalryi18n")
        || marker.value(QStringLiteral("status")).toString()
            != QStringLiteral("ready")
        || marker.value(QStringLiteral("translationSource")).toString()
            != QStringLiteral("embedded-generated-table")
        || !marker.value(QStringLiteral("translatorInstalled")).toBool()
        || marker.value(QStringLiteral("embeddedEntryCount")).toInt() <= 0
        || marker.value(QStringLiteral("exactKeyCount")).toInt() <= 0
        || marker.value(QStringLiteral("sourceFallbackCount")).toInt() <= 0
        || marker.value(QStringLiteral("extensionLayerHookStatus")).toString()
            != QStringLiteral("waiting-for-extension-layer")
        || !marker.value(QStringLiteral("extensionLayerHookDetail"))
                .toString()
                .contains(QStringLiteral("ExtensionLayer.dll"))
        || marker.value(QStringLiteral("processId")).toString()
            != expectedProcessId) {
        return fail(QStringLiteral("Plugin marker contract mismatch."));
    }

    return true;
}

bool verifyEmbeddedTranslationSamples()
{
    // 仅验证生成表被 generic plugin 安装；不把这些样本当成任何自绘 hook 的覆盖声明。
    const QStringList sources {
        QStringLiteral("Double click here to import Assets."),
        QStringLiteral("Drag layers here to see their settings."),
        QStringLiteral("Drag some JavaScript here to make a Snippet."),
        QStringLiteral(
            "Use the Create menu to add a layer to your Composition."),
    };
    const QStringList translations {
        QStringLiteral("双击此处以导入素材"),
        QStringLiteral("将图层拖到此处以查看其设置"),
        QStringLiteral("将 JavaScript 拖到此处以创建代码片段"),
        QStringLiteral("使用“创建”菜单将图层添加到合成中"),
    };

    for (int index = 0; index < sources.size(); ++index) {
        const QByteArray sourceUtf8 = sources.at(index).toUtf8();
        if (!expectEqual(
                QStringLiteral("embedded source %1").arg(index),
                QCoreApplication::translate(
                    "EmbeddedTranslationFixture",
                    sourceUtf8.constData()),
                translations.at(index))) {
            return false;
        }
    }

    return true;
}

bool verifyDisplayTranslation(QApplication &application)
{
    const QStringList sourceMenus {
        QStringLiteral("File"),
        QStringLiteral("Edit"),
        QStringLiteral("View"),
        QStringLiteral("Window"),
        QStringLiteral("Composition"),
        QStringLiteral("Create"),
        QStringLiteral("Animation"),
        QStringLiteral("Shape"),
        QStringLiteral("Tool"),
        QStringLiteral("Dynamics"),
        QStringLiteral("Scripts"),
        QStringLiteral("Help"),
    };
    const QStringList translatedMenus {
        QStringLiteral("文件"),
        QStringLiteral("编辑"),
        QStringLiteral("视图"),
        QStringLiteral("窗口"),
        QStringLiteral("合成"),
        QStringLiteral("创建"),
        QStringLiteral("动画"),
        QStringLiteral("形状"),
        QStringLiteral("工具"),
        QStringLiteral("动力学"),
        QStringLiteral("脚本"),
        QStringLiteral("帮助"),
    };

    QMainWindow window;
    window.setWindowTitle(
        QStringLiteral("Project: None - Scene: Untitled"));
    window.setToolTip(QStringLiteral("Properties"));
    window.setStatusTip(QStringLiteral("Scene Window"));

    QList<QMenu *> menus;
    for (const QString &sourceMenu : sourceMenus) {
        menus.append(
            window.menuBar()->addMenu(
                QStringLiteral("&") + sourceMenu));
    }

    QAction *existingAction =
        menus.at(1)->addAction(QStringLiteral("Undo"));
    existingAction->setIconText(QStringLiteral("Open"));
    existingAction->setToolTip(QStringLiteral("Scene Window"));
    existingAction->setStatusTip(QStringLiteral("Properties"));

    auto *centralWidget = new QWidget(&window);
    auto *layout = new QVBoxLayout(centralWidget);
    auto *label = new QLabel(
        QStringLiteral("Double click here to import Assets"),
        centralWidget);
    auto *button =
        new QPushButton(QStringLiteral("Continue"), centralWidget);
    auto *groupBox =
        new QGroupBox(QStringLiteral("Properties"), centralWidget);
    auto *lineEdit = new QLineEdit(centralWidget);
    lineEdit->setText(QStringLiteral("Scene Window"));
    lineEdit->setPlaceholderText(
        QStringLiteral("Search layers\u2026"));
    auto *tabBar = new QTabBar(centralWidget);
    tabBar->addTab(QStringLiteral("JavaScript Editor"));
    auto *modelView = new QListWidget(centralWidget);
    modelView->addItem(QStringLiteral("Scene Window"));

    layout->addWidget(label);
    layout->addWidget(button);
    layout->addWidget(groupBox);
    layout->addWidget(lineEdit);
    layout->addWidget(tabBar);
    layout->addWidget(modelView);
    window.setCentralWidget(centralWidget);

    window.show();
    application.processEvents();
    menus.at(1)->popup(QPoint(0, 0));
    application.processEvents();
    menus.at(1)->hide();

    const QList<QAction *> topLevelActions = window.menuBar()->actions();
    if (topLevelActions.size() != sourceMenus.size()) {
        return fail(QStringLiteral("Top-level menu count mismatch."));
    }
    for (int index = 0; index < translatedMenus.size(); ++index) {
        if (!expectMenuText(
                QStringLiteral("top-level menu %1").arg(index),
                topLevelActions.at(index)->text(),
                translatedMenus.at(index))) {
            return false;
        }
        if (!expectMenuText(
                QStringLiteral("menu title %1").arg(index),
                menus.at(index)->title(),
                translatedMenus.at(index))) {
            return false;
        }
    }

    if (!expectEqual(
            QStringLiteral("window title"),
            window.windowTitle(),
            QStringLiteral("项目：无 - 场景：未命名"))
        || !expectEqual(
            QStringLiteral("window tooltip"),
            window.toolTip(),
            QStringLiteral("属性"))
        || !expectEqual(
            QStringLiteral("window status tip"),
            window.statusTip(),
            QStringLiteral("场景窗口"))
        || !expectEqual(
            QStringLiteral("label"),
            label->text(),
            QStringLiteral("双击此处以导入素材"))
        || !expectEqual(
            QStringLiteral("button"),
            button->text(),
            QStringLiteral("继续"))
        || !expectEqual(
            QStringLiteral("group box"),
            groupBox->title(),
            QStringLiteral("属性"))
        || !expectEqual(
            QStringLiteral("line edit placeholder"),
            lineEdit->placeholderText(),
            QStringLiteral("搜索层..."))
        || !expectEqual(
            QStringLiteral("tab"),
            tabBar->tabText(0),
            QStringLiteral("JavaScript 编辑器"))
        || !expectEqual(
            QStringLiteral("preexisting action"),
            existingAction->text(),
            QStringLiteral("撤销"))
        || !expectEqual(
            QStringLiteral("action icon text"),
            existingAction->iconText(),
            QStringLiteral("打开"))
        || !expectEqual(
            QStringLiteral("action tooltip"),
            existingAction->toolTip(),
            QStringLiteral("场景窗口"))
        || !expectEqual(
            QStringLiteral("action status tip"),
            existingAction->statusTip(),
            QStringLiteral("属性"))) {
        return false;
    }

    // 输入值和 item model 是业务数据，显示层翻译不得触碰。
    if (!expectEqual(
            QStringLiteral("line edit value"),
            lineEdit->text(),
            QStringLiteral("Scene Window"))
        || !expectEqual(
            QStringLiteral("item model value"),
            modelView->item(0)->text(),
            QStringLiteral("Scene Window"))) {
        return false;
    }

    QAction *dynamicAction =
        menus.at(1)->addAction(QStringLiteral("&Create"));
    application.processEvents();
    if (!expectEqual(
            QStringLiteral("ActionAdded"),
            dynamicAction->text(),
            QStringLiteral("创建"))) {
        return false;
    }

    existingAction->setText(QStringLiteral("Undo"));
    label->setText(QStringLiteral("Double click here to import Assets"));
    label->repaint();
    application.processEvents();
    if (!expectEqual(
            QStringLiteral("dynamic action rewrite"),
            existingAction->text(),
            QStringLiteral("撤销"))
        || !expectEqual(
            QStringLiteral("dynamic label rewrite"),
            label->text(),
            QStringLiteral("双击此处以导入素材"))) {
        return false;
    }

    return true;
}

} // namespace

int main(int argc, char *argv[])
{
    QApplication application(argc, argv);

    const QString exact =
        QCoreApplication::translate("QMenuBar", "File");
    const QString fallback =
        QCoreApplication::translate("UnknownContext", "File");
    if (exact != QStringLiteral("文件")
        || fallback != QStringLiteral("文件")) {
        fail(
            QStringLiteral(
                "Loaded plugin did not serve embedded translations."));
        return 1;
    }

    return verifyEmbeddedTranslationSamples()
            && verifyDisplayTranslation(application) && verifyMarker()
        ? 0
        : 1;
}
