/**
 * [INPUT]: 依赖 cavalry_i18n_display.h、共享 exact-context 策略、CavalryEmbeddedTranslator 与 Qt 6.6.3 Widgets/DisplayRole 公共 API
 * [OUTPUT]: 对外实现菜单/动作首帧翻译、逐行 tooltip、数字后缀、selected/认证及来源绑定的 Mesh Explorer QLabel、Color Settings QComboBox 模板、单索引 QPlainTextEdit 占位文字和动态英文写回恢复
 * [POS]: injector/windows 的主动显示翻译器，以事件驱动白名单补齐厂商控件与复合提示；动态模板同时校验显示属性与已采证父系/对话框来源，隔离编辑器正文、UserRole、currentIndex、QLineEdit 用户值与无关 QWidget
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "cavalry_i18n_display.h"

#include "cavalry_i18n_dynamic_label.h"
#include "cavalry_i18n_translator.h"

#include "../cavalry_i18n_translation_policy.h"

#include <QtCore/QAbstractItemModel>
#include <QtCore/QPointer>
#include <QtCore/QRegularExpression>
#include <QtCore/QSignalBlocker>
#include <QtGui/QAction>
#include <QtWidgets/QAbstractButton>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QDialog>
#include <QtWidgets/QGroupBox>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QMenu>
#include <QtWidgets/QPlainTextEdit>
#include <QtWidgets/QTabBar>
#include <QtWidgets/QTreeWidget>
#include <QtWidgets/QWidget>

namespace {

class TranslationScope final
{
public:
    TranslationScope(QSet<QObject *> &activeObjects, QObject *object)
        : activeObjects_(activeObjects)
        , object_(object)
        , entered_(object != nullptr && !activeObjects.contains(object))
    {
        if (entered_) {
            activeObjects_.insert(object_);
        }
    }

    ~TranslationScope()
    {
        if (entered_) {
            activeObjects_.remove(object_);
        }
    }

    bool entered() const
    {
        return entered_;
    }

private:
    QSet<QObject *> &activeObjects_;
    QObject *object_;
    bool entered_;
};

QString normalizedDisplaySource(const QString &source)
{
    QString normalized = source;
    normalized.replace(QChar('&'), QString());
    normalized.replace(QString::fromUtf8("…"), QStringLiteral("..."));

    QString cleaned;
    cleaned.reserve(normalized.size());
    for (QChar character : normalized) {
        if (character.category() == QChar::Other_Format
            || character.unicode() == 0xFEFF) {
            continue;
        }
        cleaned.append(character);
    }

    return cleaned.simplified();
}

bool isCanonicalNonNegativeInteger(const QString &value)
{
    bool parsed = false;
    const int integer = value.toInt(&parsed, 10);
    return parsed && integer >= 0 && QString::number(integer) == value;
}

bool hasAncestorClass(const QObject *object, const char *className)
{
    if (object == nullptr || className == nullptr) {
        return false;
    }
    for (const QObject *candidate = object;
         candidate != nullptr;
         candidate = candidate->parent()) {
        if (candidate->inherits(className)) {
            return true;
        }
    }
    return false;
}

bool isColorSettingsCombo(
    CavalryEmbeddedTranslator &translator,
    QObject *object)
{
    auto *comboBox = qobject_cast<QComboBox *>(object);
    if (comboBox == nullptr) {
        return false;
    }
    auto *dialog = qobject_cast<QDialog *>(comboBox->window());
    if (dialog == nullptr) {
        return false;
    }

    static const QString kSourceTitle =
        QStringLiteral("Color Settings");
    const QString title = dialog->windowTitle();
    if (title == kSourceTitle) {
        return true;
    }
    const QString translatedTitle =
        translator.translate(nullptr, "Color Settings");
    return !translatedTitle.isEmpty() && title == translatedTitle;
}

QString translatedExactTemplate(
    CavalryEmbeddedTranslator &translator,
    const char *context,
    const char *sourceTemplate,
    const QString &value)
{
    const QString translated =
        translator.translate(context, sourceTemplate);
    return translated.contains(QStringLiteral("%1"))
        ? translated.arg(value)
        : QString();
}

QString colorSettingsComboTranslation(
    CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    static const QString kPrefix = QStringLiteral("Automatic (");
    if (!source.startsWith(kPrefix) || !source.endsWith(QChar(')'))) {
        return QString();
    }

    const QString value =
        source.mid(kPrefix.size(), source.size() - kPrefix.size() - 1);
    if (value.isEmpty() || value != value.trimmed()
        || value.contains(QChar('\r')) || value.contains(QChar('\n'))) {
        return QString();
    }

    return translatedExactTemplate(
        translator,
        cavalry_i18n::kColorSettingsContext,
        cavalry_i18n::kColorSettingsAutomaticSource,
        value);
}

QString meshExplorerLabelTranslation(
    CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    const QString indexPrefix =
        QString::fromUtf8(cavalry_i18n::kMeshExplorerIndexPrefixSource);
    if (source.startsWith(indexPrefix)) {
        const QString value = source.mid(indexPrefix.size());
        if (!isCanonicalNonNegativeInteger(value)) {
            return QString();
        }
        const QString translatedPrefix = translator.translate(
            cavalry_i18n::kMeshExplorerContext,
            cavalry_i18n::kMeshExplorerIndexPrefixSource);
        return translatedPrefix.isEmpty()
            ? QString()
            : translatedPrefix + value;
    }

    const auto translateCount =
        [&translator, &source](
            const QString &prefix,
            const char *sourceTemplate) -> QString {
        if (!source.startsWith(prefix)) {
            return QString();
        }
        const QString value = source.mid(prefix.size());
        return isCanonicalNonNegativeInteger(value)
            ? translatedExactTemplate(
                  translator,
                  cavalry_i18n::kMeshExplorerContext,
                  sourceTemplate,
                  value)
            : QString();
    };

    QString translated = translateCount(
        QStringLiteral("Points: "),
        cavalry_i18n::kMeshExplorerPointsSource);
    if (!translated.isEmpty()) {
        return translated;
    }
    translated = translateCount(
        QStringLiteral("Verbs: "),
        cavalry_i18n::kMeshExplorerVerbsSource);
    if (!translated.isEmpty()) {
        return translated;
    }
    return translateCount(
        QStringLiteral("Child Meshes: "),
        cavalry_i18n::kMeshExplorerChildMeshesSource);
}

QString singleIndexPlaceholderTranslation(
    CavalryEmbeddedTranslator &translator,
    const QString &source)
{
    if (source
        != QString::fromUtf8(
            cavalry_i18n::kSingleIndexPlaceholderSource)) {
        return QString();
    }
    return translator.translate(
        cavalry_i18n::kSingleIndexContext,
        cavalry_i18n::kSingleIndexPlaceholderSource);
}

QString controlledDynamicTranslation(
    CavalryEmbeddedTranslator &translator,
    QObject *object,
    const QByteArray &property,
    const QString &source)
{
    if (property == QByteArrayLiteral("text")
        && qobject_cast<QLabel *>(object) != nullptr) {
        QString translated =
            cavalryI18nDynamicLabelTranslation(source, translator.language());
        if (!translated.isEmpty()) {
            return translated;
        }
        return hasAncestorClass(object, "MeshExplorerRowWidget")
            ? meshExplorerLabelTranslation(translator, source)
            : QString();
    }
    if (property.startsWith(QByteArrayLiteral("comboDisplay:"))
        && isColorSettingsCombo(translator, object)) {
        return colorSettingsComboTranslation(translator, source);
    }
    if (property == QByteArrayLiteral("plainTextPlaceholder")
        && qobject_cast<QPlainTextEdit *>(object) != nullptr
        && hasAncestorClass(object, "AttributeEditorWindow")) {
        return singleIndexPlaceholderTranslation(translator, source);
    }
    return QString();
}

} // namespace

CavalryDisplayTranslator::CavalryDisplayTranslator(
    CavalryEmbeddedTranslator &translator,
    QObject *parent)
    : QObject(parent)
    , translator_(translator)
{
}

void CavalryDisplayTranslator::translateAction(QAction *action)
{
    TranslationScope scope(translatingObjects_, action);
    if (!scope.entered()) {
        return;
    }

    hookAction(action);
    const QPointer<QAction> guardedAction(action);

    applyTranslation(
        action,
        QByteArrayLiteral("text"),
        action->text(),
        [guardedAction](const QString &value) {
            if (!guardedAction.isNull()) {
                guardedAction->setText(value);
            }
        });
    if (guardedAction.isNull()) {
        return;
    }

    applyTranslation(
        action,
        QByteArrayLiteral("iconText"),
        action->iconText(),
        [guardedAction](const QString &value) {
            if (!guardedAction.isNull()) {
                guardedAction->setIconText(value);
            }
        });
    if (guardedAction.isNull()) {
        return;
    }

    applyTranslation(
        action,
        QByteArrayLiteral("toolTip"),
        action->toolTip(),
        [guardedAction](const QString &value) {
            if (!guardedAction.isNull()) {
                guardedAction->setToolTip(value);
            }
        });
    if (guardedAction.isNull()) {
        return;
    }

    applyTranslation(
        action,
        QByteArrayLiteral("statusTip"),
        action->statusTip(),
        [guardedAction](const QString &value) {
            if (!guardedAction.isNull()) {
                guardedAction->setStatusTip(value);
            }
        });
    if (!guardedAction.isNull()) {
        translateMenu(guardedAction->menu());
    }
}

void CavalryDisplayTranslator::translateMenu(QMenu *menu)
{
    TranslationScope scope(translatingObjects_, menu);
    if (!scope.entered()) {
        return;
    }

    hookMenu(menu);
    const QPointer<QMenu> guardedMenu(menu);
    translateWidgetProperties(menu);
    if (guardedMenu.isNull()) {
        return;
    }

    applyTranslation(
        menu,
        QByteArrayLiteral("title"),
        menu->title(),
        [guardedMenu](const QString &value) {
            if (!guardedMenu.isNull()) {
                guardedMenu->setTitle(value);
            }
        });
    if (guardedMenu.isNull()) {
        return;
    }

    const QList<QAction *> rawActions = guardedMenu->actions();
    QList<QPointer<QAction>> actions;
    actions.reserve(rawActions.size());
    for (QAction *menuAction : rawActions) {
        actions.append(QPointer<QAction>(menuAction));
    }
    for (const QPointer<QAction> &menuAction : actions) {
        if (!menuAction.isNull()) {
            translateAction(menuAction.data());
        }
    }
}

void CavalryDisplayTranslator::translateWidget(QWidget *widget)
{
    if (auto *menu = qobject_cast<QMenu *>(widget)) {
        translateMenu(menu);
        return;
    }

    TranslationScope scope(translatingObjects_, widget);
    if (!scope.entered()) {
        return;
    }

    trackObject(widget);
    const QPointer<QWidget> guardedWidget(widget);
    translateWidgetProperties(widget);
    if (guardedWidget.isNull()) {
        return;
    }

    translateWidgetText(guardedWidget.data());
    if (!guardedWidget.isNull()) {
        translateWidgetActions(guardedWidget.data());
    }
}

void CavalryDisplayTranslator::translatePaintWidget(QWidget *widget)
{
    TranslationScope scope(translatingObjects_, widget);
    if (!scope.entered()) {
        return;
    }

    trackObject(widget);
    translateWidgetText(widget);
}

void CavalryDisplayTranslator::translateWidgetText(QWidget *widget)
{
    const QPointer<QWidget> guardedWidget(widget);
    if (auto *label = qobject_cast<QLabel *>(guardedWidget.data())) {
        const QPointer<QLabel> guardedLabel(label);
        applyTranslation(
            label,
            QByteArrayLiteral("text"),
            label->text(),
            [guardedLabel](const QString &value) {
                if (!guardedLabel.isNull()) {
                    guardedLabel->setText(value);
                }
            });
    } else if (
        auto *button = qobject_cast<QAbstractButton *>(guardedWidget.data())) {
        const QPointer<QAbstractButton> guardedButton(button);
        applyTranslation(
            button,
            QByteArrayLiteral("text"),
            button->text(),
            [guardedButton](const QString &value) {
                if (!guardedButton.isNull()) {
                    guardedButton->setText(value);
                }
            });
    } else if (
        auto *groupBox = qobject_cast<QGroupBox *>(guardedWidget.data())) {
        const QPointer<QGroupBox> guardedGroupBox(groupBox);
        applyTranslation(
            groupBox,
            QByteArrayLiteral("title"),
            groupBox->title(),
            [guardedGroupBox](const QString &value) {
                if (!guardedGroupBox.isNull()) {
                    guardedGroupBox->setTitle(value);
                }
            });
    } else if (
        auto *lineEdit = qobject_cast<QLineEdit *>(guardedWidget.data())) {
        hookLineEdit(lineEdit);
        translateLineEditDisplay(lineEdit);
    } else if (
        auto *plainTextEdit =
            qobject_cast<QPlainTextEdit *>(guardedWidget.data())) {
        translatePlainTextEditDisplay(plainTextEdit);
    } else if (
        auto *comboBox = qobject_cast<QComboBox *>(guardedWidget.data())) {
        translateComboBoxDisplay(comboBox);
    } else if (
        auto *treeWidget = qobject_cast<QTreeWidget *>(guardedWidget.data())) {
        hookTreeWidget(treeWidget);
        translateTreeWidgetDisplay(treeWidget);
    } else if (
        auto *tabBar = qobject_cast<QTabBar *>(guardedWidget.data())) {
        const QPointer<QTabBar> guardedTabBar(tabBar);
        const int tabCount = tabBar->count();
        for (int index = 0; index < tabCount; ++index) {
            if (guardedTabBar.isNull() || index >= guardedTabBar->count()) {
                break;
            }
            applyTranslation(
                tabBar,
                QByteArray("tabText:") + QByteArray::number(index),
                guardedTabBar->tabText(index),
                [guardedTabBar, index](const QString &value) {
                    if (!guardedTabBar.isNull()
                        && index < guardedTabBar->count()) {
                        guardedTabBar->setTabText(index, value);
                    }
            });
        }
    }
}

void CavalryDisplayTranslator::translateWidgetTree(QWidget *root)
{
    if (root == nullptr) {
        return;
    }

    QList<QPointer<QWidget>> widgets;
    widgets.append(QPointer<QWidget>(root));
    const QList<QWidget *> descendants = root->findChildren<QWidget *>();
    widgets.reserve(descendants.size() + 1);
    for (QWidget *descendant : descendants) {
        widgets.append(QPointer<QWidget>(descendant));
    }

    for (const QPointer<QWidget> &widget : widgets) {
        if (!widget.isNull()) {
            translateWidget(widget.data());
        }
    }
}

QString CavalryDisplayTranslator::translationFor(const QString &source) const
{
    if (source.isEmpty()) {
        return QString();
    }

    const auto lookup = [this](const QString &candidate) {
        const QByteArray utf8 = candidate.toUtf8();
        return translator_.translate(nullptr, utf8.constData());
    };
    const auto lookupNumericSuffix =
        [&lookup](const QString &candidate) -> QString {
        static const QRegularExpression kDotNumericSuffixPattern(
            QStringLiteral("^(.*?)(\\.[0-9]+)$"));
        static const QRegularExpression kSpaceNumericSuffixPattern(
            QStringLiteral("^(.*?)(\\s+[0-9]+)$"));

        QRegularExpressionMatch match =
            kDotNumericSuffixPattern.match(candidate);
        if (!match.hasMatch()) {
            match = kSpaceNumericSuffixPattern.match(candidate);
        }
        if (!match.hasMatch()) {
            return QString();
        }

        const QString baseSource = match.captured(1).trimmed();
        const QString baseTranslation = lookup(baseSource);
        if (baseTranslation.isEmpty() || baseTranslation == baseSource) {
            return QString();
        }
        return baseTranslation + match.captured(2);
    };

    QString translated = lookup(source);
    if (!translated.isEmpty()) {
        return translated;
    }

    if (source.contains(QChar('\n'))) {
        const QStringList lines =
            source.split(QChar('\n'), Qt::KeepEmptyParts);
        QStringList translatedLines;
        translatedLines.reserve(lines.size());
        int translatedLineCount = 0;
        for (const QString &line : lines) {
            const QString translatedLine = translationFor(line);
            if (!translatedLine.isEmpty() && translatedLine != line) {
                translatedLines.append(translatedLine);
                ++translatedLineCount;
            } else {
                translatedLines.append(line);
            }
        }
        if (translatedLineCount > 0) {
            return translatedLines.join(QChar('\n'));
        }
    }

    const QString normalized = normalizedDisplaySource(source);
    if (normalized.isEmpty()) {
        return QString();
    }

    if (normalized != source) {
        translated = lookup(normalized);
        if (!translated.isEmpty()) {
            return translated;
        }
    }

    if (normalized.endsWith(QChar(':'))) {
        const QString bareSource =
            normalized.left(normalized.size() - 1).trimmed();
        translated = lookup(bareSource);
        if (!translated.isEmpty()) {
            return translated + QChar(':');
        }
    }

    translated = lookupNumericSuffix(source);
    if (!translated.isEmpty()) {
        return translated;
    }
    if (normalized != source) {
        translated = lookupNumericSuffix(normalized);
        if (!translated.isEmpty()) {
            return translated;
        }
    }

    return QString();
}

void CavalryDisplayTranslator::applyTranslation(
    QObject *object,
    const QByteArray &property,
    const QString &current,
    const std::function<void(const QString &)> &setter)
{
    if (object == nullptr || current.isEmpty()) {
        return;
    }

    trackObject(object);
    const auto objectTranslations = lastTranslations_.constFind(object);
    if (objectTranslations != lastTranslations_.constEnd()) {
        const auto previous =
            objectTranslations.value().constFind(property);
        if (previous != objectTranslations.value().constEnd()
            && previous.value() == current) {
            return;
        }
    }

    QString translated = translationFor(current);
    if (translated.isEmpty()) {
        translated = controlledDynamicTranslation(
            translator_,
            object,
            property,
            current);
    }
    if (translated.isEmpty() || translated == current) {
        return;
    }

    // 先记录再调用 setter；同步 changed/event 回调会被对象级重入门挡住。
    lastTranslations_[object].insert(property, translated);
    setter(translated);
}

void CavalryDisplayTranslator::hookAction(QAction *action)
{
    if (action == nullptr || hookedActions_.contains(action)) {
        return;
    }

    trackObject(action);
    hookedActions_.insert(action);
    const QPointer<QAction> guardedAction(action);
    QObject::connect(
        action,
        &QAction::changed,
        this,
        [this, guardedAction]() {
            if (!guardedAction.isNull()) {
                translateAction(guardedAction.data());
            }
        });
}

void CavalryDisplayTranslator::hookLineEdit(QLineEdit *lineEdit)
{
    if (lineEdit == nullptr || hookedLineEdits_.contains(lineEdit)) {
        return;
    }

    trackObject(lineEdit);
    hookedLineEdits_.insert(lineEdit);
    const QPointer<QLineEdit> guardedLineEdit(lineEdit);
    QObject::connect(
        lineEdit,
        &QLineEdit::textChanged,
        this,
        [this, guardedLineEdit](const QString &) {
            if (!guardedLineEdit.isNull()) {
                translateLineEditDisplay(guardedLineEdit.data());
            }
        });
}

void CavalryDisplayTranslator::hookMenu(QMenu *menu)
{
    if (menu == nullptr || hookedMenus_.contains(menu)) {
        return;
    }

    trackObject(menu);
    hookedMenus_.insert(menu);
    const QPointer<QMenu> guardedMenu(menu);
    QObject::connect(
        menu,
        &QMenu::aboutToShow,
        this,
        [this, guardedMenu]() {
            if (!guardedMenu.isNull()) {
                translateMenu(guardedMenu.data());
            }
        });
}

void CavalryDisplayTranslator::hookTreeWidget(QTreeWidget *treeWidget)
{
    if (treeWidget == nullptr || hookedTreeWidgets_.contains(treeWidget)
        || treeWidget->model() == nullptr) {
        return;
    }

    trackObject(treeWidget);
    hookedTreeWidgets_.insert(treeWidget);
    const QPointer<QTreeWidget> guardedTreeWidget(treeWidget);
    const auto refreshTreeWidget = [this, guardedTreeWidget]() {
        if (!guardedTreeWidget.isNull()) {
            translateWidget(guardedTreeWidget.data());
        }
    };
    QAbstractItemModel *model = treeWidget->model();
    QObject::connect(
        model,
        &QAbstractItemModel::rowsInserted,
        this,
        [refreshTreeWidget](const QModelIndex &, int, int) {
            refreshTreeWidget();
        });
    QObject::connect(
        model,
        &QAbstractItemModel::modelReset,
        this,
        [refreshTreeWidget]() {
            refreshTreeWidget();
        });
    QObject::connect(
        model,
        &QAbstractItemModel::headerDataChanged,
        this,
        [refreshTreeWidget](Qt::Orientation, int, int) {
            refreshTreeWidget();
        });
    QObject::connect(
        model,
        &QAbstractItemModel::dataChanged,
        this,
        [refreshTreeWidget](
            const QModelIndex &,
            const QModelIndex &,
            const QList<int> &roles) {
            if (roles.isEmpty() || roles.contains(Qt::DisplayRole)
                || roles.contains(Qt::EditRole)) {
                refreshTreeWidget();
            }
        });
}

void CavalryDisplayTranslator::trackObject(QObject *object)
{
    if (object == nullptr || trackedObjects_.contains(object)) {
        return;
    }

    trackedObjects_.insert(object);
    QObject::connect(
        object,
        &QObject::destroyed,
        this,
        [this](QObject *destroyedObject) {
            lastTranslations_.remove(destroyedObject);
            trackedObjects_.remove(destroyedObject);
            hookedActions_.remove(destroyedObject);
            hookedLineEdits_.remove(destroyedObject);
            hookedMenus_.remove(destroyedObject);
            hookedTreeWidgets_.remove(destroyedObject);
            translatingObjects_.remove(destroyedObject);
        });
}

void CavalryDisplayTranslator::translateComboBoxDisplay(QComboBox *comboBox)
{
    if (comboBox == nullptr || comboBox->model() == nullptr) {
        return;
    }

    trackObject(comboBox);
    const QPointer<QComboBox> guardedComboBox(comboBox);
    const int itemCount = comboBox->count();
    const int modelColumn = comboBox->modelColumn();
    for (int index = 0; index < itemCount; ++index) {
        if (guardedComboBox.isNull()
            || guardedComboBox->model() == nullptr
            || index >= guardedComboBox->count()) {
            break;
        }

        QAbstractItemModel *model = guardedComboBox->model();
        const QModelIndex modelIndex = model->index(
            index,
            modelColumn,
            guardedComboBox->rootModelIndex());
        if (!modelIndex.isValid()) {
            continue;
        }

        const QVariant displayValue =
            model->data(modelIndex, Qt::DisplayRole);
        if (!displayValue.isValid()) {
            continue;
        }

        applyTranslation(
            comboBox,
            QByteArrayLiteral("comboDisplay:")
                + QByteArray::number(modelColumn)
                + QByteArrayLiteral(":")
                + QByteArray::number(index),
            displayValue.toString(),
            [guardedComboBox, index, modelColumn](const QString &value) {
                if (guardedComboBox.isNull()
                    || guardedComboBox->model() == nullptr
                    || index >= guardedComboBox->count()) {
                    return;
                }

                QAbstractItemModel *currentModel =
                    guardedComboBox->model();
                const QModelIndex currentIndex = currentModel->index(
                    index,
                    modelColumn,
                    guardedComboBox->rootModelIndex());
                if (currentIndex.isValid()) {
                    // 只写可见角色；UserRole、选中索引和业务模型身份保持原值。
                    currentModel->setData(
                        currentIndex,
                        value,
                        Qt::DisplayRole);
                }
            });
    }
}

void CavalryDisplayTranslator::translateLineEditDisplay(QLineEdit *lineEdit)
{
    if (lineEdit == nullptr) {
        return;
    }

    const QPointer<QLineEdit> guardedLineEdit(lineEdit);
    applyTranslation(
        lineEdit,
        QByteArrayLiteral("lineEditText"),
        lineEdit->text(),
        [guardedLineEdit](const QString &value) {
            if (!guardedLineEdit.isNull()) {
                // 已知词表值仅作显示投影，不能把回写信号送回 Cavalry 业务层。
                QSignalBlocker blocker(guardedLineEdit.data());
                guardedLineEdit->setText(value);
            }
        });
    if (guardedLineEdit.isNull()) {
        return;
    }

    applyTranslation(
        lineEdit,
        QByteArrayLiteral("placeholderText"),
        guardedLineEdit->placeholderText(),
        [guardedLineEdit](const QString &value) {
            if (!guardedLineEdit.isNull()) {
                guardedLineEdit->setPlaceholderText(value);
            }
        });
}

void CavalryDisplayTranslator::translatePlainTextEditDisplay(
    QPlainTextEdit *plainTextEdit)
{
    if (plainTextEdit == nullptr) {
        return;
    }

    const QPointer<QPlainTextEdit> guardedPlainTextEdit(plainTextEdit);
    applyTranslation(
        plainTextEdit,
        QByteArrayLiteral("plainTextPlaceholder"),
        plainTextEdit->placeholderText(),
        [guardedPlainTextEdit](const QString &value) {
            if (!guardedPlainTextEdit.isNull()) {
                guardedPlainTextEdit->setPlaceholderText(value);
            }
        });
}

void CavalryDisplayTranslator::translateTreeWidgetDisplay(
    QTreeWidget *treeWidget)
{
    if (treeWidget == nullptr) {
        return;
    }

    const QPointer<QTreeWidget> guardedTreeWidget(treeWidget);
    translateTreeWidgetItemDisplay(treeWidget->headerItem());
    if (guardedTreeWidget.isNull()) {
        return;
    }

    const int topLevelItemCount = guardedTreeWidget->topLevelItemCount();
    for (int index = 0; index < topLevelItemCount; ++index) {
        if (guardedTreeWidget.isNull()
            || index >= guardedTreeWidget->topLevelItemCount()) {
            break;
        }
        translateTreeWidgetItemDisplay(guardedTreeWidget->topLevelItem(index));
    }
}

void CavalryDisplayTranslator::translateTreeWidgetItemDisplay(
    QTreeWidgetItem *item)
{
    if (item == nullptr) {
        return;
    }

    const int columnCount = item->columnCount();
    for (int column = 0; column < columnCount; ++column) {
        const QVariant displayValue = item->data(column, Qt::DisplayRole);
        if (!displayValue.isValid()) {
            continue;
        }

        const QString current = displayValue.toString();
        const QString translated = translationFor(current);
        if (!translated.isEmpty() && translated != current) {
            // 树的业务身份可能藏在 UserRole；只改可见 DisplayRole。
            item->setData(column, Qt::DisplayRole, translated);
        }
    }

    const int childCount = item->childCount();
    for (int index = 0; index < childCount; ++index) {
        translateTreeWidgetItemDisplay(item->child(index));
    }
}

void CavalryDisplayTranslator::translateWidgetProperties(QWidget *widget)
{
    if (widget == nullptr) {
        return;
    }

    trackObject(widget);
    const QPointer<QWidget> guardedWidget(widget);
    applyTranslation(
        widget,
        QByteArrayLiteral("windowTitle"),
        widget->windowTitle(),
        [guardedWidget](const QString &value) {
            if (!guardedWidget.isNull()) {
                guardedWidget->setWindowTitle(value);
            }
        });
    if (guardedWidget.isNull()) {
        return;
    }

    applyTranslation(
        widget,
        QByteArrayLiteral("toolTip"),
        guardedWidget->toolTip(),
        [guardedWidget](const QString &value) {
            if (!guardedWidget.isNull()) {
                guardedWidget->setToolTip(value);
            }
        });
    if (guardedWidget.isNull()) {
        return;
    }

    applyTranslation(
        widget,
        QByteArrayLiteral("statusTip"),
        guardedWidget->statusTip(),
        [guardedWidget](const QString &value) {
            if (!guardedWidget.isNull()) {
                guardedWidget->setStatusTip(value);
            }
        });
}

void CavalryDisplayTranslator::translateWidgetActions(QWidget *widget)
{
    if (widget == nullptr) {
        return;
    }

    const QList<QAction *> rawActions = widget->actions();
    QList<QPointer<QAction>> actions;
    actions.reserve(rawActions.size());
    for (QAction *widgetAction : rawActions) {
        actions.append(QPointer<QAction>(widgetAction));
    }
    for (const QPointer<QAction> &widgetAction : actions) {
        if (!widgetAction.isNull()) {
            translateAction(widgetAction.data());
        }
    }
}
