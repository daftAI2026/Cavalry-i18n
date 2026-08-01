/**
 * [INPUT]: 依赖 Implementation 的双 fixture/stem、assets::Window/SimpleTreeWidget 拓扑、真实 Drop/ContextMenu 与当前语言 oracle
 * [OUTPUT]: 在 Implementation 类内提供 Assets 双 stem 导入、动态 row 重解析、ContextMenu 精确 Replace/Create 验证与逻辑观察推进
 * [POS]: Windows adjacent acceptance 的 Assets producer 分片；以真实 Drop 与 posted ContextMenu 事件、可观察后置条件证明 owner/动态模板，不使用坐标或盲键
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
    void traceAssetStage(const QString &stage)
    {
        if (acceptanceDirectory_.isEmpty()
            || stemIndex_ < 0 || stemIndex_ >= stems_.size()) {
            return;
        }
        writeExclusive(
            QDir(acceptanceDirectory_).filePath(
                QStringLiteral("trace-%1-%2.json")
                    .arg(stemIndex_ + 1)
                    .arg(stage)),
            QJsonObject {
                {
                    QStringLiteral("schema"),
                    QStringLiteral(
                        "cavalry-i18n.windows-adjacent.trace/v1")
                },
                {QStringLiteral("stem"), stems_.at(stemIndex_)},
                {QStringLiteral("stage"), stage},
                {
                    QStringLiteral("pid"),
                    static_cast<double>(
                        QCoreApplication::applicationPid())
                },
            });
    }

    void pollAssetsTopology()
    {
        if (terminal_) {
            return;
        }
        QList<QWidget *> assetsHits;
        for (QWidget *widget : QApplication::allWidgets()) {
            if (widget != nullptr
                && className(widget) == QStringLiteral("assets::Window")
                && widget->isVisible()) {
                assetsHits.append(widget);
            }
        }
        if (assetsHits.size() > 1) {
            fail(QStringLiteral("assets::Window identity is ambiguous"));
            return;
        }
        if (assetsHits.isEmpty()) {
            retry(QStringLiteral("assets::Window"), [this]() {
                pollAssetsTopology();
            });
            return;
        }
        QList<QWidget *> treeHits;
        for (QWidget *widget :
             assetsHits.front()->findChildren<QWidget *>()) {
            if (className(widget) == QStringLiteral("SimpleTreeWidget")
                && widget->isVisibleTo(assetsHits.front())
                && widget->isEnabled()) {
                treeHits.append(widget);
            }
        }
        if (treeHits.size() > 1) {
            fail(QStringLiteral("SimpleTreeWidget identity is ambiguous"));
            return;
        }
        if (treeHits.isEmpty()) {
            retry(QStringLiteral("SimpleTreeWidget"), [this]() {
                pollAssetsTopology();
            });
            return;
        }
        QWidget *dropTarget = treeHits.front();
        if (auto *view =
                qobject_cast<QAbstractItemView *>(treeHits.front())) {
            if (view->viewport() != nullptr) {
                dropTarget = view->viewport();
            }
        }
        if (!dropTarget->isVisibleTo(assetsHits.front())
            || !dropTarget->isEnabled()
            || !dropTarget->acceptDrops()
            || !ancestorHasClass(
                dropTarget,
                QStringLiteral("assets::Window"))) {
            fail(QStringLiteral(
                "Assets drop target is not visible/enabled/drop-enabled"));
            return;
        }
        assetsWindow_ = assetsHits.front();
        treeWidget_ = treeHits.front();
        dropTarget_ = dropTarget;
        topologyAttempts_ = 0;
        runCurrentStem();
    }

    QList<ExactAssetRow> exactVisibleRows(
        const QString &stem,
        bool *ambiguous) const
    {
        QList<ExactAssetRow> rows;
        int exactNameWidgets = 0;
        *ambiguous = false;
        if (assetsWindow_ == nullptr) {
            *ambiguous = true;
            return rows;
        }
        for (QLineEdit *name :
             assetsWindow_->findChildren<QLineEdit *>()) {
            if (className(name) != QStringLiteral("EditableNodeName")
                || !name->isVisibleTo(assetsWindow_)
                || name->text() != stem) {
                continue;
            }
            ++exactNameWidgets;
            QWidget *row = nullptr;
            for (QWidget *cursor = name->parentWidget();
                 cursor != nullptr && cursor != assetsWindow_;
                 cursor = cursor->parentWidget()) {
                if (className(cursor)
                    == QStringLiteral("SimpleRowWidget")) {
                    row = cursor;
                    break;
                }
            }
            if (row == nullptr
                || !row->isVisibleTo(assetsWindow_)
                || row->width() < 1 || row->height() < 1) {
                *ambiguous = true;
                continue;
            }
            bool duplicate = false;
            for (const ExactAssetRow &existing : rows) {
                if (existing.row == row) {
                    duplicate = true;
                    break;
                }
            }
            if (duplicate) {
                *ambiguous = true;
                continue;
            }
            rows.append(ExactAssetRow {row, name});
        }
        if (exactNameWidgets != rows.size()) {
            *ambiguous = true;
        }
        return rows;
    }

    bool verifyAssetsOwnerExternalEnglish(const QString &stem)
    {
        QMenu unrelated;
        unrelated.setObjectName(
            QStringLiteral("CavalryI18nAdjacentOwnerExternalMenu"));
        QAction *replace =
            unrelated.addAction(QStringLiteral("Replace..."));
        QAction *create = unrelated.addAction(
            QStringLiteral("Create Composition based on %1").arg(stem));
        unrelated.move(-10000, -10000);
        unrelated.show();
        const bool unchanged =
            unrelated.isVisible()
            && actionIsPaintedBy(replace, &unrelated)
            && actionIsPaintedBy(create, &unrelated)
            && replace->text() == QStringLiteral("Replace...")
            && create->text()
                == QStringLiteral(
                    "Create Composition based on %1").arg(stem);
        unrelated.close();
        if (!unchanged) {
            fail(
                QStringLiteral(
                    "Assets owner-external QAction changed stem=%1")
                    .arg(stem));
        }
        return unchanged;
    }

    void runCurrentStem()
    {
        if (terminal_) {
            return;
        }
        if (stemIndex_ >= stems_.size()) {
            finishSuccess();
            return;
        }
        if (assetsWindow_ == nullptr
            || treeWidget_ == nullptr
            || dropTarget_ == nullptr
            || !assetsWindow_->isVisible()
            || !treeWidget_->isVisibleTo(assetsWindow_)
            || !dropTarget_->isVisibleTo(assetsWindow_)
            || !dropTarget_->acceptDrops()) {
            assetsWindow_.clear();
            treeWidget_.clear();
            dropTarget_.clear();
            topologyAttempts_ = 0;
            pollAssetsTopology();
            return;
        }
        const QString stem = stems_.at(stemIndex_);
        if (!verifyAssetsOwnerExternalEnglish(stem)) {
            return;
        }
        bool ambiguous = false;
        const QList<ExactAssetRow> before =
            exactVisibleRows(stem, &ambiguous);
        if (ambiguous || !before.isEmpty()) {
            fail(
                QStringLiteral(
                    "fixture row must be uniquely absent before drop "
                    "stem=%1 count=%2")
                    .arg(stem)
                    .arg(before.size()));
            return;
        }
        beforeRowCount_ = before.size();
        QMimeData mime;
        mime.setUrls(
            {QUrl::fromLocalFile(fixtures_.at(stemIndex_))});
        const QPoint position = dropTarget_->rect().center();
        QDragEnterEvent dragEnter(
            position,
            Qt::CopyAction,
            &mime,
            Qt::LeftButton,
            Qt::NoModifier);
        const bool dragDelivered =
            QApplication::sendEvent(dropTarget_, &dragEnter);
        QDropEvent drop(
            QPointF(position),
            Qt::CopyAction,
            &mime,
            Qt::LeftButton,
            Qt::NoModifier);
        const bool dropDelivered =
            QApplication::sendEvent(dropTarget_, &drop);
        if (!dragDelivered || !dragEnter.isAccepted()
            || !dropDelivered || !drop.isAccepted()) {
            fail(
                QStringLiteral(
                    "real Assets drop was not delivered+accepted stem=%1")
                    .arg(stem));
            return;
        }
        rowAttempts_ = 0;
        traceAssetStage(QStringLiteral("drop-accepted"));
        schedule(50, [this]() {
            pollImportedRow();
        });
    }

    void pollImportedRow()
    {
        if (terminal_) {
            return;
        }
        const QString stem = stems_.at(stemIndex_);
        bool ambiguous = false;
        const QList<ExactAssetRow> rows =
            exactVisibleRows(stem, &ambiguous);
        if (ambiguous || rows.size() > beforeRowCount_ + 1) {
            fail(
                QStringLiteral(
                    "imported Assets row is ambiguous stem=%1 count=%2")
                    .arg(stem)
                    .arg(rows.size()));
            return;
        }
        if (rows.size() != beforeRowCount_ + 1) {
            if (++rowAttempts_ > kRowAttempts) {
                fail(
                    QStringLiteral(
                        "Assets row delta is not +1 stem=%1 before=%2 "
                        "after=%3")
                        .arg(stem)
                        .arg(beforeRowCount_)
                        .arg(rows.size()));
                return;
            }
            schedule(100, [this]() {
                pollImportedRow();
            });
            return;
        }
        selectedRow_ = rows.front().row;
        selectedName_ = rows.front().name;
        traceAssetStage(QStringLiteral("row-resolved"));
        dispatchWidgetClick(selectedRow_);
        // ContextMenu 采用 postEvent，状态 timer 发起后会先返回；
        // 后续菜单嵌套循环可继续接收同一 timer 的观察与截图 ACK。
        schedule(50, [this]() {
            dispatchRealContextMenu();
        });
    }

    void dispatchRealContextMenu()
    {
        traceAssetStage(QStringLiteral("context-dispatch-enter"));
        if (terminal_ || dropTarget_ == nullptr
            || assetsWindow_ == nullptr) {
            fail(QStringLiteral(
                "Assets producer vanished before ContextMenu"));
            return;
        }
        const QString stem = stems_.at(stemIndex_);
        if (selectedName_ == nullptr
            || selectedName_->text() != stem
            || !selectedName_->isVisibleTo(assetsWindow_)) {
            bool ambiguous = false;
            const QList<ExactAssetRow> rows =
                exactVisibleRows(stem, &ambiguous);
            if (ambiguous || rows.size() != beforeRowCount_ + 1
                || rows.size() != 1) {
                fail(
                    QStringLiteral(
                        "selected asset row could not be re-resolved "
                        "before ContextMenu stem=%1 count=%2")
                        .arg(stem)
                        .arg(rows.size()));
                return;
            }
            selectedRow_ = rows.front().row;
            selectedName_ = rows.front().name;
            dispatchWidgetClick(selectedRow_);
        }
        if (selectedName_->text() != stem
            || !selectedName_->isVisibleTo(assetsWindow_)
            || !ancestorHasClass(
                dropTarget_,
                QStringLiteral("assets::Window"))) {
            fail(
                QStringLiteral(
                    "selected exact Assets row drifted stem=%1")
                    .arg(stem));
            return;
        }
        menuAttempts_ = 0;
        menuValidated_ = false;
        contextPosted_ = false;
        contextDelivered_ = false;
        contextAccepted_ = false;
        schedule(0, [this]() {
            inspectPositiveMenu();
        });
        const QPoint global =
            selectedName_->mapToGlobal(selectedName_->rect().center());
        const QPoint local = dropTarget_->mapFromGlobal(global);
        contextPosted_ = true;
        QCoreApplication::postEvent(
            dropTarget_,
            new QContextMenuEvent(
                QContextMenuEvent::Mouse,
                local,
                global));
        traceAssetStage(QStringLiteral("context-posted"));
    }

    void inspectPositiveMenu()
    {
        if (terminal_ || menuValidated_) {
            return;
        }
        if (menuAttempts_ == 0) {
            traceAssetStage(QStringLiteral("menu-inspect-enter"));
        }
        const QString stem = stems_.at(stemIndex_);
        const QString wantedReplace =
            oracle(language_, QStringLiteral("replace"));
        const QString wantedCreate =
            oracle(language_, QStringLiteral("create")).arg(stem);
        QStringList replaceCandidates = replaceTranslations();
        replaceCandidates.append(QStringLiteral("Replace..."));
        QStringList createCandidates = createTranslations(stem);
        createCandidates.append(
            QStringLiteral("Create Composition based on %1").arg(stem));
        QList<QMenu *> candidateMenus;
        for (QWidget *top : QApplication::topLevelWidgets()) {
            auto *menu = qobject_cast<QMenu *>(top);
            if (menu == nullptr || !menu->isVisible()) {
                continue;
            }
            bool candidate = false;
            for (QAction *action : menu->actions()) {
                if (replaceCandidates.contains(action->text())
                    || createCandidates.contains(action->text())) {
                    candidate = true;
                }
            }
            if (candidate) {
                candidateMenus.append(menu);
            }
        }
        if (candidateMenus.size() > 1) {
            fail(
                QStringLiteral(
                    "visible Assets QMenu is ambiguous stem=%1 count=%2")
                    .arg(stem)
                    .arg(candidateMenus.size()));
            return;
        }
        if (candidateMenus.isEmpty()) {
            if (++menuAttempts_ > kMenuAttempts) {
                fail(
                    QStringLiteral(
                        "visible Assets QMenu timeout stem=%1").arg(stem));
                return;
            }
            schedule(50, [this]() {
                inspectPositiveMenu();
            });
            return;
        }
        QMenu *menu = candidateMenus.front();
        int replaceHits = 0;
        int createHits = 0;
        QStringList forbidden;
        for (QAction *action : menu->actions()) {
            const QString text = action->text();
            if (text == wantedReplace) {
                if (!actionIsPaintedBy(action, menu)) {
                    fail(QStringLiteral(
                        "Replace QAction is not painted by target QMenu"));
                    return;
                }
                ++replaceHits;
            } else if (replaceCandidates.contains(text)) {
                forbidden.append(text);
            }
            if (text == wantedCreate) {
                if (!actionIsPaintedBy(action, menu)) {
                    fail(QStringLiteral(
                        "Create QAction is not painted by target QMenu"));
                    return;
                }
                ++createHits;
            } else if (createCandidates.contains(text)) {
                forbidden.append(text);
            }
        }
        if (replaceHits != 1 || createHits != 1
            || !forbidden.isEmpty()) {
            fail(
                QStringLiteral(
                    "Assets QMenu is not exact current-language producer "
                    "stem=%1 replace=%2 create=%3 forbidden=%4")
                    .arg(stem)
                    .arg(replaceHits)
                    .arg(createHits)
                    .arg(forbidden.join(QLatin1Char('|'))));
            return;
        }
        contextAccepted_ = true;
        QJsonObject details {
            {QStringLiteral("logicalSurface"), QStringLiteral("assets")},
            {
                QStringLiteral("ownerClass"),
                className(assetsWindow_)
            },
            {
                QStringLiteral("producerReceiverClass"),
                className(dropTarget_)
            },
            {QStringLiteral("fixtureStem"), stem},
            {QStringLiteral("ownerExternalUnchanged"), true},
            {
                QStringLiteral("observedTexts"),
                QJsonArray {wantedReplace, wantedCreate}
            },
            {QStringLiteral("source"), QStringLiteral("Replace...")},
            {
                QStringLiteral("sourceTemplate"),
                QStringLiteral("Create Composition based on %1")
            },
            {QStringLiteral("dropDelivered"), true},
            {QStringLiteral("dropAccepted"), true},
        };
        publishCapture(
            menu,
            menu,
            stemIndex_ == 0
                ? QStringLiteral("assets-replace-source")
                : QStringLiteral("assets-dynamic-proof-two"),
            details,
            [this, menu]() {
                pendingAssetCapture_ =
                    captures_.last().toObject();
                menuValidated_ = true;
                QMenu *rootMenu = menu;
                while (auto *parentMenu =
                           qobject_cast<QMenu *>(
                               rootMenu->parentWidget())) {
                    rootMenu = parentMenu;
                }
                rootMenu->close();
                completeStemAfterProducerObservation();
            });
    }

    void completeStemAfterProducerObservation()
    {
        if (terminal_ || !menuValidated_) {
            return;
        }
        if (!contextPosted_ || !contextDelivered_) {
            fail(QStringLiteral(
                "posted ContextMenu did not reach the exact Assets receiver"));
            return;
        }
        if (!contextDelivered_ || !contextAccepted_) {
            fail(QStringLiteral(
                "ContextMenu returned without delivery+acceptance"));
            return;
        }
        const QString stem = stems_.at(stemIndex_);
        bool ambiguous = false;
        const QList<ExactAssetRow> rows =
            exactVisibleRows(stem, &ambiguous);
        if (ambiguous || rows.size() != beforeRowCount_ + 1
            || rows.size() != 1 || pendingAssetCapture_.isEmpty()) {
            fail(
                QStringLiteral(
                    "exact Assets row drifted after menu stem=%1 count=%2")
                    .arg(stem)
                    .arg(rows.size()));
            return;
        }
        menuValidated_ = false;
        assetObservations_.append(
            QJsonObject {
                {QStringLiteral("stem"), stem},
                {
                    QStringLiteral("fixture"),
                    fixtures_.at(stemIndex_)
                },
                {
                    QStringLiteral("beforeExactVisibleRows"),
                    beforeRowCount_
                },
                {
                    QStringLiteral("afterExactVisibleRows"),
                    rows.size()
                },
                {QStringLiteral("dropDelivered"), true},
                {QStringLiteral("dropAccepted"), true},
                {
                    QStringLiteral("contextDelivered"),
                    contextDelivered_
                },
                {
                    QStringLiteral("contextAccepted"),
                    contextAccepted_
                },
                {
                    QStringLiteral("producerOwnerClass"),
                    className(assetsWindow_)
                },
                {
                    QStringLiteral("producerReceiverClass"),
                    className(dropTarget_)
                },
                {
                    QStringLiteral("replaceObserved"),
                    oracle(language_, QStringLiteral("replace"))
                },
                {
                    QStringLiteral("createObserved"),
                    oracle(language_, QStringLiteral("create")).arg(stem)
                },
                {
                    QStringLiteral("capture"),
                    pendingAssetCapture_
                },
            });
        pendingAssetCapture_ = {};
        ++stemIndex_;
        selectedRow_.clear();
        selectedName_.clear();
        schedule(50, [this]() {
            runCurrentStem();
        });
    }
