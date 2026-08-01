/**
 * [INPUT]: 依赖显式 Windows adjacent acceptance 目录、当前语言、两份目录内冻结 fixture，以及 Cavalry 真实 Qt 控件拓扑
 * [OUTPUT]: 对外提供仅在显式验收环境启用的 Tag/Assets producer 状态机，以 producer-side PNG 与 write-once ready/ack/done 握手发布 exact-HWND 语义证据
 * [POS]: injector/windows 的验收专用边界；正常翻译运行时不创建场景，验收时只走 Tag 点击与 Assets Drop/ContextMenu 的真实产品操作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QObject>
#include <QtCore/QString>

#include <memory>

class QEvent;

class CavalryI18nAdjacentAcceptance final : public QObject
{
public:
    explicit CavalryI18nAdjacentAcceptance(
        const QString &language,
        QObject *parent = nullptr);
    ~CavalryI18nAdjacentAcceptance() override;

    bool isEnabled() const;
    void start();
    void drive();

protected:
    bool eventFilter(QObject *watched, QEvent *event) override;

private:
    class Implementation;
    std::unique_ptr<Implementation> implementation_;
    bool driveActive_ = false;
};
