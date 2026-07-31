/**
 * [INPUT]: 依赖 Implementation 的验收目录、语言 oracle、Qt 顶层控件树、调度器与 Tag 状态
 * [OUTPUT]: 在 Implementation 类内提供配置闭合、登录旁路、MainDock 暴露、TagHeader 点击、PopOverView 精确标签与首张 write-once 证据推进
 * [POS]: Windows adjacent acceptance 的生命周期与 Tag 分片；只在显式受控验收目录启用，正常运行时不消费这些方法
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
    void schedule(
        int delayMilliseconds,
        std::function<void()> task)
    {
        if (terminal_) {
            return;
        }
        if (scheduledTask_) {
            fail(QStringLiteral(
                "adjacent state machine scheduled overlapping tasks"));
            return;
        }
        scheduledTask_ = std::move(task);
        stateTimer_.start(delayMilliseconds);
    }

    bool validateConfiguration()
    {
        if (oracle(language_, QStringLiteral("tagAssign")).isEmpty()
            || oracle(language_, QStringLiteral("create")).isEmpty()) {
            fail(QStringLiteral("current-language oracle unavailable"));
            return false;
        }
        const QString diagnosticMarker =
            qEnvironmentVariable(kDiagnosticMarkerEnvironment).trimmed();
        if (!QDir::isAbsolutePath(requestedDirectory_)
            || !QDir::isAbsolutePath(diagnosticMarker)) {
            fail(QStringLiteral(
                "acceptance and diagnostic marker paths must be absolute"));
            return false;
        }
        const QFileInfo markerInfo(QDir::cleanPath(diagnosticMarker));
        if (!markerInfo.exists() || !markerInfo.isFile()
            || markerInfo.isSymLink() || markerInfo.isJunction()) {
            fail(QStringLiteral(
                "diagnostic marker must be an existing real file"));
            return false;
        }
        const QFileInfo directoryInfo(
            QDir::cleanPath(requestedDirectory_));
        if (!directoryInfo.exists() || !directoryInfo.isDir()
            || directoryInfo.isSymLink()
            || directoryInfo.isJunction()) {
            fail(QStringLiteral(
                "acceptance directory must be a real directory"));
            return false;
        }
        acceptanceDirectory_ = directoryInfo.canonicalFilePath();
        const QString markerParent =
            markerInfo.dir().canonicalPath();
        const QString directoryParent =
            QFileInfo(acceptanceDirectory_).dir().canonicalPath();
        if (acceptanceDirectory_.isEmpty()
            || markerParent.isEmpty()
            || directoryParent != markerParent) {
            fail(QStringLiteral(
                "acceptance directory must be a real direct child "
                "of the diagnostic marker directory"));
            return false;
        }
        QStringList canonicalFixtures;
        for (int index = 0; index < fixtures_.size(); ++index) {
            const QFileInfo fixtureInfo(fixtures_.at(index));
            const QString fixturePath =
                fixtureInfo.canonicalFilePath();
            const QString baseStem = stems_.at(index);
            const QString fixtureStem =
                fixtureInfo.completeBaseName();
            if (!QDir::isAbsolutePath(fixtures_.at(index))
                || !fixtureInfo.exists()
                || !fixtureInfo.isFile()
                || fixtureInfo.isSymLink()
                || fixtureInfo.isJunction()
                || fixturePath.isEmpty()
                || (fixtureStem != baseStem
                    && !fixtureStem.startsWith(
                        baseStem + QLatin1Char('-')))
                || fixtureInfo.dir().canonicalPath()
                    != acceptanceDirectory_) {
                fail(
                    QStringLiteral(
                        "fixture must be a real direct child with exact "
                        "stem=%1 path=%2")
                        .arg(stems_.at(index), fixtures_.at(index)));
                return false;
            }
            QFile fixture(fixturePath);
            if (!fixture.open(QIODevice::ReadOnly)
                || fixture.read(1).isEmpty()) {
                fail(
                    QStringLiteral("fixture is unreadable or empty stem=%1")
                        .arg(stems_.at(index)));
                return false;
            }
            stems_[index] = fixtureStem;
            canonicalFixtures.append(fixturePath);
        }
        if (canonicalFixtures.at(0) == canonicalFixtures.at(1)) {
            fail(QStringLiteral("dual fixtures resolve to one file"));
            return false;
        }
        fixtures_ = canonicalFixtures;
        const QStringList staleFiles =
            QDir(acceptanceDirectory_).entryList(
                {
                    QStringLiteral("*.ready.json"),
                    QStringLiteral("*.ack.json"),
                    QStringLiteral("done.json"),
                },
                QDir::Files | QDir::System);
        if (!staleFiles.isEmpty()) {
            fail(
                QStringLiteral("acceptance directory contains stale evidence"));
            return false;
        }
        configurationValidated_ = true;
        return true;
    }

    bool exposeMainWindow()
    {
        bool found = false;
        for (QWidget *widget : QApplication::topLevelWidgets()) {
            if (widget == nullptr) {
                continue;
            }
            const QString klass = className(widget);
            const QString title = widget->windowTitle();
            const bool welcome =
                klass.contains(QStringLiteral("SignInDialog"))
                || title.contains(
                    QStringLiteral("Welcome"),
                    Qt::CaseInsensitive)
                || title.contains(QStringLiteral("欢迎"))
                || title.contains(QStringLiteral("歡迎"))
                || title.contains(QStringLiteral("ようこそ"));
            const bool blockingDialog =
                qobject_cast<QDialog *>(widget) != nullptr
                && klass != QStringLiteral("PopOverView")
                && (widget->isModal()
                    || widget->windowModality() != Qt::NonModal);
            if (welcome || blockingDialog) {
                const QString identity =
                    QStringLiteral("%1|%2").arg(klass, title);
                bool alreadyRecorded = false;
                for (const QJsonValue &value : bypassedWindows_) {
                    if (value.toString() == identity) {
                        alreadyRecorded = true;
                        break;
                    }
                }
                if (!alreadyRecorded) {
                    bypassedWindows_.append(identity);
                }
                if (auto *dialog = qobject_cast<QDialog *>(widget)) {
                    dialog->setModal(false);
                }
                widget->setWindowModality(Qt::NonModal);
                widget->hide();
                continue;
            }
            if (klass.contains(QStringLiteral("Main"))
                || title.contains(
                    QStringLiteral("Cavalry"),
                    Qt::CaseInsensitive)) {
                if (!widget->isVisible()) {
                    widget->showNormal();
                    widget->raise();
                }
                found = true;
            }
        }
        for (QWidget *widget : QApplication::topLevelWidgets()) {
            if (widget != nullptr && widget->isVisible()
                && qobject_cast<QDialog *>(widget) != nullptr
                && className(widget) != QStringLiteral("PopOverView")
                && (widget->isModal()
                    || widget->windowModality() != Qt::NonModal)) {
                fail(QStringLiteral(
                    "unexpected visible modal survived acceptance bypass "
                    "class=%1 title=%2")
                    .arg(className(widget), widget->windowTitle()));
                return false;
            }
        }
        return found;
    }

    void retry(
        const QString &missing,
        const std::function<void()> &continuation)
    {
        if (topologyAttempts_ == 0) {
            QJsonArray topLevels;
            for (QWidget *widget : QApplication::topLevelWidgets()) {
                if (widget == nullptr) {
                    continue;
                }
                topLevels.append(
                    QJsonObject {
                        {QStringLiteral("class"), className(widget)},
                        {
                            QStringLiteral("title"),
                            widget->windowTitle()
                        },
                        {
                            QStringLiteral("visible"),
                            widget->isVisible()
                        },
                    });
            }
            writeExclusive(
                QDir(acceptanceDirectory_)
                    .filePath(QStringLiteral("first-topology-miss.json")),
                QJsonObject {
                    {
                        QStringLiteral("schema"),
                        QStringLiteral(
                            "cavalry-i18n.windows-adjacent.topology/v1")
                    },
                    {QStringLiteral("missing"), missing},
                    {QStringLiteral("topLevels"), topLevels},
                });
        }
        if (++topologyAttempts_ > kTopologyAttempts) {
            fail(
                QStringLiteral("bounded topology timeout missing=%1")
                    .arg(missing));
            return;
        }
        schedule(100, continuation);
    }

    void pollTagTopology()
    {
        if (terminal_) {
            return;
        }
        if (!exposeMainWindow()) {
            retry(QStringLiteral("MainDock"), [this]() {
                pollTagTopology();
            });
            return;
        }
        QList<QWidget *> headers;
        for (QWidget *widget : QApplication::allWidgets()) {
            if (widget != nullptr
                && className(widget) == QStringLiteral("cavalry::TagHeader")
                && widget->isVisible()) {
                headers.append(widget);
            }
        }
        if (headers.size() > 1) {
            fail(QStringLiteral("TagHeader identity is ambiguous"));
            return;
        }
        if (headers.isEmpty()) {
            retry(QStringLiteral("cavalry::TagHeader"), [this]() {
                pollTagTopology();
            });
            return;
        }
        QList<QWidget *> addButtons;
        const QString expectedButton =
            oracle(language_, QStringLiteral("tagButton"));
        for (QObject *child : headers.front()->children()) {
            auto *widget = qobject_cast<QWidget *>(child);
            if (widget != nullptr
                && className(widget) == QStringLiteral("GroupButton")
                && widget->isVisibleTo(headers.front())
                && widget->isEnabled()
                && widget->toolTip() == expectedButton) {
                addButtons.append(widget);
            }
        }
        if (addButtons.size() > 1) {
            fail(QStringLiteral("Add Tag GroupButton identity is ambiguous"));
            return;
        }
        if (addButtons.isEmpty()) {
            retry(QStringLiteral("Add Tag GroupButton"), [this]() {
                pollTagTopology();
            });
            return;
        }
        tagOwnerExternalUnchanged_ =
            syntheticLabelRemainsEnglish(
                QStringLiteral("Add Tag:"),
                addButtons.front()->window())
            && syntheticLabelRemainsEnglish(
                QStringLiteral("Assign Tag to Selection: "),
                addButtons.front()->window());
        if (!tagOwnerExternalUnchanged_) {
            fail(QStringLiteral("Tag owner-external negative changed"));
            return;
        }
        topologyAttempts_ = 0;
        dispatchWidgetClick(addButtons.front());
        schedule(50, [this]() {
            pollTagPopover();
        });
    }

    QLabel *uniqueExactLabel(
        QWidget *owner,
        const QString &text) const
    {
        QList<QLabel *> matches;
        if (owner == nullptr) {
            return nullptr;
        }
        for (QLabel *label : owner->findChildren<QLabel *>()) {
            if (label->isVisibleTo(owner) && label->text() == text) {
                matches.append(label);
            }
        }
        return matches.size() == 1 ? matches.front() : nullptr;
    }

    void pollTagPopover()
    {
        if (terminal_) {
            return;
        }
        QList<QWidget *> owners;
        QLabel *addLabel = nullptr;
        QLabel *assignLabel = nullptr;
        const QString expectedAdd =
            oracle(language_, QStringLiteral("tagAdd"));
        const QString expectedAssign =
            oracle(language_, QStringLiteral("tagAssign"));
        for (QWidget *candidate : QApplication::allWidgets()) {
            if (candidate == nullptr
                || className(candidate) != QStringLiteral("PopOverView")
                || !candidate->isVisible()
                || !ancestorHasClass(
                    candidate,
                    QStringLiteral("MainDock"))) {
                continue;
            }
            QLabel *candidateAdd =
                uniqueExactLabel(candidate, expectedAdd);
            QLabel *candidateAssign =
                uniqueExactLabel(candidate, expectedAssign);
            if (candidateAdd != nullptr
                && candidateAssign != nullptr) {
                owners.append(candidate);
                addLabel = candidateAdd;
                assignLabel = candidateAssign;
            }
        }
        if (owners.size() > 1) {
            fail(QStringLiteral("Tag PopOverView identity is ambiguous"));
            return;
        }
        if (owners.isEmpty() || addLabel == nullptr
            || assignLabel == nullptr) {
            if (topologyAttempts_ >= kTopologyAttempts - 2) {
                QJsonArray observed;
                for (QWidget *candidate : QApplication::allWidgets()) {
                    if (candidate == nullptr
                        || className(candidate)
                            != QStringLiteral("PopOverView")) {
                        continue;
                    }
                    QJsonArray labels;
                    for (QLabel *label :
                         candidate->findChildren<QLabel *>()) {
                        labels.append(QJsonObject {
                            {QStringLiteral("text"), label->text()},
                            {
                                QStringLiteral("visible"),
                                label->isVisibleTo(candidate)
                            },
                        });
                    }
                    observed.append(QJsonObject {
                        {
                            QStringLiteral("visible"),
                            candidate->isVisible()
                        },
                        {
                            QStringLiteral("mainDockAncestor"),
                            ancestorHasClass(
                                candidate,
                                QStringLiteral("MainDock"))
                        },
                        {QStringLiteral("labels"), labels},
                    });
                }
                writeExclusive(
                    QDir(acceptanceDirectory_).filePath(
                        QStringLiteral("tag-popover-observed.json")),
                    QJsonObject {
                        {QStringLiteral("observed"), observed},
                        {QStringLiteral("expectedAdd"), expectedAdd},
                        {
                            QStringLiteral("expectedAssign"),
                            expectedAssign
                        },
                    });
            }
            retry(QStringLiteral("Tag PopOverView exact labels"), [this]() {
                pollTagPopover();
            });
            return;
        }
        tagPopover_ = owners.front();
        QWidget *window = tagPopover_->window();
        QJsonObject details {
            {QStringLiteral("logicalSurface"), QStringLiteral("tag")},
            {
                QStringLiteral("ownerClass"),
                className(tagPopover_)
            },
            {
                QStringLiteral("producerClass"),
                QStringLiteral("cavalry::TagHeader")
            },
            {
                QStringLiteral("ownerExternalUnchanged"),
                tagOwnerExternalUnchanged_
            },
            {
                QStringLiteral("observedTexts"),
                QJsonArray {expectedAdd, expectedAssign}
            },
            {
                QStringLiteral("sourceTexts"),
                QJsonArray {
                    QStringLiteral("Add Tag:"),
                    QStringLiteral("Assign Tag to Selection: "),
                }
            },
        };
        publishCapture(
            tagPopover_,
            window,
            QStringLiteral("tag-add-assign"),
            details,
            [this, expectedAdd, expectedAssign]() {
                tagResult_ = {
                    {QStringLiteral("surface"), QStringLiteral("tag")},
                    {
                        QStringLiteral("owner"),
                        QStringLiteral("cavalry::TagHeader")
                    },
                    {
                        QStringLiteral("producerResult"),
                        QStringLiteral("PopOverView")
                    },
                    {
                        QStringLiteral("observedTexts"),
                        QJsonArray {expectedAdd, expectedAssign}
                    },
                    {QStringLiteral("ownerExternalUnchanged"), true},
                    {
                        QStringLiteral("capture"),
                        captures_.last()
                    },
                };
                if (tagPopover_ != nullptr) {
                    tagPopover_->hide();
                }
                topologyAttempts_ = 0;
                pollAssetsTopology();
            });
    }
