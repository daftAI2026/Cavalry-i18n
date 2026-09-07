/**
 * [INPUT]: 依赖 check_quick_add_display.cpp 的注册 payload/model/delegate fixture 与真实 vendor 标签显示规则
 * [OUTPUT]: 验证 paint/sizeHint 标签投影、无标题译文时的独立标签翻译，以及源身份/分类与缺失译文回退
 * [POS]: Fast 显示合同的标签片段；只随主 fixture 编译，不把模拟容器当作 vendor ABI 证明
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

bool verifyPaintCategoryTags()
{
    cavalry::FastQuickAddWindow owner;
    cavalry::FastQuickAddModel model(&owner);
    auto sourceItem = makeItem(QStringLiteral("command-original"),
        QStringLiteral("Untranslated Title"), QStringLiteral("Original description"));
    sourceItem.tags = {"Shape", "Atomic", "Behaviour", "Deformer", "Beta",
        "Unknown category", "Shape", "", "very-long-unknown-category-keeps-owned-storage"};
    model.setItem(sourceItem);
    const auto index = model.index(0, 0);
    const std::vector<std::string> translatedTags = {
        "形状", "实用工具", "行为", "变形器", "实验",
        "Unknown category", "形状", "", "very-long-unknown-category-keeps-owned-storage"};
    const auto provider = [](const QString &source) {
        if (source == QStringLiteral("Shape")) return QString::fromUtf8("形状");
        if (source == QStringLiteral("Utility")) return QString::fromUtf8("实用工具");
        if (source == QStringLiteral("Behaviour")) return QString::fromUtf8("行为");
        if (source == QStringLiteral("Deformer")) return QString::fromUtf8("变形器");
        if (source == QStringLiteral("Experimental")) return QString::fromUtf8("实验");
        // 错误的内部 key 翻译不得替代原厂显示别名。
        if (source == QStringLiteral("Atomic")) return QStringLiteral("wrong-atomic");
        if (source == QStringLiteral("Beta")) return QStringLiteral("wrong-beta");
        return QString();
    };
    QListView view(&owner);
    view.setModel(&model);
    auto *original = new cavalry::FastQuickAddDelegate(&view);
    view.setItemDelegate(original);
    cavalry_i18n::attachQuickAddDisplay(&view, provider, true);
    QImage image(640, 120, QImage::Format_ARGB32);
    QPainter painter(&image);
    QStyleOptionViewItem option;
    option.rect = image.rect();
    view.itemDelegate()->paint(&painter, option, index);
    const auto painted = original->lastPaintIndex.data(256);
    const auto *paintItem = itemFromVariant(painted);
    expect(paintItem && paintItem->tags == translatedTags,
        QStringLiteral("paint translates categories even when the title has no translation"));
    view.itemDelegate()->sizeHint(option, index);
    const auto sized = original->lastSizeHintIndex.data(256);
    expect(itemFromVariant(sized) && itemFromVariant(sized)->tags == translatedTags,
        QStringLiteral("sizeHint receives the same translated category labels"));
    auto expected = sourceItem;
    expected.tags = translatedTags;
    expect(itemMatches(painted, expected),
        QStringLiteral("category projection changes no command/title/icon/description/flags"));
    expect(itemMatches(index.data(256), sourceItem),
        QStringLiteral("source category keys and identity remain untouched"));
    expect(original->lastPaintIndex.data() == index.data()
        && original->lastPaintIndex.data(257) == index.data(257),
        QStringLiteral("category display does not become a search or DisplayRole value"));

    cavalry_i18n::QuickAddPaintModel missing(
        [](const QString &) { return QString(); }, true, nullptr);
    missing.setSourceModel(&model);
    expect(itemMatches(missing.index(0, 0).data(256), sourceItem),
        QStringLiteral("missing translations preserve raw Atomic/Beta for vendor fallback"));
    cavalry_i18n::QuickAddPaintModel denied(provider, false, nullptr);
    denied.setSourceModel(&model);
    expect(itemMatches(denied.index(0, 0).data(256), sourceItem),
        QStringLiteral("unverified vendor never projects categories"));
    cavalry_i18n::QuickAddPaintModel unchanged(
        [](const QString &text) { return text; }, true, nullptr);
    unchanged.setSourceModel(&model);
    expect(itemMatches(unchanged.index(0, 0).data(256), sourceItem),
        QStringLiteral("identity provider preserves raw vendor aliases, not canonicalized keys"));
    cavalry_i18n::QuickAddPaintModel combined([provider](const QString &text) {
        return text == QStringLiteral("Untranslated Title") ? QString::fromUtf8("本地标题") : provider(text);
    }, true, nullptr);
    combined.setSourceModel(&model);
    expected.title = QString::fromUtf8("本地标题");
    expect(itemMatches(combined.index(0, 0).data(256), expected),
        QStringLiteral("title and categories share one copy without overwriting each other"));
    // ---- SSO 与大块堆存储边界：赋值、复制、销毁不污染源容器 --------
    for (const int length : {15, 16, 22, 23, 4097}) {
        sourceItem.tags = {std::string(size_t(length), 'x'), "Shape"};
        model.setItem(sourceItem);
        const QString replacement(length + 1, QChar(0x754c));
        cavalry_i18n::QuickAddPaintModel storage(
            [replacement](const QString &) { return replacement; }, true, nullptr);
        storage.setSourceModel(&model);
        const QVariant projected = storage.index(0, 0).data(256);
        const auto *item = itemFromVariant(projected);
        expect(item && item->tags == std::vector<std::string>(2, replacement.toUtf8().toStdString()),
            QStringLiteral("category projection owns SSO/heap storage across boundary %1").arg(length));
        expect(itemMatches(model.index(0, 0).data(256), sourceItem),
            QStringLiteral("SSO/heap assignment never mutates the registered source"));
    }
    sourceItem.tags.clear();
    model.setItem(sourceItem);
    expect(itemMatches(original->lastPaintIndex.data(256), sourceItem),
        QStringLiteral("empty category lists and model reset remain valid"));
    return failures == 0;
}
