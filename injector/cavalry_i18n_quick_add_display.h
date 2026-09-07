/**
 * [INPUT]: 依赖已验证的 Cavalry 2.7.2 macOS payload ABI、Qt 6.6.3 注册复制语义、原厂 delegate 与显示译文 provider
 * [OUTPUT]: 提供只在 exact FastQuickAdd model 绘制副本投影标题的 delegate；未知 model/payload 原始 index 透传，真实 query、命令角色和编辑路径保持原样
 * [POS]: injector 的 FastQuickAdd 显示适配边界；平台必须先证明 vendor fingerprint 与 source model 链，原 delegate 失效时回退 Qt 英文 delegate，未知版本/类型/布局原样回退，不由类型名推断 Windows 兼容
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QAbstractProxyModel>
#include <QtCore/QByteArray>
#include <QtCore/QCoreApplication>
#include <QtCore/QIdentityProxyModel>
#include <QtCore/QMetaObject>
#include <QtCore/QMetaType>
#include <QtCore/QPointer>
#include <QtCore/QVariant>
#include <QtWidgets/QAbstractItemDelegate>
#include <QtWidgets/QListView>
#include <QtWidgets/QStyledItemDelegate>

#include <functional>
#include <utility>

namespace cavalry_i18n {

using QuickAddDisplayProvider = std::function<QString(const QString &)>;

inline constexpr int kQuickAddDisplayIdentityRole = 256;
inline constexpr char kQuickAddDisplayModelClass[] =
    "cavalry::FastQuickAddModel";

inline bool hasExactFastQuickAddDisplaySource(const QAbstractItemModel *model)
{
    // 代理链来自固定 vendor view；有界遍历同时让异常循环 fail-closed，避免每次绘制分配集合。
    constexpr int kMaxSourceProxyDepth = 32;
    int depth = 0;
    for (const QAbstractItemModel *current = model;
         current != nullptr && depth < kMaxSourceProxyDepth;
         ++depth) {
        const QMetaObject *metaObject = current->metaObject();
        if (metaObject != nullptr
            && current->inherits(kQuickAddDisplayModelClass)
            && QByteArray(metaObject->className())
                == QByteArray(kQuickAddDisplayModelClass)) {
            return true;
        }

        const auto *proxy = qobject_cast<const QAbstractProxyModel *>(current);
        if (proxy == nullptr) {
            return false;
        }
        current = proxy->sourceModel();
    }
    return false;
}

// ---------------------------------------------------------------------------
// 只要 payload 未通过完整门，绘制也必须保留原始 index，不能仅依赖值回退。
// ---------------------------------------------------------------------------
inline bool isVerifiedQuickAddDisplayEnvironment(bool vendorContractVerified)
{
    return vendorContractVerified
        && QByteArray(qVersion()) == "6.6.3"
        && QCoreApplication::applicationVersion()
            == QStringLiteral("2.7.2");
}

inline bool isVerifiedQuickAddPaintPayload(
    const QVariant &source,
    const QString &expectedTitle,
    bool vendorContractVerified)
{
    if (!isVerifiedQuickAddDisplayEnvironment(vendorContractVerified)
        || !source.isValid()
        || source.constData() == nullptr
        || expectedTitle.isEmpty()) {
        return false;
    }

    const QMetaType type = source.metaType();
    const char *typeName = type.name();
    if (typeName == nullptr
        || QByteArray(typeName) != "cavalry::FastQuickAddItem"
        || type.sizeOf() != 0x80
        || type.alignOf() != 8) {
        return false;
    }

    constexpr qsizetype kTitleOffset = 0x30;
    const auto *title = reinterpret_cast<const QString *>(
        static_cast<const char *>(source.constData()) + kTitleOffset);
    return *title == expectedTitle;
}

// ---- 已证 macOS 2.7.2 ABI：registered copy/dtor 与 paint 的同一 QString ----
// +0x18 为命令，+0x30 为标题，+0x48 为 tags，+0x60 为说明。
// 只有标题可投影；结构本身始终由 vendor 注册的 QMetaType 构造与析构。
inline QVariant quickAddPaintValue(
    const QVariant &source, const QString &expectedTitle,
    const QString &translatedTitle, bool vendorContractVerified)
{
    if (!isVerifiedQuickAddPaintPayload(
            source,
            expectedTitle,
            vendorContractVerified)
        || translatedTitle.isEmpty()
        || translatedTitle == expectedTitle) {
        return source;
    }
    constexpr qsizetype kTitleOffset = 0x30;

    QVariant copy = source;
    // QVariant::data() 调用已审计的 registered copy；QString 赋值不改源共享存储。
    void *copyData = copy.data();
    if (copyData == nullptr) {
        return source;
    }
    auto *paintTitle = reinterpret_cast<QString *>(
        static_cast<char *>(copyData) + kTitleOffset);
    *paintTitle = translatedTitle;
    return copy;
}

class QuickAddPaintModel final : public QIdentityProxyModel {
public:
    QuickAddPaintModel(QuickAddDisplayProvider provider, bool verified, QObject *parent)
        : QIdentityProxyModel(parent), provider_(std::move(provider)), verified_(verified) {}

    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override
    {
        const QVariant value = QIdentityProxyModel::data(index, role);
        if (role != kQuickAddDisplayIdentityRole
            || !provider_
            || !hasExactFastQuickAddDisplaySource(sourceModel())) {
            return value;
        }
        const QString source = QIdentityProxyModel::data(index, Qt::DisplayRole).toString();
        return quickAddPaintValue(value, source, provider_(source), verified_);
    }

private:
    QuickAddDisplayProvider provider_;
    bool verified_;
};

class QuickAddDisplayDelegate final : public QAbstractItemDelegate {
public:
    QuickAddDisplayDelegate(QListView *view, QAbstractItemDelegate *original,
                            QuickAddDisplayProvider provider, bool verified)
        : QAbstractItemDelegate(view), view_(view), original_(original),
          paintModel_(std::move(provider), verified, this), verified_(verified)
    {
        paintModel_.setSourceModel(view->model());
        connect(original, &QAbstractItemDelegate::commitData,
                this, &QAbstractItemDelegate::commitData);
        connect(original, &QAbstractItemDelegate::closeEditor,
                this, &QAbstractItemDelegate::closeEditor);
        connect(original, &QAbstractItemDelegate::sizeHintChanged, this,
                [this](const QModelIndex &index) {
                    emit sizeHintChanged(index.model() == &paintModel_
                        ? paintModel_.mapToSource(index) : index);
                });
        connect(
            original,
            &QObject::destroyed,
            this,
            [this] {
                original_ = nullptr;
                restoreOriginalOrEnglish();
            },
            Qt::QueuedConnection);
    }

    void synchronizeModel(QAbstractItemModel *model)
    {
        if (paintModel_.sourceModel() != model) paintModel_.setSourceModel(model);
    }

    bool hasOriginalDelegate() const
    {
        return !original_.isNull();
    }

    void restoreOriginalOrEnglish()
    {
        QListView *view = view_.data();
        if (view == nullptr || view->itemDelegate() != this) {
            return;
        }
        if (original_ != nullptr) {
            // 原厂对象仍由 vendor 持有；这里只恢复 view 指针，不删除它。
            view->setItemDelegate(original_.data());
        } else {
            // 原厂对象已失效，Qt delegate 读取未改写的 DisplayRole，显示英文。
            view->setItemDelegate(new QStyledItemDelegate(view));
        }
        deleteLater();
    }

    void paint(QPainter *painter, const QStyleOptionViewItem &option,
               const QModelIndex &index) const override
    {
        if (original_) original_->paint(painter, option, paintIndex(index));
    }
    QSize sizeHint(const QStyleOptionViewItem &option, const QModelIndex &index) const override
    {
        return original_ ? original_->sizeHint(option, paintIndex(index)) : QSize();
    }

    // ---- 非绘制路径一律使用真实 index，不把显示副本送回业务消费者 --------
    QWidget *createEditor(QWidget *parent, const QStyleOptionViewItem &option,
                          const QModelIndex &index) const override
    { return original_ ? original_->createEditor(parent, option, index) : nullptr; }
    void destroyEditor(QWidget *editor, const QModelIndex &index) const override
    { if (original_) original_->destroyEditor(editor, index); }
    void setEditorData(QWidget *editor, const QModelIndex &index) const override
    { if (original_) original_->setEditorData(editor, index); }
    void setModelData(QWidget *editor, QAbstractItemModel *model,
                      const QModelIndex &index) const override
    { if (original_) original_->setModelData(editor, model, index); }
    void updateEditorGeometry(QWidget *editor, const QStyleOptionViewItem &option,
                              const QModelIndex &index) const override
    { if (original_) original_->updateEditorGeometry(editor, option, index); }
    bool editorEvent(QEvent *event, QAbstractItemModel *model,
                      const QStyleOptionViewItem &option, const QModelIndex &index) override
    { return original_ && original_->editorEvent(event, model, option, index); }
    bool helpEvent(QHelpEvent *event, QAbstractItemView *view,
                    const QStyleOptionViewItem &option, const QModelIndex &index) override
    { return original_ && original_->helpEvent(event, view, option, index); }
    bool eventFilter(QObject *object, QEvent *event) override
    { return original_ && original_->eventFilter(object, event); }
    QList<int> paintingRoles() const override
    { return original_ ? original_->paintingRoles() : QList<int>{}; }

private:
    QModelIndex paintIndex(const QModelIndex &index) const
    {
        if (view_ != nullptr
            && paintModel_.sourceModel() != view_->model()) {
            const_cast<QuickAddDisplayDelegate *>(this)->synchronizeModel(
                view_->model());
        }
        if (index.model() != paintModel_.sourceModel()
            || !hasExactFastQuickAddDisplaySource(paintModel_.sourceModel())
            || !isVerifiedQuickAddPaintPayload(
                index.data(kQuickAddDisplayIdentityRole),
                index.data(Qt::DisplayRole).toString(),
                verified_)) {
            return index;
        }
        return paintModel_.mapFromSource(index);
    }
    QPointer<QListView> view_;
    QPointer<QAbstractItemDelegate> original_;
    QuickAddPaintModel paintModel_;
    bool verified_;
};

inline void cleanupStaleQuickAddDisplayDelegates(
    QListView *view,
    QuickAddDisplayDelegate *keep)
{
    if (view == nullptr) {
        return;
    }
    for (QObject *child : view->children()) {
        auto *candidate = dynamic_cast<QuickAddDisplayDelegate *>(child);
        if (candidate != nullptr && candidate != keep) {
            candidate->deleteLater();
        }
    }
}

inline void attachQuickAddDisplay(QListView *view, QuickAddDisplayProvider provider,
                                 bool vendorContractVerified)
{
    if (!view) return;
    bool owned = false;
    for (QObject *p = view; p; p = p->parent()) {
        if (QByteArray(p->metaObject()->className()) == "cavalry::FastQuickAddWindow") {
            owned = true;
            break;
        }
    }
    auto *delegate = view->itemDelegate();
    if (auto *existing = dynamic_cast<QuickAddDisplayDelegate *>(delegate)) {
        if (!owned || !isVerifiedQuickAddDisplayEnvironment(vendorContractVerified)
            || !hasExactFastQuickAddDisplaySource(view->model())) {
            existing->restoreOriginalOrEnglish();
            cleanupStaleQuickAddDisplayDelegates(view, nullptr);
            return;
        }
        cleanupStaleQuickAddDisplayDelegates(view, existing);
        existing->synchronizeModel(view->model());
        if (!existing->hasOriginalDelegate()) {
            existing->restoreOriginalOrEnglish();
        }
        return;
    }
    cleanupStaleQuickAddDisplayDelegates(view, nullptr);
    if (!owned || !isVerifiedQuickAddDisplayEnvironment(vendorContractVerified)
        || !hasExactFastQuickAddDisplaySource(view->model())) {
        return;
    }
    if (!delegate || QByteArray(delegate->metaObject()->className()) !=
            "cavalry::FastQuickAddDelegate") return;
    view->setItemDelegate(new QuickAddDisplayDelegate(
        view, delegate, std::move(provider), vendorContractVerified));
}

} // namespace cavalry_i18n
