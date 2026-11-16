/**
 * [INPUT]: 依赖唯一native locale、借用视图、平台证明的空值及格式化结果；Mac保留源std::string快照和分架构fallback相对位置。
 * [OUTPUT]: 提供共享标题字节投影与兼容Mac入口；占位身份由平台ABI层证明。
 * [POS]: 主标题无状态策略；分隔符与用户名称按长度保全，Windows不借用Mac对象布局。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include "native_locale_snapshot.h"
#include "title_format_abi_contract.h"

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>
#include <string_view>

namespace native_title_format {

struct BorrowedText {
    const char *data = nullptr;
    std::size_t size = 0;
};

struct Inputs {
    std::uintptr_t valuesAddress = 0;
    BorrowedText project{};
    BorrowedText scene{};
    native_title_format_abi::LibCppStringSnapshot projectSource{};
    native_title_format_abi::LibCppStringSnapshot sceneSource{};
};

struct Labels {
    std::string_view project;
    std::string_view scene;
    std::string_view noProject;
    std::string_view untitled;
};

// -- 文案来源：colorWindow.header.project、colorWindow.header.scene --------
// -- 以及cli.log.none、recovery.untitled -----------------------------------
inline Labels labelsFor(cavalry_native_font::Locale locale) noexcept
{
    switch (locale) {
        case cavalry_native_font::Locale::Hans:
            return {"项目", "场景", "无", "无标题"};
        case cavalry_native_font::Locale::Hant:
            return {"專案", "場景", "無", "無標題"};
        case cavalry_native_font::Locale::Japanese:
            return {"プロジェクト", "シーン", "なし", "無題"};
        case cavalry_native_font::Locale::Unset:
        case cavalry_native_font::Locale::English:
        case cavalry_native_font::Locale::Unknown:
            return {};
    }
    return {};
}

inline bool segmentEquals(std::string_view source, std::size_t offset,
                          std::string_view expected) noexcept
{
    if (offset > source.size() || expected.size() > source.size() - offset)
        return false;
    return expected.empty() ||
        std::memcmp(source.data() + offset, expected.data(), expected.size()) == 0;
}

inline bool segmentEquals(std::string_view source, std::size_t offset,
                          BorrowedText expected) noexcept
{
    if (expected.data == nullptr && expected.size != 0) return false;
    if (offset > source.size() || expected.size > source.size() - offset)
        return false;
    return expected.size == 0 ||
        std::memcmp(source.data() + offset, expected.data, expected.size) == 0;
}

inline bool isFallbackAt(std::uintptr_t valuesAddress, BorrowedText value,
                         std::intptr_t distance, std::size_t length) noexcept
{
    if (value.size != length || value.data == nullptr) return false;
    const auto address = reinterpret_cast<std::uintptr_t>(value.data);
    if (distance >= 0) {
        const auto before = static_cast<std::uintptr_t>(distance);
        return valuesAddress >= before && address == valuesAddress - before;
    }
    const auto after = std::uintptr_t{0} - static_cast<std::uintptr_t>(distance);
    return address >= valuesAddress && address - valuesAddress == after;
}

// -- 平台层证明占位身份；共享层只处理已核对的原厂标题字节 -----------------
inline bool projectValues(std::string &formatted, cavalry_native_font::Locale locale,
                          BorrowedText projectValue, BorrowedText sceneValue,
                          bool projectFallback, bool sceneFallback)
{
    const Inputs inputs{0, projectValue, sceneValue, {}, {}};
    const Labels labels = labelsFor(locale);
    if (labels.project.empty() || labels.scene.empty() ||
        labels.noProject.empty() || labels.untitled.empty()) return false;

    constexpr std::string_view projectPrefix = "Project: ";
    constexpr std::string_view projectSceneSeparator = " - Scene: ";
    const std::string_view source(formatted.data(), formatted.size());
    if (!segmentEquals(source, 0, projectPrefix) ||
        inputs.project.size > source.size() - projectPrefix.size()) return false;

    const std::size_t projectOffset = projectPrefix.size();
    const std::size_t sceneSeparatorOffset = projectOffset + inputs.project.size;
    if (!segmentEquals(source, projectOffset, inputs.project) ||
        !segmentEquals(source, sceneSeparatorOffset, projectSceneSeparator)) return false;

    const std::size_t sceneOffset = sceneSeparatorOffset + projectSceneSeparator.size();
    if (inputs.scene.size > source.size() - sceneOffset) return false;
    const std::size_t sceneEnd = sceneOffset + inputs.scene.size;
    if (!segmentEquals(source, sceneOffset, inputs.scene) || sceneEnd >= source.size() ||
        source[sceneEnd] != ' ') return false;

    const bool noProject = projectFallback &&
        segmentEquals(source, projectOffset, "None");
    const bool untitled = sceneFallback &&
        segmentEquals(source, sceneOffset, "Untitled");

    std::string projected;
    projected.reserve(source.size() + labels.project.size() + labels.scene.size());
    projected.append(labels.project.data(), labels.project.size());
    projected.append(": ");
    if (noProject) {
        projected.append(labels.noProject.data(), labels.noProject.size());
    } else {
        projected.append(source.data() + projectOffset, inputs.project.size);
    }
    projected.append(" - ");
    projected.append(labels.scene.data(), labels.scene.size());
    projected.append(": ");
    if (untitled) {
        projected.append(labels.untitled.data(), labels.untitled.size());
    } else {
        projected.append(source.data() + sceneOffset, inputs.scene.size);
    }
    projected.append(source.data() + sceneEnd, source.size() - sceneEnd);
    formatted.swap(projected);
    return true;
}

// -- Mac既有ABI入口保持不变，地址和源对象共同证明真实空值 -----------------
inline bool project(std::string &formatted, cavalry_native_font::Locale locale,
                    const Inputs &inputs)
{
    const bool noProject =
        native_title_format_abi::isEmptyShortString(inputs.projectSource) &&
        isFallbackAt(inputs.valuesAddress, inputs.project,
                     native_title_format_abi::contract::kProjectFallbackDistance,
                     native_title_format_abi::contract::kProjectFallbackLength);
    const bool untitled =
        native_title_format_abi::isEmptyShortString(inputs.sceneSource) &&
        isFallbackAt(inputs.valuesAddress, inputs.scene,
                     native_title_format_abi::contract::kSceneFallbackDistance,
                     native_title_format_abi::contract::kSceneFallbackLength);
    return projectValues(formatted, locale, inputs.project, inputs.scene, noProject, untitled);
}

}  // namespace native_title_format
