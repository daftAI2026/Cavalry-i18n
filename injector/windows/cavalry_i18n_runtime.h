/**
 * [INPUT]: 依赖 QPA 显式语言、嵌入翻译器、显示层、ExtensionLayer 聚合 hook、独立时间轴字体 hook 与 Qt 事件过滤；诊断采样门使用 GUI 线程单调时钟
 * [OUTPUT]: 对外提供严格语言谓词、可查询配置结果、受控显示刷新、真实 Assets ContextMenu→QMenu producer 交接与低频 revision 诊断 marker；安装状态变化仍即时写出
 * [POS]: injector/windows 的发布 Qt 运行时核心；正常路径拒绝环境语言旁路，以同步事件身份约束 Assets 动态模板，Paint 事件不再进入诊断写盘，所有 UI 验收 driver 均由不发布的独立插件承载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QElapsedTimer>
#include <QtCore/QObject>
#include <QtCore/QPointer>
#include <QtCore/QString>

#include <cstdint>
#include <memory>
#include <optional>

class QEvent;
class QWidget;
class CavalryDisplayTranslator;
class CavalryEmbeddedTranslator;
class CavalryExtensionLayerHook;
class CavalryTimelineFontHook;

bool cavalryIsSupportedRuntimeLanguage(const QString &language);

struct CavalryRuntimeDiagnosticSnapshot final
{
    std::uint64_t textPathRevision = 0;
    std::uint64_t timelineFontRevision = 0;
};

inline bool operator==(
    const CavalryRuntimeDiagnosticSnapshot &left,
    const CavalryRuntimeDiagnosticSnapshot &right) noexcept
{
    return left.textPathRevision == right.textPathRevision
        && left.timelineFontRevision == right.timelineFontRevision;
}

class CavalryRuntimeDiagnosticSampler final
{
public:
    static constexpr std::int64_t kDefaultIntervalMilliseconds = 1'000;

    explicit CavalryRuntimeDiagnosticSampler(
        std::int64_t intervalMilliseconds)
        : intervalMilliseconds_(intervalMilliseconds > 0
              ? intervalMilliseconds : 1)
    {
    }

    void prime(
        const CavalryRuntimeDiagnosticSnapshot &persisted,
        std::int64_t persistedAtMilliseconds) noexcept
    {
        persisted_ = persisted;
        persistedAtMilliseconds_ = persistedAtMilliseconds;
        primed_ = true;
    }

    std::optional<CavalryRuntimeDiagnosticSnapshot> sample(
        const CavalryRuntimeDiagnosticSnapshot &observed,
        std::int64_t nowMilliseconds) const noexcept
    {
        if (!primed_) {
            return observed;
        }
        if (observed == persisted_
            || nowMilliseconds < persistedAtMilliseconds_
            || nowMilliseconds - persistedAtMilliseconds_
                < intervalMilliseconds_) {
            return std::nullopt;
        }

        return observed;
    }

private:
    std::int64_t intervalMilliseconds_;
    CavalryRuntimeDiagnosticSnapshot persisted_ {};
    std::int64_t persistedAtMilliseconds_ = 0;
    bool primed_ = false;
};

class CavalryI18nRuntime final : public QObject
{
public:
    explicit CavalryI18nRuntime(
        const QString &requestedLanguage);
    ~CavalryI18nRuntime() override;

    bool isConfigured() const;

protected:
    bool eventFilter(QObject *watched, QEvent *event) override;

private:
    bool configure();
    void ensureExtensionLayerHook();
    void maybeWriteTextPathDiagnostic();
    CavalryRuntimeDiagnosticSnapshot diagnosticSnapshot() const;
    void queueRefresh(QWidget *root);
    void refreshAllTopLevelWidgets();
    void refreshWindow(QWidget *window);
    bool writeDiagnostic(
        const QString &status,
        const QString &message,
        bool translatorInstalled) const;

    QString requestedLanguage_;
    QString language_;
    std::unique_ptr<CavalryEmbeddedTranslator> translator_;
    std::unique_ptr<CavalryDisplayTranslator> displayTranslator_;
    std::unique_ptr<CavalryExtensionLayerHook> extensionLayerHook_;
    std::unique_ptr<CavalryTimelineFontHook> timelineFontHook_;
    QPointer<QObject> assetsContextMenuProducer_;
    QElapsedTimer diagnosticClock_;
    CavalryRuntimeDiagnosticSampler diagnosticSampler_ {
        CavalryRuntimeDiagnosticSampler::kDefaultIntervalMilliseconds
    };
    bool translatorInstalled_ = false;
    bool configured_ = false;
};
