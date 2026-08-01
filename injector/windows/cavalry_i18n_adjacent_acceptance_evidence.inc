/**
 * [INPUT]: 依赖 Implementation 的 exact producer QWidget/HWND、受控证据目录、ready/ack 状态与 Tag/Assets 逻辑结果
 * [OUTPUT]: 在 Implementation 类内提供 producer 当场 PNG、PID/HWND 锚点、write-once ready/ack/done、失败闭合与三图/两逻辑点完整性校验
 * [POS]: Windows adjacent acceptance 的证据与终态分片；瞬态窗口在 producer 时序内截图，外部封存路径/哈希并 ACK，进程清理由 exact-PID/HWND gate 在逻辑证据完成后统一执行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
    void publishCapture(
        QWidget *child,
        QWidget *window,
        const QString &surface,
        const QJsonObject &details,
        std::function<void()> continuation)
    {
        if (!exposeMainWindow()) {
            fail(QStringLiteral(
                "MainDock unavailable or a modal dialog survived before capture"));
            return;
        }
        if (terminal_ || !pendingAckPath_.isEmpty()
            || child == nullptr || window == nullptr
            || !child->isVisible() || !window->isVisible()
            || child->width() < 1 || child->height() < 1
            || window->width() < 1 || window->height() < 1) {
            fail(
                QStringLiteral(
                    "capture target is invalid or another capture is pending "
                    "surface=%1").arg(surface));
            return;
        }
        child->repaint();
        window->repaint();
        QCoreApplication::sendPostedEvents(child);
        QCoreApplication::sendPostedEvents(window);
        int resolutionScore = std::numeric_limits<int>::max();
        QRect nativeBounds;
        const quintptr windowHandle =
            resolveProcessWindowAnchor(
                window,
                &resolutionScore,
                &nativeBounds);
        if (windowHandle == 0) {
            fail(
                QStringLiteral(
                    "capture HWND is zero surface=%1 score=%2 "
                    "qt=%3,%4,%5x%6 native=%7,%8,%9x%10")
                    .arg(surface)
                    .arg(resolutionScore)
                    .arg(window->mapToGlobal(QPoint()).x())
                    .arg(window->mapToGlobal(QPoint()).y())
                    .arg(window->width())
                    .arg(window->height())
                    .arg(nativeBounds.x())
                    .arg(nativeBounds.y())
                    .arg(nativeBounds.width())
                    .arg(nativeBounds.height()));
            return;
        }
        const int sequence = ++captureSequence_;
        const QString prefix =
            QStringLiteral("%1-%2")
                .arg(sequence, 2, 10, QLatin1Char('0'))
                .arg(safeSurfaceName(surface));
        const QString readyPath =
            QDir(acceptanceDirectory_)
                .filePath(prefix + QStringLiteral(".ready.json"));
        const QString ackPath =
            QDir(acceptanceDirectory_)
                .filePath(prefix + QStringLiteral(".ack.json"));
        const QString capturePath =
            QDir(acceptanceDirectory_)
                .filePath(prefix + QStringLiteral(".png"));
        QFile captureFile(capturePath);
        if (!captureFile.open(
                QIODevice::WriteOnly | QIODevice::NewOnly)
            || !window->grab().save(&captureFile, "PNG")
            || !captureFile.flush()) {
            fail(
                QStringLiteral(
                    "exact producer PNG write-once failed surface=%1")
                    .arg(surface));
            return;
        }
        captureFile.close();
        QJsonObject target {
            {QStringLiteral("widgetClass"), className(child)},
            {QStringLiteral("objectName"), child->objectName()},
            {QStringLiteral("childBounds"), widgetBounds(child)},
            {QStringLiteral("windowBounds"), widgetBounds(window)},
            {
                QStringLiteral("windowHandle"),
                QString::number(windowHandle)
            },
            {
                QStringLiteral("childIsTopLevel"),
                child == window
            },
            {
                QStringLiteral("capturePath"),
                capturePath
            },
            {
                QStringLiteral("captureMethod"),
                QStringLiteral(
                    "qt-widget-grab-exact-producer+pid-hwnd-anchor")
            },
            {
                QStringLiteral("windowHandleScope"),
                resolutionScore <= 96
                    ? QStringLiteral("producer-window")
                    : QStringLiteral("process-window-anchor")
            },
            {
                QStringLiteral("windowHandleGeometryScore"),
                resolutionScore
            },
            {
                QStringLiteral("nativeHandleBounds"),
                QJsonObject {
                    {QStringLiteral("x"), nativeBounds.x()},
                    {QStringLiteral("y"), nativeBounds.y()},
                    {QStringLiteral("width"), nativeBounds.width()},
                    {QStringLiteral("height"), nativeBounds.height()},
                }
            },
            {QStringLiteral("windowTitle"), window->windowTitle()},
        };
        QJsonObject result = details;
        result.insert(QStringLiteral("surface"), surface);
        result.insert(QStringLiteral("sequence"), sequence);
        result.insert(QStringLiteral("target"), target);
        result.insert(QStringLiteral("readyPath"), readyPath);
        const QJsonObject ready {
            {
                QStringLiteral("schema"),
                QStringLiteral(
                    "cavalry-i18n.windows-adjacent.capture-ready/v1")
            },
            {QStringLiteral("language"), language_},
            {
                QStringLiteral("pid"),
                static_cast<double>(
                    QCoreApplication::applicationPid())
            },
            {QStringLiteral("sequence"), sequence},
            {QStringLiteral("surface"), surface},
            {QStringLiteral("target"), target},
            {QStringLiteral("result"), result},
        };
        if (!writeExclusive(readyPath, ready)) {
            fail(
                QStringLiteral(
                    "capture ready write-once failed surface=%1")
                    .arg(surface));
            return;
        }
        captures_.append(result);
        pendingAckPath_ = ackPath;
        pendingSurface_ = surface;
        pendingContinuation_ = std::move(continuation);
        pendingCaptureTimer_.restart();
        schedule(25, [this]() {
            pollCaptureAck();
        });
    }

    void pollCaptureAck()
    {
        if (terminal_ || pendingAckPath_.isEmpty()) {
            return;
        }
        if (pendingCaptureTimer_.elapsed()
            > kCaptureTimeoutMilliseconds) {
            fail(
                QStringLiteral("capture ACK timeout surface=%1")
                    .arg(pendingSurface_));
            return;
        }
        const QFileInfo ackInfo(pendingAckPath_);
        if (!ackInfo.exists()) {
            schedule(25, [this]() {
                pollCaptureAck();
            });
            return;
        }
        if (!ackInfo.isFile() || ackInfo.isSymLink()
            || ackInfo.dir().canonicalPath()
                != acceptanceDirectory_) {
            fail(
                QStringLiteral("capture ACK escaped evidence directory"));
            return;
        }
        QFile file(pendingAckPath_);
        if (!file.open(QIODevice::ReadOnly)) {
            fail(QStringLiteral("capture ACK is unreadable"));
            return;
        }
        QJsonParseError parseError {};
        const QJsonObject ack =
            QJsonDocument::fromJson(file.readAll(), &parseError).object();
        const bool valid =
            parseError.error == QJsonParseError::NoError
            && ack.value(QStringLiteral("schema")).toString()
                == QStringLiteral(
                    "cavalry-i18n.windows-adjacent.capture-ack/v1")
            && ack.value(QStringLiteral("status")).toString()
                == QStringLiteral("CAPTURED")
            && ack.value(QStringLiteral("language")).toString()
                == language_
            && ack.value(QStringLiteral("pid")).toInteger()
                == QCoreApplication::applicationPid()
            && ack.value(QStringLiteral("sequence")).toInt()
                == captureSequence_
            && ack.value(QStringLiteral("surface")).toString()
                == pendingSurface_;
        if (!valid) {
            fail(
                QStringLiteral("capture ACK identity mismatch surface=%1")
                    .arg(pendingSurface_));
            return;
        }
        std::function<void()> continuation =
            std::move(pendingContinuation_);
        pendingAckPath_.clear();
        pendingSurface_.clear();
        pendingCaptureTimer_.invalidate();
        continuation();
    }

    void closeVisibleMenus()
    {
        for (QWidget *top : QApplication::topLevelWidgets()) {
            auto *menu = qobject_cast<QMenu *>(top);
            if (menu != nullptr && menu->isVisible()) {
                menu->close();
            }
        }
    }

    bool writeDone(
        const QString &status,
        const QString &reason,
        const QJsonArray &logicalResults)
    {
        if (acceptanceDirectory_.isEmpty()) {
            return false;
        }
        const QJsonObject done {
            {
                QStringLiteral("schema"),
                QStringLiteral(
                    "cavalry-i18n.windows-adjacent.done/v1")
            },
            {QStringLiteral("status"), status},
            {QStringLiteral("reason"), reason},
            {QStringLiteral("language"), language_},
            {
                QStringLiteral("pid"),
                static_cast<double>(
                    QCoreApplication::applicationPid())
            },
            {
                QStringLiteral("logicalResultCount"),
                logicalResults.size()
            },
            {QStringLiteral("captureCount"), captures_.size()},
            {QStringLiteral("logicalResults"), logicalResults},
            {QStringLiteral("captures"), captures_},
            {QStringLiteral("bypassedWindows"), bypassedWindows_},
        };
        return writeExclusive(
            QDir(acceptanceDirectory_)
                .filePath(QStringLiteral("done.json")),
            done);
    }

    void fail(const QString &reason)
    {
        if (terminal_) {
            return;
        }
        terminal_ = true;
        closeVisibleMenus();
        if (configurationValidated_) {
            (void) writeDone(QStringLiteral("ERROR"), reason, {});
        }
    }

    void finishSuccess()
    {
        if (terminal_) {
            return;
        }
        if (tagResult_.isEmpty()
            || assetObservations_.size() != 2
            || captures_.size() != 3) {
            fail(QStringLiteral(
                "Tag/Assets logical or capture completeness failed"));
            return;
        }
        terminal_ = true;
        closeVisibleMenus();
        const QJsonObject assetsResult {
            {QStringLiteral("surface"), QStringLiteral("assets")},
            {QStringLiteral("owner"), QStringLiteral("assets::Window")},
            {
                QStringLiteral("observedStems"),
                QJsonArray {
                    stems_.at(0),
                    stems_.at(1),
                }
            },
            {
                QStringLiteral("replaceText"),
                oracle(language_, QStringLiteral("replace"))
            },
            {
                QStringLiteral("createTemplate"),
                oracle(language_, QStringLiteral("create"))
            },
            {QStringLiteral("ownerExternalUnchanged"), true},
            {QStringLiteral("variants"), assetObservations_},
        };
        (void) writeDone(
            QStringLiteral("OK"),
            QStringLiteral(
                "Tag and Assets real producers passed exact owner, "
                "dynamic stem, and exact-HWND evidence"),
            QJsonArray {tagResult_, assetsResult});
    }
