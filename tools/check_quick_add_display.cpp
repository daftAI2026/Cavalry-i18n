/**
 * [INPUT]: 依赖 injector/cavalry_i18n_quick_add_display.h、Qt 6.6.3 Widgets、已证明布局的 FastQuickAddItem fixture 与 exact FastQuickAddDelegate fake
 * [OUTPUT]: 对外提供 vendor-free Quick Add 显示副本回归，验证 FastQuickAddModel、版本/type/layout/title fail-open、copy 字段隔离、未知 index/role、model replacement、delegate 生命周期与英文回退
 * [POS]: tools 的 Quick Add 显示 ABI 合同；fixture 只复现已读证的 Qt 类型尺寸与字段顺序，不把 fake 当作真实 vendor 证据，也不启动或修改真实 Cavalry
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "../injector/cavalry_i18n_quick_add_display.h"
#include <QtCore/QByteArray>
#include <QtCore/QAbstractListModel>
#include <QtCore/QMetaType>
#include <QtCore/QModelIndex>
#include <QtCore/QPointer>
#include <QtCore/QVariant>
#include <QtGui/QHelpEvent>
#include <QtGui/QImage>
#include <QtGui/QPainter>
#include <QtGui/QPixmap>
#include <QtWidgets/QApplication>
#include <QtWidgets/QListView>
#include <QtWidgets/QStyledItemDelegate>
#include <QtWidgets/QStyleOptionViewItem>
#include <QtWidgets/QWidget>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace cavalry {
// ---------------------------------------------------------------------------
// 仅复现主已读证的 Qt 6.6.3 payload 形状；它不是 vendor 类型声明或运行时输入。
// bad-size/bad-align 构建以同一 C++ 类型名制造独立进程的布局反例，
// 这样 size/alignment gate 能被单独验证，而不是被 qRegisterMetaType 别名掩盖。
// ---------------------------------------------------------------------------
#if defined(CAVALRY_QUICK_ADD_DISPLAY_BAD_SIZE)
struct alignas(8) FastQuickAddItem
{
    char bytes[1];
};
#elif defined(CAVALRY_QUICK_ADD_DISPLAY_BAD_ALIGN)
struct alignas(16) FastQuickAddItem
{
    char bytes[0x80];
};
#else
struct FastQuickAddItem
{
    QPixmap icon;
    QString identity;
    QString title;
    std::vector<std::string> tags;
    QString description;
    std::uint64_t flags = 0;
};
#endif
} // namespace cavalry

Q_DECLARE_METATYPE(cavalry::FastQuickAddItem)

namespace cavalry {
#if !defined(CAVALRY_QUICK_ADD_DISPLAY_BAD_SIZE) \
    && !defined(CAVALRY_QUICK_ADD_DISPLAY_BAD_ALIGN)
static_assert(sizeof(QPixmap) == 0x18 && alignof(QPixmap) == 8);
static_assert(sizeof(QString) == 0x18 && alignof(QString) == 8);
static_assert(sizeof(std::vector<std::string>) == 0x18 && alignof(std::vector<std::string>) == 8);
static_assert(sizeof(FastQuickAddItem) == 0x80 && alignof(FastQuickAddItem) == 8);

class FastQuickAddModel final : public QAbstractListModel
{
    Q_OBJECT
public:
    using QAbstractListModel::QAbstractListModel;
    int rowCount(const QModelIndex &parent = QModelIndex()) const override
    { return parent.isValid() || !hasItem_ ? 0 : 1; }
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override
    {
        if (!index.isValid() || index.row() != 0 || !hasItem_) return {};
        if (role == Qt::DisplayRole || role == Qt::EditRole) return item_.title;
        if (role == 256) return QVariant::fromValue(item_);
        if (role == 999) return QStringLiteral("opaque-fast-role");
        return {};
    }
    void setItem(const FastQuickAddItem &item)
    { beginResetModel(); item_ = item; hasItem_ = true; endResetModel(); }
private:
    FastQuickAddItem item_;
    bool hasItem_ = false;
};

class FastQuickAddDelegate final : public QStyledItemDelegate
{
    Q_OBJECT
public:
    using QStyledItemDelegate::QStyledItemDelegate;
    static QString fieldFromIndex(const QModelIndex &index, bool identity)
    {
        const QVariant value = index.data(256);
        if (value.metaType() != QMetaType::fromType<FastQuickAddItem>()) return {};
        const auto *item = static_cast<const FastQuickAddItem *>(
            value.constData());
        return item == nullptr ? QString() : (identity ? item->identity : item->title);
    }
    static QString titleFromIndex(const QModelIndex &index)
    { return fieldFromIndex(index, false); }
    static QString identityFromIndex(const QModelIndex &index)
    { return fieldFromIndex(index, true); }
    void paint(QPainter *painter, const QStyleOptionViewItem &option,
               const QModelIndex &index) const override
    {
        Q_UNUSED(painter); Q_UNUSED(option);
        ++paintCalls;
        lastPaintIndex = index;
        lastPaintTitle = titleFromIndex(index);
    }
    QSize sizeHint(const QStyleOptionViewItem &option,
                   const QModelIndex &index) const override
    {
        Q_UNUSED(option);
        ++sizeHintCalls;
        lastSizeHintIndex = index;
        lastSizeHintTitle = titleFromIndex(index);
        return QSize(100 + lastSizeHintTitle.size(), 24);
    }
    QWidget *createEditor(
        QWidget *parent,
        const QStyleOptionViewItem &option,
        const QModelIndex &index) const override
    {
        Q_UNUSED(parent);
        Q_UNUSED(option);
        remember(QStringLiteral("createEditor"), index);
        return nullptr;
    }
    void destroyEditor(QWidget *editor, const QModelIndex &index) const override
    {
        Q_UNUSED(editor);
        remember(QStringLiteral("destroyEditor"), index);
    }
    void setEditorData(QWidget *editor, const QModelIndex &index) const override
    {
        Q_UNUSED(editor);
        remember(QStringLiteral("setEditorData"), index);
    }
    void setModelData(
        QWidget *editor,
        QAbstractItemModel *model,
        const QModelIndex &index) const override
    {
        Q_UNUSED(editor);
        lastModel = model;
        remember(QStringLiteral("setModelData"), index);
    }
    void updateEditorGeometry(
        QWidget *editor,
        const QStyleOptionViewItem &option,
        const QModelIndex &index) const override
    {
        Q_UNUSED(editor);
        Q_UNUSED(option);
        remember(QStringLiteral("updateEditorGeometry"), index);
    }
    bool editorEvent(
        QEvent *event,
        QAbstractItemModel *model,
        const QStyleOptionViewItem &option,
        const QModelIndex &index) override
    {
        Q_UNUSED(event);
        Q_UNUSED(option);
        lastModel = model;
        remember(QStringLiteral("editorEvent"), index);
        return false;
    }
    bool helpEvent(
        QHelpEvent *event,
        QAbstractItemView *view,
        const QStyleOptionViewItem &option,
        const QModelIndex &index) override
    {
        Q_UNUSED(event);
        Q_UNUSED(option);
        lastView = view;
        remember(QStringLiteral("helpEvent"), index);
        return false;
    }
    bool eventFilter(QObject *object, QEvent *event) override
    {
        Q_UNUSED(event);
        lastFilterObject = object;
        lastPath = QStringLiteral("eventFilter");
        return false;
    }
    QList<int> paintingRoles() const override
    {
        ++paintingRolesCalls;
        return {256};
    }
    bool doCommand(const QModelIndex &index)
    {
        ++commandCalls;
        lastCommandIndex = index;
        lastCommandIdentity = identityFromIndex(index);
        return true;
    }
    void resetRecords() const
    {
        lastPath.clear();
        lastIndex = QModelIndex();
        lastModel = nullptr;
        lastView = nullptr;
        lastFilterObject = nullptr;
    }
    mutable int paintCalls = 0;
    mutable int sizeHintCalls = 0;
    mutable int paintingRolesCalls = 0;
    int commandCalls = 0;
    mutable QModelIndex lastPaintIndex;
    mutable QModelIndex lastSizeHintIndex;
    QModelIndex lastCommandIndex;
    mutable QModelIndex lastIndex;
    mutable QString lastPaintTitle;
    mutable QString lastSizeHintTitle;
    mutable QString lastPath;
    mutable QAbstractItemModel *lastModel = nullptr;
    mutable QAbstractItemView *lastView = nullptr;
    mutable QObject *lastFilterObject = nullptr;
    QString lastCommandIdentity;
private:
    void remember(const QString &path, const QModelIndex &index) const
    {
        lastPath = path;
        lastIndex = index;
    }
};

class FastQuickAddWindow final : public QWidget
{
    Q_OBJECT
public:
    using QWidget::QWidget;
};
#endif
} // namespace cavalry

namespace {
int failures = 0;
void expect(bool condition, const QString &message)
{
    if (condition) {
        return;
    }
    std::fprintf(stderr, "FAIL: %s\n", message.toUtf8().constData());
    ++failures;
}
#if !defined(CAVALRY_QUICK_ADD_DISPLAY_BAD_SIZE) \
    && !defined(CAVALRY_QUICK_ADD_DISPLAY_BAD_ALIGN)

cavalry::FastQuickAddItem makeItem(
    const QString &identity,
    const QString &title,
    const QString &description)
{
    cavalry::FastQuickAddItem item;
    item.icon = QPixmap(24, 24);
    item.identity = identity;
    item.title = title;
    item.tags = {"tag-one", "tag-two"};
    item.description = description;
    item.flags = 0x123456789abcdef0ULL;
    return item;
}
const cavalry::FastQuickAddItem *itemFromVariant(const QVariant &value)
{
    if (value.metaType() != QMetaType::fromType<cavalry::FastQuickAddItem>()) {
        return nullptr;
    }
    return static_cast<const cavalry::FastQuickAddItem *>(value.constData());
}
bool itemMatches(
    const QVariant &value,
    const cavalry::FastQuickAddItem &expected)
{
    const auto *item = itemFromVariant(value);
    return item != nullptr
        && item->icon.cacheKey() == expected.icon.cacheKey()
        && item->identity == expected.identity
        && item->title == expected.title
        && item->tags == expected.tags
        && item->description == expected.description
        && item->flags == expected.flags;
}
void populateModel(
    cavalry::FastQuickAddModel &model,
    const QString &identity,
    const QString &title,
    const QString &description)
{
    model.setItem(makeItem(identity, title, description));
}
QVariant roleValue(const QAbstractItemModel &model, const QModelIndex &index)
{
    return model.data(index, 256);
}

bool verifyLayoutAndPositiveCopy()
{
    const cavalry::FastQuickAddItem originalItem = makeItem(
        QStringLiteral("identity-text"),
        QStringLiteral("Text"),
        QStringLiteral("Description Text"));
    const QVariant source = QVariant::fromValue(originalItem);
    const QString translatedTitle = QString::fromUtf8("文字");
    const auto offsetOf = [&originalItem](const auto *field) {
        return reinterpret_cast<const char *>(field)
            - reinterpret_cast<const char *>(&originalItem);
    };
    expect(
        source.metaType().name() != nullptr
            && QByteArray(source.metaType().name())
                == QByteArray("cavalry::FastQuickAddItem"),
        QStringLiteral("registered payload type name is exact"));
    expect(
        source.metaType().sizeOf() == 0x80
            && source.metaType().alignOf() == 8,
        QStringLiteral("registered payload size/alignment is exact"));
    expect(
        offsetOf(&originalItem.identity) == 0x18
            && offsetOf(&originalItem.title) == 0x30
            && offsetOf(&originalItem.tags) == 0x48
            && offsetOf(&originalItem.description) == 0x60
            && offsetOf(&originalItem.flags) == 0x78,
        QStringLiteral("payload fields keep the verified runtime offsets"));
    const QVariant painted = cavalry_i18n::quickAddPaintValue(
        source,
        originalItem.title,
        translatedTitle,
        true);
    cavalry::FastQuickAddItem expectedPainted = originalItem;
    expectedPainted.title = translatedTitle;
    expect(
        itemMatches(painted, expectedPainted),
        QStringLiteral("verified copy changes title only"));
    expect(
        itemMatches(source, originalItem),
        QStringLiteral("source identity/title/description/tags remain unchanged"));
    const QVariant disabled = cavalry_i18n::quickAddPaintValue(
        source,
        originalItem.title,
        translatedTitle,
        false);
    expect(
        itemMatches(disabled, originalItem),
        QStringLiteral("vendor gate false fails open"));
#ifdef Q_OS_WIN
    QCoreApplication::setApplicationVersion(QString());
    expect(itemMatches(cavalry_i18n::quickAddPaintValue(source, originalItem.title, translatedTitle, true), expectedPainted), QStringLiteral("Windows empty Qt app version uses verified binary contract"));
    expect(itemMatches(cavalry_i18n::quickAddPaintValue(source, originalItem.title, translatedTitle, false), originalItem), QStringLiteral("empty version never bypasses vendor gate"));
#endif
    QCoreApplication::setApplicationVersion(QStringLiteral("2.7.1"));
    const QVariant wrongVersion = cavalry_i18n::quickAddPaintValue(
        source,
        originalItem.title,
        translatedTitle,
        true);
    expect(
        itemMatches(wrongVersion, originalItem),
        QStringLiteral("version mismatch fails open"));
    QCoreApplication::setApplicationVersion(QStringLiteral("2.7.2"));
    const QVariant wrongType = cavalry_i18n::quickAddPaintValue(
        QVariant(QStringLiteral("Text")),
        QStringLiteral("Text"),
        translatedTitle,
        true);
    expect(
        wrongType.metaType() == QMetaType::fromType<QString>()
            && wrongType.toString() == QStringLiteral("Text"),
        QStringLiteral("type mismatch fails open"));
    const QVariant wrongTitle = cavalry_i18n::quickAddPaintValue(
        source,
        QStringLiteral("Different title"),
        translatedTitle,
        true);
    expect(
        itemMatches(wrongTitle, originalItem),
        QStringLiteral("title mismatch fails open"));
    const QVariant emptyTranslation = cavalry_i18n::quickAddPaintValue(
        source,
        originalItem.title,
        QString(),
        true);
    expect(
        itemMatches(emptyTranslation, originalItem),
        QStringLiteral("empty translation fails open"));
    const QVariant sameTranslation = cavalry_i18n::quickAddPaintValue(
        source,
        originalItem.title,
        originalItem.title,
        true);
    expect(
        itemMatches(sameTranslation, originalItem),
        QStringLiteral("same translation fails open"));
    return failures == 0;
}

bool verifyPaintModel()
{
    cavalry::FastQuickAddModel sourceModel;
    populateModel(
        sourceModel,
        QStringLiteral("identity-text"),
        QStringLiteral("Text"),
        QStringLiteral("Description Text"));
    const QModelIndex sourceIndex = sourceModel.index(0, 0);
    const QVariant sourceRole = roleValue(sourceModel, sourceIndex);
    const cavalry::FastQuickAddItem sourceItem = *itemFromVariant(sourceRole);
    cavalry_i18n::QuickAddPaintModel shadow(
        [](const QString &source) {
            return source == QStringLiteral("Text")
                ? QString::fromUtf8("文字")
                : QString();
        },
        true,
        nullptr);
    shadow.setSourceModel(&sourceModel);
    const QModelIndex shadowIndex = shadow.mapFromSource(sourceIndex);
    const QVariant shadowRole = shadow.data(shadowIndex, 256);
    const auto *shadowItem = itemFromVariant(shadowRole);
    expect(
        shadowIndex.isValid() && shadowIndex.model() == &shadow,
        QStringLiteral("shadow index belongs to shadow model"));
    expect(
        shadowItem != nullptr && shadowItem->title == QString::fromUtf8("文字")
            && shadowItem->identity == sourceItem.identity
            && shadowItem->tags == sourceItem.tags
            && shadowItem->description == sourceItem.description,
        QStringLiteral("shadow role changes title and preserves other fields"));
    expect(
        itemMatches(roleValue(sourceModel, sourceIndex), sourceItem),
        QStringLiteral("shadow model leaves source role untouched"));
    expect(
        shadow.data(shadowIndex, Qt::DisplayRole).toString()
            == QStringLiteral("Text"),
        QStringLiteral("shadow model leaves DisplayRole untouched"));
    expect(
        shadow.data(shadowIndex, 999) == sourceModel.data(sourceIndex, 999),
        QStringLiteral("unknown role passes through unchanged"));
    expect(
        !shadow.data(QModelIndex(), 256).isValid(),
        QStringLiteral("invalid index passes through unchanged"));
    return failures == 0;
}

int displayWrapperCount(const QListView &view)
{
    int count = 0;
    for (QObject *child : view.children()) {
        count += dynamic_cast<cavalry_i18n::QuickAddDisplayDelegate *>(child) != nullptr;
    }
    return count;
}
QImage renderDelegate(
    QAbstractItemDelegate *delegate,
    const QModelIndex &index,
    const QStyleOptionViewItem &option)
{
    QImage image(240, 64, QImage::Format_ARGB32);
    image.fill(Qt::transparent);
    QPainter painter(&image);
    delegate->paint(&painter, option, index);
    return image;
}
void expectForwarded(
    const cavalry::FastQuickAddDelegate &delegate,
    const QString &path,
    const QModelIndex &sourceIndex)
{
    expect(
        delegate.lastPath == path && delegate.lastIndex == sourceIndex,
        QStringLiteral("%1 receives original index").arg(path));
}
bool verifyDelegateAndModelLifecycle()
{
    cavalry::FastQuickAddWindow owner;
    cavalry::FastQuickAddModel sourceModel(&owner);
    populateModel(
        sourceModel,
        QStringLiteral("identity-text"),
        QStringLiteral("Text"),
        QStringLiteral("Description Text"));
    QListView view(&owner);
    view.setModel(&sourceModel);
    auto *original = new cavalry::FastQuickAddDelegate(&view);
    view.setItemDelegate(original);
    const QModelIndex sourceIndex = sourceModel.index(0, 0);
    const QVariant sourceRoleBefore = roleValue(sourceModel, sourceIndex);
    const cavalry::FastQuickAddItem sourceItem = *itemFromVariant(sourceRoleBefore);
    const auto provider = [](const QString &source) {
        if (source == QStringLiteral("Text")) {
            return QString::fromUtf8("文字");
        }
        if (source == QStringLiteral("Shape")) {
            return QString::fromUtf8("形状");
        }
        if (source == QStringLiteral("Box")) {
            return QString::fromUtf8("盒形");
        }
        return QString();
    };
    cavalry_i18n::attachQuickAddDisplay(&view, provider, false);
    expect(
        view.itemDelegate() == original,
        QStringLiteral("vendor gate false keeps original delegate"));
    cavalry_i18n::attachQuickAddDisplay(&view, provider, true);
    auto *wrapper = dynamic_cast<cavalry_i18n::QuickAddDisplayDelegate *>(
        view.itemDelegate());
    expect(wrapper != nullptr, QStringLiteral("verified exact delegate attaches"));
    if (wrapper == nullptr) {
        return false;
    }
    expect(displayWrapperCount(view) == 1, QStringLiteral("one display wrapper is attached"));
    cavalry_i18n::attachQuickAddDisplay(&view, provider, true);
    expect(displayWrapperCount(view) == 1, QStringLiteral("repeated attach does not accumulate wrappers"));
    QImage image(240, 64, QImage::Format_ARGB32);
    image.fill(Qt::transparent);
    QPainter painter(&image);
    QStyleOptionViewItem option;
    option.rect = QRect(0, 0, 240, 64);
    wrapper->paint(&painter, option, sourceIndex);
    expect(
        original->lastPaintTitle == QString::fromUtf8("文字")
            && original->lastPaintIndex.isValid()
            && original->lastPaintIndex.model() != &sourceModel
            && original->lastPaintIndex.row() == sourceIndex.row(),
        QStringLiteral("paint receives translated shadow index"));
    const QSize shadowSize = wrapper->sizeHint(option, sourceIndex);
    expect(
        shadowSize.width() == 100 + QString::fromUtf8("文字").size()
            && original->lastSizeHintTitle == QString::fromUtf8("文字")
            && original->lastSizeHintIndex.model() != &sourceModel,
        QStringLiteral("sizeHint receives translated shadow index"));
    cavalry::FastQuickAddModel foreignModel;
    populateModel(foreignModel, QStringLiteral("identity-foreign"),
                  QStringLiteral("Foreign"), QStringLiteral("Description Foreign"));
    const QModelIndex foreignIndex = foreignModel.index(0, 0);
    original->resetRecords();
    wrapper->paint(&painter, option, foreignIndex);
    expect(original->lastPaintIndex == foreignIndex
               && original->lastPaintTitle == QStringLiteral("Foreign"),
           QStringLiteral("foreign model index passes through without projection"));
    original->resetRecords();
    expect(wrapper->sizeHint(option, foreignIndex).width() == 100 + QStringLiteral("Foreign").size()
               && original->lastSizeHintIndex == foreignIndex, QStringLiteral("foreign model sizeHint passes through without projection"));
    original->resetRecords();
    wrapper->paint(&painter, option, QModelIndex());
    expect(!original->lastPaintIndex.isValid(),
           QStringLiteral("invalid paint index passes through without projection"));
    original->resetRecords();
    wrapper->createEditor(nullptr, option, sourceIndex);
    expectForwarded(*original, QStringLiteral("createEditor"), sourceIndex);
    original->resetRecords();
    wrapper->setEditorData(nullptr, sourceIndex);
    expectForwarded(*original, QStringLiteral("setEditorData"), sourceIndex);
    original->resetRecords();
    wrapper->setModelData(nullptr, &sourceModel, sourceIndex);
    expectForwarded(*original, QStringLiteral("setModelData"), sourceIndex);
    expect(original->lastModel == &sourceModel, QStringLiteral("setModelData keeps source model"));
    original->resetRecords();
    wrapper->updateEditorGeometry(nullptr, option, sourceIndex);
    expectForwarded(*original, QStringLiteral("updateEditorGeometry"), sourceIndex);
    original->resetRecords();
    wrapper->editorEvent(nullptr, &sourceModel, option, sourceIndex);
    expectForwarded(*original, QStringLiteral("editorEvent"), sourceIndex);
    expect(original->lastModel == &sourceModel, QStringLiteral("editorEvent keeps source model"));
    original->resetRecords();
    wrapper->helpEvent(nullptr, &view, option, sourceIndex);
    expectForwarded(*original, QStringLiteral("helpEvent"), sourceIndex);
    expect(original->lastView == &view, QStringLiteral("helpEvent keeps source view"));
    original->resetRecords();
    wrapper->eventFilter(&view, nullptr);
    expect(
        original->lastPath == QStringLiteral("eventFilter")
            && original->lastFilterObject == &view,
        QStringLiteral("eventFilter remains forwarded to original delegate"));
    expect(
        wrapper->paintingRoles() == QList<int>{256},
        QStringLiteral("paintingRoles remains original delegate contract"));
    bool commitForwarded = false;
    QWidget editor(&view);
    QObject signalSink;
    QObject::connect(
        wrapper,
        &QAbstractItemDelegate::commitData,
        &signalSink,
        [&commitForwarded, &editor](QWidget *value) {
            commitForwarded = value == &editor;
        });
    // QListView 自己也监听该信号；测试的是 wrapper 的桥接，不应把假 editor
    // 当成真实编辑器塞进 QAbstractItemView 的私有 editor 集合。
    QObject::disconnect(
        wrapper,
        SIGNAL(commitData(QWidget *)),
        &view,
        SLOT(commitData(QWidget *)));
    Q_EMIT original->commitData(&editor);
    expect(commitForwarded, QStringLiteral("commitData signal forwards"));
    QModelIndex sizeHintSignalIndex;
    QObject::connect(
        wrapper,
        &QAbstractItemDelegate::sizeHintChanged,
        &view,
        [&sizeHintSignalIndex](const QModelIndex &index) {
            sizeHintSignalIndex = index;
        });
    Q_EMIT original->sizeHintChanged(sourceIndex);
    expect(
        sizeHintSignalIndex == sourceIndex,
        QStringLiteral("sizeHintChanged exposes original index"));
    expect(original->doCommand(sourceIndex), QStringLiteral("original command succeeds"));
    expect(
        original->lastCommandIndex == sourceIndex
            && original->lastCommandIdentity == QStringLiteral("identity-text"),
        QStringLiteral("doCommand keeps original identity index"));
    expect(
        itemMatches(roleValue(sourceModel, sourceIndex), sourceItem),
        QStringLiteral("paint and command leave source payload untouched"));
    cavalry::FastQuickAddModel replacementModel(&owner);
    populateModel(
        replacementModel,
        QStringLiteral("identity-shape"),
        QStringLiteral("Shape"),
        QStringLiteral("Description Shape"));
    view.setModel(&replacementModel);
    const QModelIndex replacementIndex = replacementModel.index(0, 0);
    original->resetRecords();
    wrapper->paint(&painter, option, replacementIndex);
    expect(
        original->lastPaintTitle == QString::fromUtf8("形状")
            && original->lastPaintIndex.model() != &replacementModel,
        QStringLiteral("first paint after source replacement synchronizes shadow model"));
    cavalry_i18n::attachQuickAddDisplay(&view, provider, true);
    wrapper = dynamic_cast<cavalry_i18n::QuickAddDisplayDelegate *>(view.itemDelegate());
    expect(wrapper != nullptr && displayWrapperCount(view) == 1,
           QStringLiteral("source replacement keeps one wrapper"));
    populateModel(
        replacementModel,
        QStringLiteral("identity-box"),
        QStringLiteral("Box"),
        QStringLiteral("Description Box"));
    const QModelIndex resetIndex = replacementModel.index(0, 0);
    wrapper->paint(&painter, option, resetIndex);
    expect(
        original->lastPaintTitle == QString::fromUtf8("盒形"),
        QStringLiteral("model reset remains visible through shadow model"));
    QPointer<QWidget> ownerGuard(&owner);
    QPointer<QAbstractItemDelegate> originalGuard(original);
    QPointer<QAbstractItemDelegate> wrapperGuard(wrapper);
    // owner 是栈对象，下面只记录 QObject parent 链，不提前销毁它。
    expect(
        ownerGuard == &owner && originalGuard != nullptr
            && wrapperGuard != nullptr,
        QStringLiteral("delegate lifetime guards are live before owner teardown"));
    // -----------------------------------------------------------------------
    // 另一个 owner 不得借 exact delegate 身份越过 FastQuickAdd owner gate。
    // -----------------------------------------------------------------------
    QWidget unrelatedOwner;
    QListView unrelatedView(&unrelatedOwner);
    cavalry::FastQuickAddModel unrelatedModel(&unrelatedOwner);
    populateModel(
        unrelatedModel,
        QStringLiteral("identity-other"),
        QStringLiteral("Text"),
        QStringLiteral("Description Other"));
    unrelatedView.setModel(&unrelatedModel);
    auto *unrelatedDelegate = new cavalry::FastQuickAddDelegate(&unrelatedView);
    unrelatedView.setItemDelegate(unrelatedDelegate);
    cavalry_i18n::attachQuickAddDisplay(&unrelatedView, provider, true);
    expect(
        unrelatedView.itemDelegate() == unrelatedDelegate,
        QStringLiteral("unrelated owner fails closed"));
    return failures == 0;
}
bool verifyOriginalDelegateTeardown()
{
    cavalry::FastQuickAddWindow owner;
    cavalry::FastQuickAddModel model(&owner);
    populateModel(model, QStringLiteral("identity-text"), QStringLiteral("Text"),
                  QStringLiteral("Description Text"));
    QListView view(&owner);
    view.setModel(&model);
    auto *original = new cavalry::FastQuickAddDelegate(&view);
    view.setItemDelegate(original);
    cavalry_i18n::attachQuickAddDisplay(
        &view, [](const QString &) { return QString::fromUtf8("文字"); }, true);
    QPointer<QAbstractItemDelegate> originalGuard(original);
    const QModelIndex index = model.index(0, 0);
    QStyleOptionViewItem option;
    option.rect = QRect(0, 0, 240, 64);
    QStyledItemDelegate english;
    const QImage expected = renderDelegate(&english, index, option);
    delete original;
    QCoreApplication::sendPostedEvents();
    QAbstractItemDelegate *active = view.itemDelegate();
    expect(originalGuard.isNull(), QStringLiteral("destroyed original is cleared safely"));
    expect(active != nullptr, QStringLiteral("live view keeps a delegate after original teardown"));
    const QImage actual = active == nullptr ? QImage() : renderDelegate(active, index, option);
    expect(actual == expected,
           QStringLiteral("original teardown keeps the English display visible"));
    expect(displayWrapperCount(view) <= 1,
           QStringLiteral("original teardown leaves no accumulated wrappers"));
    return failures == 0;
}
bool verifyHeapDelegateTeardown()
{
    QPointer<QWidget> ownerGuard;
    QPointer<QListView> viewGuard;
    QPointer<QAbstractItemDelegate> originalGuard;
    QPointer<QAbstractItemDelegate> wrapperGuard;
    {
        auto *owner = new cavalry::FastQuickAddWindow;
        auto *view = new QListView(owner);
        auto *model = new cavalry::FastQuickAddModel(view);
        populateModel(
            *model,
            QStringLiteral("identity-text"),
            QStringLiteral("Text"),
            QStringLiteral("Description Text"));
        view->setModel(model);
        auto *original = new cavalry::FastQuickAddDelegate(view);
        view->setItemDelegate(original);
        cavalry_i18n::attachQuickAddDisplay(
            view,
            [](const QString &) { return QString::fromUtf8("文字"); },
            true);
        ownerGuard = owner;
        viewGuard = view;
        originalGuard = original;
        wrapperGuard = view->itemDelegate();
        expect(wrapperGuard != nullptr, QStringLiteral("heap delegate wrapper attaches"));
        delete owner;
    }
    expect(ownerGuard.isNull(), QStringLiteral("owner teardown completes"));
    expect(viewGuard.isNull(), QStringLiteral("view teardown completes"));
    expect(originalGuard.isNull(), QStringLiteral("original delegate follows view lifetime"));
    expect(wrapperGuard.isNull(), QStringLiteral("wrapper delegate follows view lifetime"));
    return failures == 0;
}
int runNormal()
{
    verifyLayoutAndPositiveCopy();
    verifyPaintModel();
    verifyDelegateAndModelLifecycle();
    verifyOriginalDelegateTeardown();
    verifyHeapDelegateTeardown();
    std::fprintf(stderr, "check_quick_add_display: %d failures\n", failures);
    return failures == 0 ? 0 : 1;
}
#else
int runBadLayout(const char *label)
{
    cavalry::FastQuickAddItem value{};
    std::memset(value.bytes, 0x5a, sizeof(value.bytes));
    const QVariant source = QVariant::fromValue(value);
    expect(source.metaType().name() != nullptr
               && QByteArray(source.metaType().name()) == QByteArray("cavalry::FastQuickAddItem"),
           QString::fromLatin1(label) + QStringLiteral(" keeps exact test type name"));
    expect(
        source.metaType().sizeOf() == sizeof(cavalry::FastQuickAddItem)
            && source.metaType().alignOf() == alignof(cavalry::FastQuickAddItem),
        QString::fromLatin1(label) + QStringLiteral(" exposes the intended bad layout"));
    const QVariant result = cavalry_i18n::quickAddPaintValue(
        source,
        QStringLiteral("Text"),
        QString::fromUtf8("文字"),
        true);
    expect(
        result.metaType() == source.metaType()
            && std::memcmp(result.constData(), source.constData(), sizeof(value.bytes))
                == 0,
        QString::fromLatin1(label) + QStringLiteral(" mismatch fails open"));
    std::fprintf(stderr, "check_quick_add_display %s: %s\n", label,
                 failures == 0 ? "PASS" : "FAIL");
    return failures == 0 ? 0 : 1;
}
#endif
} // namespace
int main(int argc, char **argv)
{
    QApplication application(argc, argv);
    application.setQuitOnLastWindowClosed(false);
    QCoreApplication::setApplicationVersion(QStringLiteral("2.7.2"));
#if defined(CAVALRY_QUICK_ADD_DISPLAY_BAD_SIZE)
    return runBadLayout("bad-size");
#elif defined(CAVALRY_QUICK_ADD_DISPLAY_BAD_ALIGN)
    return runBadLayout("bad-align");
#else
    return runNormal();
#endif
}
#include "check_quick_add_display.moc"
