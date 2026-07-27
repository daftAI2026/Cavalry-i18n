/**
 * [INPUT]: 依赖已验证并 process-lifetime PIN 的 CavalrySkiaRuntimeAbi、语言标签、受控 UTF-8 译文集合/string_view 与 Windows 系统 CJK 字体
 * [OUTPUT]: 对外提供经全量字形覆盖验证、无需拥有调用方文本的 CJK Skia Path 工厂；任一 ABI、字体或空轮廓异常均返回失败供调用方回退英文
 * [POS]: injector/windows 的自绘字形适配边界；不自行 GetModuleHandle/GetProcAddress，只消费 ABI 防火墙已放行的函数表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtCore/QString>

#include <memory>
#include <string>
#include <string_view>
#include <vector>

class CavalrySkiaRuntimeAbi;

class CavalrySkiaTextPathRenderer final
{
public:
    static std::shared_ptr<const CavalrySkiaTextPathRenderer> create(
        const QString &language,
        const std::vector<std::string> &requiredTexts,
        std::shared_ptr<const CavalrySkiaRuntimeAbi> runtimeAbi,
        QString *detail);

    ~CavalrySkiaTextPathRenderer();

    CavalrySkiaTextPathRenderer(
        const CavalrySkiaTextPathRenderer &) = delete;
    CavalrySkiaTextPathRenderer &operator=(
        const CavalrySkiaTextPathRenderer &) = delete;

    bool makePath(
        void *pathStorage,
        std::string_view utf8Text,
        double pointSize) const noexcept;
    QString fontFamily() const;

private:
    struct Impl;

    explicit CavalrySkiaTextPathRenderer(std::unique_ptr<Impl> impl);

    std::unique_ptr<Impl> impl_;
};
