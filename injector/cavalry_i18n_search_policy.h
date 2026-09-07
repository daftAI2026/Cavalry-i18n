/**
 * [INPUT]: 依赖 cavalry_i18n_quick_add_context.h 的 exact owner/搜索框 guard、兼容 QT_NO_KEYWORDS 的 Qt 6 QIdentityProxyModel/QSortFilterProxyModel、FastQuickAddModel 的 role 0/256/257，以及注入方提供的当前语言别名查询函数
 * [OUTPUT]: 对外提供 FastQuickAdd role 257 别名投影、Unicode-safe 过滤代理、精确源模型身份证明与 vendor filter 整体替换时的幂等重挂接
 * [POS]: injector 的 Add Layer 双语搜索共享边界；过滤代理只作为已采证 vendor proxy 的 source，保留 vendor view/index/排序/回车链，不改查询字符串、DisplayRole 或 role 256 identity，也不参与字体控件策略
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QAbstractItemModel>
#include <QtCore/QAbstractProxyModel>
#include <QtCore/QByteArray>
#include <QtCore/QChar>
#include <QtCore/QIdentityProxyModel>
#include <QtCore/QMetaType>
#include <QtCore/QMetaObject>
#include <QtCore/QPointer>
#include <QtCore/QRegularExpression>
#include <QtCore/QSortFilterProxyModel>
#include <QtCore/QStringList>
#include <QtCore/QVariant>
#include <QtCore/QVector>
#include <QtWidgets/QAbstractItemView>
#include <QtWidgets/QLineEdit>
#include <functional>
#include <utility>

#include "cavalry_i18n_quick_add_context.h"

namespace cavalry_i18n {

inline constexpr int kFastQuickAddIdentityRole = 256;
inline constexpr int kFastQuickAddSearchRole = 257;
inline constexpr char kFastQuickAddModelClass[] =
    "cavalry::FastQuickAddModel";
inline constexpr char kFastQuickAddAttachmentName[] =
    "cavalry_i18n_fast_quick_add_alias_attachment";
inline constexpr char kFastQuickAddFilterProxyName[] =
    "cavalry_i18n_fast_quick_add_filter_proxy";

using FastQuickAddAliasProvider = std::function<QStringList(const QString &)>;
inline QVector<uint> fastQuickAddSearchCodePoints(
    const QString &value,
    bool removePunctuation)
{
    // 保留原厂 ASCII 清理语义；Unicode 字母、数字、符号和组合标记不被误清空。
    const QString normalized = value.toCaseFolded().normalized(
        QString::NormalizationForm_D);
    QVector<uint> codePoints;
    for (qsizetype offset = 0; offset < normalized.size();) {
        const QChar high = normalized.at(offset++);
        uint codePoint = high.unicode();
        if (high.isHighSurrogate() && offset < normalized.size()) {
            const QChar low = normalized.at(offset);
            if (low.isLowSurrogate()) {
                ++offset;
                codePoint = QChar::surrogateToUcs4(high, low);
            }
        }
        if (removePunctuation
            && (QChar::isSpace(codePoint) || QChar::isPunct(codePoint)
                || (codePoint < 0x80 && !QChar::isLetterOrNumber(codePoint)))) {
            continue;
        }
        codePoints.append(codePoint);
    }
    return codePoints;
}

inline bool matchesFastQuickAddSubsequence(
    const QString &query,
    const QString &candidate)
{
    const QVector<uint> queryCodePoints = fastQuickAddSearchCodePoints(
        query,
        true);
    if (queryCodePoints.isEmpty()) {
        return true;
    }

    const QVector<uint> candidateCodePoints = fastQuickAddSearchCodePoints(
        candidate,
        false);
    qsizetype queryIndex = 0;
    for (const uint codePoint : candidateCodePoints) {
        if (codePoint == queryCodePoints.at(queryIndex)) {
            ++queryIndex;
            if (queryIndex == queryCodePoints.size()) {
                return true;
            }
        }
    }
    return false;
}

inline bool isFastQuickAddSourceModel(const QAbstractItemModel *model)
{
    // vendor 的 concrete metaObject 是唯一 source 身份门；空模型也能在首次 Show 时挂接。
    return model != nullptr
        && model->inherits(kFastQuickAddModelClass)
        && QByteArray(model->metaObject()->className())
            == QByteArray(kFastQuickAddModelClass);
}

inline bool hasFastQuickAddPublicRoles(const QAbstractItemModel *model)
{
    if (!isFastQuickAddSourceModel(model)) {
        return false;
    }
    if (model->rowCount() <= 0) {
        return true;
    }

    const QModelIndex index = model->index(0, 0);
    if (!index.isValid()) {
        return false;
    }

    const QVariant identity =
        model->data(index, kFastQuickAddIdentityRole);
    const QVariant search = model->data(index, kFastQuickAddSearchRole);
    return identity.metaType().name() != nullptr
        && QByteArray(identity.metaType().name())
            == QByteArray("cavalry::FastQuickAddItem")
        && search.metaType().id() == QMetaType::QString;
}

inline QString projectFastQuickAddSearchText(
    const QString &source,
    const QStringList &aliases)
{
    QString projected = source;
    for (const QString &rawAlias : aliases) {
        const QString alias = rawAlias.trimmed();
        if (alias.isEmpty() || alias == source || projected.contains(alias)) {
            continue;
        }

        if (!projected.isEmpty()) {
            projected += QLatin1Char(' ');
        }
        projected += alias;
    }
    return projected;
}

class FastQuickAddAliasProxy final : public QIdentityProxyModel {
public:
    explicit FastQuickAddAliasProxy(
        FastQuickAddAliasProvider provider,
        QObject *parent = nullptr)
        : QIdentityProxyModel(parent)
        , provider_(std::move(provider))
    {
    }

    void setAliasProvider(FastQuickAddAliasProvider provider)
    {
        bool projectionChanged = false;
        if (sourceModel() != nullptr) {
            for (int row = 0; row < rowCount(); ++row) {
                const QModelIndex sourceIndex = sourceModel()->index(row, 0);
                const QString display = sourceModel()->data(
                    sourceIndex,
                    Qt::DisplayRole).toString();
                const QString search = sourceModel()->data(
                    sourceIndex,
                    kFastQuickAddSearchRole).toString();
                if (projectFastQuickAddSearchText(
                        search,
                        aliasesForSource(display, search, provider_))
                    != projectFastQuickAddSearchText(
                        search,
                        aliasesForSource(display, search, provider))) {
                    projectionChanged = true;
                    break;
                }
            }
        }
        provider_ = std::move(provider);
        if (!projectionChanged) {
            return;
        }

        // provider 是显示/查询投影，不写回 vendor model；显式通知过滤器重算 role 257。
        Q_EMIT dataChanged(
            index(0, 0),
            index(rowCount() - 1, qMax(0, columnCount() - 1)),
            {kFastQuickAddSearchRole});
    }

    QVariant data(
        const QModelIndex &index,
        int role = Qt::DisplayRole) const override
    {
        const QVariant sourceValue = QAbstractProxyModel::data(index, role);
        if (role != kFastQuickAddSearchRole
            || provider_ == nullptr
            || sourceValue.metaType().id() != QMetaType::QString) {
            return sourceValue;
        }

        return projectFastQuickAddSearchText(
            sourceValue.toString(),
            aliasesForIndex(index));
    }

    bool matchesSearch(
        const QModelIndex &index,
        const QString &query) const
    {
        const QString display = QAbstractProxyModel::data(
            index,
            Qt::DisplayRole).toString();
        const QString search = QAbstractProxyModel::data(
            index,
            kFastQuickAddSearchRole).toString();
        if (matchesFastQuickAddSubsequence(query, display)
            || matchesFastQuickAddSubsequence(query, search)) {
            return true;
        }
        for (const QString &alias : aliasesForIndex(index)) {
            if (matchesFastQuickAddSubsequence(query, alias)) {
                return true;
            }
        }
        return false;
    }

    bool setData(
        const QModelIndex &index,
        const QVariant &value,
        int role = Qt::EditRole) override
    {
        return QAbstractProxyModel::setData(index, value, role);
    }

    Qt::ItemFlags flags(const QModelIndex &index) const override
    {
        return QAbstractProxyModel::flags(index);
    }

private:
    static QStringList aliasesForSource(
        const QString &display,
        const QString &search,
        const FastQuickAddAliasProvider &provider)
    {
        if (provider == nullptr) {
            return {};
        }

        QStringList aliases = provider(display);
        if (search != display) {
            aliases.append(provider(search));
        }
        return aliases;
    }

    QStringList aliasesForIndex(const QModelIndex &index) const
    {
        const QString display = QAbstractProxyModel::data(
            index,
            Qt::DisplayRole).toString();
        const QString search = QAbstractProxyModel::data(
            index,
            kFastQuickAddSearchRole).toString();
        return aliasesForSource(display, search, provider_);
    }

    FastQuickAddAliasProvider provider_;
};

class FastQuickAddFilterProxy final : public QSortFilterProxyModel {
public:
    explicit FastQuickAddFilterProxy(QObject *parent = nullptr)
        : QSortFilterProxyModel(parent)
    {
        setObjectName(QString::fromLatin1(kFastQuickAddFilterProxyName));
        setFilterRole(kFastQuickAddSearchRole);
        setFilterCaseSensitivity(Qt::CaseInsensitive);
        // 排序必须留给 vendor FastQuickAddProxyModel；本层只负责 Unicode-safe 过滤。
        // 保持动态更新，使 alias provider 的 role 257 dataChanged 立即重算过滤。
        setDynamicSortFilter(true);
    }

    void setSearchText(const QString &text)
    {
        followOuterFilter_ = false;
        const QRegularExpression expression(
            QRegularExpression::escape(text),
            QRegularExpression::CaseInsensitiveOption);
        setSearchState(text, expression);
    }

    void setSearchRegularExpression(const QRegularExpression &expression)
    {
        setSearchState(expression.pattern(), expression);
    }

    void followVendorFilter()
    {
        followOuterFilter_ = true;
        syncOuterFilter();
    }

    QString searchText() const
    {
        syncOuterFilter();
        return searchText_;
    }

    QRegularExpression searchRegularExpression() const
    {
        syncOuterFilter();
        return searchExpression_;
    }

    int rowCount(const QModelIndex &parent = QModelIndex()) const override
    {
        syncOuterFilter();
        return QSortFilterProxyModel::rowCount(parent);
    }

    QVariant data(
        const QModelIndex &index,
        int role = Qt::DisplayRole) const override
    {
        syncOuterFilter();
        const QVariant value = QSortFilterProxyModel::data(index, role);
        if (role != kFastQuickAddSearchRole
            || value.metaType().id() != QMetaType::QString) {
            return value;
        }

        // 只给仍在 view 上的 vendor proxy 看过滤专用 role；DisplayRole、role 256、flags 与写回均透传。
        // 同时保留 outer 的 debounce 旧 query，避免用户输入变化到 vendor 定时器生效前短暂误拒新结果。
        QStringList queries;
        if (!searchText_.isEmpty()) {
            queries.append(searchText_);
        }
        const auto *outerFilter = outerVendorFilter();
        if (outerFilter != nullptr) {
            const QString outerQuery =
                outerFilter->filterRegularExpression().pattern();
            if (!outerQuery.isEmpty() && !queries.contains(outerQuery)) {
                queries.append(outerQuery);
            }
        }
        if (queries.isEmpty()) {
            return value;
        }
        return projectFastQuickAddSearchText(
            value.toString(),
            queries);
    }

protected:
    bool filterAcceptsRow(
        int sourceRow,
        const QModelIndex &sourceParent) const override
    {
        syncOuterFilter();
        if (searchText_.isEmpty()) {
            return true;
        }
        const QAbstractItemModel *model = sourceModel();
        if (model == nullptr || !searchExpression_.isValid()) {
            return false;
        }

        const QModelIndex index = model->index(sourceRow, 0, sourceParent);
        if (!index.isValid()) {
            return false;
        }

        // role 257 是别名索引，role 0 是 vendor 原始标题；两者都保留，避免 provider 漏译时英文退化。
        if (const auto *aliasModel =
                dynamic_cast<const FastQuickAddAliasProxy *>(model);
            aliasModel != nullptr) {
            return aliasModel->matchesSearch(index, searchText_);
        }
        const QString display = model->data(index, Qt::DisplayRole).toString();
        const QString search = model->data(index, kFastQuickAddSearchRole)
                                   .toString();
        return matchesFastQuickAddSubsequence(searchText_, display)
            || matchesFastQuickAddSubsequence(searchText_, search);
    }

private:
    const QSortFilterProxyModel *outerVendorFilter() const
    {
        return qobject_cast<const QSortFilterProxyModel *>(parent());
    }

    void syncOuterFilter() const
    {
        if (!followOuterFilter_ || syncingOuterFilter_) {
            return;
        }

        const auto *outerFilter = outerVendorFilter();
        if (outerFilter == nullptr) {
            return;
        }

        const QRegularExpression expression =
            outerFilter->filterRegularExpression();
        if (searchText_ == expression.pattern()
            && searchExpression_.pattern() == expression.pattern()
            && searchPatternOptions_ == expression.patternOptions()) {
            return;
        }

        auto *mutableThis = const_cast<FastQuickAddFilterProxy *>(this);
        mutableThis->syncingOuterFilter_ = true;
        mutableThis->setSearchState(expression.pattern(), expression);
        mutableThis->syncingOuterFilter_ = false;
    }

    void setSearchState(
        const QString &searchText,
        const QRegularExpression &expression)
    {
        if (searchText_ == searchText
            && searchExpression_.pattern() == expression.pattern()
            && searchPatternOptions_ == expression.patternOptions()) {
            return;
        }

        searchText_ = searchText;
        searchPatternOptions_ = expression.patternOptions();
        searchExpression_ = expression;
        invalidateFilter();
    }

    bool followOuterFilter_ = true;
    mutable bool syncingOuterFilter_ = false;
    QString searchText_;
    QRegularExpression::PatternOptions searchPatternOptions_;
    QRegularExpression searchExpression_;
};

class FastQuickAddAliasAttachment final : public QObject {
public:
    explicit FastQuickAddAliasAttachment(
        QAbstractItemView *view,
        QSortFilterProxyModel *filter,
        FastQuickAddAliasProvider provider)
        : QObject(view)
        , view_(view)
        , filter_(filter)
        , provider_(std::move(provider))
    {
        setObjectName(QString::fromLatin1(kFastQuickAddAttachmentName));
        connectSourceModelChanged();
    }

    FastQuickAddFilterProxy *ensureAttached()
    {
        if (view_ == nullptr || replacing_ || !selectCurrentFilter()
            || filter_ == nullptr) {
            return nullptr;
        }

        QAbstractItemModel *currentSource = filter_->sourceModel();
        auto *existingFilter = dynamic_cast<FastQuickAddFilterProxy *>(
            currentSource);
        if (existingFilter != nullptr) {
            if (existingFilter->parent() != filter_) {
                return nullptr;
            }
            searchProxy_ = existingFilter;
            auto *existingAlias = dynamic_cast<FastQuickAddAliasProxy *>(
                existingFilter->sourceModel());
            if (existingAlias != nullptr
                && existingAlias->parent() == filter_) {
                aliasProxy_ = existingAlias;
                vendorSource_ = existingAlias->sourceModel();
            }
            if (existingAlias == nullptr || existingAlias->parent() != filter_
                || !hasFastQuickAddPublicRoles(existingAlias->sourceModel())) {
                detachOwnedProxies();
                return nullptr;
            }
            aliasProxy_->setAliasProvider(provider_);
            if (searchBox_ != nullptr) {
                searchProxy_->setSearchText(searchBox_->text());
            } else {
                searchProxy_->setSearchRegularExpression(filter_->filterRegularExpression());
            }
            return searchProxy_;
        }

        FastQuickAddAliasProxy *oldAlias = aliasProxy_.data();
        vendorSource_ = currentSource;
        if (!hasFastQuickAddPublicRoles(currentSource)) {
            detachOwnedProxies();
            return nullptr;
        }

        auto *newAlias = new FastQuickAddAliasProxy(provider_, filter_);
        newAlias->setSourceModel(currentSource);
        aliasProxy_ = newAlias;

        // 先把 alias 放回 vendor proxy，再以本层 filter 作为 vendor source；两次 source signal 都被 guard。
        replacing_ = true;
        filter_->setSourceModel(newAlias);
        replacing_ = false;

        if (searchProxy_ != nullptr && searchProxy_->parent() != filter_) {
            // 不接管脱离本 attachment 的同名对象；让当前 vendor source 保持原状。
            searchProxy_ = nullptr;
        }
        if (searchProxy_ == nullptr) {
            searchProxy_ = new FastQuickAddFilterProxy(filter_);
        }
        searchProxy_->setSourceModel(aliasProxy_);
        searchProxy_->setSearchRegularExpression(
            filter_->filterRegularExpression());
        if (searchBox_ != nullptr) {
            searchProxy_->setSearchText(searchBox_->text());
        }

        if (filter_->sourceModel() != searchProxy_) {
            replacing_ = true;
            filter_->setSourceModel(searchProxy_);
            replacing_ = false;
        }

        // source replacement 后再释放旧 alias，避免 search proxy 留下悬空 source。
        if (oldAlias != nullptr && oldAlias != aliasProxy_.data()) {
            delete oldAlias;
        }
        return searchProxy_;
    }

    void setAliasProvider(FastQuickAddAliasProvider provider)
    {
        provider_ = std::move(provider);
        if (aliasProxy_ != nullptr) {
            aliasProxy_->setAliasProvider(provider_);
        }
    }

    bool bindSearchBox(QLineEdit *searchBox)
    {
        if (searchBox != nullptr
            && (!isQuickAddSearchBox(searchBox)
                || !hasExactFastQuickAddOwner(searchBox))) {
            return false;
        }

        if (searchBox_ == searchBox) {
            if (searchProxy_ != nullptr && searchBox_ != nullptr) {
                searchProxy_->setSearchText(searchBox_->text());
            }
            return true;
        }

        QObject::disconnect(searchTextChangedConnection_);
        QObject::disconnect(searchBoxDestroyedConnection_);
        searchBox_ = searchBox;
        if (searchProxy_ == nullptr || searchBox_ == nullptr) {
            if (searchProxy_ != nullptr) {
                searchProxy_->followVendorFilter();
            }
            return true;
        }

        searchProxy_->setSearchText(searchBox_->text());
        searchTextChangedConnection_ = QObject::connect(
            searchBox_,
            &QLineEdit::textChanged,
            this,
            [this](const QString &text) {
                if (searchProxy_ != nullptr) {
                    searchProxy_->setSearchText(text);
                }
            });
        searchBoxDestroyedConnection_ = QObject::connect(
            searchBox_,
            &QObject::destroyed,
            this,
            [this] {
                searchBox_ = nullptr;
                if (searchProxy_ != nullptr) {
                    searchProxy_->followVendorFilter();
                }
            });
        return true;
    }

    FastQuickAddFilterProxy *searchProxy() const
    {
        return searchProxy_.data();
    }

private:
    void connectSourceModelChanged()
    {
        if (filter_ == nullptr) {
            return;
        }

        // sourceModelChanged 可能仍在 vendor reset 信号栈内；排队重接线，避免重入破坏 Qt model 通知。
        sourceModelChangedConnection_ = QObject::connect(
            filter_.data(),
            &QAbstractProxyModel::sourceModelChanged,
            this,
            [this] { ensureAttached(); },
            Qt::QueuedConnection);
    }

    bool selectCurrentFilter()
    {
        if (view_ == nullptr) {
            return false;
        }

        auto *currentFilter = qobject_cast<QSortFilterProxyModel *>(
            view_->model());
        if (dynamic_cast<FastQuickAddFilterProxy *>(currentFilter) != nullptr) {
            // 本层 filter 不能再成为 vendor outer filter，避免形成自引用链。
            currentFilter = nullptr;
        }
        if (currentFilter == filter_.data()) {
            return currentFilter != nullptr;
        }

        QObject::disconnect(sourceModelChangedConnection_);
        sourceModelChangedConnection_ = QMetaObject::Connection();
        detachOwnedProxies();
        filter_ = currentFilter;
        vendorSource_ = nullptr;
        connectSourceModelChanged();
        return filter_ != nullptr;
    }

    void restoreVendorSourceIfWrapped()
    {
        if (filter_ == nullptr) {
            return;
        }

        QAbstractItemModel *currentSource = filter_->sourceModel();
        if (currentSource != searchProxy_.data()
            && currentSource != aliasProxy_.data()) {
            return;
        }

        QAbstractItemModel *vendorSource = vendorSource_.data();
        if (vendorSource == filter_.data()
            || vendorSource == searchProxy_.data()
            || vendorSource == aliasProxy_.data()) {
            vendorSource = nullptr;
        }
        replacing_ = true;
        filter_->setSourceModel(vendorSource);
        replacing_ = false;
    }

    void detachOwnedProxies()
    {
        restoreVendorSourceIfWrapped();

        QPointer<FastQuickAddFilterProxy> search = searchProxy_;
        QPointer<FastQuickAddAliasProxy> alias = aliasProxy_;
        searchProxy_ = nullptr;
        aliasProxy_ = nullptr;

        if (search != nullptr) {
            search->setSourceModel(nullptr);
            if (search->parent() == filter_) {
                delete search.data();
            }
        }
        if (alias != nullptr && alias->parent() == filter_) {
            delete alias.data();
        }
    }

    QPointer<QAbstractItemView> view_;
    QPointer<QSortFilterProxyModel> filter_;
    QPointer<QAbstractItemModel> vendorSource_;
    QPointer<FastQuickAddAliasProxy> aliasProxy_;
    QPointer<FastQuickAddFilterProxy> searchProxy_;
    QPointer<QLineEdit> searchBox_;
    FastQuickAddAliasProvider provider_;
    bool replacing_ = false;
    QMetaObject::Connection sourceModelChangedConnection_;
    QMetaObject::Connection searchTextChangedConnection_;
    QMetaObject::Connection searchBoxDestroyedConnection_;
};

inline FastQuickAddAliasAttachment *findFastQuickAddAttachment(
    QAbstractItemView *view)
{
    if (view == nullptr) {
        return nullptr;
    }

    for (QObject *child : view->children()) {
        if (child->objectName()
                != QString::fromLatin1(kFastQuickAddAttachmentName)) {
            continue;
        }
        if (auto *attachment =
                dynamic_cast<FastQuickAddAliasAttachment *>(child);
            attachment != nullptr) {
            return attachment;
        }
    }
    return nullptr;
}

inline FastQuickAddFilterProxy *attachFastQuickAddAliases(
    QAbstractItemView *view,
    FastQuickAddAliasProvider provider,
    QLineEdit *searchBox = nullptr)
{
    if (!isFastQuickAddView(view)
        || (searchBox != nullptr
            && (!isQuickAddSearchBox(searchBox)
                || !hasExactFastQuickAddOwner(searchBox)))) {
        return nullptr;
    }
    QLineEdit *effectiveSearchBox = searchBox;
    if (effectiveSearchBox == nullptr) {
        effectiveSearchBox = findFastQuickAddSearchBox(view);
    }

    if (auto *attachment = findFastQuickAddAttachment(view);
        attachment != nullptr) {
        attachment->setAliasProvider(std::move(provider));
        auto *search = attachment->ensureAttached();
        if (search != nullptr && effectiveSearchBox != nullptr) {
            attachment->bindSearchBox(effectiveSearchBox);
        }
        return search;
    }

    auto *filter = qobject_cast<QSortFilterProxyModel *>(view->model());
    if (filter == nullptr
        || !hasFastQuickAddPublicRoles(filter->sourceModel())) {
        return nullptr;
    }

    auto *attachment = new FastQuickAddAliasAttachment(
        view,
        filter,
        std::move(provider));
    auto *search = attachment->ensureAttached();
    if (search != nullptr && effectiveSearchBox != nullptr) {
        attachment->bindSearchBox(effectiveSearchBox);
    }
    return search;
}

inline FastQuickAddFilterProxy *findFastQuickAddSearchProxy(
    QAbstractItemView *view)
{
    auto *attachment = findFastQuickAddAttachment(view);
    return attachment == nullptr ? nullptr : attachment->searchProxy();
}

} // namespace cavalry_i18n
